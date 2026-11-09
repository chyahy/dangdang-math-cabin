# 当当老师《数学王国：运算攻城战》美术资产

## 独立数学游戏封面

- 成品完整路径：`C:/Users/25963/Documents/Codex/2026-09-08/gei/work/dangdang-math-cabin/site/portal-assets/game-mathkingdom.webp`。
- 用途：网站游戏广场中数学运算攻城战的独立封面；不是运行时 UI 截图。
- 显示资源：960 × 600，48 色 RGB，无损 WebP，27,724 bytes。
- 原生工作基准：320 × 200。导出先 NEAREST 下采样至工作基准，使用 MEDIANCUT 上限 48 色、`Dither.NONE` 限定调色板，再 NEAREST 严格 3 倍放大；已逐像素检查每个 3 × 3 显示块完全同色，防止抗锯齿混色。
- 生成工具：OpenAI 内置 `image_gen.imagegen`，`transparent_background: false`。未调用外部付费 API 或 CLI。
- 原始生成图：`C:/Users/25963/.codex/generated_images/01a19678-fe57-7940-901b-6302dfcecf9c/exec-77b94fe2-1a95-4f69-a851-987aadb32164.png`，1586 × 992。
- 角色参考：用户提供的 `C:/Users/25963/AppData/Local/Temp/codex-clipboard-4eb108e0-5ba5-48d3-a66d-7745a0742544.png`；仅用于短剑盾兵、绿兜帽弓箭手、战锤大盾金边重骑士三个角色家族与像素轮廓参考，没有复制其中文说明或羊皮纸设定图排版。
- 环境参考：本项目先前原创的 `apps/word-kingdom/public/art/landscape-pixel-v2.webp`；沿用天空、青绿远山、分层森林和水平草土路的像素配色。
- 目视检查：红蓝双城、绿兜帽长弓手、短剑小盾兵、方头战锤与大盾重骑士均清晰；四个悬浮木牌为 `+`、`−`、`×`、`÷`，没有 ABC、中文、标题、按钮、血条或其他 UI。
- 质量限制：封面为说明游戏主题的独立原创插画，不是逐帧精灵表，也不保证每个装饰细节与运行时单位完全相同。960 × 600 是 320 × 200 的整数像素放大，不能按平滑插值进一步放大。
- 创建与检查日期：2026-11-09。英文游戏的原有封面和美术文件没有覆盖或修改。

### 完整生成提示词

```text
Create an independent ORIGINAL MATH kingdom tower-defense game cover in authentic low-resolution PIXEL ART. Logical native canvas 320 x 200 pixels, shown at integer4x pixel scale1280x800, aspect8:5, later to display960x600. Input image1 is the user-provided character design reference: use ONLY its three clear character families and bold pixel sprite look, NOT the parchment layout or any Chinese headings or UI. Input image2 supplies this project's original pixel landscape palette, forest and teal mountain layers. Scene: a warm-gray stone castle with RED tiled pointed roofs on left, a cool-gray stone castle with BLUE pointed roofs on right, bright sky-blue upper backdrop, layered teal mountain valley and emerald woodland, flat green field and one horizontal ochre dirt road across lower foreground. Center a small readable group of chibi pixel soldiers moving toward the opposing team: short sword-and-small-shield foot soldiers with steel helmet/blue plume and simple navy tunic; GREEN HOODED archers with wooden longbows and quivers; and sturdy heavy armored knights with ornate GOLD EDGING, RED helmet plume/cape, a chunky WAR HAMMER and LARGE SHIELD. Knight visibly bulkier than foot soldier, archer slim and agile. Preserve characteristic family silhouettes from provided reference, deliberately original details, no commercial-game characters. Two small teams with red/blue accents are fine; keep figures true tiny sprite proportions with head about one-third total height, simple dark face slit, no detailed anime portraits. Each hammer must visibly have a square heavy head, not sword. Castles occupy outer20%, troop action middle55%, full important silhouette readability, no impacts, injury or gore. Above soldiers in open sky, FOUR small floating wooden pixel plaques, each bearing exactly ONE clean chunky cream math symbol: + then − then × then ÷. The minus is a horizontal bar; multiplication a diagonal cross; division a horizontal bar with one dot above and one dot below. NO A B C, NO letters or words, NO numbers or equations. Art must be truly manually-authored-looking hard pixel clusters: thick dark1-to-2 logical pixel outlines, stepped contours, limited cohesive48-color palette, simple3-shade ramps, flat-color areas, neat block highlights and shadows. No antialias, no smooth gradients, no blur, no painterly strokes, no realistic textures, no 3D render, no smooth picture with pixelation filter. No Chinese, no titles, no UI, no buttons, no HP bars, no menus, no parchment layout, no logo or watermark, no frame. A beautiful original retro fantasy MATH attack-and-defense cover, not a screenshot from an existing game.
```

## 独立背景副本

- 数学游戏路径：`C:/Users/25963/Documents/Codex/2026-09-08/gei/work/dangdang-math-cabin/apps/math-kingdom/public/math-pixel/landscape.webp`。
- 来源：本仓库已有原创像素背景 `apps/word-kingdom/public/art/landscape-pixel-v2.webp` 的独立文件副本；未修改英文原图，运行时不需要从英文游戏目录取资源。
- 规格：640 × 150，31 色，无损 WebP，21,348 bytes。复制后已用 SHA-256 对比，确认内容与既有原创图一致。
- 道路主体位于第 128–132 行，脚底基线中心约第 130 行，即画面高度 86.7%（约 87%）。
- 原始生成与裁切记录保存在 `apps/word-kingdom/ART_ASSETS.md` 的“原创复古像素版 v2”章节；数学游戏使用的是已导出的独立副本，没有重新生成或改变内容。
- 使用时关闭画布图像平滑，或为图片设置 `image-rendering: pixelated`；不保证左右边缘无缝平铺，应整张展示。
