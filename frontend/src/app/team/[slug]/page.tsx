"use client";

import { useMemo, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatCountryName, formatTeamName, formatTeamSlug } from "@/lib/country";
import { TeamMatchSummary } from "@/components/team/TeamMatchSummary";

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
  const [teamsMap, setTeamsMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!slug) return;

    async function load() {
      try {
        const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
        const [tres, sres, yres] = await Promise.all([
          fetch(`${base}/api/Teams`),
          fetch(`${base}/api/GameSchema`),
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
          const sortedYears = data.sort((a, b) => a - b);
          setAvailableYears(sortedYears);
          years.push(...sortedYears);
        }

        if (sres.ok) {
          const s = (await sres.json()) as Array<{ Year?: number; year?: number; Name?: string; name?: string }>;
          const mapped = s.map((x) => ({ year: x.Year ?? x.year ?? 0, name: x.Name ?? x.name }));
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
      async function loadTeams() {
        try {
          const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
          const res = await fetch(`${base}/api/Teams`);
          if (!res.ok) return;
          const list = await res.json();
          const m: Record<string, string> = {};
          for (const t of list) {
            const id = String(t.id ?? t.Id ?? "");
            const label = formatCountryName(t.country, t.countryCode) || id;
            if (id) m[id] = label;
          }
          setTeamsMap(m);
        } catch (e) {
          console.warn("Failed to load teams map", e);
        }
      }
      loadTeams();
    }, []);

  useEffect(() => {
    if (!selectedSeason || !teamId) return;

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
        setMatches(filtered);
      } catch (e) {
        console.warn(e);
      }
    }

    loadMatches();
  }, [selectedSeason, teamId]);

  const selectedLabel = useMemo(() => {
    const found = seasons.find((s) => s.year === selectedSeason);
    return found ? found.name ?? found.year : selectedSeason;
  }, [selectedSeason, seasons]);

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

  if (error) {
    return (
      <div className="bg-gray-950 min-h-screen w-full text-white px-4 py-8">
        <div className="mx-auto max-w-4xl bg-gray-900 border border-gray-700 rounded-3xl shadow-xl p-8">
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
    <div className="bg-gray-950 min-h-screen w-full">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-50">
            {formatTeamName(inferredCountry.country, inferredCountry.countryCode)}
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-gray-300 text-sm sm:text-base">Season:</span>
            <select className="bg-gray-800 text-gray-200 px-3 py-2 rounded" value={selectedSeason ?? undefined} onChange={(e) => setSelectedSeason(Number(e.target.value))}>
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
        </div>

        <div className="space-y-4 sm:space-y-6">
          <div className="bg-gray-900 border border-gray-600 rounded-lg shadow-lg p-4 sm:p-6">
            <p className="text-lg sm:text-xl font-bold text-gray-100 mb-4">Stats {selectedLabel ? `— ${selectedLabel}` : ""}</p>
            <ul className="divide-y divide-gray-700 rounded-lg overflow-hidden bg-gray-900">
              <li className="flex items-center justify-between gap-4 p-4">
                <span className="text-gray-200">Country</span>
                <span className="font-semibold text-gray-100">{formatCountryName(inferredCountry.country, inferredCountry.countryCode)}</span>
              </li>
              <li className="flex items-center justify-between gap-4 p-4">
                <span className="text-gray-200">Country code</span>
                <span className="font-semibold text-gray-100">{(inferredCountry.countryCode ?? inferredCountry.country ?? "Unknown").toString().toUpperCase()}</span>
              </li>
              <li className="flex items-center justify-between gap-4 p-4">
                <span className="text-gray-200">Matches played</span>
                <span className="font-semibold text-gray-100">{matches.length}</span>
              </li>
              <li className="flex items-center justify-between gap-4 p-4">
                <span className="text-gray-200">Record</span>
                <span className="font-semibold text-gray-100">{record.wins}-{record.losses}-{record.ties}</span>
              </li>
            </ul>
          </div>

          <div className="bg-[#111827] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <div>
                <h2 className="text-2xl font-bold text-white">Matches</h2>
                <p className="text-sm text-gray-400 mt-1">{matches.length} played matches</p>
              </div>

              <div className="bg-gray-800 px-4 py-2 rounded-xl border border-gray-700">
                <span className="text-sm text-gray-300">Record</span>
                <p className="text-lg font-bold text-white">{record.wins}-{record.losses}-{record.ties}</p>
              </div>
            </div>

            <div>
              {teamId && matches.map((match) => (
                <TeamMatchSummary
                  key={match.id}
                  match={match}
                  teamId={teamId}
                  teamsMap={teamsMap}
                />
              ))}
              {matches.length === 0 && (
                <p className="p-8 text-center text-gray-400">No matches found for this team in the selected season.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
