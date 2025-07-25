"use client"

import Link from "next/link";
import SearchBar from "../ui/Search";
import { Menu } from "lucide-react";

export interface TopbarProps {
  toggleSidebar: () => void;
}

export default function Topbar({ toggleSidebar  }: TopbarProps) {
  const handleSearch = (searchTerm: string) => {
    console.log("Searching for:", searchTerm);
  };

  return (
    <div className="fixed inset-x-0 top-0 h-16 bg-gray-800">
      <div className="h-full flex items-center justify-between px-4 sn:px-6 md:px-8 lg:px-10">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <button className="hover:bg-gray-700 rounded-full h-8 w-8 flex items-center justify-center" onClick={toggleSidebar}>
            <Menu className="h-5 w-5" />
          </button>
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