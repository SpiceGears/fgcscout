"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronRight, Search, Swords, Trophy } from "lucide-react";
import { formatTeamName } from "@/lib/country";

type Participant = {
  station?: number;
  teamKey?: number | string;
  id?: number | string;
  country?: string;
  countryCode?: string;
};

type Match = {
  id: string;
  year: number;
  data: {
    id?: number | string;
    name?: string;
    eventKey?: string;
    scheduledTime?: string;
    redScore?: number;
    blueScore?: number;
    field?: number;
    played?: boolean;
    participants?: Participant[];
  };
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

function teamLabel(team: Participant) {
  return formatTeamName(team.country, team.countryCode);
}

export default function MatchesPage() {
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadYears() {
      try {
        const response = await fetch(`${API_URL}/api/GameData/years`, { cache: "no-store" });
        if (!response.ok) throw new Error("Could not load seasons.");
        const data = (await response.json()) as number[];
        setYears(data);
        setYear(data[0] ?? null);
        if (data.length === 0) setLoading(false);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not load seasons.");
        setLoading(false);
      }
    }
    loadYears();
  }, []);

  useEffect(() => {
    if (year === null) return;
    async function loadMatches() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${API_URL}/api/GameData/${year}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Could not load matches.");
        setMatches((await response.json()) as Match[]);
      } catch (reason) {
        setMatches([]);
        setError(reason instanceof Error ? reason.message : "Could not load matches.");
      } finally {
        setLoading(false);
      }
    }
    loadMatches();
  }, [year]);

  const filteredMatches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return matches;
    return matches.filter((match) => {
      const teams = match.data.participants?.map(teamLabel).join(" ") ?? "";
      return [match.data.name, match.data.eventKey, match.data.id, teams]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [matches, query]);

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-400">Match archive</p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">FIRST Global matches</h1>
            <p className="mt-2 text-gray-400">Browse the complete match history season by season.</p>
          </div>
          <label className="flex min-w-48 flex-col gap-2 text-sm text-gray-400">
            Season
            <select value={year ?? ""} onChange={(event) => setYear(Number(event.target.value))} className="rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 font-semibold text-white outline-none focus:border-sky-500">
              {years.map((availableYear) => <option key={availableYear} value={availableYear}>{availableYear}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-8 flex flex-col gap-4 rounded-3xl border border-gray-800 bg-gray-900 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search match, event or country…" className="w-full rounded-2xl border border-gray-800 bg-gray-950 py-3 pl-12 pr-4 text-gray-100 outline-none placeholder:text-gray-600 focus:border-sky-600" />
          </div>
          <div className="flex items-center gap-2 px-2 text-sm text-gray-400"><CalendarDays className="h-4 w-4" />{filteredMatches.length} of {matches.length} matches</div>
        </div>

        {error && <div className="mt-6 rounded-2xl border border-red-800 bg-red-950/50 p-5 text-red-200">{error}</div>}
        {!loading && !error && years.length === 0 && <div className="mt-6 rounded-3xl border border-gray-800 bg-gray-900 p-8 text-center text-gray-400">No seasons are available. Import a season in the admin panel.</div>}
        {loading ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((item) => <div key={item} className="h-56 animate-pulse rounded-3xl bg-gray-900" />)}
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {filteredMatches.map((match) => {
              const red = match.data.participants?.filter((team) => (team.station ?? 0) >= 11 && (team.station ?? 0) <= 13) ?? [];
              const blue = match.data.participants?.filter((team) => (team.station ?? 0) >= 21 && (team.station ?? 0) <= 23) ?? [];
              const redScore = match.data.redScore ?? 0;
              const blueScore = match.data.blueScore ?? 0;
              return (
                <Link key={match.id} href={`/match/${match.id}`} className="group rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-lg transition hover:-translate-y-0.5 hover:border-sky-700 hover:shadow-sky-950/30">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="text-xs font-semibold uppercase tracking-widest text-gray-500">{match.data.eventKey ?? `Season ${match.year}`}</p><h2 className="mt-2 text-xl font-bold">{match.data.name ?? `Match ${match.data.id ?? match.id}`}</h2><p className="mt-1 text-sm text-gray-500">Field {match.data.field ?? "—"}</p></div>
                    <ChevronRight className="mt-2 text-gray-600 transition group-hover:translate-x-1 group-hover:text-sky-400" />
                  </div>

                  <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <div className="rounded-2xl bg-red-950/50 p-3"><p className="text-xs font-semibold uppercase tracking-wider text-red-300">Red</p><div className="mt-2 space-y-1 text-xs text-gray-300">{red.map((team) => <p key={`${team.station}-${team.teamKey}`} className="truncate">{teamLabel(team)}</p>)}</div></div>
                    <div className="text-center"><Trophy className="mx-auto h-4 w-4 text-amber-400" /><p className="mt-2 whitespace-nowrap text-2xl font-bold"><span className={redScore > blueScore ? "text-red-400" : ""}>{redScore}</span><span className="mx-2 text-gray-600">:</span><span className={blueScore > redScore ? "text-blue-400" : ""}>{blueScore}</span></p></div>
                    <div className="rounded-2xl bg-blue-950/50 p-3 text-right"><p className="text-xs font-semibold uppercase tracking-wider text-blue-300">Blue</p><div className="mt-2 space-y-1 text-xs text-gray-300">{blue.map((team) => <p key={`${team.station}-${team.teamKey}`} className="truncate">{teamLabel(team)}</p>)}</div></div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {!loading && matches.length > 0 && filteredMatches.length === 0 && <div className="mt-6 rounded-3xl border border-gray-800 bg-gray-900 p-8 text-center text-gray-400"><Swords className="mx-auto mb-3 h-8 w-8" />No matches fit this search.</div>}
      </div>
    </main>
  );
}
