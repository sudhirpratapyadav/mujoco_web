// Default contract for the Go1 joystick policy from mujoco_playground.
// Matches `mujoco_playground/experimental/sim2sim/play_go1_joystick.py`.
//
// Drop alternative configs at `public/policy/config.json` to override fields.

export interface PolicyConfig {
  /** Inference rate in Hz. Playground default: 50 (= ctrl_dt 0.02). */
  controlHz: number;

  /** ONNX input/output tensor names. */
  inputName: string;
  outputName: string;

  /** Length of the observation vector. */
  obsDim: number;

  /** Length of the action vector (must equal model.nu). */
  actionDim: number;

  /** Default joint positions (length = actionDim) — the "home" pose. */
  defaultJointPos: number[];

  /** ctrl_t = defaultJointPos + actionScale * action. */
  actionScale: number;

  /** Joystick scaling: command_t = (vx * sx, vy * sy, wz * sz). */
  velScaleX: number;
  velScaleY: number;
  velScaleRot: number;

  /** Order of obs vector segments. */
  obsLayout: ObsSegment[];
}

export type ObsSegment =
  | 'linvel'
  | 'gyro'
  | 'linacc'
  | 'projected_gravity'
  | 'command'
  | 'joint_pos_rel'
  | 'joint_vel'
  | 'last_action';

export const DEFAULT_GO1_CONFIG: PolicyConfig = {
  controlHz: 50,
  inputName: 'obs',
  outputName: 'continuous_actions',
  obsDim: 48,
  actionDim: 12,
  // Joint order from go1_mjx_feetonly.xml actuator block: FR, FL, RR, RL.
  // Matches the home keyframe qpos[7:].
  defaultJointPos: [
     0.1, 0.9, -1.8,
    -0.1, 0.9, -1.8,
     0.1, 0.9, -1.8,
    -0.1, 0.9, -1.8,
  ],
  actionScale: 0.5,
  velScaleX: 1.5,
  velScaleY: 0.8,
  velScaleRot: 2 * Math.PI,
  obsLayout: [
    'linvel',
    'gyro',
    'projected_gravity',
    'joint_pos_rel',
    'joint_vel',
    'last_action',
    'command',
  ],
};

/**
 * Rumi velocity task (mjlab). Joint order is MJCF declaration order:
 * FL_hip, FL_thigh, FL_calf, FR_*, BL_*, BR_*. Default joint positions match
 * mjlab's INIT_STATE (relative to each joint's `ref`).
 *
 * Obs (48): base_ang_vel(3) + projected_gravity(3) + joint_pos_rel(12) +
 *           joint_vel(12) + last_action(12) + command(3) + imu_lin_acc(3)
 * Action: ctrl = default + 0.05 * action  (scale = 0.25 * effort_lim / kp)
 */
export const DEFAULT_RUMI_CONFIG: PolicyConfig = {
  controlHz: 50,
  inputName: 'obs',
  outputName: 'actions',
  obsDim: 48,
  actionDim: 12,
  defaultJointPos: [
    0, -0.0705, -0.113,   // FL hip, thigh, calf
    0,  0.0705,  0.113,   // FR
    0, -0.0705, -0.113,   // BL
    0,  0.0705,  0.113,   // BR
  ],
  actionScale: 0.05,
  // Training command range: lin_vel_x ∈ [-0.5, 0.5], lin_vel_y = 0, ang_vel_z = 0.
  // Allow joystick exploration but match the trained-vx ceiling.
  velScaleX: 0.5,
  velScaleY: 0.5,
  velScaleRot: 1.0,
  obsLayout: [
    'gyro',
    'projected_gravity',
    'joint_pos_rel',
    'joint_vel',
    'last_action',
    'command',
    'linacc',
  ],
};
