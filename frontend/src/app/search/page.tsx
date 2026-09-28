"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { Search, Swords, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { MatchesTable, type MatchTableItem } from "@/components/match/MatchesTable";
import { formatCountryName, formatTeamName, formatTeamSlug } from "@/lib/country";

type Team = { id: string; country?: string; countryCode?: string };
type SearchMatch = MatchTableItem & { year: number };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

function matchesWords(value: string, query: string) {
  const haystack = value.toLowerCase();
  return query.trim().toLowerCase().split(/\s+/).every((word) => haystack.includes(word));
}

function SearchResults() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q")?.trim() ?? "";
  const [input, setInput] = useState(query);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => setInput(query), [query]);

  useEffect(() => {
    async function loadSearchIndex() {
      setLoading(true);
      setError("");
      try {
        const [teamsResponse, yearsResponse] = await Promise.all([
          fetch(`${API_URL}/api/Teams`, { cache: "no-store" }),
          fetch(`${API_URL}/api/GameData/years`, { cache: "no-store" }),
        ]);
        if (!teamsResponse.ok || !yearsResponse.ok) throw new Error("Could not load the search index.");

        const [teamData, years] = await Promise.all([
          teamsResponse.json() as Promise<Team[]>,
          yearsResponse.json() as Promise<number[]>,
        ]);
        const matchResponses = await Promise.all(
          years.map((year) => fetch(`${API_URL}/api/GameData/${year}`, { cache: "no-store" }))
        );
        const matchGroups = await Promise.all(
          matchResponses.map(async (response, index) => {
            if (!response.ok) return [];
            const seasonMatches = await response.json() as MatchTableItem[];
            return seasonMatches.map((match) => ({ ...match, year: years[index] }));
          })
        );
        setTeams(teamData);
        setMatches(matchGroups.flat());
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not load the search index.");
      } finally {
        setLoading(false);
      }
    }
    loadSearchIndex();
  }, []);

  const teamResults = useMemo(() => {
    if (!query) return [];
    return teams.filter((team) => matchesWords([
      formatCountryName(team.country, team.countryCode),
      formatTeamName(team.country, team.countryCode),
      team.country,
      team.countryCode,
    ].filter(Boolean).join(" "), query));
  }, [query, teams]);

  const matchResults = useMemo(() => {
    if (!query) return [];
    return matches.filter((match) => matchesWords([
      match.year,
      match.data?.name,
      match.data?.eventKey,
      match.data?.field,
      match.data?.redScore,
      match.data?.blueScore,
      ...(match.data?.participants ?? []).flatMap((team) => [
        team.country,
        team.countryCode,
        formatTeamName(team.country, team.countryCode),
      ]),
    ].filter((value) => value !== undefined && value !== null).join(" "), query));
  }, [matches, query]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = input.trim();
    router.push(nextQuery ? `/search?q=${encodeURIComponent(nextQuery)}` : "/search");
  }

  return (
    <main className="page-shell">
      <div className="page-container max-w-6xl">
        <header className="border-b border-slate-800 pb-7">
          <p className="eyebrow">Global search</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">Search FGC Scout</h1>
          <form onSubmit={submit} className="relative mt-5 max-w-2xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
            <input
              type="search"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Country, team ID, match, field or score…"
              autoFocus
              className="control h-12 w-full pl-12 pr-28 text-slate-100"
            />
            <button type="submit" className="absolute right-1.5 top-1.5 h-9 rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white transition hover:bg-sky-500">
              Search
            </button>
          </form>
        </header>

        {loading && <div className="mt-6 h-52 animate-pulse rounded-xl border border-gray-800 bg-gray-900" />}
        {error && <div className="mt-6 rounded-xl border border-red-800 bg-red-950/50 p-5 text-red-200">{error}</div>}
        {!loading && !error && !query && <div className="panel mt-6 p-10 text-center text-gray-400">Enter a team, country, match number or score.</div>}

        {!loading && !error && query && (
          <div className="mt-6 space-y-8">
            <section>
              <div className="mb-3 flex items-center gap-2">
                <Users className="h-5 w-5 text-sky-400" />
                <h2 className="text-xl font-semibold text-white">Teams</h2>
                <span className="font-mono text-sm text-gray-500">{teamResults.length}</span>
              </div>
              {teamResults.length > 0 ? (
                <div className="grid gap-px overflow-hidden rounded-xl border border-gray-800 bg-gray-800 sm:grid-cols-2">
                  {teamResults.map((team) => (
                    <Link key={team.id} href={`/team/${formatTeamSlug(team.country, team.countryCode, team.id)}`} className="min-w-0 bg-gray-900 px-4 py-3 transition hover:bg-gray-800">
                      <span className="block truncate font-semibold text-gray-100">{formatTeamName(team.country, team.countryCode)}</span>
                      <span className="mt-1 block font-mono text-xs text-gray-500">ID {team.id}</span>
                    </Link>
                  ))}
                </div>
              ) : <div className="panel p-5 text-sm text-gray-500">No matching teams.</div>}
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2">
                <Swords className="h-5 w-5 text-sky-400" />
                <h2 className="text-xl font-semibold text-white">Matches</h2>
                <span className="font-mono text-sm text-gray-500">{matchResults.length}</span>
              </div>
              {matchResults.length > 0 ? <MatchesTable matches={matchResults} /> : <div className="panel p-5 text-sm text-gray-500">No matching matches.</div>}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

export default function SearchPage() {
  return <Suspense fallback={<main className="page-shell"><div className="page-container"><div className="h-52 animate-pulse rounded-xl border border-gray-800 bg-gray-900" /></div></main>}><SearchResults /></Suspense>;
}
