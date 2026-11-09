import Phaser from 'phaser';

export type Team = 'red' | 'blue';
export type Kind = 'soldier' | 'archer' | 'knight';
export type Pose = 'idle' | 'walk' | 'attack' | 'hurt' | 'death' | 'aim' | 'defend';
type Point = readonly [number, number];
type Container = Phaser.GameObjects.Container;

// Every primitive below is rasterised into integer pixels. There are no smooth
// Canvas paths, gradients, resized vector textures, or per-pose Canvas allocations.
const PIXEL_SCALE = 3;
const FW = 64, FH = 44, ORIGIN_X = 24, FOOT_Y = 41;
const COUNTS: Record<Pose, number> = { idle: 4, walk: 6, attack: 6, hurt: 2, death: 4, aim: 4, defend: 4 };
const STATES: Pose[] = ['idle', 'walk', 'attack', 'hurt', 'death', 'aim', 'defend'];
const C = {
  ink: '#19283b', deep: '#273c51', steelDark: '#526b7b', steel: '#94acb7', steelLight: '#d7e2d3',
  skinDark: '#aa7356', skin: '#e3ac78', skinLight: '#f4cd92',
  woodDark: '#513b35', wood: '#8b5938', woodLight: '#c58e4d', gold: '#e4b75b', cream: '#fff0bb',
  boot: '#353440', bootLight: '#66564b', shadow: '#17353266',
  leafDark: '#2d5630', leaf: '#56823b', leafLight: '#94b94c', hoodTrim: '#d3df83',
};
const TEAM = {
  red: { dark: '#6a2e3d', base: '#b84847', light: '#ef7860', trim: '#f0c475', stone: '#a8a48d', stoneDark: '#717e7a', stoneLight: '#d6d1af' },
  blue: { dark: '#234c70', base: '#397db2', light: '#74c5d1', trim: '#d1e5dc', stone: '#93a9ac', stoneDark: '#5a7988', stoneLight: '#cad9cb' },
} as const;

/** Deliberately tiny pixel renderer; polygons use scanline fills, lines Bresenham. */
class Pixels {
  transform: (x: number, y: number) => Point = (x, y) => [x, y];
  private color = '';
  constructor(private ctx: CanvasRenderingContext2D, private ox: number, private oy: number, private w: number, private h: number) {}
  private raw(x: number, y: number, color: string): void {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    if (color !== this.color) { this.ctx.fillStyle = color; this.color = color; }
    this.ctx.fillRect(this.ox + x, this.oy + y, 1, 1);
  }
  dot(x: number, y: number, color: string): void { const p = this.transform(x, y); this.raw(p[0], p[1], color); }
  line(x1: number, y1: number, x2: number, y2: number, color: string, thickness = 1): void {
    const a = this.transform(x1, y1), b = this.transform(x2, y2);
    let x = Math.round(a[0]), y = Math.round(a[1]);
    const xx = Math.round(b[0]), yy = Math.round(b[1]);
    const dx = Math.abs(xx - x), sx = x < xx ? 1 : -1, dy = -Math.abs(yy - y), sy = y < yy ? 1 : -1;
    let error = dx + dy;
    const r = Math.floor(thickness / 2);
    for (;;) {
      for (let ry = -r; ry <= r; ry++) for (let rx = -r; rx <= r; rx++) if (rx * rx + ry * ry <= r * r + r) this.raw(x + rx, y + ry, color);
      if (x === xx && y === yy) break;
      const e = 2 * error;
      if (e >= dy) { error += dy; x += sx; }
      if (e <= dx) { error += dx; y += sy; }
    }
  }
  poly(points: readonly Point[], fill: string, outline?: string): void {
    const vertices = points.map(([x, y]) => this.transform(x, y));
    const minY = Math.max(0, Math.floor(Math.min(...vertices.map(p => p[1]))));
    const maxY = Math.min(this.h - 1, Math.ceil(Math.max(...vertices.map(p => p[1]))));
    for (let y = minY; y <= maxY; y++) {
      const crossings: number[] = [], scan = y + 0.5;
      for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const a = vertices[j], b = vertices[i];
        if ((a[1] <= scan && b[1] > scan) || (b[1] <= scan && a[1] > scan)) crossings.push(a[0] + (scan - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
      crossings.sort((a, b) => a - b);
      for (let i = 0; i + 1 < crossings.length; i += 2) for (let x = Math.ceil(crossings[i] - 0.5); x <= Math.floor(crossings[i + 1] - 0.5); x++) this.raw(x, y, fill);
    }
    if (outline) for (let i = 0; i < points.length; i++) { const a = points[i], b = points[(i + 1) % points.length]; this.line(a[0], a[1], b[0], b[1], outline); }
  }
  rect(x: number, y: number, w: number, h: number, fill: string, outline?: string): void {
    this.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], fill);
    if (outline) {
      this.line(x, y, x + w - 1, y, outline);this.line(x, y + h - 1, x + w - 1, y + h - 1, outline);
      this.line(x, y, x, y + h - 1, outline);this.line(x + w - 1, y, x + w - 1, y + h - 1, outline);
    }
  }
}

function canvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const element = document.createElement('canvas');element.width = w;element.height = h;
  const ctx = element.getContext('2d');
  if (!ctx) throw new Error('Pixel art needs a Canvas 2D context.');
  ctx.imageSmoothingEnabled = false;
  return { canvas: element, ctx };
}

function sun(p: Pixels, x: number, y: number): void {
  p.rect(x - 1, y - 1, 3, 3, C.gold);p.dot(x, y, C.cream);
  p.dot(x - 3, y, C.gold);p.dot(x + 3, y, C.gold);p.dot(x, y - 3, C.gold);p.dot(x, y + 3, C.gold);
}

function crest(p: Pixels, team: Team, x: number, y: number): void {
  if (team === 'red') sun(p, x, y);
  else { p.line(x - 2, y - 1, x, y + 2, TEAM.blue.trim);p.line(x, y + 2, x + 2, y - 1, TEAM.blue.trim);p.dot(x, y - 2, C.gold); }
}

function limb(p: Pixels, start: Point, end: Point, color: string, heavy: boolean): void {
  p.line(start[0], start[1], end[0], end[1], C.ink, heavy ? 5 : 3);
  p.line(start[0], start[1], end[0], end[1], color, heavy ? 3 : 1);
  if (heavy) p.line(start[0] - 1, start[1], end[0] - 1, end[1] - 1, C.steelLight);
}

function endpoint(start: Point, angle: number, length: number): Point {
  return [start[0] + Math.sin(angle) * length, start[1] + Math.cos(angle) * length];
}

function arm(p: Pixels, shoulder: Point, hand: Point, color: string, heavy: boolean, bend = 1): void {
  const dx = hand[0] - shoulder[0], dy = hand[1] - shoulder[1];
  const d = Math.min(12.8, Math.max(1, Math.hypot(dx, dy)));
  const elbowAngle = Math.acos(Phaser.Math.Clamp((d * d - 49 - 36) / 84, -1, 1)) * bend;
  const a = Math.atan2(dy, dx) - Math.atan2(6 * Math.sin(elbowAngle), 7 + 6 * Math.cos(elbowAngle));
  const elbow: Point = [shoulder[0] + Math.cos(a) * 7, shoulder[1] + Math.sin(a) * 7];
  limb(p, shoulder, elbow, color, heavy);limb(p, elbow, hand, heavy ? C.steel : color, heavy);
  p.rect(hand[0] - 1, hand[1] - 1, 3, 3, C.skin, C.ink);p.dot(hand[0], hand[1] - 1, C.skinLight);
}

function shield(p: Pixels, team: Team, x: number, y: number, heavy: boolean): void {
  const t = TEAM[team], r = heavy ? 6 : 5;
  if (heavy) {
    const outline: Point[] = team === 'red'
      ? [[x - 9, y - 8], [x - 2, y - 11], [x + 8, y - 7], [x + 8, y + 5], [x, y + 12], [x - 9, y + 5]]
      : [[x - 9, y - 9], [x + 8, y - 9], [x + 9, y + 3], [x + 2, y + 12], [x - 7, y + 7]];
    p.poly(outline, C.gold, C.ink);
    p.poly([[x - 6, y - 6], [x + 5, y - 6], [x + 6, y + 3], [x + 1, y + 8], [x - 6, y + 3]], t.base, C.woodDark);
    p.line(x - 7, y - 6, x - 7, y + 3, C.cream);p.line(x - 5, y - 8, x + 4, y - 8, C.cream);
    crest(p, team, x, y);p.dot(x - 6, y + 4, C.cream);p.dot(x + 6, y + 3, C.cream);
    return;
  }
  if (team === 'red') {
    p.poly([[x - r + 2, y - r], [x + r - 2, y - r], [x + r, y - r + 2], [x + r, y + r - 2], [x + r - 2, y + r], [x - r + 2, y + r], [x - r, y + r - 2], [x - r, y - r + 2]], t.base, C.ink);
    p.line(x - r + 2, y - r + 1, x + r - 2, y - r + 1, t.trim);
    p.line(x - r + 1, y - r + 2, x - r + 1, y + r - 2, t.trim);
    p.line(x - r + 2, y + r - 1, x + r - 2, y + r - 1, t.dark);
  } else {
    p.poly([[x - r, y - r], [x + r, y - r], [x + r, y + 2], [x, y + r + 2], [x - r, y + 2]], t.base, C.ink);
    p.poly([[x - r + 1, y - r + 1], [x, y - r + 1], [x, y + r], [x - r + 1, y + 1]], t.dark);
    p.line(x - r + 1, y - r + 1, x + r - 1, y - r + 1, t.trim);
  }
  crest(p, team, x, y);
}

function sword(p: Pixels, hand: Point, angle: number, heavy: boolean, team: Team): void {
  const length = heavy ? 17 : 12;
  const ux = Math.cos(angle), uy = Math.sin(angle), nx = -uy, ny = ux;
  const at = (along: number, across: number): Point => [hand[0] + ux * along + nx * across, hand[1] + uy * along + ny * across];
  p.line(...at(-3, 0), ...at(2, 0), C.woodDark, 3);
  p.poly([at(2, -1.5), at(length - 2, -1.5), at(length + 1, 0), at(length - 2, 1.5), at(2, 1.5)], C.steel, C.ink);
  p.line(...at(3, -0.5), ...at(length - 2, -0.5), C.steelLight);
  p.line(...at(1, -3), ...at(1, 3), C.gold, heavy ? 3 : 1);
  p.dot(...at(-3, 0), TEAM[team].light);
}

function hammer(p: Pixels, hand: Point, angle: number, team: Team): void {
  const ux = Math.cos(angle), uy = Math.sin(angle), nx = -uy, ny = ux;
  const at = (along: number, across: number): Point => [hand[0] + ux * along + nx * across, hand[1] + uy * along + ny * across];
  p.line(...at(-3, 0), ...at(14, 0), C.ink, 3);p.line(...at(-2, 0), ...at(13, 0), C.woodLight);
  p.line(...at(1, -1), ...at(1, 1), C.gold);p.dot(...at(-3, 0), C.gold);
  p.poly([at(10, -5), at(16, -5), at(18, -3), at(18, 4), at(16, 6), at(10, 6), at(8, 4), at(8, -3)], C.steelDark, C.ink);
  p.poly([at(10, -4), at(16, -4), at(17, -2), at(16, 3), at(10, 3), at(9, 1)], C.steel, C.gold);
  p.line(...at(10, -3), ...at(15, -3), C.steelLight);p.line(...at(16, -1), ...at(16, 3), TEAM[team].light);
  const center = at(13, -0.2);p.dot(center[0], center[1] - 1, C.cream);p.dot(center[0] - 1, center[1], C.gold);p.dot(center[0], center[1] + 1, C.gold);p.dot(center[0] + 1, center[1], C.gold);
}

function head(p: Pixels, team: Team, kind: Kind, hurt: boolean): void {
  const t = TEAM[team];
  // The head is 12–15 native pixels high, roughly 40% of a standing figure.
  p.rect(-5, -31, 11, 11, hurt ? C.skinLight : C.skin, C.ink);
  p.rect(-4, -29, 2, 7, C.skinDark);p.rect(5, -28, 2, 4, C.skin);p.dot(3, -27, C.ink);p.dot(4, -24, C.skinDark);
  p.rect(-1, -29, 4, 1, C.skinLight);
  if (kind === 'archer') {
    if (team === 'red') {
      p.poly([[-8, -22], [-8, -31], [-2, -37], [5, -35], [9, -29], [5, -29], [1, -31], [-3, -30], [-4, -23], [-1, -20]], C.leafDark, C.ink);
      p.poly([[-6, -30], [-2, -35], [4, -34], [6, -31], [1, -32], [-3, -31]], C.leaf);
      p.line(-3, -32, 3, -33, C.leafLight);p.line(-4, -29, -4, -24, C.hoodTrim);
      p.rect(-6, -22, 3, 5, t.base);p.rect(-3, -22, 9, 3, t.light);p.dot(-3, -21, C.gold);
    } else {
      p.poly([[-8, -23], [-7, -32], [0, -37], [7, -33], [9, -29], [5, -28], [1, -31], [-3, -30], [-4, -23], [-1, -20]], C.leaf, C.ink);
      p.poly([[-5, -31], [0, -35], [6, -32], [2, -33], [-2, -30]], C.leafLight);
      p.line(-4, -29, -4, -24, C.hoodTrim);p.line(-7, -27, -7, -23, C.leafDark);
      p.rect(-5, -22, 3, 6, t.dark);p.rect(-3, -22, 9, 3, t.base);p.line(-2, -21, 5, -21, t.trim);
    }
  } else if (kind === 'knight') {
    if (team === 'red') {
      p.poly([[-7, -24], [-7, -32], [-3, -36], [5, -36], [9, -32], [9, -23], [4, -20], [-4, -21]], C.steelDark, C.ink);
      p.rect(-5, -33, 10, 4, C.steel);p.rect(-5, -29, 12, 3, C.ink);p.line(-3, -28, 5, -28, C.gold);
      p.line(2, -26, 2, -22, C.steelLight);p.dot(6, -24, C.ink);p.line(-3, -34, 4, -34, C.steelLight);
      p.poly([[-3, -36], [-7, -38], [-2, -39], [5, -38], [9, -36], [3, -36]], t.light, C.ink);p.line(-2, -38, 4, -37, t.trim);
    } else {
      p.poly([[-8, -30], [-3, -36], [5, -36], [10, -31], [8, -23], [2, -20], [-6, -22]], C.steel, C.ink);
      p.rect(-4, -29, 12, 3, C.ink);p.line(-2, -28, 6, -28, t.light);p.line(3, -26, 3, -22, C.steelLight);
      p.poly([[-5, -33], [-12, -37], [-11, -30], [-7, -26]], t.trim, C.ink);
      p.poly([[0, -36], [3, -39], [7, -35]], t.light, C.ink);p.line(-1, -34, 4, -34, C.steelLight);
    }
  } else if (team === 'red') {
    p.poly([[-7, -24], [-7, -31], [-2, -35], [5, -35], [9, -31], [8, -27], [-2, -27], [-2, -23]], C.steel, C.ink);
    p.poly([[-6, -32], [-2, -34], [5, -34], [6, -32]], C.steelLight);p.line(-5, -29, 7, -29, C.steelDark);
    p.poly([[-4, -35], [-7, -38], [-1, -39], [6, -37], [8, -34], [1, -35]], t.base, C.ink);p.line(-2, -37, 4, -36, t.light);
    p.rect(4, -27, 1, 5, C.steelDark);
  } else {
    p.poly([[-7, -24], [-7, -31], [0, -35], [6, -34], [10, -29], [7, -27], [-2, -27], [-2, -23]], C.steel, C.ink);
    p.poly([[-6, -32], [-12, -36], [-10, -29], [-6, -26]], t.trim, C.ink);
    p.poly([[-2, -35], [1, -39], [6, -36], [6, -34]], t.base, C.ink);p.dot(2, -37, t.light);
    p.line(-4, -31, 3, -33, C.steelLight);p.rect(5, -27, 1, 5, C.steelDark);
  }
}

function fighterFrame(p: Pixels, team: Team, kind: Kind, state: Pose, frame: number): void {
  const t = TEAM[team], heavy = kind === 'knight', archer = kind === 'archer';
  // Shadow stays on the ground while the character's complete pose changes.
  p.rect(ORIGIN_X - 8, FOOT_Y, 17, 2, C.shadow);p.rect(ORIGIN_X - 5, FOOT_Y - 1, 11, 1, C.shadow);
  let dy = state === 'idle' && frame === 2 ? -1 : 0;
  let dx = 0, fall = 0;
  if (state === 'walk') dy = [0, -1, -1, 0, -1, -1][frame];
  if (state === 'hurt') { dx = frame === 0 ? -2 : -1; dy = 1; }
  if (state === 'defend') { dx = -1; dy = frame === 1 || frame === 2 ? 2 : 1; }
  if (state === 'death') { fall = [0.15, 0.55, 1.08, Math.PI / 2][frame]; dy = frame === 3 ? -2 : 0; }
  p.transform = (x, y) => [ORIGIN_X + dx + Math.cos(fall) * x - Math.sin(fall) * y, Math.min(FOOT_Y - 1, FOOT_Y + dy + Math.sin(fall) * x + Math.cos(fall) * y)];
  const stride = state === 'walk' ? [0, 1, 1, 0, -1, -1][frame] : 0;
  const capeWave = state === 'walk' ? [0, -1, -2, -1, 0, 1][frame] : frame % 2;
  // Red ragged capes and blue forked travelling cloaks have different silhouettes.
  p.poly([[-4, -23], [-8, -21], [-13 + capeWave, -8], [-7, -9], [-3, -6], [0, -10], [1, -22]], archer ? t.base : t.dark, C.ink);
  if (team === 'red') p.line(-6, -18, -8 + capeWave, -10, t.base);
  else { p.line(-6, -19, -9 + capeWave, -9, t.light);p.dot(-4, -9, t.trim); }
  if (archer) {
    p.poly([[-9, -23], [-5, -22], [-6, -10], [-10, -11]], C.wood, C.ink);
    p.line(-8, -22, -9, -30, C.woodLight);p.line(-6, -23, -6, -31, C.woodLight);
    p.line(-11, -30, -8, -29, t.light);p.line(-8, -31, -5, -30, C.cream);
  }
  const legColor = heavy ? C.steelDark : C.deep;
  const backKnee: Point = [-3 - stride * 2, -6];
  const backFoot: Point = [-3 - stride * 4, stride > 0 ? -2 : -1];
  limb(p, [-3, -12], backKnee, legColor, heavy);limb(p, backKnee, backFoot, heavy ? C.steel : C.boot, heavy);
  p.rect(backFoot[0] - 1, backFoot[1] - 1, 5, 2, C.boot, C.ink);
  const backHand: Point = archer ? [7, -18] : [-6, -13 + stride];
  arm(p, [-3, -21], backHand, t.dark, heavy, -1);
  // Torso, belt, shoulder armour and distinct tunic construction.
  p.poly([[-5, -22], [5, -22], [6, -11], [-5, -10]], archer ? C.leaf : C.steelDark, C.ink);
  p.poly([[-5, -12], [5, -12], [7, -7], [1, -8], [-3, -6], [-6, -8]], archer ? C.leafDark : t.base, C.ink);
  if (heavy) {
    p.poly([[-5, -22], [0, -24], [6, -21], [4, -13], [0, -11], [-4, -14]], C.steel, C.ink);
    p.line(-2, -21, 3, -21, C.steelLight);p.line(0, -20, 0, -14, C.steelDark);
    p.rect(-8, -23, 6, 5, team === 'red' ? C.gold : C.steelLight, C.ink);p.rect(3, -23, 7, 5, team === 'red' ? C.gold : C.steelLight, C.ink);
    p.dot(-6, -22, C.cream);p.dot(5, -22, C.cream);crest(p, team, 1, -17);
  } else if (archer) {
    p.line(-4, -21, 4, -13, C.woodDark, 3);p.line(-3, -21, 4, -14, C.woodLight);
    p.rect(-3, -16, 2, 3, C.leafLight);p.rect(3, -19, 3, 4, t.base);p.dot(4, -18, t.trim);
  } else {
    p.rect(-2, -21, 4, 11, t.base);p.line(-4, -20, -4, -15, C.steelLight);p.dot(1, -17, t.trim);
  }
  p.rect(-5, -12, 11, 2, C.woodDark);p.rect(0, -12, 3, 2, C.gold);
  const frontKnee: Point = [3 + stride * 2, -6 + Math.max(0, -stride)];
  const frontFoot: Point = [3 + stride * 4, stride < 0 ? -2 : -1];
  limb(p, [3, -11], frontKnee, legColor, heavy);limb(p, frontKnee, frontFoot, heavy ? C.steel : C.boot, heavy);
  p.rect(frontFoot[0] - 1, frontFoot[1] - 1, heavy ? 6 : 5, 2, C.boot, C.ink);p.line(frontFoot[0], frontFoot[1], frontFoot[0] + 3, frontFoot[1], C.bootLight);
  head(p, team, kind, state === 'hurt');
  if (archer) {
    const pull = state === 'attack' ? [0, 0.3, 0.7, 1, 0.1, 0][frame] : state === 'aim' ? [0.6, 0.85, 1, 1][frame] : 0;
    const bowX = 13, bowY = -20;
    arm(p, [4, -21], [bowX + 3, bowY], C.leaf, false, 1);
    const stringX = bowX - 1 - Math.round(7 * pull);
    arm(p, [1, -21], [state === 'attack' || state === 'aim' ? stringX : 8, bowY], C.leafDark, false, -1);
    p.rect(7, -22, 3, 3, t.base);p.dot(8, -22, t.trim);
    p.line(bowX - 1, bowY - 9, bowX + 3, bowY - 5, C.ink, 3);
    p.line(bowX + 3, bowY - 5, bowX + 4, bowY + 4, C.ink, 3);
    p.line(bowX + 4, bowY + 4, bowX - 1, bowY + 9, C.ink, 3);
    p.line(bowX - 1, bowY - 9, bowX + 3, bowY - 5, team === 'red' ? C.woodLight : t.trim);
    p.line(bowX + 3, bowY - 5, bowX + 4, bowY + 4, team === 'red' ? C.wood : t.light);
    p.line(bowX + 4, bowY + 4, bowX - 1, bowY + 9, team === 'red' ? C.woodLight : t.trim);
    p.line(bowX - 1, bowY - 9, stringX, bowY, C.cream);p.line(stringX, bowY, bowX - 1, bowY + 9, C.cream);
    if (state !== 'death' && !(state === 'attack' && frame === 4)) {
      p.line(stringX - 2, bowY, bowX + 14 - Math.round(pull * 4), bowY, C.woodLight);
      p.poly([[bowX + 16 - pull * 4, bowY], [bowX + 12 - pull * 4, bowY - 2], [bowX + 12 - pull * 4, bowY + 2]], C.steelLight);
      p.line(stringX - 2, bowY - 1, stringX + 1, bowY, t.light);
    }
  } else {
    let shoulderAngle = -0.45 - stride * 0.15;
    let bladeAngle = -0.7;
    if (state === 'attack') {
      shoulderAngle = [-0.6, -1.4, -2.2, -1.5, -0.3, -0.5][frame];
      bladeAngle = [-0.8, -2.1, -2.8, -0.2, 0.65, -0.55][frame];
    }
    if (state === 'hurt') shoulderAngle = -0.8;
    if (state === 'defend') { shoulderAngle = 0.1; bladeAngle = -1.45; }
    const elbow = endpoint([5, -21], shoulderAngle, 6);
    const hand = endpoint(elbow, shoulderAngle - 0.45, 5);
    limb(p, [5, -21], elbow, heavy ? C.steel : t.base, heavy);limb(p, elbow, hand, C.steelDark, heavy);
    p.rect(hand[0] - 1, hand[1] - 1, 3, 3, C.skin, C.ink);
    if (state !== 'death' || frame < 2) {
      if (heavy) hammer(p, hand, bladeAngle, team);else sword(p, hand, bladeAngle, false, team);
    }
    shield(p, team, state === 'defend' ? [0, 2, 3, 2][frame] : -6, state === 'defend' ? -18 : -15, heavy);
    if (state === 'attack' && (frame === 3 || frame === 4)) {
      p.line(15, -27, 19, -23, C.cream);p.line(19, -23, 21, -18, C.gold);p.dot(20, -25, t.trim);
    }
  }
  if (state === 'hurt') {
    p.line(-11, -27, -9, -25, C.cream);p.line(-12, -23, -10, -23, C.gold);p.dot(-9, -29, C.cream);
  }
  if (state === 'death' && frame > 1 && !archer) {
    p.transform = (x, y) => [ORIGIN_X + x, FOOT_Y + y];
    if (heavy) hammer(p, [7, -4], 0, team);else sword(p, [7, -1], 0, false, team);
  }
}

function fighterTexture(scene: Phaser.Scene, team: Team, kind: Kind): string {
  const key = `math-kingdom-pixel-v1-${team}-${kind}`;
  if (scene.textures.exists(key)) return key;
  const states = STATES.filter(state => state !== (kind === 'archer' ? 'defend' : 'aim'));
  const total = states.reduce((n, state) => n + COUNTS[state], 0);
  const sheet = canvas(FW * total, FH);
  let index = 0;
  for (const state of states) for (let frame = 0; frame < COUNTS[state]; frame++, index++) {
    fighterFrame(new Pixels(sheet.ctx, index * FW, 0, FW, FH), team, kind, state, frame);
  }
  const texture = scene.textures.addCanvas(key, sheet.canvas);
  if (!texture) throw new Error(`Cannot create pixel texture ${key}`);
  index = 0;
  for (const state of states) for (let frame = 0; frame < COUNTS[state]; frame++, index++) texture.add(`${state}-${frame}`, 0, index * FW, 0, FW, FH);
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return key;
}

/** t: global seconds for idle/walk; elapsed state seconds for attack/hurt/death. */
export function createFighter(scene: Phaser.Scene, team: Team, kind: Kind): { root: Container; pose: (state: Pose, t: number, direction: number) => void } {
  const key = fighterTexture(scene, team, kind);
  const root = scene.add.container(0, 0).setSize(kind === 'knight' ? 93 : 78, 117).setData({ team, kind, pixelScale: PIXEL_SCALE });
  const sprite = scene.add.sprite(0, 0, key, 'idle-0').setOrigin(ORIGIN_X / FW, FOOT_Y / FH).setScale(PIXEL_SCALE);
  root.add(sprite);
  let selected = '';
  function pose(state: Pose, t: number, direction: number): void {
    if (state === 'aim' && kind !== 'archer' || state === 'defend' && kind === 'archer') state = 'idle';
    t = Number.isFinite(t) ? Math.max(0, t) : 0;
    let frame: number;
    if (state === 'walk') frame = Math.floor(t * (kind === 'knight' ? 8 : 10)) % COUNTS.walk;
    else if (state === 'idle') frame = Math.floor(t * 3) % COUNTS.idle;
    else if (state === 'attack') frame = Math.min(5, Math.floor(t / 0.32 * 6));
    else if (state === 'hurt') frame = Math.min(1, Math.floor(t / 0.16 * 2));
    else if (state === 'death') frame = Math.min(3, Math.floor(t / 0.53 * 4));
    else if (state === 'aim') frame = Math.min(3, Math.floor(t / 0.4 * 4));
    else frame = Math.floor(t * 5) % COUNTS.defend;
    const next = `${state}-${frame}`;
    if (next !== selected) { sprite.setFrame(next); selected = next; }
    // Battle.take may reset the external root to 1; the sprite's native 3x scale
    // remains intact. Preserve any caller-supplied root scale, only flip its sign.
    root.scaleX = Math.abs(root.scaleX) * (direction < 0 ? -1 : 1);
  }
  return { root, pose };
}

function stone(p: Pixels, x: number, y: number, w: number, h: number, team: Team): void {
  const t = TEAM[team];
  p.rect(x, y, w, h, t.stone, C.ink);
  p.line(x + 1, y + 1, x + 1, y + h - 2, t.stoneLight);
  p.line(x + w - 2, y + 1, x + w - 2, y + h - 2, t.stoneDark);
  for (let row = 0; row < Math.ceil(h / 5); row++) {
    const yy = y + row * 5;
    for (let col = -1; col < Math.ceil(w / 8); col++) {
      const xx = x + col * 8 + (row % 2 ? 4 : 0);
      const left = Math.max(x + 2, xx + 1), right = Math.min(x + w - 3, xx + 7);
      if (right < left || yy + 4 >= y + h - 1) continue;
      p.line(left, yy + 4, right, yy + 4, t.stoneDark);
      if (xx + 7 > x + 1 && xx + 7 < x + w - 2) p.line(xx + 7, yy + 1, xx + 7, yy + 4, t.stoneDark);
      if ((row * 7 + col * 3) % 4 === 0) p.line(left, yy + 1, right - 1, yy + 1, t.stoneLight);
    }
  }
}

function roof(p: Pixels, cx: number, top: number, base: number, r: number, team: Team): void {
  const t = TEAM[team];
  p.poly([[cx, top], [cx + r, base], [cx - r, base]], t.base, C.ink);
  p.poly([[cx + 1, top + 3], [cx + r - 1, base - 1], [cx + 1, base - 1]], t.dark);
  for (let y = top + 4; y < base; y += 4) {
    const width = Math.floor((y - top) / (base - top) * r);
    p.line(cx - width + 1, y, cx + width - 1, y, t.light);
    if (width > 5) p.dot(cx - 3, y + 1, t.dark);
  }
  p.line(cx - r, base, cx + r, base, t.trim);
}

function windowPixel(p: Pixels, x: number, y: number, lit: boolean): void {
  p.rect(x - 2, y + 1, 5, 9, C.ink);p.rect(x - 1, y, 3, 2, C.ink);
  p.rect(x - 1, y + 2, 3, 6, lit ? C.gold : C.deep);
  if (lit) p.line(x, y + 2, x, y + 7, C.cream);
  p.line(x - 2, y + 10, x + 2, y + 10, C.steelLight);
}

function flag(p: Pixels, x: number, y: number, team: Team, frame: number, fall = 0): void {
  const previous = p.transform;
  if (fall) p.transform = (px, py) => {
    const a = fall * 1.35, dx = px - x, dy = py - (y + 16);
    return previous(x + Math.cos(a) * dx - Math.sin(a) * dy, y + 16 + Math.sin(a) * dx + Math.cos(a) * dy);
  };
  const t = TEAM[team], wave = [0, 1, 0, -1][frame], tip = [1, 0, -1, 0][frame];
  p.line(x, y, x, y + 16, C.woodDark);p.dot(x, y, C.gold);
  const points: Point[] = team === 'red'
    ? [[x + 1, y + 2], [x + 7, y + 2 + wave], [x + 13, y + 4 + tip], [x + 10, y + 7 + tip], [x + 13, y + 10 + tip], [x + 6, y + 8 + wave], [x + 1, y + 8]]
    : [[x + 1, y + 2], [x + 7, y + 2 + wave], [x + 14, y + 1 + tip], [x + 10, y + 6 + tip], [x + 14, y + 11 + tip], [x + 7, y + 9 + wave], [x + 1, y + 9]];
  p.poly(points, t.base, C.ink);p.line(x + 2, y + 3, x + 6, y + 3 + wave, t.light);
  if (team === 'red') p.rect(x + 4, y + 4 + wave, 2, 2, C.gold);
  else p.line(x + 4, y + 5 + wave, x + 6, y + 7 + wave, t.trim);
  p.transform = previous;
}

function castleFrame(p: Pixels, team: Team, damage: number, frame: number): void {
  const t = TEAM[team];
  p.rect(4, 93, 72, 3, C.shadow);p.rect(2, 90, 76, 4, t.stoneDark, C.ink);p.line(4, 91, 75, 91, t.stoneLight);
  const collapse = damage === 4 ? [0.1, 0.35, 0.68, 1][frame] : 0;
  if (collapse) p.transform = (x, y) => [x + (y < 42 ? Math.sin(x * 0.19) * collapse * 4 : 0), 94 - (94 - y) * (1 - collapse * 0.72)];
  if (team === 'red') {
    stone(p, 19, 44, 43, 47, team);stone(p, 26, 37, 29, 50, team);
    for (let x = 25; x < 56; x += 7) stone(p, x, 33, 5, 7, team);
    for (const x of [7, 57]) {
      stone(p, x, 33, 17, 58, team);stone(p, x - 1, 34, 19, 4, team);
      roof(p, x + 8, 14, 33, 13, team);p.line(x + 2, 74, x + 14, 74, t.stoneDark);
      windowPixel(p, x + 8, 44, damage < 3);windowPixel(p, x + 8, 69, damage < 2);
    }
    flag(p, 15, 2, team, frame, collapse);flag(p, 65, 2, team, (frame + 2) % 4, collapse * 0.9);
    p.poly([[34, 47], [47, 47], [47, 62], [40, 68], [34, 62]], t.base, C.ink);crest(p, team, 40, 55);
  } else {
    stone(p, 18, 49, 45, 42, team);stone(p, 27, 28, 27, 61, team);
    for (let x = 26; x < 55; x += 6) stone(p, x, 24, 4, 7, team);
    p.rect(25, 33, 31, 3, t.stoneDark);p.line(27, 34, 53, 34, t.stoneLight);
    for (const x of [6, 61]) {
      stone(p, x, 38, 14, 53, team);stone(p, x - 1, 36, 16, 5, team);
      roof(p, x + 7, 9, 36, 11, team);windowPixel(p, x + 7, 48, damage < 3);windowPixel(p, x + 7, 72, damage < 2);
      p.line(x + 2, 70, x + 11, 70, t.trim);
    }
    flag(p, 39, 0, team, frame, collapse);flag(p, 68, 20, team, (frame + 1) % 4, collapse * 0.9);
    p.poly([[33, 41], [47, 41], [47, 57], [40, 64], [33, 57]], t.dark, C.ink);crest(p, team, 40, 49);
  }
  // Stone arch and a visible iron-bound wooden gate, rather than a single block.
  p.poly([[28, 90], [28, 73], [31, 67], [35, 63], [45, 63], [49, 67], [52, 73], [52, 90]], t.stoneLight, C.ink);
  p.poly([[32, 90], [32, 74], [35, 69], [38, 67], [43, 67], [47, 72], [48, 76], [48, 90]], C.wood, C.ink);
  for (const x of [35, 39, 43, 46]) p.line(x, x === 35 || x === 46 ? 73 : 69, x, 89, C.woodDark);
  p.line(33, 77, 47, 77, C.ink, 3);p.line(33, 85, 47, 85, C.ink, 3);
  p.dot(34, 77, C.steel);p.dot(46, 77, C.steel);p.dot(34, 85, C.steel);p.dot(46, 85, C.steel);p.rect(40, 80, 2, 2, C.gold);
  p.line(39, 64, 41, 64, C.cream);p.line(29, 73, 31, 73, t.stoneDark);p.line(49, 73, 51, 73, t.stoneDark);
  // Buttresses, steps and a few grass pixels anchor the sprite to the landscape.
  p.poly([[23, 90], [26, 90], [25, 62], [23, 65]], t.stoneDark, C.ink);
  p.poly([[54, 90], [57, 90], [57, 64], [55, 61]], t.stoneDark, C.ink);
  p.rect(28, 91, 25, 2, t.stone);p.rect(25, 93, 31, 2, t.stoneDark);p.line(27, 93, 54, 93, t.stoneLight);
  p.dot(5, 92, '#52774b');p.dot(74, 92, '#52774b');p.dot(73, 91, '#7c9d51');
  if (damage > 0) {
    p.line(24, 47, 22, 53, C.deep);p.line(22, 53, 25, 58, C.deep);p.line(25, 58, 23, 64, C.deep);
    p.rect(19, 91, 4, 2, t.stone);p.dot(21, 90, t.stoneLight);
  }
  if (damage > 1) {
    p.line(61, 44, 58, 51, C.ink);p.line(58, 51, 61, 57, C.ink);p.line(61, 57, 58, 64, C.ink);
    p.poly([[28, 36], [31, 43], [34, 36]], C.ink);p.rect(56, 91, 5, 2, t.stoneDark);p.rect(63, 92, 3, 2, t.stone);
  }
  if (damage > 2) {
    p.line(46, 35, 43, 42, C.ink);p.line(43, 42, 46, 48, C.ink);p.rect(55, 66, 5, 5, C.deep);
    // Pixel puffs are pre-rendered for each of the four clock-controlled frames.
    for (let i = 0; i < 4; i++) {
      const phase = (frame + i) % 4, x = (i % 2 ? 56 : 21) + phase * 2, y = 28 - phase * 5 - i * 2;
      p.rect(x, y, 6 + phase, 4 + phase, '#526776');p.rect(x - 2, y + 2, 8 + phase, 4, '#526776');
      p.rect(x + 1, y, 4, 2, '#89999c');
    }
    p.rect(56 + frame % 2, 69, 3, 3, '#ec9b41');p.dot(57, 67 - frame % 2, '#ffe09a');
  }
  if (collapse) {
    p.transform = (x, y) => [x, y];
    for (let i = 0; i < 10; i++) {
      const xx = 10 + i * 6 + (i % 2 ? 2 : -2) * collapse;
      const yy = 85 + (i % 3) * 2 - (1 - collapse) * (7 + i % 4 * 3);
      p.rect(xx, yy, 5 + i % 2, 4, i % 2 ? t.stone : t.stoneDark, C.ink);p.line(xx + 1, yy + 1, xx + 3, yy + 1, t.stoneLight);
    }
    if (frame > 1) {
      p.rect(6, 84, 12, 4, '#89999c');p.rect(63, 82, 11, 5, '#526776');p.rect(15, 80, 8, 4, '#a3aaa0');
      p.line(22, 86, 33, 89, C.woodDark, 3);p.poly([[24, 87], [30, 85], [36, 90], [27, 91]], t.base, C.ink);
    }
  }
}

function castleTexture(scene: Phaser.Scene, team: Team): string {
  const key = `math-kingdom-pixel-castle-v1-${team}`;
  if (scene.textures.exists(key)) return key;
  const sheet = canvas(80 * 4, 96 * 5);
  for (let damage = 0; damage < 5; damage++) for (let frame = 0; frame < 4; frame++) castleFrame(new Pixels(sheet.ctx, frame * 80, damage * 96, 80, 96), team, damage, frame);
  const texture = scene.textures.addCanvas(key, sheet.canvas);
  if (!texture) throw new Error(`Cannot create pixel texture ${key}`);
  for (let damage = 0; damage < 4; damage++) for (let frame = 0; frame < 4; frame++) texture.add(`${damage}-${frame}`, 0, frame * 80, damage * 96, 80, 96);
  for (let frame = 0; frame < 4; frame++) texture.add(`destroy-${frame}`, 0, frame * 80, 4 * 96, 80, 96);
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return key;
}

/** hp is 0..1; time is the simulation clock in seconds. Frozen time freezes all art. */
export function createCastle(scene: Phaser.Scene, team: Team): { root: Container; damage: (hp: number, time: number) => void } {
  const key = castleTexture(scene, team);
  const root = scene.add.container(0, 0).setSize(240, 288).setData({ team, kind: 'castle', pixelScale: PIXEL_SCALE });
  const sprite = scene.add.sprite(0, 0, key, '0-0').setOrigin(0.5, 1).setScale(PIXEL_SCALE);
  root.add(sprite);
  let health = 1, flashUntil = -Infinity, destroyedAt: number | null = null, selected = '';
  function damage(hp: number, time: number): void {
    hp = Phaser.Math.Clamp(Number.isFinite(hp) ? hp : 1, 0, 1);
    time = Number.isFinite(time) ? Math.max(0, time) : 0;
    if (hp < health) flashUntil = time + 0.1;
    if (hp > health) { flashUntil = -Infinity;destroyedAt = null; }
    if (hp === 0 && destroyedAt === null) destroyedAt = time;
    health = hp;
    const level = hp > 0.75 ? 0 : hp > 0.5 ? 1 : hp > 0.25 ? 2 : 3;
    const next = destroyedAt === null ? `${level}-${Math.floor(time * 5) % 4}` : `destroy-${Math.min(3, Math.floor(Math.max(0, time - destroyedAt) / 0.7 * 4))}`;
    if (next !== selected) { sprite.setFrame(next); selected = next; }
    if (time < flashUntil) sprite.setTintFill(0xffe4ae); else sprite.clearTint();
  }
  return { root, damage };
}
