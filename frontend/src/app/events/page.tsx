"use client";

import { officialRankingRows, type OfficialRanking } from "@/lib/officialRankings";
import Link from "next/link";
import { rememberSeason, savedSeason, isPlayed } from "@/lib/seasonData";
import { useEffect, useMemo, useState } from "react";
import { Award, BarChart3, CalendarDays, ExternalLink, MapPin, Play } from "lucide-react";
import { formatTeamName, formatTeamSlug } from "@/lib/country";
import { AWARDS_2025, EVENT_META, getAwardTeamSlug, MEDIA_LINKS, parseAwardTeams } from "@/constants/EventContent";

type Participant = {
  station?: number;
  teamKey?: number | string;
  country?: string;
  countryCode?: string;
};

type EventMatch = {
  id: string;
  year: number;
  data: {
    id?: number | string;
    name?: string;
    field?: number;
    played?: boolean;
    redScore?: number;
    blueScore?: number;
    participants?: Participant[];
    details?: Record<string, unknown>;
  };
};

type Ranking = {
  rank?: number;
  climbPoints?: number;
  key: string;
  country: string;
  countryRaw?: string;
  countryCode?: string;
  played: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  rankingScore: number;
  highestPoints: number;
  protectionPoints: number;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const TABS = ["Results", "Rankings", "Awards", "Teams", "Stats", "Media"] as const;
type Tab = (typeof TABS)[number];

function AwardTeamLinks({ value }: { value?: string }) {
  if (!value) return <span className="text-gray-600">—</span>;
  return (
    <>
      {parseAwardTeams(value).map((country, index) => {
        const slug = getAwardTeamSlug(country);
        return (
          <span key={`${country}-${index}`}>
            {index > 0 && <span className="mx-1.5 text-gray-600">·</span>}
            <Link href={`/team/${slug}`} className="font-semibold text-gray-100 transition hover:text-sky-300 hover:underline">
              Team {country}
            </Link>
          </span>
        );
      })}
    </>
  );
}

function getAlliance(station?: number) {
  if (station && station >= 11 && station <= 13) return "red";
  if (station && station >= 21 && station <= 23) return "blue";
  return undefined;
}

function TeamCell({ participant }: { participant: Participant }) {
  const slug = formatTeamSlug(participant.country, participant.countryCode, String(participant.teamKey ?? ""));
  return (
    <Link href={`/team/${slug}`} className="block min-w-36 px-3 py-2 font-semibold text-gray-100 transition hover:text-sky-300">
      {formatTeamName(participant.country, participant.countryCode)}
    </Link>
  );
}

function ResultsTable({ matches }: { matches: EventMatch[] }) {
  const stagePriority = (name?: string) =>
    /final/i.test(name ?? "") ? 0 :
    /round robin/i.test(name ?? "") ? 1 :
    2;
  const matchNumber = (match: EventMatch) => {
    const numberInName = match.data.name?.match(/(\d+)(?!.*\d)/)?.[1];
    return Number(numberInName ?? match.data.id ?? 0);
  };
  const sorted = [...matches].sort((a, b) =>
    stagePriority(a.data.name) - stagePriority(b.data.name) ||
    matchNumber(b) - matchNumber(a)
  );
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-700">
      <table className="w-full min-w-[950px] border-collapse text-left">
        <thead>
          <tr className="bg-gray-800 text-sm text-gray-200">
            <th className="w-28 px-4 py-4">Match</th>
            <th className="w-32 px-4 py-4 text-center">Score</th>
            <th colSpan={3} className="bg-red-700 px-4 py-4 text-center text-base">Red Alliance</th>
            <th colSpan={3} className="bg-blue-700 px-4 py-4 text-center text-base">Blue Alliance</th>
          </tr>
        </thead>
          {sorted.map((match, index) => {
            const red = match.data.participants?.filter((participant) => getAlliance(participant.station) === "red") ?? [];
            const blue = match.data.participants?.filter((participant) => getAlliance(participant.station) === "blue") ?? [];
            const redScore = match.data.redScore ?? 0;
            const blueScore = match.data.blueScore ?? 0;
            const getStage = (name?: string) => /final/i.test(name ?? "") ? "Finals" : /round robin/i.test(name ?? "") ? "Round Robin Matches" : /ranking/i.test(name ?? "") ? "Ranking Matches" : "Qualification Matches";
            const stage = getStage(match.data.name);
            const showSection = index === 0 || stage !== getStage(sorted[index - 1].data.name);
            return (
              <tbody key={match.id}>
                {showSection && (
                  <tr>
                    <td colSpan={8} className="border-y border-gray-700 bg-gray-900/95 py-2 text-center text-sm font-semibold text-gray-300">
                      {stage}
                    </td>
                  </tr>
                )}
                <tr className="border-b border-gray-800 bg-gray-900 transition hover:bg-gray-800/80">
                  <td className="px-4 py-3">
                    <Link href={`/match/${match.id}`} className={`font-black ${redScore > blueScore ? "text-red-400" : "text-sky-400"} hover:underline`}>
                      {match.data.name?.replace("Qualification Match ", "Q-").replace("Final Match ", "F-") ?? `Match ${match.data.id}`}
                    </Link>
                    <p className="mt-1 text-xs text-gray-500">Field {match.data.field ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-center text-lg font-bold">
                    <span className={redScore > blueScore ? "text-red-400" : "text-gray-300"}>{redScore}</span>
                    <span className="mx-2 text-gray-600">–</span>
                    <span className={blueScore > redScore ? "text-sky-400" : "text-gray-300"}>{blueScore}</span>
                  </td>
                  {red.map((participant) => <td key={`${participant.station}-${participant.teamKey}`} className="bg-red-950/45"><TeamCell participant={participant} /></td>)}
                  {Array.from({ length: Math.max(0, 3 - red.length) }).map((_, emptyIndex) => <td key={`red-empty-${emptyIndex}`} className="bg-red-950/45" />)}
                  {blue.map((participant) => <td key={`${participant.station}-${participant.teamKey}`} className="bg-blue-950/45"><TeamCell participant={participant} /></td>)}
                  {Array.from({ length: Math.max(0, 3 - blue.length) }).map((_, emptyIndex) => <td key={`blue-empty-${emptyIndex}`} className="bg-blue-950/45" />)}
                </tr>
              </tbody>
            );
          })}
      </table>
    </div>
  );
}

function getParkingPoints(match: EventMatch, station: number) {
  const side = station < 20 ? "red" : "blue";
  const robot = ["", "One", "Two", "Three"][station % 10];
  const value = robot ? match.data.details?.[`${side}Robot${robot}Parking`] : undefined;
  return typeof value === "number" ? value : 0;
}

function buildRankings(matches: EventMatch[], year: number | null) {
  const rankings = new Map<string, Ranking>();
  const hasNamedRankingStage = matches.some((match) => /(qualification|ranking match)/i.test(match.data.name ?? ""));
  for (const match of matches) {
    if (!isPlayed(match)) continue;
    if (year === 2025) {
      if (!/ranking match/i.test(match.data.name ?? "")) continue;
    } else if (hasNamedRankingStage && match.data.name && !/(qualification|ranking match)/i.test(match.data.name)) {
      continue;
    } else if (!hasNamedRankingStage && /(final|round robin|playoff)/i.test(match.data.name ?? "")) {
      continue;
    }
    if (typeof match.data.redScore !== "number" || typeof match.data.blueScore !== "number") continue;
    const redScore = match.data.redScore ?? 0;
    const blueScore = match.data.blueScore ?? 0;
    for (const participant of match.data.participants ?? []) {
      const key = String(participant.teamKey ?? participant.countryCode ?? participant.country ?? "");
      if (!key) continue;
      const row = rankings.get(key) ?? {
        key,
        country: formatTeamName(participant.country, participant.countryCode),
        countryRaw: participant.country,
        countryCode: participant.countryCode,
        played: 0,
        wins: 0,
        losses: 0,
        ties: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        rankingScore: 0,
        highestPoints: 0,
        protectionPoints: 0,
      };
      const side = getAlliance(participant.station);
      if (!side) continue;
      const ownScore = side === "red" ? redScore : blueScore;
      const opponentScore = side === "red" ? blueScore : redScore;
      row.played += 1;
      row.pointsFor += ownScore;
      row.pointsAgainst += opponentScore;
      row.highestPoints = Math.max(row.highestPoints, ownScore);
      row.protectionPoints += getParkingPoints(match, participant.station!);
      if (ownScore === opponentScore) row.ties += 1;
      else if (ownScore > opponentScore) row.wins += 1;
      else row.losses += 1;
      rankings.set(key, row);
    }
  }

  if (year === 2025) {
    for (const row of rankings.values()) {
      const teamScores: number[] = [];
      for (const match of matches) {
        if (!isPlayed(match) || !/ranking match/i.test(match.data.name ?? "")) continue;
        const participant = match.data.participants?.find((entry) =>
          String(entry.teamKey ?? entry.countryCode ?? entry.country ?? "") === row.key
        );
        const side = getAlliance(participant?.station);
        if (!side) continue;
        const score = side === "red" ? match.data.redScore : match.data.blueScore;
        if (typeof score === "number") teamScores.push(score);
      }
      const countedScores = teamScores.sort((a, b) => b - a).slice(0, 11);
      row.rankingScore = countedScores.length
        ? countedScores.reduce((sum, score) => sum + score, 0) / countedScores.length
        : 0;
    }
    return [...rankings.values()].sort((a, b) =>
      b.rankingScore - a.rankingScore ||
      b.highestPoints - a.highestPoints ||
      b.protectionPoints - a.protectionPoints ||
      a.country.localeCompare(b.country)
    );
  }

  return [...rankings.values()].sort((a, b) => {
    const scoreA = a.wins * 3 + a.ties;
    const scoreB = b.wins * 3 + b.ties;
    return scoreB - scoreA || (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst) || b.pointsFor - a.pointsFor;
  });
}

export default function EventsPage() {
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [official, setOfficial] = useState<OfficialRanking[]>([]);
  const [rankingError, setRankingError] = useState("");
  const [matches, setMatches] = useState<EventMatch[]>([]);
  const [tab, setTab] = useState<Tab>("Results");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/GameData/years`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : [])
      .then((availableYears: number[]) => {
        setYears([...availableYears].sort((a, b) => b - a));
        setYear(savedSeason(availableYears));
        if (availableYears.length === 0) setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (year === null) return;
    let active = true;
    async function loadMatches(initial: boolean) {
      if (initial) { setLoading(true); setOfficial([]); setRankingError(""); }
      try {
        const [response, rankingResponse] = await Promise.all([
          fetch(`${API_URL}/api/GameData/${year}`, {cache:"no-store"}),
          year === 2026 ? fetch(`${API_URL}/api/Seasons/${year}/rankings`, {cache:"no-store"}) : Promise.resolve(null),
        ]);
        if (year === 2026 && active) {
          if (rankingResponse?.ok) {
            const payload = await rankingResponse.json();
            setOfficial(Array.isArray(payload.rankings) ? payload.rankings : []); setRankingError("");
          } else { setOfficial([]); setRankingError("Official rankings are unavailable. Sync the season to load them."); }
        }
        const data = response.ok ? await response.json() as EventMatch[] : [];
        if (active) setMatches(data);
      } catch {
        if (active && year === 2026) { setOfficial([]); setRankingError("Could not load official rankings. Try again after the next sync."); }
      } finally {
        if (active && initial) setLoading(false);
      }
    }
    void loadMatches(true);
    const timer = window.setInterval(() => void loadMatches(false), 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [year]);

  const rankings: Ranking[] = useMemo(() => year === 2026 ? officialRankingRows(official).map(row => ({
    ...row,country:formatTeamName(row.countryRaw,row.countryCode),wins:0,losses:0,ties:0,pointsFor:0,pointsAgainst:0,protectionPoints:0,
  })) : buildRankings(matches, year), [matches, year, official]);
  const teams = useMemo(() => {
    const directory = new Map<string, { key: string; name: string; slug: string }>();
    matches.forEach((match) => match.data.participants?.forEach((participant) => {
      const key = String(participant.teamKey ?? participant.countryCode ?? participant.country ?? "");
      const slug = formatTeamSlug(participant.country, participant.countryCode, key);
      if (slug && !directory.has(slug)) directory.set(slug, { key: slug, name: formatTeamName(participant.country, participant.countryCode), slug });
    }));
    return [...directory.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [matches]);
  const stats = useMemo(() => {
    const playedMatches = matches.filter((match) =>
      isPlayed(match) &&
      typeof match.data.redScore === "number" &&
      typeof match.data.blueScore === "number"
    );
    const scores = playedMatches.flatMap((match) => [match.data.redScore ?? 0, match.data.blueScore ?? 0]);
    return {
      matches: playedMatches.length,
      teams: rankings.length,
      average: scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0,
      high: scores.length ? Math.max(...scores) : 0,
    };
  }, [matches, rankings]);
  const meta = year ? EVENT_META[year] : undefined;

  return (
    <main className="page-shell">
      <div className="page-container">
        <header className="flex flex-col gap-6 border-b border-slate-800 pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">{meta?.theme ?? "FIRST Global Challenge"}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">{meta?.title ?? (year ? `Season ${year}` : "Event")}</h1>
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
              {meta && <><span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />{meta.dates}</span><span className="flex items-center gap-2"><MapPin className="h-4 w-4" />{meta.location}</span></>}
            </div>
          </div>
          <label className="flex min-w-48 flex-col gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Season
            <select value={year ?? ""} onChange={(event) => { const selected = Number(event.target.value); rememberSeason(selected); setYear(selected); }} className="control px-4 py-3 text-sm font-semibold normal-case tracking-normal">
              {years.map((availableYear) => <option key={availableYear} value={availableYear}>{availableYear}</option>)}
            </select>
          </label>
        </header>

        <nav className="mt-6 flex gap-5 overflow-x-auto border-b border-slate-800">
          {TABS.map((item) => <button key={item} onClick={() => setTab(item)} className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium ${tab === item ? "border-sky-400 text-sky-400" : "border-transparent text-slate-400 hover:text-white"}`}>{item}</button>)}
        </nav>

        <section className="mt-6">
          {loading ? <div className="h-96 animate-pulse rounded-xl border border-gray-800 bg-gray-900" /> : null}
          {!loading && tab === "Results" && <ResultsTable matches={matches} />}

          {!loading && tab === "Rankings" && (
            <div className="overflow-x-auto">
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold">Team rankings</h2>
                {year === 2026 && <a href="https://results.first.global/" target="_blank" rel="noreferrer" className="text-sm text-sky-400 hover:underline">Official standings</a>}
              </div>
              {year === 2026 && rankings.length === 0 ? <p className="py-6 text-sm text-slate-400">{rankingError || "No official rankings published yet. Sync the season to load the latest standings."}</p> :
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="text-slate-400"><tr>
                  <th className="px-3 py-3 font-medium">Rank</th><th className="px-3 py-3 font-medium">Team</th>
                  {year === 2025 || year === 2026 ? <><th className="px-3 py-3 text-right font-medium">Ranking Score</th><th className="px-3 py-3 text-right font-medium">Highest Points</th><th className="px-3 py-3 text-right font-medium">{year === 2026 ? "Climb Points" : "Protection Points"}</th></> : <><th className="px-3 py-3 text-right">W-L-T</th><th className="px-3 py-3 text-right">Ranking score</th><th className="px-3 py-3 text-right">Point diff.</th></>}
                  <th className="px-3 py-3 text-right font-medium">Played</th>
                </tr></thead>
                <tbody>{rankings.map((ranking,index) => <tr key={ranking.key} className="border-t border-slate-800/60">
                  <td className="px-3 py-3 text-slate-400">{year === 2026 ? ranking.rank || "—" : index + 1}</td>
                  <td className="px-3 py-3"><Link href={`/team/${formatTeamSlug(ranking.countryRaw,ranking.countryCode,ranking.key)}`} className="text-sky-400 hover:underline">{ranking.country}</Link></td>
                  {year === 2025 || year === 2026 ? <><td className="px-3 py-3 text-right tabular-nums">{ranking.rankingScore.toLocaleString("en-US",{maximumFractionDigits:3})}</td><td className="px-3 py-3 text-right tabular-nums">{ranking.highestPoints}</td><td className="px-3 py-3 text-right tabular-nums">{(year === 2026 ? ranking.climbPoints ?? 0 : ranking.protectionPoints).toLocaleString("en-US",{maximumFractionDigits:3})}</td></> : <><td className="px-3 py-3 text-right">{ranking.wins}-{ranking.losses}-{ranking.ties}</td><td className="px-3 py-3 text-right">{ranking.wins*3+ranking.ties}</td><td className="px-3 py-3 text-right">{ranking.pointsFor-ranking.pointsAgainst}</td></>}
                  <td className="px-3 py-3 text-right tabular-nums">{ranking.played}</td>
                </tr>)}</tbody>
              </table>}
            </div>
          )}

          {!loading && tab === "Awards" && (
            <div>
              <div className="mb-5 flex items-center justify-between"><div><h2 className="text-2xl font-bold">{year ? `${year} awards` : "Awards"}</h2><p className="text-sm text-gray-500">{year === 2025 ? "Official winners from the Eco Equilibrium challenge in Panama." : "Awards will appear after they are added for this season."}</p></div>{year === 2025 && <a href="https://first.global/press-releases/a-beautiful-week-in-panama-the-2025-first-global-challenge-concludes-awards-announced/" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-sky-400">Official source <ExternalLink className="h-4 w-4" /></a>}</div>
              {year === 2025 ? <div className="grid gap-3 md:grid-cols-2">{AWARDS_2025.map((award) => <article key={award.name} className="panel p-5"><div className="flex gap-3"><Award className="mt-0.5 h-5 w-5 text-amber-400" /><h3 className="font-semibold">{award.name}</h3></div><div className="mt-4 space-y-2 text-sm text-slate-400"><p><span className="mr-2">🥇</span><AwardTeamLinks value={award.gold} /></p><p><span className="mr-2">🥈</span><AwardTeamLinks value={award.silver} /></p><p><span className="mr-2">🥉</span><AwardTeamLinks value={award.bronze} /></p></div></article>)}</div> : <p className="panel p-8 text-slate-500">No awards have been added for this season yet.</p>}
            </div>
          )}

          {!loading && tab === "Teams" && <div className="grid gap-px overflow-hidden rounded-xl border border-gray-800 bg-gray-800 sm:grid-cols-2 lg:grid-cols-4">{teams.map((team) => <Link key={team.key} href={`/team/${team.slug}`} className="bg-gray-900 p-4 font-medium text-gray-300 transition hover:bg-gray-800 hover:text-sky-300">{team.name}</Link>)}</div>}

          {!loading && tab === "Stats" && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[{ label: "Played matches", value: stats.matches }, { label: "Teams in results", value: stats.teams }, { label: "Average alliance score", value: stats.average }, { label: "Highest alliance score", value: stats.high }].map((stat) => <div key={stat.label} className="rounded-2xl border border-gray-800 bg-gray-900 p-5"><BarChart3 className="text-emerald-400" /><p className="mt-4 text-3xl font-black">{stat.value}</p><p className="mt-1 text-sm text-gray-500">{stat.label}</p></div>)}</div>
            </div>
          )}

          {!loading && tab === "Media" && <div className="grid gap-5 md:grid-cols-3">{MEDIA_LINKS.map((media) => <a key={media.href} href={media.href} target="_blank" rel="noreferrer" className="group rounded-3xl border border-gray-800 bg-gray-900 p-6 transition hover:-translate-y-1 hover:border-red-700"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600 text-white"><Play /></div><h2 className="mt-5 text-xl font-bold">{media.title}</h2><p className="mt-2 text-sm text-gray-400">{media.description}</p><span className="mt-5 flex items-center gap-2 text-sm font-semibold text-sky-400">Open media <ExternalLink className="h-4 w-4" /></span></a>)}</div>}
        </section>
      </div>
    </main>
  );
}
