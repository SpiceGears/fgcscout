"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Database, Download, FileJson, KeyRound, LogOut, Play, RefreshCw, Save, Settings2, Trash2, UploadCloud } from "lucide-react";

import VideoAdministration from "@/components/admin/VideoAdministration";

type SeasonSummary = {
  year: number;
  name: string;
  matchCount: number;
  sourceUrl: string;
  syncEnabled: boolean;
  syncIntervalMinutes: number;
  lastSyncAt?: string;
  lastSyncError?: string;
  lastSyncMatchCount?: number;
};

type SeasonFile = {
  matches?: unknown[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

function getErrorMessage(payload: unknown) {
  if (payload && typeof payload === "object" && "error" in payload) {
    return String((payload as { error: unknown }).error);
  }
  return "The server could not process this request.";
}

async function readApiJson(response: Response): Promise<unknown> {
  const body = await response.text();
  if (!body.trim()) return null;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    const contentType = response.headers.get("content-type") ?? "unknown content type";
    throw new Error(
      `API returned ${response.status} ${response.statusText || "response"} as ${contentType}, not JSON. Check that /api routes are connected to the backend.`,
    );
  }
}

export default function AdminPage() {
  const [file, setFile] = useState<File | null>(null);
  const [fileText, setFileText] = useState("");
  const [matchCount, setMatchCount] = useState(0);
  const [detectedYear, setDetectedYear] = useState<number | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
  const [loadingSeasons, setLoadingSeasons] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [adminKey, setAdminKey] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [configYear, setConfigYear] = useState(new Date().getFullYear());
  const [configName, setConfigName] = useState(`FIRST Global Challenge ${new Date().getFullYear()}`);
  const [configSourceUrl, setConfigSourceUrl] = useState("https://api.first.global/v1");
  const [configSyncEnabled, setConfigSyncEnabled] = useState(false);
  const [configInterval, setConfigInterval] = useState(5);

  const loadSeasons = useCallback(async (credential: string) => {
    setLoadingSeasons(true);
    setCheckingAccess(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/seasons`, {
        cache: "no-store",
        headers: { "X-Admin-Key": credential },
      });
      const payload = await readApiJson(response);
      if (!response.ok) {
        if (response.status === 401) sessionStorage.removeItem("fgcscout.adminKey");
        throw new Error(getErrorMessage(payload));
      }
      if (!Array.isArray(payload)) throw new Error("The seasons API returned an invalid response.");
      setSeasons(payload as SeasonSummary[]);
      setAuthorized(true);
      setAdminKey(credential);
      sessionStorage.setItem("fgcscout.adminKey", credential);
      setNotice(null);
      return true;
    } catch (error) {
      setAuthorized(false);
      setNotice({ kind: "error", message: error instanceof Error ? error.message : "Could not load seasons." });
      return false;
    } finally {
      setLoadingSeasons(false);
      setCheckingAccess(false);
    }
  }, []);

  useEffect(() => {
    const storedKey = sessionStorage.getItem("fgcscout.adminKey") ?? "";
    setKeyInput(storedKey);
    if (storedKey) void loadSeasons(storedKey);
    else {
      setLoadingSeasons(false);
      setCheckingAccess(false);
    }
  }, [loadSeasons]);

  const unlockAdmin = async (event: React.FormEvent) => {
    event.preventDefault();
    const credential = keyInput.trim();
    if (credential) await loadSeasons(credential);
  };

  const lockAdmin = () => {
    sessionStorage.removeItem("fgcscout.adminKey");
    setAdminKey("");
    setKeyInput("");
    setAuthorized(false);
    setSeasons([]);
    setNotice(null);
  };

  const existingSeason = useMemo(
    () => seasons.find((season) => season.year === detectedYear),
    [detectedYear, seasons],
  );

  const selectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setFileText("");
    setMatchCount(0);
    setDetectedYear(null);
    setNotice(null);
    if (!selected) return;

    try {
      const text = await selected.text();
      const json = JSON.parse(text) as SeasonFile | unknown[];
      const matches = Array.isArray(json) ? json : json.matches;
      if (!Array.isArray(matches) || matches.length === 0) {
        throw new Error("JSON must contain a non-empty matches array.");
      }

      const years = new Set<number>();
      for (const match of matches) {
        if (!match || typeof match !== "object") continue;
        const eventKey = String((match as { eventKey?: unknown }).eventKey ?? "");
        const value = eventKey.match(/\d{4}/)?.[0];
        if (value) years.add(Number(value));
      }
      if (years.size !== 1) {
        throw new Error("The file must contain matches from exactly one season.");
      }

      setFileText(text);
      setMatchCount(matches.length);
      setDetectedYear([...years][0]);
    } catch (error) {
      setFile(null);
      event.target.value = "";
      setNotice({
        kind: "error",
        message: error instanceof Error ? error.message : "Invalid JSON file.",
      });
    }
  };

  const importSeason = async () => {
    if (!file || !fileText || detectedYear === null) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(
        `${API_URL}/api/admin/importSeason?replaceExisting=${replaceExisting}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Admin-Key": adminKey },
          body: fileText,
        },
      );
      const payload = (await readApiJson(response)) as {
        error?: string;
        playedMatches?: number;
        upsertedTeams?: number;
        replacedMatches?: number;
        year?: number;
      };
      if (!response.ok) throw new Error(getErrorMessage(payload));
      setNotice({
        kind: "success",
        message: `Season ${payload.year} loaded: ${payload.playedMatches} matches and ${payload.upsertedTeams} teams${payload.replacedMatches ? ` (replaced ${payload.replacedMatches} matches)` : ""}.`,
      });
      await loadSeasons(adminKey);
    } catch (error) {
      setNotice({ kind: "error", message: error instanceof Error ? error.message : "Import failed." });
    } finally {
      setBusy(false);
    }
  };

  const deleteSeason = async (season: SeasonSummary) => {
    if (!window.confirm(`Delete season ${season.year} and all ${season.matchCount} matches?`)) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`${API_URL}/api/admin/seasons/${season.year}`, {
        method: "DELETE",
        headers: { "X-Admin-Key": adminKey },
      });
      const payload = await readApiJson(response);
      if (!response.ok) throw new Error(getErrorMessage(payload));
      setNotice({ kind: "success", message: `Season ${season.year} was deleted.` });
      await loadSeasons(adminKey);
    } catch (error) {
      setNotice({ kind: "error", message: error instanceof Error ? error.message : "Delete failed." });
    } finally {
      setBusy(false);
    }
  };

  const exportSeason = async (season: SeasonSummary) => {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`${API_URL}/api/admin/seasons/${season.year}/export`, {
        cache: "no-store",
        headers: { "X-Admin-Key": adminKey },
      });
      if (!response.ok) {
        const payload = await readApiJson(response);
        throw new Error(getErrorMessage(payload));
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `fgcscout-season-${season.year}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setNotice({ kind: "success", message: `Season ${season.year} exported as JSON.` });
    } catch (error) {
      setNotice({ kind: "error", message: error instanceof Error ? error.message : "Export failed." });
    } finally {
      setBusy(false);
    }
  };

  const editSeason = (season: SeasonSummary) => {
    setConfigYear(season.year);
    setConfigName(season.name || `FIRST Global Challenge ${season.year}`);
    setConfigSourceUrl(season.sourceUrl || "https://api.first.global/v1");
    setConfigSyncEnabled(season.syncEnabled);
    setConfigInterval(season.syncIntervalMinutes || 5);
    document.getElementById("season-sync-settings")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const saveSeasonConfiguration = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`${API_URL}/api/admin/seasons/${configYear}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Admin-Key": adminKey },
        body: JSON.stringify({
          name: configName,
          sourceUrl: configSourceUrl,
          syncEnabled: configSyncEnabled,
          syncIntervalMinutes: configInterval,
        }),
      });
      const payload = await readApiJson(response);
      if (!response.ok) throw new Error(getErrorMessage(payload));
      setNotice({ kind: "success", message: `Season ${configYear} synchronization settings saved.` });
      await loadSeasons(adminKey);
    } catch (error) {
      setNotice({ kind: "error", message: error instanceof Error ? error.message : "Could not save season settings." });
    } finally {
      setBusy(false);
    }
  };

  const syncSeason = async (season: SeasonSummary) => {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`${API_URL}/api/admin/seasons/${season.year}/sync`, {
        method: "POST",
        headers: { "X-Admin-Key": adminKey },
      });
      const payload = await readApiJson(response) as { error?: string; matches?: number; insertedMatches?: number; updatedMatches?: number };
      if (!response.ok) throw new Error(getErrorMessage(payload));
      setNotice({ kind: "success", message: `Season ${season.year} synced: ${payload.matches ?? 0} matches (${payload.insertedMatches ?? 0} new, ${payload.updatedMatches ?? 0} updated).` });
      await loadSeasons(adminKey);
    } catch (error) {
      setNotice({ kind: "error", message: error instanceof Error ? error.message : "Synchronization failed." });
    } finally {
      setBusy(false);
    }
  };

  if (!authorized) {
    return (
      <main className="page-shell flex items-center justify-center">
        <form onSubmit={unlockAdmin} className="panel w-full max-w-md p-6">
          <KeyRound className="h-6 w-6 text-sky-400" />
          <h1 className="mt-5 text-2xl font-semibold text-white">Administrator access</h1>
          <p className="mt-2 text-sm leading-6 text-gray-400">Enter the server-side admin key. It is stored only until this browser tab is closed.</p>
          <label className="mt-6 block text-sm text-gray-400">Admin key
            <input type="password" value={keyInput} onChange={(event) => setKeyInput(event.target.value)} autoComplete="current-password" className="control mt-2 w-full px-4 py-3" autoFocus />
          </label>
          {notice && <p className="mt-3 text-sm text-red-300">{notice.message}</p>}
          <button disabled={!keyInput.trim() || checkingAccess} className="mt-5 w-full rounded-xl bg-sky-600 px-5 py-3 font-semibold text-white hover:bg-sky-500 disabled:opacity-40">
            {checkingAccess ? "Checking…" : "Unlock admin"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-8 text-gray-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-start justify-between gap-5">
          <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-indigo-400">Control center</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Season administration</h1>
          <p className="mt-3 max-w-2xl text-gray-400">
            A single JSON file represents one FIRST Global season. Importing with replacement keeps the season clean and prevents duplicate matches.
          </p>
          </div>
          <button onClick={lockAdmin} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-gray-700 px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white"><LogOut className="h-4 w-4" />Lock</button>
        </div>

        {notice && (
          <div className={`mb-6 rounded-2xl border p-4 ${notice.kind === "success" ? "border-emerald-700 bg-emerald-950/40 text-emerald-200" : "border-red-800 bg-red-950/40 text-red-200"}`}>
            {notice.message}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-3xl border border-gray-800 bg-gray-900 p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-indigo-500/15 p-3 text-indigo-300"><UploadCloud /></div>
              <div>
                <h2 className="text-xl font-semibold">Import season JSON</h2>
                <p className="text-sm text-gray-400">Matches and participant teams are loaded together.</p>
              </div>
            </div>

            <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-gray-700 bg-gray-950/60 px-6 py-10 text-center transition hover:border-indigo-500 hover:bg-indigo-950/20">
              <FileJson className="h-9 w-9 text-indigo-300" />
              <span className="mt-3 font-medium">{file?.name ?? "Choose data.json"}</span>
              <span className="mt-1 text-sm text-gray-500">JSON object with matches, or a matches array</span>
              <input type="file" accept=".json,application/json" onChange={selectFile} className="sr-only" />
            </label>

            {detectedYear !== null && (
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-gray-950 p-4"><p className="text-xs uppercase tracking-wider text-gray-500">Season</p><p className="mt-1 text-2xl font-bold">{detectedYear}</p></div>
                <div className="rounded-2xl bg-gray-950 p-4"><p className="text-xs uppercase tracking-wider text-gray-500">Matches</p><p className="mt-1 text-2xl font-bold">{matchCount}</p></div>
                <div className="rounded-2xl bg-gray-950 p-4"><p className="text-xs uppercase tracking-wider text-gray-500">Current data</p><p className="mt-1 text-2xl font-bold">{existingSeason?.matchCount ?? 0}</p></div>
              </div>
            )}

            <label className="mt-5 flex items-start gap-3 rounded-2xl border border-gray-800 bg-gray-950/50 p-4">
              <input type="checkbox" checked={replaceExisting} onChange={(event) => setReplaceExisting(event.target.checked)} className="mt-1 h-4 w-4 accent-indigo-500" />
              <span>
                <span className="block font-medium">Replace the existing season</span>
                <span className="text-sm text-gray-500">Recommended when each JSON file is the complete source of truth for a season.</span>
              </span>
            </label>

            <button type="button" onClick={importSeason} disabled={!fileText || busy} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40">
              {busy ? <RefreshCw className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
              {busy ? "Working…" : "Import season"}
            </button>
          </section>

          <section className="rounded-3xl border border-gray-800 bg-gray-900 p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-sky-500/15 p-3 text-sky-300"><Database /></div>
                <div><h2 className="text-xl font-semibold">Stored seasons</h2><p className="text-sm text-gray-400">{seasons.length} available</p></div>
              </div>
              <button onClick={() => loadSeasons(adminKey)} disabled={loadingSeasons} className="rounded-xl border border-gray-700 p-2 text-gray-300 hover:bg-gray-800" aria-label="Refresh seasons"><RefreshCw className={`h-5 w-5 ${loadingSeasons ? "animate-spin" : ""}`} /></button>
            </div>

            <div className="mt-6 space-y-3">
              {!loadingSeasons && seasons.length === 0 && <p className="rounded-2xl bg-gray-950 p-5 text-sm text-gray-400">No seasons loaded yet.</p>}
              {seasons.map((season) => (
                <div key={season.year} className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="text-lg font-semibold">{season.name || `Season ${season.year}`}</p><p className="text-sm text-gray-500">{season.matchCount} matches · {season.syncEnabled ? `live every ${season.syncIntervalMinutes} min` : "manual updates"}</p></div>
                    <div className="flex gap-2">
                      <button onClick={() => exportSeason(season)} disabled={busy || season.matchCount === 0} className="rounded-xl border border-sky-900 p-2 text-sky-400 transition hover:bg-sky-950 disabled:opacity-40" aria-label={`Export season ${season.year} as JSON`} title="Export season JSON"><Download className="h-4 w-4" /></button>
                      <button onClick={() => syncSeason(season)} disabled={busy} className="rounded-xl border border-emerald-900 p-2 text-emerald-400 transition hover:bg-emerald-950 disabled:opacity-40" aria-label={`Sync season ${season.year}`}><Play className="h-4 w-4" /></button>
                      <button onClick={() => editSeason(season)} disabled={busy} className="rounded-xl border border-gray-700 p-2 text-gray-300 transition hover:bg-gray-800 disabled:opacity-40" aria-label={`Configure season ${season.year}`}><Settings2 className="h-4 w-4" /></button>
                      <button onClick={() => deleteSeason(season)} disabled={busy} className="rounded-xl border border-red-900 p-2 text-red-400 transition hover:bg-red-950 disabled:opacity-40" aria-label={`Delete season ${season.year}`}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                  {season.lastSyncAt && <p className={`mt-3 text-xs ${season.lastSyncError ? "text-red-400" : "text-gray-600"}`}>{season.lastSyncError ? `Last sync failed: ${season.lastSyncError}` : `Last sync: ${new Date(season.lastSyncAt).toLocaleString()} · ${season.lastSyncMatchCount ?? season.matchCount} source matches`}</p>}
                </div>
              ))}
            </div>
          </section>
        </div>

        <form id="season-sync-settings" onSubmit={saveSeasonConfiguration} className="mt-6 rounded-3xl border border-gray-800 bg-gray-900 p-6 shadow-xl scroll-mt-20">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-300"><RefreshCw /></div>
            <div><h2 className="text-xl font-semibold">Live season synchronization</h2><p className="text-sm text-gray-400">Create a season before the event and keep it updated from the official results page.</p></div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-[9rem_minmax(0,1fr)_9rem]">
            <label className="text-sm text-gray-400">Year
              <input type="number" min="2017" max="2100" value={configYear} onChange={(event) => { const year = Number(event.target.value); setConfigYear(year); setConfigName((current) => /^FIRST Global Challenge \d{4}$/.test(current) ? `FIRST Global Challenge ${year}` : current); }} className="control mt-2 w-full px-3 py-2.5" />
            </label>
            <label className="text-sm text-gray-400">Season name
              <input value={configName} onChange={(event) => setConfigName(event.target.value)} className="control mt-2 w-full px-3 py-2.5" />
            </label>
            <label className="text-sm text-gray-400">Interval (minutes)
              <input type="number" min="1" max="1440" value={configInterval} onChange={(event) => setConfigInterval(Number(event.target.value))} className="control mt-2 w-full px-3 py-2.5" />
            </label>
          </div>

          <label className="mt-4 block text-sm text-gray-400">Results source
            <input type="url" value={configSourceUrl} onChange={(event) => setConfigSourceUrl(event.target.value)} placeholder="https://api.first.global/v1" className="control mt-2 w-full px-3 py-2.5" />
            <span className="mt-1 block text-xs text-gray-500">Current official JSON feed: https://api.first.global/v1</span>
          </label>

          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-3 text-sm text-gray-300">
              <input type="checkbox" checked={configSyncEnabled} onChange={(event) => setConfigSyncEnabled(event.target.checked)} className="h-4 w-4 accent-emerald-500" />
              Refresh automatically during the event
            </label>
            <button disabled={busy || !configYear || !configSourceUrl.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-40"><Save className="h-4 w-4" />Save season</button>
          </div>
        </form>

        <VideoAdministration adminKey={adminKey} seasons={seasons} />
      </div>
    </main>
  );
}
