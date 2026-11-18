import test from 'node:test';
import assert from 'node:assert/strict';
import {createPsionicSystem} from '../src/player/psionics.js';
test('godmode fixes psi at threshold, blocks regulation, and toggles back to normal',()=>{
 const psi=createPsionicSystem({rootEl:{style:{setProperty(){}},classList:{toggle(){}},setAttribute(){}},fillEl:{style:{}},valueEl:{},cameraSystem:{setViewMode(){}},monsterSystem:{setMushroomLureActive(){},beginMushroomAmbush(){throw Error('godmode regulation must not start')}}});
 psi.toggleGodMode();assert.equal(psi.isGodMode,true);assert.equal(psi.criticality,.6);
 psi.update(100,true);assert.equal(psi.criticality,.6);
 psi.dischargeStrike();assert.equal(psi.criticality,.6);
 psi.setCriticality(1);assert.equal(psi.criticality,.6);
 assert.equal(psi.startRegulation(),false);
 psi.reset();assert.equal(psi.criticality,.6);
 psi.toggleGodMode();psi.update(1,true);assert.ok(psi.criticality>.6);
 psi.dischargeStrike();assert.ok(psi.criticality<.6);
});
