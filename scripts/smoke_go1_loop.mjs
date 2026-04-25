// End-to-end smoke test of the Go1 policy loop, mirroring the browser pipeline:
//   load model -> reset to home keyframe -> step physics @ 250 Hz, infer @ 50 Hz
//   build obs from sensors + IMU site -> ctrl = action*0.5 + default
// Verifies the robot stays roughly upright over 5 seconds with zero command.

import loadMujoco from '@mujoco/mujoco';
import * as ort from 'onnxruntime-node';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = './public/go1';
const files = JSON.parse(fs.readFileSync(`${ROOT}/manifest.json`, 'utf8')).files;

const mj = await loadMujoco();
mj.FS.mkdirTree('/work/assets', 0o777);
for (const f of files) {
  mj.FS.writeFile(`/work/${f}`, fs.readFileSync(path.join(ROOT, f)));
}
const model = mj.MjModel.from_xml_path('/work/scene_mjx_feetonly_flat_terrain.xml');
const data = new mj.MjData(model);
mj.mj_resetDataKeyframe(model, data, 0);
mj.mj_forward(model, data);

const session = await ort.InferenceSession.create('./public/policy/policy.onnx');

const ACTION_SCALE = 0.5;
const DEFAULT = Float32Array.from([
   0.1, 0.9, -1.8,
  -0.1, 0.9, -1.8,
   0.1, 0.9, -1.8,
  -0.1, 0.9, -1.8,
]);
const obs = new Float32Array(48);
const lastAction = new Float32Array(12);
const cmd = [0.5, 0, 0]; // forward 0.5 m/s

const gyroAdr = model.sensor_adr[model.sensor('gyro').id];
const linvelAdr = model.sensor_adr[model.sensor('local_linvel').id];
const imuId = model.site('imu').id;

const sim_dt = model.opt.timestep;
const ctrl_dt = 1 / 50;
const subSteps = Math.round(ctrl_dt / sim_dt);
console.log(`sim_dt=${sim_dt}  ctrl_dt=${ctrl_dt}  subSteps=${subSteps}`);

const totalCtrlSteps = 5 * 50; // 5 seconds at 50 Hz
let minZ = 1e9, maxZ = -1e9;
const dump = (label, k, arr) => {
  if ([0, 50, 100, 150, 200, 240].includes(k)) {
    const a = Array.from(arr).map(v => v.toFixed(3));
    console.log(`step ${k} ${label}: ${a.join(' ')}`);
  }
};
for (let k = 0; k < totalCtrlSteps; k++) {
  // Build obs.
  const sd = data.sensordata;
  const sxm = data.site_xmat;
  const qpos = data.qpos;
  const qvel = data.qvel;

  let o = 0;
  // linvel
  obs[o++] = sd[linvelAdr]; obs[o++] = sd[linvelAdr + 1]; obs[o++] = sd[linvelAdr + 2];
  // gyro
  obs[o++] = sd[gyroAdr]; obs[o++] = sd[gyroAdr + 1]; obs[o++] = sd[gyroAdr + 2];
  // gravity = imu_xmat^T @ (0,0,-1) = -3rd row of imu_xmat
  const m9 = imuId * 9;
  obs[o++] = -sxm[m9 + 6]; obs[o++] = -sxm[m9 + 7]; obs[o++] = -sxm[m9 + 8];
  // joint pos rel
  for (let i = 0; i < 12; i++) obs[o++] = qpos[7 + i] - DEFAULT[i];
  // joint vel
  for (let i = 0; i < 12; i++) obs[o++] = qvel[6 + i];
  // last action
  for (let i = 0; i < 12; i++) obs[o++] = lastAction[i];
  // command
  obs[o++] = cmd[0]; obs[o++] = cmd[1]; obs[o++] = cmd[2];

  if (o !== 48) throw new Error(`bad obs len ${o}`);

  dump('obs', k, obs);

  const out = await session.run({ obs: new ort.Tensor('float32', obs, [1, 48]) });
  const raw = out.continuous_actions.data;
  dump('action', k, raw);
  dump('qpos', k, qpos);
  for (let i = 0; i < 12; i++) {
    lastAction[i] = raw[i];
    data.ctrl[i] = DEFAULT[i] + ACTION_SCALE * raw[i];
  }

  for (let s = 0; s < subSteps; s++) mj.mj_step(model, data);

  if (data.qpos[2] < minZ) minZ = data.qpos[2];
  if (data.qpos[2] > maxZ) maxZ = data.qpos[2];
}

console.log(`final t=${data.time.toFixed(3)}s  base_z=${data.qpos[2].toFixed(3)}m  z_range=[${minZ.toFixed(3)}, ${maxZ.toFixed(3)}]`);
const upright = data.qpos[2] > 0.15;
console.log(upright ? 'OK: robot stayed upright' : 'FAIL: robot collapsed');

data.delete();
model.delete();
process.exit(upright ? 0 : 1);
