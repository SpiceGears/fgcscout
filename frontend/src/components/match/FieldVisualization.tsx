import Link from "next/link";
import { formatTeamName, formatTeamSlug } from "@/lib/country";

type Participant = {
  station?: number;
  teamKey?: number | string;
  id?: number | string;
  country?: string;
  countryCode?: string;
};

type FieldVisualizationProps = {
  details?: Record<string, unknown>;
  redTeams: Participant[];
  blueTeams: Participant[];
};

const ROBOT_SUFFIXES = ["One", "Two", "Three"];
const LEVELS = new Map([
  [0, "L0"],
  [0.125, "L1"],
  [0.25, "L2"],
  [0.375, "L3"],
  [0.5, "L4"],
]);

function numberValue(details: Record<string, unknown> | undefined, key: string) {
  const value = details?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function displayValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function Ecosystem({
  className,
  label,
  units,
  approximate,
}: {
  className: string;
  label: string;
  units: number;
  approximate: number;
}) {
  return (
    <div className={`absolute z-20 flex aspect-square w-[15%] items-center justify-center border-2 border-gray-700 bg-gray-800 text-center text-white shadow-sm ${className}`}>
      <div className="min-w-0 px-1">
        <span className="block truncate text-[clamp(7px,1vw,12px)] font-bold uppercase tracking-wide text-gray-300">{label}</span>
        <strong className="block font-mono text-[clamp(17px,2.5vw,32px)] leading-none">{displayValue(units)}</strong>
        <span className="block text-[clamp(7px,0.85vw,11px)] text-gray-300">units · approx. {displayValue(approximate)}</span>
      </div>
    </div>
  );
}

function AllianceStation({
  alliance,
  teams,
  details,
}: {
  alliance: "red" | "blue";
  teams: Participant[];
  details?: Record<string, unknown>;
}) {
  const isRed = alliance === "red";
  const multiplier = numberValue(details, `${alliance}ProtectionMultiplier`) || 1;
  const orderedTeams = [...teams].sort((left, right) => (left.station ?? 0) - (right.station ?? 0));

  return (
    <div className={`absolute bottom-[8%] z-30 w-[23%] overflow-hidden border-2 text-white ${isRed ? "left-[2%] border-red-700 bg-red-950/95" : "right-[2%] border-blue-700 bg-blue-950/95"}`}>
      <div className={`flex items-center justify-between px-[5%] py-[3%] ${isRed ? "bg-red-700" : "bg-blue-700"}`}>
        <span className="text-[clamp(7px,0.9vw,11px)] font-bold uppercase">{alliance} station</span>
        <strong className="font-mono text-[clamp(8px,1.1vw,13px)]">{displayValue(multiplier)}×</strong>
      </div>
      {ROBOT_SUFFIXES.map((suffix, index) => {
        const team = orderedTeams[index];
        const increment = numberValue(details, `${alliance}Robot${suffix}Parking`);
        const level = LEVELS.get(increment) ?? displayValue(increment);
        const id = String(team?.teamKey ?? team?.id ?? "");
        return (
          <div key={suffix} className="flex min-w-0 items-center justify-between gap-1 border-t border-white/15 px-[5%] py-[2.5%]">
            {team ? (
              <Link href={`/team/${formatTeamSlug(team.country, team.countryCode, id)}`} title={formatTeamName(team.country, team.countryCode)} className="min-w-0 truncate text-[clamp(7px,1.1vw,13px)] font-semibold hover:underline">
                {formatTeamName(team.country, team.countryCode).replace(/^Team\s+/i, "")}
              </Link>
            ) : <span className="text-[clamp(7px,1.1vw,13px)] text-white/40">Robot {index + 1}</span>}
            <span className="shrink-0 font-mono text-[clamp(8px,1.1vw,13px)] font-bold">{level}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function FieldVisualization({ details, redTeams, blueTeams }: FieldVisualizationProps) {
  const barriersRed = numberValue(details, "barriersInRedMitigator");
  const barriersBlue = numberValue(details, "barriersInBlueMitigator");
  const biodiversityRed = numberValue(details, "biodiversityUnitsRedSideEcosystem");
  const biodiversityCenter = numberValue(details, "biodiversityUnitsCenterEcosystem");
  const biodiversityBlue = numberValue(details, "biodiversityUnitsBlueSideEcosystem");
  const totalBiodiversity = biodiversityRed + biodiversityCenter + biodiversityBlue;
  const distributionFactor = numberValue(details, "biodiversityDistributionFactor");
  const distributed = numberValue(details, "biodiversityDistributed") || totalBiodiversity * distributionFactor;
  const coopertition = numberValue(details, "coopertition");

  return (
    <section className="mx-auto mt-7 max-w-4xl overflow-hidden rounded-xl border border-gray-700 bg-gray-900">
      <div className="border-b border-gray-700 px-4 py-3 sm:px-5">
        <h2 className="text-lg font-semibold text-white">Field</h2>
        <p className="mt-0.5 text-xs text-gray-500">Eco Equilibrium · top view</p>
      </div>

      <div className="p-2 sm:p-4">
        <div className="relative aspect-[7/4] w-full overflow-hidden border-[clamp(4px,0.8vw,9px)] border-gray-600 bg-[#d8d8d4] text-gray-950">
          <div className="absolute inset-y-0 left-1/2 border-l border-dashed border-gray-500/50" />

          {/* Physical ropes: center-to-red, center-to-blue and red-to-blue. */}
          <svg viewBox="0 0 700 400" preserveAspectRatio="none" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full">
            <line x1="350" y1="140" x2="256" y2="280" stroke="#374151" strokeWidth="9" />
            <line x1="350" y1="140" x2="444" y2="280" stroke="#374151" strokeWidth="9" />
            <line x1="256" y1="280" x2="444" y2="280" stroke="#374151" strokeWidth="9" />
          </svg>

          {/* Mitigators. */}
          <div className="absolute left-[2%] top-0 z-20 flex h-[16%] w-[21%] items-center justify-center border-2 border-gray-700 bg-gray-800 text-center text-white">
            <div><span className="block text-[clamp(7px,1vw,12px)] font-bold uppercase text-gray-300">Red mitigator</span><strong className="font-mono text-[clamp(18px,2.8vw,34px)] leading-none">{displayValue(barriersRed)}</strong><span className="block text-[clamp(7px,0.9vw,11px)] text-gray-300">barriers</span></div>
          </div>
          <div className="absolute right-[2%] top-0 z-20 flex h-[16%] w-[21%] items-center justify-center border-2 border-gray-700 bg-gray-800 text-center text-white">
            <div><span className="block text-[clamp(7px,1vw,12px)] font-bold uppercase text-gray-300">Blue mitigator</span><strong className="font-mono text-[clamp(18px,2.8vw,34px)] leading-none">{displayValue(barriersBlue)}</strong><span className="block text-[clamp(7px,0.9vw,11px)] text-gray-300">barriers</span></div>
          </div>

          <Ecosystem className="left-[42.5%] top-[22%]" label="Center ecosystem" units={biodiversityCenter} approximate={numberValue(details, "approximateBiodiversityCenterEcosystem")} />
          <Ecosystem className="left-[29%] top-[57%]" label="Red ecosystem" units={biodiversityRed} approximate={numberValue(details, "approximateBiodiversityRedSideEcosystem")} />
          <Ecosystem className="right-[29%] top-[57%]" label="Blue ecosystem" units={biodiversityBlue} approximate={numberValue(details, "approximateBiodiversityBlueSideEcosystem")} />

          <AllianceStation alliance="red" teams={redTeams} details={details} />
          <AllianceStation alliance="blue" teams={blueTeams} details={details} />

          <div className="absolute bottom-[2%] left-1/2 z-40 grid w-[44%] -translate-x-1/2 grid-cols-3 divide-x divide-gray-700 border-2 border-gray-700 bg-gray-900 text-center text-white">
            <div className="px-1 py-[2%]"><span className="block text-[clamp(6px,0.8vw,10px)] uppercase text-gray-400">Distribution</span><strong className="font-mono text-[clamp(9px,1.4vw,17px)]">{displayValue(distributionFactor)}×</strong></div>
            <div className="px-1 py-[2%]"><span className="block text-[clamp(6px,0.8vw,10px)] uppercase text-gray-400">Biodiversity</span><strong className="font-mono text-[clamp(9px,1.4vw,17px)]">{displayValue(distributed)} pts</strong></div>
            <div className="px-1 py-[2%]"><span className="block text-[clamp(6px,0.8vw,10px)] uppercase text-gray-400">Coopertition</span><strong className="font-mono text-[clamp(9px,1.4vw,17px)]">+{displayValue(coopertition)}</strong></div>
          </div>
        </div>
      </div>
    </section>
  );
}
