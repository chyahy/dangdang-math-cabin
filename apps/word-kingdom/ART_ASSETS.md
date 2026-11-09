# 当当老师《单词王国》美术资产

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
