"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatCountryName, formatTeamCountryLabel, formatTeamName, formatTeamSlug } from "@/lib/country";

type Team = { id: string; country?: string; countryCode?: string };

export default function Teams() {
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
        const res = await fetch(`${base}/api/Teams`);
        if (!res.ok) return;
        const data = (await res.json()) as Team[];
        const sorted = data.sort((a, b) => {
          const aName = formatCountryName(a.country, a.countryCode);
          const bName = formatCountryName(b.country, b.countryCode);
          const compare = aName.localeCompare(bName, undefined, { sensitivity: "base" });
          return compare !== 0 ? compare : a.id.localeCompare(b.id, undefined, { numeric: true });
        });
        setTeams(sorted);
      } catch (e) {
        console.warn(e);
      }
    }
    load();
  }, []);

  return (
    <div className="bg-gray-950 min-h-screen w-full flex flex-col p-8">
      <h1 className="text-3xl font-bold text-gray-50 text-center mb-6">Teams</h1>
      <div className="flex-grow flex flex-col">
        <div className="bg-gray-800 border border-gray-600 rounded-lg shadow-lg p-6 w-full max-w-6xl mx-auto flex-grow flex flex-col">
          <h3 className="text-xl font-bold text-gray-50 mb-2">Search</h3>
          <div className="relative mb-6">
            <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              className="bg-gray-900 w-full pl-10 pr-4 py-2 text-gray-50 border border-gray-700 rounded-lg focus:outline-none focus:border-gray-500"
              placeholder="Search for teams"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {teams.map((team) => {
              const countryCode = (team.countryCode?.trim().toUpperCase() ?? team.country?.trim().toUpperCase() ?? "");
              return (
                <div key={team.id} className="bg-gray-800 hover:bg-gray-700 p-4 rounded-lg">
                  <Link href={`/team/${formatTeamSlug(team.country, team.countryCode, team.id)}`} className="block">
                    <h4 className="text-lg font-semibold text-gray-100">
                      {formatTeamName(team.country, team.countryCode)}
                    </h4>
                    <div className="text-sm text-gray-400">
                      {countryCode || formatTeamCountryLabel(team.country, team.countryCode)}
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>

          <div className="flex-grow"></div>
        </div>
      </div>
    </div>
  );
}
