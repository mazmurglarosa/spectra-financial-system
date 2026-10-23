/**
 * Utility to format fiscal period display cleanly without repeating the year
 * e.g. "Oktober 2026" + 2026 -> "Oktober 2026"
 *      "Oktober" + 2026 -> "Oktober 2026"
 */
export function formatPeriodDisplay(fiscalPeriod?: string, fiscalYear?: number | string): string {
  if (!fiscalPeriod) return fiscalYear ? String(fiscalYear) : '';
  const yStr = fiscalYear ? String(fiscalYear) : '';
  if (yStr && fiscalPeriod.includes(yStr)) {
    return fiscalPeriod;
  }
  return yStr ? `${fiscalPeriod} ${yStr}` : fiscalPeriod;
}
