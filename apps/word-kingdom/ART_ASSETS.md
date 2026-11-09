# 当当老师《单词王国》美术资产

当前运行版本为像素修订，旧版资源只保留作回退。

## 原生像素角色与城堡 v2

`src/scenes/art.ts` 用整数像素、扫描线填充与Bresenham线段生成Canvas纹理图集，不使用平滑矢量角色缩小冒充像素角色。

- 红蓝两队各有剑盾兵、弓箭手、重甲骑士，共6套独立图集。每帧56×40（含武器及倒地余量），站立主体约20×32像素；待机4帧、行走6帧、攻击6帧、受伤2帧、倒地4帧，共22帧。
- 城堡每帧80×96，每队4种损伤程度×4帧旗帜，共16帧；裂纹、烟尘和旗帜均为原生像素。
- 图集仅首次创建，缓存共享，最近邻采样；Sprite内部3倍显示，配合1/3相机，最终在640×150画布中逐像素呈现。模拟时钟暂停时动作冻结。
- `src/scenes/art-vector-v1.ts` 为旧版备份，没有被当前运行代码导入。按钮与奖杯也改为硬边像素造型；中文题目保持清晰的正常文字。

## 横版战场背景

- 项目资源：`public/art/landscape.webp`
- 完整路径：`C:/Users/25963/Documents/Codex/2026-09-08/gei/work/dangdang-math-cabin/apps/word-kingdom/public/art/landscape.webp`
- 用途：晴天横版词汇攻防战场；角色、左右城堡及 UI 由游戏另行绘制。
- 成品尺寸：1920 × 720，16:6，RGB WebP。
- 成品体积：145,186 bytes（约 142 KiB）。
- 生成工具：OpenAI 内置 `image_gen.imagegen`，新图生成，`transparent_background: false`；未使用 CLI 或外部付费 API。
- 原始生成图：`C:/Users/25963/.codex/generated_images/01a19678-fe57-7940-901b-6302dfcecf9c/exec-f4a1b42f-fa1c-415d-9863-b7c63fe99cb8.png`（2048 × 768）。
- 导出处理：Pillow LANCZOS 等比例缩至 1920 × 720，WebP quality 86 / method 6；仅做尺寸、格式及压缩导出，未重绘、裁剪或改变画面内容。
- 生成与检查日期：2026-11-09。

### 完整生成提示词

```text
Use case: stylized-concept. Asset type: original seamless-feeling wide side-view 2D game battlefield background for an educational English-vocabulary fantasy game for children. Create one polished panoramic landscape, target 1920 x 720 pixels, aspect ratio 16:6 (very wide and low). Art direction: original hand-painted storybook fantasy, skilled 2D game environment painting, soft gouache-like brushwork, clean readable silhouettes and rich gentle daylight, cheerful and adventurous. Scene: clear pale turquoise-blue sky with a few soft cream clouds, layered distant teal-green mountains and rolling hills, then a middle-distance mixed woodland with individually designed leafy and conifer silhouettes, and a bright green grassy open meadow foreground. Four clearly separated depth layers using atmospheric color; far mountains cool desaturated teal, forest richer emerald/olive, foreground fresh spring green with tiny restrained wildflowers and tufts. The playable ground must be horizontally FLAT and consistent across the full width. Include a single continuous almost straight HORIZONTAL grass-edged warm earth path spanning left to right in the lower foreground, centerline about 82 percent down the image, with the horizon and scenery behind it. Do NOT make a perspective road winding toward the background. This is a side-view battlefield lane where small characters can stand on one common baseline. Leave the lower leftmost 18 percent and lower rightmost 18 percent of the image especially open and uncluttered for later separately rendered castle placements; no large foreground obstacles on those places or the path. Frame mountains and trees as scenic background, avoid a dominant central tree or mountain. Thoughtful painterly texture, delicate warm sunlight from upper left, gentle shadowing, magical natural beauty without visual noise. No humans, no creatures, no characters, no castles, no towers, no buildings, no weapons, no banners, no signs, no lettering, no numbers, no UI, no frame, no logo, no watermark. Entirely original environment design, do not reference or copy any commercial game or franchise. Crisp but painterly at 1920px wide, low contrast enough behind gameplay sprites, no photographic or 3D-render look.
```

### 检查结果与使用限制

- 已目视检查：晴朗天空、青绿山脉、树林、草地和水平草土路均存在；左右近景可放置城堡；画面没有人物、城堡、文字或 UI。
- 路径在实际成图中位于高度约 84%–90% 区间，中心约 87%。若按原图比例覆盖战场，建议角色脚底基线对齐 `0.87 × 场景高度`，而非按提示词中的 82% 硬编码。
- 这是单张平面绘画，视觉上分层，未输出独立视差图层。
- “seamless-feeling”描述画面连续感；未验证左右边缘能无缝重复拼接，请将其作为一张完整背景展示。
- 原创生成资产未使用商业游戏截图或角色作为参考；风格属于通用手绘奇幻自然场景。
- WebP 为有损压缩，适合常规屏幕。更大分辨率导出应从原始 PNG 开始，避免反复压缩。

## 游戏广场封面

- 网站资源：`site/portal-assets/game-wordkingdom.webp`。
- 完整路径：`C:/Users/25963/Documents/Codex/2026-09-08/gei/work/dangdang-math-cabin/site/portal-assets/game-wordkingdom.webp`。
- 用途：当当老师网站游戏广场中《单词王国：英语词汇攻防战》的独立封面插画。
- 成品尺寸与体积：960 × 600，RGB WebP，152,588 bytes（约 149 KiB）。
- 生成工具：OpenAI 内置 `image_gen.imagegen`，`transparent_background: false`；以本项目原创 `public/art/landscape.webp` 为色彩、环境与手绘风格参考，未使用商业游戏参考图。
- 原始生成图：`C:/Users/25963/.codex/generated_images/01a19678-fe57-7940-901b-6302dfcecf9c/exec-4c6dc932-dc50-4925-a3b8-c29fe7217687.png`（1586 × 992）。
- 导出处理：Pillow LANCZOS 导出为 960 × 600，WebP quality 84 / method 6；仅调整尺寸和格式压缩，未修改画面内容。
- 检查：左红瓦暖灰城堡、右蓝顶冷灰城堡、剑盾兵、弓箭手与较大的重甲骑士、青绿山林、草土路与悬浮 `A` / `B` / `C` 木牌均清晰可辨；没有中文、按钮、HUD 或网站界面。
- 限制：封面为说明游戏主题的原创单张插画，不是运行时游戏截图，也不承诺每个角色的造型与游戏逐帧精灵完全一致。WebP 为有损导出，若需更大尺寸请使用原始 PNG。

### 封面完整生成提示词

```text
Use case: illustration-story. Asset type: original game cover illustration for a children's English vocabulary kingdom-defense game, landscape target 960 x 600 pixels, aspect 8:5. Use the supplied environment image as palette, hand-painted art-direction and setting reference, NOT as a screenshot to copy. Draw an enchanting polished original 2D storybook fantasy battle scene in cheerful daylight, with sky blue clouds, layered teal-green mountains and fresh emerald woodland. A modest warm-gray stone castle at LEFT with warm terracotta RED tiled pointed roofs and small red pennants; at RIGHT a cool-gray stone castle with BLUE pointed roofs and little blue pennants. Both castles fully recognizable and unclipped, set across a flat side-view grass-edged earth road spanning horizontally through lower-middle foreground. Between castles a small, readable handful of friendly chibi medieval fantasy soldiers—sword-and-round-shield foot soldiers, a bow archer, and one chunky heavy-armored knight—marching toward each other from opposing sides, expressive adventure-ready poses, no actual impacts or injuries. Characters head-to-body ratio about 1:2, charming deliberately designed original silhouettes, not any commercial game's characters. Make the heavy knight noticeably larger and sturdier than foot soldiers; two teams distinguished by modest red vs blue cloth accents on their costumes. Weapons are stylized medieval game equipment, no frightening aggression or gore. Three small floating wooden alphabet plaques above the central scene reading exactly A, B, C, one uppercase letter on each plaque, clearly convey English vocabulary magic. Only those 3 letters; no words, no Chinese, no logos, no extra lettering or numbers. Richly painted gouache-like textures, warm soft sunshine, deep but gentle shadows, coherent high-end 2D illustration, grounded landscape spatial depth rather than 3D render. Composition spacious and balanced: castles about outer fifths, troop action central half; no huge foreground characters obscuring whole scene. The scene should immediately read as a vocabulary kingdom-defense adventure at 380px card width. No UI, no HUD, no health bars, no button, no title, no border or frame, no watermark. Entirely original art, do not reference or copy any commercial game, character, franchise or existing game screenshot.
```


## 原创复古像素版 v2（2026-11-09）

旧版 `landscape.webp` 与 `game-wordkingdom.webp` 均保留，未覆盖。新版两项均使用 OpenAI 内置 `image_gen.imagegen`、非透明新图/定向重绘；没有使用商业游戏截图、角色或游戏资产作参考。像素轮廓、精灵造型和分层配色先由生成模型按像素艺术要求绘制，再以 NEAREST 输出至工作分辨率；并非把原先的平滑手绘图直接打马赛克。

### v2 战场背景

- 成品：`C:/Users/25963/Documents/Codex/2026-09-08/gei/work/dangdang-math-cabin/apps/word-kingdom/public/art/landscape-pixel-v2.webp`。
- 分辨率：640 × 150，原生工作尺寸；31 个实际颜色（上限 32 色调色板），无损 WebP，21,348 bytes。
- 最终生成原图：`C:/Users/25963/.codex/generated_images/01a19678-fe57-7940-901b-6302dfcecf9c/exec-ff3e013a-bea6-4a04-9af9-0c316dd1ed45.png`，1983 × 793。
- 工具没有严格按 64:15 返回宽图，因此让模型输出上下洋红技术裁切边，保证完整场景在中央横幅中。实际裁切框：`(left=89, top=212, right=1894, bottom=635)`，1805 × 423；该框去掉洋红边和少许顶部天空，保留山、林、草地、完整水平道路与路下草地。随后用 Pillow `Resampling.NEAREST` 输出 640 × 150，`MEDIANCUT` 上限 32 色、`Dither.NONE` 限定调色板，再用无损 WebP 保存；没有平滑插值、笔触重绘或加入建筑角色。
- 检查：道路主体在成品第 128–132 行，中心第 130 行，即高度 86.7%（约 87%），可与游戏角色脚底基线对齐。左右底部保留可放城堡的平坦空地；图中没有人物、建筑、文字或 UI。
- 新图在两侧边缘不保证无缝重复；请作为一张完整横版背景使用。运行时须关闭画布图像平滑，或使用 CSS `image-rendering: pixelated`，避免浏览器重新模糊放大。

#### 背景初始生成提示词

```text
Use case: stylized-concept. Make a TRULY PIXEL-NATIVE original 2D fantasy side-scrolling strategy battlefield environment, logical canvas 640 x 150 pixels, aspect ratio 64:15, shown at exact integer 4x nearest-neighbor scale (2560 x 600). A very wide, very low panorama. This must look manually authored in a pixel sprite editor by an expert, not a smooth painting with a pixelation filter. Every contour made of crisp square pixels and deliberate stepped clusters, a limited cohesive 32-color palette, flat-color ramps with 3 or 4 shades, no antialiasing, no blurred edges, no smooth gradients, no watercolor, no gouache, no brushstrokes, no photographic textures, no 3D render. World: sunny pale-blue sky with a few block-pixel white/cream clouds, several layers of cool desaturated teal distant mountain silhouettes, darker turquoise and evergreen forest layers, vivid grassy valley floor, warm ochre dirt lane. Original retro 16-bit fantasy strategy art with appealing hand-designed shapes, distinct readable depth layers, restrained tiny flowers and grass clusters. Side view horizontal battlefield: ground perfectly level. The ochre dirt path spans FULL WIDTH left-to-right as one straight horizontal band, centered at exactly 87 percent of image height (logical y130 out of 150), about 7 pixels thick with stepped grass lip above and grassy foreground below. Path must not wind into depth or tilt. Trees/mountains are behind gameplay lane, not obstacles on lane. Lower left 18 percent and lower right 18 percent must be open clear ground for separately drawn castles. Distant forest remains okay behind these areas but no foreground boulders, giant flowers or tall grass in those castle spaces. Keep path and full terrain visible, no letterboxing. Color mood: cheerful, cool teal distance / saturated green foliage / warm ochre soil, clear strong silhouette separation suitable for small original pixel soldiers. No people, no creatures, no characters, no buildings, no castles, no towers, no banners, no lettering, no numbers, no UI, no logo, no watermarks. Entirely original sprites/environment with no copied commercial game assets. Authentic deliberate hard-edged square pixel clusters are the highest priority.
```

初次输出 `exec-77ac798a-5e67-42c0-9095-bca5da137370.png` 比例不符，随后用下面的定向重绘提示得到中央画条 `exec-26f857b8-c7b0-4fe3-b25e-fb15e6a6377d.png`。这两个中间版本均未写入项目发布资源。

```text
Redraw this ORIGINAL pixel fantasy environment as a production pixel-art background strip. Important image layout: total canvas aspect 5:2, approximately 2560 x 1024. Put a SINGLE FULL-WIDTH scenic pixel-art BAND in the middle, exactly 2560 x 600 (ratio64:15), leaving completely solid pure magenta #FF00FF crop-padding above and below the band (212px above,212px below). No magenta inside the scenic band. This padded layout allows later cropping the middle band without distorting mountains or losing ground. The scenic band must have the ENTIRE composition: flat blue sky at its top, distant teal mountains in upper-middle, turquoise evergreen woodland in middle, vivid grass field below, and continuous horizontal ochre dirt road centered at 87% of THIS scenic band height; short grass below road. Scenery extends edge to edge. No road on the crop margins. Native logical pixel resolution for the band640x150 displayed4x. Compose mountains low enough to see both sky and mountains within the 150px scene. Lower left18% and lower right18% clear flat ground for future castles. Keep same world as reference but faithfully pixel-native: intentional hard square pixel clusters, stair-step silhouettes, exactly32 simple flat palette colors, no color interpolation or lighting gradients anywhere, especially sky must be ONE completely uniform flat blue tone. Grass areas use flat solid green color bands plus sparse pixel tufts, not smooth glowing gradients. No painterly brush strokes, no blur, no antialias, no glows or soft edges, no photographic grain, no 3D. Expert authored retro16bit sprite-editor look, geometric pixel clusters not a filter over a painting. Do not add people, creatures, buildings, castles, banners, letters, numbers, UI, logos or watermarks. Magenta outer margins are technical crop padding only. One horizontal scenic band, no additional variations or panels.
```

#### 背景最终定向修正提示词

```text
Precise small revision of supplied original pixel-art background. KEEP the same full width scene band with solid magenta top and bottom crop margins, same sky, mountains, trees, composition and authentic hard pixel-cluster style. Only modify the foreground layout inside scenic band: current dirt lane is too close to bottom at about91% band height. Move the perfectly straight full-width horizontal golden dirt lane UP so its CENTER is at exactly87% of scenic BAND height (not full padded image). Enlarge grassy foreground BELOW the lane accordingly to about10% band height, keeping grass ABOVE lane simple and open. Make lane about5% of scenic band height thick. The scenic band itself must retain width/height ratio64:15; magenta margins unchanged. Preserve side-view flat ground all along, leave lower outer18% unobstructed for separate castles. Other required refinement: completely flat solid sky blue tone and flat green base color bands; no smooth shading gradients anywhere. Keep only deliberately designed hard-edge pixel clusters and stepped contours, limited cohesive32-color palette, no antialiasing, no blur, no painterly strokes, no glow. Do not add any people, creatures, buildings, castles, letters, numbers or UI. This is a production native640x150 original pixel background with crop padding for output-aspect compliance.
```

### v2 游戏广场封面

- 成品：`C:/Users/25963/Documents/Codex/2026-09-08/gei/work/dangdang-math-cabin/site/portal-assets/game-wordkingdom-pixel-v2.webp`。
- 实际工作基准：320 × 200；显示资源：960 × 600（严格 3 倍 NEAREST 整数放大），48 色，无损 WebP，31,258 bytes。
- 生成原图：`C:/Users/25963/.codex/generated_images/01a19678-fe57-7940-901b-6302dfcecf9c/exec-bfa2e2ed-80fc-47fc-a9ff-423823f52e27.png`，1586 × 992；输入参考仅为本项目新生成的 `landscape-pixel-v2.webp`。
- 处理：NEAREST 下采样至 320 × 200；无抖动 MEDIANCUT 上限 48 色；NEAREST 3 倍放大到 960 × 600；以无损 WebP 保存。已逐像素验证每个 3 × 3 显示块完全同色，因此导出没有产生抗锯齿混色。
- 目视检查：左红瓦灰石城堡、右蓝色尖顶灰石城堡、红蓝两队的剑盾兵、弓箭手、较粗壮重甲兵，以及 A / B / C 木字母牌；无中文、按钮、菜单、血条或其他 UI。
- 封面为独立主题插画，不是运行中游戏截图；低分辨率文字仅限 A/B/C，角色采用原创通用像素造型。

#### 像素封面完整生成提示词

```text
Create an ORIGINAL retro fantasy tower-defense game COVER in authentic manually authored PIXEL ART, logical native canvas 320 x 200 pixels, displayed at exact4x nearest-neighbor pixel scale (1280 x 800), aspect8:5. It must look like an expert sprite artist arranged hand-designed 16-bit sprites and tile art, NOT a smooth illustration with mosaic/pixelation applied. Crisp square pixel clusters, deliberately stepped outlines, mostly1 logical pixel dark outlines, cohesive limited48-color palette, flat colors with3-shade ramps. ABSOLUTELY NO antialias, blur, smooth gradients, soft glow, watercolor, painterly strokes, photographic texture, 3D rendering, or high-resolution drawing disguised as pixels. Supplied image is the original project's pixel landscape reference: use similar teal mountain layers, evergreen woodland, blue sky, vivid green meadow and warm ochre horizontal earth path. Composition: original warm-gray blocky stone castle at LEFT with RED terracotta pixel tiled roofs and a tiny red pennant, original cool-gray stone castle at RIGHT with BLUE pointed roofs and a tiny blue pennant. Castles fully readable occupy outer20% each. In middle, a small group of SIX chibi pixel soldiers on horizontal grass-edged dirt road facing toward opposing team: a sword-and-shield foot soldier, a slim bow archer, and a visibly bulkier heavy armored knight for each red/blue team. Friendly heroic tiny sprites with simple4-pixel eye/face shapes and deliberate costume silhouettes, distinguish team color accents, no copying any commercial characters. Heads about one-third sprite height, keep characters small enough to feel like real game sprites, not giant detailed anime portraits. No actual impacts, injuries or gore. Three small floating wooden pixel alphabet plaques in upper-middle sky, one clean chunky uppercase pixel glyph each: A, B, C, no other letters. Sky/mountains/forest read clearly behind castles and soldiers with layered value contrast. Restrained stylized sparkle pixels around plaques are okay, no blurry glows. At380px card width one should immediately read two competing castles and vocabulary magic. No Chinese, no words, no title, no subtitle, no buttons, no UI, no health bars, no menus, no logos, no border, no watermark. Entirely original retro pixel fantasy artwork, NOT a screenshot of any commercial game, no copied game assets. Prioritize clean intentional low-resolution sprite-editor craftsmanship and hard pixel edges.
```
