import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import * as THREE from '../vendor/three.module.js';
import { settleGroundContact } from '../src/physics/groundContact.js';
import { selectRobotView } from '../src/actors/robotViews.js';
const source = (await readFile(new URL('../src/physics/colliders.js',import.meta.url),'utf8'))
  .replace("'three'", JSON.stringify(new URL('../vendor/three.module.js',import.meta.url).href))
  .replace("'../world/mushroomShape.js'",JSON.stringify(new URL('../src/world/mushroomShape.js',import.meta.url).href));
const {createColliderSystem}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function world(){return createColliderSystem({getPlayerCapsuleConfig:()=>({playerEyeHeight:1.7,playerRadius:.38,playerCapsuleH:1.45}),getTreeTrunkColliderBuffer:()=>.38,getWorldBounds:()=>({halfW:100,halfH:100}),getSeaLevel:()=>-10,heightAtWorld:()=>0});}
function mushroom(w){w.colliders.push({type:'mushroom-cap',center:new THREE.Vector3(0,28,0),radius:10,height:5,tag:'mushroom-cap'});w.rebuildGrid();}
test('fall lands on mushroom even when crossing a spatial grid cell',()=>{const w=world();mushroom(w);const p=new THREE.Vector3(0,27,0);assert.equal(w.resolvePlayerCollisions(p,36,0,0),true);assert.equal(p.y,34.7);assert.equal(w.lastSupportTag,'mushroom-cap');});
test('jump clears mushroom and walking off removes support',()=>{const w=world();mushroom(w);assert.equal(w.resolvePlayerCollisions(new THREE.Vector3(0,35,0),34.7,0,0),false);assert.equal(w.resolvePlayerCollisions(new THREE.Vector3(11,34,0),34.7,9,0),false);});
test('robot and player can stand below the cap without being teleported upward',()=>{const w=world();mushroom(w);const p=new THREE.Vector3(0,1.7,0);assert.equal(w.resolvePlayerCollisions(p,1.7,0,0),false);assert.equal(p.y,1.7);});
test('terrain landing cancels downward speed and holds contact',()=>{const p={y:1},v={y:-15};assert.equal(settleGroundContact(p,v,1.7,false),true);assert.equal(p.y,1.7);assert.equal(v.y,0);assert.equal(settleGroundContact(p,v,1.7,false),true);});
test('leaving support falls without large scale-dependent ground snapping',()=>{const p={y:2.5},v={y:-1};assert.equal(settleGroundContact(p,v,1.7,false),false);assert.equal(p.y,2.5);assert.equal(v.y,-1);});
test('jumping does not retain old support or cancel upward velocity',()=>{const p={y:5},v={y:10};assert.equal(settleGroundContact(p,v,1.7,true),false);assert.equal(v.y,10);});
test('overhead cameras choose overhead sprites; low cameras never use below sprites',()=>{assert.equal(selectRobotView({x:0,y:10,z:2}).set,'overhead');assert.equal(selectRobotView({x:0,y:-10,z:2}).set,'level');});
test('directions wrap and remain stable directly overhead',()=>{assert.equal(selectRobotView({x:0,y:0,z:5}).frame,0);const back=selectRobotView({x:0,y:0,z:-5});assert.equal(back.frame,8);assert.equal(selectRobotView({x:0,y:10,z:0,previousAzimuth:Math.PI}).frame,4);});
test('missing level directions use mirrored sheets',()=>{const v=selectRobotView({x:5,y:0,z:0});assert.equal(v.mirrored,true);assert.equal(v.frame,4);});

test("walking a full circle changes the robot view and prefers original frames",()=>{
  const frames=new Set();
  for(let degrees=0;degrees<360;degrees+=22.5){
    const angle=degrees*Math.PI/180;
    const view=selectRobotView({x:-Math.sin(angle)*5,y:0,z:Math.cos(angle)*5});
    frames.add(view.frame+":"+view.mirrored);
  }
  assert.equal(frames.size,16);
  const angle=202.5*Math.PI/180;
  const original=selectRobotView({x:-Math.sin(angle)*5,y:0,z:Math.cos(angle)*5});
  assert.equal(original.frame,9);
  assert.equal(original.mirrored,false);
});

test('downhill terrain stays grounded for a continuous descent without airborne gait resets',()=>{
  const p={y:10},v={y:0};let groundY=10;
  for(let i=0;i<180;i++){
    const previousY=p.y,previousGroundY=groundY;
    const distance=.15;groundY-=.075;v.y-=28/60;p.y+=v.y/60;
    assert.equal(settleGroundContact(p,v,groundY,false,{wasGrounded:true,previousY,previousGroundY,horizontalDistance:distance}),true);
    assert.equal(p.y,groundY);assert.equal(v.y,0);
  }
});
test('slope following releases at a cliff and never pulls a mushroom-top player to terrain',()=>{
  const p={y:9.99},v={y:-.46};
  assert.equal(settleGroundContact(p,v,0,false,{wasGrounded:true,previousY:10,previousGroundY:10,horizontalDistance:.1}),false);
  assert.equal(p.y,9.99);
  assert.equal(settleGroundContact(p,v,0,false,{wasGrounded:true,previousY:10,previousGroundY:0,horizontalDistance:8}),false);
});
test('downhill following cannot snap an airborne or rising player to the ground',()=>{
  for(const [wasGrounded,speed] of [[false,-1],[true,5]]){
    const p={y:10},v={y:speed};
    assert.equal(settleGroundContact(p,v,9.9,false,{wasGrounded,previousY:10,previousGroundY:10,horizontalDistance:.2}),false);
    assert.equal(p.y,10);assert.equal(v.y,speed);
  }
});
test('actual NPC plane keeps its spawn heading and orientation when camera rotates in place',async t=>{
  const robotSource=(await readFile(new URL('../src/actors/trackedRobot.js',import.meta.url),'utf8'))
    .replace("'three'",JSON.stringify(new URL('../vendor/three.module.js',import.meta.url).href))
    .replace("'./robotViews.js'",JSON.stringify(new URL('../src/actors/robotViews.js',import.meta.url).href));
  const {createTrackedRobotSystem}=await import('data:text/javascript;base64,'+Buffer.from(robotSource).toString('base64'));
  const manifest=JSON.parse(await readFile(new URL('../assets/robot/manifest.json',import.meta.url),'utf8'));
  t.mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>manifest}));
  t.mock.method(THREE.TextureLoader.prototype,'loadAsync',async()=>new THREE.Texture());
  const oldDocument=globalThis.document;
  globalThis.document={baseURI:'http://localhost/'};
  try{
    const camera=new THREE.PerspectiveCamera();camera.position.set(0,1,5);
    const npc=createTrackedRobotSystem({scene:new THREE.Scene(),camera,playerVisualHeight:2,heightAtWorld:()=>0,spawnFacingYaw:0});
    npc.place({centerX:0,centerZ:-1.7,bodyRadius:1,floorY:0});await npc.load();
    const mesh=npc.root.children[0];assert.equal(mesh.isMesh,true);assert.equal(mesh.isSprite,undefined);
    const rotation=mesh.quaternion.toArray(),offset=mesh.material.map.offset.toArray();
    camera.rotation.set(.8,2.4,.6);camera.updateMatrixWorld();npc.update();
    assert.deepEqual(mesh.quaternion.toArray(),rotation);
    assert.deepEqual(mesh.material.map.offset.toArray(),offset);
    assert.equal(npc.root.userData.spawnFacingYaw,0);
    camera.position.set(0,1,-5);camera.updateMatrixWorld();npc.update();
    assert.notDeepEqual(mesh.material.map.offset.toArray(),offset);
    assert.equal(npc.root.userData.spawnFacingYaw,0);
    const rearOffset=mesh.material.map.offset.toArray();
    camera.rotation.set(-.9,-1.3,0);camera.updateMatrixWorld();npc.update();
    assert.deepEqual(mesh.material.map.offset.toArray(),rearOffset);
  }finally{if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;}
});
