"use client"

import { SEASON_STORAGE_KEY } from "@/lib/seasonData";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SearchBar from "../ui/Search";
import MobileSidebar from "./MobileSidebar";


export default function Topbar() {
  const router = useRouter();
  const handleSearch = (searchTerm: string) => {
    if (!searchTerm) return;
    let year = "";
    try { year = localStorage.getItem(SEASON_STORAGE_KEY) ?? ""; } catch { /* Use latest season. */ }
    router.push(`/search?q=${encodeURIComponent(searchTerm)}${/^\d{4}$/.test(year) ? `&year=${year}` : ""}`);
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-14 border-b border-emerald-800 bg-emerald-700">
      <div className="flex h-full items-center justify-between gap-3 px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <MobileSidebar />
          <Link href="/" className="text-base font-bold tracking-wide text-white sm:text-lg">
            FGC Scout
          </Link>
        </div>
        <SearchBar onSearch={handleSearch} placeholder="Find a team or match…" />
      </div>
    </header>
  );
}
