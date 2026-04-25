/// <reference lib="webworker" />
import loadMujoco, { type MainModule, type MjModel, type MjData } from '@mujoco/mujoco';
import { loadAssetBundle } from './loadAssets';
import { snapshotModel, snapshotTransferables } from './snapshot';
import { computeSabLayout, type SabLayout } from './types';

let mj!: MainModule;
let model!: MjModel;
let data!: MjData;

let sab!: SharedArrayBuffer;
let layout!: SabLayout;
let f64!: Float64Array;
let i32!: Int32Array;

let running = false;

interface InitMsg { type: 'init'; baseUrl: string; }
interface PauseMsg { type: 'pause'; paused: boolean; }
interface ResetMsg { type: 'reset'; }
type InMsg = InitMsg | PauseMsg | ResetMsg;

const ctx: DedicatedWorkerGlobalScope = self as any;

ctx.onmessage = async (e: MessageEvent<InMsg>) => {
  const msg = e.data;
  if (msg.type === 'init') {
    await init(msg.baseUrl);
  } else if (msg.type === 'pause') {
    running = !msg.paused;
    if (running) tick();
  } else if (msg.type === 'reset') {
    if (model && data) {
      if (model.nkey > 0) mj.mj_resetDataKeyframe(model, data, 0);
      else mj.mj_resetData(model, data);
      mj.mj_forward(model, data);
      const initCtrl = data.ctrl as unknown as Float64Array;
      f64.set(initCtrl, layout.ctrlOffsetD);
      writeState();
    }
  }
};

async function init(baseUrl: string) {
  mj = await loadMujoco();
  const xmlPath = await loadAssetBundle(mj, baseUrl);
  model = mj.MjModel.from_xml_path(xmlPath);
  data = new mj.MjData(model);

  // Reset to keyframe 0 ("home") if the model defines one. Otherwise the
  // robot starts in whatever degenerate splat-pose qpos=0 implies.
  if (model.nkey > 0) {
    mj.mj_resetDataKeyframe(model, data, 0);
  }
  mj.mj_forward(model, data);

  layout = computeSabLayout(
    model.ngeom, model.nq, model.nv, model.nu, model.nsite, model.nsensordata,
  );
  sab = new SharedArrayBuffer(layout.totalBytes);
  f64 = new Float64Array(sab);
  i32 = new Int32Array(sab, 0, layout.controlBytes / 4);

  // Seed the SAB ctrl region with the initial ctrl values from the keyframe
  // (or from data.ctrl if no keyframe). The policy worker will overwrite once
  // it produces its first action.
  const initCtrl = data.ctrl as unknown as Float64Array;
  f64.set(initCtrl, layout.ctrlOffsetD);

  const snap = snapshotModel(model);

  ctx.postMessage(
    { type: 'ready', snapshot: snap, sab, layout },
    snapshotTransferables(snap),
  );

  writeState();

  running = true;
  tick();
}

function writeState() {
  // Increment generation BEFORE writing (odd = "writer in progress")
  // and again AFTER (back to even = "stable"). Readers can detect a torn
  // snapshot by sampling generation, reading, sampling again.
  Atomics.store(i32, 0, Atomics.load(i32, 0) + 1);

  const xpos = data.geom_xpos as unknown as Float64Array;
  const xmat = data.geom_xmat as unknown as Float64Array;
  const qpos = data.qpos as unknown as Float64Array;
  const qvel = data.qvel as unknown as Float64Array;
  const siteXmat = data.site_xmat as unknown as Float64Array;
  const sensorData = data.sensordata as unknown as Float64Array;

  f64[layout.headerOffsetD + 0] = data.time;

  f64.set(xpos, layout.geomXposOffsetD);
  f64.set(xmat, layout.geomXmatOffsetD);
  f64.set(qpos, layout.qposOffsetD);
  f64.set(qvel, layout.qvelOffsetD);
  f64.set(siteXmat, layout.siteXmatOffsetD);
  f64.set(sensorData, layout.sensorOffsetD);

  Atomics.store(i32, 0, Atomics.load(i32, 0) + 1);
  Atomics.add(i32, 1, 1); // step counter
}

let lastWallMs = 0;

function tick() {
  if (!running) return;
  const now = performance.now();
  if (lastWallMs === 0) lastWallMs = now;

  // Step real-time: catch up to current wall time, but cap to avoid spirals.
  const stepDt = model.opt.timestep;
  let dtSec = (now - lastWallMs) / 1000;
  if (dtSec > 0.1) dtSec = 0.1;
  lastWallMs = now;

  let nSteps = Math.max(1, Math.round(dtSec / stepDt));
  // Safety cap so a single tick never spends > ~10 ms in WASM.
  if (nSteps > 200) nSteps = 200;

  // Copy the latest ctrl (written by the policy worker) into MjData before
  // stepping. Doing it once per batch is fine: ctrl rate (50 Hz) is much
  // slower than sim rate (500 Hz), so applying the same ctrl across ~10 sim
  // steps mirrors what a real PD-driven robot does between policy ticks.
  const ctrlSrc = f64.subarray(layout.ctrlOffsetD, layout.ctrlOffsetD + layout.nu);
  const ctrlDst = data.ctrl as unknown as Float64Array;
  ctrlDst.set(ctrlSrc);

  for (let i = 0; i < nSteps; i++) mj.mj_step(model, data);
  writeState();

  // Yield to the event loop so postMessage / control msgs can be handled.
  setTimeout(tick, 0);
}
