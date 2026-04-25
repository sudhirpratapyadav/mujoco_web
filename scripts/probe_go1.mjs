// Verify Go1 loads under Node and inspect sensor / site indexing.
import loadMujoco from '@mujoco/mujoco';
import fs from 'node:fs';
import path from 'node:path';
import * as ort from 'onnxruntime-node';

const ROOT = './public/go1';
const files = JSON.parse(fs.readFileSync(`${ROOT}/manifest.json`, 'utf8')).files;

const mj = await loadMujoco();
mj.FS.mkdirTree('/work/assets', 0o777);
for (const f of files) {
  const data = fs.readFileSync(path.join(ROOT, f));
  mj.FS.writeFile(`/work/${f}`, data);
}
const model = mj.MjModel.from_xml_path('/work/scene_mjx_feetonly_flat_terrain.xml');
const data = new mj.MjData(model);

console.log(`nbody=${model.nbody} ngeom=${model.ngeom} nmesh=${model.nmesh} nq=${model.nq} nv=${model.nv} nu=${model.nu} nsensor=${model.nsensor} nsite=${model.nsite} nkey=${model.nkey}`);

// Reset to home keyframe (where the policy was trained to start).
mj.mj_resetDataKeyframe(model, data, 0);
mj.mj_forward(model, data);

console.log('home qpos:', Array.from(data.qpos));
console.log('home ctrl:', Array.from(data.ctrl));

// Locate sensors by name and IMU site.
const linvelId = model.sensor('local_linvel').id;
const gyroId = model.sensor('gyro').id;
const imuSiteId = model.site('imu').id;

console.log(`local_linvel sensor id=${linvelId}, gyro id=${gyroId}, imu site id=${imuSiteId}`);

// Resolve sensor data offsets/lengths.
const sensor_adr = model.sensor_adr;
const sensor_dim = model.sensor_dim;
console.log(`linvel adr=${sensor_adr[linvelId]} dim=${sensor_dim[linvelId]}`);
console.log(`gyro   adr=${sensor_adr[gyroId]} dim=${sensor_dim[gyroId]}`);

const sd = data.sensordata;
console.log('sensordata len=', sd.length, 'linvel=', Array.from(sd.subarray(sensor_adr[linvelId], sensor_adr[linvelId] + 3)));

// IMU site xmat row-major 3x3.
const sxm = data.site_xmat;
console.log('site_xmat sample (imu):', Array.from(sxm.subarray(imuSiteId * 9, imuSiteId * 9 + 9)));

// Now run the policy once with default obs to verify the ONNX graph loads.
const session = await ort.InferenceSession.create('./public/policy/policy.onnx');
console.log('policy inputs:', session.inputNames, ' outputs:', session.outputNames);
console.log('input shape:', session.inputMetadata?.[session.inputNames[0]]);

const obs = new Float32Array(48);
const out = await session.run({ obs: new ort.Tensor('float32', obs, [1, 48]) });
const action = out[session.outputNames[0]].data;
console.log('action shape len=', action.length, 'first 4 =', Array.from(action.slice(0, 4)));

data.delete();
model.delete();
