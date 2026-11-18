import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const root = process.cwd();
const desktop = !!process.env.SIEGRESS_DESKTOP;
const dist = join(root, desktop ? 'dist-desktop' : 'dist');
const runtimeModels = new Set(['monster/MuffinMan-torso-linked.glb']);
const keepModel = path => runtimeModels.has(relative(join(root, 'assets'), path).split(sep).join('/'));

async function exists(path) {
  try { await stat(path); return true; } catch { return false; }
}

async function copyDirIfPresent(from, to, options = {}) {
  if (!(await exists(from))) return;
  await cp(from, to, {
    recursive: true,
    force: true,
    filter: (src) => {
      if (options.skipGlbs && src.toLowerCase().endsWith('.glb') && !keepModel(src)) return false;
      return true;
    }
  });
}

async function removeGlbsRecursive(dir) {
  if (!(await exists(dir))) return;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await removeGlbsRecursive(path);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.glb')) {
      const rel = relative(join(dist, 'assets'), path).split(sep).join('/');
      if (!runtimeModels.has(rel)) await rm(path, { force: true });
    }
  }
}

// Classic startup scripts are referenced directly by index.html.
for (const rel of ['src/assets/preload.js', 'src/ui/titleScreen.js', 'src/ui/cutscenes/megaFutureIntro.js']) {
  await mkdir(join(dist, rel, '..'), { recursive: true });
  await cp(join(root, rel), join(dist, rel));
}

await copyDirIfPresent(join(root, 'images'), join(dist, 'images'));
await copyDirIfPresent(join(root, 'audio'), join(dist, 'audio'));
await copyDirIfPresent(join(root, 'assets'), join(dist, 'assets'), { skipGlbs: true });
await rm(join(dist, 'images', '.DS_Store'), { force: true });
await rm(join(dist, 'images', 'map.xcf'), { force: true });
await rm(join(dist, 'images', 'map_pre_gravel.png'), { force: true });
await removeGlbsRecursive(join(dist, 'assets'));

await mkdir(join(dist, 'server'), { recursive: true });
await writeFile(join(dist, 'server', 'index.js'), `
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.glb': 'model/gltf-binary',
  '.ico': 'image/x-icon'
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = decodeURIComponent(url.pathname);
    if (path === '/') path = '/index.html';
    if (path.endsWith('/')) path += 'index.html';
    const asset = await env.ASSETS.fetch(new URL(path, url.origin));
    if (asset.status !== 404) {
      const headers = new Headers(asset.headers);
      const ext = path.slice(path.lastIndexOf('.')).toLowerCase();
      if (MIME[ext]) headers.set('content-type', MIME[ext]);
      headers.set('cache-control', path.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=300');
      return new Response(asset.body, { status: asset.status, headers });
    }
    const acceptsHtml = request.headers.get('accept')?.includes('text/html');
    if (acceptsHtml && !path.includes('.')) {
      return env.ASSETS.fetch(new URL('/index.html', url.origin));
    }
    return new Response('Not found', { status: 404 });
  }
};
`);
