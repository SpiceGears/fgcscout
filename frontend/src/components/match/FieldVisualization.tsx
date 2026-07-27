"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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

type EcosystemId = "red" | "center" | "blue";

type Selection =
  | {
      kind: "ecosystem";
      id: EcosystemId;
    }
  | {
      kind: "robot";
      alliance: "red" | "blue";
      index: number;
    };

const LEVELS = new Map([
  [0, { level: 0, label: "Field surface" }],
  [0.125, { level: 1, label: "Level 1" }],
  [0.25, { level: 2, label: "Level 2" }],
  [0.375, { level: 3, label: "Level 3" }],
  [0.5, { level: 4, label: "Level 4" }],
]);

function numberValue(
  details: Record<string, unknown> | undefined,
  key: string,
) {
  const value = details?.[key];

  return typeof value === "number" && Number.isFinite(value)
    ? value
    : 0;
}

function shortTeamLabel(team?: Participant) {
  const country = team?.country?.trim();

  if (country && country.length <= 4) {
    return country.toUpperCase();
  }

  return team?.countryCode?.toUpperCase() ?? "—";
}

function fullTeamName(team?: Participant) {
  if (!team) {
    return "Unknown team";
  }

  return formatTeamName(team.country, team.countryCode);
}

function protectionInfo(value: number) {
  return (
    LEVELS.get(value) ?? {
      level: 0,
      label: `Recorded: ${value}`,
    }
  );
}

export default function FieldVisualization({
  details,
  redTeams,
  blueTeams,
}: FieldVisualizationProps) {
  const [selection, setSelection] = useState<Selection>({
    kind: "ecosystem",
    id: "center",
  });

  const ecosystems = useMemo(
    () => [
      {
        id: "red" as const,
        label: "Red-side Ecosystem",
        units: numberValue(
          details,
          "biodiversityUnitsRedSideEcosystem",
        ),
        approximate: numberValue(
          details,
          "approximateBiodiversityRedSideEcosystem",
        ),
        x: 325,
        y: 445,
        points:
          "270,414 325,380 382,413 380,475 316,505 270,455",
      },
      {
        id: "center" as const,
        label: "Center Ecosystem",
        units: numberValue(
          details,
          "biodiversityUnitsCenterEcosystem",
        ),
        approximate: numberValue(
          details,
          "approximateBiodiversityCenterEcosystem",
        ),
        x: 450,
        y: 225,
        points: "400,180 500,180 500,270 400,270",
      },
      {
        id: "blue" as const,
        label: "Blue-side Ecosystem",
        units: numberValue(
          details,
          "biodiversityUnitsBlueSideEcosystem",
        ),
        approximate: numberValue(
          details,
          "approximateBiodiversityBlueSideEcosystem",
        ),
        x: 575,
        y: 445,
        points:
          "518,413 575,380 630,414 630,455 584,505 520,475",
      },
    ],
    [details],
  );

  const robots = useMemo(() => {
    const suffixes = ["One", "Two", "Three"];

    return [
      ...redTeams.slice(0, 3).map((team, index) => {
        const increment = numberValue(
          details,
          `redRobot${suffixes[index]}Parking`,
        );

        return {
          alliance: "red" as const,
          team,
          index,
          increment,
        };
      }),

      ...blueTeams.slice(0, 3).map((team, index) => {
        const increment = numberValue(
          details,
          `blueRobot${suffixes[index]}Parking`,
        );

        return {
          alliance: "blue" as const,
          team,
          index,
          increment,
        };
      }),
    ];
  }, [blueTeams, details, redTeams]);

  const selectedEcosystem =
    selection.kind === "ecosystem"
      ? ecosystems.find(
          (ecosystem) => ecosystem.id === selection.id,
        )
      : undefined;

  const selectedRobot =
    selection.kind === "robot"
      ? robots.find(
          (robot) =>
            robot.alliance === selection.alliance &&
            robot.index === selection.index,
        )
      : undefined;

  return (
    <section className="mt-7 overflow-hidden rounded-2xl border border-gray-700 bg-gray-900 shadow-xl">
      <div className="border-b border-gray-800 px-5 py-4">
        <h2 className="text-xl font-semibold">
          Interactive Field Map
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Select an ecosystem or robot to inspect its match data.
        </p>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="min-w-0 bg-white p-3 sm:p-5">
          <svg
            viewBox="0 0 900 620"
            className="h-auto w-full"
            role="img"
            aria-label="Interactive Eco Equilibrium field"
          >
            <defs>
              <linearGradient
                id="fieldFloor"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor="#e3e3e3" />
                <stop offset="100%" stopColor="#cccccc" />
              </linearGradient>

              <filter id="fieldGlow">
                <feGaussianBlur
                  stdDeviation="5"
                  result="blur"
                />

                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Field surface and guardrails */}
            <rect
              x="75"
              y="75"
              width="750"
              height="500"
              fill="url(#fieldFloor)"
              stroke="#7b7b7b"
              strokeWidth="20"
            />

            {/* Mitigators */}
            <rect
              x="94"
              y="33"
              width="145"
              height="82"
              fill="#282828"
            />

            <rect
              x="661"
              y="33"
              width="145"
              height="82"
              fill="#282828"
            />

            {/* Dispensers */}
            <circle
              cx="382"
              cy="57"
              r="52"
              fill="#282828"
            />

            <circle
              cx="518"
              cy="57"
              r="52"
              fill="#282828"
            />

            {/* Accelerators */}
            <rect
              x="76"
              y="525"
              width="58"
              height="50"
              fill="#282828"
            />

            <rect
              x="766"
              y="525"
              width="58"
              height="50"
              fill="#282828"
            />

            {/* Ecosystem connecting bars */}
            <line
              x1="450"
              y1="245"
              x2="330"
              y2="442"
              stroke="#282828"
              strokeWidth="12"
            />

            <line
              x1="450"
              y1="245"
              x2="570"
              y2="442"
              stroke="#282828"
              strokeWidth="12"
            />

            <line
              x1="330"
              y1="442"
              x2="570"
              y2="442"
              stroke="#282828"
              strokeWidth="12"
            />

            {/* Interactive ecosystems */}
            {ecosystems.map((ecosystem) => {
              const active =
                selection.kind === "ecosystem" &&
                selection.id === ecosystem.id;

              const visibleUnits = Math.min(
                12,
                Math.max(0, Math.round(ecosystem.units)),
              );

              return (
                <g
                  key={ecosystem.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${ecosystem.label}: ${ecosystem.units} Biodiversity Units`}
                  className="cursor-pointer outline-none"
                  onMouseEnter={() =>
                    setSelection({
                      kind: "ecosystem",
                      id: ecosystem.id,
                    })
                  }
                  onClick={() =>
                    setSelection({
                      kind: "ecosystem",
                      id: ecosystem.id,
                    })
                  }
                  onFocus={() =>
                    setSelection({
                      kind: "ecosystem",
                      id: ecosystem.id,
                    })
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" ||
                      event.key === " "
                    ) {
                      setSelection({
                        kind: "ecosystem",
                        id: ecosystem.id,
                      });
                    }
                  }}
                >
                  <polygon
                    points={ecosystem.points}
                    fill={active ? "#365314" : "#282828"}
                    stroke={
                      active ? "#a3e635" : "#282828"
                    }
                    strokeWidth={active ? 7 : 2}
                    filter={
                      active
                        ? "url(#fieldGlow)"
                        : undefined
                    }
                  />

                  {Array.from({
                    length: visibleUnits,
                  }).map((_, index) => {
                    const column = index % 4;
                    const row = Math.floor(index / 4);

                    return (
                      <circle
                        key={index}
                        cx={
                          ecosystem.x -
                          27 +
                          column * 18
                        }
                        cy={
                          ecosystem.y -
                          20 +
                          row * 18
                        }
                        r="6"
                        fill="#bef264"
                        stroke="#365314"
                        strokeWidth="2"
                      />
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>

        <aside className="border-t border-gray-800 bg-gray-900 p-5 lg:border-l lg:border-t-0">
          {selectedEcosystem && (
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-lime-400">
                Ecosystem
              </p>

              <h3 className="mt-2 text-lg font-bold">
                {selectedEcosystem.label}
              </h3>

              <p className="mt-5 text-5xl font-black text-lime-300">
                {selectedEcosystem.units}
              </p>

              <p className="mt-1 text-sm text-gray-400">
                Biodiversity Units added in this match
              </p>

              <div className="mt-5 rounded-xl border border-gray-700 bg-gray-950 p-4">
                <p className="text-xs uppercase tracking-wider text-gray-500">
                  Approximate ecosystem level
                </p>

                <p className="mt-1 text-2xl font-bold">
                  {selectedEcosystem.approximate}
                </p>
              </div>
            </div>
          )}

          {selectedRobot &&
            (() => {
              const info = protectionInfo(
                selectedRobot.increment,
              );

              const teamId = String(
                selectedRobot.team.teamKey ??
                  selectedRobot.team.id ??
                  "",
              );

              const slug = formatTeamSlug(
                selectedRobot.team.country,
                selectedRobot.team.countryCode,
                teamId,
              );

              return (
                <div>
                  <p
                    className={`text-xs font-bold uppercase tracking-[0.2em] ${
                      selectedRobot.alliance === "red"
                        ? "text-red-400"
                        : "text-blue-400"
                    }`}
                  >
                    {selectedRobot.alliance} alliance robot{" "}
                    {selectedRobot.index + 1}
                  </p>

                  <Link
                    href={`/team/${slug}`}
                    className="mt-2 block text-lg font-bold transition hover:text-sky-300 hover:underline"
                  >
                    {fullTeamName(selectedRobot.team)}
                  </Link>

                  <p className="mt-5 text-5xl font-black">
                    {info.level}
                  </p>

                  <p className="mt-1 text-sm text-gray-400">
                    Protection Level
                  </p>

                  <div className="mt-5 rounded-xl border border-gray-700 bg-gray-950 p-4">
                    <p className="text-xs uppercase tracking-wider text-gray-500">
                      Multiplier increment
                    </p>

                    <p className="mt-1 text-2xl font-bold">
                      +{selectedRobot.increment}
                    </p>
                  </div>
                </div>
              );
            })()}

          <div className="mt-6 border-t border-gray-800 pt-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-gray-500">
              Robot protection
            </p>

            <div className="grid grid-cols-3 gap-2">
              {robots.map((robot) => {
                const info = protectionInfo(
                  robot.increment,
                );

                const active =
                  selection.kind === "robot" &&
                  selection.alliance ===
                    robot.alliance &&
                  selection.index === robot.index;

                return (
                  <button
                    key={`${robot.alliance}-${robot.index}`}
                    type="button"
                    onMouseEnter={() =>
                      setSelection({
                        kind: "robot",
                        alliance: robot.alliance,
                        index: robot.index,
                      })
                    }
                    onFocus={() =>
                      setSelection({
                        kind: "robot",
                        alliance: robot.alliance,
                        index: robot.index,
                      })
                    }
                    onClick={() =>
                      setSelection({
                        kind: "robot",
                        alliance: robot.alliance,
                        index: robot.index,
                      })
                    }
                    className={`rounded-lg border px-2 py-2 text-center transition ${
                      robot.alliance === "red"
                        ? active
                          ? "border-red-400 bg-red-950 text-red-100"
                          : "border-red-900/60 bg-red-950/30 text-red-300"
                        : active
                          ? "border-blue-400 bg-blue-950 text-blue-100"
                          : "border-blue-900/60 bg-blue-950/30 text-blue-300"
                    }`}
                  >
                    <span className="block text-xs font-bold">
                      {shortTeamLabel(robot.team)}
                    </span>

                    <span className="mt-1 block text-lg font-black">
                      L{info.level}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 border-t border-gray-800 pt-4 text-xs leading-5 text-gray-500">
            Level 0 = field surface
            <br />
            Levels 1–4 = increasingly higher Rope
            support
          </div>
        </aside>
      </div>
    </section>
  );
}