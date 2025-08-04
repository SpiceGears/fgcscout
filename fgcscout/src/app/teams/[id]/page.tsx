"use client";

import { useMemo, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { SEASONS } from "@/constants/Seasons";

export default function Team() {
  const [selectedSeason, setSelectedSeason] = useState<string>(
    SEASONS[0].season
  );
  const [open, setOpen] = useState(false);

  const selectedLabel = useMemo(() => {
    const found = SEASONS.find((s) => s.season === selectedSeason);
    return found ? found.label : selectedSeason;
  }, [selectedSeason]);

  return (
    <div className="bg-gray-950 min-h-screen w-full">
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="absolute left-0 top-8 -translate-x-full pr-4">
          <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger
              className="
                inline-flex items-center gap-2 rounded-md border border-gray-700
                bg-gray-850/60 px-6 py-3 text-md font-medium text-gray-200
                shadow-sm backdrop-blur-sm
                hover:bg-gray-800 hover:text-white hover:border-gray-600
                focus:outline-none focus:ring-2 focus:ring-indigo-500/40
                active:translate-y-px transition
              "
            >
              {selectedLabel}
              <ChevronDown
                className={`h-6 w-6 opacity-80 transition-transform duration-200 ${
                  open ? "rotate-180" : "rotate-0"
                }`}
              />
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="start"
              sideOffset={8}
              className="
                w-64 rounded-lg border border-gray-700/70 bg-gray-900/95
                text-gray-200 shadow-xl backdrop-blur-xl
                data-[state=open]:animate-in data-[state=closed]:animate-out
                data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0
                data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95
                data-[side=bottom]:slide-in-from-top-2
              "
            >
              {SEASONS.map((item) => (
                <DropdownMenuItem
                  key={item.season}
                  onSelect={(e) => {
                    e.preventDefault();
                    setSelectedSeason(item.season);
                    setOpen(false);
                  }}
                  className="
                    cursor-pointer text-gray-200
                    focus:bg-gray-800 focus:text-white
                    data-[highlighted]:bg-gray-800 data-[highlighted]:text-white
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
        </div>

        <h1 className="text-3xl font-bold text-gray-50 mb-6">Team Poland</h1>

        <div className="bg-gray-900 border border-gray-600 rounded-lg shadow-lg p-6">
          <p className="text-xl font-bold text-gray-100 mb-4">Stats</p>

          <ul className="divide-y divide-gray-700 rounded-lg overflow-hidden bg-gray-900">
            <li className="flex items-center justify-between gap-4 p-4">
              <div className="flex items-center gap-3">
                <span className="text-gray-200">Ranking Score:</span>
              </div>
              <span className="font-semibold text-gray-100">94.64</span>
            </li>
            <li className="flex items-center justify-between gap-4 p-4">
              <div className="flex items-center gap-3">
                <span className="text-gray-200">Highest Score:</span>
              </div>
              <span className="font-semibold text-gray-100">129</span>
            </li>
            <li className="flex items-center justify-between gap-4 p-4">
              <div className="flex items-center gap-3">
                <span className="text-gray-200">Matches Played:</span>
              </div>
              <span className="font-semibold text-gray-100">12</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}