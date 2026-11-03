export interface GLTransitionDef {
  id: string;
  name: string;
  category: 'cinematic' | 'motion' | 'fluid' | 'art';
  author?: string;
  description: string;
  glsl: string;
}

export const GL_TRANSITIONS_CATALOG: GLTransitionDef[] = [
  // --- 用户特别要求的 GL-Transitions ---
  {
    id: 'papertear',
    name: '撕纸裂开 (PaperTear)',
    category: 'art',
    author: 'gl-transitions',
    description: '带有粗糙撕边质感的不规则锯齿纸张撕裂过渡。',
    glsl: /* glsl */ `
vec4 transition(vec2 uv) {
  float tearNoise = sin(uv.y * 32.0) * 0.018 + sin(uv.y * 74.0) * 0.009 + sin(uv.y * 135.0) * 0.005;
  float edge = progress * 1.08 - 0.04 + tearNoise;
  float shadow = smoothstep(0.0, 0.015, uv.x - edge) * (1.0 - smoothstep(0.015, 0.035, uv.x - edge));
  if (uv.x < edge) {
    return getToColor(uv);
  } else {
    vec4 fromCol = getFromColor(uv);
    return mix(fromCol, vec4(0.0, 0.0, 0.0, 1.0), shadow * 0.45);
  }
}
`
  },
  {
    id: 'circleopen',
    name: '圆形光圈绽放 (CircleOpen)',
    category: 'cinematic',
    author: 'gre',
    description: '电影镜头式圆形光圈从中心优雅绽放显现。',
    glsl: /* glsl */ `
vec4 transition(vec2 uv) {
  vec2 center = vec2(0.5);
  vec2 p = uv - center;
  p.x *= ratio;
  float d = length(p);
  float maxRadius = length(vec2(0.5 * ratio, 0.5));
  float r = progress * maxRadius * 1.05;
  float edge = smoothstep(r - 0.02, r + 0.01, d);
  float glow = max(0.0, 1.0 - abs(d - r) / 0.03) * 0.25;
  vec4 res = mix(getToColor(uv), getFromColor(uv), edge);
  return res + vec4(vec3(glow), 0.0);
}
`
  },
  {
    id: 'directionalwipe',
    name: '方向性斜角擦除 (DirectionalWipe)',
    category: 'motion',
    author: 'gl-transitions',
    description: '沿对角线方向平滑扫除过渡，边缘柔和自然。',
    glsl: /* glsl */ `
vec4 transition(vec2 uv) {
  vec2 direction = vec2(1.0, -1.0);
  vec2 v = normalize(direction);
  v /= abs(v.x) + abs(v.y);
  float d = v.x * (uv.x - 0.5) + v.y * (uv.y - 0.5);
  float m = smoothstep(-0.15, 0.0, d - progress * 2.0 + 1.0);
  return mix(getFromColor(uv), getToColor(uv), m);
}
`
  },
  {
    id: 'doorway',
    name: '大门推开推入 (Doorway)',
    category: 'motion',
    author: 'gre',
    description: '前图如大门般向两侧拉开展开，后图自深处推入。',
    glsl: /* glsl */ `
vec4 transition(vec2 uv) {
  float p = progress;
  vec2 pfr = vec2(-1.0), pto = vec2(-1.0);
  float split = 2.0 * abs(uv.x - 0.5);
  if (uv.x < 0.5) {
    pfr = vec2(uv.x / (1.0 - p * 0.5 + 0.0001), (uv.y - 0.5) / (1.0 - (1.0 - uv.x * 2.0) * p * 0.3 + 0.0001) + 0.5);
  } else {
    pfr = vec2((uv.x - p * 0.5) / (1.0 - p * 0.5 + 0.0001), (uv.y - 0.5) / (1.0 - ((uv.x - 0.5) * 2.0) * p * 0.3 + 0.0001) + 0.5);
  }
  pto = (uv - 0.5) * (1.0 - (1.0 - p) * 0.25) + 0.5;
  if (pfr.x < 0.0 || pfr.x > 1.0 || pfr.y < 0.0 || pfr.y > 1.0) {
    return getToColor(pto);
  }
  return mix(getFromColor(pfr), getToColor(pto), smoothstep(0.2, 0.8, p));
}
`
  },
  {
    id: 'swap',
    name: '3D 双卡片置换 (Swap)',
    category: 'motion',
    author: 'alexisrolland',
    description: '前后两张画卷在 3D 空间中一前一后交错滑动置换。',
    glsl: /* glsl */ `
vec4 transition(vec2 uv) {
  float p = progress;
  float depth = 3.0;
  float size1 = mix(1.0, depth, p);
  float size2 = mix(depth, 1.0, p);
  vec2 p1 = (uv - vec2(0.5 - (1.0 - p) * 0.5, 0.5)) * size1 + 0.5;
  vec2 p2 = (uv - vec2(0.5 + p * 0.5, 0.5)) * size2 + 0.5;
  bool in1 = (p1.x >= 0.0 && p1.x <= 1.0 && p1.y >= 0.0 && p1.y <= 1.0);
  bool in2 = (p2.x >= 0.0 && p2.x <= 1.0 && p2.y >= 0.0 && p2.y <= 1.0);
  if (p < 0.5) {
    if (in1) return getFromColor(p1);
    if (in2) return getToColor(p2);
  } else {
    if (in2) return getToColor(p2);
    if (in1) return getFromColor(p1);
  }
  return vec4(0.08, 0.08, 0.1, 1.0);
}
`
  },
  {
    id: 'wind',
    name: '疾风拂面拉条 (Wind)',
    category: 'motion',
    author: 'Ferry Zhou',
    description: '如同轻风刮过画面产生横向速度细微流线擦除。',
    glsl: /* glsl */ `
vec4 transition(vec2 uv) {
  float size = 0.22;
  float r = hash(vec2(0.0, floor(uv.y * 120.0) / 120.0));
  float m = smoothstep(0.0, -size, uv.x * (1.0 - size) + size * r - (progress * (1.0 + size)));
  return mix(getFromColor(uv), getToColor(uv), m);
}
`
  },
  {
    id: 'horizonopen',
    name: '水平幕帘拉开 (HorizonOpen)',
    category: 'cinematic',
    author: 'gl-transitions',
    description: '画卷如左右对称的舞台帷幕向两侧拉开显现。',
    glsl: /* glsl */ `
vec4 transition(vec2 uv) {
  float dist = abs(uv.x - 0.5);
  float open = progress * 0.52;
  if (dist < open) {
    return getToColor(uv);
  } else {
    float shadow = smoothstep(0.0, 0.02, dist - open) * (1.0 - smoothstep(0.02, 0.07, dist - open));
    vec4 c = getFromColor(uv);
    return mix(c, vec4(0.0, 0.0, 0.0, 1.0), shadow * 0.55);
  }
}
`
  },
  {
    id: 'verticalopenclose',
    name: '垂直上下开合 (VerticalOpenClose)',
    category: 'cinematic',
    author: 'gl-transitions',
    description: '上下遮幅如快门般由中心向外打开，富有电影感。',
    glsl: /* glsl */ `
vec4 transition(vec2 uv) {
  float dist = abs(uv.y - 0.5);
  float open = progress * 0.52;
  if (dist < open) {
    return getToColor(uv);
  } else {
    float shadow = smoothstep(0.0, 0.02, dist - open) * (1.0 - smoothstep(0.02, 0.07, dist - open));
    return mix(getFromColor(uv), vec4(0.0, 0.0, 0.0, 1.0), shadow * 0.55);
  }
}
`
  },
  {
    id: 'gridflip',
    name: '网格矩阵翻转 (GridFlip)',
    category: 'art',
    author: 'miibun',
    description: '画面分割为矩阵方格卡片，依次立体翻转转变为下一张。',
    glsl: /* glsl */ `
vec4 transition(vec2 uv) {
  vec2 size = vec2(6.0, 4.0);
  vec2 p = uv * size;
  vec2 cell = floor(p);
  vec2 cellUv = fract(p);
  float delay = (cell.x + cell.y) / (size.x + size.y) * 0.55;
  float cellProgress = clamp((progress - delay) / 0.45, 0.0, 1.0);
  float angle = cellProgress * 3.14159;
  float cosA = cos(angle);
  float x = (cellUv.x - 0.5) / (abs(cosA) + 0.001) + 0.5;
  if (x < 0.0 || x > 1.0) {
    return vec4(0.06, 0.07, 0.1, 1.0);
  }
  vec2 mappedUv = (cell + vec2(x, cellUv.y)) / size;
  vec4 col = (cellProgress < 0.5) ? getFromColor(mappedUv) : getToColor(mappedUv);
  float shadow = (1.0 - abs(cosA)) * 0.4;
  return mix(col, vec4(0.0, 0.0, 0.0, 1.0), shadow);
}
`
  },
  {
    id: 'cylinderroll',
    name: '圆柱体卷动 (CylinderRoll)',
    category: 'motion',
    author: 'gl-transitions',
    description: '如同圆柱卷轴横向滚过画面，带有柱面高光反光。',
    glsl: /* glsl */ `
vec4 transition(vec2 uv) {
  float radius = 0.15;
  float rollX = uv.x - (progress * 1.3 - 0.15);
  if (rollX < -radius) {
    return getToColor(uv);
  } else if (rollX > radius) {
    return getFromColor(uv);
  } else {
    float angle = asin(clamp(rollX / radius, -1.0, 1.0));
    vec2 warpedUv = vec2(uv.x + cos(angle) * radius * 0.35, uv.y);
    vec4 col = (rollX < 0.0) ? getToColor(warpedUv) : getFromColor(warpedUv);
    float highlight = max(0.0, cos(angle)) * 0.3;
    return col + vec4(vec3(highlight), 0.0);
  }
}
`
  },
  {
    id: 'waterdrop',
    name: '水滴入水涟漪 (WaterDrop)',
    category: 'fluid',
    author: 'Paolo Brandoli',
    description: '一颗清澈水滴坠落湖面，向外扩散层层环形微澜。',
    glsl: /* glsl */ `
vec4 transition(vec2 uv) {
  vec2 p = uv - vec2(0.5);
  p.x *= ratio;
  float d = length(p);
  if (d < progress * 1.4) {
    float wave = sin(d * 32.0 - progress * 16.0) * (1.0 - progress) * 0.038;
    vec2 dir = normalize(p);
    vec2 distUv = uv + dir * wave;
    return mix(getFromColor(distUv), getToColor(distUv), smoothstep(0.0, 1.0, progress));
  }
  return getFromColor(uv);
}
`
  },
  {
    id: 'multiplyblend',
    name: '正片叠底曝光 (MultiplyBlend)',
    category: 'cinematic',
    author: 'gl-transitions',
    description: '前后两张艺术画卷以正片叠底深度融合，呈现暗房光影。',
    glsl: /* glsl */ `
vec4 transition(vec2 uv) {
  vec4 from = getFromColor(uv);
  vec4 to = getToColor(uv);
  vec4 multiplied = from * to * 1.5;
  float p1 = smoothstep(0.0, 0.5, progress);
  float p2 = smoothstep(0.5, 1.0, progress);
  vec4 step1 = mix(from, multiplied, p1);
  return mix(step1, to, p2);
}
`
  },
  {
    id: 'zoomincircles',
    name: '同心圆同轴缩放 (ZoomInCircles)',
    category: 'art',
    author: 'Fernando Serrano',
    description: '交错的同心圆环带同时扩张并变焦缩放。',
    glsl: /* glsl */ `
vec4 transition(vec2 uv) {
  vec2 p = uv - vec2(0.5);
  p.x *= ratio;
  float d = length(p);
  float circles = 12.0;
  float ring = mod(floor(d * circles - progress * 5.0), 2.0);
  float t = smoothstep(0.0, 1.0, progress);
  if (ring == 0.0) {
    vec2 zoomed = (uv - 0.5) * (1.0 + (1.0 - progress) * 0.18) + 0.5;
    return mix(getFromColor(zoomed), getToColor(uv), t);
  } else {
    vec2 zoomed2 = (uv - 0.5) * (1.0 - progress * 0.15) + 0.5;
    return mix(getFromColor(uv), getToColor(zoomed2), t);
  }
}
`
  },
  {
    id: 'invertedpagecurl',
    name: '卷页翻书折叠 (InvertedPageCurl)',
    category: 'art',
    author: 'gl-transitions',
    description: '画卷如同古典书页自右下角自然翻起翻卷。',
    glsl: /* glsl */ `
vec4 transition(vec2 uv) {
  const float MIN_AMOUNT = -0.15;
  const float MAX_AMOUNT = 1.35;
  float amount = progress * (MAX_AMOUNT - MIN_AMOUNT) + MIN_AMOUNT;
  const float cylinderRadius = 0.14;
  vec2 dir = normalize(vec2(1.0, 1.0));
  float d = dot(uv, dir);
  if (d < amount - cylinderRadius) {
    return getToColor(uv);
  } else if (d > amount + cylinderRadius) {
    return getFromColor(uv);
  } else {
    float theta = asin(clamp((d - amount) / cylinderRadius, -1.0, 1.0));
    vec2 curlUv = uv + dir * (cos(theta) * cylinderRadius * 0.5);
    vec4 base = (d < amount) ? getToColor(curlUv) : getFromColor(curlUv);
    float highlight = cos(theta) * 0.35;
    return base + vec4(vec3(highlight), 0.0);
  }
}
`
  },

  // --- 经典必备基础预设 ---
  {
    id: 'crossfade',
    name: '电影柔和溶解 (Crossfade)',
    category: 'cinematic',
    author: 'gl-transitions',
    description: '最经典的平滑电影溶解，带有微妙的曝光平滑过渡。',
    glsl: /* glsl */ `
vec4 transition(vec2 uv) {
  vec4 from = getFromColor(uv);
  vec4 to = getToColor(uv);
  float bump = sin(progress * 3.14159) * 0.08;
  return mix(from, to, progress) + vec4(bump);
}
`
  },
  {
    id: 'fade',
    name: '经典暗场淡入淡出 (Fade)',
    category: 'cinematic',
    author: 'gl-transitions',
    description: '画面渐隐至深黑/微光，然后平滑显现下一张。',
    glsl: /* glsl */ `
vec4 transition(vec2 uv) {
  vec4 from = getFromColor(uv);
  vec4 to = getToColor(uv);
  vec3 fadeColor = vec3(0.05, 0.05, 0.08);
  return mix(
    mix(from, vec4(fadeColor, 1.0), smoothstep(0.0, 0.5, progress)),
    to,
    smoothstep(0.5, 1.0, progress)
  );
}
`
  },
  {
    id: 'burn',
    name: '胶片菲林过曝燃烧 (Film Burn)',
    category: 'art',
    author: 'gre',
    description: '带有金色火光与有机噪波的胶片过曝边缘消融。',
    glsl: /* glsl */ `
vec4 transition(vec2 uv) {
  float n = noise(uv * 7.0 + vec2(progress * 2.0, 0.0));
  float b = progress * 1.3 - n * 0.3;
  float edge = smoothstep(b - 0.1, b + 0.1, 0.5);
  vec4 blended = mix(getFromColor(uv), getToColor(uv), 1.0 - edge);
  float flame = exp(-abs(b - 0.5) * 8.0);
  vec3 flameColor = vec3(1.0, 0.72, 0.3) * flame * 0.9;
  return blended + vec4(flameColor, 0.0);
}
`
  },
  {
    id: 'ripple',
    name: '水波同心涟漪 (Ripple)',
    category: 'fluid',
    author: 'gre',
    description: '从中心向外扩散的水面同心波澜，柔和扭曲。',
    glsl: /* glsl */ `
vec4 transition(vec2 uv) {
  vec2 p = uv - vec2(0.5);
  float d = length(p);
  float ripple = sin(d * 25.0 - progress * 15.0) * (1.0 - progress) * 0.035;
  vec2 distUv = uv + (p / (d + 0.0001)) * ripple;
  return mix(getFromColor(distUv), getToColor(distUv), smoothstep(0.0, 1.0, progress));
}
`
  },
  {
    id: 'swirl',
    name: '漩涡流光吸入 (Swirl)',
    category: 'fluid',
    author: 'Sergey Kosarevsky',
    description: '画面中心如银河漩涡般盘旋扭曲，渐变为下一张。',
    glsl: /* glsl */ `
vec4 transition(vec2 uv) {
  float radius = 1.0;
  float angle = 6.0 * (1.0 - progress);
  vec2 p = uv - vec2(0.5);
  p.x *= ratio;
  float d = length(p);
  if (d < radius) {
    float percent = (radius - d) / radius;
    float theta = percent * percent * angle;
    float s = sin(theta);
    float c = cos(theta);
    p = vec2(dot(p, vec2(c, -s)), dot(p, vec2(s, c)));
  }
  p.x /= ratio;
  vec2 warpedUv = p + vec2(0.5);
  return mix(getFromColor(warpedUv), getToColor(warpedUv), progress);
}
`
  },
  {
    id: 'displacement',
    name: '噪点纹理置换 (Displacement)',
    category: 'art',
    author: 'gre',
    description: '水墨颗粒质感置换扭曲，呈现写意画卷般的过渡。',
    glsl: /* glsl */ `
vec4 transition(vec2 uv) {
  float n = noise(uv * 10.0);
  vec2 disp = vec2(cos(n * 6.28), sin(n * 6.28)) * (1.0 - progress) * progress * 0.15;
  return mix(getFromColor(uv + disp), getToColor(uv - disp), progress);
}
`
  },
  {
    id: 'linearblur',
    name: '动态推镜模糊 (Linear Blur)',
    category: 'motion',
    author: 'gre',
    description: '快速变焦与线性运动模糊，常用于短片快节奏切换。',
    glsl: /* glsl */ `
vec4 transition(vec2 uv) {
  vec4 c1 = vec4(0.0);
  vec4 c2 = vec4(0.0);
  float disp = (1.0 - progress) * 0.06;
  for (int i = 0; i < 8; i++) {
    float offset = (float(i) / 7.0 - 0.5) * disp;
    c1 += getFromColor(uv + vec2(offset, 0.0));
    c2 += getToColor(uv - vec2(offset, 0.0));
  }
  c1 /= 8.0;
  c2 /= 8.0;
  return mix(c1, c2, progress);
}
`
  },
  {
    id: 'glitchmemories',
    name: '胶片记忆轻度故障 (Glitch Memories)',
    category: 'art',
    author: 'Flashram',
    description: '微妙的水平撕裂错位与色彩通道分离，具有复古录像带美感。',
    glsl: /* glsl */ `
vec4 transition(vec2 uv) {
  vec2 block = floor(uv * 16.0);
  vec2 uvNoise = block / 16.0;
  float n = hash(uvNoise);
  vec2 dist = vec2(0.0);
  if (n < progress * 1.5 && n > progress * 0.3) {
    dist = vec2((hash(vec2(n, progress)) - 0.5) * 0.05, 0.0);
  }
  vec4 c1 = getFromColor(uv + dist);
  vec4 c2 = getToColor(uv - dist);
  return mix(c1, c2, smoothstep(0.0, 1.0, progress));
}
`
  },
  {
    id: 'kaleidoscope',
    name: '万花筒碎片折射 (Kaleidoscope)',
    category: 'art',
    author: 'nwoeanh',
    description: '折射万花筒反射碎片，将画面拆解重构为下一幅景象。',
    glsl: /* glsl */ `
vec4 transition(vec2 uv) {
  vec2 p = uv - 0.5;
  float r = length(p);
  float a = atan(p.y, p.x);
  float sides = 6.0;
  float tau = 6.2831853;
  a = mod(a, tau / sides);
  a = abs(a - tau / sides / 2.0);
  p = r * vec2(cos(a), sin(a)) + 0.5;
  vec2 warpedUv = mix(uv, p, sin(progress * 3.14159) * 0.4);
  return mix(getFromColor(warpedUv), getToColor(warpedUv), progress);
}
`
  },
  {
    id: 'flyeye',
    name: '复眼多棱镜透视 (Flyeye)',
    category: 'art',
    author: 'gre',
    description: '昆虫复眼多棱镜般的矩阵折射显现。',
    glsl: /* glsl */ `
vec4 transition(vec2 uv) {
  float size = 0.08;
  vec2 inv = vec2(1.0) / vec2(size);
  vec2 p = (floor(uv * inv) + 0.5) / inv;
  vec2 disp = (uv - p) * (1.0 - progress) * 2.0;
  return mix(getFromColor(uv + disp), getToColor(uv - disp), progress);
}
`
  }
];

export const DEFAULT_CUSTOM_GLSL = /* glsl */ `// 欢迎粘贴来自 https://gl-transitions.com 的任意 GLSL 转场函数代码！
// 系统已为你注入：
// - getFromColor(vec2 uv): 采样当前画面（含完整美学 Shader）
// - getToColor(vec2 uv): 采样下一张画面
// - progress: 0.0 ~ 1.0（当前转场进度）
// - ratio: 视口宽高比

vec4 transition(vec2 uv) {
  // 示例：对角线光晕推拉擦除
  float p = uv.x + uv.y;
  float edge = smoothstep(progress * 2.0 - 0.1, progress * 2.0 + 0.1, p);
  float glow = max(0.0, 1.0 - abs(p - progress * 2.0) / 0.1) * 0.4;
  vec4 col = mix(getToColor(uv), getFromColor(uv), edge);
  return col + vec4(vec3(glow), 0.0);
}
`;
