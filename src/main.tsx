import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

/** Register SW scoped to Vite `base` (/gl-web/) so ffmpeg.wasm assets cache on GitHub Pages. */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const base = import.meta.env.BASE_URL || '/';
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${base}sw.js`, { scope: base })
      .then(() => {
        // Warm the small core JS (not the ~30MB wasm) so first MP4 export starts faster.
        const warm = () => {
          void fetch(`${base}ffmpeg/ffmpeg-core.js`, { credentials: 'same-origin' }).catch(() => {});
        };
        const ric = (
          window as Window & {
            requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
          }
        ).requestIdleCallback;
        if (typeof ric === 'function') {
          ric(warm, { timeout: 4000 });
        } else {
          window.setTimeout(warm, 2500);
        }
      })
      .catch((err) => {
        console.warn('[sw] registration failed:', err);
      });
  });
}
