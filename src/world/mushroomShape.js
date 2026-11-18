const TAU = Math.PI * 2;

export function sampleMushroomRadius(profile, angle) {
  const sector = ((angle % TAU + TAU) % TAU) / TAU * profile.length;
  const index = Math.floor(sector);
  const blend = sector - index;
  return profile[index % profile.length] * (1 - blend) + profile[(index + 1) % profile.length] * blend;
}

// Sample the marker's actual outline rather than collapsing its lobes into a circle.
export function mushroomFootprint(data, mapW, mapH, cell, halfW, halfH, scale = 0.62) {
  const marker = (x, y) => {
    if (x < 0 || x >= mapW || y < 0 || y >= mapH) return false;
    const i = (y * mapW + x) * 4;
    return data[i] === 255 && data[i + 1] === 58 && data[i + 2] === 138 && data[i + 3] >= 16;
  };
  const pixels = [];
  let sumX = 0, sumY = 0;
  for (let y = 0; y < mapH; y++) for (let x = 0; x < mapW; x++) {
    if (!marker(x, y)) continue;
    pixels.push([x, y]); sumX += x + 0.5; sumY += y + 0.5;
  }
  if (!pixels.length) return null;
  let cx = sumX / pixels.length, cy = sumY / pixels.length;
  if (!marker(Math.floor(cx), Math.floor(cy))) {
    let nearest = Infinity;
    for (const [x, y] of pixels) {
      const distance = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2;
      if (distance < nearest) { nearest = distance; sumX = x + 0.5; sumY = y + 0.5; }
    }
    cx = sumX; cy = sumY;
  }
  const maxDistance = Math.max(...pixels.map(([x, y]) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy))) + 2;
  const samples = 128;
  const radii = [];
  for (let i = 0; i < samples; i++) {
    const angle = i / samples * TAU;
    let distance = 0;
    for (let r = 0; r <= maxDistance; r += 0.25) {
      if (!marker(Math.floor(cx + Math.cos(angle) * r), Math.floor(cy + Math.sin(angle) * r))) break;
      distance = r + 0.125;
    }
    radii.push(Math.max(cell * 0.5, distance * cell * scale));
  }
  // Remove pixel stair steps while retaining the broad lobes in the drawing.
  const radialProfile = radii.map((r, i) =>
    (radii[(i + samples - 1) % samples] + 2 * r + radii[(i + 1) % samples]) / 4);
  return { centerX: cx * cell - halfW, centerZ: cy * cell - halfH,
    radialProfile, capRadius: Math.max(...radialProfile), pixelCount: pixels.length };
}
