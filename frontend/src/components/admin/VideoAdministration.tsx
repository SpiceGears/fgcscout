"use client";

import { useEffect, useState } from "react";
import { FileJson, Plus, Radio, RefreshCw, Save, Trash2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
type Season = { year: number; name: string };
type Match = { id: string; data: { name?: string; field?: number; eventKey?: string; tournamentKey?: string; videoUrl?: string } };
type Entry = { url: string; start_timestamp: number; end_timestamp: number; matchId?: string; field?: number; match_number?: number; event_key?: string; tournament_key?: string };
type Row = { index: number; status: string; matchId?: string; matchName?: string; message?: string };
type Stream = { field: number; url: string; matchDuration: number; eventKey: string; tournamentKey: string; originUtc: string; clockRoi: number[]; identityRoi: number[] };
type StreamStatus = { field: number; status: string; error?: string; lastVideoTimestamp?: number };
type Configuration = { enabled: boolean; revision: number; streams: Stream[]; workerSeenAt?: string; workerError?: string; pendingCount: number; streamStatuses: StreamStatus[] };
const blankStream = (field: number): Stream => ({ field, url: "", matchDuration: 150, eventKey: "", tournamentKey: "", originUtc: "", clockRoi: [.447, .800, .108, .075], identityRoi: [.32, .958, .122, .037] });
const control = "control mt-1 w-full px-3 py-2 text-sm";

async function api(path: string, key: string, method = "GET", body?: unknown) {
  const response = await fetch(`${API_URL}/api/admin/${path}`, {
    method, cache: "no-store", headers: { "X-Admin-Key": key, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : null; } catch { throw new Error(`Video API returned ${response.status} without JSON.`); }
  if (!response.ok) throw new Error(payload?.error ?? `Video API returned ${response.status}.`);
  return payload;
}

function extractEntries(payload: unknown): Entry[] {
  if (!payload || typeof payload !== "object") throw new Error("Upload a JSON recording, array, matches.json or live detection export.");
  const object = payload as Record<string, unknown>;
  const source = Array.isArray(payload) ? payload : object.matches ?? object.detections ?? [payload];
  if (!Array.isArray(source) || source.length === 0 || source.length > 2000) throw new Error("Upload between 1 and 2,000 recordings.");
  return source.map((record, index) => {
    if (!record || typeof record !== "object") throw new Error(`Recording ${index + 1} is invalid.`);
    const item = record as Record<string, unknown>;
    if (typeof item.url !== "string" || typeof item.start_timestamp !== "number" || typeof item.end_timestamp !== "number" ||
        !Number.isFinite(item.start_timestamp) || !Number.isFinite(item.end_timestamp) || item.start_timestamp < 0 || item.end_timestamp <= item.start_timestamp) {
      throw new Error(`Recording ${index + 1} needs a URL, start_timestamp and end_timestamp in seconds. Upload completed recordings only.`);
    }
    const url = new URL(item.url);
    if (url.protocol !== "https:" || !["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"].includes(url.hostname) || url.username || url.password) throw new Error(`Recording ${index + 1} needs a public HTTPS YouTube URL.`);
    return { url: item.url, start_timestamp: item.start_timestamp, end_timestamp: item.end_timestamp,
      matchId: typeof item.matchId === "string" ? item.matchId : undefined,
      field: typeof item.field === "number" ? item.field : undefined,
      match_number: typeof item.match_number === "number" ? item.match_number : undefined,
      event_key: typeof item.event_key === "string" ? item.event_key : undefined,
      tournament_key: typeof item.tournament_key === "string" ? item.tournament_key : undefined };
  });
}

function stamp(value: number) {
  const seconds = Math.floor(value);
  return `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function StreamEditor({ stream, update, remove }: { stream: Stream; update: (changes: Partial<Stream>) => void; remove: () => void }) {
  const [clock, setClock] = useState(stream.clockRoi.join(", "));
  const [identity, setIdentity] = useState(stream.identityRoi.join(", "));
  function crop(value: string, key: "clockRoi" | "identityRoi") {
    const values = value.split(",").map((part) => part.trim() ? Number(part) : NaN);
    update({ [key]: values });
  }
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-4">
      <div className="grid items-end gap-3 sm:grid-cols-[80px_1fr_40px]">
        <label className="text-sm text-gray-400">Field<input type="number" min={1} max={100} value={stream.field} onChange={(e) => update({ field: Number(e.target.value) })} className={control} /></label>
        <label className="text-sm text-gray-400">YouTube live URL<input type="url" required value={stream.url} onChange={(e) => update({ url: e.target.value })} placeholder="https://www.youtube.com/watch?v=…" className={control} /></label>
        <button type="button" onClick={remove} className="rounded-xl p-2 text-red-400 hover:bg-red-950" aria-label={`Remove field ${stream.field}`}><Trash2 className="h-5 w-5" /></button>
      </div>
      <details className="mt-3 text-sm text-gray-400">
        <summary className="cursor-pointer">Broadcast settings</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label>Match duration (seconds)<input type="number" min={30} max={600} value={stream.matchDuration} onChange={(e) => update({ matchDuration: Number(e.target.value) })} className={control} /></label>
          <label>Stream origin (UTC, optional)<input value={stream.originUtc ?? ""} onChange={(e) => update({ originUtc: e.target.value })} placeholder="2026-10-07T00:00:00Z" className={control} /><span className="mt-1 block text-xs">Leave empty to use YouTube&apos;s broadcast start. Verify it against the player.</span></label>
          <label>Event key (optional)<input value={stream.eventKey ?? ""} onChange={(e) => update({ eventKey: e.target.value })} className={control} /></label>
          <label>Tournament key (optional)<input value={stream.tournamentKey ?? ""} onChange={(e) => update({ tournamentKey: e.target.value })} className={control} /></label>
          <label>Clock crop: x, y, width, height<input value={clock} onChange={(e) => { setClock(e.target.value); crop(e.target.value, "clockRoi"); }} className={control} /></label>
          <label>Match/field crop: x, y, width, height<input value={identity} onChange={(e) => { setIdentity(e.target.value); crop(e.target.value, "identityRoi"); }} className={control} /></label>
        </div>
        <p className="mt-2 text-xs">Crop values are fractions of the image between 0 and 1. Defaults match the 2025 broadcast. Check the 2026 layout before enabling watching.</p>
      </details>
    </div>
  );
}

export default function VideoAdministration({ adminKey, seasons }: { adminKey: string; seasons: Season[] }) {
  const [mode, setMode] = useState<"archive" | "live">("archive");
  const [chosenYear, setChosenYear] = useState<number>(0);
  const year = seasons.some((season) => season.year === chosenYear) ? chosenYear : seasons[0]?.year ?? 0;
  const [matches, setMatches] = useState<Match[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [reviewed, setReviewed] = useState(false);
  const [fileName, setFileName] = useState("");
  const [page, setPage] = useState(0);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [configuration, setConfiguration] = useState<Configuration | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [editVersion, setEditVersion] = useState(0);

  useEffect(() => {
    if (!year) return;
    let active = true;
    setLoaded(false); setEntries([]); setRows([]); setReviewed(false); setFileName(""); setPage(0); setNotice(null); setConfiguration(null);
    async function load() {
      try {
        const [config, response] = await Promise.all([
          api(`seasons/${year}/live-video`, adminKey),
          fetch(`${API_URL}/api/GameData/${year}`, { cache: "no-store" }),
        ]);
        if (!response.ok) throw new Error("Could not load matches for this season.");
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error("Invalid match list.");
        if (!active) return;
        setMatches(data); setConfiguration(config); setEnabled(config.enabled);
        setStreams(config.streams.length ? config.streams : [blankStream(1)]); setEditVersion((value) => value + 1); setLoaded(true);
      } catch (error) {
        if (active) setNotice({ error: true, text: error instanceof Error ? error.message : "Could not load video settings." });
      }
    }
    void load();
    return () => { active = false; };
  }, [year, adminKey]);

  useEffect(() => {
    if (!year || mode !== "live") return;
    let active = true;
    const timer = window.setInterval(async () => {
      setNow(Date.now());
      try {
        const config = await api(`seasons/${year}/live-video`, adminKey);
        if (active) setConfiguration(config);
      } catch { if (active) setNow(Date.now()); }
    }, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [year, adminKey, mode]);

  const preview = async (input: Entry[]) => {
    const result = await api(`seasons/${year}/videos/import`, adminKey, "POST", { entries: input, dryRun: true });
    setRows(result.rows); setReviewed(true);
    setEntries(input.map((entry, index) => ({ ...entry, matchId: result.rows[index]?.matchId ?? entry.matchId })));
    setNotice({ error: false, text: `${result.ready} recordings ready. Unassigned recordings and conflicts will be skipped.` });
  };
  const selectFile = async (file?: File) => {
    if (!file) return;
    setBusy(true); setRows([]); setEntries([]); setReviewed(false); setNotice(null); setPage(0);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("Choose a JSON file smaller than 5 MiB.");
      const input = extractEntries(JSON.parse(await file.text()));
      setFileName(file.name);
      await preview(input);
    } catch (error) { setNotice({ error: true, text: error instanceof Error ? error.message : "Invalid video file." }); }
    finally { setBusy(false); }
  };
  const importVideos = async () => {
    setBusy(true); setNotice(null);
    try {
      const result = await api(`seasons/${year}/videos/import`, adminKey, "POST", { entries, dryRun: false });
      setRows(result.rows); setReviewed(true);
      setNotice({ error: false, text: `${result.imported} recordings imported. ${result.rows.filter((row: Row) => row.status === "already_imported").length} were already saved. Remaining rows were skipped; see their status below. You can safely retry after a connection loss.` });
    } catch (error) { setReviewed(false); setNotice({ error: true, text: `${error instanceof Error ? error.message : "Import failed."} Preview again to see which recordings were saved before retrying.` }); }
    finally { setBusy(false); }
  };
  const saveLive = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setNotice(null);
    try {
      for (const stream of streams) {
        for (const roi of [stream.clockRoi, stream.identityRoi]) {
          if (roi.length !== 4 || !roi.every(Number.isFinite) || roi[0] < 0 || roi[1] < 0 || roi[2] <= 0 || roi[3] <= 0 || roi[0] + roi[2] > 1 || roi[1] + roi[3] > 1) throw new Error(`Field ${stream.field}: enter four crop fractions that fit inside the image.`);
        }
        if (stream.originUtc && (!/(Z|[+-]\d{2}:\d{2})$/.test(stream.originUtc) || !Number.isFinite(Date.parse(stream.originUtc)))) throw new Error(`Field ${stream.field}: the origin needs an ISO date with a timezone.`);
      }
      const config = await api(`seasons/${year}/live-video`, adminKey, "PUT", { enabled, streams: streams.map((stream) => ({ ...stream, originUtc: stream.originUtc || null, eventKey: stream.eventKey || null, tournamentKey: stream.tournamentKey || null })) });
      setConfiguration(config); setNow(Date.now());
      setNotice({ error: false, text: enabled ? "Live settings saved. The worker will start watching after it picks up this configuration." : "Watching paused. Saved detections remain queued for attachment." });
    } catch (error) { setNotice({ error: true, text: error instanceof Error ? error.message : "Could not save live settings." }); }
    finally { setBusy(false); }
  };
  const workerOnline = configuration?.workerSeenAt && now - Date.parse(configuration.workerSeenAt) < 90000;
  const ready = rows.filter((row) => row.status === "ready").length;

  return (
    <section className="mt-6 rounded-3xl border border-gray-800 bg-gray-900 p-6" aria-label="Match videos">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="text-xl font-semibold">Match videos</h2><p className="mt-1 text-sm text-gray-400">Import recordings for past seasons or watch field streams during an event.</p></div>
        <label className="text-sm text-gray-400">Season<select aria-label="Video season" value={year} disabled={busy || seasons.length === 0} onChange={(event) => setChosenYear(Number(event.target.value))} className={control}>{!seasons.length && <option value={0}>Add a season first</option>}{seasons.map((season) => <option key={season.year} value={season.year}>{season.name || season.year}</option>)}</select></label>
      </div>
      <div className="mt-5 flex gap-2" role="tablist" aria-label="Video source">
        <button role="tab" aria-selected={mode === "archive"} disabled={busy} onClick={() => { setMode("archive"); setNotice(null); }} className={`rounded-xl px-4 py-3 text-sm ${mode === "archive" ? "bg-indigo-600 text-white" : "bg-gray-950 text-gray-400"}`}><FileJson className="mr-2 inline h-4 w-4" />Historical recordings</button>
        <button role="tab" aria-selected={mode === "live"} disabled={busy} onClick={() => { setMode("live"); setNotice(null); setNow(Date.now()); }} className={`rounded-xl px-4 py-3 text-sm ${mode === "live" ? "bg-emerald-700 text-white" : "bg-gray-950 text-gray-400"}`}><Radio className="mr-2 inline h-4 w-4" />Live streams</button>
      </div>
      {notice && <p role="status" className={`mt-4 rounded-xl p-3 text-sm ${notice.error ? "bg-red-950/40 text-red-200" : "bg-sky-950/50 text-sky-200"}`}>{notice.text}</p>}
      {!loaded && year > 0 && !notice?.error && <p className="mt-5 text-sm text-gray-400">Loading video settings…</p>}
      {mode === "archive" && (
        <div className="mt-5" role="tabpanel" aria-label="Historical recordings">
          <p className="text-sm leading-6 text-gray-400">Choose matches.json from the playlist script, a single match JSON or completed live detections. Match numbers are matched automatically within the selected season. Unreadable overlays need manual assignment. Existing recordings are protected.</p>
          <label className="mt-4 block rounded-2xl border border-dashed border-gray-700 bg-gray-950/50 p-5 text-sm">
            <span className="mb-3 block">{fileName || "Choose timestamp JSON"}</span><input aria-label="Timestamp JSON" type="file" accept=".json,application/json" disabled={!loaded || busy} onChange={(event) => { void selectFile(event.target.files?.[0]); event.target.value = ""; }} className="w-full text-gray-400" />
          </label>
          {entries.length > 0 && <>
            <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-gray-500"><tr><th className="p-2">Recording</th><th className="p-2">Assign to match</th><th className="p-2">Status</th></tr></thead><tbody>
              {entries.slice(page * 25, (page + 1) * 25).map((entry, position) => {
                const index = page * 25 + position;
                const row = rows[index];
                return <tr key={index} className="border-t border-gray-800"><td className="min-w-40 p-2"><a href={entry.url} target="_blank" rel="noopener noreferrer" className="text-sky-400">Recording {index + 1}</a><p className="mt-1 text-gray-500">{stamp(entry.start_timestamp)} – {stamp(entry.end_timestamp)}</p></td><td className="min-w-64 p-2"><select aria-label={`Match for recording ${index + 1}`} disabled={busy} value={entry.matchId ?? ""} onChange={(event) => { setEntries((current) => current.map((item, i) => i === index ? { ...item, matchId: event.target.value || undefined, field: undefined, match_number: undefined } : item)); setReviewed(false); setRows([]); }} className={control}><option value="">Unassigned — skip</option>{matches.map((match) => <option key={match.id} value={match.id}>{match.data.name || match.id} · field {match.data.field ?? "?"} · {match.data.eventKey ?? ""} · {match.data.tournamentKey ?? ""}{match.data.videoUrl ? " · has video" : ""}</option>)}</select></td><td className="max-w-xs p-2"><span className={row?.status === "ready" || row?.status === "imported" ? "text-emerald-300" : "text-gray-400"}>{reviewed || row?.status === "imported" ? row?.status.replaceAll("_", " ") : "Preview required"}</span><p className="mt-1 text-xs text-gray-500">{row?.message}</p></td></tr>;
              })}
            </tbody></table></div>
            {entries.length > 25 && <div className="mt-3 flex items-center gap-3 text-sm"><button disabled={page === 0 || busy} onClick={() => setPage((value) => value - 1)} className="disabled:opacity-40">Previous</button><span className="text-gray-500">Page {page + 1} / {Math.ceil(entries.length / 25)}</span><button disabled={(page + 1) * 25 >= entries.length || busy} onClick={() => setPage((value) => value + 1)} className="disabled:opacity-40">Next</button></div>}
            <div className="mt-4 flex flex-wrap gap-3"><button disabled={busy} onClick={async () => { setBusy(true); setReviewed(false); try { await preview(entries); } catch (error) { setNotice({ error: true, text: error instanceof Error ? error.message : "Preview failed." }); } finally { setBusy(false); } }} className="inline-flex items-center gap-2 rounded-xl border border-gray-700 px-4 py-2.5 disabled:opacity-40"><RefreshCw className="h-4 w-4" />Preview assignments</button><button disabled={busy || !reviewed || ready === 0} onClick={() => void importVideos()} className="rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold disabled:opacity-40">{busy ? "Working…" : `Import ${ready} recordings`}</button></div>
          </>}
        </div>
      )}
      {mode === "live" && <form onSubmit={saveLive} role="tabpanel" aria-label="Live streams" className="mt-5">
        <div className="rounded-2xl bg-gray-950/70 p-4 text-sm">
          <p className={workerOnline ? "text-emerald-300" : "text-amber-300"}>{workerOnline ? "Worker connected" : "Worker not connected — watching is not confirmed"}</p>
          <p className="mt-1 text-gray-400">Saved mode: {configuration?.enabled ? "watching enabled" : "paused"} · {configuration?.pendingCount ?? 0} recordings waiting for match data or review</p>
          {configuration?.workerSeenAt && <p className="mt-1 text-xs text-gray-500">Last worker update: {new Date(configuration.workerSeenAt).toLocaleString()}</p>}
          {configuration?.workerError && <p className="mt-2 text-amber-300">{configuration.workerError}</p>}
          {configuration?.streamStatuses.map((status) => <p key={status.field} className="mt-2 text-gray-400">Field {status.field}: {status.status}{status.lastVideoTimestamp != null ? ` · video ${stamp(status.lastVideoTimestamp)}` : ""}{status.error ? ` · ${status.error}` : ""}</p>)}
        </div>
        <p className="mt-4 text-sm leading-6 text-gray-400">The server worker observes each field independently. It saves detections and retries when API data arrives late. Start/end timestamps appear on the match automatically. The match number must be visible on the broadcast. Field information is optional for matching; ambiguous numbers stay queued.</p>
        <fieldset disabled={!loaded || busy} className="mt-4 space-y-3">{streams.map((stream, index) => <StreamEditor key={`${year}-${editVersion}-${index}`} stream={stream} update={(changes) => setStreams((current) => current.map((item, i) => index === i ? { ...item, ...changes } : item))} remove={() => { setStreams((current) => current.filter((_, i) => i !== index)); setEditVersion((value) => value + 1); }} />)}</fieldset>
        <button type="button" disabled={!loaded || busy || streams.length >= 20} onClick={() => setStreams((current) => [...current, blankStream(Math.max(0, ...current.map((stream) => stream.field)) + 1)])} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-gray-700 px-4 py-2 text-sm disabled:opacity-40"><Plus className="h-4 w-4" />Add field</button>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4"><label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={enabled} disabled={!loaded || busy} onChange={(event) => setEnabled(event.target.checked)} className="h-4 w-4 accent-emerald-500" />Enable live watching</label><button disabled={!loaded || busy || (enabled && streams.length === 0)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 font-semibold disabled:opacity-40"><Save className="h-4 w-4" />{busy ? "Saving…" : "Save live settings"}</button></div>
        <p className="mt-4 text-xs leading-5 text-gray-500">Settings and detections survive restarts when server volumes are retained. A power or network outage can leave a gap if segments expire before reconnection; the worker reports timeline errors instead of guessing. Pausing stops observation while saved detections continue to reconcile.</p>
      </form>}
    </section>
  );
}
