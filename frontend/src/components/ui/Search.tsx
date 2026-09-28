"use client";

import React, { useState } from "react";
import { Search } from "lucide-react";

interface SearchBarProps {
  onSearch: (searchTerm: string) => void;
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  placeholder = "Search for teams and matches...",
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };


  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      onSearch(searchTerm.trim());
    }
  };

  return (
    <div className="control flex h-9 w-44 items-center gap-2 px-3 sm:w-72">
      <Search className="h-4 w-4 shrink-0 text-slate-500" />
      <input
        type="text"
        placeholder={placeholder}
        value={searchTerm}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        aria-label={placeholder}
        className="min-w-0 flex-1 appearance-none border-none bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-600"
      />
    </div>
  );
};

export default SearchBar;
