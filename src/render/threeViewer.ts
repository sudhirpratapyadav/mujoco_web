import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SplatMesh, SparkRenderer } from '@sparkjsdev/spark';
import type { ModelView, StateView } from '../sim/types';

export type CameraMode = 'orbit' | 'follow' | 'cinematic';

// Length of the cinematic intro shot, in animation frames. At ~60 fps,
// 900 frames ≈ 15 seconds. Increase for a slower, more deliberate shot;
// decrease if it overstays its welcome before the chase takes over.
const CINEMA_SHOT_FRAMES = 900;
// Quadratic-Bezier control-point offsets, set so the curve's apex (~50%
// of the control-point displacement for a quadratic) sweeps the camera
// well to the SIDE of the straight start→end line and well above it.
// OUTWARD = perpendicular to the start→end line, in the horizontal
// plane, on the side AWAY from the robot. UP = vertical lift at midpoint.
const CINEMA_ARC_OUTWARD = 60.0; // → apex ~30 m to the side
const CINEMA_ARC_UP = 15.0;      // → apex ~7.5 m up

// Tunable transform for the splat environment. The active scene is the
// Marble "Desert Canyon Lava Flow" — a single 32 MB .spz, so auto-fit can
// query its bounding box and drop it onto z=0. The slider in the page
// then nudges the ground offset live.
const SPLAT_ROT = new THREE.Euler(-Math.PI / 2, 0, 0);
const SPLAT_POS = new THREE.Vector3(0, 0, 0);
const SPLAT_SCALE = 1.0;
// Whether the active asset is a streaming .rad / paged splat (auto-fit via
// getBoundingBox doesn't work on those — data lives only on the GPU).
const SPLAT_PAGED = false;
const SPLAT_BACKGROUND = 0xe8c79a; // sandy beige

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

  // Soft contact shadow under the robot (the splat environment is added
  // directly to the scene; no field needed since we don't update it per-frame).
  private contactShadow: THREE.Mesh | null = null;

  // Scratch matrix to avoid per-frame allocation.
  private readonly tmpMat = new THREE.Matrix4();

  // Camera mode + cinematic chase-cam state.
  private cameraMode: CameraMode = 'orbit';
  private readonly cinemaPos = new THREE.Vector3();
  private readonly cinemaTarget = new THREE.Vector3();
  // Time-based intro shot: position/target the camera was at when the
  // cinematic mode was entered. While cinemaProgress < 1 we lerp from
  // these toward the (moving) chase pose using a smoothstep curve that
  // takes a guaranteed CINEMA_SHOT_FRAMES to complete. Once progress
  // reaches 1 we hand off to the alpha-based chase that lives in the
  // existing per-frame logic.
  private readonly cinemaShotStartPos = new THREE.Vector3();
  private readonly cinemaShotStartTgt = new THREE.Vector3();
  private cinemaProgress = 1;
  // Reusable scratch vectors so updateCamera() doesn't allocate.
  private readonly _v3 = new THREE.Vector3();
  private readonly _v3b = new THREE.Vector3();

  constructor(
    container: HTMLElement,
    model: ModelView,
    state: StateView,
    splatUrl?: string,
  ) {
    this.model = model;
    this.state = state;

    // Spark recommends antialias: false for splat rendering perf.
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SPLAT_BACKGROUND);

    // Spark v2 requires SparkRenderer to be added to the scene to register
    // its draw plugin with Three's render pipeline. The streaming-LoD
    // tuning (pagedExtSplats + foveation) matches Spark's own
    // streaming-lod example and is needed for huge .rad worlds to render
    // efficiently on commodity hardware.
    const spark = new SparkRenderer({
      renderer: this.renderer,
      pagedExtSplats: SPLAT_PAGED,
      coneFov0: 70.0,
      coneFov: 120.0,
      behindFoveate: 0.2,
      coneFoveate: 0.4,
    });
    this.scene.add(spark);
    // Keep IBL for the robot's PBR shading — splat doesn't contribute lighting.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.35;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.05,
      500,
    );
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(1.6, -1.6, 1.0);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0, 0.3);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.update();

    this.addLights();
    this.buildFromModel();
    this.addContactShadow();
    if (splatUrl) this.loadSplatEnv(splatUrl);

    window.addEventListener('resize', () => this.onResize(container));
  }

  private loadSplatEnv(url: string): void {
    const splat = new SplatMesh({
      url,
      paged: SPLAT_PAGED,
      // Auto-fit only fires for non-paged splats (paged data lives in GPU
      // textures only and getBoundingBox returns an empty box). For paged
      // worlds we trust SPLAT_POS / SPLAT_ROT as authored constants.
      onLoad: SPLAT_PAGED ? undefined : (mesh) => this.fitSplatToGround(mesh),
    });
    splat.position.copy(SPLAT_POS);
    splat.rotation.copy(SPLAT_ROT);
    splat.scale.setScalar(SPLAT_SCALE);
    this.scene.add(splat);
    // Expose for live tweaking from DevTools (e.g. splat.position.z = -1).
    (window as unknown as { splat: SplatMesh }).splat = splat;
  }

  /**
   * Once the splat data is decoded, try to query its bounding box and shift
   * the mesh so the scan's apparent floor lands at world z=0 and its
   * centroid sits at the world origin in x/y. For scenes whose splat data
   * lives only on the GPU (LOD/paged formats), getBoundingBox returns an
   * empty box; in that case we keep the user-provided SPLAT_POS as-is so
   * the splat is at least visible somewhere reasonable.
   */
  private fitSplatToGround(splat: SplatMesh): void {
    let bb: THREE.Box3;
    try {
      bb = splat.getBoundingBox(true);
    } catch {
      return;
    }
    if (!isFinite(bb.min.x) || !isFinite(bb.max.x)) return;
    const m = new THREE.Matrix4()
      .makeRotationFromEuler(SPLAT_ROT)
      .scale(new THREE.Vector3(SPLAT_SCALE, SPLAT_SCALE, SPLAT_SCALE));
    bb.applyMatrix4(m);
    const cx = (bb.min.x + bb.max.x) / 2;
    const cy = (bb.min.y + bb.max.y) / 2;
    splat.position.set(SPLAT_POS.x - cx, SPLAT_POS.y - cy, SPLAT_POS.z - bb.min.z);
    console.info('[splat] auto-fit', {
      world_min: bb.min.toArray(),
      world_max: bb.max.toArray(),
      placed_at: splat.position.toArray(),
    });
    // Sync the tuning panel with the resolved transform so user tweaks are
    // deltas from the auto-fit baseline (otherwise dialing a slider jumps
    // from the HTML default to the live splat value on first interaction).
    window.dispatchEvent(
      new CustomEvent('splat-fit', {
        detail: {
          x: splat.position.x,
          y: splat.position.y,
          z: splat.position.z,
          scale: splat.scale.x,
        },
      }),
    );
  }

  private addContactShadow(): void {
    const tex = makeRadialShadowTexture(256);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), mat);
    mesh.rotation.x = 0; // plane defaults face +Z, which is what we want here
    mesh.position.set(0, 0, 0.001); // tiny lift to avoid z-fighting w/ ground
    mesh.renderOrder = 1;
    this.scene.add(mesh);
    this.contactShadow = mesh;
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
    _r: number,
    _g: number,
    _b: number,
    a: number,
  ): THREE.Mesh {
    // Force all robot body parts to a black painted-metal look, ignoring the
    // per-geom MJCF color.
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x080808).convertSRGBToLinear(),
      transparent: a < 1,
      opacity: a,
      roughness: 0.35,
      metalness: 0.55,
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
        // The splat environment provides the visual ground; the MuJoCo plane
        // stays in the physics model but isn't rendered. Caller treats null
        // as "skip" and physics is unaffected.
        material.dispose();
        return null;
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
    this.updateCamera();
    this.updateContactShadow();
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  private updateContactShadow(): void {
    if (!this.contactShadow) return;
    const qpos = this.state.qpos;
    if (qpos.length < 3) return;
    this.contactShadow.position.x = qpos[0];
    this.contactShadow.position.y = qpos[1];
  }

  /** Where the policy thinks "up-from-ground" the robot lives. */
  private robotEyeHeight = 0.18;

  /**
   * Per-frame camera adjustments based on the current mode.
   *  - orbit:     untouched, OrbitControls is the source of truth
   *  - follow:    orbit target tracks the robot's base; user can still rotate
   *  - cinematic: smooth trailing chase-cam in the robot's heading direction
   */
  private updateCamera(): void {
    if (this.cameraMode === 'orbit') return;

    const qpos = this.state.qpos;
    if (qpos.length < 7) return; // no free-joint base — fall back to orbit
    const bx = qpos[0], by = qpos[1], bz = qpos[2];
    const qw = qpos[3], qx = qpos[4], qy = qpos[5], qz = qpos[6];

    if (this.cameraMode === 'follow') {
      // Translate the camera with the robot so the orbit offset stays fixed
      // in world space. Without this, OrbitControls re-reads the offset each
      // frame and the camera appears to swing around the moving target.
      const newTarget = this._v3.set(bx, by, bz + this.robotEyeHeight);
      this.camera.position.add(this._v3b.copy(newTarget).sub(this.controls.target));
      this.controls.target.copy(newTarget);
      // OrbitControls.update() will then rotate followOffset if the user is
      // dragging; we snapshot the post-input offset to carry into next frame.
      // (controls.update() runs after this in render(); the snapshot happens
      // implicitly because we read position - target on the next frame.)
      return;
    }

    // Cinematic: world-yaw of the body (rotation around z).
    const yaw = Math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz));
    const distance = 1.6;
    const height = 0.55;
    const desiredPos = this._v3.set(
      bx - Math.cos(yaw) * distance,
      by - Math.sin(yaw) * distance,
      bz + height,
    );
    const desiredTarget = this._v3b.set(bx, by, bz + this.robotEyeHeight);

    // Cinematic dolly: a *curved* time-based shot from the saved start pose
    // to the (moving) chase pose using a quadratic Bezier whose control
    // point sits above and outward from the robot. That gives a sweeping
    // aerial arc instead of a straight line through the subject. After
    // CINEMA_SHOT_FRAMES we hand off to alpha-based chase tracking.
    if (this.cinemaProgress < 1) {
      this.cinemaProgress = Math.min(1, this.cinemaProgress + 1 / CINEMA_SHOT_FRAMES);
      const t = smootherstep01(this.cinemaProgress);

      const start = this.cinemaShotStartPos;
      const end = desiredPos;
      const mx = (start.x + end.x) * 0.5;
      const my = (start.y + end.y) * 0.5;
      const mz = (start.z + end.z) * 0.5;
      // Perpendicular to the start→end line in the horizontal plane: rotate
      // the path direction 90° around z. Pick the side that points AWAY
      // from the robot so the arc swings outward, not through the subject.
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      let sx = -dy;
      let sy = dx;
      const sMag = Math.hypot(sx, sy) || 1;
      sx /= sMag;
      sy /= sMag;
      if (sx * (bx - mx) + sy * (by - my) > 0) {
        sx = -sx;
        sy = -sy;
      }
      const cx = mx + sx * CINEMA_ARC_OUTWARD;
      const cy = my + sy * CINEMA_ARC_OUTWARD;
      const cz = mz + CINEMA_ARC_UP;

      // Quadratic Bezier: B(t) = (1-t)²·start + 2(1-t)t·control + t²·end.
      const u = 1 - t;
      const uu = u * u;
      const tt = t * t;
      const ut2 = 2 * u * t;
      this.cinemaPos.set(
        uu * start.x + ut2 * cx + tt * end.x,
        uu * start.y + ut2 * cy + tt * end.y,
        uu * start.z + ut2 * cz + tt * end.z,
      );
      // Look-at target: smooth pan from where it was to the robot's torso.
      this.cinemaTarget.lerpVectors(this.cinemaShotStartTgt, desiredTarget, t);
    } else {
      this.cinemaPos.lerp(desiredPos, 0.10);
      this.cinemaTarget.lerp(desiredTarget, 0.14);
    }
    this.camera.position.copy(this.cinemaPos);
    this.camera.lookAt(this.cinemaTarget);
  }

  setCameraMode(mode: CameraMode): void {
    if (mode === this.cameraMode) return;
    this.cameraMode = mode;
    const qpos = this.state.qpos;
    if (mode === 'cinematic') {
      this.controls.enabled = false;
      // Snapshot the current camera pose as the shot's starting frame.
      // updateCamera() will lerpVectors from these toward the chase pose
      // over CINEMA_SHOT_FRAMES, then hand off to alpha-based chase.
      this.cinemaPos.copy(this.camera.position);
      this.cinemaTarget.copy(this.controls.target);
      this.cinemaShotStartPos.copy(this.camera.position);
      this.cinemaShotStartTgt.copy(this.controls.target);
      this.cinemaProgress = 0;
    } else {
      this.controls.enabled = true;
      if (mode === 'follow' && qpos.length >= 7) {
        // Snap target to robot now; subsequent frames preserve the offset.
        this.controls.target.set(
          qpos[0], qpos[1], qpos[2] + this.robotEyeHeight,
        );
      }
    }
  }

  cycleCameraMode(): CameraMode {
    const next: CameraMode =
      this.cameraMode === 'orbit' ? 'follow'
      : this.cameraMode === 'follow' ? 'cinematic'
      : 'orbit';
    this.setCameraMode(next);
    return next;
  }

  get currentCameraMode(): CameraMode {
    return this.cameraMode;
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

/** Ken Perlin's smootherstep — soft ease at both ends, on a 0..1 input. */
function smootherstep01(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Soft radial gradient for a fake contact shadow under the robot. */
function makeRadialShadowTexture(size: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const r = size / 2;
  const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, 'rgba(0,0,0,0.85)');
  grad.addColorStop(0.4, 'rgba(0,0,0,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
