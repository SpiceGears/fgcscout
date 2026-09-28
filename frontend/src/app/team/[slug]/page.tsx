"use client";

import { useMemo, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatCountryName, formatTeamName, formatTeamSlug } from "@/lib/country";
import { MatchesTable } from "@/components/match/MatchesTable";
import { getTeamAwards, type AwardPlacement } from "@/constants/EventContent";

type TeamData = { id: string; country?: string; countryCode?: string };
type Schema = { year: number; name?: string };
type MatchParticipant = {
  station?: number;
  teamKey?: number | string;
  id?: number | string;
  country?: string;
  countryCode?: string;
};
type MatchDatum = {
  id: string;
  played?: boolean;
  data?: {
    name?: string;
    field?: number;
    played?: boolean;
    redScore?: number;
    blueScore?: number;
    details?: Record<string, unknown>;
    participants?: MatchParticipant[];
  };
};

const getParticipantAlliance = (station?: number) => {
  if (station === undefined || station === null) return undefined;
  if (station >= 11 && station <= 13) return "red";
  if (station >= 21 && station <= 23) return "blue";
  return undefined;
};

const getTeamAlliance = (participants: MatchParticipant[], teamId: string) => {
  const participant = participants.find(
    (p) => String(p.teamKey) === String(teamId)
  );
  return participant ? getParticipantAlliance(participant.station) : undefined;
};

const AWARD_PLACEMENTS: Record<AwardPlacement, { label: string; color: string }> = {
  gold: { label: "Gold", color: "text-amber-400" },
  silver: { label: "Silver", color: "text-gray-300" },
  bronze: { label: "Bronze", color: "text-orange-400" },
};

export default function TeamPage() {
  const params = useParams();
  const rawSlug = params?.slug;
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
  const router = useRouter();
  const [team, setTeam] = useState<TeamData | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [seasons, setSeasons] = useState<Schema[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [matches, setMatches] = useState<MatchDatum[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

    async function load() {
      try {
        const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
        const [tres, sres, yres] = await Promise.all([
          fetch(`${base}/api/Teams`),
          fetch(`${base}/api/Seasons`),
          fetch(`${base}/api/GameData/years`),
        ]);

        if (!tres.ok) {
          setError("Unable to load team list.");
          return;
        }

        const teamList = (await tres.json()) as TeamData[];
        const foundTeam = teamList.find((t) =>
          formatTeamSlug(t.country, t.countryCode, t.id) === slug
        );

        if (!foundTeam) {
          setError("Team not found.");
          return;
        }

        setTeam(foundTeam);
        setTeamId(foundTeam.id);

        const years: number[] = [];
        if (yres.ok) {
          const data = (await yres.json()) as number[];
          const sortedYears = data.sort((a, b) => b - a);
          setAvailableYears(sortedYears);
          years.push(...sortedYears);
        }

        if (sres.ok) {
          const s = (await sres.json()) as Array<{ year?: number; name?: string }>;
          const mapped = s.map((x) => ({ year: x.year ?? 0, name: x.name })).sort((a, b) => b.year - a.year);
          setSeasons(mapped);
          if (mapped.length > 0) {
            setSelectedSeason(mapped[0].year);
          } else if (years.length > 0) {
            setSelectedSeason(years[0]);
          }
        } else if (years.length > 0) {
          setSelectedSeason(years[0]);
        }
      } catch (e) {
        console.warn(e);
        setError("Unable to load team details.");
      }
    }

    load();
  }, [slug]);

  useEffect(() => {
    if (!selectedSeason || !teamId) return;

    let active = true;
    async function loadMatches() {
      try {
        const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
        const res = await fetch(`${base}/api/GameData/${selectedSeason}`);
        if (!res.ok) return;
        const data = (await res.json()) as MatchDatum[];
        const filtered = data.filter((g) => {
          const parts = g.data?.participants;
          if (!parts) return false;
          return parts.some((p) => String(p?.teamKey) === String(teamId));
        });
        if (active) setMatches(filtered);
      } catch (e) {
        console.warn(e);
      }
    }

    void loadMatches();
    const timer = window.setInterval(() => void loadMatches(), 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedSeason, teamId]);

  const inferredCountry = useMemo(() => {
    if (team?.country || team?.countryCode) return { country: team?.country, countryCode: team?.countryCode };
    for (const match of matches) {
      const participant = match.data?.participants?.find((p) =>
        String(p.teamKey) === String(teamId)
      );
      if (participant) {
        return { country: participant.country, countryCode: participant.countryCode };
      }
    }
    return { country: undefined, countryCode: undefined };
  }, [matches, team, teamId]);

  const record = useMemo(() => {
    let wins = 0;
    let losses = 0;
    let ties = 0;

    if (!teamId) return { wins, losses, ties };

    matches.forEach((match) => {
      const participants = match.data?.participants ?? [];
      const alliance = getTeamAlliance(participants, teamId);
      const redScore = match.data?.redScore ?? 0;
      const blueScore = match.data?.blueScore ?? 0;

      if (redScore === blueScore) {
        ties += 1;
        return;
      }

      const won =
        alliance === "red"
          ? redScore > blueScore
          : alliance === "blue"
          ? blueScore > redScore
          : false;

      if (alliance && won) {
        wins += 1;
      } else if (alliance) {
        losses += 1;
      }
    });

    return { wins, losses, ties };
  }, [matches, teamId]);

  const awards = useMemo(
    () => getTeamAwards(selectedSeason, slug),
    [selectedSeason, slug]
  );

  if (error) {
    return (
      <div className="page-shell">
        <div className="panel mx-auto max-w-4xl p-8">
          <h1 className="text-2xl font-bold mb-4">Team not found</h1>
          <p className="text-gray-300 mb-6">{error}</p>
          <button
            type="button"
            onClick={() => router.push("/teams")}
            className="inline-flex items-center rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400"
          >
            Back to Teams
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="page-shell">
      <div className="page-container max-w-6xl">
        <header className="mb-6 flex flex-col gap-5 border-b border-slate-800 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Team profile</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">
              {formatTeamName(inferredCountry.country, inferredCountry.countryCode)}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Season</span>
            <select className="control px-3 py-2 text-sm" value={selectedSeason ?? undefined} onChange={(e) => setSelectedSeason(Number(e.target.value))}>
              {seasons.length > 0 ? (
                seasons.map((s) => (
                  <option key={s.year} value={s.year}>{s.name ?? s.year}</option>
                ))
              ) : (
                availableYears.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))
              )}
            </select>
          </div>
        </header>

        <div className="space-y-4 sm:space-y-6">
          <section className="panel overflow-hidden">
            <div className="border-b border-slate-800 px-5 py-4">
              <p className="subtle-label">Season snapshot</p>
            </div>
            <ul className="grid divide-y divide-slate-800 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <li className="p-5">
                <span className="subtle-label">Country</span>
                <span className="mt-2 block font-semibold text-slate-100">{formatCountryName(inferredCountry.country, inferredCountry.countryCode)}</span>
              </li>
              <li className="p-5">
                <span className="subtle-label">Matches played</span>
                <span className="mt-2 block font-mono text-2xl font-semibold text-white">{matches.length}</span>
              </li>
              <li className="p-5">
                <span className="subtle-label">Record</span>
                <span className="mt-2 block font-mono text-2xl font-semibold text-white">{record.wins}-{record.losses}-{record.ties}</span>
              </li>
            </ul>
          </section>

          {awards.length > 0 && (
            <section className="panel overflow-hidden">
              <div className="border-b border-gray-800 px-5 py-4 sm:px-6">
                <h2 className="text-lg font-semibold text-white">Awards</h2>
              </div>

              <div className="divide-y divide-gray-800">
                {awards.map((teamAward) => {
                  const placement = AWARD_PLACEMENTS[teamAward.placement];
                  return (
                    <article
                      key={`${teamAward.name}-${teamAward.placement}`}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_7rem] sm:px-6"
                    >
                      <h3 className="min-w-0 text-sm font-medium leading-5 text-gray-200 sm:text-base">
                        {teamAward.name}
                      </h3>
                      <div className="text-right">
                        <span className={`text-xs font-semibold uppercase tracking-[0.12em] ${placement.color}`}>
                          {placement.label}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          <section>
            <div className="mb-3">
              <div>
                <h2 className="text-2xl font-bold text-white">Matches</h2>
                <p className="text-sm text-gray-400 mt-1">{matches.length} played matches</p>
              </div>
            </div>

            {teamId && matches.length > 0 && <MatchesTable matches={matches} currentTeamId={teamId} />}
            {matches.length === 0 && (
              <div className="panel p-8 text-center text-gray-400">No matches found for this team in the selected season.</div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
