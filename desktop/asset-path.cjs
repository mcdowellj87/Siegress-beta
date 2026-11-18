const path = require('node:path');
function resolveAsset(root, requestUrl) {
  const url = new URL(requestUrl);
  if (url.protocol !== 'siegress:' || url.hostname !== 'game') throw new Error('Invalid app origin');
  const pathname = decodeURIComponent(url.pathname);
  if (pathname.includes('\0') || pathname.includes('\\')) throw new Error('Invalid asset path');
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(path.resolve(root) + path.sep)) throw new Error('Asset outside game directory');
  return file;
}
module.exports = { resolveAsset };
