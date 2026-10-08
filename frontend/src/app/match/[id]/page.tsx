"use client";

import { rememberSeason } from "@/lib/seasonData";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarClock, Check, ExternalLink, Link2, MapPin, Pencil, Play, X, Youtube } from "lucide-react";
import { formatTeamName, formatTeamSlug } from "@/lib/country";
import FieldVisualization from "@/components/match/FieldVisualization";
import WildfireMatchDetails, { WildfireOverview } from "@/components/match/WildfireMatchDetails";
import GenericMatchDetails from "@/components/match/GenericMatchDetails";

type Participant = {
  station?: number;
  teamKey?: number | string;
  id?: number | string;
  country?: string;
  countryCode?: string;
  disqualified?: number | boolean;
  noShow?: number | boolean;
  surrogate?: number | boolean;
};

type MatchDatum = {
  id: string;
  year?: number;
  data?: {
    id?: number | string;
    name?: string;
    eventKey?: string;
    tournamentKey?: string;
    scheduledTime?: string;
    videoUrl?: string;
    videoStartTimestamp?: number;
    videoEndTimestamp?: number;
    videoStatus?: string;
    field?: number;
    played?: boolean;
    redScore?: number;
    blueScore?: number;
    redMinPen?: number;
    redMajPen?: number;
    blueMinPen?: number;
    blueMajPen?: number;
    participants?: Participant[];
    details?: Record<string, unknown>;
  };
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

function alliance(station?: number) {
  if (station && station >= 11 && station <= 13) return "red";
  if (station && station >= 21 && station <= 23) return "blue";
  return null;
}

function detailNumber(details: Record<string, unknown> | undefined, key: string) {
  const value = details?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function protectionLevel(value: number) {
  const levels = new Map([[0, "Field surface"], [0.125, "Level 1"], [0.25, "Level 2"], [0.375, "Level 3"], [0.5, "Level 4"]]);
  return `${levels.get(value) ?? "Recorded"} (+${formatNumber(value)})`;
}

function formatDate(dateString?: string) {
  if (!dateString) return "Schedule unavailable";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Schedule unavailable";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function toYouTubeEmbed(url?: string, startTimestamp?: number, endTimestamp?: number) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    let videoId = "";
    if (parsed.hostname === "youtu.be" || parsed.hostname === "www.youtu.be") videoId = parsed.pathname.slice(1);
    else if (parsed.pathname.startsWith("/shorts/") || parsed.pathname.startsWith("/embed/") || parsed.pathname.startsWith("/live/")) videoId = parsed.pathname.split("/")[2] ?? "";
    else videoId = parsed.searchParams.get("v") ?? "";
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
    const embed = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
    const rawStart = parsed.searchParams.get("start") ?? parsed.searchParams.get("t") ?? "";
    const timeParts = rawStart.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    const parsedStart = /^\d+$/.test(rawStart) ? Number(rawStart) : timeParts
      ? Number(timeParts[1] ?? 0) * 3600 + Number(timeParts[2] ?? 0) * 60 + Number(timeParts[3] ?? 0) : 0;
    const start = startTimestamp ?? parsedStart;
    const end = endTimestamp ?? Number(parsed.searchParams.get("end") ?? 0);
    if (Number.isFinite(start) && start >= 0) embed.searchParams.set("start", String(Math.floor(start)));
    if (Number.isFinite(end) && end > start) embed.searchParams.set("end", String(Math.ceil(end)));
    return embed.toString();
  } catch {
    return null;
  }
}

function TeamLink({ team }: { team: Participant }) {
  const teamId = String(team.teamKey ?? team.id ?? "");
  const slug = formatTeamSlug(team.country, team.countryCode, teamId);
  return (
    <Link href={`/team/${slug}`} className="block px-3 py-3 font-semibold text-gray-100 transition hover:text-sky-300 hover:underline">
      {formatTeamName(team.country, team.countryCode)}
      {Boolean(team.disqualified || team.noShow || team.surrogate) && (
        <span className="ml-2 text-xs font-bold text-amber-300">
          {team.disqualified ? "DQ" : team.noShow ? "NO SHOW" : "SURROGATE"}
        </span>
      )}
    </Link>
  );
}

export default function MatchPage() {
  const params = useParams();
  const rawId = params?.id;
  const matchId = Array.isArray(rawId) ? rawId[0] : rawId;
  const [match, setMatch] = useState<MatchDatum | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingVideo, setEditingVideo] = useState(false);
  const [videoUrlInput, setVideoUrlInput] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [hasStoredAdminKey, setHasStoredAdminKey] = useState(false);
  const [videoSaving, setVideoSaving] = useState(false);
  const [videoNotice, setVideoNotice] = useState("");
  const [videoEnabled, setVideoEnabled] = useState(false);

  useEffect(() => {
    const storedKey = sessionStorage.getItem("fgcscout.adminKey") ?? "";
    if (!storedKey) return;

    async function verifyAdminKey() {
      try {
        const response = await fetch(`${API_URL}/api/admin/seasons`, {
          cache: "no-store",
          headers: { "X-Admin-Key": storedKey },
        });
        if (!response.ok) throw new Error("Stored admin key is no longer valid.");
        setAdminKey(storedKey);
        setHasStoredAdminKey(true);
      } catch {
        sessionStorage.removeItem("fgcscout.adminKey");
        setAdminKey("");
        setHasStoredAdminKey(false);
      }
    }

    void verifyAdminKey();
  }, []);

  useEffect(() => {
    if (!matchId) return;
    let active = true;
    async function loadMatch(initial: boolean) {
      if (initial) setLoading(true);
      try {
        const response = await fetch(`${API_URL}/api/GameData/match/${matchId}`, { cache: "no-store" });
        if (!response.ok) throw new Error(response.status === 404 ? "Match not found." : "Could not load match.");
        const loadedMatch = (await response.json()) as MatchDatum;
        if (!active) return;
        setMatch(loadedMatch);
        if (loadedMatch.year) rememberSeason(loadedMatch.year);
        if (initial) {
          setVideoUrlInput(loadedMatch.data?.videoUrl ?? "");
          setVideoEnabled(false);
        }
        setError("");
      } catch (reason) {
        if (active && initial) setError(reason instanceof Error ? reason.message : "Could not load match.");
      } finally {
        if (active && initial) setLoading(false);
      }
    }
    void loadMatch(true);
    const timer = window.setInterval(() => void loadMatch(false), 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [matchId]);

  const saveVideo = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!matchId || !adminKey.trim()) {
      setVideoNotice("Enter the admin key.");
      return;
    }

    setVideoSaving(true);
    setVideoNotice("");
    try {
      const response = await fetch(`${API_URL}/api/admin/matches/${matchId}/video`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey.trim(),
        },
        body: JSON.stringify({ videoUrl: videoUrlInput.trim() || null }),
      });
      const payload = await response.json() as { error?: string; videoUrl?: string | null };
      if (!response.ok) {
        if (response.status === 401) {
          sessionStorage.removeItem("fgcscout.adminKey");
          setHasStoredAdminKey(false);
          setEditingVideo(false);
        }
        throw new Error(payload.error ?? "Could not save the video.");
      }

      sessionStorage.setItem("fgcscout.adminKey", adminKey.trim());
      setHasStoredAdminKey(true);
      setMatch((current) => current ? {
        ...current,
        data: { ...current.data, videoUrl: payload.videoUrl ?? undefined,
          videoStartTimestamp: undefined, videoEndTimestamp: undefined, videoStatus: undefined },
      } : current);
      setVideoEnabled(false);
      setEditingVideo(false);
      setVideoNotice(payload.videoUrl ? "Video saved." : "Video removed.");
    } catch (reason) {
      setVideoNotice(reason instanceof Error ? reason.message : "Could not save the video.");
    } finally {
      setVideoSaving(false);
    }
  };

  const details = match?.data?.details;
  const redTeams = match?.data?.participants?.filter((team) => alliance(team.station) === "red") ?? [];
  const blueTeams = match?.data?.participants?.filter((team) => alliance(team.station) === "blue") ?? [];

  if (loading) return <main className="page-shell"><div className="panel mx-auto h-96 max-w-6xl animate-pulse" /></main>;
  if (error || !match) return <main className="page-shell"><div className="mx-auto max-w-3xl rounded-xl border border-red-900 bg-red-950/30 p-8"><h1 className="text-2xl font-semibold">Unable to open match</h1><p className="mt-3 text-red-200">{error || "Match not found."}</p><Link href="/events" className="mt-6 inline-flex items-center gap-2 text-sky-400"><ArrowLeft className="h-4 w-4" />Back to event</Link></div></main>;

  const data = match.data ?? {};
  const title = data.name ?? `Match ${data.id ?? matchId}`;
  const eventName = data.eventKey ?? `FIRST Global Challenge ${match.year ?? ""}`;
  const redScore = data.redScore ?? 0;
  const blueScore = data.blueScore ?? 0;
  const played = data.played !== false;
  const isWildfire = match.year === 2026;
  const videoEmbed = toYouTubeEmbed(data.videoUrl, data.videoStartTimestamp, data.videoEndTimestamp);
  const videoWatch = videoEmbed ? (() => {
    const embed = new URL(videoEmbed);
    const watch = new URL("https://www.youtube.com/watch");
    watch.searchParams.set("v", embed.pathname.split("/")[2]);
    watch.searchParams.set("t", `${embed.searchParams.get("start") ?? "0"}s`);
    return watch.toString();
  })() : null;
  const barriersRed = detailNumber(details, "barriersInRedMitigator");
  const barriersBlue = detailNumber(details, "barriersInBlueMitigator");
  const barrierPoints = barriersRed + barriersBlue;
  const biodiversityRed = detailNumber(details, "biodiversityUnitsRedSideEcosystem");
  const biodiversityCenter = detailNumber(details, "biodiversityUnitsCenterEcosystem");
  const biodiversityBlue = detailNumber(details, "biodiversityUnitsBlueSideEcosystem");
  const biodiversityUnits = biodiversityRed + biodiversityCenter + biodiversityBlue;
  const distributionFactor = detailNumber(details, "biodiversityDistributionFactor");
  const biodiversityPoints = detailNumber(details, "biodiversityDistributed") || biodiversityUnits * distributionFactor;
  const sharedBasePoints = barrierPoints + biodiversityPoints;
  const coopertitionBonus = detailNumber(details, "coopertition");
  const redProtectionMultiplier = detailNumber(details, "redProtectionMultiplier") || 1;
  const blueProtectionMultiplier = detailNumber(details, "blueProtectionMultiplier") || 1;
  const redProtectedScore = sharedBasePoints * redProtectionMultiplier;
  const blueProtectedScore = sharedBasePoints * blueProtectionMultiplier;
  const redRobotProtection = [1, 2, 3].map((robot) => detailNumber(details, `redRobot${["", "One", "Two", "Three"][robot]}Parking`));
  const blueRobotProtection = [1, 2, 3].map((robot) => detailNumber(details, `blueRobot${["", "One", "Two", "Three"][robot]}Parking`));
  const isEcoEquilibrium = !isWildfire && Boolean(details && (
    "biodiversityUnitsCenterEcosystem" in details ||
    "barriersInRedMitigator" in details ||
    "redProtectionMultiplier" in details
  ));

  return (
    <main className="page-shell">
      <div className="page-container">
        <Link href="/events" className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-sky-300"><ArrowLeft className="h-4 w-4" />Back to event</Link>

        <header className="mt-5 border-b border-slate-800 pb-6">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">{title}</h1>
            <Link href="/events" className="text-lg font-medium text-sky-400 transition hover:text-sky-300">{eventName}</Link>
          </div>
          <div className="mt-3 flex flex-wrap gap-5 text-sm text-gray-500">
            <span className="flex items-center gap-2"><CalendarClock className="h-4 w-4" />{formatDate(data.scheduledTime)}</span>
            <span className={`rounded-full px-3 py-1 font-semibold ${played ? "bg-emerald-950/50 text-emerald-300" : "bg-amber-950/50 text-amber-300"}`}>{played ? "Played" : "Not played yet"}</span>
            <span className="flex items-center gap-2"><MapPin className="h-4 w-4" />Field {data.field ?? "—"}</span>
          </div>
        </header>


        {isWildfire && <WildfireOverview details={details} played={played} />}
        {isEcoEquilibrium && played && <FieldVisualization details={details} redTeams={redTeams} blueTeams={blueTeams} />}

        <div className="mt-7 grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(430px,0.95fr)]">
          <div>
            <div className="overflow-x-auto rounded-xl border border-gray-700 bg-gray-900">
              <table className="w-full min-w-[620px] table-fixed border-collapse text-center">
                <thead className="bg-gray-800 text-sm text-gray-200"><tr><th colSpan={3} className="border-r border-gray-700 px-3 py-2">Teams</th><th className="w-24 px-3 py-2">Score</th></tr></thead>
                <tbody>
                  <tr className="border-t border-gray-700 bg-red-950/55">
                    {redTeams.map((team) => <td key={`${team.station}-${team.teamKey}`} className="border-r border-red-900/60"><TeamLink team={team} /></td>)}
                    {Array.from({ length: Math.max(0, 3 - redTeams.length) }).map((_, index) => <td key={`red-empty-${index}`} className="border-r border-red-900/60" />)}
                    <td className="bg-red-900/45 px-3 py-3 text-2xl font-black text-red-300">{played ? redScore : "—"}</td>
                  </tr>
                  <tr className="border-t border-gray-700 bg-blue-950/55">
                    {blueTeams.map((team) => <td key={`${team.station}-${team.teamKey}`} className="border-r border-blue-900/60"><TeamLink team={team} /></td>)}
                    {Array.from({ length: Math.max(0, 3 - blueTeams.length) }).map((_, index) => <td key={`blue-empty-${index}`} className="border-r border-blue-900/60" />)}
                    <td className="bg-blue-900/45 px-3 py-3 text-2xl font-black text-blue-300">{played ? blueScore : "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {isWildfire ? <WildfireMatchDetails details={details} played={played} redScore={data.redScore} blueScore={data.blueScore} redMinPen={data.redMinPen} redMajPen={data.redMajPen} blueMinPen={data.blueMinPen} blueMajPen={data.blueMajPen} /> : !played ? <p className="mt-7 rounded-xl border border-amber-900/50 bg-amber-950/20 p-5 text-amber-200">Not played yet. Results will appear after the official API update.</p> : isEcoEquilibrium ? <><h2 className="mt-7 text-2xl font-semibold">Detailed Results</h2>
            <div className="mt-3 overflow-hidden rounded-xl border border-gray-700 bg-gray-900">
              <div className="border-b border-gray-700 bg-emerald-950/45 px-5 py-3 text-center font-bold text-emerald-300">Global Alliance scoring</div>
              <table className="w-full border-collapse text-sm">
                <thead><tr className="bg-gray-800 text-gray-300"><th className="px-4 py-3 text-left">Scoring achievement</th><th className="w-40 px-4 py-3 text-center">Value / points</th></tr></thead>
                <tbody>
                  {[
                    ["Barriers in Red Mitigator (1 point each)", barriersRed],
                    ["Barriers in Blue Mitigator (1 point each)", barriersBlue],
                    ["Total Barrier Points", barrierPoints],
                    ["Biodiversity Units — Red-side Ecosystem", biodiversityRed],
                    ["Biodiversity Units — Center Ecosystem", biodiversityCenter],
                    ["Biodiversity Units — Blue-side Ecosystem", biodiversityBlue],
                    ["Total Biodiversity Units (1 point each)", biodiversityUnits],
                    ["Distribution Factor", `${formatNumber(distributionFactor)}×`],
                    ["Distributed Biodiversity Points", biodiversityPoints],
                    ["Coopertition Bonus", coopertitionBonus],
                  ].map(([label, value], index) => (
                    <tr key={String(label)} className={`border-t border-gray-700 ${index === 2 || index === 6 || index >= 8 ? "font-bold" : ""}`}>
                      <td className="px-4 py-2.5 text-gray-300">{label}</td>
                      <td className="bg-emerald-950/25 px-4 py-2.5 text-center text-emerald-100">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-y border-gray-700 bg-gray-800 px-5 py-3 text-center font-bold text-gray-200">Regional Alliance scoring</div>
              <table className="w-full border-collapse text-sm">
                <thead><tr className="bg-gray-800"><th className="w-[29%] px-4 py-3 text-center text-red-300">Red</th><th className="px-4 py-3 text-center text-gray-200">Scoring detail</th><th className="w-[29%] px-4 py-3 text-center text-blue-300">Blue</th></tr></thead>
                <tbody>
                  <tr className="border-t border-gray-700 font-bold"><td className="bg-red-950/40 px-4 py-2.5 text-center text-red-100">{formatNumber(sharedBasePoints)}</td><td className="px-4 py-2.5 text-center text-gray-300">Barrier Points + Distributed Biodiversity Points</td><td className="bg-blue-950/40 px-4 py-2.5 text-center text-blue-100">{formatNumber(sharedBasePoints)}</td></tr>
                  {[0, 1, 2].map((index) => <tr key={`robot-${index}`} className="border-t border-gray-700"><td className="bg-red-950/40 px-4 py-2.5 text-center text-red-100">{protectionLevel(redRobotProtection[index])}</td><td className="px-4 py-2.5 text-center text-gray-300">Robot {index + 1} Protection</td><td className="bg-blue-950/40 px-4 py-2.5 text-center text-blue-100">{protectionLevel(blueRobotProtection[index])}</td></tr>)}
                  <tr className="border-t border-gray-700 font-bold"><td className="bg-red-950/40 px-4 py-2.5 text-center text-red-100">{formatNumber(redProtectionMultiplier)}×</td><td className="px-4 py-2.5 text-center text-gray-300">Protection Multiplier</td><td className="bg-blue-950/40 px-4 py-2.5 text-center text-blue-100">{formatNumber(blueProtectionMultiplier)}×</td></tr>
                  <tr className="border-t border-gray-700"><td className="bg-red-950/40 px-4 py-2.5 text-center text-red-100">{formatNumber(redProtectedScore)}</td><td className="px-4 py-2.5 text-center text-gray-300">Score after Protection Multiplier</td><td className="bg-blue-950/40 px-4 py-2.5 text-center text-blue-100">{formatNumber(blueProtectedScore)}</td></tr>
                  <tr className="border-t border-gray-700"><td className="bg-red-950/40 px-4 py-2.5 text-center text-red-100">+{formatNumber(coopertitionBonus)}</td><td className="px-4 py-2.5 text-center text-gray-300">Coopertition Bonus</td><td className="bg-blue-950/40 px-4 py-2.5 text-center text-blue-100">+{formatNumber(coopertitionBonus)}</td></tr>
                  <tr className="border-t-2 border-gray-600 font-bold">
                    <td className="bg-red-900/55 px-4 py-3 text-center text-red-100">{data.redMinPen ?? 0} / {data.redMajPen ?? 0}</td>
                    <td className="px-4 py-3 text-center">Minor / Major penalties</td>
                    <td className="bg-blue-900/55 px-4 py-3 text-center text-blue-100">{data.blueMinPen ?? 0} / {data.blueMajPen ?? 0}</td>
                  </tr>
                  <tr className="border-t border-gray-600 text-base font-black">
                    <td className="bg-red-800/70 px-4 py-3 text-center">{played ? redScore : "—"}</td>
                    <td className="bg-gray-800 px-4 py-3 text-center">Total Score</td>
                    <td className="bg-blue-800/70 px-4 py-3 text-center">{played ? blueScore : "—"}</td>
                  </tr>
                </tbody>
              </table>
              <p className="border-t border-gray-700 bg-gray-950 px-4 py-3 text-center text-xs text-gray-500">Match Score = (Barrier Points + Biodiversity Points × Distribution Factor) × Protection Multiplier + Coopertition Bonus. Fractional scores round up.</p>
            </div></> : <GenericMatchDetails details={details} />}
          </div>

          <aside className="xl:sticky xl:top-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="flex items-center gap-2 text-2xl font-semibold"><Youtube className="text-red-500" />Video</h2>
              {hasStoredAdminKey && (
                <button
                  onClick={() => {
                    setVideoUrlInput(data.videoUrl ?? "");
                    setVideoNotice("");
                    setEditingVideo((current) => !current);
                  }}
                  className="inline-flex items-center gap-2 text-sm font-medium text-gray-400 transition hover:text-white"
                >
                  {editingVideo ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                  {editingVideo ? "Cancel" : videoEmbed ? "Edit video" : "Add video"}
                </button>
              )}
            </div>
            {videoEmbed ? videoEnabled ? (
              <div className="mt-3 overflow-hidden rounded-xl border border-gray-700 bg-black shadow-2xl">
                <iframe src={videoEmbed} title={`${title} video`} className="aspect-video w-full" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
              </div>
            ) : (
              <div className="mt-3 flex aspect-video items-center justify-center rounded-xl border border-gray-700 bg-gray-900 px-6 text-center">
                <div className="max-w-sm">
                  <Youtube className="mx-auto h-12 w-12 text-red-500" />
                  <p className="mt-3 font-semibold text-gray-200">Load video from YouTube</p>
                  <p className="mt-2 text-xs leading-5 text-gray-500">YouTube is not contacted until you choose to load the player. Loading it shares technical data such as your IP address with Google.</p>
                  <button type="button" onClick={() => setVideoEnabled(true)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500">
                    <Play className="h-4 w-4 fill-current" />Load video
                  </button>
                  {videoWatch && <a href={videoWatch} target="_blank" rel="noreferrer" className="ml-3 mt-4 inline-flex items-center gap-1.5 text-sm text-sky-400 hover:underline"><ExternalLink className="h-4 w-4" />Open on YouTube</a>}
                </div>
              </div>
            ) : (
              <div className="mt-3 flex aspect-video items-center justify-center rounded-xl border border-dashed border-gray-700 bg-gray-900 text-center">
                <div><Youtube className="mx-auto h-12 w-12 text-gray-700" /><p className="mt-3 font-semibold text-gray-400">No video available</p></div>
              </div>
            )}

            {editingVideo && hasStoredAdminKey && (
              <form onSubmit={saveVideo} className="mt-3 space-y-3 rounded-xl border border-gray-700 bg-gray-900 p-4">
                <label className="block text-xs font-medium uppercase tracking-wider text-gray-500">YouTube URL
                  <div className="relative mt-2">
                    <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
                    <input value={videoUrlInput} onChange={(event) => setVideoUrlInput(event.target.value)} placeholder="https://youtu.be/…" className="control w-full py-2.5 pl-10 pr-3 text-sm" autoFocus />
                  </div>
                </label>
                <div className="flex items-center justify-between gap-3">
                  <p className={`text-xs ${videoNotice.toLowerCase().includes("saved") || videoNotice.toLowerCase().includes("removed") ? "text-emerald-400" : "text-red-300"}`}>{videoNotice}</p>
                  <button disabled={videoSaving || !adminKey.trim()} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-40">
                    <Check className="h-4 w-4" />{videoSaving ? "Saving…" : "Save"}
                  </button>
                </div>
                {data.videoUrl && <p className="text-xs text-gray-600">Clear the URL and save to remove the recording.</p>}
              </form>
            )}
            {!editingVideo && videoNotice && <p className="mt-2 text-xs text-emerald-400">{videoNotice}</p>}
          </aside>
        </div>
      </div>
    </main>
  );
}
