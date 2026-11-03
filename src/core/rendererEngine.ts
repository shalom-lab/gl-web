import * as THREE from 'three';
import JSZip from 'jszip';
import { ExportSettings, ImageSlide, ShaderSettings, TimelineSettings } from '../types';
import { vertexShader, buildFragmentShader, getTransitionGlsl } from '../shaders/artShader';
import { getExportDimensionsFromAspect, resolveAspectValue, DEFAULT_CUSTOM_ASPECT } from '../utils/aspectRatio';

function getExportDimensions(settings: ExportSettings): [number, number] {
  const aspect =
    typeof settings.aspectValue === 'number' && settings.aspectValue > 0
      ? settings.aspectValue
      : resolveAspectValue(settings.aspectRatio ?? '16:9', [], DEFAULT_CUSTOM_ASPECT);
  return getExportDimensionsFromAspect(settings.resolution, aspect);
}

export interface ProgressInfo {
  currentFrame: number;
  totalFrames: number;
  percent: number;
  previewUrl?: string;
  statusText: string;
}

/** Deep-ish snapshot so live UI edits cannot mutate an in-flight export. */
export function snapshotExportState(
  slides: ImageSlide[],
  shaderSettings: ShaderSettings,
  timelineSettings: TimelineSettings
): {
  slides: ImageSlide[];
  shaderSettings: ShaderSettings;
  timelineSettings: TimelineSettings;
} {
  return {
    slides: slides.map((s) => ({
      id: s.id,
      title: s.title,
      dataUrl: s.dataUrl,
      aspectRatio: s.aspectRatio
    })),
    shaderSettings: {
      ...shaderSettings,
      customGlsl: shaderSettings.customGlsl
    },
    timelineSettings: { ...timelineSettings }
  };
}

export class RendererEngine {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private plane: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private textureCache: Map<string, THREE.Texture> = new Map();
  private placeholderTexture: THREE.Texture;

  private slides: ImageSlide[] = [];
  private shaderSettings: ShaderSettings;
  private timelineSettings: TimelineSettings;

  public currentTime: number = 0;
  public isPlaying: boolean = false;
  private animationFrameId: number | null = null;
  private lastTimestamp: number = 0;
  private onTimeUpdateCallback?: (time: number) => void;
  private isExporting: boolean = false;
  private cancelExportRequested: boolean = false;

  constructor(
    canvas: HTMLCanvasElement,
    initialSlides: ImageSlide[],
    shaderSettings: ShaderSettings,
    timelineSettings: TimelineSettings
  ) {
    this.canvas = canvas;
    this.slides = initialSlides;
    this.shaderSettings = shaderSettings;
    this.timelineSettings = timelineSettings;

    // 1. Setup Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true // Required for screenshot & frame recording
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 2. Setup Scene & Orthographic Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // 3. Create 1x1 placeholder texture
    const dummyCanvas = document.createElement('canvas');
    dummyCanvas.width = 2;
    dummyCanvas.height = 2;
    const dummyCtx = dummyCanvas.getContext('2d')!;
    dummyCtx.fillStyle = '#111827';
    dummyCtx.fillRect(0, 0, 2, 2);
    this.placeholderTexture = new THREE.CanvasTexture(dummyCanvas);
    this.placeholderTexture.colorSpace = THREE.SRGBColorSpace;

    // 4. Create Shader Material with selected gl-transition
    const initialGlsl = getTransitionGlsl(this.shaderSettings.transitionId, this.shaderSettings.customGlsl);
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: buildFragmentShader(initialGlsl),
      uniforms: {
        uTextureCurrent: { value: this.placeholderTexture },
        uTextureNext: { value: this.placeholderTexture },
        uTransition: { value: 0.0 },
        uTime: { value: 0.0 },
        uSlideProgress: { value: 0.0 },
        uViewportAspect: { value: 16 / 9 },
        uAspectCurrent: { value: 16 / 9 },
        uAspectNext: { value: 16 / 9 },

        uBreathIntensity: { value: this.shaderSettings.breathIntensity },
        uChromaticAberration: { value: this.shaderSettings.chromaticAberration },
        uFluidDistortion: { value: this.shaderSettings.fluidDistortion },
        uFilmGrain: { value: this.shaderSettings.filmGrain },
        uVignette: { value: this.shaderSettings.vignette },
        uBloomGlow: { value: this.shaderSettings.bloomGlow },
        uScanReveal: { value: this.shaderSettings.scanReveal },
        uGlitch: { value: this.shaderSettings.glitch },
        uEdgeBlur: { value: this.shaderSettings.edgeBlur },
        uColorTone: { value: this.shaderSettings.colorTone }
      },
      depthTest: false,
      depthWrite: false
    });

    // 5. Plane quad covering normalized device coordinates
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.plane = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.plane);

    // 6. Preload textures
    this.loadAllSlideTextures(initialSlides);

    // Initial render
    this.updateViewportSize();
    this.applyUniformsAtTime(0);
    this.render();
  }

  /**
   * Dedicated offscreen engine for background export.
   * Uses snapshotted slides/settings so the live preview can keep playing/editing.
   */
  public static createOffscreenExporter(
    slides: ImageSlide[],
    shaderSettings: ShaderSettings,
    timelineSettings: TimelineSettings
  ): RendererEngine {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    // Detached from DOM — WebGL still works
    return new RendererEngine(canvas, slides, shaderSettings, timelineSettings);
  }

  /** Wait until every slide texture is in the cache (needed before frame stepping). */
  public async ensureTexturesLoaded(): Promise<void> {
    const loader = new THREE.TextureLoader();
    const pending = this.slides.filter((s) => !this.textureCache.has(s.id));
    if (!pending.length) return;

    await Promise.all(
      pending.map(
        (slide) =>
          new Promise<void>((resolve, reject) => {
            loader.load(
              slide.dataUrl,
              (tex) => {
                tex.colorSpace = THREE.SRGBColorSpace;
                tex.minFilter = THREE.LinearFilter;
                tex.magFilter = THREE.LinearFilter;
                tex.wrapS = THREE.ClampToEdgeWrapping;
                tex.wrapT = THREE.ClampToEdgeWrapping;
                this.textureCache.set(slide.id, tex);
                resolve();
              },
              undefined,
              (err) => reject(err ?? new Error(`纹理加载失败: ${slide.id}`))
            );
          })
      )
    );
  }

  // Preload textures into cache
  private loadAllSlideTextures(slides: ImageSlide[]) {
    const loader = new THREE.TextureLoader();
    slides.forEach((slide) => {
      if (!this.textureCache.has(slide.id)) {
        loader.load(slide.dataUrl, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.minFilter = THREE.LinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.wrapS = THREE.ClampToEdgeWrapping;
          tex.wrapT = THREE.ClampToEdgeWrapping;
          this.textureCache.set(slide.id, tex);
          // Re-render if this was current slide
          this.applyUniformsAtTime(this.currentTime);
          this.render();
        });
      }
    });
  }

  public setSlides(slides: ImageSlide[]) {
    this.slides = slides;
    this.loadAllSlideTextures(slides);
    this.applyUniformsAtTime(this.currentTime);
    this.render();
  }

  public updateShaderSettings(settings: ShaderSettings) {
    const oldGlsl = getTransitionGlsl(this.shaderSettings.transitionId, this.shaderSettings.customGlsl);
    const newGlsl = getTransitionGlsl(settings.transitionId, settings.customGlsl);
    this.shaderSettings = settings;

    if (oldGlsl !== newGlsl) {
      try {
        const newShader = buildFragmentShader(newGlsl);
        this.material.fragmentShader = newShader;
        this.material.needsUpdate = true;
      } catch (err) {
        console.warn('Failed to update transition shader:', err);
      }
    }

    const u = this.material.uniforms;
    u.uBreathIntensity.value = settings.breathIntensity;
    u.uChromaticAberration.value = settings.chromaticAberration;
    u.uFluidDistortion.value = settings.fluidDistortion;
    u.uFilmGrain.value = settings.filmGrain;
    u.uVignette.value = settings.vignette;
    u.uBloomGlow.value = settings.bloomGlow;
    u.uScanReveal.value = settings.scanReveal;
    u.uGlitch.value = settings.glitch;
    u.uEdgeBlur.value = settings.edgeBlur;
    u.uColorTone.value = settings.colorTone;
    this.render();
  }

  public updateTimelineSettings(settings: TimelineSettings) {
    this.timelineSettings = settings;
    this.applyUniformsAtTime(this.currentTime);
    this.render();
  }

  public getTotalDuration(): number {
    const count = this.slides.length;
    if (count === 0) return 1;
    const period = this.timelineSettings.slideDuration + this.timelineSettings.transitionDuration;
    return count * period;
  }

  // Calculate timeline state for any given second
  public getTimeState(time: number) {
    const count = this.slides.length;
    if (count === 0) {
      return {
        slideIndex: 0,
        nextIndex: 0,
        inTransition: false,
        transitionProgress: 0,
        slideProgress: 0
      };
    }

    const { slideDuration, transitionDuration } = this.timelineSettings;
    const period = slideDuration + transitionDuration;
    const total = count * period;

    // Wrap time or clamp
    let wrappedTime = time % total;
    if (wrappedTime < 0) wrappedTime += total;

    const slideIndex = Math.floor(wrappedTime / period) % count;
    const timeInPeriod = wrappedTime - Math.floor(wrappedTime / period) * period;

    const inTransition = timeInPeriod >= slideDuration;
    const transitionProgress = inTransition
      ? Math.min(1.0, (timeInPeriod - slideDuration) / Math.max(0.01, transitionDuration))
      : 0.0;

    const slideProgress = timeInPeriod / period;
    const nextIndex = (slideIndex + 1) % count;

    return {
      slideIndex,
      nextIndex,
      inTransition,
      transitionProgress,
      slideProgress
    };
  }

  public applyUniformsAtTime(time: number) {
    if (this.slides.length === 0) return;

    const state = this.getTimeState(time);
    const currentSlide = this.slides[state.slideIndex];
    const nextSlide = this.slides[state.nextIndex];

    const currentTex = this.textureCache.get(currentSlide?.id) || this.placeholderTexture;
    const nextTex = this.textureCache.get(nextSlide?.id) || this.placeholderTexture;

    const u = this.material.uniforms;
    u.uTextureCurrent.value = currentTex;
    u.uTextureNext.value = nextTex;
    u.uTransition.value = state.transitionProgress;
    u.uSlideProgress.value = state.slideProgress;
    u.uTime.value = time;
    u.uAspectCurrent.value = currentSlide?.aspectRatio || 16 / 9;
    u.uAspectNext.value = nextSlide?.aspectRatio || 16 / 9;
  }

  public updateViewportSize(width?: number, height?: number) {
    const w = width ?? this.canvas.clientWidth;
    const h = height ?? this.canvas.clientHeight;
    if (w > 0 && h > 0) {
      this.renderer.setSize(w, h, false);
      this.material.uniforms.uViewportAspect.value = w / h;
      this.render();
    }
  }

  public render() {
    this.renderer.render(this.scene, this.camera);
  }

  public setOnTimeUpdate(cb: (time: number) => void) {
    this.onTimeUpdateCallback = cb;
  }

  public seek(time: number) {
    const total = this.getTotalDuration();
    this.currentTime = Math.max(0, Math.min(time, total));
    this.applyUniformsAtTime(this.currentTime);
    this.render();
    this.onTimeUpdateCallback?.(this.currentTime);
  }

  public play() {
    if (this.isPlaying || this.isExporting) return;
    this.isPlaying = true;
    this.lastTimestamp = performance.now();
    this.tick();
  }

  public pause() {
    this.isPlaying = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  private tick = () => {
    if (!this.isPlaying) return;

    const now = performance.now();
    const dt = Math.min((now - this.lastTimestamp) / 1000, 0.1);
    this.lastTimestamp = now;

    const total = this.getTotalDuration();
    this.currentTime += dt;

    if (this.currentTime >= total) {
      if (this.timelineSettings.loop) {
        this.currentTime = this.currentTime % total;
      } else {
        this.currentTime = total;
        this.pause();
      }
    }

    this.applyUniformsAtTime(this.currentTime);
    this.render();
    this.onTimeUpdateCallback?.(this.currentTime);

    this.animationFrameId = requestAnimationFrame(this.tick);
  };

  public cancelExport() {
    this.cancelExportRequested = true;
  }

  // --- High-quality MP4: PNG sequence → ffmpeg.wasm (H.264) ---
  public async exportMp4ViaFfmpeg(
    settings: ExportSettings,
    onProgress: (info: ProgressInfo) => void
  ): Promise<Blob | null> {
    this.pause();
    this.isExporting = true;
    this.cancelExportRequested = false;

    const totalDuration = this.getTotalDuration();
    const fps = settings.fps;
    const totalFrames = Math.max(1, Math.round(totalDuration * fps));
    const [targetW, targetH] = getExportDimensions(settings);

    const {
      encodePngSequenceToMp4,
      ensureFfmpegLoaded,
      terminateFfmpeg,
      writePngFrame
    } = await import('../utils/ffmpegMp4');

    let ffmpeg;
    try {
      ffmpeg = await ensureFfmpegLoaded((info) => {
        onProgress({
          currentFrame: 0,
          totalFrames,
          percent: Math.round(info.percent * 0.15),
          statusText: info.statusText
        });
      });
    } catch (err: any) {
      this.isExporting = false;
      throw new Error('ffmpeg.wasm 加载失败: ' + (err?.message || String(err)));
    }

    if (this.cancelExportRequested) {
      this.isExporting = false;
      return null;
    }

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = targetW;
    exportCanvas.height = targetH;

    const exportRenderer = new THREE.WebGLRenderer({
      canvas: exportCanvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true
    });
    exportRenderer.outputColorSpace = THREE.SRGBColorSpace;
    exportRenderer.setSize(targetW, targetH, false);

    const oldVpAspect = this.material.uniforms.uViewportAspect.value;
    this.material.uniforms.uViewportAspect.value = targetW / targetH;

    try {
      for (let frame = 0; frame < totalFrames; frame++) {
        if (this.cancelExportRequested) {
          throw new Error('用户取消了导出');
        }

        const time = frame / fps;
        this.applyUniformsAtTime(time);
        exportRenderer.render(this.scene, this.camera);

        const frameBlob = await new Promise<Blob | null>((resolve) => {
          exportCanvas.toBlob(resolve, 'image/png');
        });
        if (!frameBlob) {
          throw new Error(`第 ${frame + 1} 帧图像编码失败`);
        }

        await writePngFrame(ffmpeg, frame + 1, frameBlob);

        let previewUrl: string | undefined;
        if (frame % 5 === 0 || frame === totalFrames - 1) {
          previewUrl = exportCanvas.toDataURL('image/jpeg', 0.6);
        }

        // Render phase maps to 15%–75% of overall progress
        const renderPct = 15 + Math.round(((frame + 1) / totalFrames) * 60);
        onProgress({
          currentFrame: frame + 1,
          totalFrames,
          percent: renderPct,
          previewUrl,
          statusText: `正在渲染 PNG 帧 ${frame + 1} / ${totalFrames}…`
        });

        await new Promise((r) => setTimeout(r, 0));
      }

      if (this.cancelExportRequested) {
        throw new Error('用户取消了导出');
      }

      const mp4Blob = await encodePngSequenceToMp4(ffmpeg, {
        fps,
        frameCount: totalFrames,
        shouldCancel: () => this.cancelExportRequested,
        onProgress: (info) => {
          onProgress({
            currentFrame: totalFrames,
            totalFrames,
            percent: 75 + Math.round(info.percent * 0.25),
            statusText: info.statusText
          });
        }
      });

      onProgress({
        currentFrame: totalFrames,
        totalFrames,
        percent: 100,
        statusText: 'MP4 导出完成'
      });

      return mp4Blob;
    } catch (err: any) {
      if (err?.message === '用户取消了导出') {
        try {
          terminateFfmpeg();
        } catch {
          /* ignore */
        }
        return null;
      }
      throw err;
    } finally {
      this.material.uniforms.uViewportAspect.value = oldVpAspect;
      exportRenderer.dispose();
      this.isExporting = false;
      this.seek(this.currentTime);
    }
  }

  // --- Export PNG Sequence with JSZip (逐帧离线高画质渲染导出) ---
  public async exportPngSequence(
    settings: ExportSettings,
    onProgress: (info: ProgressInfo) => void
  ): Promise<Blob | null> {
    this.pause();
    this.isExporting = true;
    this.cancelExportRequested = false;

    const totalDuration = this.getTotalDuration();
    const fps = settings.fps;
    const totalFrames = Math.max(1, Math.round(totalDuration * fps));

    const [targetW, targetH] = getExportDimensions(settings);

    // Create offscreen export canvas & renderer
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = targetW;
    exportCanvas.height = targetH;

    const exportRenderer = new THREE.WebGLRenderer({
      canvas: exportCanvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true
    });
    exportRenderer.outputColorSpace = THREE.SRGBColorSpace;
    exportRenderer.setSize(targetW, targetH, false);

    const zip = new JSZip();
    const folder = zip.folder('frames')!;

    // Save previous viewport aspect
    const oldVpAspect = this.material.uniforms.uViewportAspect.value;
    this.material.uniforms.uViewportAspect.value = targetW / targetH;

    try {
      for (let frame = 0; frame < totalFrames; frame++) {
        if (this.cancelExportRequested) {
          throw new Error('用户取消了导出');
        }

        const time = frame / fps;
        this.applyUniformsAtTime(time);
        exportRenderer.render(this.scene, this.camera);

        const frameBlob = await new Promise<Blob | null>((resolve) => {
          exportCanvas.toBlob(resolve, 'image/png');
        });

        if (!frameBlob) {
          throw new Error(`第 ${frame + 1} 帧图像编码失败`);
        }

        const filename = `frame_${String(frame + 1).padStart(5, '0')}.png`;
        folder.file(filename, frameBlob);

        // Preview thumbnail every 5 frames
        let previewUrl: string | undefined;
        if (frame % 5 === 0 || frame === totalFrames - 1) {
          previewUrl = exportCanvas.toDataURL('image/jpeg', 0.6);
        }

        onProgress({
          currentFrame: frame + 1,
          totalFrames,
          percent: Math.round(((frame + 1) / totalFrames) * 100),
          previewUrl,
          statusText: `正在逐帧渲染第 ${frame + 1} / ${totalFrames} 帧...`
        });

        // Yield to browser main thread
        await new Promise((r) => setTimeout(r, 0));
      }

      onProgress({
        currentFrame: totalFrames,
        totalFrames,
        percent: 100,
        statusText: '渲染完成，正在压缩打包 ZIP 文件...'
      });

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      return zipBlob;
    } catch (err: any) {
      if (err.message === '用户取消了导出') {
        return null;
      }
      throw err;
    } finally {
      this.material.uniforms.uViewportAspect.value = oldVpAspect;
      exportRenderer.dispose();
      this.isExporting = false;
      this.seek(this.currentTime);
    }
  }

  // --- Export WebM / MP4 Video via Canvas CaptureStream & MediaRecorder ---
  public async exportWebmVideo(
    settings: ExportSettings,
    onProgress: (info: ProgressInfo) => void
  ): Promise<Blob | null> {
    this.pause();
    this.isExporting = true;
    this.cancelExportRequested = false;

    const totalDuration = this.getTotalDuration();
    const fps = settings.fps;
    const [targetW, targetH] = getExportDimensions(settings);

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = targetW;
    exportCanvas.height = targetH;

    const exportRenderer = new THREE.WebGLRenderer({
      canvas: exportCanvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true
    });
    exportRenderer.outputColorSpace = THREE.SRGBColorSpace;
    exportRenderer.setSize(targetW, targetH, false);

    const oldVpAspect = this.material.uniforms.uViewportAspect.value;
    this.material.uniforms.uViewportAspect.value = targetW / targetH;

    // Detect supported mimeType
    const mimeTypes = [
      'video/mp4;codecs=avc1',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    let selectedMimeType = '';
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        selectedMimeType = type;
        break;
      }
    }

    if (!selectedMimeType) {
      throw new Error('当前浏览器环境不支持 MediaRecorder 视频录制');
    }

    const stream = exportCanvas.captureStream(fps);
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: selectedMimeType,
      videoBitsPerSecond: 16_000_000 // 16 Mbps high quality
    });

    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    return new Promise<Blob | null>((resolve, reject) => {
      mediaRecorder.onstop = () => {
        const fullBlob = new Blob(chunks, { type: selectedMimeType });
        this.material.uniforms.uViewportAspect.value = oldVpAspect;
        exportRenderer.dispose();
        this.isExporting = false;
        this.seek(this.currentTime);
        resolve(fullBlob);
      };

      mediaRecorder.onerror = (e) => {
        this.material.uniforms.uViewportAspect.value = oldVpAspect;
        exportRenderer.dispose();
        this.isExporting = false;
        reject(e);
      };

      mediaRecorder.start();

      const totalFrames = Math.max(1, Math.round(totalDuration * fps));
      let currentFrame = 0;

      const recordStep = () => {
        if (this.cancelExportRequested) {
          mediaRecorder.stop();
          resolve(null);
          return;
        }

        if (currentFrame >= totalFrames) {
          onProgress({
            currentFrame: totalFrames,
            totalFrames,
            percent: 100,
            statusText: '视频录制完成，正在封装文件...'
          });
          setTimeout(() => mediaRecorder.stop(), 200);
          return;
        }

        const time = currentFrame / fps;
        this.applyUniformsAtTime(time);
        exportRenderer.render(this.scene, this.camera);

        currentFrame++;
        const percent = Math.round((currentFrame / totalFrames) * 100);

        onProgress({
          currentFrame,
          totalFrames,
          percent,
          statusText: `正在录制视频画面: ${currentFrame} / ${totalFrames} 帧 (${percent}%)...`
        });

        // Pace at roughly real-time or slight microtask for smooth stream capture
        setTimeout(recordStep, 1000 / fps);
      };

      recordStep();
    });
  }

  public dispose() {
    this.pause();
    this.renderer.dispose();
    this.material.dispose();
    this.plane.geometry.dispose();
    this.placeholderTexture.dispose();
    this.textureCache.forEach((t) => t.dispose());
    this.textureCache.clear();
  }
}
