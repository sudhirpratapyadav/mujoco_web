import type { ModelView, SabLayout } from '../sim/types';

export interface PolicyHandle {
  worker: Worker;
  mode: 'onnx' | 'hold';
  controlHz: number;
  pause(paused: boolean): void;
  dispose(): void;
}

export async function startPolicy(
  model: ModelView,
  sab: SharedArrayBuffer,
  layout: SabLayout,
  policyBaseUrl: string = '/policy',
): Promise<PolicyHandle> {
  const worker = new Worker(
    new URL('./policyWorker.ts', import.meta.url),
    { type: 'module', name: 'policy' },
  );

  // Surface info/warn messages from the worker on the main-thread console.
  worker.addEventListener('message', (e) => {
    const m = e.data;
    if (m?.type === 'info') console.log('[policy]', m.message);
    else if (m?.type === 'warn') console.warn('[policy]', m.message);
  });

  const ready = await new Promise<{ mode: 'onnx' | 'hold'; controlHz: number }>((resolve, reject) => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'ready') {
        worker.removeEventListener('message', onMsg);
        resolve({ mode: e.data.mode, controlHz: e.data.controlHz });
      }
    };
    worker.addEventListener('message', onMsg);
    worker.onerror = (e) => reject(new Error(`policy worker error: ${e.message}`));
    worker.postMessage({ type: 'init', model, sab, layout, policyBaseUrl });
  });

  return {
    worker,
    mode: ready.mode,
    controlHz: ready.controlHz,
    pause(paused: boolean) {
      worker.postMessage({ type: 'pause', paused });
    },
    dispose() {
      worker.terminate();
    },
  };
}
