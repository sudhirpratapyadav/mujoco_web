/// <reference lib="webworker" />
import * as ort from 'onnxruntime-web';
// Vite hashes wasm/mjs assets in production. ORT's internal loader otherwise
// asks for the *un*hashed filenames and 404s. `?url` makes Vite emit each
// file as a build asset and inline its hashed URL here.
import jsepWasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm?url';
import jsepMjsUrl from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs?url';
import { makeStateView, type ModelView, type SabLayout, type StateView } from '../sim/types';
import { buildObs } from './obs';
import { DEFAULT_RUMI_CONFIG, type PolicyConfig } from './policyConfig';

ort.env.wasm.wasmPaths = { wasm: jsepWasmUrl, mjs: jsepMjsUrl };

interface InitMsg {
  type: 'init';
  model: ModelView;
  sab: SharedArrayBuffer;
  layout: SabLayout;
  policyBaseUrl: string; // e.g. '/policy'
}
interface PauseMsg { type: 'pause'; paused: boolean; }
type InMsg = InitMsg | PauseMsg;

const ctx: DedicatedWorkerGlobalScope = self as any;

let model!: ModelView;
let state!: StateView;
let cfg: PolicyConfig = DEFAULT_RUMI_CONFIG;
let session: ort.InferenceSession | null = null;
let mode: 'onnx' | 'hold' = 'hold';

let obsBuf!: Float32Array;
let actionBuf!: Float32Array;
let lastAction!: Float32Array;

let running = false;
let intervalId: number | null = null;

ctx.onmessage = async (e: MessageEvent<InMsg>) => {
  const msg = e.data;
  if (msg.type === 'init') {
    await init(msg);
  } else if (msg.type === 'pause') {
    running = !msg.paused;
  }
};

async function init(msg: InitMsg) {
  state = makeStateView(msg.sab, msg.layout);
  model = msg.model;

  // Try to fetch a user-provided config; fall back to the default.
  // Vite's dev server returns 200 + index.html for unknown paths (SPA fallback),
  // so we must look at content-type, not status alone.
  try {
    const r = await fetch(`${msg.policyBaseUrl}/config.json`);
    const ct = r.headers.get('content-type') ?? '';
    if (r.ok && ct.includes('application/json')) {
      cfg = { ...cfg, ...(await r.json()) };
    }
  } catch {
    /* ignore — default config */
  }

  if (cfg.actionDim !== msg.layout.nu) {
    ctx.postMessage({
      type: 'warn',
      message: `policy actionDim=${cfg.actionDim} but model nu=${msg.layout.nu}; will hold ctrl`,
    });
    mode = 'hold';
  } else {
    obsBuf = new Float32Array(cfg.obsDim);
    actionBuf = new Float32Array(cfg.actionDim);
    lastAction = new Float32Array(cfg.actionDim);

    try {
      const url = `${msg.policyBaseUrl}/policy.onnx`;
      const head = await fetch(url, { method: 'HEAD' });
      const ct = head.headers.get('content-type') ?? '';
      // SPA fallback returns text/html for missing static files; treat that
      // as "no policy provided" rather than trying to load HTML as ONNX.
      const isReal = head.ok && !ct.startsWith('text/html');
      if (isReal) {
        session = await ort.InferenceSession.create(url, {
          executionProviders: ['webgpu', 'wasm'],
          graphOptimizationLevel: 'all',
        });
        mode = 'onnx';
        ctx.postMessage({ type: 'info', message: `loaded ${url}` });
      } else {
        ctx.postMessage({
          type: 'info',
          message: 'no policy.onnx found; holding default ctrl',
        });
        mode = 'hold';
      }
    } catch (err) {
      ctx.postMessage({
        type: 'warn',
        message: `failed to load policy.onnx: ${(err as Error).message}; holding ctrl`,
      });
      mode = 'hold';
    }
  }

  ctx.postMessage({ type: 'ready', mode, controlHz: cfg.controlHz });
  running = true;
  // setInterval gives us a stable rate without busy-waiting.
  intervalId = setInterval(tick, 1000 / cfg.controlHz) as unknown as number;
}

async function tick() {
  if (!running) return;

  if (mode === 'onnx' && session) {
    // Apply the policy's expected joystick scaling. The user input writes raw
    // (vx, vy, wz) into command[]; we scale here per the trained contract so
    // the policy sees the magnitudes it was trained on.
    state.command[0] = clamp(state.command[0], -1, 1) * cfg.velScaleX;
    state.command[1] = clamp(state.command[1], -1, 1) * cfg.velScaleY;
    state.command[2] = clamp(state.command[2], -1, 1) * cfg.velScaleRot;

    // Snapshot under generation guard so we don't observe a torn state.
    let g0: number, g1: number;
    let attempts = 0;
    do {
      g0 = Atomics.load(state.control, 0);
      buildObs(cfg, model, state, lastAction, obsBuf);
      g1 = Atomics.load(state.control, 0);
      attempts++;
    } while (g0 !== g1 && attempts < 3);

    try {
      const inputTensor = new ort.Tensor('float32', obsBuf, [1, cfg.obsDim]);
      const out = await session.run({ [cfg.inputName]: inputTensor });
      const raw = out[cfg.outputName].data as Float32Array;
      // ctrl_t = default + scale * action; remember raw for the next obs.
      const def = cfg.defaultJointPos;
      for (let i = 0; i < cfg.actionDim; i++) {
        actionBuf[i] = def[i] + cfg.actionScale * raw[i];
        lastAction[i] = raw[i];
      }
    } catch (err) {
      ctx.postMessage({
        type: 'warn',
        message: `inference failed: ${(err as Error).message}; falling back to hold`,
      });
      mode = 'hold';
    }
  }

  if (mode === 'hold') {
    // Keep whatever ctrl was seeded by the physics worker (= keyframe ctrl).
    return;
  }

  // Write into shared ctrl buffer. Update generation so consumers can detect.
  Atomics.store(state.control, 2, Atomics.load(state.control, 2) + 1);
  for (let i = 0; i < cfg.actionDim; i++) state.ctrl[i] = actionBuf[i];
  Atomics.store(state.control, 2, Atomics.load(state.control, 2) + 1);
}

ctx.addEventListener('error', (e) => {
  ctx.postMessage({ type: 'warn', message: `worker error: ${e.message}` });
});

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

// Cleanup on terminate.
ctx.addEventListener('close', () => {
  if (intervalId !== null) clearInterval(intervalId);
  session?.release();
});
