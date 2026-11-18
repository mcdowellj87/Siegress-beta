import * as THREE from 'three';
import { createMonsterNavigation } from './monsterNavigation.js';
import { createMonsterStealth, createMonsterSight, isWithinMonsterVisionCone, createMonsterScan, canMonsterHearMovement } from './monsterStealth.js';

export function createMonsterSystem({
  scene,
  camera,
  modelFactory = null,
  loader,
  idleUrl,
  walkUrl,
  runUrl,
  bodyRadius,
  defaultCharacterRadius,
  safeLoad,
  applyCharacterShading,
  measuredCharacterRadius,
  makeCharacterToonPhongMaterial,
  getSpawnRegion,
  getPlayerPos,
  getPlayerCharacterRadius,
  getCameraYaw,
  getWorldBounds,
  getSeaLevel,
  heightAtWorld,
  isWaterAtWorld,
  terrainTraversalSpeedMultiplier,
  getSightOccluders,
  colliderSystem,
  onPlayerContact = () => {},
  getSlopeSpeedMultiplier = () => 1,
  getPlayerMovementSpeed = () => 0,
  playerRunSpeed = 9.0,
  worldUnitsPerMeter = 1
}) {
  const root = new THREE.Group();
  root.visible = false; // Do not collide, threaten or play proximity audio before the model is ready.
  scene.add(root);

  let modelVisual = null;
  let idle = null;
  let walk = null;
  let run = null;
  let idleMixer = null;
  let walkMixer = null;
  let idleAction = null;
  let walkAction = null;
  let runMixer = null;
  let runAction = null;
  let fallback = null;
  let loaded = false;
  let dead = false;
  let health = 2;
  let characterRadius = defaultCharacterRadius;
  let pickTimer = 0;
  let mushroomLureActive = false;
  let mushroomLureTimer = 0;
  let pendingMushroomAmbush = false;
  let hasRegulationSpawn = false;
  const stealth = createMonsterStealth();
  const canSeePlayer = createMonsterSight({ heightAtWorld, getOccluders: getSightOccluders });
  let sightTimer = 0;
  let playerVisible = false;
  const eye = new THREE.Vector3();
  const sightBounds = new THREE.Box3();
  const navigation = createMonsterNavigation({ getOccluders: getSightOccluders, heightAtWorld, isWaterAtWorld, radius: bodyRadius });
  const lastKnownPosition = new THREE.Vector3();
  const strikeSearchPosition = new THREE.Vector3();
  let investigationTimer = 0;
  let investigationRoute = [];
  let routePending = false;
  let awarenessMarker = null;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const context = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    awarenessMarker = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: true, depthWrite: false }));
    awarenessMarker.scale.set(1.2, 1.2, 1);
    // Anchor the bottom above the head so punctuation dots stay visible.
    awarenessMarker.center.set(0.5, 0);
    awarenessMarker.visible = false;
    awarenessMarker.userData.draw = (symbol) => {
      context.clearRect(0, 0, 128, 128);
      context.font = 'bold 110px sans-serif'; context.textAlign = 'center';
      context.lineWidth = 10; context.strokeStyle = '#101018';
      context.fillStyle = symbol === '!' ? '#ff4141' : '#ffdf75';
      context.strokeText(symbol, 64, 106); context.fillText(symbol, 64, 106);
      texture.needsUpdate = true;
    };
    scene.add(awarenessMarker);
  }
  let wasTrackingPlayer = false;
  let randState = 0x51f15e;
  const scan = createMonsterScan(rand);

  const WANDER_SPEED = 2.4;
  // Cover balances pursuit: the monster runs 10% faster than player sprinting.
  const PURSUIT_SPEED = playerRunSpeed * 1.1;
  const PURSUIT_ACCELERATION = 1.6;
  let movementSpeed = WANDER_SPEED;

  const target = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const sightPoint = new THREE.Vector3();
  const projectedSightPoint = new THREE.Vector3();
  const sightDirection = new THREE.Vector3();
  const sightRaycaster = new THREE.Raycaster();

  function makeFallbackPrism() {
    const bodyH = 2.2;
    const bodyW = Math.max(0.45, defaultCharacterRadius * 1.35);
    const bodyD = Math.max(0.38, defaultCharacterRadius * 1.0);

    const geo = new THREE.BoxGeometry(bodyW, bodyH, bodyD);
    const mat = makeCharacterToonPhongMaterial(0x121212);
    const frontMat = makeCharacterToonPhongMaterial(0xff2020);
    // BoxGeometry faces: +X, -X, +Y, -Y, +Z (forward), -Z.
    const mesh = new THREE.Mesh(geo, [mat, mat, mat, mat, frontMat, mat]);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.position.y = bodyH * 0.5;

    const group = new THREE.Group();
    group.add(mesh);
    return group;
  }

  function useFallbackModel() {
    if (fallback) return;
    fallback = makeFallbackPrism();
    idle = fallback;
    walk = fallback;
    root.add(fallback);
    characterRadius = measuredCharacterRadius(fallback, defaultCharacterRadius);
  }

  function rand() {
    randState += 0x6D2B79F5;
    let x = Math.imul(randState ^ (randState >>> 15), 1 | randState);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  }

  function placeNextToPlayer() {
    hasRegulationSpawn = false;
    investigationTimer = 0; investigationRoute = []; routePending = false;
    mushroomLureActive = false;
    mushroomLureTimer = 0;
    wasTrackingPlayer = false;
    scan.reset();
    stealth.reset(); sightTimer = 0; playerVisible = false;
    if (awarenessMarker) awarenessMarker.visible = false;
    dead = false;
    health = 2;
    movementSpeed = WANDER_SPEED;
    root.visible = !!(idle || walk || run || fallback);
    const playerPos = getPlayerPos();
    const spawnRegion = getSpawnRegion();
    const { halfW, halfH } = getWorldBounds();
    const seaLevel = getSeaLevel();
    const spawn = spawnRegion?.monster || { x: playerPos.x + 5.5, z: playerPos.z + 4.0 };
    const x = THREE.MathUtils.clamp(spawn.x, -halfW + 1, halfW - 1);
    const z = THREE.MathUtils.clamp(spawn.z, -halfH + 1, halfH - 1);
    const y = Math.max(heightAtWorld(x, z), seaLevel);
    root.position.set(x, y, z);
    root.rotation.set(0, getCameraYaw() + Math.PI * 0.25, 0);
    target.copy(root.position);
    pickTimer = 0.25;
  }

  function pickTarget() {
    const playerPos = getPlayerPos();
    const { halfW, halfH } = getWorldBounds();
    const seaLevel = getSeaLevel();

    for (let attempt = 0; attempt < 10; attempt++) {
      const angle = rand() * Math.PI * 2;
      const radius = THREE.MathUtils.lerp(7.0, 26.0, rand());
      const x = THREE.MathUtils.clamp(root.position.x + Math.cos(angle) * radius, -halfW + 1, halfW - 1);
      const z = THREE.MathUtils.clamp(root.position.z + Math.sin(angle) * radius, -halfH + 1, halfH - 1);
      if (!isWaterAtWorld(x, z)) {
        target.set(x, Math.max(heightAtWorld(x, z), seaLevel), z);
        pickTimer = THREE.MathUtils.lerp(3.0, 7.0, rand());
        return;
      }
    }
    target.copy(root.position);
    pickTimer = 2.0;
  }

  function resetEncounter() {
    placeNextToPlayer();
    pendingMushroomAmbush = false;
    // Respawning restores a living, visible monster immediately.
    // Reset the pose too: the previous encounter may have hidden every model.
    setMovementState(idle ? 'idle' : walk ? 'walk' : 'run');
    pickTarget();
  }

  function setMovementState(state) {
    if(modelVisual){modelVisual.setState(state);return;}
    if (idle && idle === walk) {
      idle.visible = state !== 'run';
      if (run) run.visible = state === 'run';
      return;
    }
    if (idle) idle.visible = state === 'idle';
    if (walk) walk.visible = state === 'walk';
    if (run) run.visible = state === 'run';
  }

  async function loadModel() {
    if (loaded) return;
    loaded = true;

    if(modelFactory){
      try {
        const visual=modelFactory(root);await visual.load();modelVisual=visual;
        root.add(visual.root);idle=walk=run=visual.root;characterRadius=defaultCharacterRadius;
        root.visible=true;
        if(pendingMushroomAmbush)beginMushroomAmbush();else{placeNextToPlayer();pickTarget();}
        visual.update(0);return;
      } catch(error){loaded=false;console.error('[Monster 3D model] load failed:',error);throw error;}
    }
    const gltfIdle = await safeLoad('monster idle GLB', idleUrl, (u) => loader.loadAsync(u));
    if (gltfIdle && gltfIdle.scene) {
      idle = gltfIdle.scene;
      applyCharacterShading(idle);
      idle.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
      idle.visible = false;
      root.add(idle);
      idleMixer = new THREE.AnimationMixer(idle);
      if (gltfIdle.animations && gltfIdle.animations.length) {
        idleAction = idleMixer.clipAction(gltfIdle.animations[0]);
        idleAction.play();
      }
    }

    const gltfWalk = await safeLoad('monster walking GLB', walkUrl, (u) => loader.loadAsync(u));
    if (gltfWalk && gltfWalk.scene) {
      walk = gltfWalk.scene;
      applyCharacterShading(walk);
      walk.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
      walk.visible = true;
      root.add(walk);
      walkMixer = new THREE.AnimationMixer(walk);
      if (gltfWalk.animations && gltfWalk.animations.length) {
        walkAction = walkMixer.clipAction(gltfWalk.animations[0]);
        walkAction.play();
      }
    }

    const gltfRun = await safeLoad('monster running GLB', runUrl, (u) => loader.loadAsync(u));
    if (gltfRun && gltfRun.scene) {
      run = gltfRun.scene;
      applyCharacterShading(run);
      run.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
      run.visible = false;
      root.add(run);
      runMixer = new THREE.AnimationMixer(run);
      if (gltfRun.animations && gltfRun.animations.length) {
        runAction = runMixer.clipAction(gltfRun.animations[0]);
        runAction.play();
      }
    }

    if (!idle && !walk) {
      useFallbackModel();
    }

    root.visible = !!(idle || walk || run || fallback);
    characterRadius = measuredCharacterRadius(idle || walk || run, defaultCharacterRadius);
    if (pendingMushroomAmbush) beginMushroomAmbush();
    else {
      placeNextToPlayer();
      pickTarget();
    }
  }

  function setMushroomLureActive(active) {
    mushroomLureActive = !!active;
    mushroomLureTimer = mushroomLureActive ? Infinity : 0;
  }

  function triggerMushroomLure(durationSeconds = 20) {
    mushroomLureActive = true;
    mushroomLureTimer = Math.max(mushroomLureTimer, durationSeconds);
  }

  function isVisibleToPlayer() {
    if (!root.visible) return false;

    root.getWorldPosition(sightPoint);
    sightPoint.y += 1.2;
    camera.updateMatrixWorld(true);
    projectedSightPoint.copy(sightPoint).project(camera);
    if (
      projectedSightPoint.z < -1 || projectedSightPoint.z > 1 ||
      Math.abs(projectedSightPoint.x) > 1 || Math.abs(projectedSightPoint.y) > 1
    ) return false;

    sightDirection.subVectors(sightPoint, camera.position);
    const distance = sightDirection.length();
    if (distance <= 0.1) return true;

    sightDirection.multiplyScalar(1 / distance);
    sightRaycaster.set(camera.position, sightDirection);
    sightRaycaster.near = 0.1;
    sightRaycaster.far = Math.max(0.1, distance - Math.max(0.5, characterRadius));
    const occluders = getSightOccluders?.() || [];
    return sightRaycaster.intersectObjects(occluders, true).length === 0;
  }

  function beginMushroomAmbush() {
    pendingMushroomAmbush = true;
    if (!root.visible && (idle || walk || run || fallback)) root.visible = true;
    const reviving = dead;
    const playerLocation = getPlayerPos();
    // Regulation resummons beyond 50 meters from his CURRENT position.
    const leftBattlefield = Math.hypot(root.position.x - playerLocation.x, root.position.z - playerLocation.z)
      > 50 * worldUnitsPerMeter;
    movementSpeed = WANDER_SPEED;
    if (dead) {
      dead = false;
      health = 2;
      root.visible = !!(idle || walk || run || fallback);
    }
    if (!root.visible) return false;

    // Once summoned, a living monster keeps its location and awareness.
    // Repeated regulation must not reset confusion or reveal the player.
    if (!reviving && hasRegulationSpawn && !leftBattlefield) {
      pendingMushroomAmbush = false;
      return false;
    }

    health = 2;
    investigationTimer = 0; investigationRoute = []; routePending = false;
    stealth.reset(); scan.reset();
    hasRegulationSpawn = true;
    const playerPos = getPlayerPos();
    const { halfW, halfH } = getWorldBounds();
    const seaLevel = getSeaLevel();
    const yaw = getCameraYaw();
    const behindX = Math.sin(yaw);
    const behindZ = Math.cos(yaw);

    for (let attempt = 0; attempt < 128; attempt++) {
      const spread = leftBattlefield
        ? THREE.MathUtils.lerp(-Math.PI, Math.PI, rand())
        : attempt < 8
        ? THREE.MathUtils.lerp(-1.15, 1.15, rand())
        : THREE.MathUtils.lerp(-Math.PI, Math.PI, rand());
      const cos = Math.cos(spread);
      const sin = Math.sin(spread);
      const offsetX = behindX * cos - behindZ * sin;
      const offsetZ = behindX * sin + behindZ * cos;
      const radius = THREE.MathUtils.lerp(24, 32, rand());
      const x = THREE.MathUtils.clamp(playerPos.x + offsetX * radius, -halfW + 1, halfW - 1);
      const z = THREE.MathUtils.clamp(playerPos.z + offsetZ * radius, -halfH + 1, halfH - 1);
      if (Math.hypot(x - playerPos.x, z - playerPos.z) < 22) continue;
      if (isWaterAtWorld(x, z)) continue;

      root.position.set(x, Math.max(heightAtWorld(x, z), seaLevel), z);
      setMovementState('idle');
      root.visible = true;
      pendingMushroomAmbush = false;
      stealth.noticeRegulation(); sightTimer = 0; playerVisible = false;
      lastKnownPosition.copy(getPlayerPos());
      target.copy(lastKnownPosition);
      return true;
    }

    // Never fall back to the original map spawn: that can be far away and
    // make a successful resummon look like nothing happened near the player.
    let spawnPoint = null;
    for (let radius = 8; radius <= 96 && !spawnPoint; radius += 4) {
      for (let i = 0; i < 32; i++) {
        const angle = i * Math.PI * 2 / 32;
        const x = THREE.MathUtils.clamp(playerPos.x + Math.cos(angle) * radius, -halfW + 1, halfW - 1);
        const z = THREE.MathUtils.clamp(playerPos.z + Math.sin(angle) * radius, -halfH + 1, halfH - 1);
        if (Math.hypot(x-playerPos.x,z-playerPos.z) < 6 || isWaterAtWorld(x,z)) continue;
        spawnPoint = new THREE.Vector3(x, Math.max(heightAtWorld(x,z),seaLevel), z);
        break;
      }
    }
    if (!spawnPoint) spawnPoint = new THREE.Vector3(
      THREE.MathUtils.clamp(playerPos.x + 24, -halfW+1, halfW-1), seaLevel,
      THREE.MathUtils.clamp(playerPos.z, -halfH+1, halfH-1));
    root.position.copy(spawnPoint);
    root.visible = true; setMovementState('idle');
    pendingMushroomAmbush = false;
    hasRegulationSpawn = true;
    stealth.noticeRegulation(); sightTimer = 0; playerVisible = false;
    lastKnownPosition.copy(playerPos);
    target.copy(lastKnownPosition);
    return true;
  }

  function resolvePlayerCollision(playerPos, playerCharacterRadius) {
    if (dead || !root.visible) return false;
    const touched = colliderSystem.resolvePlayerMonsterCollision({
      monsterRoot: root,
      playerPos,
      playerCharacterRadius,
      monsterCharacterRadius: characterRadius
    });
    if (touched) onPlayerContact();
    return touched;
  }

  function update(dt) {
    if (!root.visible) return;

    const { halfW, halfH } = getWorldBounds();
    const seaLevel = getSeaLevel();
    pickTimer -= dt;

    const playerPos = getPlayerPos();
    const playerDistance = Math.hypot(playerPos.x - root.position.x, playerPos.z - root.position.z);
    if (Number.isFinite(mushroomLureTimer)) {
      mushroomLureTimer = Math.max(0, mushroomLureTimer - dt);
      if (mushroomLureTimer <= 0) mushroomLureActive = false;
    }
    sightTimer -= dt;
    if (sightTimer <= 0) {
      // Hidden idle/walk/run models must not inflate the sight bounds.
      // Cast from the top center of the currently visible pose, not a fixed
      // height that can sit inside the terrain or below the monster's head.
      root.updateWorldMatrix(true, true);
      sightBounds.makeEmpty();
      for (const pose of root.children) {
        if (pose.visible) sightBounds.expandByObject(pose);
      }
      if(modelVisual){
        eye.copy(root.position);eye.y+=modelVisual.height*.93;
      } else if (sightBounds.isEmpty()) {
        eye.copy(root.position); eye.y += 2.2;
      } else {
        sightBounds.getCenter(eye);
        eye.y = sightBounds.max.y;
      }
      playerVisible = isWithinMonsterVisionCone(root.position, playerPos, root.rotation.y)
        && canSeePlayer(eye, playerPos);
      sightTimer = 0.12;
    }
    // Hearing ignores the vision cone and cover, but only while moving nearby.
    const heardPlayer = canMonsterHearMovement(
      playerDistance, getPlayerMovementSpeed(), 9 * worldUnitsPerMeter
    );
    const awareness = stealth.update(dt, playerDistance, playerVisible, heardPlayer);
    const knowsPosition = playerVisible || heardPlayer;
    // A strike grants one fixed investigation, not renewable knowledge of
    // each hiding place the player moves to during their escape.
    investigationTimer = Math.max(0, investigationTimer - dt);
    if (knowsPosition) {
      lastKnownPosition.copy(playerPos);
      // If sight interrupts the route, replan to the ORIGINAL cast location
      // when cover is regained, never to the newly hidden player.
      if (investigationTimer > 0) routePending = true;
    }
    const investigating = investigationTimer > 0 && !knowsPosition;
    const pursuing = awareness === 'pursuing' || investigating;
    const trackingPlayer = pursuing;
    if (awarenessMarker) {
      const symbol = investigating ? '?' : pursuing ? '!' : awareness === 'uncertain' ? '?' : '';
      if (symbol && awarenessMarker.userData.symbol !== symbol) {
        awarenessMarker.userData.draw(symbol); awarenessMarker.userData.symbol = symbol;
      }
      awarenessMarker.visible = !!symbol;
      awarenessMarker.position.copy(root.position); awarenessMarker.position.y += (modelVisual?.height ?? 2.8) + 0.35;
    }

    if (wasTrackingPlayer && !trackingPlayer) pickTarget();
    wasTrackingPlayer = trackingPlayer;

    if (investigating) {
      if (routePending) {
        investigationRoute = navigation.route(root.position, strikeSearchPosition);
        routePending = false;
      }
      while (investigationRoute.length && Math.hypot(investigationRoute[0].x-root.position.x, investigationRoute[0].z-root.position.z) < .6) investigationRoute.shift();
      target.copy(investigationRoute[0] || root.position);
    } else if (trackingPlayer) {
      // Reveal events provide a snapshot; they must not track through cover.
      target.copy(knowsPosition ? playerPos : lastKnownPosition);
    }

    const dx = target.x - root.position.x;
    const dz = target.z - root.position.z;
    const dist = Math.hypot(dx, dz);
    if (!trackingPlayer && (dist < 0.35 || pickTimer <= 0)) pickTarget();

    const tx = target.x - root.position.x;
    const tz = target.z - root.position.z;
    const d = Math.hypot(tx, tz);
    const atSearchSpot = investigating && !investigationRoute.length;
    const scanning = scan.update(dt, root.rotation.y, pursuing && !atSearchSpot, atSearchSpot || (awareness === 'uncertain' && !investigating));
    if (scanning.scanning) root.rotation.y = scanning.yaw;
    const moving = d > 0.45 && (awareness !== 'uncertain' || investigating) && !scanning.scanning;
    const desiredSpeed = pursuing && moving ? PURSUIT_SPEED : WANDER_SPEED;
    movementSpeed = desiredSpeed > movementSpeed
      ? Math.min(desiredSpeed, movementSpeed + PURSUIT_ACCELERATION * dt)
      : desiredSpeed;
    setMovementState(moving ? (pursuing && run ? 'run' : 'walk') : 'idle');

    if (moving) {
      dir.set(tx / d, 0, tz / d);
      const slopeMultiplier = getSlopeSpeedMultiplier(root.position.x, root.position.z, dir);
      const intendedStep = Math.min(d, movementSpeed * slopeMultiplier * dt);
      const prevX = root.position.x;
      const prevZ = root.position.z;
      const intendedX = root.position.x + dir.x * intendedStep;
      const intendedZ = root.position.z + dir.z * intendedStep;
      const terrainSpeedMultiplier = terrainTraversalSpeedMultiplier(
        prevX,
        prevZ,
        intendedX,
        intendedZ
      );
      const step = intendedStep * terrainSpeedMultiplier;
      const nextX = root.position.x + dir.x * step;
      const nextZ = root.position.z + dir.z * step;
      root.position.x = nextX;
      root.position.z = nextZ;
      const hitTree = colliderSystem.resolveTreeCircleCollisions(root.position, bodyRadius);
      if (hitTree && !pursuing) pickTimer = Math.min(pickTimer, 0.35);
      if (resolvePlayerCollision(playerPos, getPlayerCharacterRadius())) {
        pickTimer = Math.min(pickTimer, 0.45);
      }
      root.position.x = THREE.MathUtils.clamp(root.position.x, -halfW + 1, halfW - 1);
      root.position.z = THREE.MathUtils.clamp(root.position.z, -halfH + 1, halfH - 1);
      root.position.y = Math.max(heightAtWorld(root.position.x, root.position.z), seaLevel);
      root.rotation.y = Math.atan2(dir.x, dir.z);
    }

    if(modelVisual)modelVisual.update(dt);
    if (idleMixer && idle && idle.visible) idleMixer.update(dt);
    if (walkMixer && walk && walk.visible) walkMixer.update(dt);
    if (runMixer && run && run.visible) runMixer.update(dt);
  }

  function hitByPsionicLightning(point, radius) {
    if (dead || !root.visible) return false;
    const distance = Math.hypot(point.x - root.position.x, point.z - root.position.z);
    if (distance > radius + characterRadius || Math.abs(point.y - root.position.y) > radius) return false;
    health -= 1;
    if (health > 0) {
      // A direct hit exposes the caster even behind cover. Chase immediately;
      // ordinary sight rules resume after the brief revealed-position window.
      stealth.noticeStrike();
      lastKnownPosition.copy(getPlayerPos());
      strikeSearchPosition.copy(lastKnownPosition);
      investigationTimer = 10;
      investigationRoute = []; routePending = true;
      playerVisible = false; sightTimer = 0;
      target.copy(lastKnownPosition);
      return true;
    }
    dead = true;
    investigationTimer = 0; investigationRoute = []; routePending = false;
    movementSpeed = WANDER_SPEED;
    root.visible = false;
    pendingMushroomAmbush = false;
    mushroomLureActive = false;
    mushroomLureTimer = 0;
    wasTrackingPlayer = false;
    scan.reset();
    stealth.reset(); sightTimer = 0; playerVisible = false;
    if (awarenessMarker) awarenessMarker.visible = false;
    return true;
  }

  return {
    hitByPsionicLightning,
    get health() { return health; },
    get isDead() { return dead; },
    root,
    get modelView(){return modelVisual?.view || null;},
    loadModel,
    placeNextToPlayer,
    resetEncounter,
    pickTarget,
    beginMushroomAmbush,
    isVisibleToPlayer,
    setMushroomLureActive,
    triggerMushroomLure,
    resolvePlayerCollision,
    update,
    get characterRadius() {
      return characterRadius;
    }
  };
}
