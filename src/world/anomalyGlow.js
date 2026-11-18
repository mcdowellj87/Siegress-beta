import * as THREE from 'three';
export const CHERENKOV_BLUE = 0x3de8ff;
export function makeAnomalyGlowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const c = size * 0.5;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  g.addColorStop(0.12, 'rgba(176, 250, 255, 1.0)');
  g.addColorStop(0.42, 'rgba(61, 232, 255, 0.42)');
  g.addColorStop(1.0, 'rgba(61, 232, 255, 0.0)');

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
