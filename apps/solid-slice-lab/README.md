# 当当老师 · 立体切割实验室

独立地址：https://dangdanglaoshi.cn/solid-slice-lab/

小屋右侧“游戏”列表可以直接进入；页头“返回小屋”回到首页。

保留原版正方体、3—6 棱柱和棱锥、角度输入、切面平移、切割分离与视角控制。点击 2 个顶点锁定切面轴线，拖动角度时保持经过这 2 点；点击第 3 个非共线顶点确定切面。切换形状与清除选择可以重新操作。

本版本使用当当老师 Logo 和动漫头像，移除旧版照片及其他品牌背景。所有图片和 Three.js 都内嵌到构建结果，不依赖外部 CDN。

## 启动与发布

Node.js 22.13+：

```sh
npm install
npm run dev
npm run build
npm test
```

`npm run build` 输出仓库 `site/solid-slice-lab/index.html`，也可复制这个 HTML 后直接双击打开。`npm test` 使用同仓库 geometry-board 已安装的 Playwright，对实际构建运行浏览器检查。

`index.html`：页面与样式；`main.ts`：Three.js 场景、截面计算和顶点锁定；`assets/`：当当老师品牌图片；`browser.test.cjs`：桌面、手机、离线及入口检查。
