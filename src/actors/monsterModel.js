import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/GLTFLoader.js';
import { DRACOLoader } from '../../vendor/DRACOLoader.js';
import { clone as cloneSkeleton } from '../../vendor/SkeletonUtils.js';
export const MONSTER_SIZE_SCALE = 2 / 3;
export const MONSTER_HEIGHT = 2.8 * MONSTER_SIZE_SCALE;
const MODEL_URL='./assets/monster/MuffinMan-torso-linked.glb?v=paint-padding-1';
let assetPromise;
function loadAsset(){
 if(!assetPromise){const draco=new DRACOLoader();draco.setDecoderPath('./assets/draco/');draco.setWorkerLimit(1);const loader=new GLTFLoader();loader.setDRACOLoader(draco);assetPromise=loader.loadAsync(MODEL_URL).finally(()=>draco.dispose()).catch(error=>{assetPromise=null;throw error;});}
 return assetPromise;
}
export function createMonsterModelVisual({height=MONSTER_HEIGHT}={}){
 const root=new THREE.Group();root.name='Muffin Man torso-linked 3D';let model,mixer,hips,base,active='idle',actions={},clips={},time=0,ready=false;
 function setState(next){
  if(!['idle','walk','run'].includes(next))throw Error('Invalid monster action');
  if(next===active&&actions[next]?.isRunning())return;
  const previous=actions[active];active=next;if(!ready)return;
  const action=actions[next];action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
  if(previous&&previous!==action)action.crossFadeFrom(previous,.12,false);
 }
 async function load(){
  if(ready)return;const asset=await loadAsset();model=cloneSkeleton(asset.scene);
  const bones=[];
  model.traverse(o=>{if(o.isSkinnedMesh){const ids=o.geometry.attributes.skinIndex;for(const index of ids.array)if(index>=o.skeleton.bones.length)throw Error('Invalid compressed monster bone index');if(o.skeleton.bones.some(b=>!b))throw Error('Unbound monster skeleton');}});
  model.traverse(o=>{
   if(o.isBone){bones.push(o.name);if(!hips&&/hips|pelvis/i.test(o.name))hips=o;}
   if(o.isMesh){const old=o.material;const paint=source=>{if(source.map)source.map.anisotropy=4;return new THREE.MeshBasicMaterial({map:source.map,color:source.color?.clone()||new THREE.Color('white'),side:THREE.DoubleSide,toneMapped:false});};o.material=Array.isArray(old)?old.map(paint):paint(old);o.castShadow=false;o.receiveShadow=false;}
  });
  if(bones.some(name=>/head|neck/i.test(name)))throw Error('Monster GLB still contains head/neck bones');
  root.add(model);mixer=new THREE.AnimationMixer(model);
  for(const name of ['idle','walk','run']){const clip=asset.animations.find(c=>c.name.toLowerCase()===name);if(!clip)throw Error(`Monster GLB missing ${name}`);clips[name]=clip;actions[name]=mixer.clipAction(clip);}
  actions.idle.play();mixer.update(0);model.updateMatrixWorld(true);
  if(hips)base=hips.position.clone();
  const box=new THREE.Box3().setFromObject(model,true),size=box.getSize(new THREE.Vector3());
  if(!Number.isFinite(size.y)||size.y<=0)throw Error('Invalid monster height');
  const scale=height/size.y,center=box.getCenter(new THREE.Vector3());root.scale.setScalar(scale);model.position.add(new THREE.Vector3(-center.x,-box.min.y,-center.z));
  ready=true;setState(active);root.updateMatrixWorld(true);
 }
 function update(dt=0,preview){
  if(!ready)return;
  if(preview){setState(preview.action||active);for(const [name,action]of Object.entries(actions)){action.stopFading();action.stopWarping();action.enabled=name===active;action.setEffectiveWeight(name===active?1:0);}actions[active].time=(preview.progress||0)*clips[active].duration;mixer.update(0);}
  else{time+=dt;mixer.update(dt);}
  if(hips){hips.position.x=base.x;hips.position.z=base.z;}
  root.updateMatrixWorld(true);
 }
 return {root,height,load,setState,update,get view(){return {type:'3d-glb',action:active,clip:clips[active]?.name,progress:clips[active]?actions[active].time/clips[active].duration:0,bonesRemoved:true,ready};},dispose(){mixer?.stopAllAction();root.removeFromParent();model?.traverse(o=>{if(o.isMesh)for(const m of [].concat(o.material))m.dispose();});}};
}
