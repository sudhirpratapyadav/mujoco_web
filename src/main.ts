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
  const viewer = new ThreeViewer(app, sim.model, sim.state);
  const input = new KeyboardController(sim, policy);

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
        `keys: W/S vx · A/D vy · Q/E wz · R reset · Space pause`;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

main().catch((err) => {
  console.error(err);
  hud.textContent = `error: ${err?.message ?? err}`;
});
