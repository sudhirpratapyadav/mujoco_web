import loadMujoco from '@mujoco/mujoco';
const xml = `
<mujoco>
  <option timestep="0.002" gravity="0 0 -9.81"/>
  <worldbody>
    <geom type="plane" size="5 5 0.1"/>
    <body pos="0 0 1.5"><freejoint/><geom type="box" size="0.1 0.1 0.1"/></body>
  </worldbody>
</mujoco>
`;
const mj = await loadMujoco();
const model = mj.MjModel.from_xml_string(xml);
const data = new mj.MjData(model);
mj.mj_step(model, data);
const dump = (k, v) => console.log(k, v?.constructor?.name, 'len=', v?.length, 'sample=', Array.from(v?.slice?.(0, 6) ?? []));
dump('model.geom_type', model.geom_type);
dump('model.geom_size', model.geom_size);
dump('model.geom_rgba', model.geom_rgba);
dump('data.geom_xpos', data.geom_xpos);
dump('data.geom_xmat', data.geom_xmat);
dump('data.qpos', data.qpos);
console.log('opt.timestep', model.opt.timestep);
data.delete(); model.delete();
