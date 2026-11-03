export interface GLTransitionDef {
  id: string;
  name: string;
  category: 'cinematic' | 'motion' | 'fluid' | 'art';
  author?: string;
  description: string;
  glsl: string;
}

export const GL_TRANSITIONS_CATALOG: GLTransitionDef[] = [
  // --- 官方 gl-transitions 忠实移植（uniforms 固化为 const 默认值） ---
  {
    id: 'papertear',
    name: '撕纸裂开 (PaperTear)',
    category: 'art',
    author: 'gre',
    description: '带有粗糙撕边质感的不规则锯齿纸张撕裂过渡。',
    glsl: /* glsl */ `
const float roughness = 0.12;
// @range(0, 0.5) How much the top of each half leans away first, so that the tear opens from the top
const float tilt = 0.1;
// @range(0, 0.05) Width of the white torn edge, relative to the image height
const float rim = 0.012;
// @color Color of the paper fibers on the torn edges
const vec4 paper = vec4(1.0, 0.98, 0.94, 1.0);
// @color Color of the shadow cast on the incoming image
const vec4 shadow = vec4(0.0, 0.0, 0.0, 0.35);

float tri (float x) {
  return abs(fract(x) - 0.5) - 0.25;
}

// horizontal position of the tear at height y: smooth meanders...
float meander (float y) {
  return 0.5 * ratio + roughness * (0.5 * sin(y * 4.7 + 1.3) + 0.25 * sin(y * 11.3 + 4.1));
}

// ...and sharp jags
float tear (float y) {
  return meander(y) + roughness * (0.1 * sin(y * 29.0 + 0.7) + 0.35 * tri(y * 19.0 + sin(y * 7.0)) + 0.12 * tri(y * 47.0 + 0.6 * sin(y * 13.0)));
}

// width of the torn edge along it, so that the fibers look uneven
float fibers (float y, float seed) {
  return rim * (0.7 + 0.3 * sin(y * 37.0 + seed) + 0.4 * tri(y * 83.0 + seed));
}

// the left half (or the mirrored right half) slides out, its top leaning away first:
// from a point on screen to the point of the paper (the frame edges stay covered)
vec2 unfold (vec2 q, float away, float lean) {
  return vec2(q.x + away + lean * q.y, q.y);
}

// a torn half over the background, with its fibers and an anti-aliased edge
// e: distance past the torn edge, limit: how far the fibers reach, aa: edge softness
vec4 torn (vec4 bg, vec4 col, float e, float limit, float aa) {
  vec4 c = vec4(mix(col.rgb, paper.rgb, clamp(0.5 + e / aa, 0.0, 1.0) * paper.a), col.a);
  return mix(bg, c, clamp(0.5 - (e - limit) / aa, 0.0, 1.0));
}

vec4 transition (vec2 uv) {
  float p = progress;
  float away = p * p * (0.5 * ratio + 0.1 + roughness + 2.0 * rim); // far enough to leave the frame
  float lean = tilt * p * (2.0 - p);
  float fiber = smoothstep(0.0, 0.15, p); // no torn edge on the intact image
  float aa = 0.002 * fiber + 1e-6;
  vec2 q = vec2(uv.x * ratio, uv.y);
  vec2 l = unfold(q, away, lean);
  vec2 r = unfold(vec2(ratio - q.x, q.y), away, lean);
  float el = l.x - tear(l.y); // > 0 right of the left half's torn edge
  float er = r.x - (ratio - tear(r.y)); // > 0 left of the right half's torn edge
  // soft shadow of the two halves on the incoming image, cast toward the right
  vec2 sq = q - vec2(0.01, 0.0);
  float dl = unfold(sq, away, lean).x - meander(sq.y);
  float dr = unfold(vec2(ratio - sq.x, sq.y), away, lean).x - (ratio - meander(sq.y));
  vec4 to = getToColor(uv);
  float sh = shadow.a * (1.0 - smoothstep(-0.02, 0.08, min(dl, dr)));
  vec4 c = vec4(mix(to.rgb, shadow.rgb, sh), to.a);
  // the image stops at the tear; the bare paper fibers stick out a little beyond it
  if (r.x >= 0.0) {
    c = torn(c, getFromColor(vec2(1.0 - r.x / ratio, r.y)), er, fibers(r.y, 2.0) * 1.5 * fiber, aa);
  }
  if (l.x >= 0.0) {
    c = torn(c, getFromColor(vec2(l.x / ratio, l.y)), el, fibers(l.y, 0.0) * fiber, aa);
  }
  return c;
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
const float smoothness = 0.3;
// @param Open the circle; false closes it instead
const bool opening = true;

const vec2 center = vec2(0.5, 0.5);
const float SQRT_2 = 1.414213562373;

vec4 transition (vec2 uv) {
  float x = opening ? progress : 1.-progress;
  float m = smoothstep(-smoothness, 0.0, SQRT_2*distance(center, uv) - x*(1.+smoothness));
  return mix(getFromColor(uv), getToColor(uv), opening ? 1.-m : m);
}
`
  },
  {
    id: 'directionalwipe',
    name: '方向性斜角擦除 (DirectionalWipe)',
    category: 'motion',
    author: 'gre',
    description: '沿对角线方向平滑扫除过渡，边缘柔和自然。',
    glsl: /* glsl */ `
const vec2 direction = vec2(1.0, -1.0);
// @param Softness of the edge
const float smoothness = 0.5;
 
const vec2 center = vec2(0.5, 0.5);
 
vec4 transition (vec2 uv) {
  vec2 v = normalize(direction);
  v /= abs(v.x)+abs(v.y);
  float d = v.x * center.x + v.y * center.y;
  float m =
    (1.0-step(progress, 0.0)) * // there is something wrong with our formula that makes m not equals 0.0 with progress is 0.0
    (1.0 - smoothstep(-smoothness, 0.0, v.x * uv.x + v.y * uv.y - (d-0.5+progress*(1.+smoothness))));
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
const float reflection = 0.4;
// @param Amount of perspective
const float perspective = 0.4;
const float depth = 3.0;

const vec4 black = vec4(0.0); // where no image is drawn: transparent
const vec2 boundMin = vec2(0.0, 0.0);
const vec2 boundMax = vec2(1.0, 1.0);

bool inBounds (vec2 p) {
  return all(lessThan(boundMin, p)) && all(lessThan(p, boundMax));
}

vec2 project (vec2 p) {
  return p * vec2(1.0, -1.2) + vec2(0.0, -0.02);
}

vec4 bgColor (vec2 p, vec2 pto) {
  vec4 c = black;
  pto = project(pto);
  if (inBounds(pto)) {
    c += mix(black, getToColor(pto), reflection * mix(1.0, 0.0, pto.y));
  }
  return c;
}


vec4 transition (vec2 p) {
  vec2 pfr = vec2(-1.), pto = vec2(-1.);
  float middleSlit = 2.0 * abs(p.x-0.5) - progress;
  if (middleSlit > 0.0) {
    pfr = p + (p.x > 0.5 ? -1.0 : 1.0) * vec2(0.5*progress, 0.0);
    float d = 1.0/(1.0+perspective*progress*(1.0-middleSlit));
    pfr.y -= d/2.;
    pfr.y *= d;
    pfr.y += d/2.;
  }
  float size = mix(1.0, depth, 1.-progress);
  pto = (p + vec2(-0.5, -0.5)) * vec2(size, size) + vec2(0.5, 0.5);
  if (inBounds(pfr)) {
    return getFromColor(pfr);
  }
  else if (inBounds(pto)) {
    return getToColor(pto);
  }
  else {
    return bgColor(p, pto);
  }
}
`
  },
  {
    id: 'swap',
    name: '3D 双卡片置换 (Swap)',
    category: 'motion',
    author: 'gre',
    description: '前后两张画卷在 3D 空间中一前一后交错滑动置换。',
    glsl: /* glsl */ `
const float reflection = 0.4;
// @param Amount of perspective
const float perspective = 0.2;
const float depth = 3.0;
 
const vec4 black = vec4(0.0); // where no image is drawn: transparent
const vec2 boundMin = vec2(0.0, 0.0);
const vec2 boundMax = vec2(1.0, 1.0);
 
bool inBounds (vec2 p) {
  return all(lessThan(boundMin, p)) && all(lessThan(p, boundMax));
}
 
vec2 project (vec2 p) {
  return p * vec2(1.0, -1.2) + vec2(0.0, -0.02);
}
 
vec4 bgColor (vec2 p, vec2 pfr, vec2 pto) {
  vec4 c = black;
  pfr = project(pfr);
  if (inBounds(pfr)) {
    c += mix(black, getFromColor(pfr), reflection * mix(1.0, 0.0, pfr.y));
  }
  pto = project(pto);
  if (inBounds(pto)) {
    c += mix(black, getToColor(pto), reflection * mix(1.0, 0.0, pto.y));
  }
  return c;
}
 
vec4 transition(vec2 p) {
  vec2 pfr, pto = vec2(-1.);
 
  float size = mix(1.0, depth, progress);
  float persp = perspective * progress;
  pfr = (p + vec2(-0.0, -0.5)) * vec2(size/(1.0-perspective*progress), size/(1.0-size*persp*p.x)) + vec2(0.0, 0.5);
 
  size = mix(1.0, depth, 1.-progress);
  persp = perspective * (1.-progress);
  pto = (p + vec2(-1.0, -0.5)) * vec2(size/(1.0-perspective*(1.0-progress)), size/(1.0-size*persp*(0.5-p.x))) + vec2(1.0, 0.5);

  if (progress < 0.5) {
    if (inBounds(pfr)) {
      return getFromColor(pfr);
    }
    if (inBounds(pto)) {
      return getToColor(pto);
    }  
  }
  if (inBounds(pto)) {
    return getToColor(pto);
  }
  if (inBounds(pfr)) {
    return getFromColor(pfr);
  }
  return bgColor(p, pfr, pto);
}
`
  },
  {
    id: 'wind',
    name: '疾风拂面拉条 (Wind)',
    category: 'motion',
    author: 'gre',
    description: '如同轻风刮过画面产生横向速度细微流线擦除。',
    glsl: /* glsl */ `
const float size = 0.2;
// @param Wipe from right to left instead
const bool reversed = false;

float rand (vec2 co) {
  return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

vec4 transition (vec2 uv) {
  float x = reversed ? 1. - uv.x : uv.x;
  float r = rand(vec2(0, uv.y));
  float m = smoothstep(0.0, -size, x*(1.0-size) + size*r - (progress * (1.0 + size)));
  return mix(
    getFromColor(uv),
    getToColor(uv),
    m
  );
}
`
  },
  {
    id: 'horizonopen',
    name: '水平开合 (HorizontalOpen)',
    category: 'cinematic',
    author: 'martiniti',
    description: '自画面中部水平线向上下两侧拉开显现（官方 HorizontalOpen）。',
    glsl: /* glsl */ `
vec4 transition (vec2 uv) {
  
  float regress = 1.0 - progress;

  float s = 2.0 - abs((uv.y - 0.5) / (regress - 1.0)) - 2.0 * regress;
  
  return mix(
    getFromColor(uv),
    getToColor(uv),
    smoothstep(0.0, 0.5, s)
  );
}
`
  },
  {
    id: 'horizontalclose',
    name: '水平闭合 (HorizontalClose)',
    category: 'cinematic',
    author: 'martiniti',
    description: '自上与下边缘向中部水平合拢显现。',
    glsl: /* glsl */ `
vec4 transition (vec2 uv) {

  float s = 2.0 - abs((uv.y - 0.5) / (progress - 1.0)) - 2.0 * progress;
  
  return mix(
    getFromColor(uv),
    getToColor(uv),
    smoothstep(0.5, 0.0, s)
  ); 
}
`
  },
  {
    id: 'verticalopen',
    name: '垂直拉开 (VerticalOpen)',
    category: 'cinematic',
    author: 'martiniti',
    description: '自画面中部竖线向左右两侧拉开显现。',
    glsl: /* glsl */ `
vec4 transition (vec2 uv) {

  float regress = 1.0 - progress;
  float s = 2.0 - abs((uv.x - 0.5) / (regress - 1.0)) - 2.0 * regress;
  
  return mix(
    getFromColor(uv),
    getToColor(uv),
    smoothstep(0.0, 0.5, s)
  );
}
`
  },
  {
    id: 'verticalclose',
    name: '垂直闭合 (VerticalClose)',
    category: 'cinematic',
    author: 'martiniti',
    description: '自左与右边缘向中部竖向合拢显现。',
    glsl: /* glsl */ `
vec4 transition (vec2 uv) {

  float s = 2.0 - abs((uv.x - 0.5) / (progress - 1.0)) - 2.0 * progress;
  
  return mix(
    getFromColor(uv),
    getToColor(uv),
    smoothstep(0.5, 0.0, s)
  );
}
`
  },
  {
    id: 'gridflip',
    name: '网格矩阵翻转 (GridFlip)',
    category: 'art',
    author: 'TimDonselaar',
    description: '画面分割为矩阵方格卡片，依次立体翻转转变为下一张。',
    glsl: /* glsl */ `
const ivec2 size = ivec2(4, 4);
const float pause = 0.1;
const float dividerWidth = 0.05;
// @color Color behind the tiles
const vec4 bgcolor = vec4(0.0, 0.0, 0.0, 1.0);
const float randomness = 0.1;
 
float rand (vec2 co) {
  return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

float getDelta(vec2 p) {
  vec2 rectanglePos = floor(vec2(size) * p);
  vec2 rectangleSize = vec2(1.0 / vec2(size).x, 1.0 / vec2(size).y);
  float top = rectangleSize.y * (rectanglePos.y + 1.0);
  float bottom = rectangleSize.y * rectanglePos.y;
  float left = rectangleSize.x * rectanglePos.x;
  float right = rectangleSize.x * (rectanglePos.x + 1.0);
  float minX = min(abs(p.x - left), abs(p.x - right));
  float minY = min(abs(p.y - top), abs(p.y - bottom));
  return min(minX, minY);
}

float getDividerSize() {
  vec2 rectangleSize = vec2(1.0 / vec2(size).x, 1.0 / vec2(size).y);
  return min(rectangleSize.x, rectangleSize.y) * dividerWidth;
}

vec4 transition(vec2 p) {
  if(progress < pause) {
    float currentProg = progress / pause;
    float a = 1.0;
    if(getDelta(p) < getDividerSize()) {
      a = 1.0 - currentProg;
    }
    return mix(bgcolor, getFromColor(p), a);
  }
  else if(progress < 1.0 - pause){
    if(getDelta(p) < getDividerSize()) {
      return bgcolor;
    } else {
      float currentProg = (progress - pause) / (1.0 - pause * 2.0);
      vec2 q = p;
      vec2 rectanglePos = floor(vec2(size) * q);
      
      float r = rand(rectanglePos) - randomness;
      float cp = smoothstep(0.0, 1.0 - r, currentProg);
    
      float rectangleSize = 1.0 / vec2(size).x;
      float delta = rectanglePos.x * rectangleSize;
      float offset = rectangleSize / 2.0 + delta;
      
      p.x = (p.x - offset)/abs(cp - 0.5)*0.5 + offset;
      vec4 a = getFromColor(p);
      vec4 b = getToColor(p);
      
      float s = step(abs(vec2(size).x * (q.x - delta) - 0.5), abs(cp - 0.5));
      return mix(bgcolor, mix(b, a, step(cp, 0.5)), s);
    }
  }
  else {
    float currentProg = (progress - 1.0 + pause) / pause;
    float a = 1.0;
    if(getDelta(p) < getDividerSize()) {
      a = currentProg;
    }
    return mix(bgcolor, getToColor(p), a);
  }
}
`
  },
  {
    id: 'cylinderroll',
    name: '圆柱体卷动 (CylinderRoll)',
    category: 'motion',
    author: 'gre',
    description: '如同圆柱卷轴滚过画面，带运动模糊与柱面明暗。',
    glsl: /* glsl */ `
const float curvature = 0.8;
// @range(0, 1) Length of the motion blur at full speed
const float blur = 0.5;
// @range(0, 1) How much the drum darkens as it turns away
const float shading = 0.6;
// @range(0, 1) Amount of RGB split along the roll, growing with speed
const float chroma = 0.5;
// @param Roll downward instead, the incoming image coming around from above
const bool downward = false;

const int SAMPLES = 24;
// the half angle of the drum seen in the frame height, at full curvature
const float MAX_ANGLE = 1.1;
// distance from the camera to the drum's axis, in drum radii
const float DIST = 2.6;
// how much the horizontal lines arc away from the middle, per frame height squared
const float ARC = 0.12;

float cylHash(vec2 c) {
  vec2 q = fract(c * vec2(0.1031, 0.1030));
  q += dot(q, q.yx + 33.33);
  return fract((q.x + q.y) * q.x);
}

// mirrored coordinate, folded back into 0..1
float fold(float v) {
  return 1.0 - abs(1.0 - mod(v, 2.0));
}

// the strip around the drum: the outgoing image, with the incoming one below it (or above)
vec4 strip(float x, float v) {
  if (downward ? v > 1.0 : v < 0.0) {
    return getToColor(vec2(x, fold(downward ? v - 1.0 : v + 1.0)));
  }
  return getFromColor(vec2(x, fold(v)));
}

// angle on the drum seen at the projected height c (the drum has a radius of 1)
float angleAt(float c) {
  c = clamp(c, -0.98 / sqrt(DIST * DIST - 1.0), 0.98 / sqrt(DIST * DIST - 1.0));
  return asin(c * DIST / sqrt(1.0 + c * c)) - atan(c);
}

vec4 transition(vec2 uv) {
  float p = progress;
  // ease in, roll fast in the middle, ease out
  float h = 1.0 - abs(2.0 * p - 1.0); // 0 at both ends, 1 in the middle
  float e = 0.5 * h * (0.1 + 0.9 * h * h);
  float roll = p < 0.5 ? e : 1.0 - e;
  // the blur and the RGB split stay low until the peak of the roll
  float h3 = h * h * h;
  float peak = h3 * h3;

  // the frame wraps around the drum early, and unwraps to flat sooner as the incoming image settles
  float bend = curvature * (p < 0.5 ? h * (2.0 - h) : h * h * (3.0 - 2.0 * h));
  float phi = MAX_ANGLE * bend + 1e-4;
  float arcK = ARC * bend;
  // the height of the frame's edge, projected with perspective
  float edgeY = sin(phi) / (DIST - cos(phi));

  vec2 n = 2.0 * uv - 1.0;
  // the horizontal lines arc away from the middle, toward the left and right edges
  float xr = n.x * ratio;
  float yn = n.y * (1.0 + arcK * xr * xr);
  float theta = angleAt(yn * edgeY);
  // nearer parts of the drum look wider: the drum is made wide enough to fill the frame's corners
  float thetaCorner = angleAt((1.0 + arcK * ratio * ratio) * edgeY);
  float width = (DIST - 1.0) / (DIST - cos(theta));
  float zoom = (DIST - cos(thetaCorner)) / (DIST - 1.0);
  float x = 0.5 + 0.5 * n.x / (zoom * width);
  // lit from the camera: darker as the surface turns away
  float facing = (DIST * cos(theta) - 1.0)
    / sqrt(1.0 + DIST * DIST - 2.0 * DIST * cos(theta)) ;
  float light = mix(1.0, clamp(facing, 0.0, 1.0), shading);

  // position on the strip (the frame height when flat), rolling the outgoing image away
  float v = 0.5 * (theta / phi + 1.0) + (downward ? roll : -roll);
  float len = 0.5 * blur * peak;
  float split = chroma * peak;
  float jitter = cylHash(uv * 1000.0);
  vec3 color = vec3(0.0);
  vec3 weight = vec3(0.0);
  float alpha = 0.0;
  for (int i = 0; i < SAMPLES; i++) {
    float t = (float(i) + jitter) / float(SAMPLES) - 0.5;
    vec4 img = strip(x, v + t * len);
    // the channels weigh the samples differently along the roll: an RGB split
    vec3 w = vec3(max(1.0 - 4.0 * split * t, 0.0), 1.0, max(1.0 + 4.0 * split * t, 0.0));
    color += img.rgb * img.a * w;
    weight += img.a * w;
    alpha += img.a;
  }
  color = color / max(weight, vec3(1e-5));
  return vec4(color * light, alpha / float(SAMPLES));
}
`
  },
  {
    id: 'waterdrop',
    name: '水滴入水涟漪 (WaterDrop)',
    category: 'fluid',
    author: 'Paweł Płóciennik',
    description: '一颗清澈水滴坠落湖面，向外扩散层层环形微澜。',
    glsl: /* glsl */ `
const float amplitude = 30.0;
// @param Speed of the ripples
const float speed = 30.0;

vec4 transition(vec2 p) {
  vec2 dir = p - vec2(.5);
  float dist = length(dir);

  if (dist > progress) {
    return mix(getFromColor( p), getToColor( p), progress);
  } else {
    vec2 offset = dir * sin(dist * amplitude - progress * speed);
    return mix(getFromColor( p + offset), getToColor( p), progress);
  }
}
`
  },
  {
    id: 'multiplyblend',
    name: '正片叠底曝光 (MultiplyBlend)',
    category: 'cinematic',
    author: 'Fernando Kuteken',
    description: '前后两张画卷以正片叠底深度融合后淡入下一张。',
    glsl: /* glsl */ `
vec4 blend(vec4 a, vec4 b) {
  return a * b;
}

vec4 transition (vec2 uv) {
  
  vec4 blended = blend(getFromColor(uv), getToColor(uv));
  
  if (progress < 0.5)
    return mix(getFromColor(uv), blended, 2.0 * progress);
  else
    return mix(blended, getToColor(uv), 2.0 * progress - 1.0);
}
`
  },
  {
    id: 'morph',
    name: '色彩形变融合 (Morph)',
    category: 'fluid',
    author: 'paniq',
    description: '以对方颜色通道位移扭曲的形态渐变融合过渡。',
    glsl: /* glsl */ `
const float strength = 0.1;

vec4 transition(vec2 p) {
  vec4 ca = getFromColor(p);
  vec4 cb = getToColor(p);
  
  vec2 oa = (((ca.rg+ca.b)*0.5)*2.0-1.0);
  vec2 ob = (((cb.rg+cb.b)*0.5)*2.0-1.0);
  vec2 oc = mix(oa,ob,0.5)*strength;
  
  float w0 = progress;
  float w1 = 1.0-w0;
  return mix(getFromColor(p+oc*w0), getToColor(p-oc*w1), progress);
}
`
  },
  {
    id: 'zoomincircles',
    name: '同心圆同轴缩放 (ZoomInCircles)',
    category: 'art',
    author: 'dycm8009',
    description: '交错的同心圆环带同时扩张并变焦缩放。',
    glsl: /* glsl */ `
vec2 zoom(vec2 uv, float amount) {
  return 0.5 + ((uv - 0.5) * amount);	
}

vec4 transition(vec2 uv) {
  vec2 ratio2 = vec2(1.0, 1.0 / ratio);
  // TODO: some timing are hardcoded but should be one or many parameters
  // TODO: should also be able to configure how much circles
  // TODO: if() branching should be avoided when possible, prefer use of step() & other functions
  vec2 r = 2.0 * ((vec2(uv.xy) - 0.5) * ratio2);
  float pro = progress / 0.8;
  float z = pro * 0.2;
  float t = 0.0;
  if (pro > 1.0) {
    z = 0.2 + (pro - 1.0) * 5.;
    t = clamp((progress - 0.8) / 0.07, 0.0, 1.0);
  }
  if (length(r) < 0.5+z) {
    // uv = zoom(uv, 0.9 - 0.1 * pro);
  }
  else if (length(r) < 0.8+z*1.5) {
    uv = zoom(uv, 1.0 - 0.15 * pro);
    t = t * 0.5;
  }
  else if (length(r) < 1.2+z*2.5) {
    uv = zoom(uv, 1.0 - 0.2 * pro);
    t = t * 0.2;
  }
  else {
    uv = zoom(uv, 1.0 - 0.25 * pro);
  }
  return mix(getFromColor(uv), getToColor(uv), t);
}
`
  },
  {
    id: 'invertedpagecurl',
    name: '卷页翻书折叠 (InvertedPageCurl)',
    category: 'art',
    author: 'Hewlett-Packard',
    description: '画卷如同古典书页自右下角自然翻起翻卷。',
    glsl: /* glsl */ `
const float MIN_AMOUNT = -0.16;
const float MAX_AMOUNT = 1.5;

const float PI = 3.141592653589793;

const float scale = 512.0;
const float sharpness = 3.0;

const float cylinderRadius = 1.0 / PI / 2.0;

// These depend on the progress uniform and must be computed per-fragment.
// Global initializers with uniforms are invalid in GLSL ES and fail on Mesa.
float amount;
float cylinderCenter;
float cylinderAngle;

vec3 hitPoint(float hitAngle, float yc, vec3 point, mat3 rrotation)
{
        float hitPoint = hitAngle / (2.0 * PI);
        point.y = hitPoint;
        return rrotation * point;
}

vec4 antiAlias(vec4 color1, vec4 color2, float distanc)
{
        distanc *= scale;
        if (distanc < 0.0) return color2;
        if (distanc > 2.0) return color1;
        float dd = pow(1.0 - distanc / 2.0, sharpness);
        return ((color2 - color1) * dd) + color1;
}

float distanceToEdge(vec3 point)
{
        float dx = abs(point.x > 0.5 ? 1.0 - point.x : point.x);
        float dy = abs(point.y > 0.5 ? 1.0 - point.y : point.y);
        if (point.x < 0.0) dx = -point.x;
        if (point.x > 1.0) dx = point.x - 1.0;
        if (point.y < 0.0) dy = -point.y;
        if (point.y > 1.0) dy = point.y - 1.0;
        if ((point.x < 0.0 || point.x > 1.0) && (point.y < 0.0 || point.y > 1.0)) return sqrt(dx * dx + dy * dy);
        return min(dx, dy);
}

vec4 seeThrough(float yc, vec2 p, mat3 rotation, mat3 rrotation)
{
        float hitAngle = PI - (acos(clamp(yc / cylinderRadius, -1.0, 1.0)) - cylinderAngle);
        vec3 point = hitPoint(hitAngle, yc, rotation * vec3(p, 1.0), rrotation);
        if (yc <= 0.0 && (point.x < 0.0 || point.y < 0.0 || point.x > 1.0 || point.y > 1.0))
        {
            return getToColor(p);
        }

        if (yc > 0.0) return getFromColor(p);

        vec4 color = getFromColor(point.xy);
        vec4 tcolor = vec4(0.0);

        return antiAlias(color, tcolor, distanceToEdge(point));
}

vec4 seeThroughWithShadow(float yc, vec2 p, vec3 point, mat3 rotation, mat3 rrotation)
{
        float shadow = distanceToEdge(point) * 30.0;
        shadow = (1.0 - shadow) / 3.0;

        if (shadow < 0.0) shadow = 0.0; else shadow *= amount;

        vec4 shadowColor = seeThrough(yc, p, rotation, rrotation);
        shadowColor.r -= shadow;
        shadowColor.g -= shadow;
        shadowColor.b -= shadow;

        return shadowColor;
}

vec4 backside(float yc, vec3 point)
{
        vec4 color = getFromColor(point.xy);
        float gray = (color.r + color.b + color.g) / 15.0;
        gray += (8.0 / 10.0) * (pow(max(0.0, 1.0 - abs(yc / cylinderRadius)), 2.0 / 10.0) / 2.0 + (5.0 / 10.0));
        color.rgb = vec3(gray);
        return color;
}

vec4 behindSurface(vec2 p, float yc, vec3 point, mat3 rrotation)
{
        float safeAmount = amount >= 0.0 ? max(amount, 1e-4) : min(amount, -1e-4);
        float shado = (1.0 - ((-cylinderRadius - yc) / safeAmount * 7.0)) / 6.0;
        shado *= 1.0 - abs(point.x - 0.5);

        yc = (-cylinderRadius - cylinderRadius - yc);

        float hitAngle = (acos(clamp(yc / cylinderRadius, -1.0, 1.0)) + cylinderAngle) - PI;
        point = hitPoint(hitAngle, yc, point, rrotation);

        if (yc < 0.0 && point.x >= 0.0 && point.y >= 0.0 && point.x <= 1.0 && point.y <= 1.0 && (hitAngle < PI || amount > 0.5))
        {
                float dx = point.x - 0.5;
                float dy = point.y - 0.5;
                shado = 1.0 - (sqrt(dx * dx + dy * dy) / (71.0 / 100.0));
                float nyc = -yc / cylinderRadius;
                shado *= nyc * nyc * nyc;
                shado *= 0.5;
        }
        else
        {
                shado = 0.0;
        }
        vec4 to = getToColor(p);
        return vec4(to.rgb - shado, to.a);
}

vec4 transition(vec2 p) {
  amount = progress * (MAX_AMOUNT - MIN_AMOUNT) + MIN_AMOUNT;
  cylinderCenter = amount;
  cylinderAngle = 2.0 * PI * amount;

  const float angle = 100.0 * PI / 180.0;
        float c = cos(-angle);
        float s = sin(-angle);

        mat3 rotation = mat3( c, s, 0,
                                                                -s, c, 0,
                                                                -0.801, 0.8900, 1
                                                                );
        c = cos(angle);
        s = sin(angle);

        mat3 rrotation = mat3(	c, s, 0,
                                                                        -s, c, 0,
                                                                        0.98500, 0.985, 1
                                                                );

        vec3 point = rotation * vec3(p, 1.0);

        float yc = point.y - cylinderCenter;

        if (yc < -cylinderRadius)
        {
                // Behind surface
                return behindSurface(p,yc, point, rrotation);
        }

        if (yc > cylinderRadius)
        {
                // Flat surface
                return getFromColor(p);
        }

        float hitAngle = (acos(clamp(yc / cylinderRadius, -1.0, 1.0)) + cylinderAngle) - PI;

        float hitAngleMod = mod(hitAngle, 2.0 * PI);
        if ((hitAngleMod > PI && amount < 0.5) || (hitAngleMod > PI/2.0 && amount < 0.0))
        {
                return seeThrough(yc, p, rotation, rrotation);
        }

        point = hitPoint(hitAngle, yc, point, rrotation);

        if (point.x < 0.0 || point.y < 0.0 || point.x > 1.0 || point.y > 1.0)
        {
                return seeThroughWithShadow(yc, p, point, rotation, rrotation);
        }

        vec4 color = backside(yc, point);

        vec4 otherColor;
        if (yc < 0.0)
        {
                float dx2 = point.x - 0.5;
                float dy2 = point.y - 0.5;
                float shado = 1.0 - (sqrt(dx2 * dx2 + dy2 * dy2) / 0.71);
                float nyc2 = -yc / cylinderRadius;
                shado *= nyc2 * nyc2 * nyc2;
                shado *= 0.5;
                otherColor = vec4(0.0, 0.0, 0.0, shado * getToColor(p).a); // a shadow on the incoming image
        }
        else
        {
                otherColor = getFromColor(p);
        }

        color = antiAlias(color, otherColor, cylinderRadius - abs(yc));

        vec4 cl = seeThroughWithShadow(yc, p, point, rotation, rrotation);
        float dist = distanceToEdge(point);

        return antiAlias(color, cl, dist);
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
