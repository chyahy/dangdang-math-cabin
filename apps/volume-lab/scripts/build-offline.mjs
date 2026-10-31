import { build } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
const root = fileURLToPath(new URL('../', import.meta.url));
const destination = process.argv[2] ? resolve(process.argv[2]) : resolve(root, 'dist-offline/index.html');
const result = await build({
  root, configFile: resolve(root, 'vite.config.ts'),
  build: { write: false, emptyOutDir: false, cssCodeSplit: false, modulePreload: false,
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true, entryFileNames: 'volume-lab.js' } } },
});
const files = (Array.isArray(result) ? result : [result]).flatMap(bundle => bundle.output);
const asset = files.find(f => f.type === 'asset' && f.fileName === 'index.html');
const js = files.filter(f => f.type === 'chunk').map(f => f.code).join('\n');
const css = files.filter(f => f.type === 'asset' && f.fileName.endsWith('.css')).map(f => String(f.source)).join('\n');
if (!asset || asset.type !== 'asset' || !js || !css) throw new Error('Incomplete offline bundle');
const html = String(asset.source)
  .replace(/<script\b[^>]*\bsrc=[^>]*>\s*<\/script>/g, '')
  .replace(/<link\b[^>]*\brel="(?:stylesheet|modulepreload)"[^>]*>/g, '')
  .replace('</head>', () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>\n</head>`)
  .replace('</body>', () => `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>\n</body>`);
if (/<(?:script|link)\b[^>]*(?:src|href)=["'][^"']*\.(?:js|css)/i.test(html)) throw new Error('External resource remains');
for (const [, body] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new Script(body);
await mkdir(dirname(destination), { recursive: true }); await writeFile(destination, html);
console.log(`Offline HTML: ${destination}\nBytes: ${Buffer.byteLength(html)}`);
