import Phaser from 'phaser';

export type Team = 'red' | 'blue';
export type Kind = 'soldier' | 'archer' | 'knight';
type Pose = 'idle' | 'walk' | 'attack' | 'hurt' | 'death';
type Container = Phaser.GameObjects.Container;
type Graphics = Phaser.GameObjects.Graphics;
type Point = readonly [number, number];

const INK = 0x182334;
const GOLD = 0xe9bd63;
const STEEL = 0xb5c5d0;
const LIGHT = 0xe8f0ec;
const SKIN = 0xe6b98e;
const PALETTES = {
  red: { cloth: 0xa73443, light: 0xe55c5a, dark: 0x651d35, metal: 0x9b9da7, stone: 0xa5a091, stoneLight: 0xc8c2ae, roof: 0xa84342 },
  blue: { cloth: 0x28618e, light: 0x52a9d4, dark: 0x183853, metal: 0x9fbaca, stone: 0x889ca8, stoneLight: 0xb7c7ca, roof: 0x2e628f },
} as const;

function group(scene: Phaser.Scene, parent: Container, x = 0, y = 0): Container {
  const node = scene.add.container(x, y);
  parent.add(node);
  return node;
}

function drawing(scene: Phaser.Scene, parent: Container, draw: (g: Graphics) => void): Graphics {
  const graphics = scene.add.graphics();
  parent.add(graphics);
  draw(graphics);
  return graphics;
}

function polygon(g: Graphics, vertices: readonly Point[], color: number, outline = INK, width = 1.5): void {
  g.fillStyle(color, 1);
  g.lineStyle(width, outline, 1);
  g.beginPath();
  g.moveTo(vertices[0][0], vertices[0][1]);
  for (let i = 1; i < vertices.length; i++) g.lineTo(vertices[i][0], vertices[i][1]);
  g.closePath();
  g.fillPath();
  if (width) g.strokePath();
}

function rounded(g: Graphics, x: number, y: number, w: number, h: number, radius: number, color: number): void {
  g.fillStyle(color, 1);
  g.fillRoundedRect(x, y, w, h, radius);
  g.lineStyle(1.5, INK, 1);
  g.strokeRoundedRect(x, y, w, h, radius);
}

function star(g: Graphics, x: number, y: number, radius: number, color: number, rays = 6): void {
  const vertices: Point[] = [];
  for (let i = 0; i < rays * 2; i++) {
    const a = -Math.PI / 2 + i * Math.PI / rays;
    const r = i % 2 ? radius * 0.46 : radius;
    vertices.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
  }
  polygon(g, vertices, color, color, 0);
}

function emblem(g: Graphics, team: Team, x: number, y: number, size: number): void {
  if (team === 'red') {
    star(g, x, y, size, GOLD, 8);
    g.fillStyle(0xffedd0, 1).fillCircle(x, y, size * 0.35);
  } else {
    // A silver three-point chevron, rather than recolouring the red team's sun.
    polygon(g, [[x - size, y - size * 0.45], [x, y + size], [x + size, y - size * 0.45], [x, y]], LIGHT, LIGHT, 0);
    g.fillStyle(GOLD, 1).fillCircle(x, y - size * 0.7, size * 0.18);
  }
}

function makeLeg(scene: Phaser.Scene, body: Container, x: number, armored: boolean, color: number) {
  const upper = group(scene, body, x, -27);
  drawing(scene, upper, g => {
    rounded(g, -3.8, -1, 7.6, 15, 3, armored ? color : 0x4b5061);
    if (armored) {
      g.lineStyle(1, LIGHT, 0.7).lineBetween(-1.7, 2, -1.7, 10);
      g.fillStyle(0x647b8d).fillCircle(0, 12, 3.7);
    }
  });
  const lower = group(scene, upper, 0, 12);
  drawing(scene, lower, g => {
    rounded(g, -3.6, -1, 7.2, 12.5, 2, armored ? 0x899aa8 : 0x343948);
    polygon(g, [[-4, 7], [3.8, 7], [7.6, 11], [7.6, 14.4], [-4.5, 14.4]], 0x32323b);
    g.lineStyle(1, 0x8d8a85, 1).lineBetween(-3, 12.8, 6.5, 12.8);
    if (armored) g.lineStyle(1, LIGHT, 0.7).lineBetween(-1.5, 0.5, -1.5, 6.5);
  });
  return { upper, lower };
}

function makeArm(scene: Phaser.Scene, body: Container, x: number, y: number, armored: boolean, color: number) {
  const upper = group(scene, body, x, y);
  drawing(scene, upper, g => {
    rounded(g, -3.8, -2, 7.6, 13.5, 3, color);
    if (armored) {
      g.fillStyle(STEEL).fillEllipse(0, 0, 12, 8);
      g.lineStyle(1.3, INK).strokeEllipse(0, 0, 12, 8);
      g.lineStyle(1, LIGHT, 0.7).lineBetween(-3, -1, 3, -1);
    }
  });
  const lower = group(scene, upper, 0, 10);
  drawing(scene, lower, g => {
    rounded(g, -3.2, 0, 6.4, 10.5, 2, armored ? 0x899daa : color);
    g.fillStyle(SKIN).fillCircle(0, 10.5, 3.4);
    g.lineStyle(1.2, INK).strokeCircle(0, 10.5, 3.4);
    if (armored) g.lineStyle(1, LIGHT, 0.6).lineBetween(-1.3, 1.5, -1.3, 6.7);
  });
  const hand = group(scene, lower, 0, 10.5);
  return { upper, lower, hand };
}

function aimArm(arm: ReturnType<typeof makeArm>, x: number, y: number, bend: number): void {
  const dx = x - arm.upper.x;
  const dy = y - arm.upper.y;
  const l1 = 10;
  const l2 = 10.5;
  const distance = Phaser.Math.Clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01);
  const elbow = Math.acos(Phaser.Math.Clamp((distance * distance - l1 * l1 - l2 * l2) / (2 * l1 * l2), -1, 1)) * bend;
  arm.upper.rotation = Math.atan2(dy, dx) - Math.atan2(l2 * Math.sin(elbow), l1 + l2 * Math.cos(elbow)) - Math.PI / 2;
  arm.lower.rotation = elbow;
}

/** Art faces right by default. t is in seconds; root position/scale magnitude belong to the battle scene. */
export function createFighter(scene: Phaser.Scene, team: Team, kind: Kind): {
  root: Container;
  pose: (state: Pose, t: number, direction: number) => void;
} {
  const palette = PALETTES[team];
  const heavy = kind === 'knight';
  const archer = kind === 'archer';
  const root = scene.add.container(0, 0);
  root.setSize(heavy ? 48 : 40, heavy ? 82 : 74);
  root.setData({ team, kind });
  const shadow = drawing(scene, root, g => g.fillStyle(0x0e1624, 0.22).fillEllipse(0, -1.2, heavy ? 38 : 31, 7));
  const body = group(scene, root);
  const cape = group(scene, body, -6, -51);
  drawing(scene, cape, g => {
    polygon(g, [[0, -1], [-8, 4], [-13, 28], [-5, 25], [0, 30], [7, 24], [7, 3]], palette.dark);
    g.lineStyle(1, palette.light, 0.6).lineBetween(-4, 6, -7, 23);
    if (team === 'red') polygon(g, [[-5, 25], [-1, 18], [2, 28]], palette.light, palette.light, 0);
    else g.lineStyle(1.2, GOLD, 0.7).lineBetween(3, 8, 2, 24);
  });
  if (archer) {
    drawing(scene, body, g => {
      polygon(g, [[-14, -48], [-8, -47], [-10, -27], [-16, -28]], 0x705138);
      g.lineStyle(1.2, 0xc1ac82).lineBetween(-12, -46, -15, -62).lineBetween(-10, -47, -11, -63).lineBetween(-8, -46, -8, -60);
      polygon(g, [[-15, -61], [-18, -65], [-12, -63]], palette.light, INK, 0.6);
      polygon(g, [[-11, -62], [-14, -66], [-8, -64]], GOLD, INK, 0.6);
    });
  }
  const backLeg = makeLeg(scene, body, -5, heavy, palette.metal);
  const backArm = makeArm(scene, body, archer ? -2 : -7, -48, heavy, archer ? palette.dark : palette.cloth);
  const torso = group(scene, body, 0, -41);
  drawing(scene, torso, g => {
    polygon(g, [[-10, -13], [8, -13], [11, 10], [-10, 10]], archer ? palette.cloth : palette.metal);
    polygon(g, [[-9, 5], [10, 5], [12, 18], [3, 15], [-4, 18], [-11, 15]], palette.cloth);
    if (heavy) {
      polygon(g, [[-11, -12], [0, -15], [11, -12], [8, 4], [0, 9], [-9, 4]], palette.metal);
      g.lineStyle(1, LIGHT, 0.8).lineBetween(-7, -9, 0, -11).lineBetween(0, -11, 7, -8);
      g.lineStyle(1, 0x52687b).lineBetween(0, -10, 0, 4);
      rounded(g, -12, -13, 8, 8, 2, STEEL);
      rounded(g, 5, -13, 9, 8, 2, STEEL);
    } else if (!archer) {
      polygon(g, [[-3, -12], [4, -12], [4, 13], [-3, 15]], palette.cloth, palette.cloth, 0);
      g.lineStyle(1, LIGHT, 0.6).lineBetween(-7, -9, -7, 0);
    } else {
      g.lineStyle(3, 0x6f4938).lineBetween(-8, -11, 7, 8);
      g.lineStyle(1, 0xc4aa80).lineBetween(-8, -12, 8, 7);
    }
    rounded(g, -10.5, 6.5, 22, 4, 1, 0x473937);
    g.fillStyle(GOLD).fillRect(-1.5, 6.5, 5, 4);
    if (!archer) emblem(g, team, 1, -4, heavy ? 4.5 : 3.2);
  });
  const frontLeg = makeLeg(scene, body, 5.5, heavy, palette.metal);
  // Keep the front thigh under the belt and tabard while its boot remains independent.
  body.moveBelow(frontLeg.upper, torso);
  const head = group(scene, body, 0, heavy ? -64 : -62);
  drawing(scene, head, g => {
    g.fillStyle(SKIN).fillEllipse(1, 1, 17, 19);
    g.lineStyle(1.5, INK).strokeEllipse(1, 1, 17, 19);
    g.fillStyle(0xc58d6b).fillEllipse(-5, 2, 4, 6);
    polygon(g, [[7, -1], [11, 3], [6, 4]], SKIN, INK, 0.8);
    g.fillStyle(INK).fillCircle(6, 0, 1.3);
    g.lineStyle(1.2, INK).lineBetween(3, -3, 7, -3.7);
    g.lineStyle(1, 0x815f56).lineBetween(4, 7, 7.5, 6.5);
    if (archer) {
      polygon(g, [[-11, 6], [-11, -7], [-3, -15], [6, -12], [11, -3], [5, -6], [-2, -7], [-5, 3], [-1, 11]], palette.dark);
      g.lineStyle(1, palette.light, 0.75).lineBetween(-8, -5, -1, -12).lineBetween(-1, -12, 5, -10);
      if (team === 'red') g.fillStyle(GOLD).fillCircle(-5.5, 5.5, 2.2);
      else polygon(g, [[-8, 4], [-5, 9], [-2, 4]], LIGHT, LIGHT, 0);
    } else if (heavy) {
      polygon(g, [[-11, 7], [-11, -7], [-6, -13], [7, -12], [12, -5], [11, 9], [3, 13], [-6, 10]], palette.metal);
      polygon(g, [[-7, -3], [10, -3], [10, 3], [-7, 3]], 0x26394d);
      g.lineStyle(1.3, GOLD).lineBetween(-7, -1, 9, -1);
      g.lineStyle(1.3, LIGHT, 0.8).lineBetween(-6, -9, 5, -9).lineBetween(4, 5, 4, 10);
      g.fillStyle(0x44576c).fillCircle(-4, 6, 1).fillCircle(0, 7, 1).fillCircle(8, 6, 1);
      if (team === 'red') polygon(g, [[-5, -12], [-8, -22], [4, -23], [10, -17], [1, -15]], palette.light);
      else {
        polygon(g, [[-8, -10], [-17, -14], [-14, -6], [-9, -3]], LIGHT);
        polygon(g, [[-2, -13], [3, -22], [7, -12]], palette.light);
      }
    } else {
      polygon(g, [[-10, 3], [-10, -6], [-5, -12], [5, -12], [11, -6], [10, -1], [-5, -1], [-5, 6]], palette.metal);
      g.lineStyle(1, LIGHT, 0.85).lineBetween(-6, -8, 4, -9);
      if (team === 'red') {
        polygon(g, [[-4, -12], [-6, -20], [7, -19], [13, -12], [3, -14]], palette.light);
        polygon(g, [[3, -1], [5, -1], [5, 7], [3, 6]], 0x8395a5, INK, 0.7);
      } else {
        polygon(g, [[-6, -11], [-14, -15], [-12, -7], [-6, -5]], LIGHT);
        polygon(g, [[2, -12], [5, -17], [8, -11]], palette.light);
      }
    }
  });
  const frontArm = makeArm(scene, body, heavy ? 10 : 7, -48, heavy, archer ? palette.cloth : palette.metal);
  const weapon = group(scene, frontArm.hand);
  let bow: Container | undefined;
  let bowString: Graphics | undefined;
  let arrow: Graphics | undefined;
  if (archer) {
    bow = group(scene, body, 17.5, -43);
    drawing(scene, bow, g => {
      g.lineStyle(3.3, 0xb7874e);
      g.beginPath();g.moveTo(0, -19);g.lineTo(5, -14);g.lineTo(8, -5);g.lineTo(8.5, 3);g.lineTo(5, 14);g.lineTo(0, 19);g.strokePath();
      g.lineStyle(1, GOLD, 0.9).lineBetween(5, -13, 7, -7).lineBetween(7, 7, 5, 13);
      rounded(g, 6, -4.5, 4, 9, 1, 0x655041);
    });
    bowString = drawing(scene, bow, () => {});
    arrow = drawing(scene, bow, g => {
      g.lineStyle(1.5, 0xe1c69c).lineBetween(-17, 0, 24, 0);
      polygon(g, [[24, 0], [18, -3], [19.5, 0], [18, 3]], LIGHT, INK, 0.6);
      polygon(g, [[-14, 0], [-18, -3], [-23, -3], [-19, 0], [-23, 3], [-18, 3]], palette.light, INK, 0.5);
    });
  } else {
    const length = heavy ? 36 : 25;
    drawing(scene, weapon, g => {
      polygon(g, [[-2.6, -7], [-2.4, -length], [0, -length - 7], [3, -length], [2.7, -7]], STEEL);
      polygon(g, [[0, -length - 5], [2, -length], [1.5, -8], [0, -8]], LIGHT, LIGHT, 0);
      g.fillStyle(0x5d4335).fillRoundedRect(-2, -6, 4, 12, 1);
      rounded(g, -8, -8, 16, 3.7, 1, GOLD);
      g.fillStyle(GOLD).fillCircle(0, 7, 3);
      if (heavy) g.fillStyle(palette.light).fillCircle(0, -6, 2.1);
    });
    const shield = group(scene, backArm.hand, -2, 0);
    drawing(scene, shield, g => {
      if (team === 'red') {
        g.fillStyle(palette.cloth).fillCircle(0, 0, heavy ? 14 : 11.5);
        g.lineStyle(2.5, GOLD).strokeCircle(0, 0, heavy ? 14 : 11.5);
        g.lineStyle(1, palette.light).strokeCircle(0, 0, heavy ? 10.5 : 8.5);
        emblem(g, team, 0, 0, heavy ? 7.5 : 6);
      } else {
        const s = heavy ? 1.15 : 1;
        polygon(g, [[-11 * s, -11 * s], [10 * s, -11 * s], [10 * s, 3 * s], [0, 16 * s], [-11 * s, 3 * s]], palette.cloth, LIGHT, 2);
        polygon(g, [[-8 * s, -8 * s], [0, -8 * s], [0, 12 * s], [-8 * s, 2 * s]], palette.dark, palette.dark, 0);
        emblem(g, team, 0, 0, 6.2 * s);
      }
    });
  }
  const impact = drawing(scene, body, g => {
    g.fillStyle(0xffcfaa).fillEllipse(0, -40, 26, 39).fillCircle(1, -62, 12);
  }).setAlpha(0);

  let lastState: Pose = 'idle';
  let stateStarted = 0;
  function pose(state: Pose, t: number, direction: number): void {
    if (!Number.isFinite(t)) t = 0;
    if (state !== lastState) { lastState = state; stateStarted = t; }
    const elapsed = Math.max(0, t - stateStarted);
    const facing = direction < 0 ? -1 : 1;
    root.scaleX = Math.max(0.001, Math.abs(root.scaleX)) * facing;
    const walk = state === 'walk';
    const stride = Math.sin(t * (heavy ? 10 : 13));
    const breathe = Math.sin(t * 3.2);
    body.setPosition(0, walk ? -Math.abs(stride) * 2.4 : -breathe * 0.7);
    body.rotation = 0;
    body.alpha = 1;
    shadow.setScale(1, 1).setAlpha(1);
    cape.rotation = (walk ? -0.12 + Math.sin(t * 10) * 0.1 : Math.sin(t * 3.7) * 0.055);
    backLeg.upper.rotation = walk ? -stride * 0.58 : 0.08;
    frontLeg.upper.rotation = walk ? stride * 0.58 : -0.08;
    backLeg.lower.rotation = walk ? Math.max(0, stride) * 0.95 : 0.02;
    frontLeg.lower.rotation = walk ? Math.max(0, -stride) * 0.95 : 0.02;
    backArm.upper.rotation = walk ? stride * 0.28 + 0.25 : 0.2;
    backArm.lower.rotation = -0.18;
    frontArm.upper.rotation = walk ? -stride * 0.24 - 0.35 : -0.36;
    frontArm.lower.rotation = -0.28;
    weapon.rotation = 0.9;
    head.rotation = walk ? stride * 0.025 : breathe * 0.018;
    impact.alpha = 0;
    let pull = 0;
    if (archer) {
      frontArm.upper.rotation = -1.3;
      frontArm.lower.rotation = -0.05;
      backArm.upper.rotation = -1.0;
      backArm.lower.rotation = -1.45;
      if (bow) bow.rotation = walk ? stride * 0.035 : 0;
    }
    if (state === 'attack') {
      const phase = (elapsed % (archer ? 0.86 : heavy ? 0.8 : 0.65)) / (archer ? 0.86 : heavy ? 0.8 : 0.65);
      if (archer) {
        pull = phase < 0.7 ? Math.sin(phase / 0.7 * Math.PI / 2) : Math.max(0, 1 - (phase - 0.7) / 0.12);
        backArm.upper.rotation = -0.7 - pull * 0.65;
        backArm.lower.rotation = -1.3 - pull * 0.75;
        if (arrow) arrow.visible = phase < 0.73;
        head.rotation = -0.06;
      } else {
        const windup = phase < 0.32 ? phase / 0.32 : phase < 0.62 ? 1 - (phase - 0.32) / 0.3 : 0;
        const follow = phase >= 0.32 && phase < 0.75 ? Math.sin((phase - 0.32) / 0.43 * Math.PI) : 0;
        frontArm.upper.rotation = -0.35 - windup * 1.85 + follow * 1.0;
        frontArm.lower.rotation = -0.3 - windup * 0.8;
        weapon.rotation = 0.9 + follow * 0.65;
        body.rotation = -windup * 0.1 + follow * 0.13;
        backArm.upper.rotation = 0.35;
        frontLeg.upper.rotation = -0.18;
      }
    } else if (state === 'hurt') {
      const kick = Math.max(0, 1 - elapsed / 0.38);
      body.rotation = -0.18 * kick;
      body.x = -Math.sin(Math.min(1, elapsed / 0.38) * Math.PI) * 5;
      head.rotation = -0.13 * kick;
      frontArm.upper.rotation = -0.7;
      impact.alpha = kick * 0.48;
    } else if (state === 'death') {
      const fall = Phaser.Math.Clamp(elapsed / 0.62, 0, 1);
      const eased = 1 - (1 - fall) ** 3;
      body.rotation = -Math.PI / 2 * eased;
      body.y = -2 + Math.sin(fall * Math.PI) * -4;
      body.alpha = 1 - fall * 0.45;
      backLeg.upper.rotation = 0.35 + fall * 0.25;
      frontLeg.upper.rotation = -0.25;
      frontLeg.lower.rotation = fall * 0.5;
      frontArm.upper.rotation = -0.2 + fall * 0.8;
      backArm.upper.rotation = fall * 0.6;
      shadow.setScale(1 + fall * 0.65, 1).setAlpha(1 - fall * 0.5);
    }
    if (bow && state !== 'death' && state !== 'hurt') {
      // Solve both elbow joints so the front hand grips the wood and the rear hand
      // actually pulls the string, instead of merely moving the weapon artwork.
      aimArm(frontArm, bow.x + 8, bow.y, 1);
      aimArm(backArm, bow.x - 13 * pull, bow.y, -1);
    }
    if (bowString) {
      bowString.clear().lineStyle(1.1, 0xf1dfb4, 0.95);
      bowString.beginPath();bowString.moveTo(0, -19);bowString.lineTo(-13 * pull, 0);bowString.lineTo(0, 19);bowString.strokePath();
    }
    if (arrow) {
      arrow.x = -13 * pull;
      if (state !== 'attack') arrow.visible = state !== 'death';
    }
  }
  pose('idle', 0, 1);
  return { root, pose };
}

function arch(g: Graphics, x: number, floor: number, width: number, height: number, color: number, outline = INK, strokeWidth = 1.8): void {
  const radius = width / 2;
  const centerY = floor - height + radius;
  const vertices: Point[] = [[x - radius, floor], [x - radius, centerY]];
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI + i / 16 * Math.PI;
    vertices.push([x + Math.cos(a) * radius, centerY + Math.sin(a) * radius]);
  }
  vertices.push([x + radius, floor]);
  polygon(g, vertices, color, outline, strokeWidth);
}

function stoneWall(g: Graphics, x: number, y: number, width: number, height: number, color: number, light: number): void {
  rounded(g, x, y, width, height, 2, color);
  const rowH = 13;
  for (let row = 0; row < Math.ceil(height / rowH); row++) {
    const yy = y + row * rowH;
    const offset = row % 2 ? 13 : 0;
    for (let col = -1; col < Math.ceil(width / 27); col++) {
      const xx = x + col * 27 + offset;
      const left = Math.max(x + 1.5, xx + 1);
      const right = Math.min(x + width - 1.5, xx + 25);
      const bottom = Math.min(y + height - 1, yy + 11);
      if (right <= left || bottom <= yy) continue;
      if ((row * 13 + col * 7) % 5 === 0) g.fillStyle(light, 0.24).fillRect(left, yy + 1, right - left, bottom - yy - 1);
      g.lineStyle(1, INK, 0.22).lineBetween(left, bottom, right, bottom).lineBetween(right, yy + 1, right, bottom);
      g.lineStyle(1, light, 0.48).lineBetween(left, yy + 1.5, right - 1, yy + 1.5);
    }
  }
  g.lineStyle(2, light, 0.75).lineBetween(x + 2, y + 2, x + 2, y + height - 3);
  g.lineStyle(3, INK, 0.2).lineBetween(x + width - 2, y + 1, x + width - 2, y + height - 1);
}

function roof(g: Graphics, x: number, baseY: number, halfWidth: number, height: number, team: Team): void {
  const p = PALETTES[team];
  polygon(g, [[x - halfWidth, baseY], [x, baseY - height], [x + halfWidth, baseY]], p.roof, INK, 2);
  polygon(g, [[x, baseY - height], [x + halfWidth, baseY], [x + 3, baseY]], p.dark, p.dark, 0);
  for (let i = 1; i < 6; i++) {
    const d = i / 6;
    const yy = baseY - height + height * d;
    g.lineStyle(1.2, team === 'red' ? 0xe17b61 : 0x65a5c3, 0.8).lineBetween(x - halfWidth * d + 2, yy, x + halfWidth * d - 2, yy);
    const n = Math.max(1, i - 1);
    for (let j = 1; j <= n; j++) {
      const xx = x - halfWidth * d + (2 * halfWidth * d) * j / (n + 1);
      g.lineStyle(0.8, INK, 0.4).lineBetween(xx, yy, xx + (j % 2 ? 1 : -1), yy + height / 7);
    }
  }
  g.lineStyle(2, GOLD, 0.85).lineBetween(x - halfWidth, baseY, x + halfWidth, baseY);
}

/** hp accepts a 0..1 health fraction or 0..100 percentage. time is seconds; flags also animate on scene update. */
export function createCastle(scene: Phaser.Scene, team: Team): {
  root: Container;
  damage: (hp: number, time: number) => void;
} {
  const p = PALETTES[team];
  const root = scene.add.container(0, 0).setSize(245, 262);
  root.setData({ team, kind: 'castle' });
  drawing(scene, root, g => g.fillStyle(0x111b2c, 0.25).fillEllipse(0, -1, 252, 20));
  drawing(scene, root, g => {
    // A terraced plinth, buttresses and alternating bricks give the castle mass.
    polygon(g, [[-124, 0], [-121, -12], [-106, -17], [105, -17], [120, -12], [124, 0]], 0x657685);
    g.lineStyle(2, p.stoneLight, 0.8).lineBetween(-120, -10, 118, -10);
    stoneWall(g, -85, -170, 170, 158, p.stone, p.stoneLight);
    stoneWall(g, -49, -190, 98, 167, p.stone, p.stoneLight);
    for (const x of [-63, 56]) {
      polygon(g, [[x, -13], [x + 13, -13], [x + 9, -109], [x + 3, -109]], 0x6e808a);
      g.lineStyle(1.2, p.stoneLight).lineBetween(x + 3, -106, x + 3, -16);
    }
    for (let i = 0; i < 5; i++) {
      rounded(g, -50 + i * 22, -199, 14, 18, 1, p.stoneLight);
      g.lineStyle(1, LIGHT, 0.75).lineBetween(-48 + i * 22, -197, -39 + i * 22, -197);
    }
    g.lineStyle(3, 0x596d7a).lineBetween(-51, -177, 51, -177);
    g.lineStyle(2, p.stoneLight).lineBetween(-50, -174, 50, -174);
    for (const x of [-91, 91]) {
      stoneWall(g, x - 24, -192, 48, 178, p.stone, p.stoneLight);
      // Tower bands and inset windows distinguish them from a flat silhouette.
      rounded(g, x - 27, -190, 54, 8, 1, p.stoneLight);
      rounded(g, x - 25, -56, 50, 7, 1, 0x6a7b88);
      roof(g, x, -193, team === 'red' ? 34 : 32, team === 'red' ? 44 : 55, team);
      arch(g, x, -103, 12, 36, 0x26394b);
      arch(g, x + 1, -106, 5.5, 29, 0xe1bc72, 0xe1bc72, 0);
      g.lineStyle(1, INK, 0.8).lineBetween(x, -134, x, -105);
      arch(g, x, -34, 7, 20, 0x2c4051);
      g.lineStyle(1, p.stoneLight, 0.8).lineBetween(x - 6, -33, x + 6, -33);
    }
    // Gate surround uses real arch geometry, separate wooden boards and ironwork.
    arch(g, 0, -13, 65, 94, p.stoneLight, INK, 2);
    arch(g, 0, -13, 49, 83, 0x604332, INK, 2);
    for (let x = -20; x <= 20; x += 8) {
      const gateTop = -71 - Math.sqrt(Math.max(0, 24.5 ** 2 - x ** 2));
      g.lineStyle(1, 0xb28a59, 0.7).lineBetween(x, gateTop + 2, x, -15);
    }
    for (const yy of [-67, -35]) {
      g.lineStyle(4, 0x27394a).lineBetween(-23, yy, 23, yy);
      g.fillStyle(0xb1b4aa).fillCircle(-19, yy, 1).fillCircle(19, yy, 1);
    }
    g.lineStyle(1.5, GOLD).strokeCircle(4, -49, 3.2);
    g.lineStyle(1, 0xc8a678).lineBetween(0, -89, 0, -15);
    // Banners and coat of arms are physically part of the architecture.
    polygon(g, [[-18, -167], [18, -167], [18, -123], [0, -112], [-18, -123]], p.cloth);
    g.lineStyle(1, GOLD).lineBetween(-14, -162, 14, -162);
    emblem(g, team, 0, -143, 10);
    for (const x of [-32, 32]) {
      arch(g, x, -123, 10, 27, 0x283a4c);
      g.lineStyle(1.5, GOLD).lineBetween(x, -146, x, -126);
    }
    // Individual arch voussoirs and masonry chips catch the warm light.
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (i + 0.5) / 9 * Math.PI;
      const x = Math.cos(a) * 29;
      const y = -74 + Math.sin(a) * 29;
      g.lineStyle(1.2, 0x6a777e, 0.65).lineBetween(x * 0.92, y + 2, x * 1.12, y - 3);
    }
  });
  const flags: { cloth: Graphics; x: number; phase: number }[] = [];
  for (const [i, x] of [-91, 91].entries()) {
    const flag = group(scene, root, x, team === 'red' ? -237 : -248);
    drawing(scene, flag, g => {
      g.lineStyle(2, 0x716551).lineBetween(0, 1, 0, -26);
      g.lineStyle(0.8, GOLD).lineBetween(-0.7, 0, -0.7, -26);
      g.fillStyle(GOLD).fillCircle(0, -28, 2.8);
    });
    const cloth = drawing(scene, flag, () => {});
    flags.push({ cloth, x, phase: i * 1.9 });
  }
  const cracks = drawing(scene, root, g => {
    g.lineStyle(2.2, 0x25394b, 0.85);
    const paths: readonly Point[][] = [
      [[-70, -167], [-62, -150], [-69, -139], [-58, -124], [-62, -111]],
      [[70, -116], [61, -103], [66, -89], [57, -73]],
      [[25, -187], [20, -173], [29, -162]],
      [[-104, -67], [-96, -56], [-101, -43], [-90, -37]],
    ];
    for (const points of paths) {
      g.beginPath();g.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) g.lineTo(points[i][0], points[i][1]);
      g.strokePath();
    }
    g.fillStyle(0x394c58, 0.7).fillTriangle(-48, -190, -40, -178, -34, -190).fillTriangle(99, -187, 110, -177, 113, -187);
  }).setAlpha(0);
  const smoke = group(scene, root);
  const puffs: Graphics[] = [];
  for (let i = 0; i < 9; i++) {
    puffs.push(drawing(scene, smoke, g => {
      g.fillStyle(i % 2 ? 0x5c6978 : 0x80909a, 0.65).fillCircle(0, 0, 9 + i % 3 * 3);
      g.fillStyle(0xa3adb0, 0.24).fillCircle(-3, -3, 6 + i % 3);
    }));
  }
  const debris = group(scene, root);
  const stones: Graphics[] = [];
  for (let i = 0; i < 6; i++) stones.push(drawing(scene, debris, g => polygon(g, [[-4, -3], [2, -4], [5, 1], [0, 4], [-4, 2]], i % 2 ? p.stone : p.stoneLight, INK, 0.8)));
  const flash = drawing(scene, root, g => {
    g.lineStyle(3, 0xffbb86, 0.85).strokeRoundedRect(-116, -191, 232, 179, 3);
  }).setAlpha(0);
  let health = 1;
  let hitAt = -Infinity;
  function animate(time: number): void {
    for (const flag of flags) {
      const wave = Math.sin(time * 5 + flag.phase);
      const tip = Math.sin(time * 5 + flag.phase + 1.4);
      const cloth = flag.cloth;
      cloth.clear();
      if (team === 'red') {
        polygon(cloth, [[1, -25], [14, -26 + wave * 1.7], [29, -23 + tip * 2], [24, -16 + tip * 2], [29, -9 + tip * 2], [14, -11 + wave * 1.7], [1, -10]], p.cloth, INK, 1);
        cloth.lineStyle(1, p.light, 0.8).lineBetween(3, -23, 15, -24 + wave);
        emblem(cloth, team, 12, -18 + wave, 3.5);
      } else {
        polygon(cloth, [[1, -25], [16, -24 + wave * 1.8], [32, -25 + tip * 2], [24, -17 + tip], [31, -9 + tip * 2], [15, -10 + wave * 1.8], [1, -10]], p.cloth, INK, 1);
        cloth.lineStyle(1.1, LIGHT, 0.75).lineBetween(3, -23, 15, -22 + wave);
        emblem(cloth, team, 12, -17.5 + wave, 3.5);
      }
    }
    const damageLevel = 1 - health;
    cracks.alpha = health < 0.82 ? Math.min(1, damageLevel * 1.4) : 0;
    const smokeStrength = Phaser.Math.Clamp((0.72 - health) / 0.65, 0, 1);
    smoke.visible = smokeStrength > 0;
    puffs.forEach((puff, i) => {
      const phase = (time * (0.31 + i % 3 * 0.03) + i / puffs.length) % 1;
      const originX = i % 2 ? -70 : 57;
      puff.setPosition(originX + Math.sin(phase * 4 + i) * 11 + phase * 18, -178 - phase * 94);
      puff.setScale(0.5 + phase * 1.1);
      puff.alpha = smokeStrength * Math.sin(phase * Math.PI) * 0.8;
    });
    const hitAge = scene.time.now / 1000 - hitAt;
    flash.alpha = Math.max(0, 1 - hitAge / 0.24) * 0.8;
    debris.visible = hitAge >= 0 && hitAge < 0.75;
    stones.forEach((stone, i) => {
      const a = Math.max(0, hitAge);
      stone.setPosition((i % 2 ? -78 : 78) + (i - 2.5) * a * 17, -125 - Math.sin(i) * 17 - a * 43 + a * a * 210);
      stone.rotation = a * (i % 2 ? -6 : 5);
      stone.alpha = Math.max(0, 1 - a / 0.75);
    });
  }
  const onUpdate = (time: number): void => animate(time / 1000);
  scene.events.on('update', onUpdate);
  root.once('destroy', () => scene.events.off('update', onUpdate));
  function damage(hp: number, time: number): void {
    const next = Phaser.Math.Clamp(Number.isFinite(hp) ? (hp > 1 ? hp / 100 : hp) : 1, 0, 1);
    if (next < health) hitAt = scene.time.now / 1000;
    health = next;
    animate(Number.isFinite(time) ? time : scene.time.now / 1000);
  }
  damage(1, 0);
  return { root, damage };
}
