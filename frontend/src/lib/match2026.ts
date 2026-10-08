export const MANUAL_2026 = "https://docs.google.com/document/d/11uHfXaXqNHy9q4LvUZ5AduTErb12A0mZC6fgkDYeBf8/view";
export function recordedNumber(details: Record<string, unknown> | undefined, key: string): number | null {
  const value = details?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
export function braceLabel(value: number | null) {
  const labels = new Map([[0, "Not climbed"], [.05, "Contact"], [.1, "Zone 1"], [.2, "Zone 2"], [.3, "Zone 3"]]);
  return value === null ? "—" : labels.get(value) ?? `Recorded: ${value}`;
}
export function suppressionPoints(units: number | null, multiplier: number | null) {
  return units === null || multiplier === null ? null : Math.ceil(Math.round(units * multiplier * 1e9) / 1e9);
}
export function formatRecorded(value: number | null, played = true) {
  return !played || value === null ? "—" : value.toLocaleString("en-US", { maximumFractionDigits: 3 });
}
