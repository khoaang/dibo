export type Theme = "day" | "night";

// Light theme from 7am to 7pm, dim theme otherwise so the screen doesn't glow at night.
const DAY_START_HOUR = 7;
const NIGHT_START_HOUR = 19;

export function themeForTime(d: Date): Theme {
  const hour = d.getHours();
  return hour >= DAY_START_HOUR && hour < NIGHT_START_HOUR ? "day" : "night";
}
