// Observation construction for the Go1 (mujoco_playground) joystick policy.
//
// Reference: mujoco_playground/experimental/sim2sim/play_go1_joystick.py
//
//   linvel  = sensor 'local_linvel'  (3)   body-frame linear velocity at IMU site
//   gyro    = sensor 'gyro'          (3)   body-frame angular velocity at IMU site
//   gravity = imu_xmat^T @ (0,0,-1)  (3)   projected gravity in body frame
//   joints  = qpos[7:] - default     (12)
//   jvel    = qvel[6:]               (12)
//   last    = previous policy output (12)
//   cmd     = (vx, vy, wz)           (3)
//
//   action_t = action * action_scale + default_angles  (target joint angles,
//                                                       fed into MuJoCo's
//                                                       <position> actuators)

import type { ModelView, StateView } from '../sim/types';
import type { PolicyConfig } from './policyConfig';

export function buildObs(
  cfg: PolicyConfig,
  model: ModelView,
  state: StateView,
  lastAction: Float32Array,
  out: Float32Array,
): void {
  const { gyroSensorAdr, linvelSensorAdr, linaccSensorAdr, imuSiteId } = model.resolved;
  const sd = state.sensordata;
  const sxm = state.site_xmat;
  const qpos = state.qpos;
  const qvel = state.qvel;
  const cmd = state.command;
  const def = cfg.defaultJointPos;

  let off = 0;
  for (const seg of cfg.obsLayout) {
    switch (seg) {
      case 'linvel': {
        out[off + 0] = sd[linvelSensorAdr + 0];
        out[off + 1] = sd[linvelSensorAdr + 1];
        out[off + 2] = sd[linvelSensorAdr + 2];
        off += 3;
        break;
      }
      case 'gyro': {
        out[off + 0] = sd[gyroSensorAdr + 0];
        out[off + 1] = sd[gyroSensorAdr + 1];
        out[off + 2] = sd[gyroSensorAdr + 2];
        off += 3;
        break;
      }
      case 'linacc': {
        out[off + 0] = sd[linaccSensorAdr + 0];
        out[off + 1] = sd[linaccSensorAdr + 1];
        out[off + 2] = sd[linaccSensorAdr + 2];
        off += 3;
        break;
      }
      case 'projected_gravity': {
        // gravity_body = imu_xmat^T @ (0, 0, -1).
        // For row-major xmat [r00 r01 r02  r10 r11 r12  r20 r21 r22],
        // the transpose times (0,0,-1) is the negated *third row* of xmat:
        //   (-r20, -r21, -r22) = (-xmat[6], -xmat[7], -xmat[8]).
        const o = imuSiteId * 9;
        out[off + 0] = -sxm[o + 6];
        out[off + 1] = -sxm[o + 7];
        out[off + 2] = -sxm[o + 8];
        off += 3;
        break;
      }
      case 'joint_pos_rel': {
        for (let i = 0; i < cfg.actionDim; i++) {
          out[off + i] = qpos[7 + i] - def[i];
        }
        off += cfg.actionDim;
        break;
      }
      case 'joint_vel': {
        for (let i = 0; i < cfg.actionDim; i++) {
          out[off + i] = qvel[6 + i];
        }
        off += cfg.actionDim;
        break;
      }
      case 'last_action': {
        for (let i = 0; i < cfg.actionDim; i++) out[off + i] = lastAction[i];
        off += cfg.actionDim;
        break;
      }
      case 'command': {
        out[off + 0] = cmd[0];
        out[off + 1] = cmd[1];
        out[off + 2] = cmd[2];
        off += 3;
        break;
      }
    }
  }

  if (off !== cfg.obsDim) {
    throw new Error(
      `obs dim mismatch: built ${off} but config.obsDim=${cfg.obsDim}. ` +
        `Check obsLayout vs obsDim.`,
    );
  }
}
