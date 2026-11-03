# ArtLens（gl-web）

基于 Three.js 与自定义着色器的图片艺术视频生成器：多图电影感特效编排、无损逐帧 PNG 序列及高清 WebM 导出。

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

## 上传图片持久化

用户上传的图片保存在浏览器 **IndexedDB**（库名 `gl-web`，单一 object store `slides`），刷新/重载后仍可恢复；「恢复默认」会清空该存储。不使用 localStorage 存图片 blob。
