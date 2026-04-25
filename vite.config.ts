import { defineConfig } from 'vite';

// MuJoCo's multi-threaded WASM build needs cross-origin isolation
// (SharedArrayBuffer). onnxruntime-web's threaded WASM backend needs it too.
const crossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  // Hosted at https://<site>/sim/ on Vercel; dev server stays at root.
  base: process.env.NODE_ENV === 'production' ? '/sim/' : '/',
  server: {
    headers: crossOriginIsolationHeaders,
    // Inotify instances are constrained on this host; fall back to polling.
    watch: { usePolling: true, interval: 300 },
  },
  preview: {
    headers: crossOriginIsolationHeaders,
  },
  // ORT and MuJoCo ship .wasm files; let Vite pass them through unmodified.
  optimizeDeps: {
    exclude: ['@mujoco/mujoco', 'onnxruntime-web'],
  },
  worker: {
    format: 'es',
  },
});
