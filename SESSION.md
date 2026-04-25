# Session Log

Recap of the session that built this project from scratch to a deployed
mobile-friendly demo.

## What we built

A self-contained, browser-based simulator that runs **MuJoCo physics + an RL
locomotion policy** entirely client-side. Hosted at
**`https://locomotion.lsquarelabs.com/sim/`** on Vercel.

## Stack

| Layer            | Choice                                                       |
| ---------------- | ------------------------------------------------------------ |
| Physics          | `@mujoco/mujoco` (DeepMind official WASM bindings) in a Worker |
| Policy inference | `onnxruntime-web/wasm` (single-threaded) in a second Worker  |
| Rendering        | Three.js on the main thread                                  |
| State sharing    | `SharedArrayBuffer` (state + ctrl + command regions)         |
| Build            | Vite + TypeScript                                            |
| Hosting          | Vercel, prebuilt static files served from `/sim/`            |

## Robot + policy

- **Robot**: Rumi quadruped (mjlab task, source at `~/sudhir/rumi_mjlab_copy`).
  12 joints, position actuators (kp=20, no kd, ±4 effort).
- **Policy**: rsl_rl actor `48 → 512 → 256 → 128 → 12` (ELU activations).
  Converted from `model_5999.pt` to ONNX via `scripts/convert_rumi_pt_to_onnx.py`.
- **Obs (48)**: `base_ang_vel(3) + projected_gravity(3) + joint_pos_rel(12) +
  joint_vel(12) + last_action(12) + command(3) + imu_lin_acc(3)` — matches
  mjlab's actor-obs dict order with `imu_lin_acc` appended at the end.
- **Action**: `ctrl = default + 0.05 * action` where `0.05 = 0.25 *
  effort_limit / stiffness`.

## UI

- **Desktop**: HUD top-left, button row bottom-center, OrbitControls.
- **Mobile**: virtual joysticks bottom corners (left = vx / vy, right's
  x-axis = wz), small icon strip top-right (📷 camera · ⏯ pause · ↻ reset ·
  ■ stop), smaller HUD.
- **Camera modes** (cycle with `C` or 📷 button): free orbit / follow /
  cinematic chase.
- **Visuals**: ACES filmic tone-mapping, sRGB output, RoomEnvironment IBL,
  3-light setup, soft shadows, gradient sky, fog, checker floor.

## Repos

| Repo                                              | Purpose                                       | Branch       |
| ------------------------------------------------- | --------------------------------------------- | ------------ |
| `github.com/sudhirpratapyadav/mujoco_web`         | source (TS + Vite)                            | `main`       |
| `github.com/lsquarelabs/website`                  | hosted site, contains pre-built `sim/`        | `quadruped`  |

Identity is **per-repo** (`Sudhir Pratap Yadav <sudhirpratapyadav@gmail.com>`);
global `~/.gitconfig` is intentionally left untouched. Credential helper at
repo scope reads `/home/linux5/sudhir/.git_token`, overriding the global
`gh auth git-credential` helper that would otherwise authenticate as the
wrong account.

## Iteration loop

```sh
# edit source
$EDITOR ~/sudhir/mujoco_web/src/...

# build
cd ~/sudhir/mujoco_web && npm run build

# sync into the deploy repo
rm -rf ~/sudhir/website/sim && mkdir -p ~/sudhir/website/sim
cp -r ~/sudhir/mujoco_web/dist/. ~/sudhir/website/sim/
# optional: drop unused mesh duplicates
rm -f ~/sudhir/website/sim/rumi/assets/{*_v2.stl,*_simple.stl,coupler_v2_simple.obj}

# push (source + deploy)
git -C ~/sudhir/mujoco_web push
git -C ~/sudhir/website push
```

## Significant bugs we hit & fixed

1. **Gravity transpose** — `imu_xmat^T @ (0,0,−1)` is the negated *third row*
   of a row-major xmat (indices 6, 7, 8), not the third column. Identity
   matrix coincides; the bug only surfaced as the body tilted. Robot would
   stand at first then tip over because the policy "saw" gravity rotating the
   wrong way.
2. **COOP/COEP scoping on Vercel** — `/sim/(.*)` matches `/sim/` and
   `/sim/foo` but NOT `/sim` (no slash). Vercel serves both URLs as the same
   HTML, but the URL pattern matters for header rules. Needed a separate
   exact rule for `/sim`. Also tried `/sim/:path*` — Vercel's path-to-regexp
   doesn't match the empty path with `:path*`.
3. **ORT wasm 404 in production** — Vite hashes asset filenames, but ORT's
   loader requests the un-hashed names. Fix: `?url` import on the wasm/mjs
   files and set `ort.env.wasm.wasmPaths = { wasm, mjs }` to the hashed URLs.
4. **Camera flip on forward motion** — follow mode left the camera at a fixed
   world position while only moving the orbit target. OrbitControls then
   re-derived spherical coordinates from a shrinking-then-flipping offset →
   180° swing as the robot passed under the camera. Fix: translate the camera
   by the same delta as the target. Cinematic mode used to lerp from the
   previous orbit pose, dragging the camera *through* the robot to reach the
   chase pose; now snaps on entry, lerps only for in-flight smoothing.
5. **Mobile policy hung in `hold`** — the threaded JSEP ORT WASM build
   (25 MB, requires WebGPU detection + pthreads + SharedArrayBuffer) failed
   silently on mobile. Switched to `onnxruntime-web/wasm` single-threaded
   (12 MB) with `numThreads = 1` and no WebGPU. For our tiny MLP that's still
   plenty fast and works on mobile Safari and Android Chrome.

## Other notable design choices

- **Free joint convention**: `qpos = [x, y, z, qw, qx, qy, qz, joints...]`,
  `qvel = [linvel(3, world), angvel(3, world), jointvel...]`. The base
  ang-vel obs reads from a `<gyro>` sensor at the IMU site (body-frame), not
  from `qvel[3..6]` (which is world-frame).
- **Worker boundary**: physics computes everything; main thread only renders.
  The main thread doesn't load MuJoCo at all. A snapshot of the model
  metadata is shipped via `postMessage` once at init; per-frame state crosses
  via `SharedArrayBuffer`.
- **Generation counter** in the SAB lets the policy worker detect torn
  reads (rare; physics writes ~250 Hz, policy reads ~50 Hz).
- **Vite build with hashed assets** + a side-file copy step into `website/sim/`
  is the simplest hosting pattern. We could move the source into the website
  repo and let Vercel build it, but the current 4-step push works fine.

## Useful scripts in `scripts/`

| File                            | Purpose                                                  |
| ------------------------------- | -------------------------------------------------------- |
| `smoke_rumi_loop.mjs`           | Node-side closed-loop sanity test (5 s walk forward)     |
| `convert_rumi_pt_to_onnx.py`    | `.pt` → ONNX conversion (rsl_rl actor)                   |
| `probe_rumi.mjs`                | Physics-only Rumi probe (sensors, keyframe, stability)   |
| `stand_no_policy.mjs`           | Hold ctrl at default; check robot stays upright          |
| `smoke.mjs`, `probe.mjs`        | Original tiny-scene smoke tests (falling box)            |
| `smoke_go1_loop.mjs`, `probe_go1.mjs` | Go1 (mujoco_playground) variants for reference     |

## Open follow-ups

- **Better-trained checkpoint** — current `model_5999.pt` walks ~0.46 m/s on
  `cmd=(0.5, 0, 0)`. A fully trained checkpoint should track better. Convert
  with `scripts/convert_rumi_pt_to_onnx.py` then re-deploy.
- **Repo bloat** — every push to `website/` adds ~24 MB of build artefacts.
  Could promote the source into the website repo and let Vercel build it,
  removing the binary churn from git history.
- **Visual fidelity** — per-leg colour assignment, contact shadows, a real
  HDRI skybox.
- **Scene picker** — if multiple robots/scenes are on the roadmap, a runtime
  switcher beats redeploying.
