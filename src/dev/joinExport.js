import * as THREE from 'three';
import {createPlayerAvatarSystem} from '../actors/prism.js';
for(const band of ['level','below']){
 const canvas=document.getElementById(band),renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true});
 renderer.setSize(2048,1508,false);renderer.setClearColor(0,0);renderer.setScissorTest(true);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1.5,-1.5,.01,100);
 const avatar=createPlayerAvatarSystem({scene,camera,playerCapsuleH:64,playerRadius:1,defaultCharacterRadius:.4,getObscurePlayerModel:()=>false});
 await avatar.whenViewsReady();
 const elevation=band==='level'?0:-Math.PI/4;camera.position.set(0,.99+10*Math.sin(elevation),10*Math.cos(elevation));camera.lookAt(0,.99,0);camera.updateMatrixWorld();camera.left=-1.5*256/377;camera.right=1.5*256/377;camera.updateProjectionMatrix();
 for(let p=0;p<4;p++)for(let d=0;d<8;d++){
  avatar.root.rotation.y=d/8*Math.PI*2;avatar.updateMixers(0,{progress:p/4,walking:true});
  renderer.setViewport(d*256,(3-p)*377,256,377);renderer.setScissor(d*256,(3-p)*377,256,377);renderer.render(scene,camera);
 }
}
document.getElementById('status').textContent='Ready';
for(const band of ['level','below']){
 const a=document.createElement('a');a.id='save-'+band;a.href=document.getElementById(band).toDataURL('image/png');a.download=band+'-before.png';a.textContent='Save '+band;document.body.prepend(a);
}
