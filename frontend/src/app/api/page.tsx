import Link from "next/link";

const apiEndpoints = [
  { label: "Teams", url: "http://localhost:5000/api/Teams" },
  { label: "Game schema", url: "http://localhost:5000/api/GameSchema" },
  { label: "Game data (year)", url: "http://localhost:5000/api/GameData/2024" },
  { label: "Admin import season", url: "http://localhost:5000/api/admin/importSeason" },
];

export default function ApiPage() {
  return (
    <div className="bg-gray-950 min-h-screen p-8 text-white">
      <div className="mx-auto max-w-4xl bg-gray-900 border border-gray-700 rounded-3xl p-8 shadow-lg">
        <h1 className="text-3xl font-bold mb-4">API</h1>
        <p className="text-gray-300 mb-6">
          Ta strona pokazuje dostępne endpointy backendu. Użytkownicy mogą z nich korzystać bezpośrednio lub przez frontendowe funkcje.
        </p>
        <div className="space-y-3">
          {apiEndpoints.map((endpoint) => (
            <div key={endpoint.url} className="rounded-xl border border-gray-700 bg-gray-950 p-4">
              <div className="text-sm text-gray-400">{endpoint.label}</div>
              <a href={endpoint.url} target="_blank" rel="noreferrer" className="text-sky-300 hover:text-sky-200 break-all">
                {endpoint.url}
              </a>
            </div>
          ))}
        </div>
        <div className="mt-8 text-gray-300">
          <p>
            Jeśli chcesz, mogę też dodać interaktywny listownik z pobieraniem danych API bezpośrednio na tej stronie.
          </p>
        </div>
        <div className="mt-8">
          <Link href="/" className="text-sky-400 hover:text-sky-200">
            Powrót do strony głównej
          </Link>
        </div>
      </div>
    </div>
  );
}
