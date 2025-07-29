"use client"

import SearchBar from "@/components/ui/Search";

export default function Home() {

  const handleSearch = (searchTerm: string) => {
    console.log("Searching for:", searchTerm);
  };
  return (
    <div className="bg-gray-950 min-h-[calc(100vh-4rem)] w-full flex flex-col items-center p-16">
      <div className="text-center space-y-6 p-4">
        <h1 className="text-white text-4xl font-bold">FGC Scout</h1>
        <SearchBar onSearch={handleSearch} />
      </div>
    </div>
  )
}