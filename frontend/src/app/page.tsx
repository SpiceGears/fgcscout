"use client"

import SearchBar from "@/components/ui/Search";
import { useEffect, useState } from "react";
import Link from "next/link";

type Schema = { year: number; name: string };

export default function Home() {
  const handleSearch = (searchTerm: string) => {
    console.log("Searching for:", searchTerm);
  };

  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
        const [sres, yres] = await Promise.all([
          fetch(`${base}/api/GameSchema`),
          fetch(`${base}/api/GameData/years`),
        ]);

        if (sres.ok) {
          const data = (await sres.json()) as Schema[];
          setSchemas(data);
        }

        if (yres.ok) {
          const years = (await yres.json()) as number[];
          setAvailableYears(years.sort((a, b) => a - b));
        }
      } catch (e) {
        console.warn("Failed to load schemas", e);
      }
    }
    load();
  }, []);
  return (
    <div className="bg-gray-950 h-screen w-full flex flex-col items-center p-16">
      <div className="text-center space-y-6 p-4">
        <h1 className="text-white text-4xl font-bold">FGC Scout</h1>
        <SearchBar onSearch={handleSearch} />
        <div className="mt-4 text-gray-200">
          <h2 className="text-lg font-semibold">Seasons</h2>
          <div className="flex gap-2 justify-center mt-2 flex-wrap">
            {schemas.length > 0 ? (
              schemas.map((s) => (
                <Link key={s.year} href="/teams" className="px-3 py-1 bg-gray-800 text-gray-200 rounded">
                  {s.name ?? s.year}
                </Link>
              ))
            ) : availableYears.length > 0 ? (
              availableYears.map((year) => (
                <Link key={year} href="/teams" className="px-3 py-1 bg-gray-800 text-gray-200 rounded">
                  {year}
                </Link>
              ))
            ) : (
              <span className="text-sm text-gray-400">(no seasons loaded)</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}