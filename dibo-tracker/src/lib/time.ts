import { differenceInMinutes, format, startOfDay } from "date-fns";

// The tracker's day rolls over at 3am, so a 1am walk still counts toward the night before.
export const DAY_RESET_HOUR = 3;

// Allow for the Pi's clock and a phone's clock disagreeing a little.
const FUTURE_GRACE_MS = 60_000;

export type Period = "AM" | "PM";

/** Midnight of the tracker day that `d` belongs to. */
export function trackerDay(d: Date): Date {
  const shifted = new Date(d);
  shifted.setHours(shifted.getHours() - DAY_RESET_HOUR);
  return startOfDay(shifted);
}

export function isSameTrackerDay(a: Date, b: Date): boolean {
  return trackerDay(a).getTime() === trackerDay(b).getTime();
}

export function isInFuture(d: Date): boolean {
  return d.getTime() > Date.now() + FUTURE_GRACE_MS;
}

export function formatClock(d: Date): string {
  return format(d, "h:mm a");
}

export function formatAgo(from: Date, now: Date): string {
  const minutes = Math.max(0, differenceInMinutes(now, from));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h ago` : `${h}h ${m}m ago`;
}

// Keypad entry is up to four digits read right-aligned, like a microwave: "930" is 9:30.

export function digitsFromDate(d: Date): string {
  return format(d, "hhmm");
}

export function periodFromDate(d: Date): Period {
  return d.getHours() < 12 ? "AM" : "PM";
}

export function formatDigits(digits: string): string {
  if (digits.length === 0) return "__:__";
  const padded = digits.padStart(4, "0");
  return `${padded.slice(0, 2)}:${padded.slice(2)}`;
}

/**
 * Turns keypad input into a time on the same tracker day as `anchor`.
 * Hours before the 3am reset land on the next calendar date, so 11:50 PM and
 * 12:10 AM on the same night end up 20 minutes apart rather than a day apart.
 */
export function resolveKeypadTime(digits: string, period: Period, anchor: Date): Date | null {
  if (digits.length === 0 || digits.length > 4) return null;
  const padded = digits.padStart(4, "0");
  const hour12 = Number(padded.slice(0, 2));
  const minutes = Number(padded.slice(2));
  if (hour12 < 1 || hour12 > 12 || minutes > 59) return null;

  const hours = (hour12 % 12) + (period === "PM" ? 12 : 0);
  const result = trackerDay(anchor);
  if (hours < DAY_RESET_HOUR) result.setDate(result.getDate() + 1);
  result.setHours(hours, minutes, 0, 0);
  return result;
}
