import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const base = (process.env.FGCSCOUT_BASE_URL ?? 'http://localhost').replace(/\/$/, '');
const key = process.env.FGCSCOUT_ADMIN_API_KEY;
if (process.env.FGCSCOUT_RUN_VIDEO_TESTS !== '1' || !key) throw new Error('Use only the isolated CI database.');
async function api(path, method = 'GET', body, expectedStatus = 200) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(base + path, {method, headers:{'Content-Type':'application/json','X-Admin-Key':key}, body:body === undefined ? undefined : JSON.stringify(body)});
    if (response.status === 429 && attempt < 3) { await new Promise(resolve => setTimeout(resolve, 20000)); continue; }
    assert.equal(response.status, expectedStatus, await response.clone().text());
    return response.json();
  }
}
assert.equal((await api('/api/GameData/2026')).length, 0, 'Existing season; refusing to overwrite.');
assert(!(await api('/api/admin/seasons')).some(season => season.year === 2026), 'Existing season configuration; refusing to overwrite.');
const source = JSON.parse(readFileSync('data-2026.json', 'utf8'));
try {
  await api('/api/admin/importSeason?replaceExisting=false', 'POST', source);
  // Exercise the deployed Compose allowlist, not just the appsettings default.
  const config = {name:'FIRST Global Challenge 2026',sourceUrl:'https://api.first.global/v1',syncEnabled:false,syncIntervalMinutes:1};
  const configured = await api('/api/admin/seasons/2026', 'PUT', config);
  assert.equal(configured.sourceUrl, config.sourceUrl);
  await api('/api/admin/seasons/2026', 'PUT', {...config,sourceUrl:'http://api.first.global/v1'}, 400);
  await api('/api/admin/seasons/2026', 'PUT', {...config,sourceUrl:'https://api.first.global.evil.example/v1'}, 400);
  const stored = await api('/api/GameData/2026');
  assert.equal(stored.length, 342);
  assert.equal(stored.filter(match => !match.data.played).length, 340);
  const scheduled = stored.find(match => match.data.name === 'Ranking Match 1');
  const video = {url:'https://www.youtube.com/watch?v=Hy2VGJjoMoo',match_number:1,start_timestamp:265,end_timestamp:415};
  const imported = await api('/api/admin/seasons/2026/videos/import','POST',{entries:[video],dryRun:false});
  assert.equal(imported.imported, 1);
  const update = structuredClone(source.matches[0]);
  Object.assign(update, {played:true,redScore:131,blueScore:97,actualStartTime:'2026-10-08T11:15:00+09:00',details:source.matches.find(match => match.played).details});
  update.details = {...update.details, id:update.id, tournamentKey:update.tournamentKey};
  await api('/api/admin/importSeason?replaceExisting=false', 'POST', {matches:[update]});
  const changed = await api(`/api/GameData/match/${scheduled.id}`);
  assert.equal(changed.id, scheduled.id);
  assert.equal(changed.data.played, true);
  assert.equal(changed.data.redScore, 131);
  assert.equal(changed.data.videoStartTimestamp, 265);
  assert.equal(changed.data.participants.length, 6);
  assert.equal((await api('/api/GameData/2026')).length, 342);
  console.log('2026 import passed: complete supplied schedule, number-only video, scheduled→played update, stable ID and preserved video.');
} finally { await api('/api/admin/seasons/2026', 'DELETE'); }
