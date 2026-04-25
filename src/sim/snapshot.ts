import type { MjModel } from '@mujoco/mujoco';
import type { ModelView, ResolvedNames } from './types';

/**
 * Extract a transferable snapshot of the model fields the renderer/policy need.
 * Typed arrays are *cloned* so they can be sent across postMessage without
 * detaching the worker's WASM-heap views.
 */
export function snapshotModel(model: MjModel): ModelView {
  const clone32 = (src: any): Int32Array => new Int32Array(src);
  const cloneF32 = (src: any): Float32Array => new Float32Array(src);
  const cloneF64 = (src: any): Float64Array => new Float64Array(src);

  return {
    ngeom: model.ngeom,
    nmesh: model.nmesh,
    nq: model.nq,
    nv: model.nv,
    nu: model.nu,
    nsite: model.nsite,
    nsensordata: model.nsensordata,
    opt_timestep: model.opt.timestep,

    geom_type: clone32(model.geom_type),
    geom_size: cloneF64(model.geom_size),
    geom_rgba: cloneF32(model.geom_rgba),
    geom_dataid: clone32(model.geom_dataid),
    geom_group: clone32(model.geom_group),
    geom_contype: clone32(model.geom_contype),
    geom_conaffinity: clone32(model.geom_conaffinity),

    mesh_vert: cloneF32(model.mesh_vert),
    mesh_normal: cloneF32(model.mesh_normal),
    mesh_face: clone32(model.mesh_face),
    mesh_vertadr: clone32(model.mesh_vertadr),
    mesh_vertnum: clone32(model.mesh_vertnum),
    mesh_faceadr: clone32(model.mesh_faceadr),
    mesh_facenum: clone32(model.mesh_facenum),

    sensor_adr: clone32(model.sensor_adr),
    sensor_dim: clone32(model.sensor_dim),

    resolved: resolveNames(model),
  };
}

/**
 * Look up names the policy worker needs. Returns -1 for any name that isn't
 * defined in this model — the worker can then fall back / disable a policy.
 */
function resolveNames(model: MjModel): ResolvedNames {
  const tryAccess = <T>(fn: () => T): T | null => {
    try { return fn(); } catch { return null; }
  };
  const sensorAdr = model.sensor_adr as Int32Array;

  // Try multiple aliases — different MJCFs name the same sensor differently.
  const findSensorAdr = (...names: string[]): number => {
    for (const n of names) {
      const s = tryAccess(() => model.sensor(n));
      if (s) return sensorAdr[(s as any).id];
    }
    return -1;
  };
  const findSiteId = (...names: string[]): number => {
    for (const n of names) {
      const s = tryAccess(() => model.site(n));
      if (s) return (s as any).id;
    }
    return -1;
  };

  return {
    imuSiteId: findSiteId('imu'),
    gyroSensorAdr: findSensorAdr('gyro', 'imu_ang_vel'),
    linvelSensorAdr: findSensorAdr('local_linvel', 'imu_lin_vel'),
    linaccSensorAdr: findSensorAdr('imu_lin_acc', 'accelerometer'),
  };
}

/** All transferable typed-array buffers in a snapshot, for postMessage transfer. */
export function snapshotTransferables(snap: ModelView): ArrayBufferLike[] {
  return [
    snap.geom_type.buffer,
    snap.geom_size.buffer,
    snap.geom_rgba.buffer,
    snap.geom_dataid.buffer,
    snap.geom_group.buffer,
    snap.geom_contype.buffer,
    snap.geom_conaffinity.buffer,
    snap.mesh_vert.buffer,
    snap.mesh_normal.buffer,
    snap.mesh_face.buffer,
    snap.mesh_vertadr.buffer,
    snap.mesh_vertnum.buffer,
    snap.mesh_faceadr.buffer,
    snap.mesh_facenum.buffer,
    snap.sensor_adr.buffer,
    snap.sensor_dim.buffer,
  ];
}
