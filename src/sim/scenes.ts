// Minimal scenes used during early bring-up. Replaced by Go2 MJCF in M3.

export const FALLING_BOX_XML = `
<mujoco model="falling_box">
  <option timestep="0.002" gravity="0 0 -9.81"/>
  <worldbody>
    <light pos="0 0 3" dir="0 0 -1"/>
    <geom name="floor" type="plane" size="5 5 0.1" rgba="0.3 0.3 0.3 1"/>
    <body name="box" pos="0 0 1.5">
      <freejoint/>
      <geom name="box" type="box" size="0.1 0.1 0.1" rgba="0.8 0.2 0.2 1"/>
    </body>
  </worldbody>
</mujoco>
`;
