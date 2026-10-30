import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const root = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(root, '../..');
const source = await fs.readFile(path.join(root, 'index.html'), 'utf8');
const css = await fs.readFile(path.join(root, 'styles.css'), 'utf8');
// Reuse the already-vendored MIT Three.js library; no network at runtime.
const files = [path.join(repo, 'site/magic-24/three.min.js'), path.join(root, 'model.js'), path.join(root, 'app.js')];
let html = source.replace('<link rel="stylesheet" href="styles.css">', () => '<style>' + css + '</style>');
for (const [i, name] of ['vendor/three.min.js', 'model.js', 'app.js'].entries()) {
  const code = await fs.readFile(files[i], 'utf8'); new vm.Script(code, { filename: name });
  html = html.replace('<script src="' + name + '"></script>', () => '<script>\n' + code.replace(/<\/script/gi, '<\\/script') + '\n</script>');
}
const destination = path.join(repo, 'site/cube-rotation'); await fs.mkdir(destination, { recursive: true });
await fs.writeFile(path.join(destination, 'index.html'), html);
const offline = path.resolve(repo, '../../当当老师-魔方旋转室（离线版）.html');
await fs.writeFile(offline, html);
console.log(JSON.stringify({ website: path.join(destination, 'index.html'), offline, bytes: Buffer.byteLength(html) }, null, 2));
