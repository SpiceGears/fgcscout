"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarClock, MapPin, Youtube } from "lucide-react";
import { formatTeamName, formatTeamSlug } from "@/lib/country";
import FieldVisualization from "@/components/match/FieldVisualization";

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

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

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

function toYouTubeEmbed(url?: string) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    let videoId = "";
    if (parsed.hostname === "youtu.be" || parsed.hostname === "www.youtu.be") videoId = parsed.pathname.slice(1);
    else if (parsed.pathname.startsWith("/shorts/") || parsed.pathname.startsWith("/embed/")) videoId = parsed.pathname.split("/")[2] ?? "";
    else videoId = parsed.searchParams.get("v") ?? "";
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
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

  useEffect(() => {
    if (!matchId) return;
    async function loadMatch() {
      setLoading(true);
      try {
        const response = await fetch(`${API_URL}/api/GameData/match/${matchId}`, { cache: "no-store" });
        if (!response.ok) throw new Error(response.status === 404 ? "Match not found." : "Could not load match.");
        setMatch((await response.json()) as MatchDatum);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not load match.");
      } finally {
        setLoading(false);
      }
    }
    loadMatch();
  }, [matchId]);

  const details = match?.data?.details;
  const redTeams = match?.data?.participants?.filter((team) => alliance(team.station) === "red") ?? [];
  const blueTeams = match?.data?.participants?.filter((team) => alliance(team.station) === "blue") ?? [];

  if (loading) return <main className="min-h-screen bg-gray-950 p-8"><div className="mx-auto h-96 max-w-6xl animate-pulse rounded-2xl bg-gray-900" /></main>;
  if (error || !match) return <main className="min-h-screen bg-gray-950 p-8 text-white"><div className="mx-auto max-w-3xl rounded-2xl border border-red-800 bg-red-950/40 p-8"><h1 className="text-2xl font-bold">Unable to open match</h1><p className="mt-3 text-red-200">{error || "Match not found."}</p><Link href="/events" className="mt-6 inline-flex items-center gap-2 text-sky-400"><ArrowLeft className="h-4 w-4" />Back to event</Link></div></main>;

  const data = match.data ?? {};
  const title = data.name ?? `Match ${data.id ?? matchId}`;
  const eventName = data.eventKey ?? `FIRST Global Challenge ${match.year ?? ""}`;
  const redScore = data.redScore ?? 0;
  const blueScore = data.blueScore ?? 0;
  const videoEmbed = toYouTubeEmbed(data.videoUrl);
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

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Link href="/events" className="inline-flex items-center gap-2 text-sm text-gray-400 transition hover:text-sky-300"><ArrowLeft className="h-4 w-4" />Back to event</Link>

        <header className="mt-5 border-b border-gray-800 pb-5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
            <Link href="/events" className="text-xl font-medium text-sky-400 transition hover:text-sky-300 hover:underline">{eventName}</Link>
          </div>
          <div className="mt-3 flex flex-wrap gap-5 text-sm text-gray-500">
            <span className="flex items-center gap-2"><CalendarClock className="h-4 w-4" />{formatDate(data.scheduledTime)}</span>
            <span className="flex items-center gap-2"><MapPin className="h-4 w-4" />Field {data.field ?? "—"}</span>
          </div>
        </header>

        <div className="mt-7 grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(430px,0.95fr)]">
          <div>
            <div className="overflow-x-auto rounded-xl border border-gray-700 bg-gray-900">
              <table className="w-full min-w-[620px] table-fixed border-collapse text-center">
                <thead className="bg-gray-800 text-sm text-gray-200"><tr><th colSpan={3} className="border-r border-gray-700 px-3 py-2">Teams</th><th className="w-24 px-3 py-2">Score</th></tr></thead>
                <tbody>
                  <tr className="border-t border-gray-700 bg-red-950/55">
                    {redTeams.map((team) => <td key={`${team.station}-${team.teamKey}`} className="border-r border-red-900/60"><TeamLink team={team} /></td>)}
                    {Array.from({ length: Math.max(0, 3 - redTeams.length) }).map((_, index) => <td key={`red-empty-${index}`} className="border-r border-red-900/60" />)}
                    <td className="bg-red-900/45 px-3 py-3 text-2xl font-black text-red-300">{redScore}</td>
                  </tr>
                  <tr className="border-t border-gray-700 bg-blue-950/55">
                    {blueTeams.map((team) => <td key={`${team.station}-${team.teamKey}`} className="border-r border-blue-900/60"><TeamLink team={team} /></td>)}
                    {Array.from({ length: Math.max(0, 3 - blueTeams.length) }).map((_, index) => <td key={`blue-empty-${index}`} className="border-r border-blue-900/60" />)}
                    <td className="bg-blue-900/45 px-3 py-3 text-2xl font-black text-blue-300">{blueScore}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <FieldVisualization details={details} redTeams={redTeams} blueTeams={blueTeams} />

            <h2 className="mt-7 text-2xl font-semibold">Detailed Results</h2>
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
                    <td className="bg-red-800/70 px-4 py-3 text-center">{redScore}</td>
                    <td className="bg-gray-800 px-4 py-3 text-center">Total Score</td>
                    <td className="bg-blue-800/70 px-4 py-3 text-center">{blueScore}</td>
                  </tr>
                </tbody>
              </table>
              <p className="border-t border-gray-700 bg-gray-950 px-4 py-3 text-center text-xs text-gray-500">Match Score = (Barrier Points + Biodiversity Points × Distribution Factor) × Protection Multiplier + Coopertition Bonus. Fractional scores round up.</p>
            </div>
          </div>

          <aside className="xl:sticky xl:top-6">
            <h2 className="flex items-center gap-2 text-2xl font-semibold"><Youtube className="text-red-500" />Video</h2>
            {videoEmbed ? (
              <div className="mt-3 overflow-hidden rounded-xl border border-gray-700 bg-black shadow-2xl">
                <iframe src={videoEmbed} title={`${title} video`} className="aspect-video w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
              </div>
            ) : (
              <div className="mt-3 flex aspect-video items-center justify-center rounded-xl border border-dashed border-gray-700 bg-gray-900 text-center">
                <div><Youtube className="mx-auto h-12 w-12 text-gray-700" /><p className="mt-3 font-semibold text-gray-400">No video assigned</p><p className="mt-1 text-sm text-gray-600">Add a YouTube URL for this match in Admin.</p></div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
