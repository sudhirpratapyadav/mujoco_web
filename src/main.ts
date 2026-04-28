import { startRemoteSim } from './sim/remoteSim';
import { startPolicy } from './policy/policyClient';
import { ThreeViewer } from './render/threeViewer';
import { KeyboardController } from './input/keyboard';

const hud = document.getElementById('hud')!;
const app = document.getElementById('app')!;

async function main() {
  // BASE_URL is '/' in dev and '/sim/' in production (set in vite.config.ts).
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  hud.textContent = 'starting physics worker…';
  const sim = await startRemoteSim(`${base}/rumi`);

  hud.textContent = 'starting policy worker…';
  const policy = await startPolicy(sim.model, sim.sab, sim.layout, `${base}/policy`);

  hud.textContent = 'building scene…';
  // Desert Canyon Lava Flow — World Labs Marble scene (32 MB ceramic.spz).
  // Served via the /marble-cdn Vite proxy so the COEP-isolated origin gets
  // the right cross-origin headers.
  const splatUrl = `${base}/marble-cdn/ea4356cd-4606-4bc2-8f5d-ea6c862a2d74/f9f64829-44da-4913-a9fc-58bb70d1f58d_ceramic.spz`;
  const viewer = new ThreeViewer(app, sim.model, sim.state, splatUrl);
  const input = new KeyboardController(sim, policy, viewer);

  setupSplatControls();

  let lastHud = 0;
  let frames = 0;

  const tick = (nowMs: number) => {
    const cmd = input.update();
    viewer.syncFromState();
    viewer.render();
    frames++;

    if (nowMs - lastHud > 250) {
      const fps = (frames * 1000) / (nowMs - lastHud);
      frames = 0;
      lastHud = nowMs;

      const t = sim.state.header[0];
      const baseZ = sim.state.qpos[2];
      const stepCount = Atomics.load(sim.state.control, 1);
      const ctrlGen = Atomics.load(sim.state.control, 2);
      const pausedTag = input.isPaused ? '  [PAUSED]' : '';
      const base = input.currentBaseline;
      hud.textContent =
        `t=${t.toFixed(2)}s   base_z=${baseZ.toFixed(3)}m${pausedTag}\n` +
        `target vx=${base.vx.toFixed(2)} vy=${base.vy.toFixed(2)} wz=${base.wz.toFixed(2)}\n` +
        `applied vx=${cmd.vx.toFixed(2)} vy=${cmd.vy.toFixed(2)} wz=${cmd.wz.toFixed(2)}\n` +
        `policy: ${policy.mode} @ ${policy.controlHz}Hz   ctrl_gen=${ctrlGen}\n` +
        `nq=${sim.model.nq} nv=${sim.model.nv} nu=${sim.model.nu}   ` +
        `${stepCount} sim steps   ${fps.toFixed(0)} fps\n` +
        `keys: W/S vx · A/D vy · Q/E wz · C cam · R reset · Space pause`;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

main().catch((err) => {
  console.error(err);
  hud.textContent = `error: ${err?.message ?? err}`;
});

type SplatHandle = {
  position: { x: number; y: number; z: number };
  scale: { setScalar: (s: number) => void; x: number };
};

/**
 * Wires the four-axis tuning panel (x / y / z / scale) to `window.splat`.
 * Slider + numeric input stay in sync per axis; auto-fit (fired by
 * ThreeViewer once the splat decodes) updates all four to match the
 * current transform.
 */
function setupSplatControls(): void {
  const ranges = document.querySelectorAll<HTMLInputElement>('input[data-splat][data-kind="range"]');
  const nums = document.querySelectorAll<HTMLInputElement>('input[data-splat][data-kind="num"]');
  const byAxis = new Map<string, { range: HTMLInputElement; num: HTMLInputElement }>();
  ranges.forEach((r) => byAxis.set(r.dataset.splat!, { range: r, num: r })); // placeholder
  nums.forEach((n) => {
    const axis = n.dataset.splat!;
    const range = document.querySelector<HTMLInputElement>(
      `input[data-splat="${axis}"][data-kind="range"]`,
    )!;
    byAxis.set(axis, { range, num: n });
  });

  const apply = (axis: string, value: number) => {
    const ctl = byAxis.get(axis);
    if (!ctl) return;
    ctl.range.value = String(value);
    ctl.num.value = String(value);
    const splat = (window as unknown as { splat?: SplatHandle }).splat;
    if (!splat) return;
    if (axis === 'scale') splat.scale.setScalar(value);
    else (splat.position as Record<string, number>)[axis] = value;
  };

  byAxis.forEach((ctl, axis) => {
    ctl.range.addEventListener('input', () => apply(axis, parseFloat(ctl.range.value)));
    ctl.num.addEventListener('input', () => {
      const v = parseFloat(ctl.num.value);
      if (!Number.isNaN(v)) apply(axis, v);
    });
  });

  // Auto-fit reports the resolved transform once the splat decodes; reflect
  // it in the panel so the user adjusts from the right baseline.
  window.addEventListener('splat-fit', (e) => {
    const t = (e as CustomEvent<{ x: number; y: number; z: number; scale: number }>).detail;
    const expand = (axis: string, value: number) => {
      const ctl = byAxis.get(axis);
      if (!ctl) return;
      const max = parseFloat(ctl.range.max);
      const min = parseFloat(ctl.range.min);
      if (value > max || value < min) {
        const span = Math.ceil(Math.abs(value) + 2);
        ctl.range.min = String(-span);
        ctl.range.max = String(span);
      }
    };
    expand('x', t.x); expand('y', t.y); expand('z', t.z);
    apply('x', t.x); apply('y', t.y); apply('z', t.z); apply('scale', t.scale);
  });
}
