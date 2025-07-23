"use client"

import Link from "next/link";
import SearchBar from "../ui/Search";

export default function Topbar() {
  const handleSearch = (searchTerm: string) => {
    console.log("Searching for:", searchTerm);
  };

  return (
    <div className="fixed inset-x-0 top-0 h-16 bg-gray-800">
      <div className="h-full flex items-center justify-between px-4 sn:px-6 md:px-8 lg:px-10">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <Link
            href="/"
            className="truncate text-lg sm:text-xl font-bold text-white"
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