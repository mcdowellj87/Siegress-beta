// Recompute support each substep, while retaining continuous downhill terrain contact.
export function settleGroundContact(position, velocity, groundY, supported, terrain = {}) {
  if (position.y <= groundY) {
    position.y = groundY;
    if (velocity.y < 0) velocity.y = 0;
    return true;
  }
  if (supported && velocity.y <= 0) {
    velocity.y = 0;
    return true;
  }
  const { wasGrounded = false, previousY, previousGroundY,
    horizontalDistance = 0, maxSlope = 2 } = terrain;
  const terrainDrop = previousGroundY - groundY;
  const startedOnTerrain = wasGrounded && Math.abs(previousY - previousGroundY) <= 0.05;
  // Follow continuous slopes, not the ground far below a mushroom or ledge.
  if (startedOnTerrain && velocity.y <= 0 && horizontalDistance > 1e-6 &&
      terrainDrop >= 0 && terrainDrop <= horizontalDistance * maxSlope + 0.01) {
    position.y = groundY;
    velocity.y = 0;
    return true;
  }
  return false;
}
