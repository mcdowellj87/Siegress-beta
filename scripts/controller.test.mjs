import test from 'node:test';
import assert from 'node:assert/strict';
import {createControllerInput,deadZone} from '../src/input/controller.js';
test('dead zone rejects drift and preserves analog magnitude',()=>{
 assert.deepEqual(deadZone(.05,.05),{x:0,y:0});
 assert.ok(deadZone(.5,0).x>0 && deadZone(.5,0).x<1);
 assert.equal(deadZone(1,0).x,1);
});
test('controller actions fire once per press and disconnect restores fallback',()=>{
 let pad={index:0,connected:true,axes:[0,-.5,.3,0],buttons:Array.from({length:16},()=>({pressed:false}))};
 const actions=[];const input=createControllerInput({getGamepads:()=>pad?[pad]:[],onAction:a=>actions.push(a)});
 assert.equal(input.poll().connected,true);assert.ok(input.state.moveY>0);
 pad.buttons[0].pressed=true;input.poll();input.poll();assert.deepEqual(actions,['cast']);
 pad.buttons[10].pressed=true;input.poll();assert.equal(input.state.running,true);
 input.poll(false);assert.equal(input.state.moveY,0);assert.equal(input.state.running,false);
 input.poll();assert.deepEqual(actions,['cast'],'focus return must not repeat held cast');
 pad=null;assert.equal(input.poll().connected,false);assert.equal(input.state.moveY,0);
});
