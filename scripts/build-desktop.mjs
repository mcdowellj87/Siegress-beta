import { spawnSync } from 'node:child_process';
import { cp, readFile, writeFile, mkdir } from 'node:fs/promises';
const env={...process.env,SIEGRESS_DESKTOP:'1'};
for(const file of ['node_modules/vite/bin/vite.js','scripts/prepare-dist.mjs']) {
  const args=file.includes('/vite/')?[file,'build']:[file];
  const result=spawnSync(process.execPath,args,{env,stdio:'inherit'});
  if(result.status!==0)process.exit(result.status || 1);
}
await mkdir('dist-desktop/fonts',{recursive:true});
for(const weight of [500,700]) await cp(`node_modules/@fontsource/orbitron/files/orbitron-latin-${weight}-normal.woff2`,`dist-desktop/fonts/orbitron-${weight}.woff2`);
let html=await readFile('dist-desktop/index.html','utf8');
html=html.replace(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>/,'<style>@font-face{font-family:Orbitron;font-weight:500;font-display:swap;src:url(/fonts/orbitron-500.woff2)}@font-face{font-family:Orbitron;font-weight:700;font-display:swap;src:url(/fonts/orbitron-700.woff2)}</style>');
await writeFile('dist-desktop/index.html',html);
