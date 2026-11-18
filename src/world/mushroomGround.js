import { mushroomFootprint } from './mushroomShape.js';

// Modify the runtime heightfield only; the user's map image remains authoritative.
export function smoothMushroomGround(data, heights, waterMask, {mapW,mapH,cell,halfW,halfH,sampleStep=1,mushroomHeight=0,fatalFallDistance=Infinity,landingMargin=0}) {
  const footprint=mushroomFootprint(data,mapW,mapH,cell,halfW,halfH);
  if(!footprint)return null;
  const {centerX,centerZ,capRadius}=footprint;
  const radius=capRadius+Math.max(3,sampleStep)*cell+landingMargin;
  const feather=Math.max(12*cell,capRadius*.8);
  const values=[];
  for(let y=0;y<mapH;y++)for(let x=0;x<mapW;x++){
    const i=y*mapW+x;
    if(!waterMask?.[i] && Math.hypot(x*cell-halfW-centerX,y*cell-halfH-centerZ)<=capRadius)values.push(heights[i]);
  }
  if(!values.length)return null;
  values.sort((a,b)=>a-b);
  // Anchor the cap to the prior elevation instead of lifting it with the ground.
  const foundationY=values[Math.floor(values.length/2)]+cell;
  const safeDrop=Math.min(mushroomHeight,fatalFallDistance*.75);
  const lift=Math.max(0,mushroomHeight-safeDrop);
  const floorY=foundationY+lift;
  const gx=(centerX+halfW)/cell,gy=(centerZ+halfH)/cell,reach=(radius+feather)/cell;
  for(let y=Math.max(0,Math.floor(gy-reach));y<=Math.min(mapH-1,Math.ceil(gy+reach));y++){
    for(let x=Math.max(0,Math.floor(gx-reach));x<=Math.min(mapW-1,Math.ceil(gx+reach));x++){
      const i=y*mapW+x;if(waterMask?.[i])continue;
      const distance=Math.hypot(x*cell-halfW-centerX,y*cell-halfH-centerZ);
      if(distance>radius+feather)continue;
      const t=Math.max(0,Math.min(1,(distance-radius)/feather));
      const blend=t*t*(3-2*t);
      heights[i]=floorY*(1-blend)+heights[i]*blend;
    }
  }
  return {centerX,centerZ,floorY,foundationY,safeDrop,radius,feather};
}
