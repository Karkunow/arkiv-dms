const UNITS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3_600,
  d: 86_400,
  w: 604_800,
};

/**
 * Parse a human-readable TTL string into seconds.
 * Examples: "20s", "5m", "1h", "7d"
 */
export function parseTTL(input: string): number {
  const match = input.trim().match(/^(\d+)(s|m|h|d|w)$/);
  if (!match) {
    throw new Error(
      `Invalid TTL '${input}'. Use format: 20s, 5m, 1h, 7d, 2w`
    );
  }
  return parseInt(match[1], 10) * UNITS[match[2]];
}

/** Format seconds into a human-readable string. */
export function formatTTL(seconds: number): string {
  if (seconds <= 0) return "expired";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h`;
  return `${Math.floor(seconds / 86_400)}d`;
}
