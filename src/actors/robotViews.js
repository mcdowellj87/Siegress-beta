const TAU = Math.PI * 2;
// Source labels on the overhead row do not consistently match the drawings.
// The rear-facing middle drawing is assigned 180 degrees by its silhouette.
export const ROBOT_VIEWS = {
  level: [0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5, 180, 202.5],
  overhead: [0, 22.5, 45, 67.5, 180, 292.5, 315, 337.5]
};

export function selectRobotView({ x, y, z, facingYaw = 0, previousAzimuth = 0 }) {
  const horizontal = Math.hypot(x, z);
  const elevation = Math.atan2(y, horizontal);
  const azimuth = horizontal > 1e-6
    ? ((facingYaw - Math.atan2(x, z)) % TAU + TAU) % TAU
    : previousAzimuth;
  const set = elevation >= Math.PI / 8 ? 'overhead' : 'level';
  const degrees = azimuth * 180 / Math.PI;
  let frame = 0, mirrored = false, closest = Infinity;
  for (let i = 0; i < ROBOT_VIEWS[set].length; i++) {
    for (const mirror of [false, true]) {
      const angle = (mirror ? 360 - ROBOT_VIEWS[set][i] : ROBOT_VIEWS[set][i]) % 360;
      const delta = Math.abs(angle - degrees);
      const distance = Math.min(delta, 360 - delta);
      if (distance < closest - 1e-8 || (Math.abs(distance - closest) <= 1e-8 && mirrored && !mirror)) {
        closest = distance; frame = i; mirrored = mirror;
      }
    }
  }
  return { set, frame, mirrored, azimuth };
}
