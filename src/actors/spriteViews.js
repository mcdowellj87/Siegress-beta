const TAU = Math.PI * 2;
export function selectPlayerView({ x, y, z, facingYaw = 0, previousAzimuth = 0 }) {
  const horizontal = Math.hypot(x, z);
  const elevation = Math.atan2(y, horizontal);
  // Retain direction at the poles, where azimuth is undefined.
  const azimuth = horizontal > 1e-6
    ? ((facingYaw - Math.atan2(x, z)) % TAU + TAU) % TAU
    : previousAzimuth;
  const degrees = elevation * 180 / Math.PI;
  const set = degrees >= 22.5 ? 'above'
    : degrees <= -22.5 ? 'below' : 'level';
  return { set, frame: Math.round(azimuth / TAU * 16) % 16, azimuth, elevation };
}
