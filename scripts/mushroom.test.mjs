import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three.module.js';
import {mushroomFootprint,sampleMushroomRadius} from '../src/world/mushroomShape.js';
const moduleUrl=(path)=>new URL(path,import.meta.url).href;
const moundSource=(await readFile(new URL('../src/world/mound.js',import.meta.url),'utf8'))
  .replace("'three'",JSON.stringify(moduleUrl('../vendor/three.module.js')))
  .replace("'./mushroomShape.js'",JSON.stringify(moduleUrl('../src/world/mushroomShape.js')));
const {createMushroomStoreSystem}=await import('data:text/javascript;base64,'+Buffer.from(moundSource).toString('base64'));
const colliderSource=(await readFile(new URL('../src/physics/colliders.js',import.meta.url),'utf8'))
  .replace("'three'",JSON.stringify(moduleUrl('../vendor/three.module.js')))
  .replace("'../world/mushroomShape.js'",JSON.stringify(moduleUrl('../src/world/mushroomShape.js')));
const {createColliderSystem}=await import('data:text/javascript;base64,'+Buffer.from(colliderSource).toString('base64'));
function lobedMap(){
 const data=new Uint8Array(64*64*4);
 for(let y=0;y<64;y++)for(let x=0;x<64;x++){
  const dx=x+.5-32,dy=y+.5-32;
  if(Math.hypot(dx,dy)>12+4*Math.cos(3*Math.atan2(dy,dx)))continue;
  data.set([255,58,138,255],(y*64+x)*4);
 }
 return data;
}
function fixture(){
 const levelRoot=new THREE.Group();
 const collisions=createColliderSystem({getPlayerCapsuleConfig:()=>({playerEyeHeight:1.7,playerRadius:.38,playerCapsuleH:1.45}),getTreeTrunkColliderBuffer:()=>.38,getWorldBounds:()=>({halfW:100,halfH:100}),getSeaLevel:()=>-10,heightAtWorld:()=>0});
 const system=createMushroomStoreSystem({levelRoot,colliders:collisions.colliders,getMetrics:()=>({mapW:64,mapH:64,cell:1,halfW:32,halfH:32}),heightAtWorldRaw:()=>0,storeHeight:10});
 system.buildFromBitmap(lobedMap());collisions.rebuildGrid();
 return {levelRoot,collisions,system};
}
test('map lobes survive outline sampling instead of becoming a circular cap',()=>{
 const shape=mushroomFootprint(lobedMap(),64,64,1,32,32);
 assert.ok(Math.max(...shape.radialProfile)/Math.min(...shape.radialProfile)>1.6);
 assert.ok(sampleMushroomRadius(shape.radialProfile,0)>sampleMushroomRadius(shape.radialProfile,Math.PI/3));
 assert.ok(Math.abs(shape.centerX)<.1 && Math.abs(shape.centerZ)<.1);
});
test('mushroom has one thick waisted stem, lobed upper and lower caps, and no entrance',()=>{
 const {levelRoot,system}=fixture();
 const group=levelRoot.children[0];
 assert.deepEqual(group.children.map(x=>x.name),['mushroom-lobed-stem','mushroom-lobed-cap','mushroom-lobed-underside']);
 assert.ok(Math.abs(system.state.bodyRadius/system.state.capRadius-.275)<1e-6);
 assert.ok(group.children[1].geometry.getAttribute('position').count>1000);
});
test('cap collision lands on lobes but leaves the gaps between lobes unsupported',()=>{
 const {system,collisions}=fixture();const c=collisions.colliders[0],profile=c.radialProfile;
 const minimum=profile.indexOf(Math.min(...profile)),maximum=profile.indexOf(Math.max(...profile));
 const distance=(profile[minimum]+profile[maximum])/2;
 const point=sector=>{const a=sector/profile.length*Math.PI*2;return new THREE.Vector3(c.center.x+Math.cos(a)*distance,6,c.center.z+Math.sin(a)*distance);};
 const gap=point(minimum);assert.equal(collisions.resolvePlayerCollisions(gap,20,gap.x,gap.z),false);
 const lobe=point(maximum);assert.equal(collisions.resolvePlayerCollisions(lobe,20,lobe.x,lobe.z),true);
 const expected=c.center.y+c.height*Math.sqrt(1-(distance/profile[maximum])**2)+1.7;
 assert.ok(Math.abs(lobe.y-expected)<1e-6);
 const spawn=new THREE.Vector3(system.state.centerX,system.state.height+1.7-.01,system.state.centerZ);
 assert.equal(collisions.resolvePlayerCollisions(spawn,system.state.height+1.7,spawn.x,spawn.z),true);
 assert.ok(Math.abs(spawn.y-system.state.height-1.7)<1e-6);
});
test('rebuilding or removing a map marker clears obsolete cap meshes and colliders',()=>{
 const {levelRoot,collisions,system}=fixture();system.buildFromBitmap(lobedMap());
 assert.equal(levelRoot.children.length,1);assert.equal(collisions.colliders.length,1);
 system.buildFromBitmap(new Uint8Array(64*64*4));
 assert.equal(system.state,null);assert.equal(levelRoot.children.length,0);assert.equal(collisions.colliders.length,0);
});

import {smoothMushroomGround} from '../src/world/mushroomGround.js';
test('raised landing ground keeps the roof fixed and makes sprinting off it nonfatal',()=>{
 const data=lobedMap(),heights=new Float32Array(64*64).fill(20);
 const height=(36.25+19)*.443*.5125,fatal=10.2,speed=9,gravity=28;
 const prepared=smoothMushroomGround(data,heights,new Uint8Array(64*64),{mapW:64,mapH:64,cell:1,halfW:32,halfH:32,mushroomHeight:height,fatalFallDistance:fatal,landingMargin:speed*Math.sqrt(2*height/gravity)});
 const terrain=(x,z)=>heights[Math.round(z+32)*64+Math.round(x+32)];
 const levelRoot=new THREE.Group(),colliders=[];
 const system=createMushroomStoreSystem({levelRoot,colliders,getMetrics:()=>({mapW:64,mapH:64,cell:1,halfW:32,halfH:32}),heightAtWorldRaw:terrain,storeHeight:height});
 system.buildFromBitmap(data,prepared);
 const roof=system.state.floorY+system.state.height;
 assert.ok(Math.abs(roof-(21+height))<1e-6,'cap elevation stays fixed');
 assert.ok(Math.abs(system.state.height-fatal*.75)<1e-5);
 assert.ok(levelRoot.children[0].children[0].geometry.getAttribute('position').count>1000,'thin stem retains clearance');
 assert.equal(colliders[0].height,height*.34,'cap thickness stays fixed');
 for(let direction=0;direction<16;direction++){
  const angle=direction*Math.PI/8,dx=Math.cos(angle),dz=Math.sin(angle);
  let radius=system.state.capRadius+.1,y=roof,velocity=0,landed=false;
  for(let frame=0;frame<180;frame++){
   velocity-=gravity/60;y+=velocity/60;radius+=speed/60;
   const ground=terrain(prepared.centerX+dx*radius,prepared.centerZ+dz*radius);
   if(y<=ground){
    assert.ok(radius<prepared.radius,'sprint landing stays on the raised area');
    assert.ok(roof-ground<fatal,'landing is below fatal fall distance');
    landed=true;break;
   }
  }
  assert.ok(landed,'all directions land');
 }
});

test('stem follows the cap lobes and narrows at its waist between broad ends',()=>{
 const {levelRoot,system}=fixture();
 const positions=levelRoot.children[0].children[0].geometry.getAttribute('position');
 const profile=levelRoot.children[0].children[1].geometry.getAttribute('position');
 const sectors=128,stride=sectors+1;
 const radius=(ring,sector)=>Math.hypot(positions.getX(ring*stride+sector),positions.getZ(ring*stride+sector));
 for(let sector=0;sector<sectors;sector++){
  assert.ok(radius(12,sector)<radius(0,sector)*.7);
  assert.ok(Math.abs(radius(24,sector)-radius(0,sector))<1e-6);
  const capRadius=Math.hypot(profile.getX(20*stride+sector),profile.getZ(20*stride+sector));
  assert.ok(Math.abs(radius(24,sector)/capRadius-.275)<1e-6);
 }
});
