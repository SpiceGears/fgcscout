import Link from "next/link";
import { formatTeamName, formatTeamSlug } from "@/lib/country";

export type MatchTableParticipant = {
  station?: number;
  teamKey?: number | string;
  id?: number | string;
  country?: string;
  countryCode?: string;
};

export type MatchTableItem = {
  id: string;
  year?: number;
  played?: boolean;
  data?: {
    id?: number | string;
    name?: string;
    eventKey?: string;
    scheduledTime?: string;
    redScore?: number;
    blueScore?: number;
    field?: number;
    played?: boolean;
    participants?: MatchTableParticipant[];
  };
};

function shortMatchName(match: MatchTableItem) {
  const name = match.data?.name ?? "";
  const number = name.match(/(\d+)(?!.*\d)/)?.[1] ?? match.data?.id ?? "?";
  if (/round robin/i.test(name)) return `RR-${number}`;
  if (/final/i.test(name)) return `F-${number}`;
  if (/qualification/i.test(name)) return `Q-${number}`;
  if (/ranking/i.test(name)) return `R-${number}`;
  return `M-${number}`;
}

function allianceTeams(match: MatchTableItem, firstStation: number) {
  const participants = match.data?.participants ?? [];
  return [0, 1, 2].map((offset) =>
    participants.find((participant) => participant.station === firstStation + offset)
  );
}

function AllianceTeamCell({
  participant,
  alliance,
  currentTeamId,
}: {
  participant?: MatchTableParticipant;
  alliance: "red" | "blue";
  currentTeamId?: string | null;
}) {
  const isCurrent = participant && currentTeamId != null && String(participant.teamKey) === String(currentTeamId);
  const colors = isCurrent
    ? alliance === "red"
      ? "border-red-800 bg-red-700 hover:bg-red-600"
      : "border-blue-800 bg-blue-700 hover:bg-blue-600"
    : alliance === "red"
      ? "border-red-900/50 bg-red-950/60 hover:bg-red-900/65"
      : "border-blue-900/50 bg-blue-950/60 hover:bg-blue-900/65";

  if (!participant) return <td className={`border-l p-0 ${colors}`} />;

  const name = formatTeamName(participant.country, participant.countryCode).replace(/^Team\s+/i, "");
  return (
    <td className={`min-w-0 border-l p-0 transition-colors ${colors}`}>
      <Link
        href={`/team/${formatTeamSlug(participant.country, participant.countryCode, String(participant.teamKey ?? ""))}`}
        title={name}
        className="block min-w-0 overflow-hidden px-1 py-2 sm:px-2"
      >
        <span className="block truncate text-[9px] font-medium italic leading-4 text-gray-200 sm:text-[11px] md:text-xs">
          {name}
        </span>
      </Link>
    </td>
  );
}

export function MatchesTable({
  matches,
  currentTeamId,
  className = "",
}: {
  matches: MatchTableItem[];
  currentTeamId?: string | null;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-lg ${className}`}>
      <table className="w-full table-fixed border-collapse text-left">
        <colgroup>
          <col className="w-[9%]" />
          <col className="w-[13%]" />
          {[0, 1, 2, 3, 4, 5].map((column) => <col key={column} className="w-[13%]" />)}
        </colgroup>
        <thead>
          <tr className="text-[10px] font-semibold text-white sm:text-xs">
            <th className="bg-gray-800 px-1 py-2 sm:px-2 sm:py-3">Match</th>
            <th className="bg-gray-800 px-1 py-2 text-center sm:px-2 sm:py-3">Score</th>
            <th colSpan={3} className="bg-red-700 px-1 py-2 text-center sm:px-2 sm:py-3">
              <span className="sm:hidden">Red</span><span className="hidden sm:inline">Red Alliance</span>
            </th>
            <th colSpan={3} className="bg-blue-700 px-1 py-2 text-center sm:px-2 sm:py-3">
              <span className="sm:hidden">Blue</span><span className="hidden sm:inline">Blue Alliance</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {matches.map((match) => {
            const red = allianceTeams(match, 11);
            const blue = allianceTeams(match, 21);
            const played = (match.data?.played ?? match.played) !== false;
            const redScore = match.data?.redScore ?? 0;
            const blueScore = match.data?.blueScore ?? 0;
            return (
              <tr key={match.id} className="border-t border-gray-700 first:border-t-0">
                <td className="min-w-0 bg-gray-800/90 px-1 py-2 sm:px-2">
                  <Link
                    href={`/match/${match.id}`}
                    className={`block truncate font-mono text-[9px] font-bold hover:underline sm:text-xs ${played && redScore > blueScore ? "text-red-400" : played && blueScore > redScore ? "text-sky-400" : "text-gray-200"}`}
                  >
                    {shortMatchName(match)}
                  </Link>
                </td>
                <td className="min-w-0 bg-gray-800/90 px-0.5 py-2 text-center sm:px-2">
                  <Link href={`/match/${match.id}`} className="block truncate whitespace-nowrap font-mono text-[9px] font-semibold text-gray-300 hover:text-white sm:text-xs">
                    {played ? <><span className={redScore > blueScore ? "text-red-400" : ""}>{redScore}</span><span className="mx-0.5 text-gray-600 sm:mx-1">–</span><span className={blueScore > redScore ? "text-sky-400" : ""}>{blueScore}</span></> : <span className="font-sans text-amber-300" title="Not played yet">Scheduled</span>}
                  </Link>
                </td>
                {red.map((participant, index) => <AllianceTeamCell key={`red-${match.id}-${index}`} participant={participant} alliance="red" currentTeamId={currentTeamId} />)}
                {blue.map((participant, index) => <AllianceTeamCell key={`blue-${match.id}-${index}`} participant={participant} alliance="blue" currentTeamId={currentTeamId} />)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
