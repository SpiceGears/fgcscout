type GenericMatchDetailsProps = {
  details?: Record<string, unknown>;
};

const META_KEYS = new Set(["eventKey", "tournamentKey", "id"]);

function labelFor(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function valueFor(value: unknown) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toLocaleString("en-US", { maximumFractionDigits: 3 });
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function GenericMatchDetails({ details }: GenericMatchDetailsProps) {
  const rows = Object.entries(details ?? {}).filter(([key]) => !META_KEYS.has(key));
  if (rows.length === 0) return null;

  return (
    <section className="mt-7">
      <h2 className="text-2xl font-semibold">Detailed Results</h2>
      <div className="mt-3 overflow-hidden rounded-xl border border-gray-700 bg-gray-900">
        <div className="grid sm:grid-cols-2">
          {rows.map(([key, value], index) => {
            const alliance = key.startsWith("red") ? "red" : key.startsWith("blue") ? "blue" : "shared";
            const color = alliance === "red" ? "bg-red-950/35" : alliance === "blue" ? "bg-blue-950/35" : "bg-gray-900";
            return (
              <div key={key} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-gray-800 px-4 py-3 ${color} ${index > 0 ? "border-t" : ""} sm:border-t sm:[&:nth-child(-n+2)]:border-t-0 sm:odd:border-r`}>
                <span className="min-w-0 break-words text-sm text-gray-400">{labelFor(key)}</span>
                <strong className="font-mono text-sm text-gray-100">{valueFor(value)}</strong>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
