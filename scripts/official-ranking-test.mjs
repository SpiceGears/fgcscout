import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=mkdtempSync(join(tmpdir(),'official-ranking-'));
try {
 execFileSync(process.execPath,['frontend/node_modules/typescript/bin/tsc','frontend/src/lib/officialRankings.ts','--module','commonjs','--target','ES2022','--skipLibCheck','--outDir',dir],{stdio:'inherit'});
 const {officialRankingRows}=createRequire(import.meta.url)(join(dir,'officialRankings.js'));
 const source=JSON.parse(readFileSync('scripts/fixtures/rankings-2026.json','utf8'));
 const rows=officialRankingRows(source);
 assert.equal(rows.length,185);
 for(const row of rows) {
   const official=source.find(item=>String(item.teamKey)===row.key);
   assert.equal(row.rank,official.rank);
   assert.equal(row.rankingScore,official.rankingScore);
   assert.equal(row.highestPoints,official.highestScore);
   assert.equal(row.climbPoints,official.climbPoints);
   assert.equal(row.played,official.played);
 }
 assert.equal(rows[0].countryRaw,'MEX');
 assert.equal(rows[0].rankingScore,498.5);
 assert.equal(rows[1].countryRaw,'UZB');
 assert.equal(rows[1].rankingScore,480.5);
 assert.equal(rows[0].climbPoints.toLocaleString('en-US',{maximumFractionDigits:3}),'0.9');
 assert.deepEqual(officialRankingRows([]),[]);
 const tie=[{...source[0],teamKey:'b',rank:2,rankingScore:9000},{...source[1],teamKey:'a',rank:1,rankingScore:1}];
 assert.equal(officialRankingRows(tie)[0].key,'a'); // API rank wins over local score sorting.
 console.log('All 185 official ranking rows match API values and official order.');
} finally {rmSync(dir,{recursive:true,force:true});}
