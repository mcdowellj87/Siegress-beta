const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {resolveAsset}=require('./asset-path.cjs');
const root=path.resolve('dist-desktop');
test('game root, asset queries and encoded paths resolve inside the bundle',()=>{
  assert.equal(resolveAsset(root,'siegress://game/'),path.join(root,'index.html'));
  assert.equal(resolveAsset(root,'siegress://game/assets/ui/hand.png?v=3'),path.join(root,'assets/ui/hand.png'));
  assert.equal(resolveAsset(root,'siegress://game/fonts/a%20b.woff2'),path.join(root,'fonts/a b.woff2'));
});
test('reject other origins and encoded directory escapes',()=>{
  for(const url of ['https://game/','siegress://elsewhere/','siegress://game/%2e%2e%2fsecret','siegress://game/%5csecret','siegress://game/%00','siegress://game/%ZZ']) assert.throws(()=>resolveAsset(root,url));
});
