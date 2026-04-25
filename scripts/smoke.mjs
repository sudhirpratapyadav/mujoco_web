// Smoke test: load MuJoCo WASM under Node, step the falling-box scene,
// confirm the box falls. Bypasses the browser entirely so we can sanity-check
// the bindings before debugging the full render path.
import loadMujoco from '@mujoco/mujoco';

const xml = `
<mujoco>
  <option timestep="0.002" gravity="0 0 -9.81"/>
  <worldbody>
    <geom type="plane" size="5 5 0.1"/>
    <body pos="0 0 1.5">
      <freejoint/>
      <geom type="box" size="0.1 0.1 0.1"/>
    </body>
  </worldbody>
</mujoco>
`;

const mj = await loadMujoco();
console.log('mj_version =', mj.mj_version());

const model = mj.MjModel.from_xml_string(xml);
const data = new mj.MjData(model);
console.log('nq =', model.nq, ' nv =', model.nv);

const z0 = data.qpos[2];
for (let i = 0; i < 500; i++) mj.mj_step(model, data);
const z1 = data.qpos[2];

console.log(`z: ${z0.toFixed(3)} -> ${z1.toFixed(3)} after 500 steps (1.0 sim s)`);
console.log('time =', data.time.toFixed(3));

if (z1 >= z0) {
  console.error('FAIL: box did not fall');
  process.exit(1);
}
console.log('OK');

data.delete();
model.delete();
