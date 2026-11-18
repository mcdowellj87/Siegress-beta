import test from 'node:test';
import assert from 'node:assert/strict';
import {findPsiGroundTarget} from '../src/player/psiAim.js';
test('center ray finds ground within range and rejects sky and distant hits',()=>{
 const origin={x:0,y:2,z:0};
 const direction={x:0,y:-Math.SQRT1_2,z:-Math.SQRT1_2};
 const target=findPsiGroundTarget(origin,direction,()=>0,20);
 assert.ok(Math.abs(target.z+2)<1e-5);assert.equal(target.y,0);
 assert.equal(findPsiGroundTarget(origin,{x:0,y:1,z:0},()=>0,20),null);
 assert.equal(findPsiGroundTarget(origin,{x:0,y:-.01,z:-Math.sqrt(.9999)},()=>0,20),null);
 assert.equal(findPsiGroundTarget(origin,{x:0,y:-1,z:0},()=>0,1.9),null);
 assert.ok(findPsiGroundTarget(origin,{x:0,y:-1,z:0},()=>0,2));
});
test('ground height changes move the intersection along the same aim ray',()=>{
 const target=findPsiGroundTarget({x:0,y:4,z:0},{x:Math.SQRT1_2,y:-Math.SQRT1_2,z:0},x=>x*.5,20);
 assert.ok(Math.abs(target.x-8/3)<1e-5);assert.ok(Math.abs(target.y-4/3)<1e-5);
});
