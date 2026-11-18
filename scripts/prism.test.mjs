import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import * as THREE from '../vendor/three.module.js';
registerHooks({resolve(specifier,context,next){return next(specifier==='three'?new URL('../vendor/three.module.js',import.meta.url).href:specifier,context);}});
const {createPlayerAvatarSystem}=await import('../src/actors/prism.js');
test('placeholder keeps foot anchoring, camera center, collision radius and visibility without loading art',async()=>{
 const scene=new THREE.Scene();let obscure=false;
 const avatar=createPlayerAvatarSystem({scene,playerCapsuleH:64,playerRadius:1,defaultCharacterRadius:.55,getObscurePlayerModel:()=>obscure});
 await avatar.loadModel();await avatar.whenViewsReady();
 const mesh=avatar.root.children[0];assert.equal(mesh.material.color.getHex(),0);assert.equal(mesh.material.map,null);
 const box=new THREE.Box3().setFromObject(avatar.root);assert.ok(Math.abs(box.min.y)<1e-6);assert.ok(Math.abs(box.max.y-1.32)<1e-6);assert.equal(avatar.characterRadius,.55);
 avatar.root.position.set(3,5,7);assert.deepEqual(avatar.getOrbitCenter(new THREE.Vector3()).toArray(),[3,5.99,7]);
 avatar.setVisible(false);avatar.updateMixers(.016);assert.equal(avatar.root.visible,false);
 avatar.setVisible(true);obscure=true;avatar.ensureReady();assert.equal(avatar.root.visible,false);
 obscure=false;avatar.ensureReady();assert.equal(avatar.root.visible,true);
});
