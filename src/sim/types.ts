// Lightweight, transferable views of the parts of MuJoCo's MjModel/MjData
// that the rest of the app needs. Both the in-process sim and the worker-backed
// remote sim populate these so the viewer/policy code is source-agnostic.

export interface ModelView {
  ngeom: number;
  nmesh: number;
  nq: number;
  nv: number;
  nu: number;
  nsite: number;
  nsensordata: number;
  opt_timestep: number;

  geom_type: Int32Array;
  geom_size: Float64Array;
  geom_rgba: Float32Array;
  geom_dataid: Int32Array;
  geom_group: Int32Array;
  geom_contype: Int32Array;
  geom_conaffinity: Int32Array;

  mesh_vert: Float32Array;
  mesh_normal: Float32Array;
  mesh_face: Int32Array;
  mesh_vertadr: Int32Array;
  mesh_vertnum: Int32Array;
  mesh_faceadr: Int32Array;
  mesh_facenum: Int32Array;

  sensor_adr: Int32Array;
  sensor_dim: Int32Array;

  /**
   * Resolved IDs/addresses the policy needs. The worker looks these up by
   * name from the loaded model and ships them in the snapshot so the policy
   * worker can read sensors/sites without doing its own named lookups.
   */
  resolved: ResolvedNames;
}

export interface ResolvedNames {
  imuSiteId: number;        // -1 if absent
  gyroSensorAdr: number;    // -1 if absent
  linvelSensorAdr: number;  // -1 if absent
  linaccSensorAdr: number;  // -1 if absent (Rumi-style accelerometer obs)
}

/**
 * Live views into shared simulator state. For the worker-backed sim these
 * point into a SharedArrayBuffer; the worker writes, the main thread reads.
 *
 * Reads are non-atomic; brief tears are imperceptible visually. The header's
 * generation counter (Atomics) lets policy code detect torn snapshots if it
 * ever cares.
 */
export interface StateView {
  // Float64 header: [time, ...reserved]
  header: Float64Array;
  // Int32 header: [state generation, step counter, ctrl generation, ...]
  control: Int32Array;
  geom_xpos: Float64Array; // length = ngeom * 3
  geom_xmat: Float64Array; // length = ngeom * 9, row-major 3x3 per geom
  qpos: Float64Array;      // length = nq
  qvel: Float64Array;      // length = nv
  ctrl: Float64Array;      // length = nu (policy writes, physics reads)
  command: Float64Array;   // length = 3 (vx, vy, wz; user input → policy obs)
  site_xmat: Float64Array; // length = nsite * 9
  sensordata: Float64Array;// length = nsensordata
}

export interface SimSnapshot {
  model: ModelView;
  state: StateView;
}

// SAB layout:
//   control:  Int32Array(16)   bytes 0..63
//             [0]=state gen  [1]=step counter  [2]=ctrl gen
//   header:   16 doubles        time + reserved
//   geom_xpos: ngeom*3 doubles
//   geom_xmat: ngeom*9 doubles
//   qpos:      nq doubles
//   qvel:      nv doubles
//   ctrl:      nu doubles       (policy → physics)
//   command:   3 doubles        (input → policy: vx, vy, wz)
export const CONTROL_BYTES = 64;
export const HEADER_DOUBLES = 16;
export const COMMAND_DOUBLES = 3;

export interface SabLayout {
  controlBytes: number;
  headerOffsetD: number;
  geomXposOffsetD: number;
  geomXmatOffsetD: number;
  qposOffsetD: number;
  qvelOffsetD: number;
  ctrlOffsetD: number;
  commandOffsetD: number;
  siteXmatOffsetD: number;
  sensorOffsetD: number;
  totalBytes: number;
  ngeom: number;
  nq: number;
  nv: number;
  nu: number;
  nsite: number;
  nsensordata: number;
}

export function computeSabLayout(
  ngeom: number,
  nq: number,
  nv: number,
  nu: number,
  nsite: number,
  nsensordata: number,
): SabLayout {
  const headerOffsetD = CONTROL_BYTES / 8;
  const geomXposOffsetD = headerOffsetD + HEADER_DOUBLES;
  const geomXmatOffsetD = geomXposOffsetD + ngeom * 3;
  const qposOffsetD = geomXmatOffsetD + ngeom * 9;
  const qvelOffsetD = qposOffsetD + nq;
  const ctrlOffsetD = qvelOffsetD + nv;
  const commandOffsetD = ctrlOffsetD + nu;
  const siteXmatOffsetD = commandOffsetD + COMMAND_DOUBLES;
  const sensorOffsetD = siteXmatOffsetD + nsite * 9;
  const totalDoubles = sensorOffsetD + nsensordata;
  return {
    controlBytes: CONTROL_BYTES,
    headerOffsetD,
    geomXposOffsetD,
    geomXmatOffsetD,
    qposOffsetD,
    qvelOffsetD,
    ctrlOffsetD,
    commandOffsetD,
    siteXmatOffsetD,
    sensorOffsetD,
    totalBytes: totalDoubles * 8,
    ngeom,
    nq,
    nv,
    nu,
    nsite,
    nsensordata,
  };
}

export function makeStateView(sab: SharedArrayBuffer, layout: SabLayout): StateView {
  const f64 = new Float64Array(sab);
  const i32 = new Int32Array(sab, 0, layout.controlBytes / 4);
  return {
    control: i32,
    header: f64.subarray(layout.headerOffsetD, layout.headerOffsetD + HEADER_DOUBLES),
    geom_xpos: f64.subarray(layout.geomXposOffsetD, layout.geomXposOffsetD + layout.ngeom * 3),
    geom_xmat: f64.subarray(layout.geomXmatOffsetD, layout.geomXmatOffsetD + layout.ngeom * 9),
    qpos: f64.subarray(layout.qposOffsetD, layout.qposOffsetD + layout.nq),
    qvel: f64.subarray(layout.qvelOffsetD, layout.qvelOffsetD + layout.nv),
    ctrl: f64.subarray(layout.ctrlOffsetD, layout.ctrlOffsetD + layout.nu),
    command: f64.subarray(layout.commandOffsetD, layout.commandOffsetD + COMMAND_DOUBLES),
    site_xmat: f64.subarray(layout.siteXmatOffsetD, layout.siteXmatOffsetD + layout.nsite * 9),
    sensordata: f64.subarray(layout.sensorOffsetD, layout.sensorOffsetD + layout.nsensordata),
  };
}
