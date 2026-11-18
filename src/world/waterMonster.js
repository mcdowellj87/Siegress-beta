import * as THREE from 'three';
import {createWaterMonsterSprites} from './waterMonsterSprites.js';
import {createWaterMonsterCombat} from './waterMonsterCombat.js';
import {createMonsterSight} from '../actors/monsterStealth.js';
const FALLBACK_MAP_X=1455,FALLBACK_MAP_Y=828;
export function findWaterMonsterSpawnMarker(data, mapW, mapH) {
  if (!data) return null;

  const mask = new Uint8Array(mapW * mapH);
  for (let i = 0; i < mask.length; i++) {
    const p = i * 4;
    if (data[p] >= 240 && data[p + 1] <= 24 && data[p + 2] >= 240 && data[p + 3] >= 16) {
      mask[i] = 1;
    }
  }

  const seen = new Uint8Array(mask.length);
  let best = null;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;

    const queue = [start];
    seen[start] = 1;
    let count = 0;
    let sumX = 0;
    let sumY = 0;
    let minX = mapW;
    let minY = mapH;
    let maxX = 0;
    let maxY = 0;

    for (let q = 0; q < queue.length; q++) {
      const i = queue[q];
      const x = i % mapW;
      const y = Math.floor(i / mapW);
      count++;
      sumX += x;
      sumY += y;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      const neighbors = [i - 1, i + 1, i - mapW, i + mapW];
      for (const next of neighbors) {
        if (next < 0 || next >= mask.length || !mask[next] || seen[next]) continue;
        const nx = next % mapW;
        const ny = Math.floor(next / mapW);
        if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue;
        seen[next] = 1;
        queue.push(next);
      }
    }

    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    const fill = count / (width * height);
    const compact = width <= 64 && height <= 64 && fill >= 0.45;
    if (compact && count >= 9 && (!best || count > best.count)) {
      best = { x: sumX / count, y: sumY / count, minX, minY, maxX, maxY, count };
    }
  }

  return best;
}


export function createWaterMonsterSystem({levelRoot,camera,getMetrics,getPlayerPosition,playerHeight,playerEyeHeight=playerHeight*.77,playerVisualHeight=playerHeight*.03,getPlayerRadius=()=>.6,heightAtWorld=()=>-Infinity,getOccluders=()=>[],canAttack=()=>true,canDamage=()=>true,onImpact=()=>{},onDeath=()=>{}}){
 let monster=null,visual=null,combat=null;const target=new THREE.Vector3(),muzzle=new THREE.Vector3();
 const displayHeight=playerHeight*.128;
 let sightObjects=[],sightRefresh=0;
 const canSee=createMonsterSight({heightAtWorld,getOccluders:()=>sightObjects});
 function reset(){combat?.reset();visual?.setPose('idle',0);}
 async function build(mapData){
  combat?.dispose();visual?.dispose();monster?.parent?.remove(monster);monster=new THREE.Group();monster.name='water-monster';
  const {mapW,mapH,cell,halfW,halfH,seaLevel}=getMetrics();if(!mapW||!mapH)return;
  const marker=findWaterMonsterSpawnMarker(mapData,mapW,mapH),mapX=THREE.MathUtils.clamp(marker?.x??FALLBACK_MAP_X,0,mapW-1),mapY=THREE.MathUtils.clamp(marker?.y??FALLBACK_MAP_Y,0,mapH-1);
  monster.position.set(mapX*cell-halfW+cell*.5,seaLevel+.05,mapY*cell-halfH+cell*.5);levelRoot.add(monster);
  visual=createWaterMonsterSprites({root:monster,camera,height:displayHeight});
  try{await visual.load();monster.add(visual.root);}catch(error){console.warn('[Water monster sprites] using original drawing:',error);const texture=await new THREE.TextureLoader().loadAsync('./images/water_monster.png');texture.colorSpace=THREE.SRGBColorSpace;const fallback=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));fallback.center.set(.5,.12);fallback.scale.set(displayHeight*1.25,displayHeight*1.25,1);monster.add(fallback);}
  combat=createWaterMonsterCombat({root:levelRoot,
   getMuzzle:()=>muzzle.set(monster.position.x+Math.sin(monster.rotation.y)*displayHeight*.22,monster.position.y+displayHeight*.35,monster.position.z+Math.cos(monster.rotation.y)*displayHeight*.22),
   getTarget:()=>target.copy(getPlayerPosition()).add(new THREE.Vector3(0,-playerEyeHeight+playerVisualHeight*.55,0)),
   getCapsule:()=>({position:getPlayerPosition(),radius:getPlayerRadius(),footY:getPlayerPosition().y-playerEyeHeight+getPlayerRadius(),headY:getPlayerPosition().y-playerEyeHeight+playerVisualHeight-getPlayerRadius()*.3}),
   canAttack,canDamage,canSee,onImpact,onDeath,onPose:(state,progress)=>visual?.setPose(state,progress)});
  update(0,false);
 }
 function update(dt=0,active=true){if(!monster)return;if(active){sightRefresh-=dt;if(sightRefresh<=0){sightObjects=getOccluders();sightRefresh=.2;}}const player=getPlayerPosition();monster.rotation.y=Math.atan2(player.x-monster.position.x,player.z-monster.position.z);combat?.update(dt,active);if(!active)visual?.setPose('idle',0);visual?.update(0);}
 return {build,update,reset,get root(){return monster;},get spriteView(){return visual?.view;}};
}
