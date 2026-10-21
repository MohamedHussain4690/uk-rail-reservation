/**
 * Format a calendar day as YYYY-MM-DD in the traveller's own timezone.
 *
 * `toISOString()` converts to UTC first, which rolls the date back by one day
 * for anyone east of Greenwich - clicking 15 November in India would book the
 * 14th. Reading the local components avoids that entirely.
 */
export function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
