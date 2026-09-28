"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, Database, Radio, Swords, Users } from "lucide-react";
import SearchBar from "@/components/ui/Search";
import { useEffect, useState } from "react";

type Season = {
  year: number;
  name?: string;
  matchCount?: number;
  live?: boolean;
  lastSyncAt?: string;
};
type HomeStats = { teams: number; matches: number };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function Home() {
  const router = useRouter();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [stats, setStats] = useState<HomeStats>({ teams: 0, matches: 0 });

  useEffect(() => {
    async function load() {
      try {
        const [seasonsResponse, teamsResponse] = await Promise.all([
          fetch(`${API_URL}/api/Seasons`, { cache: "no-store" }),
          fetch(`${API_URL}/api/Teams`),
        ]);

        const seasonData = seasonsResponse.ok ? (await seasonsResponse.json()) as Season[] : [];
        const sortedSeasons = [...seasonData].sort((a, b) => b.year - a.year);
        setSeasons(sortedSeasons);

        const teams = teamsResponse.ok ? (await teamsResponse.json()) as unknown[] : [];
        setStats({ teams: teams.length, matches: sortedSeasons[0]?.matchCount ?? 0 });
      } catch (error) {
        console.warn("Failed to load overview", error);
      }
    }
    load();
    const interval = window.setInterval(load, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const latestSeason = seasons[0];
  const latestYear = latestSeason?.year;

  return (
    <main className="page-shell">
      <div className="page-container">
        <section className="grid min-h-[460px] items-center gap-12 border-b border-slate-800 py-12 lg:grid-cols-[1.2fr_0.8fr] lg:py-16">
          <div>
            <p className="eyebrow">FIRST Global match intelligence</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.04em] text-white sm:text-6xl">
              The competition,<br />
              <span className="text-slate-500">made searchable.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-400 sm:text-lg">
              Match results, official rankings, awards and team history from the FIRST Global Challenge — in one focused workspace.
            </p>

            <div className="mt-8 flex max-w-xl flex-col gap-3 sm:flex-row">
              <div className="sm:flex-1 [&>div]:h-11 [&>div]:w-full">
                <SearchBar onSearch={(query) => query && router.push(`/search?q=${encodeURIComponent(query)}`)} placeholder="Search teams and matches…" />
              </div>
              <Link href="/events" className="inline-flex h-11 items-center justify-center gap-2 rounded-[0.625rem] bg-sky-600 px-5 text-sm font-bold text-white transition hover:bg-sky-500">
                Open {latestYear ?? "latest"} event <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="panel overflow-hidden">
            <div className="border-b border-slate-800 px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="subtle-label">Dataset status</p>
                  <p className="mt-1 font-semibold text-slate-200">{latestYear ? `${latestYear} season` : "Waiting for data"}</p>
                </div>
                <span className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/8 px-3 py-1 text-xs font-semibold text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {latestSeason?.live ? "Live sync" : "Available"}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-slate-800">
              <div className="p-5">
                <Users className="h-4 w-4 text-sky-400" />
                <p className="mt-5 font-mono text-3xl font-semibold text-white">{stats.teams || "—"}</p>
                <p className="mt-1 text-sm text-slate-500">national teams</p>
              </div>
              <div className="p-5">
                <Swords className="h-4 w-4 text-sky-400" />
                <p className="mt-5 font-mono text-3xl font-semibold text-white">{stats.matches || "—"}</p>
                <p className="mt-1 text-sm text-slate-500">recorded matches</p>
              </div>
            </div>
            <Link href="/matches" className="flex items-center justify-between border-t border-slate-800 px-5 py-4 text-sm font-medium text-slate-400 transition hover:bg-slate-800/40 hover:text-white">
              Browse the full match archive <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="grid gap-px overflow-hidden border-x border-b border-slate-800 bg-slate-800 md:grid-cols-3">
          {[
            { href: "/events", icon: CalendarDays, title: "Event center", copy: "Results, rankings, awards and season statistics." },
            { href: "/teams", icon: Users, title: "Team directory", copy: "Find a country and review its complete competition record." },
            { href: "/matches", icon: Radio, title: "Match archive", copy: "Open score breakdowns, participants and field data." },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="group bg-gray-950 p-6 transition hover:bg-gray-900">
              <item.icon className="h-5 w-5 text-slate-500 transition group-hover:text-sky-400" />
              <h2 className="mt-8 font-semibold text-slate-100">{item.title}</h2>
              <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">{item.copy}</p>
              <ArrowRight className="mt-6 h-4 w-4 text-slate-700 transition group-hover:translate-x-1 group-hover:text-sky-400" />
            </Link>
          ))}
        </section>

        <section className="flex flex-col gap-5 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="subtle-label">Available seasons</p>
            <p className="mt-2 text-sm text-slate-500">Imported competition datasets ready to explore.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {seasons.map((season) => (
              <Link key={season.year} href="/events" className="inline-flex items-center gap-2 rounded-md border border-gray-800 bg-gray-900 px-3 py-2 text-sm font-medium text-gray-300 transition hover:border-sky-600 hover:text-sky-300">
                <Database className="h-3.5 w-3.5 text-slate-600" />
                {season.name ?? season.year}
              </Link>
            ))}
            {seasons.length === 0 && <span className="text-sm text-slate-600">No seasons imported</span>}
          </div>
        </section>
      </div>
    </main>
  );
}
