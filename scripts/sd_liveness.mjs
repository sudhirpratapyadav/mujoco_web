import loadMujoco from '@mujoco/mujoco';
import fs from 'node:fs';
import path from 'node:path';

const mj = await loadMujoco();
const ROOT = './public/go1';
const files = JSON.parse(fs.readFileSync(`${ROOT}/manifest.json`, 'utf8')).files;
mj.FS.mkdirTree('/work/assets', 0o777);
for (const f of files) mj.FS.writeFile(`/work/${f}`, fs.readFileSync(path.join(ROOT, f)));
const model = mj.MjModel.from_xml_path('/work/scene_mjx_feetonly_flat_terrain.xml');
const data = new mj.MjData(model);
mj.mj_resetDataKeyframe(model, data, 0);
mj.mj_forward(model, data);

const sdCached = data.sensordata;
console.log('cached.length', sdCached.length, 'cached[0..6]:', Array.from(sdCached.subarray(0, 6)));

for (let i = 0; i < 100; i++) {
  for (let j = 0; j < 12; j++) data.ctrl[j] = [0.1,0.9,-1.8,-0.1,0.9,-1.8,0.1,0.9,-1.8,-0.1,0.9,-1.8][j];
  mj.mj_step(model, data);
}

const sdFresh = data.sensordata;
console.log('after 100 steps, sdCached[0..6]:', Array.from(sdCached.subarray(0, 6)));
console.log('after 100 steps, sdFresh[0..6]:', Array.from(sdFresh.subarray(0, 6)));
console.log('cached === fresh', sdCached === sdFresh);
console.log('cached.buffer === fresh.buffer', sdCached.buffer === sdFresh.buffer);

// site_xmat liveness?
const sxmCached = data.site_xmat;
mj.mj_step(model, data);
const sxmFresh = data.site_xmat;
console.log('site_xmat: cached === fresh', sxmCached === sxmFresh);
console.log('imu xmat row0 cached:', Array.from(sxmCached.subarray(9, 12)));
console.log('imu xmat row0 fresh :', Array.from(sxmFresh.subarray(9, 12)));
