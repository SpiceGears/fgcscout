import { Search } from "lucide-react";
import Link from "next/link";

export default function Teams() {
  const mockTeams = [
    { id: "poland", name: "Team Poland" },
    { id: "usa", name: "Team USA" },
    { id: "japan", name: "Team Japan" },
  ];

  return (
    <div className="bg-gray-950 min-h-screen w-full flex flex-col p-8">
      <h1 className="text-3xl font-bold text-gray-50 text-center mb-6">
        <em>FIRST</em> Global Challenge Teams
      </h1>
      <div className="flex-grow flex flex-col">
        <div className="bg-gray-800 border border-gray-600 rounded-lg shadow-lg p-6 w-full max-w-6xl mx-auto flex-grow flex flex-col">
          <h3 className="text-xl font-bold text-gray-50 mb-2">Search</h3>
          <div className="relative mb-6">
            <Search
              className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400"
              size={20}
            />
            <input
              type="text"
              className="bg-gray-900 w-full pl-10 pr-4 py-2 text-gray-50 border border-gray-700 rounded-lg focus:outline-none focus:border-gray-500"
              placeholder="Search for teams"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {mockTeams.map((team) => (
              <div key={team.id} className="bg-gray-800 hover:bg-gray-700 p-4 rounded-lg">
                <Link href={`/teams/${team.id}`}>
                  <h4 className="text-lg font-semibold text-gray-100">
                    {team.name}
                  </h4>
                </Link>
              </div>
            ))}
          </div>

          <div className="flex-grow"></div>
        </div>
      </div>
    </div>
  );
}