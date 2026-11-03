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
| `prefs` | `app` | 非密钥 UI 状态：`sidebarWidth`、`aspectRatio`、`sidebarTab`、`shaderSettings`、`timelineSettings`、`exportPrefs` |

刷新后会恢复转场/着色器参数、时间轴、侧栏宽度与导出偏好。「恢复默认」只清空 `slides`。Tokens/secrets 不进 IDB。

## 配置复制与着色器预设

- **复制配置**（侧栏底栏左侧）：当前 `transitionId` + 着色器 uniforms + 时长设置 → JSON（`kind: gl-web-shader-config`）。
- **保存预设**（侧栏底栏右侧）：写入 IndexedDB `presets`（转场 + 着色器 + `timelineSettings` 时长，不含图片）。
- **我的预设**面板（转场库上方）：应用 / **复制(副本)** / 重命名 / 删除；标题栏 **导入** / **导出** JSON（`kind: gl-web-presets`）。导入始终分配新 id（追加合并）。

