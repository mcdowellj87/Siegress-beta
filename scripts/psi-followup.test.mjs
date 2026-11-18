import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import * as THREE from '../vendor/three.module.js';
registerHooks({resolve(s,c,n){return n(s==='three'?new URL('../vendor/three.module.js',import.meta.url).href:s,c);}});
import {createPsionicSystem} from '../src/player/psionics.js';
import {createPsiLightning} from '../src/player/psiLightning.js';
const {createMonsterSystem}=await import('../src/actors/monster.js');
function makePsi(){return createPsionicSystem({rootEl:{style:{setProperty(){}},classList:{toggle(){}},setAttribute(){}},fillEl:{style:{}},valueEl:{},cameraSystem:{setViewMode(){}},monsterSystem:{beginMushroomAmbush(){},setMushroomLureActive(){}}});}
test('a charge at the 60% entry threshold can land both monster hits across the full one-second cooldown',async()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),player=new THREE.Vector3(0,40,0);
 const monster=createMonsterSystem({scene,camera,defaultCharacterRadius:.85,bodyRadius:.1,safeLoad:async()=>null,measuredCharacterRadius:()=>.85,makeCharacterToonPhongMaterial:()=>new THREE.MeshBasicMaterial(),getSpawnRegion:()=>null,getPlayerPos:()=>player,getCameraYaw:()=>0,getWorldBounds:()=>({halfW:1000,halfH:1000}),getSeaLevel:()=>0,heightAtWorld:()=>7,isWaterAtWorld:()=>false,colliderSystem:{resolvePlayerMonsterCollision:()=>false}});
 await monster.loadModel();monster.root.position.set(0,7,-125);
 const psi=makePsi();psi.setCriticality(.6);camera.position.set(0,40,0);camera.lookAt(monster.root.position);let view='third';
 const lightning=createPsiLightning({scene,camera,cameraSystem:{get viewMode(){return view;},setViewMode(v){view=v;}},psionicSystem:psi,heightAtWorld:()=>7,scale:25,handEl:{style:{}},onImpact:(point,radius)=>{if(monster.hitByPsionicLightning(point,radius))psi.dischargeStrike();}});
 assert(lightning.toggleAiming());assert(lightning.cast());lightning.update(.5,true);assert.equal(monster.health,1);assert.equal(psi.isCritical,false);assert(psi.canCastStrike);assert.equal(lightning.cooldownRemaining,1);
 lightning.update(.75,true);assert.equal(lightning.isCasting,false);assert.equal(lightning.cast(),false,'one-second cooldown must still block early casts');lightning.update(.25,true);assert.equal(lightning.cooldownRemaining,0);assert(lightning.cast(),'follow-up must work below the entry threshold');lightning.update(.5,true);assert.equal(monster.health,0);assert(monster.isDead);assert.equal(psi.canCastStrike,false);
 lightning.update(2,true);psi.update(2,true);assert.equal(lightning.cast(),false,'passive refill must not grant endless follow-ups');
});
test('manual psi changes, regulation and respawn clear a reserved follow-up',()=>{const psi=makePsi();for(const reset of [()=>psi.setCriticality(.1),()=>psi.startRegulation(),()=>psi.reset()]){psi.reset();psi.setCriticality(.6);psi.dischargeStrike();assert(psi.canCastStrike);reset();assert.equal(psi.canCastStrike,false);}});
test('misses do not consume the follow-up; a fresh critical charge restores ordinary readiness',()=>{const psi=makePsi();psi.setCriticality(.9);psi.dischargeStrike();assert(psi.canCastStrike);psi.update(1,true);assert(psi.canCastStrike);psi.dischargeStrike();assert.equal(psi.canCastStrike,false);psi.setCriticality(.6);assert(psi.canCastStrike);});
