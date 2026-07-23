import Link from "next/link";
import { ChevronRight, MapPin, Shield, Swords } from "lucide-react";
import { formatTeamName } from "@/lib/country";

export type TeamMatchParticipant = {
  station?: number;
  teamKey?: number | string;
  country?: string;
  countryCode?: string;
};

export type TeamMatchDatum = {
  id: string;
  played?: boolean;
  data?: {
    name?: string;
    field?: number;
    played?: boolean;
    redScore?: number;
    blueScore?: number;
    participants?: TeamMatchParticipant[];
  };
};

function getAlliance(station?: number) {
  if (station && station >= 11 && station <= 13) return "red";
  if (station && station >= 21 && station <= 23) return "blue";
  return undefined;
}

function displayName(participant: TeamMatchParticipant, teamsMap: Record<string, string>) {
  const mapped = teamsMap[String(participant.teamKey ?? "")];
  return mapped ? `Team ${mapped}` : formatTeamName(participant.country, participant.countryCode);
}

export function TeamMatchSummary({
  match,
  teamId,
  teamsMap,
}: {
  match: TeamMatchDatum;
  teamId: string;
  teamsMap: Record<string, string>;
}) {
  const participants = match.data?.participants ?? [];
  const current = participants.find((participant) => String(participant.teamKey) === String(teamId));
  if (!current) return null;

  const currentAlliance = getAlliance(current.station);
  if (!currentAlliance) return null;

  const ownTeams = participants.filter((participant) => getAlliance(participant.station) === currentAlliance);
  const opponentTeams = participants.filter((participant) => {
    const participantAlliance = getAlliance(participant.station);
    return participantAlliance && participantAlliance !== currentAlliance;
  });
  const redScore = match.data?.redScore ?? 0;
  const blueScore = match.data?.blueScore ?? 0;
  const ownScore = currentAlliance === "red" ? redScore : blueScore;
  const opponentScore = currentAlliance === "red" ? blueScore : redScore;
  const played = match.data?.played ?? match.played ?? true;
  const result = !played ? "SCHEDULED" : ownScore === opponentScore ? "TIE" : ownScore > opponentScore ? "WIN" : "LOSS";
  const resultStyle =
    result === "WIN"
      ? "border-emerald-700/60 bg-emerald-500/10 text-emerald-300"
      : result === "LOSS"
        ? "border-rose-800/60 bg-rose-500/10 text-rose-300"
        : result === "TIE"
          ? "border-amber-700/60 bg-amber-500/10 text-amber-300"
          : "border-gray-700 bg-gray-800 text-gray-300";
  const allianceStyle =
    currentAlliance === "red"
      ? "border-red-800/60 bg-red-950/30 text-red-300"
      : "border-blue-800/60 bg-blue-950/30 text-blue-300";

  return (
    <Link
      href={`/match/${match.id}`}
      className="group block border-b border-gray-800 p-5 transition hover:bg-gray-800/45 last:border-b-0"
    >
      <div className="grid gap-5 xl:grid-cols-[13rem_1fr_1fr_9rem] xl:items-center">
        <div>
          <p className="text-lg font-bold text-white">{match.data?.name ?? "Match"}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`rounded-lg border px-2.5 py-1 text-xs font-black tracking-wider ${resultStyle}`}>
              {result}
            </span>
            <span className={`rounded-lg border px-2.5 py-1 text-xs font-semibold uppercase ${allianceStyle}`}>
              {currentAlliance} alliance
            </span>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-sm text-gray-400">
            <MapPin className="h-4 w-4" />
            Field {match.data?.field ?? "—"}
          </p>
        </div>

        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
            <Shield className="h-4 w-4" /> Alliance
          </p>
          <div className="flex flex-wrap gap-2">
            {ownTeams.map((participant) => {
              const isCurrent = String(participant.teamKey) === String(teamId);
              return (
                <span
                  key={`${participant.teamKey}-${participant.station}`}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold ${isCurrent ? (currentAlliance === "red" ? "bg-red-500 text-white" : "bg-blue-500 text-white") : "bg-gray-800 text-gray-200"}`}
                >
                  {displayName(participant, teamsMap)}
                </span>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
            <Swords className="h-4 w-4" /> Opponents
          </p>
          <div className="flex flex-wrap gap-2">
            {opponentTeams.map((participant) => (
              <span key={`${participant.teamKey}-${participant.station}`} className="rounded-xl bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-200">
                {displayName(participant, teamsMap)}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-gray-700 bg-gray-950 px-4 py-4 xl:block xl:text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Alliance score</p>
          <p className="text-3xl font-black text-white xl:mt-2">
            <span className={currentAlliance === "red" ? "text-red-400" : "text-blue-400"}>{ownScore}</span>
            <span className="mx-2 text-gray-700">–</span>
            <span className="text-gray-400">{opponentScore}</span>
          </p>
          <ChevronRight className="h-5 w-5 text-gray-600 transition group-hover:translate-x-1 group-hover:text-sky-400 xl:mx-auto xl:mt-3" />
        </div>
      </div>
    </Link>
  );
}
