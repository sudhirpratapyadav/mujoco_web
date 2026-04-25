// Compile Rumi, reset to home, hold ctrl=keyframe, verify the robot stays up
// and that the obs sensors we expect are present.
import loadMujoco from '@mujoco/mujoco';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = './public/rumi';
const files = JSON.parse(fs.readFileSync(`${ROOT}/manifest.json`, 'utf8')).files;

const mj = await loadMujoco();
mj.FS.mkdirTree('/work/assets', 0o777);
for (const f of files) {
  mj.FS.writeFile(`/work/${f}`, fs.readFileSync(path.join(ROOT, f)));
}

const model = mj.MjModel.from_xml_path('/work/scene.xml');
const data = new mj.MjData(model);

console.log(`nbody=${model.nbody} ngeom=${model.ngeom} nmesh=${model.nmesh} nq=${model.nq} nv=${model.nv} nu=${model.nu} nsite=${model.nsite} nsensor=${model.nsensor} nkey=${model.nkey} ndata=${model.nsensordata}`);

mj.mj_resetDataKeyframe(model, data, 0);
mj.mj_forward(model, data);
console.log('home qpos:', Array.from(data.qpos));
console.log('home ctrl:', Array.from(data.ctrl));

const try_ = (fn) => { try { return fn(); } catch { return null; } };
const imuId = try_(() => model.site('imu').id);
const gyroAdr = try_(() => model.sensor_adr[model.sensor('imu_ang_vel').id]);
const linaccAdr = try_(() => model.sensor_adr[model.sensor('imu_lin_acc').id]);
console.log(`imu site id=${imuId}, imu_ang_vel adr=${gyroAdr}, imu_lin_acc adr=${linaccAdr}`);

// Hold default ctrl; see if robot stands.
let minZ = 1e9, maxZ = -1e9;
const totalSimSteps = Math.round(5 / model.opt.timestep);
for (let s = 0; s < totalSimSteps; s++) {
  mj.mj_step(model, data);
  const z = data.qpos[2];
  if (z < minZ) minZ = z;
  if (z > maxZ) maxZ = z;
}
console.log(`final t=${data.time.toFixed(3)}s base_z=${data.qpos[2].toFixed(3)}m z_range=[${minZ.toFixed(3)}, ${maxZ.toFixed(3)}]`);
console.log('joint qpos[7..]:', Array.from(data.qpos.slice(7)).map(v => v.toFixed(3)).join(' '));

data.delete();
model.delete();
