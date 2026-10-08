export type SeasonMatch = {
  played?: boolean;
  data?: {
    played?: boolean;
    redScore?: number;
    blueScore?: number;
    participants?: { teamKey?: number | string; station?: number; country?: string; countryCode?: string }[];
  };
};
export const SEASON_STORAGE_KEY = "fgcscout.selectedSeason";
export function resolveSeason(years: number[], requested?: string | null) {
  const available = [...new Set(years)].filter(Number.isInteger).sort((a, b) => b - a);
  const chosen = requested ? Number(requested) : NaN;
  return available.includes(chosen) ? chosen : available[0] ?? null;
}
export function savedSeason(years: number[], requested?: string | null) {
  let stored: string | null = null;
  try { stored = localStorage.getItem(SEASON_STORAGE_KEY); } catch { /* Storage may be unavailable. */ }
  return resolveSeason(years, requested ?? stored);
}
export function rememberSeason(year: number) {
  try { localStorage.setItem(SEASON_STORAGE_KEY, String(year)); } catch { /* Navigation still works without storage. */ }
}
export function isPlayed(match: SeasonMatch) {
  // Older archives may omit the flag; explicit false always excludes scheduled matches.
  return (match.data?.played ?? match.played) !== false;
}
export function teamRecord(matches: SeasonMatch[], teamId: string | null) {
  const record = {wins:0, losses:0, ties:0, played:0};
  if (!teamId) return record;
  for (const match of matches) {
    if (!isPlayed(match)) continue;
    const station = match.data?.participants?.find(team => String(team.teamKey) === teamId)?.station;
    const red = station !== undefined && station >= 11 && station <= 13;
    const blue = station !== undefined && station >= 21 && station <= 23;
    if (!red && !blue) continue;
    const own = red ? match.data?.redScore : match.data?.blueScore;
    const other = red ? match.data?.blueScore : match.data?.redScore;
    if (typeof own !== "number" || typeof other !== "number" || !Number.isFinite(own) || !Number.isFinite(other)) continue;
    record.played++;
    if (own === other) record.ties++;
    else if (own > other) record.wins++;
    else record.losses++;
  }
  return record;
}
export function seasonTeams(matches: SeasonMatch[]) {
  const teams = new Map<string, {id:string;country?:string;countryCode?:string}>();
  for (const match of matches) for (const team of match.data?.participants ?? []) {
    if (team.teamKey === undefined || team.teamKey === null) continue;
    const id = String(team.teamKey);
    if (!teams.has(id)) teams.set(id, {id, country:team.country, countryCode:team.countryCode});
  }
  return [...teams.values()];
}
