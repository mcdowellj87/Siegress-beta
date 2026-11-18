import * as THREE from 'three';

// Ordinary detection requires sight; regulation briefly reveals the player through psi.
export function canMonsterHearMovement(distance, movementSpeed, hearingRange = 9) {
  return distance <= hearingRange && movementSpeed > 0.1;
}

export function createMonsterStealth({ detectionRange = Infinity, pursuitRange = Infinity, uncertaintySeconds = 3 } = {}) {
  let state = 'wandering';
  let uncertainty = 0;
  let regulationAlert = 0;
  return {
    reset() { state = 'wandering'; uncertainty = 0; regulationAlert = 0; },
    noticeStrike() { state = 'pursuing'; regulationAlert = 3; uncertainty = uncertaintySeconds; },
    noticeRegulation() { state = 'pursuing'; regulationAlert = 3; uncertainty = uncertaintySeconds; },
    update(dt, distance, visible, audible = false) {
      const range = state === 'pursuing' ? pursuitRange : detectionRange;
      const alerted = regulationAlert > 0;
      regulationAlert = Math.max(0, regulationAlert - dt);
      if (alerted || audible || (visible && distance <= range)) {
        state = 'pursuing'; uncertainty = uncertaintySeconds;
      } else if (state === 'pursuing') {
        state = 'uncertain'; uncertainty = uncertaintySeconds;
      } else if (state === 'uncertain') {
        uncertainty -= dt;
        if (uncertainty <= 0) state = 'wandering';
      }
      return state;
    },
    get state() { return state; }
  };
}

// Monster models face local +Z; use horizontal bearing so slopes do not
// shrink the cone or reverse its relationship to the red front face.
export function isWithinMonsterVisionCone(origin, target, yaw, coneDegrees = 60) {
  const dx = target.x - origin.x;
  const dz = target.z - origin.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 0.001) return true;
  const alignment = (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / distance;
  return alignment >= Math.cos(coneDegrees * Math.PI / 360) - 1e-10;
}

export function createMonsterSight({ heightAtWorld, getOccluders }) {
  const raycaster = new THREE.Raycaster();
  const direction = new THREE.Vector3();
  const sample = new THREE.Vector3();
  return function canSee(origin, target) {
    direction.subVectors(target, origin);
    const distance = direction.length();
    if (distance < 0.1) return true;
    direction.divideScalar(distance);
    // March the sight ray through terrain heights rather than raycasting the
    // entire landscape mesh. Trees and solid meshes use Three's raycaster below.
    const steps = Math.max(2, Math.ceil(distance / 0.25));
    for (let i = 1; i < steps; i++) {
      sample.copy(origin).addScaledVector(direction, distance * i / steps);
      if (sample.y <= heightAtWorld(sample.x, sample.z) + 0.02) return false;
    }
    raycaster.set(origin, direction);
    raycaster.near = 0.05;
    raycaster.far = Math.max(0.05, distance - 0.05);
    return raycaster.intersectObjects(getOccluders?.() || [], false).length === 0;
  };
}

export function createMonsterScan(random = Math.random) {
  let wait = 3 + random() * 4;
  let remaining = 0;
  let turnWait = 0;
  let heading = 0;
  return {
    reset() { wait = 3 + random() * 4; remaining = 0; turnWait = 0; },
    update(dt, yaw, pursuing, confused) {
      if (pursuing) { remaining = 0; wait = 3 + random() * 4; return { scanning: false, yaw }; }
      wait -= dt;
      if (remaining <= 0 && (wait <= 0 || confused)) {
        remaining = 1.5 + random() * 2; turnWait = 0;
        wait = 4 + random() * 5;
      }
      if (remaining <= 0) return { scanning: false, yaw };
      remaining -= dt; turnWait -= dt;
      if (turnWait <= 0) {
        heading = yaw + (random() - 0.5) * Math.PI * 1.5;
        turnWait = 0.6 + random() * 0.7;
      }
      const delta = Math.atan2(Math.sin(heading - yaw), Math.cos(heading - yaw));
      const step = Math.max(-dt * 1.3, Math.min(dt * 1.3, delta));
      return { scanning: true, yaw: yaw + step };
    }
  };
}
