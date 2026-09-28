import { formatTeamSlug } from "@/lib/country";

export type Award = {
  name: string;
  gold?: string;
  silver?: string;
  bronze?: string;
};

export type AwardPlacement = "gold" | "silver" | "bronze";

export type TeamAward = {
  name: string;
  placement: AwardPlacement;
};

export const EVENT_META: Record<number, {
  title: string;
  dates: string;
  location: string;
  theme: string;
  officialUrl: string;
}> = {
  2024: {
    title: "2024 FIRST Global Challenge",
    dates: "26–29 September 2024",
    location: "Athens, Greece",
    theme: "Feeding the Future",
    officialUrl: "https://first.global/archive/fgc-2024/",
  },
  2025: {
    title: "2025 FIRST Global Challenge",
    dates: "29 October–1 November 2025",
    location: "Panamá City, Panama",
    theme: "Eco Equilibrium",
    officialUrl: "https://first.global/archive/fgc-2025/",
  },
};

export const AWARDS_2025: Award[] = [
  { name: "Albert Einstein Award for FIRST Global International Excellence", gold: "Team Kazakhstan", silver: "Team Aruba", bronze: "Team Lebanon" },
  { name: "FIRST Global Winning Alliances", gold: "Venezuela · Mexico · Panama · Cameroon", silver: "Serbia · Lithuania · Malta · Kenya", bronze: "Kazakhstan · Aruba · Bolivia · Jamaica" },
  { name: "FIRST Global Grand Challenge Award", gold: "Team Kazakhstan", silver: "Team Venezuela", bronze: "Team China" },
  { name: "Innovator Award", gold: "Team United Arab Emirates", silver: "Team Iran", bronze: "Team Colombia" },
  { name: "Zhang Heng Award for Engineering Design", gold: "Team Mexico", silver: "Team Spain", bronze: "Team Greece" },
  { name: "Ustad Ahmad Lahori Award for Innovation in Engineering", gold: "Team Moldova", silver: "Team China", bronze: "Team Indonesia" },
  { name: "Dr. Mae Jemison Award for International Unity", gold: "Team Canada", silver: "Team Peru", bronze: "Team Nigeria" },
  { name: "Rajaa Cherkaoui El Moursli Award for Courageous Achievement", gold: "Team Madagascar", silver: "Team Iran", bronze: "Team Liberia" },
  { name: "Jackie Bezos Award for International Enthusiasm", gold: "Team Venezuela", silver: "Team Vietnam", bronze: "Team Panama" },
  { name: "Judges Award", gold: "Team Burkina Faso", silver: "Team Philippines", bronze: "Team Zimbabwe" },
];

export const AWARDS_BY_YEAR: Record<number, Award[]> = {
  2025: AWARDS_2025,
};

const AWARD_TEAM_SLUGS: Record<string, string> = {
  kazakhstan: "kaz", aruba: "aru", lebanon: "lbn", venezuela: "ven", mexico: "mex", panama: "pan",
  cameroon: "cmr", serbia: "srb", lithuania: "ltu", malta: "mlt", kenya: "ken", bolivia: "bol",
  jamaica: "jam", china: "chn", "united arab emirates": "uae", iran: "iri", colombia: "col",
  spain: "esp", greece: "gre", moldova: "mda", indonesia: "ina", canada: "can", peru: "per",
  nigeria: "ngr", madagascar: "mad", liberia: "lbr", vietnam: "vie", "burkina faso": "bfa",
  philippines: "phi", zimbabwe: "zim",
};

export function parseAwardTeams(value?: string) {
  if (!value) return [];
  return value.split(" · ").map((entry) => entry.replace(/^Team\s+/i, "").trim());
}

export function getAwardTeamSlug(country: string) {
  return AWARD_TEAM_SLUGS[country.toLowerCase()] ?? formatTeamSlug(country);
}

export function getTeamAwards(year: number | null, teamSlug?: string): TeamAward[] {
  if (!year || !teamSlug) return [];

  return (AWARDS_BY_YEAR[year] ?? []).flatMap((award) =>
    (["gold", "silver", "bronze"] as const).flatMap((placement) =>
      parseAwardTeams(award[placement]).some((country) => getAwardTeamSlug(country) === teamSlug)
        ? [{ name: award.name, placement }]
        : []
    )
  );
}

export const MEDIA_LINKS = [
  {
    title: "FIRST Global livestreams",
    description: "Official live broadcasts and archived streams.",
    href: "https://www.youtube.com/@FIRSTGlobalOfficial/streams",
  },
  {
    title: "FIRST Global YouTube",
    description: "Match videos, team profiles and event highlights.",
    href: "https://www.youtube.com/@FIRSTGlobalOfficial",
  },
  {
    title: "2025 event archive",
    description: "Official playlists and media from Panama City.",
    href: "https://first.global/archive/fgc-2025/",
  },
];
