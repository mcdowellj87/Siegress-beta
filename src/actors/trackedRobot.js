import * as THREE from 'three';
import { selectRobotView } from './robotViews.js';

export function createTrackedRobotSystem({ scene, camera, playerVisualHeight, heightAtWorld, spawnFacingYaw = 0 }) {
  const root = new THREE.Group();
  root.name = 'starting-mushroom-tracked-robot';
  scene.add(root);
  const material = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.08,
    depthTest: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  // A Sprite follows camera rotation even when the camera remains in place.
  // Use a foot-anchored plane that faces the observer's position instead.
  const geometry = new THREE.PlaneGeometry(1, 1);
  geometry.translate(0, 0.5, 0);
  const sprite = new THREE.Mesh(geometry, material);
  root.add(sprite);
  root.visible = false;
  const observer = new THREE.Vector3();
  const position = new THREE.Vector3();
  let facingYaw = spawnFacingYaw;
  const textures = {};
  let manifest = null, previousAzimuth = 0, placed = false;
  const baseUrl = new URL('./assets/robot/', document.baseURI);

  async function load() {
    const response = await fetch(new URL('manifest.json', baseUrl));
    if (!response.ok) throw new Error(`Robot manifest: ${response.status}`);
    manifest = await response.json();
    const loader = new THREE.TextureLoader();
    await Promise.all(Object.entries(manifest.sets).map(async ([set, spec]) => {
      const texture = await loader.loadAsync(new URL(spec.file, baseUrl).href);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      textures[set] = texture;
    }));
    root.visible = placed;
    update();
  }

  function place(store) {
    placed = !!store;
    root.visible = placed && !!manifest && !!textures.level && !!textures.overhead;
    if (!store) return;
    // Stand beside the thin stem, beneath the lobed cap.
    const x = store.centerX;
    const z = store.centerZ + store.bodyRadius + playerVisualHeight * 0.35;
    root.position.set(x, Math.max(store.floorY, heightAtWorld(x, z)) + 0.05, z);
    root.getWorldPosition(position);
    // Capture the spawn heading once per placement; never aim at player/camera.
    facingYaw = spawnFacingYaw;
    root.userData.spawnFacingYaw = facingYaw;
    update();
  }

  function update() {
    if (!root.visible) return;
    camera.getWorldPosition(observer);
    root.getWorldPosition(position);
    position.y += playerVisualHeight * 0.25;
    const view = selectRobotView({
      x: observer.x - position.x, y: observer.y - position.y,
      z: observer.z - position.z, facingYaw, previousAzimuth
    });
    // Match the plane normal to the same viewing ray used to select the frame.
    // Camera yaw, pitch, and roll alone cannot rotate this plane.
    sprite.lookAt(observer.x, observer.y - playerVisualHeight * 0.25, observer.z);
    previousAzimuth = view.azimuth;
    const spec = manifest.sets[view.set];
    const texture = textures[view.set];
    const frame = spec.frames[view.frame];
    const { x, y, width, height } = frame;
    const rw = width / spec.width;
    texture.repeat.set(view.mirrored ? -rw : rw, height / spec.height);
    texture.offset.set((x + (view.mirrored ? width : 0)) / spec.width,
      1 - (y + height) / spec.height);
    if (material.map !== texture) { material.map = texture; material.needsUpdate = true; }
    const robotHeight = playerVisualHeight * 0.5;
    sprite.scale.set(robotHeight * width / height, robotHeight, 1);
  }

  return { root, load, place, update };
}
