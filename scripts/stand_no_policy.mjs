// Hold ctrl at default_angles (= keyframe home ctrl). If the robot stays
// upright with this, the position-PD setup is correct and any failure with the
// policy must be on the policy/obs side.
import loadMujoco from '@mujoco/mujoco';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = './public/go1';
const files = JSON.parse(fs.readFileSync(`${ROOT}/manifest.json`, 'utf8')).files;

const mj = await loadMujoco();
mj.FS.mkdirTree('/work/assets', 0o777);
for (const f of files) mj.FS.writeFile(`/work/${f}`, fs.readFileSync(path.join(ROOT, f)));

const model = mj.MjModel.from_xml_path('/work/scene_mjx_feetonly_flat_terrain.xml');
const data = new mj.MjData(model);
mj.mj_resetDataKeyframe(model, data, 0);
mj.mj_forward(model, data);

const DEFAULT = [0.1, 0.9, -1.8, -0.1, 0.9, -1.8, 0.1, 0.9, -1.8, -0.1, 0.9, -1.8];
for (let i = 0; i < 12; i++) data.ctrl[i] = DEFAULT[i];

let minZ = 1e9, maxZ = -1e9;
const totalSimSteps = 5 / model.opt.timestep;
for (let s = 0; s < totalSimSteps; s++) {
  mj.mj_step(model, data);
  const z = data.qpos[2];
  if (z < minZ) minZ = z;
  if (z > maxZ) maxZ = z;
}
console.log(`final t=${data.time.toFixed(3)}s  base_z=${data.qpos[2].toFixed(3)}m  z_range=[${minZ.toFixed(3)}, ${maxZ.toFixed(3)}]`);
console.log(data.qpos[2] > 0.15 ? 'OK: robot stands on default ctrl' : 'FAIL: robot collapses on default ctrl');
data.delete(); model.delete();
