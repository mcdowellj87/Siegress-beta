import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from '../vendor/three.module.js';
const source = (await readFile(new URL('../src/actors/monsterStealth.js', import.meta.url), 'utf8')).replace("from 'three'", `from '${new URL('../vendor/three.module.js', import.meta.url).href}'`);
const { createMonsterStealth, createMonsterSight, isWithinMonsterVisionCone, createMonsterScan, canMonsterHearMovement } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
test('sight and range gate pursuit, cover immediately stops tracking, and reset forgets player', () => {
  const ai = createMonsterStealth({ detectionRange: 18, pursuitRange: 25 });
  assert.equal(ai.update(.1, 30, true), 'wandering');
  assert.equal(ai.update(.1, 10, false), 'wandering');
  assert.equal(ai.update(.1, 10, true), 'pursuing');
  assert.equal(ai.update(.1, 10, false), 'uncertain');
  assert.equal(ai.update(3.1, 10, false), 'wandering');
  ai.update(.1, 10, true); ai.reset();
  assert.equal(ai.state, 'wandering');
});
test('solid obstacles and terrain ridges block the sight ray', () => {
  const start = new THREE.Vector3(0, 2, 0), end = new THREE.Vector3(10, 2, 0);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(1, 5, 5), new THREE.MeshBasicMaterial());
  wall.position.set(5, 2, 0); wall.updateMatrixWorld(true);
  assert.equal(createMonsterSight({ heightAtWorld: () => 0, getOccluders: () => [] })(start, end), true);
  assert.equal(createMonsterSight({ heightAtWorld: () => 0, getOccluders: () => [wall] })(start, end), false);
  assert.equal(createMonsterSight({ heightAtWorld: x => x > 4 && x < 6 ? 3 : 0, getOccluders: () => [] })(start, end), false);
});

test('regulation reveals the player briefly, then cover works again', () => {
  const ai = createMonsterStealth();
  ai.noticeRegulation();
  assert.equal(ai.update(.1, 32, false), 'pursuing');
  ai.update(3, 32, false);
  assert.equal(ai.update(.1, 32, false), 'uncertain');
});

test('a strike exposes a hidden caster outside ordinary detection range', () => {
  const ai = createMonsterStealth();
  ai.noticeStrike();
  assert.equal(ai.update(.1, 30, false), 'pursuing');
  ai.update(3, 30, false);
  assert.equal(ai.update(.1, 30, false), 'uncertain');
});

test('60 degree cone follows the forward face and accepts only +/-30 degrees', () => {
  const origin = new THREE.Vector3();
  const point = degrees => new THREE.Vector3(Math.sin(degrees * Math.PI / 180) * 10, 0, Math.cos(degrees * Math.PI / 180) * 10);
  for (const angle of [-30, 0, 30]) assert.equal(isWithinMonsterVisionCone(origin, point(angle), 0), true);
  for (const angle of [-31, 31, 90, 180]) assert.equal(isWithinMonsterVisionCone(origin, point(angle), 0), false);
  assert.equal(isWithinMonsterVisionCone(origin, point(90), Math.PI / 2), true);
});

test('default sight range detects distant players when visible', () => {
  const ai = createMonsterStealth();
  assert.equal(ai.update(.1, 100000, true), 'pursuing');
  assert.equal(ai.update(.1, 100000, false), 'uncertain');
});

test('patrol pauses and turns to scan, but spotting the player interrupts it', () => {
  const scan = createMonsterScan(() => .75);
  const result = scan.update(7, 0, false, false);
  assert.equal(result.scanning, true);
  assert.notEqual(result.yaw, 0);
  assert.equal(scan.update(.1, result.yaw, true, false).scanning, false);
  assert.equal(scan.update(.1, 0, false, true).scanning, true);
});

test('nearby movement alerts through cover; silence and distant movement do not', () => {
  assert.equal(canMonsterHearMovement(2, 3), true);
  assert.equal(canMonsterHearMovement(2, 0), false);
  assert.equal(canMonsterHearMovement(8, 3), true);
  assert.equal(canMonsterHearMovement(10, 3), false);
  const ai = createMonsterStealth();
  assert.equal(ai.update(.1, 2, false, true), 'pursuing');
  assert.equal(ai.update(.1, 2, false, false), 'uncertain');
});
