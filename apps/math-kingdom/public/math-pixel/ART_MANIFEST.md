# 数学王国 · 原创像素资产

本目录由数学版 `src/scenes/art.ts` 的同一绘制函数离线导出。英文单词王国的角色代码及素材未修改。角色只采用通用奇幻兵种设定，所有像素形状、轮廓、配色与逐帧姿态由本项目程序化绘制；没有裁切商业游戏角色。

## 文件

- 八套角色：`red-soldier`、`blue-soldier`、`red-archer`、`blue-archer`、`red-knight`、`blue-knight`、`red-mage`、`blue-mage`。
- 每套 `*-sheet.png` 为独立透明 PNG 图集，`*-sheet.json` 为可直接交给 Phaser 的 JSON Hash Atlas。
- 每套同名 `*.png`（例如 `red-soldier.png`）为 **64×64** 商店头像。头像使用最近邻2倍放大，包含头部与上半身，不是整张动画图集。
- `red-castle-sheet.png`、`blue-castle-sheet.png` 及对应 JSON：城堡完整、损伤、旗帜、烟尘及倒旗坍塌图集。
- `arrow.png`：**20×7** 独立透明像素箭矢，朝右，箭尖锚点为 `(19,3)`。
- `manifest.json`：可机读的文件、动作、帧名称、像素尺寸、脚底锚点和时间说明。
- `preview.png`：6行×6列角色验收图，行依次红小兵、红弓手、红骑士、蓝小兵、蓝弓手、蓝骑士；列依次待机、行走、攻击、受伤、倒地、专属瞄准/防御。仅用于验收，无需运行时加载。
- `export-art.mjs`：离线重建脚本，使用项目已有 TypeScript 和 Node 内置 PNG/Deflate 编码，无浏览器、网络或付费 API。

## 角色尺寸与动作

- 图集单帧 **64×44** 原生像素，包含挥剑、战锤和倒地所需透明余量。单套 **1664×44**，共 **26帧**。
- 原点/脚底：帧内 `(24,41)`；Phaser origin 为 `(24/64,41/44)`。
- 原生站立主体约18–25像素宽、36–39像素高。Sprite固定放大3倍，每原生像素对应3个世界单位；root保持调用者的缩放绝对值，仅按方向翻转X符号。
- 大头约占站立主体的1/3–1/2；短肢、单像素深色描边、两级阴影。骑士通过更宽重甲、战锤和金边大盾强化体型。
- 弓箭手两阵营都使用绿色兜帽/衣服，以大片红/蓝披风、围巾、臂章、羽饰和弓身镶边区分。

| 动作 | 帧数 | 计时 |
| --- | ---: | --- |
| `idle` | 4 | 全局模拟秒，3 fps循环 |
| `walk` | 6 | 全局模拟秒，小兵/弓手10 fps、骑士8 fps循环 |
| `attack` | 6 | 本次动作已过秒，0.32秒播完后保持末帧 |
| `hurt` | 2 | 本次受伤已过秒，0.16秒 |
| `death` | 4 | 本次倒地已过秒，0.53秒 |
| `defend` | 4 | 仅小兵/骑士，5 fps循环 |
| `aim` | 4 | 仅弓箭手，0.4秒拉弓后保持满弦 |

`pose(state,t,direction)` 支持上述类型。给小兵/骑士传 `aim` 或给弓手传 `defend` 时安全回退为待机。暂停时复用同一模拟时间即可冻结角色，不采用独立浏览器时钟、Tween或新Canvas。

## 城堡

- 单帧 **80×96**、显示 **240×288** 世界单位；图集 **320×480**。
- 脚底原点 `(40,96)`，origin `(0.5,1)`。
- 帧名 `0-0` 至 `3-3`：4个血量等级，每级4帧旗帜循环（5 fps）；低血量有原生像素裂纹、碎石、烟和火光。
- `destroy-0` 至 `destroy-3`：4帧倒旗和向下坍塌，持续0.7秒后保留废墟。
- `damage(hp,time)` 的hp为 **0..1**，time为模拟秒。hp首次降至0时记下time并开始坍塌；恢复血量会清除旧坍塌时间。暂停不推进time即可冻结旗帜、烟及坍塌。
- 结算若立即冻结战局时间，应单独让结算动画时间继续0.7秒并传给此函数；否则会按冻结规则停在首帧。函数不会偷偷继续真实时钟。

## 现有工厂与独立PNG的使用

现有主场景继续使用 `createFighter` / `createCastle`，工厂每个纹理key仅创建一次原生像素Canvas。多名单位与对象池复用同一纹理，`pose`只选帧。

也可完全独立加载本目录PNG，不调用工厂：

```ts
// preload
this.load.atlas('math-red-soldier', base + 'math-pixel/red-soldier-sheet.png', base + 'math-pixel/red-soldier-sheet.json');
this.load.image('math-arrow', base + 'math-pixel/arrow.png');
// create
const unit = this.add.sprite(x, y, 'math-red-soldier', 'idle-0')
  .setOrigin(24 / 64, 41 / 44).setScale(3);
unit.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
const arrow = this.add.image(x, y, 'math-arrow').setOrigin(19 / 20, 3 / 7).setScale(3);
arrow.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
```

商店使用 `<img src={base + 'math-pixel/red-soldier.png'}>`，样式设置 `image-rendering: pixelated`，避免双线性放大。

## 重建与检查

在 `apps/math-kingdom` 执行 `node public/math-pixel/export-art.mjs`。它读取当前art.ts，用相同整数像素算法输出全部PNG/Atlas/manifest，不执行Phaser场景，也不需要浏览器。

已执行导出并目视检查角色验收图：头盔/绿色兜帽/重甲轮廓、短剑盾/弓/战锤金边大盾及红蓝差异均可辨认；脚底统一、攻击/拉弓/倒地姿态独立。已通过art.ts单文件TypeScript检查。

限制：这是低分辨率侧视精灵，不含正面/背面八方向动作；头盔小装饰受像素预算限制。相机/场景位置仍由战场维护，应使用最近邻采样、整数像素对齐与无抗锯齿画布。PNG与运行时代码均无柔边缩放。


## 冰冻法师扩展（2026-11-10）

新增红蓝各1套冰冻法师（mage）：蓝色尖帽、长袍、阵营围领、冰晶法杖，原生64×44帧，共26帧，包含待机、行走、施法、受伤、死亡、蓄力。与原有三职业采用同一整数像素渲染器、脚底锚点和PNG导出流程。现在共8套角色图集及8张头像。另新增16×11透明冰晶弹道frost.png，由同一导出脚本生成。

城堡升级的金色加固横梁、等级标记和3级支撑条由场景原生Graphics绘制，生命损伤与倒塌仍使用原图集。
