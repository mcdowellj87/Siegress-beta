import * as THREE from 'three';
import { mushroomFootprint } from './mushroomShape.js';

function capGeometry(profile, height, underside = false) {
  const positions = [], indices = [];
  const sectors = profile.length, rings = 20;
  for (let ring = 0; ring <= rings; ring++) {
    const theta = ring / rings * Math.PI / 2;
    for (let sector = 0; sector <= sectors; sector++) {
      const angle = sector / sectors * Math.PI * 2;
      const radius = profile[sector % sectors] * Math.sin(theta);
      positions.push(Math.cos(angle) * radius,
        Math.cos(theta) * height * (underside ? -1 : 1), Math.sin(angle) * radius);
    }
  }
  for (let ring = 0; ring < rings; ring++) for (let sector = 0; sector < sectors; sector++) {
    const a = ring * (sectors + 1) + sector;
    const b = a + sectors + 1, c = b + 1, d = a + 1;
    indices.push(...(underside ? [a,b,c,a,c,d] : [a,c,b,a,d,c]));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

function stemGeometry(profile, capRadius, bodyRadius, height, foundationDepth) {
  const positions = [], indices = [];
  const sectors = profile.length, rings = 24;
  for (let ring = 0; ring <= rings; ring++) {
    const t = ring / rings;
    const y = -foundationDepth + t * (height + foundationDepth);
    const aboveGround = Math.max(0, y / height);
    // Broad shoulders and roots, with a smooth waist halfway up the stem.
    const width = 0.65 + 0.35 * Math.pow(2 * aboveGround - 1, 2);
    for (let sector = 0; sector <= sectors; sector++) {
      const angle = sector / sectors * Math.PI * 2;
      const radius = profile[sector % sectors] / capRadius * bodyRadius * width;
      positions.push(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    }
  }
  for (let ring = 0; ring < rings; ring++) for (let sector = 0; sector < sectors; sector++) {
    const a = ring * (sectors + 1) + sector, b = a + sectors + 1;
    indices.push(a,b,a+1,a+1,b,b+1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

export function createMushroomStoreSystem({ levelRoot, colliders, getMetrics, heightAtWorldRaw, storeHeight }) {
  let storeGroup = null, store = null;
  function clear() {
    if (storeGroup) {
      levelRoot.remove(storeGroup);
      storeGroup.traverse(object => {
        object.geometry?.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) material?.dispose();
      });
      // Allow rebuilds to replace this mushroom without leaving ghost landing surfaces.
      for (let i = colliders.length - 1; i >= 0; i--) {
        if (colliders[i].owner === storeGroup) colliders.splice(i, 1);
      }
    }
    storeGroup = null; store = null;
  }
  function buildFromBitmap(data, groundPreparation = null) {
    clear();
    const { mapW, mapH, cell, halfW, halfH } = getMetrics();
    const footprint = mushroomFootprint(data, mapW, mapH, cell, halfW, halfH);
    if (!footprint) return;
    const { centerX, centerZ, capRadius, radialProfile, pixelCount } = footprint;
    const bodyRadius = Math.max(cell * 0.18, capRadius * 0.055) * 5;
    const floorY = heightAtWorldRaw(centerX, centerZ);
    const roofY = (groundPreparation?.foundationY ?? floorY) + storeHeight;
    const capHeight = storeHeight * 0.34;
    const bodyHeight = roofY - capHeight - floorY;
    const group = new THREE.Group(); group.name = 'starting-lobed-mushroom';
    const foundationDepth = Math.max(cell, 0.5);
    const stem = new THREE.Mesh(
      stemGeometry(radialProfile, capRadius, bodyRadius, bodyHeight, foundationDepth),
      new THREE.MeshStandardMaterial({color:0x3088a0,roughness:0.9})
    );
    stem.name = 'mushroom-lobed-stem';
    stem.position.set(centerX, floorY, centerZ);
    stem.receiveShadow = true; group.add(stem);
    const cap = new THREE.Mesh(capGeometry(radialProfile, capHeight),
      new THREE.MeshStandardMaterial({color:0x50a8c0,roughness:0.78,emissive:0x0b2f3a,emissiveIntensity:0.25}));
    cap.name = 'mushroom-lobed-cap';
    cap.position.set(centerX, floorY + bodyHeight, centerZ);
    cap.receiveShadow = true; group.add(cap);
    const underside = new THREE.Mesh(capGeometry(radialProfile, Math.max(0.5, capHeight * 0.08), true),
      new THREE.MeshStandardMaterial({color:0x386f80,roughness:0.95}));
    underside.name = 'mushroom-lobed-underside';
    underside.position.copy(cap.position); group.add(underside);
    colliders.push({type:'mushroom-cap',center:cap.position.clone(),radius:capRadius,
      radialProfile,height:capHeight,tag:'mushroom-cap',owner:group});
    levelRoot.add(group); storeGroup = group;
    store = {centerX,centerZ,floorY,capRadius,bodyRadius,height:roofY-floorY,pixelCount};
  }
  return {buildFromBitmap,clear,get state(){return store ? {...store} : null;}};
}
