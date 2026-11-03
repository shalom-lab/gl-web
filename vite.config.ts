import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, mkdirSync } from 'fs';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

/** Copy @ffmpeg/core assets into public/ffmpeg so they are served under base `/gl-web/ffmpeg/`. */
function copyFfmpegAssets(): Plugin {
  const copy = () => {
    const dest = path.resolve(import.meta.dirname, 'public/ffmpeg');
    mkdirSync(dest, { recursive: true });
    const src = path.resolve(import.meta.dirname, 'node_modules/@ffmpeg/core/dist/esm');
    for (const file of ['ffmpeg-core.js', 'ffmpeg-core.wasm'] as const) {
      copyFileSync(path.join(src, file), path.join(dest, file));
    }
  };

  return {
    name: 'copy-ffmpeg-assets',
    buildStart() {
      copy();
    },
    configureServer() {
      copy();
    }
  };
}

// Project Pages: https://shalom-lab.github.io/gl-web/
export default defineConfig(() => {
  return {
    base: '/gl-web/',
    plugins: [react(), tailwindcss(), copyFfmpegAssets()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.')
      }
    },
    optimizeDeps: {
      exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util', '@ffmpeg/core']
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {}
    }
  };
});
