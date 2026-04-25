# Policy assets

Drop two files here to enable closed-loop policy control:

- `policy.onnx` — your trained Unitree Go2 walking policy, exported via
  `torch.onnx.export(...)`. Single input named `obs` with shape `[1, obsDim]`,
  single output named `actions` with shape `[1, actionDim]`. Float32 throughout.

- `config.json` (optional, falls back to `DEFAULT_GO2_CONFIG`) — describes the
  observation layout and action scaling so the browser obs construction matches
  training. Schema lives in `src/policy/policyConfig.ts`. A complete example:

  ```json
  {
    "controlHz": 50,
    "inputName": "obs",
    "outputName": "actions",
    "obsDim": 45,
    "actionDim": 12,
    "defaultJointPos": [0, 0.9, -1.8, 0, 0.9, -1.8, 0, 0.9, -1.8, 0, 0.9, -1.8],
    "actionScale": 0.25,
    "commandScale": [2.0, 2.0, 0.25],
    "obsJointPosScale": 1.0,
    "obsJointVelScale": 0.05,
    "obsAngVelScale": 0.25,
    "obsLayout": [
      "base_ang_vel",
      "projected_gravity",
      "command",
      "joint_pos_rel",
      "joint_vel",
      "last_action"
    ]
  }
  ```

If `policy.onnx` is missing, the policy worker stays in `hold` mode and the
robot keeps the keyframe-0 ctrl values (it will gravity-collapse since the
Menagerie Go2 uses motor/torque actuators, not position-PD ones).

## Obs/action parity check (do this before assuming the policy works)

The single biggest source of "works in Python, falls over in browser" is obs
mismatch. Before integrating:

1. From your training env, log 100 (qpos, qvel, command) → obs samples.
2. Replay them through `buildObs(...)` here and assert max-abs error < 1e-5.
3. Then log 100 obs → action samples through your trained policy and replay
   through ONNX-Runtime here. Same tolerance.
4. Only then connect the loop.
