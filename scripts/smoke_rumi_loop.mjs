// End-to-end Rumi closed-loop smoke test under Node.
// Mirrors what the browser pipeline does: builds the 48-dim obs from sensors +
// IMU site xmat, runs the converted ONNX, and drives ctrl through the
// position actuators.
//
// Obs layout (mjlab Rumi velocity, dim=48):
//   [base_ang_vel(3), projected_gravity(3),
//    joint_pos_rel(12), joint_vel_rel(12), last_action(12),
//    command(3), imu_lin_acc(3)]

import loadMujoco from '@mujoco/mujoco';
import * as ort from 'onnxruntime-node';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = './public/rumi';
const POLICY_PATH = './public/policy/policy.onnx';
const files = JSON.parse(fs.readFileSync(`${ROOT}/manifest.json`, 'utf8')).files;

const mj = await loadMujoco();
mj.FS.mkdirTree('/work/assets', 0o777);
for (const f of files) {
  mj.FS.writeFile(`/work/${f}`, fs.readFileSync(path.join(ROOT, f)));
}
const model = mj.MjModel.from_xml_path('/work/scene.xml');
const data = new mj.MjData(model);
mj.mj_resetDataKeyframe(model, data, 0);
mj.mj_forward(model, data);

const session = await ort.InferenceSession.create(POLICY_PATH);
console.log('inputs:', session.inputNames, 'outputs:', session.outputNames);

const ACTION_SCALE = 0.05;
const DEFAULT = Float32Array.from([
   0, -0.0705, -0.113,
   0,  0.0705,  0.113,
   0, -0.0705, -0.113,
   0,  0.0705,  0.113,
]);
const obs = new Float32Array(48);
const lastAction = new Float32Array(12);
const cmd = [0.5, 0, 0]; // forward 0.5 m/s — top of training range

const gyroAdr = model.sensor_adr[model.sensor('imu_ang_vel').id];
const linaccAdr = model.sensor_adr[model.sensor('imu_lin_acc').id];
const imuId = model.site('imu').id;

const sim_dt = model.opt.timestep;
const ctrl_dt = 0.02; // 50 Hz — same as Go1; mjlab default policy_period
const subSteps = Math.max(1, Math.round(ctrl_dt / sim_dt));
console.log(`sim_dt=${sim_dt} ctrl_dt=${ctrl_dt} subSteps=${subSteps}`);

const totalCtrlSteps = 5 * 50;
let minZ = 1e9, maxZ = -1e9;

for (let k = 0; k < totalCtrlSteps; k++) {
  const sd = data.sensordata;
  const sxm = data.site_xmat;
  const qpos = data.qpos;
  const qvel = data.qvel;

  let o = 0;
  // base_ang_vel (3) — body-frame angular velocity from gyro sensor.
  obs[o++] = sd[gyroAdr]; obs[o++] = sd[gyroAdr + 1]; obs[o++] = sd[gyroAdr + 2];
  // projected_gravity (3) — gravity in body frame at the IMU site.
  // = imu_xmat^T @ (0,0,-1) = -3rd row of row-major xmat.
  const m9 = imuId * 9;
  obs[o++] = -sxm[m9 + 6]; obs[o++] = -sxm[m9 + 7]; obs[o++] = -sxm[m9 + 8];
  // joint_pos_rel (12)
  for (let i = 0; i < 12; i++) obs[o++] = qpos[7 + i] - DEFAULT[i];
  // joint_vel_rel (12) — default qvel is 0.
  for (let i = 0; i < 12; i++) obs[o++] = qvel[6 + i];
  // last_action (12) — what was sent to the action manager last step.
  for (let i = 0; i < 12; i++) obs[o++] = lastAction[i];
  // command (3)
  obs[o++] = cmd[0]; obs[o++] = cmd[1]; obs[o++] = cmd[2];
  // imu_lin_acc (3) — accelerometer.
  obs[o++] = sd[linaccAdr]; obs[o++] = sd[linaccAdr + 1]; obs[o++] = sd[linaccAdr + 2];
  if (o !== 48) throw new Error(`bad obs len ${o}`);

  if ([0, 1, 5, 50, 150, 240].includes(k)) {
    console.log(`step ${k} z=${qpos[2].toFixed(3)} action=${Array.from(lastAction).map(v=>v.toFixed(2)).join(' ')}`);
    if (k === 1) console.log('  obs[0..14]=' + Array.from(obs.slice(0, 15)).map(v=>v.toFixed(3)).join(' '));
  }

  const out = await session.run({ obs: new ort.Tensor('float32', obs, [1, 48]) });
  const raw = out.actions.data;
  for (let i = 0; i < 12; i++) {
    lastAction[i] = raw[i];
    data.ctrl[i] = DEFAULT[i] + ACTION_SCALE * raw[i];
  }

  for (let s = 0; s < subSteps; s++) mj.mj_step(model, data);

  if (data.qpos[2] < minZ) minZ = data.qpos[2];
  if (data.qpos[2] > maxZ) maxZ = data.qpos[2];
}

console.log(`final t=${data.time.toFixed(3)}s base_z=${data.qpos[2].toFixed(3)}m z=[${minZ.toFixed(3)},${maxZ.toFixed(3)}] traveled_x=${data.qpos[0].toFixed(3)}`);
const upright = data.qpos[2] > 0.10;
console.log(upright ? 'OK' : 'FAIL: collapsed');
data.delete(); model.delete();
process.exit(upright ? 0 : 1);
