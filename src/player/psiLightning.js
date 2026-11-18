import * as THREE from '../../vendor/three.module.js';
import { findPsiGroundTarget } from './psiAim.js';

// Solid, faceted energy volumes: the attack retains depth from every camera angle.
export function createPsiLightning({ scene, camera, cameraSystem, psionicSystem, heightAtWorld, scale, handEl, maxRangeMeters = 20, isValidGround = () => true, onImpact = () => {}, onRelease = () => {}, getGroundMesh = () => null }) {
  const effectScale = scale * 0.2;
  const reticleSegments = 128;
  const root = new THREE.Group();
  scene.add(root);
  const blue = new THREE.ShaderMaterial({
    uniforms: {
      low: { value: new THREE.Color(0x0098ee) },
      mid: { value: new THREE.Color(0x00add0) },
      high: { value: new THREE.Color(0x48b1d0) },
      crest: { value: new THREE.Color(0x77cce2) }
    },
    vertexShader: `varying vec3 energyNormal; varying vec2 energyUv;
      void main() { energyNormal = normalize(normalMatrix * normal); energyUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 low; uniform vec3 mid; uniform vec3 high; uniform vec3 crest;
      varying vec3 energyNormal; varying vec2 energyUv;
      void main() {
        float shade = dot(normalize(energyNormal), normalize(vec3(-0.35, 0.65, 0.8))) * 0.5 + 0.5;
        // Uneven bands, like the broad painted strokes in the reference.
        shade += 0.065 * sin(energyUv.x * 57.0 + sin(energyUv.x * 23.0) * 2.0);
        vec3 color = shade < 0.38 ? low : shade < 0.65 ? mid : shade < 0.86 ? high : crest;
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const cyan = new THREE.MeshBasicMaterial({ color: 0x66d5f0, fog: false });
  const cooldownSeconds = 1.0;
  let cooldownRemaining = 0;
  let aiming = false;
  let impacted = false;
  let elapsed = 0, casting = false, released = false, previousView = 'third';
  let impact = new THREE.Vector3();
  const tendrils = [];
  const aimDirection = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const vertex = new THREE.Vector3();
  const inverseReticleRotation = new THREE.Quaternion();
  let aimTime = 0;
  const eddy = new THREE.Group();
  eddy.name = 'psionic-ground-reticle';
  scene.add(eddy);
  eddy.visible = false;
  const eddyMaterial = new THREE.MeshBasicMaterial({ color: 0x77cce2, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, fog: false });
  for (let arm = 0; arm < 3; arm++) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((reticleSegments + 1) * 2 * 3), 3));
    const indices = [];
    for (let i = 0; i < reticleSegments; i++) indices.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    geometry.setIndex(indices);
    const mesh = new THREE.Mesh(geometry, eddyMaterial);
    mesh.frustumCulled = false;
    mesh.renderOrder = 5;
    eddy.add(mesh);
  }

  function getTarget() {
    camera.updateWorldMatrix(true, false);
    camera.getWorldDirection(aimDirection);
    // Bounded center-ray traversal through the rendered grid, avoiding a full triangle scan.
    const target = findPsiGroundTarget(camera.position, aimDirection, groundHeight, maxRangeMeters * scale);
    if (!target || !isValidGround(target.x, target.z)) return null;
    const epsilon = 0.01;
    const dx = (groundHeight(target.x + epsilon, target.z) - groundHeight(target.x - epsilon, target.z)) / (epsilon * 2);
    const dz = (groundHeight(target.x, target.z + epsilon) - groundHeight(target.x, target.z - epsilon)) / (epsilon * 2);
    return { ...target, normal: new THREE.Vector3(-dx, 1, -dz).normalize() };
  }

  // Read the rendered terrain's actual triangles rather than its source heightfield.
  function groundHeight(x, z) {
    const ground = getGroundMesh();
    const params = ground?.geometry.parameters;
    if (!params?.widthSegments || ground.rotation.x || ground.rotation.y || ground.rotation.z) return heightAtWorld(x, z);
    const positions = ground.geometry.attributes.position;
    const sx = params.widthSegments, sz = params.heightSegments;
    const gx = THREE.MathUtils.clamp((x + params.width / 2) / params.width * sx, 0, sx - 1e-6);
    const gz = THREE.MathUtils.clamp((z + params.height / 2) / params.height * sz, 0, sz - 1e-6);
    const ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz;
    const a = iz * (sx + 1) + ix;
    const h00 = positions.getY(a), h10 = positions.getY(a + 1);
    const h01 = positions.getY(a + sx + 1), h11 = positions.getY(a + sx + 2);
    return fx + fz <= 1 ? h00 + (h10 - h00) * fx + (h01 - h00) * fz
      : h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
  }

  function updateReticle(dt, active) {
    aimTime += dt;
    const target = active && !psionicSystem.isRegulating && aiming ? getTarget() : null;
    eddy.visible = !!target;
    if (!target) return;
    eddy.position.set(target.x, target.y, target.z);
    eddy.quaternion.setFromUnitVectors(up, target.normal);
    inverseReticleRotation.copy(eddy.quaternion).invert();
    eddy.children.forEach((mesh, arm) => {
      const positions = mesh.geometry.attributes.position;
      for (let i = 0; i <= reticleSegments; i++) {
        const t = i / reticleSegments;
        const angle = arm * Math.PI * 2 / 3 + t * Math.PI * 1.45 - aimTime * 1.8;
        const radius = effectScale * 0.25 * (0.16 + t * 0.64);
        const width = effectScale * 0.25 * 0.09 * Math.sin(Math.PI * t);
        for (let side = 0; side < 2; side++) {
          const r = radius + (side ? width : -width);
          const x = Math.cos(angle) * r, z = Math.sin(angle) * r;
          vertex.set(x, 0, z).applyQuaternion(eddy.quaternion).add(eddy.position);
          vertex.y = groundHeight(vertex.x, vertex.z) + scale * 0.006;
          vertex.sub(eddy.position).applyQuaternion(inverseReticleRotation);
          positions.setXYZ(i * 2 + side, vertex.x, vertex.y, vertex.z);
        }
      }
      positions.needsUpdate = true;
    });
  }

  function clear() {
    for (const child of [...root.children]) {
      root.remove(child);
      child.geometry?.dispose();
    }
    tendrils.length = 0;
  }

  function tube(points, radius, material, taper = false) {
    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.TubeGeometry(curve, 40, radius, 7, false);
    if (taper) {
      const positions = geometry.attributes.position;
      for (let ring = 0; ring <= 40; ring++) {
        const t = ring / 40, center = curve.getPointAt(t);
        const width = Math.pow(1 - t, 0.7);
        for (let side = 0; side <= 7; side++) {
          const i = ring * 8 + side;
          positions.setXYZ(i,
            center.x + (positions.getX(i) - center.x) * width,
            center.y + (positions.getY(i) - center.y) * width,
            center.z + (positions.getZ(i) - center.z) * width);
        }
      }
      geometry.computeVertexNormals();
    }
    const mesh = new THREE.Mesh(geometry, material);
    root.add(mesh);
    return mesh;
  }

  function release() {
    released = true;
    cooldownRemaining = cooldownSeconds;
    onRelease();
    camera.updateWorldMatrix(true, false);
    // Project the artwork's fingertips into world space using the current view,
    // so looking up/down never detaches the bolt from the first-person hand.
    const handPoint = new THREE.Vector3(-0.28, -0.35, 0.5);
    if (handEl.getBoundingClientRect && typeof window !== 'undefined') {
      const rect = handEl.getBoundingClientRect();
      handPoint.x = (rect.left + rect.width * 0.50) / window.innerWidth * 2 - 1;
      handPoint.y = 1 - (rect.top + rect.height * 0.50) / window.innerHeight * 2;
    }
    const handDirection = handPoint.unproject(camera).sub(camera.position).normalize();
    const start = camera.position.clone().addScaledVector(handDirection, scale * 0.6);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const points = [start];
    for (let i = 1; i < 12; i++) {
      const t = i / 12;
      const p = start.clone().lerp(impact, t);
      p.y += Math.sin(Math.PI * t) * effectScale * 3;
      p.addScaledVector(right, Math.sin(t * Math.PI * 5) * effectScale * 0.12);
      points.push(p);
    }
    points.push(impact.clone());
    tube(points, effectScale * 0.16, blue);
    // A raised inner strand keeps the pale core visible without transparency/glow sorting.
    tube(points.map(p => p.clone().add(new THREE.Vector3(0, effectScale * 0.1, 0))), effectScale * 0.065, cyan);
    for (let i = 0; i < 9; i++) {
      const angle = i * Math.PI * 2 / 9 + Math.sin(i * 2.3) * 0.15;
      const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
      const ejectaScale = effectScale * 0.6;
      const height = ejectaScale * (0.72 + (i % 3) * 0.30 + Math.sin(i * 1.7) * 0.12);
      // A broad outward rise with a restrained inward turn at the tip.
      const pts = [
        new THREE.Vector3(),
        dir.clone().multiplyScalar(ejectaScale * 0.375).setY(height * 0.25),
        dir.clone().multiplyScalar(ejectaScale * 0.78).setY(height * 0.55),
        dir.clone().multiplyScalar(ejectaScale * 1.02).setY(height * 0.80),
        dir.clone().multiplyScalar(ejectaScale * 0.975).setY(height * 0.95),
        dir.clone().multiplyScalar(ejectaScale * 0.825).setY(height)
      ];
      const mesh = tube(pts, ejectaScale * (0.23 + (i % 2) * 0.035), blue, true);
      mesh.position.copy(impact);
      mesh.visible = false;
      tendrils.push(mesh);
    }
  }

  function cancel({ resetCooldown = false } = {}) {
    if (resetCooldown) cooldownRemaining = 0;
    if (aiming) cameraSystem.setViewMode(previousView);
    aiming = false;
    eddy.visible = false;
    casting = false;
    handEl.hidden = true;
    clear();
  }

  function toggleAiming() {
    if (aiming) { cancel(); return false; }
    if (psionicSystem.isRegulating || !psionicSystem.isCritical) return false;
    previousView = cameraSystem.viewMode;
    cameraSystem.setViewMode('first');
    aiming = true;
    handEl.hidden = false;
    handEl.style.transform = 'none';
    return true;
  }

  function cast() {
    if (!aiming || casting || cooldownRemaining > 0 || psionicSystem.isRegulating || !(psionicSystem.canCastStrike ?? psionicSystem.isCritical)) return false;
    const target = getTarget();
    if (!target) return false;
    // Commit the point shown by the reticle, before switching camera or winding up.
    impact.set(target.x, target.y + scale * 0.04, target.z);
    elapsed = 0;
    impacted = false;
    released = false;
    casting = true;
    handEl.hidden = false;
    return true;
  }

  function update(dt, active) {
    cooldownRemaining = Math.max(0, cooldownRemaining - dt);
    if (aiming && (!active || psionicSystem.isRegulating)) { cancel(); return; }
    if (aiming) cameraSystem.setViewMode('first');
    updateReticle(dt, active);
    if (!casting) return;
    elapsed += dt;
    handEl.style.transform = `translateY(${Math.max(0, 1 - elapsed / 0.22) * 100}px) rotate(${-Math.sin(Math.min(1, elapsed / 0.7) * Math.PI) * 6}deg)`;
    if (!released && elapsed >= 0.3) release();
    const impactAge = elapsed - 0.48;
    if (released && impactAge >= 0 && !impacted) {
      impacted = true;
      onImpact(impact.clone(), effectScale * 0.6);
    }
    for (const mesh of tendrils) {
      mesh.visible = impactAge > 0;
      const growth = Math.min(1, Math.max(0.01, impactAge / 0.2));
      const fade = Math.min(1, Math.max(0, (1.25 - elapsed) / 0.55));
      mesh.scale.set(growth * fade, growth * fade, growth * fade);
      mesh.rotation.y = Math.sin(impactAge * 6) * 0.15;
    }
    // Only the two arc meshes disappear; ejecta persists briefly at the grounded impact.
    const arcs = root.children.filter(c => c.isMesh).slice(0, 2);
    for (const mesh of arcs) mesh.visible = elapsed < 0.85;
    if (elapsed >= 1.25) {
      casting = false; clear(); handEl.style.transform = 'none';
      // Finishing a strike never toggles the player's chosen aiming mode.
      // Low psi blocks the next cast, but F/R still control leaving this mode.
    }
  }

  return { cast, update, cancel, toggleAiming, get cooldownRemaining() { return cooldownRemaining; }, get cooldownProgress() { return 1 - cooldownRemaining / cooldownSeconds; }, get isAiming() { return aiming; }, get isCasting() { return casting; } };
}
