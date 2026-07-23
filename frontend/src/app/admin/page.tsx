"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Database, FileJson, RefreshCw, Trash2, UploadCloud, Youtube } from "lucide-react";

type SeasonSummary = {
  year: number;
  matchCount: number;
};

type SeasonFile = {
  matches?: unknown[];
};

type AdminMatch = {
  id: string;
  data?: {
    name?: string;
    videoUrl?: string;
  };
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

function getErrorMessage(payload: unknown) {
  if (payload && typeof payload === "object" && "error" in payload) {
    return String((payload as { error: unknown }).error);
  }
  return "The server could not process this request.";
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
  const [videoYear, setVideoYear] = useState<number | null>(null);
  const [videoMatches, setVideoMatches] = useState<AdminMatch[]>([]);
  const [videoMatchId, setVideoMatchId] = useState("");
  const [videoUrl, setVideoUrl] = useState("");

  const loadSeasons = useCallback(async () => {
    setLoadingSeasons(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/seasons`, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load seasons.");
      setSeasons((await response.json()) as SeasonSummary[]);
    } catch (error) {
      setNotice({ kind: "error", message: error instanceof Error ? error.message : "Could not load seasons." });
    } finally {
      setLoadingSeasons(false);
    }
  }, []);

  useEffect(() => {
    loadSeasons();
  }, [loadSeasons]);

  useEffect(() => {
    if (videoYear === null && seasons.length > 0) setVideoYear(seasons[0].year);
  }, [seasons, videoYear]);

  useEffect(() => {
    if (videoYear === null) return;
    fetch(`${API_URL}/api/GameData/${videoYear}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : [])
      .then((matches: AdminMatch[]) => {
        setVideoMatches(matches);
        const first = matches[0];
        setVideoMatchId(first?.id ?? "");
        setVideoUrl(first?.data?.videoUrl ?? "");
      });
  }, [videoYear]);

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
          headers: { "Content-Type": "application/json" },
          body: fileText,
        },
      );
      const payload = (await response.json()) as {
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
      await loadSeasons();
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
      const response = await fetch(`${API_URL}/api/admin/seasons/${season.year}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(payload));
      setNotice({ kind: "success", message: `Season ${season.year} was deleted.` });
      await loadSeasons();
    } catch (error) {
      setNotice({ kind: "error", message: error instanceof Error ? error.message : "Delete failed." });
    } finally {
      setBusy(false);
    }
  };

  const selectVideoMatch = (id: string) => {
    setVideoMatchId(id);
    setVideoUrl(videoMatches.find((match) => match.id === id)?.data?.videoUrl ?? "");
  };

  const saveVideo = async () => {
    if (!videoMatchId) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`${API_URL}/api/admin/matches/${videoMatchId}/video`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: videoUrl.trim() || null }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(payload));
      setVideoMatches((current) => current.map((match) => match.id === videoMatchId ? { ...match, data: { ...match.data, videoUrl: videoUrl.trim() } } : match));
      setNotice({ kind: "success", message: videoUrl.trim() ? "YouTube video saved for this match." : "Match video removed." });
    } catch (error) {
      setNotice({ kind: "error", message: error instanceof Error ? error.message : "Could not save video." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-8 text-gray-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-indigo-400">Control center</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Season administration</h1>
          <p className="mt-3 max-w-2xl text-gray-400">
            A single JSON file represents one FIRST Global season. Importing with replacement keeps the season clean and prevents duplicate matches.
          </p>
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
              <button onClick={loadSeasons} disabled={loadingSeasons} className="rounded-xl border border-gray-700 p-2 text-gray-300 hover:bg-gray-800" aria-label="Refresh seasons"><RefreshCw className={`h-5 w-5 ${loadingSeasons ? "animate-spin" : ""}`} /></button>
            </div>

            <div className="mt-6 space-y-3">
              {!loadingSeasons && seasons.length === 0 && <p className="rounded-2xl bg-gray-950 p-5 text-sm text-gray-400">No seasons loaded yet.</p>}
              {seasons.map((season) => (
                <div key={season.year} className="flex items-center justify-between rounded-2xl border border-gray-800 bg-gray-950/70 p-4">
                  <div><p className="text-lg font-semibold">Season {season.year}</p><p className="text-sm text-gray-500">{season.matchCount} matches</p></div>
                  <button onClick={() => deleteSeason(season)} disabled={busy} className="rounded-xl border border-red-900 p-2 text-red-400 transition hover:bg-red-950 disabled:opacity-40" aria-label={`Delete season ${season.year}`}><Trash2 className="h-5 w-5" /></button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section id="match-videos" className="mt-6 scroll-mt-6 rounded-3xl border border-gray-800 bg-gray-900 p-6 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-red-500/15 p-3 text-red-400"><Youtube /></div>
            <div><h2 className="text-xl font-semibold">Match videos</h2><p className="text-sm text-gray-400">Assign or remove a YouTube recording for an individual match.</p></div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-[12rem_1fr]">
            <label className="text-sm text-gray-400">Season
              <select value={videoYear ?? ""} onChange={(event) => setVideoYear(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white">
                {seasons.map((season) => <option key={season.year} value={season.year}>{season.year}</option>)}
              </select>
            </label>
            <label className="text-sm text-gray-400">Match
              <select value={videoMatchId} onChange={(event) => selectVideoMatch(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white">
                {videoMatches.map((match) => <option key={match.id} value={match.id}>{match.data?.name ?? match.id}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-col gap-3 md:flex-row">
            <input value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=…" className="min-w-0 flex-1 rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none focus:border-red-600" />
            <button onClick={saveVideo} disabled={!videoMatchId || busy} className="rounded-xl bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-500 disabled:opacity-40">{busy ? "Saving…" : "Save video"}</button>
          </div>
          <p className="mt-3 text-xs text-gray-500">Leave the URL empty and save to remove the current video.</p>
        </section>
      </div>
    </main>
  );
}
