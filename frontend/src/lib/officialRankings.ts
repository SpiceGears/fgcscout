export type OfficialRanking = {
  teamKey?: number | string;
  rank?: number;
  played?: number;
  rankingScore?: number;
  highestScore?: number;
  climbPoints?: number;
  team?: { country?: string; countryCode?: string };
};
export function officialRankingRows(rows: OfficialRanking[]) {
  return rows.filter(row => row.teamKey !== undefined &&
    [row.rank,row.played,row.rankingScore,row.highestScore,row.climbPoints].every(value => typeof value === "number" && Number.isFinite(value)))
    .map(row => ({key:String(row.teamKey),rank:row.rank!,played:row.played!,rankingScore:row.rankingScore!,highestPoints:row.highestScore!,climbPoints:row.climbPoints!,countryRaw:row.team?.country,countryCode:row.team?.countryCode}))
    .sort((a,b) => (a.rank > 0 ? a.rank : Infinity) - (b.rank > 0 ? b.rank : Infinity));
}
