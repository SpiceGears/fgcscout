"use client";

import { savedSeason, seasonTeams } from "@/lib/seasonData";
import { ArrowUpRight, Search, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatCountryName, formatTeamSlug } from "@/lib/country";

type Team = { id: string; country?: string; countryCode?: string };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

function countryFlag(countryCode?: string) {
  const code = countryCode?.trim().toUpperCase();
  if (!code || code.length !== 2) return "FG";
  return String.fromCodePoint(...[...code].map((letter) => 127397 + letter.charCodeAt(0)));
}

export default function Teams() {
  const [year, setYear] = useState<number | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setQuery(new URLSearchParams(window.location.search).get("search") ?? "");
    async function load() {
      try {
        const yearsResponse = await fetch(`${API_URL}/api/GameData/years`, {cache:"no-store"});
        if (!yearsResponse.ok) return;
        const selected = savedSeason(await yearsResponse.json() as number[]);
        setYear(selected);
        if (selected === null) return;
        const response = await fetch(`${API_URL}/api/GameData/${selected}`, {cache:"no-store"});
        if (!response.ok) return;
        const data = seasonTeams(await response.json());
        setTeams(data.sort((a, b) =>
          formatCountryName(a.country, a.countryCode).localeCompare(
            formatCountryName(b.country, b.countryCode),
            undefined,
            { sensitivity: "base" }
          )
        ));
      } catch (error) {
        console.warn("Failed to load teams", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredTeams = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return teams;
    return teams.filter((team) =>
      [formatCountryName(team.country, team.countryCode), team.country, team.countryCode]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [query, teams]);

  return (
    <main className="page-shell">
      <div className="page-container max-w-6xl">
        <header className="flex flex-col gap-5 border-b border-slate-800 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Team directory</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">National teams</h1>
            <p className="mt-2 text-slate-500">{year ? `Browse delegations in the ${year} season.` : "Browse delegations in the selected season."}</p>
          </div>
          <div className="flex items-center gap-2 font-mono text-sm text-slate-500">
            <Users className="h-4 w-4" />
            {filteredTeams.length} / {teams.length}
          </div>
        </header>

        <div className="panel mt-6">
          <div className="border-b border-slate-800 p-4">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="control h-11 w-full pl-10 pr-4 text-sm"
                placeholder="Search country or code…"
                autoFocus={Boolean(query)}
              />
            </label>
          </div>

          <div className="grid gap-px bg-slate-800 sm:grid-cols-2">
            {loading
              ? Array.from({ length: 10 }).map((_, index) => <div key={index} className="h-20 animate-pulse bg-gray-900" />)
              : filteredTeams.map((team) => {
                  const name = formatCountryName(team.country, team.countryCode);
                  const code = (team.country ?? team.countryCode ?? "FG").toUpperCase();
                  return (
                    <Link
                      key={team.id}
                      href={`/team/${formatTeamSlug(team.country, team.countryCode, team.id)}`}
                      className="group flex min-w-0 items-center gap-4 bg-gray-900 px-4 py-4 transition hover:bg-gray-800"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-700 bg-gray-950 text-lg">
                        {countryFlag(team.countryCode)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-slate-200 transition group-hover:text-white">Team {name}</span>
                        <span className="mt-0.5 block font-mono text-xs uppercase tracking-wider text-slate-600">{code} · ID {team.id}</span>
                      </span>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-700 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-sky-400" />
                    </Link>
                  );
                })}
          </div>

          {!loading && filteredTeams.length === 0 && (
            <div className="px-6 py-16 text-center">
              <Search className="mx-auto h-6 w-6 text-slate-700" />
              <p className="mt-4 font-medium text-slate-300">No matching team</p>
              <p className="mt-1 text-sm text-slate-600">Try a country name or three-letter code.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
