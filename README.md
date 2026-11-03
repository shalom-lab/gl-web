# ArtLens（gl-web）

基于 Three.js 与自定义着色器的图片艺术视频生成器：多图电影感特效编排、高画质 MP4（页内 ffmpeg.wasm）、无损 PNG 序列及快速 WebM 导出。

## GitHub Pages

- **Live URL**: https://shalom-lab.github.io/gl-web/
- Vite `base`：`/gl-web/`（项目站路径）
- 部署：`.github/workflows/deploy-pages.yml`（push `main` → Bun install/build → Pages）
- 仓库需在 **Settings → Pages → Build and deployment → Source: GitHub Actions** 选一次（若尚未配置）

## 本地开发

本仓库使用 Bun（见 `bun.lock`）：

```bash
bun install
bun run dev
```

生产构建：

```bash
bun run build
bun run preview
```

## 导出（MP4 / PNG / WebM）

1. **高画质 MP4（推荐）**：离线逐帧渲染 PNG → 页内 `@ffmpeg/ffmpeg`（单线程 `@ffmpeg/core`）封装 H.264 MP4（CRF 18、yuv420p、faststart）。首次加载会拉取约 30MB wasm，进度条会显示加载与编码阶段。
2. **PNG 序列 ZIP**：仅导出逐帧，可本地再用 FFmpeg。
3. **快速 WebM**：`MediaRecorder` 浏览器录制。

Vite 在 `buildStart` / `configureServer` 时把 `node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.{js,wasm}` 复制到 `public/ffmpeg/`（已 gitignore），运行时 URL 为 `/gl-web/ffmpeg/…`。

## Service Worker（缓存 wasm）

- 文件：`public/sw.js`（随 dist 发布）
- 注册：`src/main.tsx` 在生产环境以 `scope = import.meta.env.BASE_URL`（`/gl-web/`）注册，兼容 GitHub Pages 子路径
- 策略：仅对路径匹配 `/ffmpeg/ffmpeg-core.(js|wasm)` 的 GET 请求做 **CacheFirst**（cache 名 `gl-web-ffmpeg-v2`）；其余请求不拦截，避免 stale HTML/JS
- MP4 helper 为**静态导入**（避免 GitHub Pages 上对 hashed `ffmpegMp4-*.js` 的 dynamic import 失败）；`classWorkerURL` 不传，使用 Vite 重写后的打包 worker（勿用 `worker?url` 裸源文件，否则会 404 `./const.js`）
- 验证：DevTools → Application → Cache Storage，首次导出后再开一次应命中缓存

## IndexedDB 持久化

库名 `gl-web`（version 3）：

| Store | Key | 内容 |
|-------|-----|------|
| `slides` | slide `id` | 用户上传图片 blob（一份） |
| `prefs` | `app` | 非密钥 UI 状态：`sidebarWidth`、`aspectRatio`、`customAspect`、`previewZoom`、`sidebarTab`、`shaderSettings`、`timelineSettings`、`exportPrefs` |

刷新后会恢复转场/着色器参数、时间轴、侧栏宽度与导出偏好。「恢复默认」只清空 `slides`。Tokens/secrets 不进 IDB。

## 配置复制与着色器预设

- **复制配置**（侧栏底栏左侧）：当前 `transitionId` + 着色器 uniforms + 时长 + 画幅 → JSON（`kind: gl-web-shader-config`，`version: 2`）。
- **保存预设**（侧栏底栏右侧）：写入 IndexedDB `presets`（转场 + 着色器 + `timelineSettings` + `aspectRatio` / `customAspect`，不含图片）。
- **我的预设**面板（转场库上方）：应用 / **复制(副本)** / 重命名 / 删除；标题栏 **导入** / **导出** JSON（`kind: gl-web-presets`，`version: 2`）。导入始终分配新 id（追加合并）；旧 v1 文件仍可导入（无画幅字段则跳过）。应用时默认勾选「覆盖当前画幅」。

## 快捷键

| 按键 | 作用 |
|------|------|
| `Space` | 播放 / 暂停 |
| `←` / `→` | 后退 / 前进 1 秒 |
| `Home` / `End` | 跳到开头 / 结尾 |
| `[` 或 `,` | 上一张图片 |
| `]` 或 `.` | 下一张图片 |
| `Esc` | 关闭导出面板 / 对话框 |
| `Ctrl` + 滚轮 | 预览缩放 |

导出进行中关闭标签页会弹出浏览器离开确认。后台导出进度在右下角。

## 画幅

- **原图**：图库 slide 宽高比四舍五入到 0.01 后的众数；并列时取最早出现的那张。
- **自定义 a:b**：整数比例，写入 IndexedDB `prefs.customAspect`。
- 预览与导出均为 **contain / letterbox**，不拉伸。

## 风格预设

顶部 Header 与侧栏「特效」里的风格芯片共用 `src/utils/stylePresets.ts`（同一名称、同一套参数、同一高亮）。点击会写入色调 `colorTone` 与胶片类 uniforms；微调滑杆后若与任一预设不完全匹配则两边都不高亮。

### 我的预设（应用 / 同步）

- 点击预设 → 应用为基准（行背景高亮）；再点同一条 → 取消应用并恢复应用前的手动参数快照。
- 预设保存后默认不可改参数（可重命名 / 删除）；需要改已应用预设时，勾选底栏「同步修改预设」。
- 「复制配置」始终复制**当前实时**参数，不是仓库里的预设快照。

