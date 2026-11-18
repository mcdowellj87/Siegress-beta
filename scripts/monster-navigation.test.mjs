import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three.module.js';
const source=(await readFile(new URL('../src/actors/monsterNavigation.js',import.meta.url),'utf8')).replace("from 'three'",`from '${new URL('../vendor/three.module.js',import.meta.url).href}'`);
const {createMonsterNavigation}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('routes around cover to a fixed remembered spot',()=>{
 const wall=new THREE.Mesh(new THREE.BoxGeometry(2,5,5),new THREE.MeshBasicMaterial());
 wall.position.set(5,2,0);wall.updateMatrixWorld(true);
 const nav=createMonsterNavigation({getOccluders:()=>[wall],heightAtWorld:()=>0,isWaterAtWorld:()=>false,radius:.5});
 const goal=new THREE.Vector3(10,0,0);
 const route=nav.route(new THREE.Vector3(),goal);
 assert.ok(route.length>1);
 assert.ok(route.some(p=>Math.abs(p.z)>2.5));
 assert.deepEqual(route.at(-1),goal);
 goal.set(30,0,30);
 assert.deepEqual(route.at(-1),new THREE.Vector3(10,0,0),'route must not follow a moving hidden target');
});
