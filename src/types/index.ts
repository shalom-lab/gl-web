export interface ImageSlide {
  id: string;
  title: string;
  dataUrl: string;
  aspectRatio: number;
}

export type TransitionType = 0 | 1 | 2 | 3 | 4;

export type ColorTone = 0 | 1 | 2 | 3 | 4;

export interface ShaderSettings {
  breathIntensity: number;     // 镜头微动呼吸 (0 - 1)
  chromaticAberration: number; // 色差偏移 (0 - 1)
  fluidDistortion: number;     // 流体轻波微曲 (0 - 1)
  filmGrain: number;           // 胶片颗粒 (0 - 1)
  vignette: number;            // 电影暗角 (0 - 1)
  bloomGlow: number;           // 镜头辉光/光晕 (0 - 1)
  scanReveal: number;          // 进场扫描光显 (0 - 1)
  glitch: number;              // 细微故障风 (0 - 1)
  edgeBlur: number;            // 景深边缘虚化 (0 - 1)
  colorTone: ColorTone;        // 色调基调
  transitionId: string;        // gl-transitions 对应 ID (例如 crossfade, ripple, swirl, burn, custom)
  customGlsl?: string;         // 自定义 gl-transitions GLSL 代码
}

export interface TimelineSettings {
  slideDuration: number;      // 每张图停留时长 (秒)
  transitionDuration: number; // 转场过渡时长 (秒)
  loop: boolean;
}

export type AspectRatioPreset = '16:9' | '9:16' | '3:4' | '4:3' | '1:1';

export interface ExportSettings {
  format: 'png-zip' | 'webm-video';
  resolution: '1080p' | '720p';
  fps: 30 | 60;
  aspectRatio?: AspectRatioPreset;
}
