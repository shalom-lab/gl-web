/**
 * ffmpeg.wasm helper: PNG frame sequence → H.264 MP4.
 * Core assets are served from `${BASE_URL}ffmpeg/` (copied by Vite plugin)
 * and CacheFirst'd by public/sw.js after the first fetch.
 *
 * Note: do NOT pass `classWorkerURL` from a `?url` import of the package
 * worker source — that file still has relative `./const.js` imports and 404s
 * under /gl-web/assets/. Omit it so Vite's rewrite of the package's
 * `new URL('./worker.js', import.meta.url)` points at the bundled worker chunk.
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpegSingleton: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

function ffmpegBaseUrl(): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base.endsWith('/') ? base : `${base}/`}ffmpeg`;
}

/** Ensure a single FFmpeg instance is loaded (idempotent). */
export async function ensureFfmpegLoaded(
  onProgress?: (info: { percent: number; statusText: string }) => void
): Promise<FFmpeg> {
  if (ffmpegSingleton?.loaded) return ffmpegSingleton;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const ffmpeg = new FFmpeg();
    ffmpegSingleton = ffmpeg;

    ffmpeg.on('log', ({ message }) => {
      if (import.meta.env.DEV) console.debug('[ffmpeg]', message);
    });

    onProgress?.({ percent: 2, statusText: '正在加载 ffmpeg.wasm 核心…' });

    const base = ffmpegBaseUrl();
    // Resolve against the site origin so /gl-web/ffmpeg/… works on GitHub Pages
    // even when the app was opened without a trailing slash.
    const coreSrc = new URL(`${base}/ffmpeg-core.js`, window.location.origin).href;
    const wasmSrc = new URL(`${base}/ffmpeg-core.wasm`, window.location.origin).href;

    // Blob URLs keep the worker same-origin friendly; SW still caches the original fetches.
    const coreURL = await toBlobURL(coreSrc, 'text/javascript');
    onProgress?.({
      percent: 40,
      statusText: '正在下载 ffmpeg-core.wasm（首次约 30MB，之后走 SW 缓存）…'
    });
    const wasmURL = await toBlobURL(wasmSrc, 'application/wasm');
    onProgress?.({ percent: 85, statusText: '正在初始化 WebAssembly…' });

    // Intentionally omit classWorkerURL — use Vite-bundled default worker.
    await ffmpeg.load({
      coreURL,
      wasmURL
    });

    onProgress?.({ percent: 100, statusText: 'ffmpeg.wasm 已就绪' });
    return ffmpeg;
  })();

  try {
    return await loadPromise;
  } catch (err) {
    loadPromise = null;
    ffmpegSingleton = null;
    throw err;
  }
}

export function terminateFfmpeg(): void {
  if (ffmpegSingleton) {
    try {
      ffmpegSingleton.terminate();
    } catch {
      /* ignore */
    }
  }
  ffmpegSingleton = null;
  loadPromise = null;
}

export interface EncodeMp4Options {
  fps: number;
  frameCount: number;
  onProgress?: (info: { percent: number; statusText: string }) => void;
  shouldCancel?: () => boolean;
}

/**
 * Encode PNG frames already present in MEMFS (frame_00001.png …) into H.264 yuv420p MP4.
 */
export async function encodePngSequenceToMp4(
  ffmpeg: FFmpeg,
  options: EncodeMp4Options
): Promise<Blob> {
  const { fps, frameCount, onProgress, shouldCancel } = options;
  const outName = 'output.mp4';

  if (shouldCancel?.()) {
    throw new Error('用户取消了导出');
  }

  onProgress?.({ percent: 0, statusText: '正在用 ffmpeg.wasm 编码 H.264 MP4…' });

  const onFfmpegProgress = ({ progress }: { progress: number }) => {
    const pct = Math.max(0, Math.min(99, Math.round(progress * 100)));
    onProgress?.({
      percent: pct,
      statusText: `正在编码 MP4… ${pct}%`
    });
  };
  ffmpeg.on('progress', onFfmpegProgress);

  try {
    const code = await ffmpeg.exec([
      '-framerate',
      String(fps),
      '-i',
      'frame_%05d.png',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-crf',
      '18',
      '-movflags',
      '+faststart',
      outName
    ]);

    if (shouldCancel?.()) {
      throw new Error('用户取消了导出');
    }

    if (code !== 0) {
      throw new Error(`ffmpeg 编码失败 (exit ${code})`);
    }

    const data = await ffmpeg.readFile(outName);
    onProgress?.({ percent: 100, statusText: 'MP4 编码完成' });

    const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return new Blob([copy.buffer], { type: 'video/mp4' });
  } finally {
    ffmpeg.off('progress', onFfmpegProgress);
    try {
      await ffmpeg.deleteFile(outName);
    } catch {
      /* ignore */
    }
    for (let i = 1; i <= frameCount; i++) {
      const name = `frame_${String(i).padStart(5, '0')}.png`;
      try {
        await ffmpeg.deleteFile(name);
      } catch {
        /* ignore */
      }
    }
  }
}

/** Write a PNG Blob into ffmpeg MEMFS as frame_XXXXX.png (1-based index). */
export async function writePngFrame(
  ffmpeg: FFmpeg,
  frameIndex1Based: number,
  pngBlob: Blob
): Promise<void> {
  const name = `frame_${String(frameIndex1Based).padStart(5, '0')}.png`;
  await ffmpeg.writeFile(name, await fetchFile(pngBlob));
}
