/**
 * Shared date display helpers for article lists (Feed list and read-later list).
 * Format and age-based color match across both (S022, S056, S069).
 */

/** Format ISO date as YYYY.MM.DD for display (e.g. 2026.03.09). */
export function formatYearMonth(published: string): string {
  const d = new Date(published);
  if (Number.isNaN(d.getTime())) return published.slice(0, 10).replace(/-/g, ".");
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

/** Age-based wrapper: border + bg both fade (same day darkest, 3+ months lightest). */
export function getDateWrapClass(published: string): string {
  const pub = new Date(published);
  const now = new Date();
  if (Number.isNaN(pub.getTime())) return "border-foreground/25 bg-foreground/5";
  const sameDay =
    pub.getUTCDate() === now.getUTCDate() &&
    pub.getUTCMonth() === now.getUTCMonth() &&
    pub.getUTCFullYear() === now.getUTCFullYear();
  const daysAgo = (now.getTime() - pub.getTime()) / (24 * 60 * 60 * 1000);
  if (sameDay) return "border-foreground bg-foreground/15";
  if (daysAgo <= 30) return "border-foreground/75 bg-foreground/10";
  if (daysAgo <= 90) return "border-foreground/45 bg-foreground/5";
  return "border-foreground/25 bg-foreground/5";
}
