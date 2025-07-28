// components/layout/Topbar.tsx (no changes needed from what you provided)
"use client"

import Link from "next/link";
import SearchBar from "../ui/Search";
import MobileSidebar from "./MobileSidebar";


export default function Topbar() {
  const handleSearch = (searchTerm: string) => {
    console.log("Searching for:", searchTerm);
  };

  return (
    <div className="fixed inset-x-0 w-full px-6 py-4 top-0 h-16 bg-gray-800 z-50">
      <div className="h-full flex items-center justify-between px-4 sm:px-6 md:px-8 lg:px-10">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <MobileSidebar />
          <Link
            href="/"
            className="truncate text-lg sm:text-xl font-bold text-white pb-1"
          >
            FGC Scout
          </Link>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-4">
          <SearchBar onSearch={handleSearch} />
        </div>
      </div>
    </div>
  );
}