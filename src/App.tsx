import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  AspectRatioPreset,
  ExportFormat,
  ExportPrefs,
  ExportSettings,
  ImageSlide,
  ShaderSettings,
  TimelineSettings
} from './types';
import { getDefaultImageSlides } from './utils/proceduralImages';
import {
  clearUploadedSlides,
  clampPreviewZoom,
  clampSidebarWidth,
  DEFAULT_EXPORT_PREFS,
  DEFAULT_PREVIEW_ZOOM,
  DEFAULT_SIDEBAR_WIDTH,
  loadAppPrefs,
  loadUploadedSlides,
  PREVIEW_ZOOM_MAX,
  PREVIEW_ZOOM_MIN,
  PREVIEW_ZOOM_STEP,
  saveAppPrefs,
  saveUploadedSlides,
  type SidebarTab
} from './utils/imageStore';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { RendererEngine, ProgressInfo, snapshotExportState } from './core/rendererEngine';
import { Header } from './components/Header';
import { TimelineControl } from './components/TimelineControl';
import { RightSidebar } from './components/RightSidebar';
import { ExportModal } from './components/ExportModal';
import { ExportJobChip, type ExportJobState } from './components/ExportJobChip';
import { GL_TRANSITIONS_CATALOG, DEFAULT_CUSTOM_GLSL } from './shaders/glTransitions';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<RendererEngine | null>(null);

  // Gallery slides — hydrated from IndexedDB when a durable upload exists
  const [slides, setSlides] = useState<ImageSlide[]>([]);
  const [slidesReady, setSlidesReady] = useState(false);

  // Aspect ratio presets
  const [aspectRatio, setAspectRatio] = useState<AspectRatioPreset>('16:9');

  // Active right sidebar tab: 'transitions' | 'effects' | 'slides'
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('transitions');

  // Resizable sidebar width (px) — hydrated from IndexedDB prefs
  const [sidebarWidth, setSidebarWidth] = useState<number>(DEFAULT_SIDEBAR_WIDTH);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [prefsReady, setPrefsReady] = useState(false);
  /** Preview stage visual zoom (CSS scale); persisted in IDB prefs. */
  const [previewZoom, setPreviewZoom] = useState<number>(DEFAULT_PREVIEW_ZOOM);
  const previewPaneRef = useRef<HTMLDivElement | null>(null);

  // Shader effect settings (Default tuned for subtle, cinematic, filmic feel)
  const [shaderSettings, setShaderSettings] = useState<ShaderSettings>({
    breathIntensity: 0.35,
    chromaticAberration: 0.15,
    fluidDistortion: 0.12,
    filmGrain: 0.22,
    vignette: 0.35,
    bloomGlow: 0.25,
    scanReveal: 0.30,
    glitch: 0.0,
    edgeBlur: 0.18,
    colorTone: 0,
    transitionId: 'crossfade',
    customGlsl: DEFAULT_CUSTOM_GLSL
  });

  // Timeline settings (Default: 4s per photo, 1.2s transition)
  const [timelineSettings, setTimelineSettings] = useState<TimelineSettings>({
    slideDuration: 4.0,
    transitionDuration: 1.2,
    loop: true
  });

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Export State — modal is config-only; job runs in background with snapshotted data
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false);
  const [exportPrefs, setExportPrefs] = useState<ExportPrefs>(DEFAULT_EXPORT_PREFS);
  const [exportJob, setExportJob] = useState<ExportJobState | null>(null);
  const exportEngineRef = useRef<RendererEngine | null>(null);
  const exportToastTimerRef = useRef<number | null>(null);
  const [exportToast, setExportToast] = useState<string | null>(null);

  // Restore gallery + full UI prefs from IndexedDB (one durable copy) before engine init
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [stored, prefs] = await Promise.all([loadUploadedSlides(), loadAppPrefs()]);
      if (cancelled) return;
      if (prefs?.sidebarWidth != null) {
        setSidebarWidth(clampSidebarWidth(prefs.sidebarWidth));
      }
      if (prefs?.aspectRatio) setAspectRatio(prefs.aspectRatio);
      if (prefs?.sidebarTab) setSidebarTab(prefs.sidebarTab);
      if (prefs?.shaderSettings) setShaderSettings(prefs.shaderSettings);
      if (prefs?.timelineSettings) setTimelineSettings(prefs.timelineSettings);
      if (prefs?.exportPrefs) setExportPrefs(prefs.exportPrefs);
      if (prefs?.previewZoom != null) setPreviewZoom(clampPreviewZoom(prefs.previewZoom));
      setSlides(stored && stored.length > 0 ? stored : getDefaultImageSlides());
      setSlidesReady(true);
      setPrefsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist non-secret UI prefs (debounced) — one durable copy under prefs key `app`
  useEffect(() => {
    if (!prefsReady) return;
    const timer = window.setTimeout(() => {
      void saveAppPrefs({
        sidebarWidth,
        aspectRatio,
        sidebarTab,
        shaderSettings,
        timelineSettings,
        exportPrefs,
        previewZoom
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [
    sidebarWidth,
    aspectRatio,
    sidebarTab,
    shaderSettings,
    timelineSettings,
    exportPrefs,
    previewZoom,
    prefsReady
  ]);

  // Initialize Three.js WebGL Engine after slides are ready
  useEffect(() => {
    if (!slidesReady || !canvasRef.current) return;

    const engine = new RendererEngine(
      canvasRef.current,
      slides,
      shaderSettings,
      timelineSettings
    );
    engineRef.current = engine;

    engine.setOnTimeUpdate((time) => {
      setCurrentTime(time);
      setIsPlaying(engine.isPlaying);
    });

    // Auto-start play for instant visual feedback
    engine.play();
    setIsPlaying(true);

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once when slidesReady flips true
  }, [slidesReady]);

  // Resize observer to update WebGL viewport when container dimensions change
  useEffect(() => {
    if (!containerRef.current) return;

    const handleResize = () => {
      if (engineRef.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        engineRef.current.updateViewportSize(rect.width, rect.height);
      }
    };

    const observer = new ResizeObserver(() => {
      handleResize();
    });

    observer.observe(containerRef.current);
    handleResize();

    return () => observer.disconnect();
  }, [aspectRatio]);

  // Sync slides to engine
  const handleSlidesChange = useCallback((newSlides: ImageSlide[]) => {
    setSlides(newSlides);
    engineRef.current?.setSlides(newSlides);
  }, []);

  // Sync shader settings to engine
  const handleShaderChange = useCallback((newSettings: ShaderSettings) => {
    setShaderSettings(newSettings);
    engineRef.current?.updateShaderSettings(newSettings);
  }, []);

  // Sync timeline settings to engine
  const handleTimelineChange = useCallback((newSettings: TimelineSettings) => {
    setTimelineSettings(newSettings);
    engineRef.current?.updateTimelineSettings(newSettings);
  }, []);

  // Playhead seeking
  const handleSeek = (time: number) => {
    engineRef.current?.seek(time);
    setCurrentTime(time);
  };

  const handleTogglePlay = () => {
    if (engineRef.current) {
      engineRef.current.togglePlay();
      setIsPlaying(engineRef.current.isPlaying);
    }
  };

  const handleToggleLoop = () => {
    handleTimelineChange({
      ...timelineSettings,
      loop: !timelineSettings.loop
    });
  };

  // Slide navigation
  const period = timelineSettings.slideDuration + timelineSettings.transitionDuration;
  const currentSlideIndex =
    slides.length > 0 ? Math.floor(currentTime / period) % slides.length : 0;

  const handleSelectSlide = (index: number) => {
    const targetTime = index * period;
    handleSeek(targetTime);
  };

  const handlePrevSlide = () => {
    const prevIndex = (currentSlideIndex - 1 + slides.length) % slides.length;
    handleSelectSlide(prevIndex);
  };

  const handleNextSlide = () => {
    const nextIndex = (currentSlideIndex + 1) % slides.length;
    handleSelectSlide(nextIndex);
  };

  // Replace single slide with user file — persist gallery to IndexedDB
  const handleReplaceSlide = (index: number, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const aspect = img.width / img.height;
        const newSlides = [...slides];
        newSlides[index] = {
          ...newSlides[index],
          title: file.name.replace(/\.[^/.]+$/, ''),
          dataUrl,
          aspectRatio: aspect
        };
        handleSlidesChange(newSlides);
        void saveUploadedSlides(newSlides).catch((err) => {
          console.warn('保存上传图片失败:', err);
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Batch upload any number of images — persist one durable copy in IndexedDB
  const handleBatchUpload = (files: FileList) => {
    const fileArray = Array.from(files);
    const promises = fileArray.map((file, i) => {
      return new Promise<ImageSlide>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          const img = new Image();
          img.onload = () => {
            resolve({
              id: `user_slide_${Date.now()}_${i}`,
              title: `${i + 1}. ${file.name.replace(/\.[^/.]+$/, '')}`,
              dataUrl,
              aspectRatio: img.width / img.height
            });
          };
          img.src = dataUrl;
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(promises).then((newUploadedSlides) => {
      handleSlidesChange(newUploadedSlides);
      handleSeek(0);
      void saveUploadedSlides(newUploadedSlides).catch((err) => {
        console.warn('保存上传图片失败:', err);
      });
    });
  };

  const handleResetDefault = () => {
    const defaults = getDefaultImageSlides();
    handleSlidesChange(defaults);
    handleSeek(0);
    void clearUploadedSlides();
  };

  // Style Presets
  const handleApplyPreset = (presetName: string) => {
    let newShader = { ...shaderSettings };
    if (presetName === 'cinematic') {
      newShader = {
        ...newShader,
        breathIntensity: 0.35,
        chromaticAberration: 0.15,
        fluidDistortion: 0.12,
        filmGrain: 0.22,
        vignette: 0.35,
        bloomGlow: 0.25,
        scanReveal: 0.30,
        glitch: 0.0,
        edgeBlur: 0.18,
        colorTone: 0,
        transitionId: 'crossfade'
      };
    } else if (presetName === 'warm') {
      newShader = {
        ...newShader,
        breathIntensity: 0.4,
        chromaticAberration: 0.1,
        fluidDistortion: 0.08,
        filmGrain: 0.28,
        vignette: 0.42,
        bloomGlow: 0.45,
        scanReveal: 0.2,
        glitch: 0.0,
        edgeBlur: 0.22,
        colorTone: 1,
        transitionId: 'burn'
      };
    } else if (presetName === 'nordic') {
      newShader = {
        ...newShader,
        breathIntensity: 0.25,
        chromaticAberration: 0.18,
        fluidDistortion: 0.16,
        filmGrain: 0.15,
        vignette: 0.28,
        bloomGlow: 0.2,
        scanReveal: 0.4,
        glitch: 0.0,
        edgeBlur: 0.15,
        colorTone: 2,
        transitionId: 'directionalwarp'
      };
    } else if (presetName === 'noir') {
      newShader = {
        ...newShader,
        breathIntensity: 0.3,
        chromaticAberration: 0.05,
        fluidDistortion: 0.05,
        filmGrain: 0.45,
        vignette: 0.55,
        bloomGlow: 0.15,
        scanReveal: 0.25,
        glitch: 0.0,
        edgeBlur: 0.25,
        colorTone: 3,
        transitionId: 'fade'
      };
    } else if (presetName === 'clean') {
      newShader = {
        ...newShader,
        breathIntensity: 0.0,
        chromaticAberration: 0.0,
        fluidDistortion: 0.0,
        filmGrain: 0.0,
        vignette: 0.0,
        bloomGlow: 0.0,
        scanReveal: 0.0,
        glitch: 0.0,
        edgeBlur: 0.0,
        colorTone: 0,
        transitionId: 'crossfade'
      };
    }
    handleShaderChange(newShader);
  };

  // Fullscreen
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleSeek(Math.max(0, currentTime - 1.0));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleSeek(Math.min(engineRef.current?.getTotalDuration() || 10, currentTime + 1.0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime]);

  // Handle draggable splitter between left preview and right sidebar
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      setSidebarWidth(clampSidebarWidth(newWidth));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Preview the newly selected transition immediately
  const handlePreviewTransition = () => {
    if (engineRef.current) {
      // Seek to 0.4s before transition starts, and play!
      const target = Math.max(0, timelineSettings.slideDuration - 0.4);
      handleSeek(target);
      engineRef.current.play();
      setIsPlaying(true);
    }
  };

  const showExportToast = useCallback((message: string) => {
    setExportToast(message);
    if (exportToastTimerRef.current != null) {
      window.clearTimeout(exportToastTimerRef.current);
    }
    exportToastTimerRef.current = window.setTimeout(() => setExportToast(null), 3200);
  }, []);

  const downloadExportBlob = useCallback((blob: Blob, format: ExportSettings['format']) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download =
      format === 'mp4-wasm'
        ? 'artlens_video.mp4'
        : format === 'png-zip'
          ? 'artlens_frames.zip'
          : 'artlens_video.webm';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }, []);

  // Background export: snapshot slides/settings, offscreen engine, non-blocking UI
  const handleStartExport = useCallback(
    async (settings: ExportSettings) => {
      if (exportJob?.status === 'running') {
        showExportToast('已有导出任务在进行中');
        return;
      }

      setExportPrefs({
        format: settings.format,
        resolution: settings.resolution,
        fps: settings.fps
      });
      setExportModalOpen(false);

      const snap = snapshotExportState(slides, shaderSettings, timelineSettings);
      const settingsWithAspect: ExportSettings = {
        ...settings,
        aspectRatio: settings.aspectRatio ?? aspectRatio
      };

      const exporter = RendererEngine.createOffscreenExporter(
        snap.slides,
        snap.shaderSettings,
        snap.timelineSettings
      );
      exportEngineRef.current = exporter;

      setExportJob({
        status: 'running',
        progress: {
          currentFrame: 0,
          totalFrames: 100,
          percent: 0,
          statusText: '正在准备导出快照与渲染器…'
        },
        resultBlob: null,
        resultType: null,
        minimized: false
      });

      const onProgress = (info: ProgressInfo) => {
        setExportJob((prev) =>
          prev && prev.status === 'running' ? { ...prev, progress: info } : prev
        );
      };

      try {
        await exporter.ensureTexturesLoaded();
        let blob: Blob | null = null;
        if (settingsWithAspect.format === 'mp4-wasm') {
          blob = await exporter.exportMp4ViaFfmpeg(settingsWithAspect, onProgress);
        } else if (settingsWithAspect.format === 'png-zip') {
          blob = await exporter.exportPngSequence(settingsWithAspect, onProgress);
        } else {
          blob = await exporter.exportWebmVideo(settingsWithAspect, onProgress);
        }

        if (blob) {
          setExportJob({
            status: 'done',
            progress: {
              currentFrame: 0,
              totalFrames: 0,
              percent: 100,
              statusText: '导出完成'
            },
            resultBlob: blob,
            resultType: settingsWithAspect.format,
            minimized: false
          });
          downloadExportBlob(blob, settingsWithAspect.format);
          showExportToast('导出成功，文件已开始下载');
        } else {
          setExportJob({
            status: 'cancelled',
            progress: null,
            resultBlob: null,
            resultType: null,
            minimized: false
          });
          showExportToast('已取消导出');
        }
      } catch (err: any) {
        console.error('Export error:', err);
        const msg = err?.message || '未知错误';
        if (msg === '用户取消了导出') {
          setExportJob({
            status: 'cancelled',
            progress: null,
            resultBlob: null,
            resultType: null,
            minimized: false
          });
          showExportToast('已取消导出');
        } else {
          setExportJob({
            status: 'error',
            progress: null,
            resultBlob: null,
            resultType: null,
            errorMessage: msg,
            minimized: false
          });
          showExportToast('导出失败: ' + msg);
        }
      } finally {
        try {
          exporter.dispose();
        } catch {
          /* ignore */
        }
        if (exportEngineRef.current === exporter) {
          exportEngineRef.current = null;
        }
      }
    },
    [
      exportJob?.status,
      slides,
      shaderSettings,
      timelineSettings,
      aspectRatio,
      downloadExportBlob,
      showExportToast
    ]
  );

  const handleCancelExport = useCallback(() => {
    exportEngineRef.current?.cancelExport();
    void import('./utils/ffmpegMp4')
      .then((m) => m.terminateFfmpeg())
      .catch(() => {});
  }, []);

  const handleDismissExportJob = useCallback(() => {
    setExportJob(null);
  }, []);

  const handleToggleExportMinimize = useCallback(() => {
    setExportJob((prev) => (prev ? { ...prev, minimized: !prev.minimized } : prev));
  }, []);

  const handleDownloadExportJob = useCallback(() => {
    if (!exportJob?.resultBlob || !exportJob.resultType) return;
    downloadExportBlob(exportJob.resultBlob, exportJob.resultType);
  }, [exportJob, downloadExportBlob]);

  const handleExportPrefsChange = useCallback((prefs: ExportPrefs) => {
    setExportPrefs(prefs);
  }, []);

  const zoomIn = useCallback(() => {
    setPreviewZoom((z) => clampPreviewZoom(z + PREVIEW_ZOOM_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    setPreviewZoom((z) => clampPreviewZoom(z - PREVIEW_ZOOM_STEP));
  }, []);

  const zoomReset = useCallback(() => {
    setPreviewZoom(DEFAULT_PREVIEW_ZOOM);
  }, []);

  // Ctrl/Meta + wheel over the preview pane adjusts zoom
  useEffect(() => {
    const pane = previewPaneRef.current;
    if (!pane) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -PREVIEW_ZOOM_STEP : PREVIEW_ZOOM_STEP;
      setPreviewZoom((z) => clampPreviewZoom(z + delta));
    };
    pane.addEventListener('wheel', onWheel, { passive: false });
    return () => pane.removeEventListener('wheel', onWheel);
  }, [slidesReady]);

  const totalDuration = engineRef.current?.getTotalDuration() || 52;

  // Aspect ratio css classes for the left viewport
  const aspectClass = useMemo(() => {
    switch (aspectRatio) {
      case '16:9':
        return 'aspect-video max-w-5xl max-h-[72vh]';
      case '9:16':
        return 'aspect-[9/16] max-w-sm max-h-[72vh]';
      case '3:4':
        return 'aspect-[3/4] max-w-md max-h-[72vh]';
      case '4:3':
        return 'aspect-[4/3] max-w-2xl max-h-[72vh]';
      case '1:1':
        return 'aspect-square max-w-lg max-h-[72vh]';
      default:
        return 'aspect-video max-w-5xl max-h-[72vh]';
    }
  }, [aspectRatio]);

  if (!slidesReady) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-100 text-zinc-600 text-sm">
        正在加载图片…
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col h-screen w-screen bg-zinc-100 text-zinc-900 font-sans select-none overflow-hidden ${
        isDragging ? 'cursor-col-resize select-none' : ''
      }`}
    >
      {/* Top Header */}
      <Header
        aspectRatio={aspectRatio}
        onAspectRatioChange={setAspectRatio}
        onApplyPreset={handleApplyPreset}
        onOpenExport={() => setExportModalOpen(true)}
        onToggleFullscreen={handleToggleFullscreen}
      />

      {/* Main Workspace: Left (Preview + Timeline) / Right (Controls Sidebar) */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        {/* === LEFT: PREVIEW & TIMELINE STAGE === */}
        <section className="flex-1 min-w-0 flex flex-col h-full bg-zinc-200/50">
          {/* Preview pane: stage + top-right zoom controls (outside the canvas) */}
          <div
            ref={previewPaneRef}
            className="flex-1 min-h-0 flex items-center justify-center p-3 sm:p-5 relative overflow-auto"
          >
            {/* Zoom controls — top-right of preview pane (outside stage) */}
            <div className="absolute top-3 right-3 z-20 flex items-center gap-0.5 rounded-lg border border-zinc-300/80 bg-white/95 backdrop-blur-xs shadow-sm p-0.5">
              <button
                type="button"
                onClick={zoomOut}
                disabled={previewZoom <= PREVIEW_ZOOM_MIN}
                title="缩小 (Ctrl + 滚轮)"
                className="p-1.5 rounded-md text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={zoomReset}
                title="重置为 100%"
                className="min-w-[3.25rem] px-1.5 py-1 rounded-md text-[11px] font-mono font-semibold tabular-nums text-zinc-800 hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                {Math.round(previewZoom * 100)}%
              </button>
              <button
                type="button"
                onClick={zoomIn}
                disabled={previewZoom >= PREVIEW_ZOOM_MAX}
                title="放大 (Ctrl + 滚轮)"
                className="p-1.5 rounded-md text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <div className="w-px h-4 bg-zinc-200 mx-0.5" />
              <button
                type="button"
                onClick={zoomReset}
                title="适应 / 重置缩放"
                className="p-1.5 rounded-md text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div
              ref={containerRef}
              style={{
                transform: `scale(${previewZoom})`,
                transformOrigin: 'center center'
              }}
              className={`relative w-full ${aspectClass} rounded-xl overflow-hidden bg-zinc-950 shadow-md border border-zinc-300/80 flex items-center justify-center transition-transform duration-150`}
            >
              {/* Three.js WebGL Canvas */}
              <canvas
                ref={canvasRef}
                className="w-full h-full block cursor-pointer"
                onClick={handleTogglePlay}
                title="点击画面暂停/播放"
              />

              {/* Minimal non-intrusive status overlay badge in corner */}
              <div className="absolute top-3 left-3 px-2 py-1 rounded bg-black/40 backdrop-blur-xs text-white/90 text-[11px] font-mono pointer-events-none flex items-center gap-2">
                <span>
                  [{String(currentSlideIndex + 1).padStart(2, '0')} / {slides.length}]
                </span>
                <span>{slides[currentSlideIndex]?.title}</span>
              </div>

              <div className="absolute top-3 right-3 px-2 py-1 rounded bg-black/40 backdrop-blur-xs text-white/80 text-[10px] font-mono pointer-events-none">
                WebGL Shader 实时渲染
              </div>
            </div>
          </div>

          {/* Timeline Transport Bar docked directly under canvas */}
          <TimelineControl
            currentTime={currentTime}
            totalDuration={totalDuration}
            isPlaying={isPlaying}
            loop={timelineSettings.loop}
            slides={slides}
            slideDuration={timelineSettings.slideDuration}
            transitionDuration={timelineSettings.transitionDuration}
            currentTransitionName={
              GL_TRANSITIONS_CATALOG.find((t) => t.id === shaderSettings.transitionId)?.name || '自定义 GLSL'
            }
            onOpenTransitionsTab={() => setSidebarTab('transitions')}
            onTogglePlay={handleTogglePlay}
            onSeek={handleSeek}
            onToggleLoop={handleToggleLoop}
            onPrevSlide={handlePrevSlide}
            onNextSlide={handleNextSlide}
          />
        </section>

        {/* === DRAGGABLE SPLITTER DIVIDER HANDLE === */}
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDoubleClick={() => setSidebarWidth(DEFAULT_SIDEBAR_WIDTH)}
          title="左右拖拽调节控制面板宽度 (双击重置为 440px)"
          className={`relative z-20 w-3 shrink-0 -mx-1.5 cursor-col-resize group flex items-center justify-center transition-colors select-none ${
            isDragging ? 'bg-amber-500/20' : 'bg-transparent hover:bg-zinc-300/40'
          }`}
        >
          <div
            className={`w-1 h-12 rounded-full transition-all flex flex-col items-center justify-center gap-0.5 ${
              isDragging ? 'bg-amber-500 scale-y-125' : 'bg-zinc-300 group-hover:bg-zinc-500'
            }`}
          >
            <div className="w-0.5 h-0.5 bg-white/80 rounded-full" />
            <div className="w-0.5 h-0.5 bg-white/80 rounded-full" />
            <div className="w-0.5 h-0.5 bg-white/80 rounded-full" />
          </div>
        </div>

        {/* === RIGHT: DEDICATED CONTROL & INSPECTOR SIDEBAR === */}
        <RightSidebar
          activeTab={sidebarTab}
          onTabChange={setSidebarTab}
          slides={slides}
          currentSlideIndex={currentSlideIndex}
          onSelectSlide={handleSelectSlide}
          onReplaceSlide={handleReplaceSlide}
          onBatchUpload={handleBatchUpload}
          onResetDefault={handleResetDefault}
          shaderSettings={shaderSettings}
          onUpdateShader={handleShaderChange}
          timelineSettings={timelineSettings}
          onUpdateTimeline={handleTimelineChange}
          totalDuration={totalDuration}
          width={sidebarWidth}
          onOpenExport={() => setExportModalOpen(true)}
          onPreviewTransition={handlePreviewTransition}
        />
      </div>

      {/* Export config modal (non-blocking once started) */}
      <ExportModal
        isOpen={exportModalOpen}
        isBusy={exportJob?.status === 'running'}
        totalDuration={totalDuration}
        aspectRatio={aspectRatio}
        initialPrefs={exportPrefs}
        onClose={() => setExportModalOpen(false)}
        onStartExport={(s) => void handleStartExport(s)}
        onPrefsChange={handleExportPrefsChange}
      />

      {/* Corner progress / result chip */}
      {exportJob && (
        <ExportJobChip
          job={exportJob}
          onCancel={handleCancelExport}
          onToggleMinimize={handleToggleExportMinimize}
          onDismiss={handleDismissExportJob}
          onDownload={handleDownloadExportJob}
        />
      )}

      {exportToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] px-4 py-2 rounded-full bg-zinc-900 text-white text-xs font-medium shadow-lg pointer-events-none">
          {exportToast}
        </div>
      )}
    </div>
  );
}
