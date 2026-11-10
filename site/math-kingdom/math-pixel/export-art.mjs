/** Offline deterministic PNG export. No browser, network, native add-on or API. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import ts from 'typescript';

const out = path.dirname(fileURLToPath(import.meta.url));
const app = path.resolve(out, '../..');
const filename = path.join(app, 'src/scenes/art.ts');
const source = (await fs.readFile(filename, 'utf8'))
  .replace(/import Phaser from ['"]phaser['"];?/, 'const Phaser = {Math:{Clamp:(v,min,max)=>Math.max(min,Math.min(max,v))}};')
  + '\nexport {Pixels, fighterFrame, castleFrame, FW, FH, ORIGIN_X, FOOT_Y, COUNTS, STATES};';
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const art = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

class Surface {
  constructor(width, height) { this.width = width;this.height = height;this.data = new Uint8Array(width * height * 4);this.fillStyle = '#000000';this.imageSmoothingEnabled = false; }
  fillRect(x, y, w, h) {
    const hex = this.fillStyle.slice(1), r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16), a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) : 255;
    for (let yy = Math.max(0, Math.floor(y)); yy < Math.min(this.height, Math.ceil(y + h)); yy++) for (let xx = Math.max(0, Math.floor(x)); xx < Math.min(this.width, Math.ceil(x + w)); xx++) {
      const i = (yy * this.width + xx) * 4, oldA = this.data[i + 3] / 255, alpha = a / 255, combined = alpha + oldA * (1 - alpha);
      if (!combined) continue;
      this.data[i] = Math.round((r * alpha + this.data[i] * oldA * (1 - alpha)) / combined);
      this.data[i + 1] = Math.round((g * alpha + this.data[i + 1] * oldA * (1 - alpha)) / combined);
      this.data[i + 2] = Math.round((b * alpha + this.data[i + 2] * oldA * (1 - alpha)) / combined);
      this.data[i + 3] = Math.round(combined * 255);
    }
  }
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) { let c = n;for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ c >>> 1 : c >>> 1;crcTable[n] = c; }
function chunk(type, data) {
  const name = Buffer.from(type), length = Buffer.alloc(4), crc = Buffer.alloc(4);length.writeUInt32BE(data.length);
  let value = 0xffffffff;for (const byte of Buffer.concat([name, data])) value = crcTable[(value ^ byte) & 255] ^ value >>> 8;
  crc.writeUInt32BE((value ^ 0xffffffff) >>> 0);return Buffer.concat([length, name, data, crc]);
}
function png(surface) {
  const header = Buffer.alloc(13);header.writeUInt32BE(surface.width, 0);header.writeUInt32BE(surface.height, 4);header[8] = 8;header[9] = 6;
  const stride = surface.width * 4, scan = Buffer.alloc((stride + 1) * surface.height);
  for (let y = 0; y < surface.height; y++) Buffer.from(surface.data.buffer, y * stride, stride).copy(scan, y * (stride + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(scan, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
function copy(source, target, sx, sy, w, h, dx, dy, scale = 1) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const si = ((sy + y) * source.width + sx + x) * 4;
    for (let yy = 0; yy < scale; yy++) for (let xx = 0; xx < scale; xx++) {
      const tx = dx + x * scale + xx, ty = dy + y * scale + yy;
      if (tx < 0 || ty < 0 || tx >= target.width || ty >= target.height) continue;
      target.data.set(source.data.subarray(si, si + 4), (ty * target.width + tx) * 4);
    }
  }
}
async function save(name, surface) { await fs.writeFile(path.join(out, name), png(surface)); }
function atlas(frames, image, width, height) { return { frames, meta: { app: '当当老师·数学王国原创像素', image, format: 'RGBA8888', size: { w: width, h: height }, scale: '1' } }; }
function frameData(x, y, w, h) { return { frame: { x, y, w, h }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w, h }, sourceSize: { w, h } }; }

await fs.mkdir(out, { recursive: true });
const total = 26;
const manifest = { version: 1, original: true, pixelScale: 3, filtering: 'NEAREST', smoothing: false, characterFrame: { width: art.FW, height: art.FH, foot: { x: art.ORIGIN_X, y: art.FOOT_Y } }, fighterSets: [], castles: [], arrow: { image: 'arrow.png', width: 20, height: 7, origin: { x: 19, y: 3 } } };
const preview = new Surface(art.FW * 6 * 3, art.FH * 10 * 3);let row = 0;
for (const team of ['red', 'blue']) for (const kind of ['soldier', 'archer', 'knight', 'mage', 'teacher']) {
  const stem = `${team}-${kind}`, sheet = new Surface(art.FW * total, art.FH), frames = {}, states = {};let index = 0;
  for (const state of art.STATES.filter(state => state !== ((kind === 'archer'||kind==='mage'||kind==='teacher') ? 'defend' : 'aim'))) {
    const names = [];
    for (let f = 0; f < art.COUNTS[state]; f++, index++) {
      art.fighterFrame(new art.Pixels(sheet, index * art.FW, 0, art.FW, art.FH), team, kind, state, f);
      const name = `${state}-${f}`;names.push(name);frames[name] = frameData(index * art.FW, 0, art.FW, art.FH);
    }
    states[state] = { frames: names, fps: state === 'walk' ? (kind === 'knight' ? 8 : 10) : state === 'idle' ? 3 : state === 'defend' ? 5 : undefined, duration: { attack: 0.32, hurt: 0.16, death: 0.53, aim: 0.4 }[state], loop: ['idle', 'walk', 'defend'].includes(state) };
  }
  await save(stem + '-sheet.png', sheet);await fs.writeFile(path.join(out, stem + '-sheet.json'), JSON.stringify(atlas(frames, stem + '-sheet.png', sheet.width, sheet.height), null, 2) + '\n');
  const portrait = new Surface(64, 64);copy(sheet, portrait, 8, 0, 32, 32, 0, 0, 2);await save(stem + '.png', portrait);
  const examples = ['idle-0', 'walk-1', 'attack-3', 'hurt-0', 'death-3', (kind === 'archer'||kind==='mage'||kind==='teacher') ? 'aim-3' : 'defend-2'];
  examples.forEach((name, column) => copy(sheet, preview, frames[name].frame.x, 0, art.FW, art.FH, column * art.FW * 3, row * art.FH * 3, 3));row++;
  manifest.fighterSets.push({ team, kind, textureKey: `math-kingdom-pixel-v1-${team}-${kind}`, sheet: stem + '-sheet.png', atlas: stem + '-sheet.json', portrait: stem + '.png', states });
}
for (const team of ['red', 'blue']) {
  const stem = `${team}-castle`, sheet = new Surface(320, 480), frames = {};
  for (let level = 0; level < 5; level++) for (let f = 0; f < 4; f++) {
    art.castleFrame(new art.Pixels(sheet, f * 80, level * 96, 80, 96), team, level, f);
    frames[level === 4 ? `destroy-${f}` : `${level}-${f}`] = frameData(f * 80, level * 96, 80, 96);
  }
  await save(stem + '-sheet.png', sheet);await fs.writeFile(path.join(out, stem + '-sheet.json'), JSON.stringify(atlas(frames, stem + '-sheet.png', 320, 480), null, 2) + '\n');
  manifest.castles.push({ team, sheet: stem + '-sheet.png', atlas: stem + '-sheet.json', width: 80, height: 96, foot: { x: 40, y: 96 }, healthLevels: 4, flagFrames: 4, destroyFrames: 4, destroyDuration: 0.7 });
}
const arrow = new Surface(20, 7), ap = new art.Pixels(arrow, 0, 0, 20, 7);
ap.line(2, 3, 17, 3, '#19283b', 3);ap.line(2, 3, 16, 3, '#c58e4d');
ap.poly([[19, 3], [14, 0], [15, 3], [14, 6]], '#d7e2d3', '#19283b');ap.line(15, 2, 17, 3, '#fff0bb');
ap.poly([[0, 0], [4, 1], [6, 3], [4, 5], [0, 6], [2, 3]], '#74c5d1', '#19283b');ap.line(1, 2, 4, 3, '#fff0bb');
const frost = new Surface(16,11), fp = new art.Pixels(frost,0,0,16,11);
fp.poly([[15,5],[8,0],[3,3],[0,5],[3,7],[8,10]],'#448cb5','#19283b');
fp.poly([[13,5],[8,2],[4,4],[2,5],[4,6],[8,8]],'#94dfef');
fp.line(4,5,12,5,'#e3fbf0');fp.line(8,2,8,8,'#e3fbf0');fp.dot(7,4,'#ffffff');
await save('frost.png', frost);manifest.frost={image:'frost.png',width:16,height:11};
await save('arrow.png', arrow);await save('preview.png', preview);
await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Exported ${manifest.fighterSets.length} original fighter sheets (${total} frames each), ten portraits, two castle sheets (20 frames each), arrow and manifest to ${out}`);
