import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
let html = await readFile(path.join(dist, 'index.html'), 'utf8');

function assetPath(url) {
  const relative = decodeURIComponent(url.replace(/^\//, ''));
  const resolved = path.resolve(dist, relative);
  if (!resolved.startsWith(`${dist}${path.sep}`)) throw new Error('Asset path escapes the build directory.');
  return resolved;
}

const cssLinks = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)];
if (!cssLinks.length) throw new Error('Build the application before creating the standalone preview.');
for (const [tag] of cssLinks) {
  const href = tag.match(/href="([^"]+)"/)?.[1];
  if (!href) throw new Error('A stylesheet has no asset path.');
  const cssFile = assetPath(href);
  let css = await readFile(cssFile, 'utf8');
  const fontUrls = [...new Set([...css.matchAll(/url\((?:["']?)([^)"']+)(?:["']?)\)/g)].map(match => match[1]))];
  for (const url of fontUrls) {
    if (url.startsWith('data:')) continue;
    if (/^(https?:)?\/\//.test(url)) throw new Error(`The preview must not depend on external asset: ${url}`);
    const file = url.startsWith('/') ? assetPath(url) : path.resolve(path.dirname(cssFile), url);
    if (!file.startsWith(`${dist}${path.sep}`)) throw new Error('Font path escapes the build directory.');
    const bytes = await readFile(file);
    const type = file.endsWith('.woff2') ? 'font/woff2' : 'font/woff';
    css = css.split(url).join(`data:${type};base64,${bytes.toString('base64')}`);
  }
  html = html.replace(tag, () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`);
}

const scriptTags = [...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g)];
if (scriptTags.length !== 1) throw new Error('Expected one self-contained application bundle.');
let js = await readFile(assetPath(scriptTags[0][1]), 'utf8');
// Parse as a classic script: unresolved imports would require a server again.
new Script(js);
html = html.replace(scriptTags[0][0], '');
html = html.replace(/<link\b[^>]*rel="modulepreload"[^>]*>/g, '');

// Include a real dashboard, not an empty root, for script-restricted file viewers.
// This stub is used only while rendering the empty preview; it never reads user data.
const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
const server = await createServer({ root, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
let fallback;
try {
  const { default: App } = await server.ssrLoadModule('/src/App.tsx');
  fallback = renderToStaticMarkup(createElement(App));
} finally {
  await server.close();
  if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor);
  else Reflect.deleteProperty(globalThis, 'localStorage');
}
html = html.replace('<div id="root"></div>', () => `<p id="standalone-help" style="position:fixed;top:0;left:0;right:0;z-index:1000;margin:0;padding:10px 16px;background:#eaf0e5;color:#294c3b;font:13px/1.5 system-ui;text-align:center">仪表盘预览。如需使用记录功能，请下载此 HTML 文件，并在 Chrome 或 Edge 中打开。</p><div id="root">${fallback}</div>`);
js += '\nrequestAnimationFrame(() => document.getElementById("standalone-help")?.remove());\n';
html = html.replace('</body>', () => `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>\n</body>`);

const output = path.join(root, 'daywell-preview.html');
await writeFile(output, html, { mode: 0o644 });
console.log(`Standalone preview created: ${output} (${Math.round(Buffer.byteLength(html) / 1024)} KiB)`);
