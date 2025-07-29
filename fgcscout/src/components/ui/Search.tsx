"use client";

import { Search } from "lucide-react";
import React, { useState } from "react";

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

  const handleSearchClick = () => {
    onSearch(searchTerm);
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      onSearch(searchTerm);
    }
  };

  return (
    <div className="flex items-center space-x-2 w-80 h-10 rounded-xl border border-gray-700 bg-gray-800 p-2 shadow-sm focus-within:ring-2 focus-within:ring-sky-500">
      <input
        type="text"
        placeholder={placeholder}
        value={searchTerm}
        onChange={handleInputChange}
        onKeyPress={handleKeyPress}
        className="flex-grow appearance-none border-none p-1 text-gray-50 outline-none focus:ring-0"
      />
    </div>
  );
};

export default SearchBar;