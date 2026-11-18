import * as THREE from 'three';

// A bounded local A* route to a remembered location, never the hidden player's
// live position. Test the monster's body width against solid mesh raycasts.
export function createMonsterNavigation({ getOccluders, heightAtWorld, isWaterAtWorld, radius = .5 }) {
  const ray = new THREE.Raycaster();
  const from = new THREE.Vector3(), to = new THREE.Vector3(), direction = new THREE.Vector3();
  function clear(a, b, objects) {
    if (isWaterAtWorld(b.x, b.z)) return false;
    const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz);
    if (length < .01) return true;
    for (const offset of [-radius, 0, radius]) {
      from.set(a.x - dz / length * offset, heightAtWorld(a.x, a.z) + 1, a.z + dx / length * offset);
      to.set(b.x - dz / length * offset, heightAtWorld(b.x, b.z) + 1, b.z + dx / length * offset);
      direction.subVectors(to, from);
      ray.far = direction.length(); ray.near = .01;
      direction.normalize(); ray.set(from, direction);
      if (ray.intersectObjects(objects, false).length) return false;
    }
    return true;
  }
  return {
    route(start, goal) {
      const objects = getOccluders?.() || [];
      if (clear(start, goal, objects)) return [goal.clone()];
      const cell = Math.max(1.5, radius * 2.5);
      const key = (x,z) => `${x},${z}`;
      const point = (x,z) => new THREE.Vector3(start.x + x * cell, 0, start.z + z * cell);
      const h = p => Math.hypot(p.x - goal.x, p.z - goal.z);
      const first = {x:0,z:0,p:start.clone(),g:0,f:h(start),parent:null};
      const open=[first], costs=new Map([[key(0,0),0]]);
      let best=first;
      for(let count=0;open.length && count<1200;count++) {
        open.sort((a,b)=>b.f-a.f); const node=open.pop();
        if(h(node.p)<h(best.p))best=node;
        if(h(node.p)<=cell*1.5 && clear(node.p,goal,objects)) {
          const path=[goal.clone()];
          for(let n=node;n.parent;n=n.parent)path.unshift(n.p);
          return path;
        }
        for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
          const x=node.x+dx,z=node.z+dz,p=point(x,z),g=node.g+Math.hypot(dx,dz)*cell,k=key(x,z);
          if(g>h(start)+40 || g>=(costs.get(k)??Infinity) || !clear(node.p,p,objects))continue;
          p.y=heightAtWorld(p.x,p.z);costs.set(k,g);
          open.push({x,z,p,g,f:g+h(p),parent:node});
        }
      }
      const path=[];
      for(let n=best;n.parent;n=n.parent)path.unshift(n.p);
      return path;
    }
  };
}
