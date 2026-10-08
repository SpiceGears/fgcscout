"use client";

import { rememberSeason, savedSeason } from "@/lib/seasonData";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Search, Swords } from "lucide-react";
import { MatchesTable } from "@/components/match/MatchesTable";
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

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

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
        setYears([...data].sort((a, b) => b - a));
        setYear(savedSeason(data));
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
    let active = true;
    async function loadMatches(initial: boolean) {
      if (initial) {
        setLoading(true);
        setError("");
      }
      try {
        const response = await fetch(`${API_URL}/api/GameData/${year}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Could not load matches.");
        const data = (await response.json()) as Match[];
        if (active) setMatches(data);
      } catch (reason) {
        if (active && initial) {
          setMatches([]);
          setError(reason instanceof Error ? reason.message : "Could not load matches.");
        }
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

  const filteredMatches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return matches;
    return matches.filter((match) => {
      const teams = match.data.participants?.map(teamLabel).join(" ") ?? "";
      return [match.data.name, match.data.eventKey, teams]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [matches, query]);

  return (
    <main className="page-shell">
      <div className="page-container max-w-6xl">
        <div className="flex flex-col gap-5 border-b border-slate-800 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Match archive</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">FIRST Global matches</h1>
            <p className="mt-2 text-slate-500">Browse the complete match history season by season.</p>
          </div>
          <label className="flex min-w-48 flex-col gap-2 text-sm text-gray-400">
            Season
            <select value={year ?? ""} onChange={(event) => { const selected = Number(event.target.value); rememberSeason(selected); setYear(selected); }} className="control px-4 py-3 font-semibold">
              {years.map((availableYear) => <option key={availableYear} value={availableYear}>{availableYear}</option>)}
            </select>
          </label>
        </div>

        <div className="panel mt-6 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search match, event or country…" className="control w-full py-3 pl-12 pr-4 text-slate-100" />
          </div>
          <div className="flex items-center gap-2 px-2 text-sm text-gray-400"><CalendarDays className="h-4 w-4" />{filteredMatches.length} of {matches.length} matches</div>
        </div>

        {error && <div className="mt-6 rounded-2xl border border-red-800 bg-red-950/50 p-5 text-red-200">{error}</div>}
        {!loading && !error && years.length === 0 && <div className="mt-6 rounded-3xl border border-gray-800 bg-gray-900 p-8 text-center text-gray-400">No seasons are available. Import a season in the admin panel.</div>}
        {loading ? (
          <div className="mt-6 overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
            <div className="h-11 animate-pulse border-b border-gray-800 bg-gray-800" />
            {[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="h-16 animate-pulse border-b border-gray-800 last:border-b-0" />)}
          </div>
        ) : filteredMatches.length > 0 ? (
          <MatchesTable matches={filteredMatches} className="mt-6" />
        ) : null}

        {!loading && matches.length > 0 && filteredMatches.length === 0 && <div className="mt-6 rounded-3xl border border-gray-800 bg-gray-900 p-8 text-center text-gray-400"><Swords className="mx-auto mb-3 h-8 w-8" />No matches fit this search.</div>}
      </div>
    </main>
  );
}
