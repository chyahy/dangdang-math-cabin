const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(__dirname + '/model.js', 'utf8'), context);
const { Cube, FACES, inverse, parse } = context.CubeMath;
function invariant(cube) {
  assert.equal(cube.cubies.length, 26);
  const stickers = cube.stickers(); assert.equal(stickers.length, 54);
  assert.equal(new Set(cube.cubies.map(c => c.pos.join(','))).size, 26);
  assert.equal(new Set(stickers.map(s => s.pos.join(',') + ':' + s.normal.join(','))).size, 54);
  for (const c of cube.cubies) for (const s of c.stickers) {
    assert.equal(s.normal.reduce((v, n) => v + Math.abs(n), 0), 1);
    const axis = s.normal.findIndex(n => n !== 0); assert.equal(c.pos[axis], s.normal[axis]);
    assert.ok(c.pos.every(Number.isInteger));
  }
}
const cube = new Cube(), initial = cube.snapshot(); invariant(cube);
for (const f of Object.keys(FACES)) {
  for (let i = 0; i < 4; i++) cube.turn(f);
  assert.equal(cube.snapshot(), initial, f + ' four turns');
  cube.turn(f); cube.turn(inverse(f)); assert.equal(cube.snapshot(), initial, f + ' inverse');
  cube.turn(f + '2'); cube.turn(f + '2'); assert.equal(cube.snapshot(), initial, f + ' half turns');
}
for (const token of parse(Array(6).fill("R U R' U'").join(' '))) cube.turn(token);
assert.equal(cube.snapshot(), initial, 'six sexy-move repetitions');
const moves = [];
for (let i = 0; i < 1500; i++) {
  const f = Object.keys(FACES)[Math.floor(Math.random() * 6)] + ['', "'", '2'][Math.floor(Math.random() * 3)];
  moves.push(f); cube.turn(f); invariant(cube);
}
for (const m of moves.reverse()) cube.turn(inverse(m));
assert.equal(cube.snapshot(), initial, '1500 moves undone exactly'); assert.equal(cube.solved(), true);
assert.equal(parse('r U′ F2').join(' '), "R U' F2");
assert.throws(() => parse('R <script>')); assert.throws(() => parse('R3')); assert.throws(() => parse(''));
console.log('PASS: all six faces, four-turn identity, inverses, half turns, six cycles, 1500 random moves with exact undo, physical sticker invariants, parser.');
