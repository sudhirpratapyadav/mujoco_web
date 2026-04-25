import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { ModelView, StateView } from '../sim/types';

// MuJoCo geom type enum (mjtGeom)
const GEOM_PLANE = 0;
const GEOM_HFIELD = 1;
const GEOM_SPHERE = 2;
const GEOM_CAPSULE = 3;
const GEOM_ELLIPSOID = 4;
const GEOM_CYLINDER = 5;
const GEOM_BOX = 6;
const GEOM_MESH = 7;

export class ThreeViewer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private model: ModelView;
  private state: StateView;

  // Per-geom Three.js objects, indexed by MuJoCo geom id. null = not rendered.
  private meshes: (THREE.Object3D | null)[] = [];

  // Scratch matrix to avoid per-frame allocation.
  private readonly tmpMat = new THREE.Matrix4();

  constructor(container: HTMLElement, model: ModelView, state: StateView) {
    this.model = model;
    this.state = state;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = makeGradientSky(0x6e8db3, 0x1b2026);
    // IBL fill — even unlit faces get a believable studio bounce. Roughness
    // values still control glossiness; this just gives a base ambient.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.35;
    pmrem.dispose();

    this.scene.fog = new THREE.Fog(0x8aa3c0, 8, 35);

    this.camera = new THREE.PerspectiveCamera(
      40,
      container.clientWidth / container.clientHeight,
      0.01,
      100,
    );
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(1.6, 1.6, 0.9);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0, 0.25);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.update();

    this.addLights();
    this.buildFromModel();

    window.addEventListener('resize', () => this.onResize(container));
  }

  private addLights(): void {
    // Cool sky / warm ground hemisphere as a base ambient.
    this.scene.add(new THREE.HemisphereLight(0xc8d8ee, 0x3a2e22, 0.55));

    // Key light — warm sun, casts shadows.
    const key = new THREE.DirectionalLight(0xfff1d6, 2.6);
    key.position.set(3, 4, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -1e-4;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 4;
    const d = 3;
    key.shadow.camera.left = -d;
    key.shadow.camera.right = d;
    key.shadow.camera.top = d;
    key.shadow.camera.bottom = -d;
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 20;
    this.scene.add(key);

    // Cool fill from the opposite side, no shadows.
    const fill = new THREE.DirectionalLight(0xb6ccff, 0.6);
    fill.position.set(-3, -2, 2);
    this.scene.add(fill);

    // Subtle backlight to separate silhouette from sky.
    const rim = new THREE.DirectionalLight(0xffffff, 0.4);
    rim.position.set(-1, 4, 0.5);
    this.scene.add(rim);
  }

  private buildFromModel(): void {
    const m = this.model;
    const meshGeometries = this.buildMeshGeometries();

    for (let i = 0; i < m.ngeom; i++) {
      const t = m.geom_type[i];
      const sx = m.geom_size[i * 3 + 0];
      const sy = m.geom_size[i * 3 + 1];
      const sz = m.geom_size[i * 3 + 2];
      const r = m.geom_rgba[i * 4 + 0];
      const g = m.geom_rgba[i * 4 + 1];
      const b = m.geom_rgba[i * 4 + 2];
      const a = m.geom_rgba[i * 4 + 3];

      // Skip pure-collision geoms (group >= 3 and contype/conaffinity > 0).
      const isCollisionOnly =
        m.geom_group[i] >= 3 && (m.geom_contype[i] !== 0 || m.geom_conaffinity[i] !== 0);
      if (isCollisionOnly) {
        this.meshes.push(null);
        continue;
      }

      let obj: THREE.Object3D | null;
      if (t === GEOM_MESH) {
        const meshId = m.geom_dataid[i];
        const geom = meshGeometries[meshId];
        obj = geom ? this.makeMeshObject(geom, r, g, b, a) : null;
      } else {
        obj = this.createGeom(t, sx, sy, sz, r, g, b, a);
      }

      if (obj) {
        obj.matrixAutoUpdate = false;
        this.scene.add(obj);
      }
      this.meshes.push(obj);
    }
  }

  private buildMeshGeometries(): THREE.BufferGeometry[] {
    const m = this.model;
    const out: THREE.BufferGeometry[] = [];
    for (let i = 0; i < m.nmesh; i++) {
      const va = m.mesh_vertadr[i];
      const vn = m.mesh_vertnum[i];
      const fa = m.mesh_faceadr[i];
      const fn = m.mesh_facenum[i];

      const positions = new Float32Array(m.mesh_vert.subarray(va * 3, (va + vn) * 3));
      const normals = new Float32Array(m.mesh_normal.subarray(va * 3, (va + vn) * 3));
      const indices = new Uint32Array(m.mesh_face.subarray(fa * 3, (fa + fn) * 3));

      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      g.setIndex(new THREE.BufferAttribute(indices, 1));
      g.computeBoundingSphere();
      out.push(g);
    }
    return out;
  }

  private makeMeshObject(
    geometry: THREE.BufferGeometry,
    r: number,
    g: number,
    b: number,
    a: number,
  ): THREE.Mesh {
    // For very dark MJCF colors, brighten just slightly so they still read as
    // a separate body and not pure shadow.
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const lift = lum < 0.15 ? 0.05 : 0;
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(r + lift, g + lift, b + lift).convertSRGBToLinear(),
      transparent: a < 1,
      opacity: a,
      roughness: 0.45,
      metalness: 0.25,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  private createGeom(
    type: number,
    sx: number,
    sy: number,
    sz: number,
    r: number,
    g: number,
    b: number,
    a: number,
  ): THREE.Object3D | null {
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(r, g, b).convertSRGBToLinear(),
      transparent: a < 1,
      opacity: a,
      roughness: 0.55,
      metalness: 0.1,
    });

    let geometry: THREE.BufferGeometry;

    switch (type) {
      case GEOM_PLANE: {
        // Override with a nicer checkered floor; ignore the MJCF rgba so the
        // ground reads as a ground regardless of model defaults.
        const w = sx > 0 ? sx * 2 : 50;
        const h = sy > 0 ? sy * 2 : 50;
        geometry = new THREE.PlaneGeometry(w, h);
        const tex = makeCheckerTexture(this.renderer, 512, 0x6c7480, 0x424652);
        // Repeat enough so the checker tiles aren't huge on an "infinite" plane.
        const repeat = Math.max(8, Math.round(Math.max(w, h) / 1.0));
        tex.repeat.set(repeat, repeat);
        const floorMat = new THREE.MeshStandardMaterial({
          map: tex,
          color: 0xffffff,
          roughness: 0.9,
          metalness: 0.0,
        });
        const mesh = new THREE.Mesh(geometry, floorMat);
        mesh.receiveShadow = true;
        // Drop disposed material we built earlier for this geom.
        material.dispose();
        return mesh;
      }
      case GEOM_BOX:
        geometry = new THREE.BoxGeometry(sx * 2, sy * 2, sz * 2);
        break;
      case GEOM_SPHERE:
        geometry = new THREE.SphereGeometry(sx, 24, 16);
        break;
      case GEOM_ELLIPSOID:
        geometry = new THREE.SphereGeometry(1, 24, 16);
        geometry.scale(sx, sy, sz);
        break;
      case GEOM_CAPSULE: {
        // MuJoCo capsule axis is local +Z; Three.js capsule axis is +Y. Rotate.
        geometry = new THREE.CapsuleGeometry(sx, sy * 2, 8, 16);
        geometry.rotateX(Math.PI / 2);
        break;
      }
      case GEOM_CYLINDER: {
        geometry = new THREE.CylinderGeometry(sx, sx, sy * 2, 24);
        geometry.rotateX(Math.PI / 2);
        break;
      }
      case GEOM_HFIELD:
      case GEOM_MESH:
        return null;
      default:
        return null;
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  /** Read latest geom_xpos/xmat from the (possibly shared) state buffer. */
  syncFromState(): void {
    const xpos = this.state.geom_xpos;
    const xmat = this.state.geom_xmat;

    for (let i = 0; i < this.meshes.length; i++) {
      const obj = this.meshes[i];
      if (!obj) continue;

      const px = xpos[i * 3 + 0];
      const py = xpos[i * 3 + 1];
      const pz = xpos[i * 3 + 2];

      const o = i * 9;
      this.tmpMat.set(
        xmat[o + 0], xmat[o + 1], xmat[o + 2], px,
        xmat[o + 3], xmat[o + 4], xmat[o + 5], py,
        xmat[o + 6], xmat[o + 7], xmat[o + 8], pz,
        0, 0, 0, 1,
      );
      obj.matrix.copy(this.tmpMat);
      obj.matrixWorldNeedsUpdate = true;
    }
  }

  render(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  private onResize(container: HTMLElement): void {
    const w = container.clientWidth;
    const h = container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}

// --- helpers ----------------------------------------------------------------

/** Vertical gradient sky as a 1×N CanvasTexture. Cheap, looks like a real sky. */
function makeGradientSky(top: number, bottom: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 2;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, '#' + top.toString(16).padStart(6, '0'));
  grad.addColorStop(1, '#' + bottom.toString(16).padStart(6, '0'));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c.width, c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}

/** Procedural checker as a wrapping/repeating texture for the floor. */
function makeCheckerTexture(
  renderer: THREE.WebGLRenderer,
  size: number,
  light: number,
  dark: number,
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const half = size / 2;
  ctx.fillStyle = '#' + light.toString(16).padStart(6, '0');
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#' + dark.toString(16).padStart(6, '0');
  ctx.fillRect(0, 0, half, half);
  ctx.fillRect(half, half, half, half);
  // Subtle line on the boundary so tiles read at distance.
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, size, size);
  ctx.strokeRect(0, 0, half, half);
  ctx.strokeRect(half, half, half, half);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}
