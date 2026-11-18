// Find the first ground crossing along the center-view ray, never beyond range.
export function findPsiGroundTarget(origin, direction, heightAtWorld, maxRange) {
  const gap = t => origin.y + direction.y * t - heightAtWorld(origin.x + direction.x * t, origin.z + direction.z * t);
  let previous = 0;
  if (gap(0) <= 0) return null;
  for (let i = 1; i <= 256; i++) {
    const distance = maxRange * i / 256;
    if (gap(distance) <= 0) {
      let lo = previous, hi = distance;
      for (let j = 0; j < 20; j++) {
        const mid = (lo + hi) / 2;
        if (gap(mid) > 0) lo = mid; else hi = mid;
      }
      return { x: origin.x + direction.x * hi, y: heightAtWorld(origin.x + direction.x * hi, origin.z + direction.z * hi), z: origin.z + direction.z * hi };
    }
    previous = distance;
  }
  return null;
}
