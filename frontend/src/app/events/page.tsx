"use client";

import { useMemo, useState } from "react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, ChevronDown, Pin } from "lucide-react";
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

export default function Events() {
    const [selectedSeason, setSelectedSeason] = useState<Season>(
        SEASONS[0].season
    );

    const selectedLabel = useMemo(() => {
        const found = SEASONS.find((s) => s.season === selectedSeason);
        return found ? found.label : selectedSeason;
    }, [selectedSeason]);

    return (
        <div className="bg-gray-950 min-h-screen w-full">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                {/* --- Header --- */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-50">
                            FIRST Global 2025
                        </h1>
                        <p className="text-gray-50 text-sm sm:text-base">
                            <CalendarDays className="inline-block mr-2 mb-1 h-5 w-5 text-gray-50" />
                            October 29 to November 1, 2025
                        </p>
                        <p className="text-gray-50 text-sm sm:text-base">
                            <Pin className="inline-block mr-2 mb-1 h-5 w-5 text-gray-50" />
                            Panama City, Panama
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-gray-300 text-sm sm:text-base">Season:</span>
                        <SeasonSelect value={selectedSeason} onChange={setSelectedSeason} />
                    </div>
                </div>

                {/* --- Tabs between Header and Content --- */}
                <Tabs defaultValue="events" className="w-full">
                    <TabsList className="bg-gray-900/80 mb-4">
                        <TabsTrigger
                            value="events"
                            className="px-4 py-2 text-sm sm:text-base"
                        >
                            Results
                        </TabsTrigger>
                        <TabsTrigger
                            value="details"
                            className="px-4 py-2 text-sm sm:text-base"
                        >
                            Rankings
                        </TabsTrigger>
                        <TabsTrigger
                            value="statistics"
                            className="px-4 py-2 text-sm sm:text-base"
                        >
                            Awards
                        </TabsTrigger>
                        <TabsTrigger
                            value="statistics"
                            className="px-4 py-2 text-sm sm:text-base"
                        >
                            Teams
                        </TabsTrigger>
                        <TabsTrigger
                            value="statistics"
                            className="px-4 py-2 text-sm sm:text-base"
                        >
                            Stats
                        </TabsTrigger>
                        <TabsTrigger
                            value="statistics"
                            className="px-4 py-2 text-sm sm:text-base"
                        >
                            Media
                        </TabsTrigger>
                    </TabsList>

                    {/* --- Events Tab Content --- */}
                    <TabsContent value="events">
                        <div className="bg-gray-900 border border-gray-600 rounded-lg shadow-lg p-4 sm:p-6">
                            <p className="text-lg sm:text-xl font-bold text-gray-100 mb-4">
                                Events List — {selectedLabel}
                            </p>
                            <p className="text-gray-400">
                                Event data for <b>{selectedLabel}</b> season will be displayed
                                here.
                            </p>
                        </div>
                    </TabsContent>

                    {/* --- Details Tab Content --- */}
                    <TabsContent value="details">
                        <div className="bg-gray-900 border border-gray-600 rounded-lg shadow-lg p-4 sm:p-6">
                            <p className="text-lg sm:text-xl font-bold text-gray-100 mb-4">
                                Season Details — {selectedLabel}
                            </p>
                            <p className="text-gray-400">
                                Here you could add extra information about the{" "}
                                <b>{selectedLabel}</b> season, teams, schedule, or statistics.
                            </p>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}