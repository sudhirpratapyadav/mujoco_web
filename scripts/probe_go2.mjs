// Verify Go2 loads under Node and check mesh array layouts.
import loadMujoco from '@mujoco/mujoco';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = './public/go2';
const files = JSON.parse(fs.readFileSync(`${ROOT}/manifest.json`, 'utf8')).files;

const mj = await loadMujoco();
mj.FS.mkdirTree('/work/assets', 0o777);
for (const f of files) {
  const data = fs.readFileSync(path.join(ROOT, f));
  mj.FS.writeFile(`/work/${f}`, data);
}

const model = mj.MjModel.from_xml_path('/work/scene.xml');
const data = new mj.MjData(model);
console.log(`nbody=${model.nbody} ngeom=${model.ngeom} nmesh=${model.nmesh} nq=${model.nq} nv=${model.nv} nu=${model.nu}`);

const dump = (k, v) => console.log(k, v?.constructor?.name, 'len=', v?.length, 'sample=', Array.from(v?.slice?.(0, 6) ?? []));
dump('geom_type', model.geom_type);
dump('geom_dataid', model.geom_dataid);
dump('geom_rgba', model.geom_rgba);
dump('mesh_vert', model.mesh_vert);
dump('mesh_face', model.mesh_face);
dump('mesh_vertadr', model.mesh_vertadr);
dump('mesh_vertnum', model.mesh_vertnum);
dump('mesh_faceadr', model.mesh_faceadr);
dump('mesh_facenum', model.mesh_facenum);
dump('mesh_normal', model.mesh_normal);
dump('geom_matid', model.geom_matid);
console.log('total mesh_vert size:', model.mesh_vert.length, 'mesh_face size:', model.mesh_face.length);

// Step 100 times to verify the robot doesn't explode.
for (let i = 0; i < 100; i++) mj.mj_step(model, data);
console.log('after 100 steps qpos[0..7] =', Array.from(data.qpos.slice(0, 7)));

data.delete();
model.delete();
