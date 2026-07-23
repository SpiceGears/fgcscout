export function formatCountryName(country?: string, countryCode?: string) {
  const normalizedCode = countryCode?.trim().toUpperCase();
  const regionCode = normalizedCode?.length === 2 ? normalizedCode : undefined;
  const fallback = country?.trim();

  if (regionCode && typeof Intl !== "undefined" && "DisplayNames" in Intl) {
    try {
      const names = new Intl.DisplayNames(["en"], { type: "region" });
      const label = names.of(regionCode);
      if (label) {
        return label;
      }
    } catch {
      // Ignore unsupported environment
    }
  }

  return fallback ?? "Unknown";
}

export function formatTeamCountryLabel(country?: string, countryCode?: string) {
  const name = formatCountryName(country, countryCode);
  const codeLabel = (countryCode?.trim().toUpperCase() ?? country?.trim().toUpperCase()) ?? "";

  if (!codeLabel || name.toUpperCase() === codeLabel) {
    return name;
  }

  return `${name} · ${codeLabel}`;
}

export function formatTeamName(country?: string, countryCode?: string) {
  const name = formatCountryName(country, countryCode);
  return name === "Unknown" ? "Team Unknown" : `Team ${name}`;
}

export function formatTeamSlug(country?: string, countryCode?: string, fallbackId?: string) {
  const source = country?.trim() || countryCode?.trim() || fallbackId?.trim() || "";
  return source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
