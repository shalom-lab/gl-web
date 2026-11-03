import { GL_TRANSITIONS_CATALOG, DEFAULT_CUSTOM_GLSL } from './glTransitions';

export const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

export function getTransitionGlsl(transitionId: string, customGlsl?: string): string {
  if (transitionId === 'custom' && customGlsl && customGlsl.trim().length > 0) {
    return customGlsl;
  }
  const found = GL_TRANSITIONS_CATALOG.find((t) => t.id === transitionId);
  return found ? found.glsl : GL_TRANSITIONS_CATALOG[0].glsl;
}

export function buildFragmentShader(transitionGlsl: string): string {
  return /* glsl */ `
  precision highp float;

  uniform sampler2D uTextureCurrent;
  uniform sampler2D uTextureNext;
  uniform float uTransition;           // 0.0 to 1.0
  uniform float uTime;
  uniform float uSlideProgress;        // 0.0 to 1.0 throughout current slide's active duration
  uniform float uViewportAspect;       // viewport width / height
  uniform float uAspectCurrent;        // current image width / height
  uniform float uAspectNext;           // next image width / height

  // Effect intensities (0.0 to 1.0)
  uniform float uBreathIntensity;
  uniform float uChromaticAberration;
  uniform float uFluidDistortion;
  uniform float uFilmGrain;
  uniform float uVignette;
  uniform float uBloomGlow;
  uniform float uScanReveal;
  uniform float uGlitch;
  uniform float uEdgeBlur;
  uniform int uColorTone;              // 0: 自然电影, 1: 暖阳金辉, 2: 冷色银幕, 3: 黑白电影, 4: 鲜润生机

  varying vec2 vUv;

  // Pseudo-random hash
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  // 2D Value Noise
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  // Aspect ratio "cover" uv correction
  vec2 getCoverUv(vec2 uv, float vpAspect, float imgAspect) {
    vec2 correctedUv = uv;
    if (vpAspect > imgAspect) {
      float scale = vpAspect / imgAspect;
      correctedUv.y = (uv.y - 0.5) * scale + 0.5;
    } else {
      float scale = imgAspect / vpAspect;
      correctedUv.x = (uv.x - 0.5) * scale + 0.5;
    }
    return correctedUv;
  }

  // Gentle Ken Burns breathing & drifting
  vec2 applyBreathing(vec2 uv, float intensity, float prog, float seed) {
    if (intensity <= 0.001) return uv;
    float zoom = 1.0 + prog * 0.06 * intensity;
    vec2 center = vec2(0.5) + vec2(sin(seed + uTime * 0.15), cos(seed * 1.5 + uTime * 0.12)) * (0.015 * intensity);
    return (uv - center) / zoom + center;
  }

  // Fluid wave distortion
  vec2 applyFluid(vec2 uv, float intensity) {
    if (intensity <= 0.001) return uv;
    float waveX = sin(uv.y * 8.0 + uTime * 1.2) * 0.008 * intensity;
    float waveY = cos(uv.x * 7.0 + uTime * 1.0) * 0.006 * intensity;
    return uv + vec2(waveX, waveY);
  }

  // Glitch offset
  vec2 applyGlitch(vec2 uv, float intensity) {
    if (intensity <= 0.001) return uv;
    float gTime = floor(uTime * 15.0);
    float gNoise = hash(vec2(gTime, floor(uv.y * 30.0)));
    if (gNoise > 0.94 - intensity * 0.2) {
      float offset = (hash(vec2(gTime * 2.0, uv.y)) - 0.5) * 0.04 * intensity;
      uv.x += offset;
    }
    return uv;
  }

  // Sample texture with Chromatic Aberration & Edge Blur
  vec4 sampleTextureWithEffects(sampler2D tex, vec2 uv, float vpAspect, float imgAspect, float prog, float seed) {
    vec2 baseUv = getCoverUv(uv, vpAspect, imgAspect);
    baseUv = applyBreathing(baseUv, uBreathIntensity, prog, seed);
    baseUv = applyFluid(baseUv, uFluidDistortion);
    baseUv = applyGlitch(baseUv, uGlitch);

    vec2 dir = baseUv - vec2(0.5);
    float dist = length(dir);

    // Chromatic Aberration
    float caOffset = (uChromaticAberration * 0.012 + uGlitch * 0.015) * dist;
    vec2 rUv = baseUv + dir * caOffset;
    vec2 gUv = baseUv;
    vec2 bUv = baseUv - dir * caOffset;

    vec4 rCol = texture2D(tex, clamp(rUv, 0.001, 0.999));
    vec4 gCol = texture2D(tex, clamp(gUv, 0.001, 0.999));
    vec4 bCol = texture2D(tex, clamp(bUv, 0.001, 0.999));

    vec4 color = vec4(rCol.r, gCol.g, bCol.b, 1.0);

    // Subtle edge blur / depth-of-field simulation
    if (uEdgeBlur > 0.01) {
      float blurFactor = smoothstep(0.3, 0.8, dist) * uEdgeBlur * 0.008;
      vec4 blurColor = vec4(0.0);
      blurColor += texture2D(tex, clamp(baseUv + vec2(blurFactor, 0.0), 0.0, 1.0));
      blurColor += texture2D(tex, clamp(baseUv - vec2(blurFactor, 0.0), 0.0, 1.0));
      blurColor += texture2D(tex, clamp(baseUv + vec2(0.0, blurFactor), 0.0, 1.0));
      blurColor += texture2D(tex, clamp(baseUv - vec2(0.0, blurFactor), 0.0, 1.0));
      blurColor *= 0.25;
      color = mix(color, blurColor, smoothstep(0.35, 0.75, dist) * uEdgeBlur);
    }

    return color;
  }

  // ==========================================
  // Standard gl-transitions API Compatibility
  // ==========================================
  #define progress uTransition
  #define ratio uViewportAspect

  vec4 getFromColor(vec2 uv) {
    return sampleTextureWithEffects(uTextureCurrent, uv, uViewportAspect, uAspectCurrent, uSlideProgress, 1.0);
  }

  vec4 getToColor(vec2 uv) {
    return sampleTextureWithEffects(uTextureNext, uv, uViewportAspect, uAspectNext, 0.0, 2.0);
  }

  // --- GL-TRANSITION FUNCTION INJECTION ---
  ${transitionGlsl}
  // ----------------------------------------

  void main() {
    vec2 uv = vUv;
    vec4 baseColor;

    if (uTransition <= 0.0) {
      baseColor = getFromColor(uv);
    } else if (uTransition >= 1.0) {
      baseColor = getToColor(uv);
    } else {
      baseColor = transition(uv);
    }

    vec4 finalColor = baseColor;

    // --- 显现效果: 进场光扫 / 淡入 (Scan Reveal) ---
    if (uScanReveal > 0.01 && uSlideProgress < 0.3) {
      float revealProgress = uSlideProgress / 0.3; // 0 to 1
      float scanX = uv.x;
      float scanLine = smoothstep(revealProgress - 0.15, revealProgress + 0.15, scanX);
      float scanGlow = max(0.0, 1.0 - abs(scanX - revealProgress) / 0.12) * uScanReveal * 0.5;
      float alphaFade = smoothstep(0.0, 0.25, revealProgress);
      finalColor.rgb = mix(finalColor.rgb * alphaFade, finalColor.rgb, 1.0 - scanLine);
      finalColor.rgb += vec3(0.9, 0.95, 1.0) * scanGlow;
    }

    // --- 镜头光晕 / 高光微辉光 (Bloom / Lens Flare) ---
    if (uBloomGlow > 0.01) {
      float lum = dot(finalColor.rgb, vec3(0.299, 0.587, 0.114));
      float highlight = max(0.0, lum - 0.65) / 0.35;
      vec3 warmBloom = vec3(1.0, 0.92, 0.78) * highlight * uBloomGlow * 0.35;
      float streak = exp(-abs(uv.y - 0.5) * 20.0) * max(0.0, lum - 0.5) * uBloomGlow * 0.15;
      finalColor.rgb += warmBloom + vec3(streak * 0.8, streak * 0.9, streak * 1.0);
    }

    // --- 色调基调 (Color Tone Grading) ---
    if (uColorTone == 1) {
      finalColor.r *= 1.12;
      finalColor.g *= 1.02;
      finalColor.b *= 0.86;
    } else if (uColorTone == 2) {
      finalColor.r *= 0.92;
      finalColor.g *= 0.98;
      finalColor.b *= 1.15;
    } else if (uColorTone == 3) {
      float gray = dot(finalColor.rgb, vec3(0.299, 0.587, 0.114));
      gray = smoothstep(0.05, 0.95, gray);
      finalColor.rgb = vec3(gray);
    } else if (uColorTone == 4) {
      float lum = dot(finalColor.rgb, vec3(0.299, 0.587, 0.114));
      finalColor.rgb = mix(vec3(lum), finalColor.rgb, 1.25);
    }

    // --- 暗角 (Vignette) ---
    if (uVignette > 0.01) {
      vec2 vigCoord = (uv - 0.5) * vec2(1.0, 1.0 / (uViewportAspect > 0.0 ? uViewportAspect : 1.0));
      float vigDist = length(vigCoord);
      float vig = smoothstep(0.75, 0.35, vigDist * (1.1 + uVignette * 0.6));
      finalColor.rgb *= mix(1.0, vig, uVignette * 0.85);
    }

    // --- 颗粒胶片 (Cinematic Film Grain) ---
    if (uFilmGrain > 0.01) {
      float grain = (hash(uv * 400.0 + fract(uTime * 43.12)) - 0.5);
      float lum = dot(finalColor.rgb, vec3(0.299, 0.587, 0.114));
      float grainMask = (1.0 - abs(lum - 0.5) * 1.6);
      finalColor.rgb += vec3(grain * uFilmGrain * 0.14 * max(0.2, grainMask));
    }

    gl_FragColor = vec4(clamp(finalColor.rgb, 0.0, 1.0), 1.0);
  }
`;
}
