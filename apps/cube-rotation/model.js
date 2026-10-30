/* Integer-coordinate Rubik's cube model. +X right, +Y up, +Z front. */
(function (root) {
  'use strict';
  const FACES = {
    U: { axis: 1, layer: 1, name: '上面', color: '#f5f1e8' },
    R: { axis: 0, layer: 1, name: '右面', color: '#ff5867' },
    F: { axis: 2, layer: 1, name: '前面', color: '#52da8b' },
    D: { axis: 1, layer: -1, name: '下面', color: '#ffe169' },
    L: { axis: 0, layer: -1, name: '左面', color: '#ffa34f' },
    B: { axis: 2, layer: -1, name: '后面', color: '#548fff' },
  };
  function rotate(v, axis, quarter) {
    let out = [...v];
    for (let i = 0; i < ((quarter % 4) + 4) % 4; i++) {
      const [x, y, z] = out;
      out = axis === 0 ? [x, -z, y] : axis === 1 ? [z, y, -x] : [-y, x, z];
    }
    return out.map(n => n || 0);
  }
  function parse(text) {
    const source = text.replace(/[’′]/g, "'").trim();
    if (!source) throw new Error('请先填写旋转步骤，例如 R U R\' U\'。');
    const tokens = source.split(/[\s,，]+/);
    if (tokens.length > 240) throw new Error('一次最多加载 240 步。');
    return tokens.map(token => {
      const match = /^([URFDLB])([2']?)$/i.exec(token);
      if (!match) throw new Error('无法识别「' + token + '」。请使用 U R F D L B，可接英文单引号或 2。');
      return match[1].toUpperCase() + match[2];
    });
  }
  function moveInfo(token) {
    const face = FACES[token[0]];
    if (!face) throw new Error('Unknown face');
    return { ...face, face: token[0], quarter: -face.layer * (token.endsWith('2') ? 2 : token.endsWith("'") ? -1 : 1) };
  }
  function inverse(token) { return token.endsWith('2') ? token : token.endsWith("'") ? token[0] : token + "'"; }
  class Cube {
    constructor() { this.reset(); }
    reset() {
      this.cubies = [];
      let stickerId = 0;
      for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
        if (!x && !y && !z) continue;
        const pos = [x, y, z], stickers = [];
        for (const [face, f] of Object.entries(FACES)) if (pos[f.axis] === f.layer) {
          const normal = [0, 0, 0]; normal[f.axis] = f.layer;
          stickers.push({ id: stickerId++, color: f.color, face, normal });
        }
        this.cubies.push({ id: this.cubies.length, pos, stickers });
      }
    }
    turn(token) {
      const m = moveInfo(token);
      for (const c of this.cubies) if (c.pos[m.axis] === m.layer) {
        c.pos = rotate(c.pos, m.axis, m.quarter);
        for (const s of c.stickers) s.normal = rotate(s.normal, m.axis, m.quarter);
      }
    }
    solved() {
      return this.cubies.every(c => c.stickers.every(s => s.normal[FACES[s.face].axis] === FACES[s.face].layer));
    }
    snapshot() { return JSON.stringify(this.cubies); }
    stickers() { return this.cubies.flatMap(c => c.stickers.map(s => ({ ...s, pos: c.pos }))); }
  }
  root.CubeMath = { Cube, FACES, rotate, parse, moveInfo, inverse };
})(typeof globalThis === 'undefined' ? window : globalThis);
