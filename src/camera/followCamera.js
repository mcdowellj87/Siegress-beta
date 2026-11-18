import * as THREE from 'three';

export function createFollowCameraSystem({
  canvas,
  camera,
  playerScale,
  playerEyeHeight,
  heightAtWorld
}) {
  let viewMode = 'third';
  let canLock = false;
  let isLocked = false;
  let controllerActive = false;
  let yaw = -THREE.MathUtils.degToRad(30);
  let pitch = 0;

  const mouseSens = 0.0022;
  const pitchMin = THREE.MathUtils.degToRad(-60);
  const pitchMax = THREE.MathUtils.degToRad(90);
  const maxOrbitElevation = THREE.MathUtils.degToRad(60);

  const thirdCamZoomFactor = 0.025;
  const thirdCamBack = 9.0 * playerScale * thirdCamZoomFactor;
  const thirdCamUp = 5.0 * playerScale * thirdCamZoomFactor;
  const thirdLookUp = 1.8 * playerScale * thirdCamZoomFactor;

  const camTarget = new THREE.Vector3();
  const desiredCam = new THREE.Vector3();
  const orbitRadius = Math.hypot(thirdCamBack, thirdCamUp - thirdLookUp) * 0.25;
  const baseElevation = Math.atan2(thirdCamUp - thirdLookUp, thirdCamBack);
  let orbitYaw = yaw, orbitElevation = baseElevation;
  let orbitInitialized = false;

  function applyRotation(rotationYaw = yaw) {
    camera.rotation.set(pitch, rotationYaw, 0, 'YXZ');
  }

  function enablePointerLock() {
    canLock = true;
  }

  function lockPointer() {
    if (!canLock) return;
    if (!document.pointerLockElement) canvas.requestPointerLock();
  }

  function relockPointer() {
    if (!canLock || document.pointerLockElement) return;
    try { canvas.requestPointerLock(); } catch { }
  }

  canvas.addEventListener('click', lockPointer);

  document.addEventListener('pointerlockchange', () => {
    isLocked = (document.pointerLockElement === canvas);
  });

  document.addEventListener('mousemove', (e) => {
    if (!isLocked || controllerActive) return;
    yaw -= e.movementX * mouseSens;
    // Preserve non-inverted first-person/noclip look: negative movementY (mouse up)
    // increases pitch and looks up; positive movementY looks down. Third-person orbit
    // needs the opposite sign because pitch changes camera elevation around the target.
    const pitchDirection = viewMode === 'first' ? -1 : 1;
    pitch += e.movementY * mouseSens * pitchDirection;
    pitch = THREE.MathUtils.clamp(pitch, pitchMin, viewMode === 'third' ? maxOrbitElevation - baseElevation : pitchMax);
  });

  function toggleViewMode() {
    viewMode = (viewMode === 'third') ? 'first' : 'third';
    orbitInitialized = false;
    return viewMode;
  }

  function setViewMode(mode) {
    if (mode !== 'first' && mode !== 'third') return viewMode;
    if (viewMode !== mode) orbitInitialized = false;
    viewMode = mode;
    return viewMode;
  }

  function updateFollowCamera({
    dt,
    playerPos,
    firstPersonEyeY,
    orbitCenter,
    noclipEnabled
  }) {
    if (viewMode === 'first') {
      applyRotation(yaw + Math.PI);
      camera.position.set(playerPos.x, firstPersonEyeY, playerPos.z);
      return;
    }

    applyRotation();
    const playerFootY = playerPos.y - playerEyeHeight;

    if (orbitCenter) camTarget.copy(orbitCenter);
    else camTarget.set(playerPos.x, playerFootY + thirdLookUp, playerPos.z);

    const wantedElevation = THREE.MathUtils.clamp(baseElevation + pitch, -Math.PI / 2, maxOrbitElevation);
    const smoothing = 1 - Math.pow(0.000001, Math.max(0, dt));
    if (!orbitInitialized) {
      orbitYaw = yaw; orbitElevation = wantedElevation; orbitInitialized = true;
    } else {
      const yawDelta = Math.atan2(Math.sin(yaw - orbitYaw), Math.cos(yaw - orbitYaw));
      orbitYaw += yawDelta * smoothing;
      orbitElevation += (wantedElevation - orbitElevation) * smoothing;
    }
    function placeOnOrbit(elevation) {
      const horizontal = Math.cos(elevation) * orbitRadius;
      desiredCam.set(camTarget.x - Math.sin(orbitYaw) * horizontal,
        camTarget.y + Math.sin(elevation) * orbitRadius,
        camTarget.z - Math.cos(orbitYaw) * horizontal);
    }
    placeOnOrbit(orbitElevation);
    if (!noclipEnabled) {
      const padding = 0.65;
      if (desiredCam.y < heightAtWorld(desiredCam.x, desiredCam.z) + padding) {
        // Lift along the sphere instead of shortening the boom and changing zoom.
        let lo = orbitElevation, hi = maxOrbitElevation;
        for (let i = 0; i < 20; i++) {
          const mid = (lo + hi) / 2;
          placeOnOrbit(mid);
          if (desiredCam.y < heightAtWorld(desiredCam.x, desiredCam.z) + padding) lo = mid;
          else hi = mid;
        }
        placeOnOrbit(hi);
        const lift = Math.max(0, heightAtWorld(desiredCam.x, desiredCam.z) + padding - desiredCam.y);
        desiredCam.y += lift;
        camTarget.y += lift;
      }
    }
    // Interpolate angles, not Cartesian positions: every intermediate frame stays on the sphere.
    camera.position.copy(desiredCam);
    camera.lookAt(camTarget);
  }

  return {
    setControllerActive(value) { controllerActive = value; },
    get isReady() { return canLock; },
    controllerLook(x, y, dt) {
      yaw -= x * 2.4 * dt;
      pitch += y * 1.8 * dt * (viewMode === 'first' ? -1 : 1);
      pitch = THREE.MathUtils.clamp(pitch, pitchMin, viewMode === 'third' ? maxOrbitElevation - baseElevation : pitchMax);
    },
    enablePointerLock,
    relockPointer,
    toggleViewMode,
    setViewMode,
    updateFollowCamera,
    get isLocked() {
      return isLocked;
    },
    get viewMode() {
      return viewMode;
    },
    get yaw() {
      return yaw;
    },
    get pitch() {
      return pitch;
    }
  };
}
