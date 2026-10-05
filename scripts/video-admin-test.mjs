// Integration test for the isolated CI stack. Never seed or clean up an existing season.
import assert from "node:assert/strict";
const base = (process.env.FGCSCOUT_BASE_URL ?? "http://localhost").replace(/\/$/, "");
const key = process.env.FGCSCOUT_ADMIN_API_KEY;
if (process.env.FGCSCOUT_RUN_VIDEO_TESTS !== "1" || !key) throw new Error("Run only against an isolated test database with FGCSCOUT_RUN_VIDEO_TESTS=1 and an admin key.");
async function api(path, method = "GET", body, status = 200, credential = key) {
  const response = await fetch(base + path, { method, headers: { "X-Admin-Key": credential, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  assert.equal(response.status, status, `${method} ${path}: ${await response.clone().text()}`);
  return response.json();
}
const year = 2100;
const original = await api(`/api/GameData/${year}`);
const configs = await api("/api/admin/seasons");
assert.equal(original.length, 0, "Test season already exists; refusing to mutate it.");
assert(!configs.some(config => config.year === year), "Test season configuration already exists; refusing to mutate it.");
const season = { matches: [1, 2, 3].map(id => ({ id, eventKey: "FGC_2100-VIDEO-TEST", tournamentKey: "t1", name: `Qualification Match ${id}`, field: 1, played: true })) };
await api("/api/admin/importSeason?replaceExisting=false", "POST", season);
try {
  const matches = await api(`/api/GameData/${year}`);
  assert.equal(matches.length, 3);
  const video = { url: "https://www.youtube.com/watch?v=Hy2VGJjoMoo", start_timestamp: 265, end_timestamp: 415 };
  const path = `/api/admin/seasons/${year}/videos/import`;
  let preview = await api(path, "POST", { entries: [video], dryRun: true });
  assert.equal(preview.rows[0].status, "unassigned");
  const mapped = { ...video, matchId: matches[0].id };
  preview = await api(path, "POST", { entries: [mapped], dryRun: true });
  assert.equal(preview.rows[0].status, "ready");
  const duplicate = await api(path, "POST", { entries: [mapped, mapped], dryRun: false });
  assert.equal(duplicate.imported, 0);
  assert.equal(duplicate.rows[0].status, "duplicate");
  const saved = await api(path, "POST", { entries: [mapped], dryRun: false });
  assert.equal(saved.imported, 1);
  const repeat = await api(path, "POST", { entries: [mapped], dryRun: false });
  assert.equal(repeat.rows[0].status, "already_imported");
  const recovered = await api(path, "POST", { entries: [video], dryRun: true });
  assert.equal(recovered.rows[0].status, "already_imported");
  assert.equal(recovered.rows[0].matchId, matches[0].id);
  const conflict = await api(path, "POST", { entries: [{ ...mapped, start_timestamp: 500, end_timestamp: 650 }], dryRun: false });
  assert.equal(conflict.imported, 0);
  assert.equal(conflict.rows[0].status, "conflict");
  const invalid = await api(path, "POST", { entries: [{ ...video, matchId: matches[1].id, end_timestamp: 200 }, { ...video, matchId: "000000000000000000000000" }], dryRun: false });
  assert.equal(invalid.imported, 0);
  assert.equal(invalid.rows[0].status, "invalid");
  assert.equal(invalid.rows[1].status, "not_found");
  const auto = await api(path, "POST", { entries: [{ ...video, field: 1, match_number: 2 }], dryRun: false });
  assert.equal(auto.imported, 1);
  // A normal source update must retain imported video metadata.
  await api("/api/admin/importSeason?replaceExisting=false", "POST", season);
  const persisted = await api(`/api/GameData/${year}`);
  assert.equal(persisted.find(match => match.id === matches[0].id).data.videoStartTimestamp, 265);
  assert.equal(persisted.find(match => match.id === matches[0].id).data.videoEndTimestamp, 415);
  const livePath = `/api/admin/seasons/${year}/live-video`;
  const stream = { field: 1, url: video.url, matchDuration: 150 };
  // Save paused to avoid contacting an actual broadcast during CI.
  const live = await api(livePath, "PUT", { enabled: false, streams: [stream] });
  assert.equal(live.streams[0].url, video.url);
  await api(livePath, "PUT", { enabled: true, streams: [stream, stream] }, 400);
  await api(livePath, "PUT", { enabled: true, streams: [{ ...stream, url: "http://127.0.0.1/private" }] }, 400);
  await api(livePath + "/status", "PUT", { revision: live.revision, pendingCount: 2, error: null, streams: [{ field: 1, status: "paused", error: null, lastVideoTimestamp: 415 }] });
  const paused = await api(livePath);
  assert.equal(paused.enabled, false);
  assert.equal(paused.pendingCount, 2);
  assert(paused.workerSeenAt);
  await api(livePath + "/status", "PUT", { revision: live.revision - 1, pendingCount: 0, streams: [] }, 409);
  await api(livePath, "GET", undefined, 401, "wrong-key");
  // Wait for the real managed worker to pick up the paused configuration.
  let observed = false;
  for (let attempt = 0; attempt < 8; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    const current = await api(livePath);
    if (current.pendingCount === 0 && current.workerSeenAt) { observed = true; break; }
  }
  assert(observed, "Managed worker did not report its heartbeat.");
  console.log("Video admin integration passed: import, retry, duplicate/conflict protection, metadata preservation, config validation and managed worker heartbeat.");
} finally {
  await api(`/api/admin/seasons/${year}`, "DELETE");
}
