# 星空入口与数学游戏广场

依据用户选择的第 3 张星空方案制作，沿用当当老师 Logo、动漫形象、夜色小屋与蓝金色数学展台。

## 路径

- `/`：轻量入口选择页。此页不创建 canvas、iframe，也不请求 Three.js 或小屋场景。
- `/cabin.html`：原来的完整 3D 小屋，物品、史莱姆、人物、第一人称与手机操作保留；菜单增加返回入口和游戏广场。
- `/games/`：12 个数学互动页面的图文列表；分类为数与运算、图形与几何。
- `/play/?game=slice`：在同源 iframe 中打开已有游戏，顶部保留返回广场、独立打开和进入小屋。分类写入 URL 并在返回时保留。
- 已有游戏的独立地址保持有效。直接打开游戏时，现有“回到小屋”链接返回 `/cabin.html`。

所有路径采用相对项目根目录，兼容自定义域名及 GitHub Pages 的仓库子目录。

## 修改与构建

```powershell
node apps/portal/build.mjs
node --test apps/portal/portal.test.mjs
node apps/solid-geometry/serve.cjs
```

本地入口为 `http://127.0.0.1:4186/`。这是现有静态站点的扩展，不需要新框架、依赖安装或后端。

- `entry.html`、`games.html`、`play.html`：页面模板。
- `catalog.mjs`：游戏名称、简介、分类、封面和原地址。
- `portal.css`：深蓝星空、金蓝按钮、桌面与手机布局。
- `portal.mjs`：分类与游戏容器导航；仅从白名单选择游戏地址。
- `game-return.js`：独立游戏的返回兼容。
- `build.mjs`：生成静态页、发布 JS/CSS，并幂等地安装返回兼容脚本。
- `design-reference.png`：用户选中的视觉目标。
- `site/portal-assets/`：压缩 WebP 素材、既有品牌素材与图标。

**重建任何独立游戏后，再执行一次 `node apps/portal/build.mjs`**，以补回生成 HTML 的返回兼容脚本。小屋的编辑源现在是 `site/cabin.html`，不要用旧版小屋覆盖 `site/index.html`。

## 图片与验证

入口页试用银河视频背景（2026-11-04）：`site/portal-assets/galaxy-background-v1.mp4`，来自用户提供的视频，完整约 25 秒，转成 1280×720 H.264 静音 MP4，约 1.1 MB，并将播放索引移至文件头。原始 4K 文件未修改。

视频在首屏图片加载后才请求，静音循环、手机内联播放；右上角可切换回原静态星空。页面隐藏时暂停，播放失败、节省流量或减少动态效果偏好下使用原图。此试用仅作用于入口页，独立提交便于撤回。

夜色小屋、数学展台、星空背景和 12 张游戏封面使用内置 Image Gen 按选定方案分别生成，转为 WebP；品牌图和头像复用原站素材。图片按 8:5 裁切显示，列表首屏后懒加载。

图标复用仓库中已有的 Lucide 线性图标库，许可证位于 `site/portal-assets/ICON-LICENSE.txt`。画面与交互验收见 [design-qa.md](design-qa.md)。
