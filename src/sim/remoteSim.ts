import { makeStateView, type ModelView, type SabLayout, type StateView } from './types';

export interface RemoteSim {
  worker: Worker;
  model: ModelView;
  state: StateView;
  sab: SharedArrayBuffer;
  layout: SabLayout;
  pause(paused: boolean): void;
  reset(): void;
  dispose(): void;
}

interface ReadyMsg {
  type: 'ready';
  snapshot: ModelView;
  sab: SharedArrayBuffer;
  layout: SabLayout;
}

export async function startRemoteSim(baseUrl: string): Promise<RemoteSim> {
  if (!crossOriginIsolated) {
    throw new Error(
      'crossOriginIsolated is false — SharedArrayBuffer is unavailable. ' +
        'Check that COOP/COEP headers are set in vite.config.ts.',
    );
  }
  const worker = new Worker(
    new URL('./physicsWorker.ts', import.meta.url),
    { type: 'module', name: 'mujoco-physics' },
  );

  const ready = await new Promise<ReadyMsg>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent) => {
      if (e.data?.type === 'ready') resolve(e.data as ReadyMsg);
    };
    worker.onerror = (e) => reject(new Error(`physics worker error: ${e.message}`));
    worker.onmessageerror = () => reject(new Error('physics worker messageerror'));
    worker.postMessage({ type: 'init', baseUrl });
  });

  const state = makeStateView(ready.sab, ready.layout);

  return {
    worker,
    model: ready.snapshot,
    state,
    sab: ready.sab,
    layout: ready.layout,
    pause(paused: boolean) {
      worker.postMessage({ type: 'pause', paused });
    },
    reset() {
      worker.postMessage({ type: 'reset' });
    },
    dispose() {
      worker.terminate();
    },
  };
}
