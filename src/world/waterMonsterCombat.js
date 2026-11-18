import * as THREE from 'three';
import {makeAnomalyGlowTexture,CHERENKOV_BLUE} from './anomalyGlow.js';

// Squared distance between a shot's swept segment and the upright player capsule.
export function orbHitsCapsule(start,end,player,radius,footY,headY,orbRadius=.55){
 const lo=Math.min(footY,headY),hi=Math.max(footY,headY),dx=end.x-start.x,dy=end.y-start.y,dz=end.z-start.z;
 const cuts=[0,1];if(Math.abs(dy)>1e-9)for(const y of [lo,hi]){const t=(y-start.y)/dy;if(t>0&&t<1)cuts.push(t);}cuts.sort((a,b)=>a-b);
 for(let i=1;i<cuts.length;i++){
  const a=cuts[i-1],b=cuts[i],mid=(a+b)/2,y=start.y+dy*mid,cy=y<lo?lo:y>hi?hi:null;
  const x0=start.x-player.x,z0=start.z-player.z,y0=cy===null?0:start.y-cy,vy=cy===null?0:dy;
  const denom=dx*dx+vy*vy+dz*dz,t=denom?THREE.MathUtils.clamp(-(x0*dx+y0*vy+z0*dz)/denom,a,b):a;
  if((x0+dx*t)**2+(z0+dz*t)**2+(y0+vy*t)**2<=(radius+orbRadius)**2)return true;
 }return false;
}
export function createWaterMonsterCombat({root,getMuzzle,getTarget,getCapsule,canAttack=()=>true,canDamage=()=>true,canSee=()=>true,onImpact=()=>{},onDeath=()=>{},onPose=()=>{},textureFactory=makeAnomalyGlowTexture,range=85,speed=22,cooldown=2.7,chargeSeconds=.85}){
 const texture=textureFactory(),orbs=[],charge=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,color:CHERENKOV_BLUE,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,fog:false}));charge.visible=false;root.add(charge);
 let wait=1.4,charging=-1,wounds=0,dead=false,clock=0;
 const target=new THREE.Vector3(),muzzle=new THREE.Vector3();
 function remove(orb){root.remove(orb.group);orb.group.traverse(o=>o.material?.dispose());orbs.splice(orbs.indexOf(orb),1);}
 function launch(){
  const group=new THREE.Group();for(const scale of [1.1,3.8]){const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,color:CHERENKOV_BLUE,transparent:true,opacity:scale>2?.32:1,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,fog:false}));sprite.scale.set(scale,scale,1);group.add(sprite);}
  group.position.copy(muzzle);root.add(group);orbs.push({group,velocity:target.clone().sub(muzzle).normalize().multiplyScalar(speed),age:0});
 }
 function reset(){for(const orb of [...orbs])remove(orb);wounds=0;dead=false;wait=1.4;charging=-1;charge.visible=false;onPose('idle',0);}
 function update(dt,active=true){
  if(!active||dead){charge.visible=false;return;}dt=Math.max(0,Math.min(dt,.25));clock+=dt;
  const capsule=getCapsule();
  for(const orb of [...orbs]){
   const before=orb.group.position.clone(),after=before.clone().addScaledVector(orb.velocity,dt);orb.age+=dt;
   const hit=orbHitsCapsule(before,after,capsule.position,capsule.radius,capsule.footY,capsule.headY);
   // Cover intercepts shots before they can reach the player.
   const dx=after.x-before.x,dz=after.z-before.z,denom=dx*dx+dz*dz;
   const closest=hit&&denom?before.clone().lerp(after,THREE.MathUtils.clamp(((capsule.position.x-before.x)*dx+(capsule.position.z-before.z)*dz)/denom,0,1)):after;
   if(!canSee(before,closest)){remove(orb);continue;}
   orb.group.position.copy(after);orb.group.scale.setScalar(.94+Math.sin(clock*30)*.06);
   if(hit){remove(orb);if(canDamage()){wounds++;onImpact();if(wounds>=2){dead=true;for(const other of [...orbs])remove(other);onDeath();}}}
   else if(orb.age>range/speed+1)remove(orb);
  }
  if(dead)return;
  muzzle.copy(getMuzzle());target.copy(getTarget());const inRange=muzzle.distanceTo(target)<=range;
  if(!canAttack()||!inRange||!canSee(muzzle,target)){charging=-1;charge.visible=false;wait=Math.max(wait,.5);onPose('swim',(clock/1.6)%1);return;}
  if(charging>=0){charging+=dt;charge.position.copy(muzzle);charge.visible=true;charge.scale.setScalar(.3+Math.min(1,charging/chargeSeconds)*1.8);onPose('fire',Math.min(.99,charging/chargeSeconds));if(charging>=chargeSeconds){launch();charging=-1;wait=cooldown;charge.visible=false;}}
  else {wait-=dt;onPose('swim',(clock/1.6)%1);if(wait<=0){charging=0;onPose('fire',0);}}
 }
 return {update,reset,dispose(){reset();root.remove(charge);charge.material.dispose();texture.dispose();},get projectileCount(){return orbs.length;},get isCharging(){return charging>=0;}};
}
