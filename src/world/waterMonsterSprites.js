import * as THREE from 'three';
import {selectPlayerView} from '../actors/spriteViews.js';
const cache=new Map();
export function createWaterMonsterSprites({root,camera,height=7.072,baseUrl='./assets/water-monster-sprites/'}){
 const material=new THREE.SpriteMaterial({transparent:true,alphaTest:.08,depthWrite:false,toneMapped:false});
 const sprite=new THREE.Sprite(material);sprite.name='water-monster-painted';sprite.center.set(.5,.12);sprite.scale.set(height*1.25,height*1.25,1);sprite.visible=false;
 const uniforms={frameRect:{value:new THREE.Vector4()},celEnabled:{value:1}};
 material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,uniforms);shader.fragmentShader='uniform vec4 frameRect;uniform float celEnabled;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
  vec4 texel=texture2D(map,frameRect.xy+vMapUv*frameRect.zw);
  float blue=step(texel.r*1.3,texel.b)*step(texel.r*1.3,texel.g);
  float light=max(texel.g,texel.b);
  vec3 ink=vec3(.002,.018,.04);
  ink=mix(ink,vec3(.003,.073,.14),step(.07,light));
  ink=mix(ink,vec3(.004,.26,.43),step(.23,light));
  ink=mix(ink,vec3(.008,.6,.85),step(.55,light));
  texel.rgb=mix(texel.rgb,ink,blue*celEnabled*.85);
  texel.a=smoothstep(.15,.75,texel.a);diffuseColor*=texel;
  #endif`);};material.customProgramCacheKey=()=> 'water-monster-four-cyan-ink-v1';
 let manifest,previousAzimuth=0,state='idle',phaseProgress=0,viewInfo;
 const textures=new Map(),offset=new THREE.Vector3();
 async function load(){manifest=await (await fetch(baseUrl+'manifest.json',{cache:'no-store'})).json();await Promise.all(manifest.files.map(async file=>{const url=baseUrl+file+'?v='+manifest.version;if(!cache.has(url))cache.set(url,new THREE.TextureLoader().loadAsync(url));const texture=await cache.get(url);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;textures.set(file,texture);}));sprite.visible=true;update(0);return sprite;}
 function update(dt=0,preview){if(!manifest)return;if(preview){state=preview.action;phaseProgress=preview.progress;}else phaseProgress=(phaseProgress+dt/1.6)%1;
  offset.copy(camera.position).sub(root.position);offset.y-=height*.4;const v=selectPlayerView({x:offset.x,y:offset.y,z:offset.z,facingYaw:root.rotation.y,previousAzimuth});previousAzimuth=v.azimuth;
  const action=['idle','swim','fire'].includes(state)?state:'idle',rows=manifest.views[v.set][action],direction=action==='idle'?v.frame:Math.round(v.frame/2)%8,phase=action==='idle'?0:Math.floor(phaseProgress*4)%4,frame=action==='idle'?rows[direction]:rows[phase][direction];
  const texture=textures.get(frame.file);if(material.map!==texture){material.map=texture;material.needsUpdate=true;}uniforms.frameRect.value.set(frame.x/frame.atlas[0],1-(frame.y+360)/frame.atlas[1],360/frame.atlas[0],360/frame.atlas[1]);viewInfo={set:v.set,direction,action,phase,phaseCount:action==='idle'?1:4};
 }
 return {root:sprite,load,update,setPose(action,progress=0){state=action;phaseProgress=progress;},setCelShading(enabled){uniforms.celEnabled.value=enabled?1:0;},dispose(){material.dispose();},get view(){return viewInfo;}};
}
