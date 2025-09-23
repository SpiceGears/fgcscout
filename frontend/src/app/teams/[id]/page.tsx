"use client";

import { useMemo, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Award, CalendarDays, ChevronDown } from "lucide-react";
import { SEASONS } from "@/constants/Seasons";

type Season = (typeof SEASONS)[number]["season"];

function SeasonSelect({
  value,
  onChange,
}: {
  value: Season;
  onChange: (s: Season) => void;
}) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => SEASONS.find((s) => s.season === value),
    [value]
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className="
          inline-flex items-center gap-2 rounded-md border border-gray-700
          bg-gray-850/60 px-4 py-2 text-sm sm:text-base font-medium text-gray-200
          shadow-sm backdrop-blur-sm
          hover:bg-gray-800 hover:text-white hover:border-gray-600
          focus:outline-none focus:ring-2 focus:ring-indigo-500/40
          transition
        "
      >
        <span className="truncate max-w-[10rem] sm:max-w-[16rem]">
          {selected ? selected.label : value}
        </span>
        <ChevronDown
          className={`h-5 w-5 sm:h-6 sm:w-6 opacity-80 transition-transform duration-200 ${open ? "rotate-180" : ""
            }`}
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className="
          w-64 rounded-lg border border-gray-700/70 bg-gray-900/95
          text-gray-200 shadow-xl backdrop-blur-xl
        "
      >
        {SEASONS.map((item) => (
          <DropdownMenuItem
            key={item.season}
            onSelect={(e) => {
              e.preventDefault();
              onChange(item.season as Season);
              setOpen(false);
            }}
            className="
              cursor-pointer text-gray-200
              focus:bg-gray-800 focus:text-white
              transition-colors
            "
          >
            <div className="flex flex-col">
              <span className="font-medium">{item.label}</span>
              <span className="text-xs text-gray-400">
                {item.country} {item.season}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function Team() {
  const [selectedSeason, setSelectedSeason] = useState<Season>(SEASONS[0].season);

  const selectedLabel = useMemo(() => {
    const found = SEASONS.find((s) => s.season === selectedSeason);
    return found ? found.label : selectedSeason;
  }, [selectedSeason]);

  return (
    <div className="bg-gray-950 min-h-screen w-full">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-50">
            Team Poland
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-gray-300 text-sm sm:text-base">Season:</span>
            <SeasonSelect
              value={selectedSeason}
              onChange={setSelectedSeason}
            />
          </div>
        </div>

        <div className="space-y-4 sm:space-y-6">
          {/* Stats card */}
          <div className="bg-gray-900 border border-gray-600 rounded-lg shadow-lg p-4 sm:p-6">
            <p className="text-lg sm:text-xl font-bold text-gray-100 mb-4">
              Stats {selectedLabel ? `— ${selectedLabel}` : ""}
            </p>

            <ul className="divide-y divide-gray-700 rounded-lg overflow-hidden bg-gray-900">
              <li className="flex items-center justify-between gap-4 p-4">
                <span className="text-gray-200">Ranking Score:</span>
                <span className="font-semibold text-gray-100">94.64</span>
              </li>
              <li className="flex items-center justify-between gap-4 p-4">
                <span className="text-gray-200">Highest Score:</span>
                <span className="font-semibold text-gray-100">129</span>
              </li>
              <li className="flex items-center justify-between gap-4 p-4">
                <span className="text-gray-200">Matches Played:</span>
                <span className="font-semibold text-gray-100">12</span>
              </li>
            </ul>
          </div>

          {/* Matches card */}
          <div className="bg-gray-900 border border-gray-600 rounded-lg shadow-lg p-4 sm:p-6">
            <p className="text-lg sm:text-xl font-bold text-gray-100 mb-4">
              Matches
            </p>
            <div className="flex items-center gap-2 text-gray-300 text-sm mb-3">
              <CalendarDays className="w-5 h-5" />
              <p>29 October - 1 November 2025</p>
            </div>
            <div className="flex items-center gap-2 text-gray-300 text-sm mb-3">
              <Award className="w-5 h-5" />
              <p>1st Place</p>
            </div>
            <p className="text-gray-300 text-sm ml-7">W-L-T: <b>10-2-0</b></p>
            <div className="flex justify-center text-gray-100 font-bold border border-gray-500 bg-gray-800 rounded-3xl px-4 pt-2 pb-2 mt-4 w-fit mx-auto my-2">
              <p>Qualifications</p>
            </div>
            <div className="overflow-x-auto flex justify-center">
                <table className="table-auto">  
                <thead>
                  <tr className="text-left border-b border-gray-700 text-gray-100 font-bold">
                  <th className="p-2">Match</th>
                  <th className="p-2">Score</th>
                  <th className="p-2 text-center" colSpan={3}>Red Alliance</th>
                  <th className="p-2 text-center" colSpan={3}>Blue Alliance</th>
                  </tr>
                </thead>
                <tbody className="text-gray-100">
                  <tr onClick={() => window.location.href = `/match/Q-1`} className="border-b border-gray-700 hover:bg-gray-800 cursor-pointer transition-colors">
                  <td className="p-2 text-blue-500">Q-1</td>
                  <td className="p-2">
                  <span className="text-red-500">120</span><span className="px-1">-</span><span className="text-blue-500">165</span>
                  </td>
                  <td className="p-2 bg-red-500/20">Team Japan</td>
                  <td className="p-2 bg-red-500/20">Team USA</td>
                  <td className="p-2 bg-red-500/20">Team Italy</td>
                  <td className="p-2  bg-blue-500">Team Poland</td>
                  <td className="p-2 bg-blue-500/20">Team Canada</td>
                  <td className="p-2 bg-blue-500/20">Team Mexico</td>
                  </tr>
                  <tr onClick={() => window.location.href = `/match/Q-2`} className="border-b border-gray-700 hover:bg-gray-800 cursor-pointer transition-colors">
                  <td className="p-2 text-red-500">Q-2</td>
                  <td className="p-2">
                  <span className="text-red-500">120</span><span className="px-1">-</span><span className="text-blue-500">165</span>
                  </td>
                  <td className="p-2 bg-red-500/20">Team Germany</td>
                  <td className="p-2 bg-red-500">Team Poland</td>
                  <td className="p-2 bg-red-500/20">Team France</td>
                  <td className="p-2 bg-blue-500/20">Team Netherlands</td>
                  <td className="p-2 bg-blue-500/20">Team Italy</td>
                  <td className="p-2 bg-blue-500/20">Team Spain</td>
                  </tr>
                  <tr onClick={() => window.location.href = `/match/Q-3`} className="border-b border-gray-700 hover:bg-gray-800 cursor-pointer transition-colors">
                  <td className="p-2 text-blue-500">Q-3</td>
                  <td className="p-2">
                  <span className="text-red-500">120</span><span className="px-1">-</span><span className="text-blue-500">165</span>
                  </td>
                  <td className="p-2 bg-red-500/20">Team Brazil</td>
                  <td className="p-2 bg-red-500/20">Team Argentina</td>
                  <td className="p-2 bg-red-500/20">Team Colombia</td>
                  <td className="p-2 bg-blue-500">Team Poland</td>
                  <td className="p-2 bg-blue-500/20">Team Mexico</td>
                  <td className="p-2 bg-blue-500/20">Team Chile</td>
                  </tr>
                </tbody>
                </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}