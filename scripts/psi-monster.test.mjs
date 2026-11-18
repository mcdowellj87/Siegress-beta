import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three.module.js';
const stealthSource=(await readFile(new URL('../src/actors/monsterStealth.js',import.meta.url),'utf8')).replace("from 'three'",`from '${new URL('../vendor/three.module.js',import.meta.url).href}'`);
const stealthUrl='data:text/javascript;base64,'+Buffer.from(stealthSource).toString('base64');
const navigationSource=(await readFile(new URL('../src/actors/monsterNavigation.js',import.meta.url),'utf8')).replace("from 'three'",`from '${new URL('../vendor/three.module.js',import.meta.url).href}'`);
const navigationUrl='data:text/javascript;base64,'+Buffer.from(navigationSource).toString('base64');
const source=(await readFile(new URL('../src/actors/monster.js',import.meta.url),'utf8')).replace("from 'three'",`from '${new URL('../vendor/three.module.js',import.meta.url).href}'`).replace("from './monsterStealth.js'",`from '${stealthUrl}'`).replace("from './monsterNavigation.js'",`from '${navigationUrl}'`);
const {createMonsterSystem}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('two impacts kill, misses do not, and regulation ambush revives the monster',async()=>{
 let contacts=0;
 const player=new THREE.Vector3();
 let shoreline=false;
 const monster=createMonsterSystem({scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(),defaultCharacterRadius:1,bodyRadius:1,
 safeLoad:async()=>null,measuredCharacterRadius:()=>1,makeCharacterToonPhongMaterial:()=>new THREE.MeshBasicMaterial(),getSpawnRegion:()=>null,
 getPlayerPos:()=>player,getCameraYaw:()=>0,getWorldBounds:()=>({halfW:1000,halfH:1000}),getSeaLevel:()=>0,heightAtWorld:()=>0,isWaterAtWorld:(x,z)=>shoreline && Math.hypot(x-player.x,z-player.z)>16,
 onPlayerContact:()=>contacts++,colliderSystem:{resolvePlayerMonsterCollision:()=>true}});
 await monster.loadModel();
 assert.equal(monster.resolvePlayerCollision(new THREE.Vector3(),1),true);
 assert.equal(contacts,1);
 assert.equal(monster.hitByPsionicLightning({x:500,y:0,z:500},15),false);
 const initialPosition=monster.root.position.clone();
 monster.beginMushroomAmbush();
 assert.ok(monster.root.position.distanceTo(initialPosition)>1, 'first regulation summons the monster nearby');
 const point=monster.root.position.clone();
 monster.beginMushroomAmbush();
 assert.deepEqual(monster.root.position, point, 'nearby regulation must not relocate a living monster');
 assert.equal(monster.hitByPsionicLightning(point,15),true);
 assert.equal(monster.isDead,false);assert.equal(monster.health,1);
 monster.beginMushroomAmbush();
 assert.deepEqual(monster.root.position, point);
 assert.equal(monster.health,1, 'nearby regulation must not heal the monster');
 player.set(200,0,200);
 assert.equal(monster.beginMushroomAmbush(),true,'moving beyond 50 meters permits a new summon');
 assert.equal(monster.health,2,'distant resummon restores full health');
 const newPoint=monster.root.position.clone();
 assert.ok(newPoint.distanceTo(point)>100);
 assert.equal(monster.hitByPsionicLightning(newPoint,15),true);
 point.copy(newPoint);
 assert.equal(monster.hitByPsionicLightning(point,15),true);
 assert.equal(monster.isDead,true);assert.equal(monster.root.visible,false);
 assert.equal(monster.hitByPsionicLightning(point,15),false);
 assert.equal(monster.resolvePlayerCollision(new THREE.Vector3(),1),false);
 assert.equal(contacts,1);
 monster.update(.1);
 monster.beginMushroomAmbush();
 assert.equal(monster.isDead,false);assert.equal(monster.root.visible,true);assert.equal(monster.health,2);
 assert.ok(monster.root.position.distanceTo(point)>1);
 monster.resetEncounter();
 assert.equal(monster.root.visible,true);
 assert.equal(monster.isDead,false);
 assert.equal(monster.health,2);
 assert.equal(monster.beginMushroomAmbush(),true, 'first regulation after player restart must summon again');
 assert.equal(monster.root.visible,true);
 assert.equal(monster.beginMushroomAmbush(),false, 'later nearby regulation must not resummon');
 shoreline=true;
 monster.resetEncounter();
 assert.equal(monster.beginMushroomAmbush(),true,'shoreline fallback still summons after restart');
 assert.ok(Math.hypot(monster.root.position.x-player.x,monster.root.position.z-player.z)<=16,
   'failed random attempts must spawn on nearby land rather than original map spawn');
});

test('repeated player restarts restore living visible models, including a missing idle asset',async()=>{
 for(const walkOnly of [false,true]){
  const player=new THREE.Vector3(80,0,120);
  const monster=createMonsterSystem({scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(),defaultCharacterRadius:1,bodyRadius:1,
   safeLoad:async label=>walkOnly && !label.includes('walking') ? null : {scene:new THREE.Group(),animations:[]},
   applyCharacterShading:()=>{},measuredCharacterRadius:()=>1,makeCharacterToonPhongMaterial:()=>new THREE.MeshBasicMaterial(),getSpawnRegion:()=>null,
   getPlayerPos:()=>player,getCameraYaw:()=>0,getWorldBounds:()=>({halfW:1000,halfH:1000}),getSeaLevel:()=>0,heightAtWorld:()=>0,isWaterAtWorld:()=>false,
   colliderSystem:{resolvePlayerMonsterCollision:()=>false}});
  await monster.loadModel();
  for(let cycle=0;cycle<3;cycle++){
   const point=monster.root.position.clone();
   assert.equal(monster.hitByPsionicLightning(point,15),true);
   assert.equal(monster.hitByPsionicLightning(point,15),true);
   assert.equal(monster.isDead,true);assert.equal(monster.root.visible,false);
   player.x+=20;
   for(const pose of monster.root.children)pose.visible=false;
   monster.resetEncounter();
   assert.equal(monster.isDead,false);assert.equal(monster.health,2);
   assert.equal(monster.root.visible,true);
   assert.ok(monster.root.children.some(pose=>pose.visible),'a loaded pose must be visible');
   assert.ok(monster.root.position.distanceTo(player)<10,'restart places monster near the player');
  }
 }
});
