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
    proxy: {
      // Spark / World Labs streaming .rad scenes are hosted on GCS, which
      // doesn't send Cross-Origin-Resource-Policy. Proxying through Vite
      // re-emits the COOP/COEP headers so the COEP-isolated page can fetch.
      '/splats-cdn': {
        target: 'https://storage.googleapis.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/splats-cdn/, ''),
      },
      '/marble-cdn': {
        target: 'https://cdn.marble.worldlabs.ai',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/marble-cdn/, ''),
      },
    },
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
