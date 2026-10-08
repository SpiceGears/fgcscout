import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=mkdtempSync(join(tmpdir(),'fgc-season-'));
try {
 execFileSync(process.execPath,['frontend/node_modules/typescript/bin/tsc','frontend/src/lib/seasonData.ts','--module','commonjs','--target','ES2022','--skipLibCheck','--outDir',dir],{stdio:'inherit'});
 const {teamRecord,isPlayed,resolveSeason,seasonTeams}=createRequire(import.meta.url)(join(dir,'seasonData.js'));
 const match=(played,redScore,blueScore,teamKey='pol')=>({data:{played,redScore,blueScore,participants:[{teamKey,station:11,country:'POL',countryCode:'pl'}]}});
 const scheduled=match(false,0,100);
 assert.deepEqual(teamRecord([scheduled,match(false,0,0)],'pol'),{wins:0,losses:0,ties:0,played:0});
 assert.deepEqual(teamRecord([scheduled,match(true,20,10),match(true,5,8),match(true,0,0)],'pol'),{wins:1,losses:1,ties:1,played:3});
 assert.equal(isPlayed({played:false,data:{redScore:99}}),false);
 assert.equal(isPlayed(match(true,0,0)),true);
 assert.equal(resolveSeason([2024,2026,2025]),2026);
 assert.equal(resolveSeason([2024,2026,2025],'2025'),2025);
 assert.equal(resolveSeason([2024,2026,2025],'2020'),2026);
 assert.equal(resolveSeason([]),null);
 assert.deepEqual(seasonTeams([scheduled,match(true,3,2)]).map(team=>team.id),['pol']);
 assert.deepEqual(seasonTeams([match(true,3,2,'2025-only')]).map(team=>team.id),['2025-only']);
 console.log('Season tests passed: pending matches excluded, real zero-score ties retained, latest/selected season and roster scope.');
} finally {rmSync(dir,{recursive:true,force:true});}
