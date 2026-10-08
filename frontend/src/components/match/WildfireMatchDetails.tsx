import { Flame, Mountain, Users } from "lucide-react";
import { braceLabel, formatRecorded, MANUAL_2026, recordedNumber, suppressionPoints } from "@/lib/match2026";

type Props = {
  details?: Record<string, unknown>;
  played: boolean;
  redScore?: number;
  blueScore?: number;
  redMinPen?: number;
  redMajPen?: number;
  blueMinPen?: number;
  blueMajPen?: number;
};
const robots = ["One", "Two", "Three"];

export function WildfireOverview({ details, played }: Pick<Props, "details" | "played">) {
  return <section className="mt-6 py-5" aria-label="Igniting Innovation scoring overview">

    <h2 className="mt-2 flex items-center gap-2 text-2xl font-semibold"><Flame className="text-orange-400" />Igniting Innovation</h2>

    <div className="mt-5 grid gap-3 md:grid-cols-3">
      {[
        ["Red Suppression Unit", "wildfireInRedSuppressionUnit", "bg-red-950/30 text-red-200"],
        ["Global Extinguisher", "wildfireInExtinguisher", "bg-slate-900 text-slate-200"],
        ["Blue Suppression Unit", "wildfireInBlueSuppressionUnit", "bg-blue-950/30 text-blue-200"],
      ].map(([label, key, colors]) => <div key={key} className={`p-4 ${colors}`}><p className="text-sm font-semibold">{label}</p><p className="mt-3 font-mono text-4xl font-bold">{formatRecorded(recordedNumber(details, key), played)}</p><p className="mt-2 text-xs opacity-70">{played ? "Wildfire contained · 1 point each" : "Awaiting match results"}</p></div>)}
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {(["red", "blue"] as const).map(color => <div key={color} className={`p-3 ${color === "red" ? "bg-red-950/15" : "bg-blue-950/15"}`}>
        <p className="flex items-center gap-2 font-semibold capitalize"><Mountain className="h-4 w-4" />{color} Brace</p>
        <div className="mt-3 grid grid-cols-3 gap-2">{robots.map((robot, index) => <div key={robot} className="p-2 text-center"><p className="text-xs text-slate-500">Robot {index + 1}</p><p className="mt-1 text-sm font-semibold">{played ? braceLabel(recordedNumber(details, `${color}Robot${robot}BraceState`)) : "—"}</p></div>)}</div>
      </div>)}
    </div>
  </section>;
}

export default function WildfireMatchDetails(props: Props) {
  const { details, played } = props;
  const n = (key: string) => recordedNumber(details, key);
  const v = (value: number | null) => formatRecorded(value, played);
  const multiplier = (color: string) => n(`${color}ClimbMultiplier`);
  const globalRows = [
    ["Wildfire in Extinguisher (1 point each)", n("wildfireInExtinguisher")],
    ["Global Alliance Knockdown Bonus", n("coopertitionKnockdownBonus")],
    ["Coopertition Bonus", n("coopertition")],
  ] as const;
  const rows: [string, string, string][] = [
    ["Wildfire in Suppression Unit", v(n("wildfireInRedSuppressionUnit")), v(n("wildfireInBlueSuppressionUnit"))],
    ["Reported approximate wildfire count", v(n("approximateWildfireInRedSuppressionUnit")), v(n("approximateWildfireInBlueSuppressionUnit"))],
    ...robots.map((robot, index): [string, string, string] => [`Robot ${index + 1} Brace position`, played ? braceLabel(n(`redRobot${robot}BraceState`)) : "—", played ? braceLabel(n(`blueRobot${robot}BraceState`)) : "—"]),
    ["Climb Multiplier", `${v(multiplier("red"))}${played && multiplier("red") !== null ? "×" : ""}`, `${v(multiplier("blue"))}${played && multiplier("blue") !== null ? "×" : ""}`],
    ["Suppression points after multiplier (rounded up)", v(suppressionPoints(n("wildfireInRedSuppressionUnit"), multiplier("red"))), v(suppressionPoints(n("wildfireInBlueSuppressionUnit"), multiplier("blue")))],
    ...robots.map((robot, index): [string, string, string] => [`Robot ${index + 1} Partner Climb (reported)`, v(n(`redRobot${robot}PartnerClimb`)), v(n(`blueRobot${robot}PartnerClimb`))]),
    ["Partner Climb points", v(n("redPartnerClimbPoints")), v(n("bluePartnerClimbPoints"))],
    ["Minor / Major penalties", `${v(props.redMinPen ?? null)} / ${v(props.redMajPen ?? null)}`, `${v(props.blueMinPen ?? null)} / ${v(props.blueMajPen ?? null)}`],
    ["Official total score", v(props.redScore ?? null), v(props.blueScore ?? null)],
  ];
  return <section className="mt-7">
    <h2 className="text-2xl font-semibold">{played ? "Detailed Results" : "Results pending"}</h2>
    <div className="mt-3 overflow-hidden">
      <div className="flex items-center justify-center gap-2 bg-orange-950/40 px-4 py-3 font-semibold text-orange-200"><Users className="h-4 w-4" />Global Alliance · shared by both alliances</div>
      {globalRows.map(([label, value]) => <div key={label} className="flex justify-between gap-4 border-t border-slate-800 px-4 py-3 text-sm"><span className="text-slate-300">{label}</span><strong className="font-mono text-orange-200">{v(value)}</strong></div>)}
      <div className="flex justify-between gap-4 border-t border-slate-800 px-4 py-3 text-sm"><span className="text-slate-400">Reported approximate Extinguisher count</span><strong>{v(n("approximateWildfireInExtinguisher"))}</strong></div>
      <table className="w-full table-fixed border-collapse text-sm">
        <thead><tr className="border-t border-slate-700 bg-slate-800"><th className="w-[27%] p-3 text-red-300">Red</th><th className="p-3 text-slate-300">Regional Alliance scoring</th><th className="w-[27%] p-3 text-blue-300">Blue</th></tr></thead>
        <tbody>{rows.map(([label, red, blue]) => <tr key={label} className="border-t border-slate-700"><td className="break-words bg-red-950/35 p-3 text-center font-medium text-red-100">{red}</td><th scope="row" className="p-3 text-center font-normal text-slate-400">{label}</th><td className="break-words bg-blue-950/35 p-3 text-center font-medium text-blue-100">{blue}</td></tr>)}</tbody>
      </table>
    </div>
    <details className="mt-4 text-xs leading-5 text-slate-500"><summary className="cursor-pointer">Scoring rules</summary>
      <p className="mt-2">Suppression points × Climb Multiplier (rounded up) + Partner Climb points + Extinguisher points + Knockdown Bonus + Coopertition Bonus.</p>
      <a href={MANUAL_2026} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sky-400 hover:underline">Official 2026 manual</a>
    </details>
  </section>;
}
