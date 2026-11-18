import * as THREE from 'three';

// Geometry is rooted at the feet.
export function createBlackPrism(height, width, depth) {
  const root = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshBasicMaterial({ color: 0x000000 }));
  mesh.position.y = height / 2;
  root.add(mesh);
  root.name = 'Black prism placeholder';
  return root;
}

export function createPlayerAvatarSystem({ scene, playerCapsuleH, playerRadius,
  defaultCharacterRadius, getObscurePlayerModel = () => false }) {
  const height = (playerCapsuleH + 2 * playerRadius) * 0.03;
  const visualScale = 2 / 3;
  const root = createBlackPrism(height * visualScale, playerRadius * 2 * 1.05 * 0.03 * visualScale, playerRadius * 2 * 0.85 * 0.03 * visualScale);
  scene.add(root);
  let visible = true;
  function ensureReady() { root.visible = visible && !getObscurePlayerModel(); }
  ensureReady();
  return { root, ensureReady, async loadModel() { ensureReady(); return root; },
    async whenViewsReady() {}, setCelShading() {}, requestWalkCycle() {}, setMode() {},
    setVisible(value) { visible = !!value; ensureReady(); }, updateMixers: ensureReady,
    getOrbitCenter(target) { root.getWorldPosition(target); target.y += height / 2; return target; },
    get characterRadius() { return defaultCharacterRadius; } };
}
