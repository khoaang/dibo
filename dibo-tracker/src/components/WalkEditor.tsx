import { useState } from "react";
import { Delete } from "lucide-react";
import type { TrackerEvent, WalkFields } from "../hooks/useTracker";
import {
  digitsFromDate,
  formatClock,
  formatDigits,
  isInFuture,
  periodFromDate,
  resolveKeypadTime,
  type Period,
} from "../lib/time";
import { Screen } from "./Screen";

type WalkEditorProps = {
  /** The walk being edited, or undefined for a new one. */
  walk?: TrackerEvent;
  onSave: (fields: WalkFields) => void;
  onClose: () => void;
};

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function WalkEditor({ walk, onSave, onClose }: WalkEditorProps) {
  const [digits, setDigits] = useState(() => digitsFromDate(walk?.time ?? new Date()));
  const [period, setPeriod] = useState<Period>(() => periodFromDate(walk?.time ?? new Date()));
  // The first keypress replaces the prefilled time instead of appending to it.
  const [hasTyped, setHasTyped] = useState(false);
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [peed, setPeed] = useState(walk?.peed ?? false);
  const [pooped, setPooped] = useState(walk?.pooped ?? false);
  const [error, setError] = useState<string | null>(null);

  const editDigits = (next: string) => {
    setDigits(next);
    setHasTyped(true);
    setError(null);
  };

  const pressDigit = (digit: string) => {
    if (!hasTyped) return editDigits(digit);
    if (digits.length < 4) editDigits(digits + digit);
  };

  const backspace = () => editDigits(hasTyped ? digits.slice(0, -1) : "");

  const resetToNow = () => {
    const current = new Date();
    setDigits(digitsFromDate(current));
    setPeriod(periodFromDate(current));
    setHasTyped(false);
    setError(null);
  };

  const choosePeriod = (p: Period) => {
    setPeriod(p);
    setError(null);
  };

  // New walks land on today; edits stay on the walk's original day.
  const resolve = () => resolveKeypadTime(digits, period, walk?.time ?? new Date());

  const closeKeypad = () => {
    if (resolve()) setKeypadOpen(false);
    else setError("That isn't a valid time");
  };

  const save = () => {
    const time = resolve();
    if (!time) return setError("That isn't a valid time");
    if (isInFuture(time)) return setError("That time hasn't happened yet");
    onSave({ time, peed, pooped });
  };

  const timeColor = resolve() ? "text-ink" : "text-faint";
  const title = walk ? `Edit ${formatClock(walk.time)} walk` : "Log a walk";

  const periodButtons = (
    <div className="grid grid-cols-2 gap-2">
      {(["AM", "PM"] as const).map((p) => (
        <button
          key={p}
          onClick={() => choosePeriod(p)}
          className={`h-12 rounded-xl text-lg font-extrabold ${
            period === p ? "bg-accent text-on-accent" : "bg-surface text-muted active:bg-surface-press"
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );

  const errorBanner = error && (
    <div className="rounded-xl bg-alert px-3 py-2 text-center text-lg font-bold text-on-alert">{error}</div>
  );

  if (keypadOpen) {
    const keyClass = "rounded-xl bg-surface font-extrabold text-ink active:bg-surface-press";
    return (
      <Screen title={title} onClose={onClose}>
        <div className="flex min-h-0 flex-1 flex-col gap-3 landscape:flex-row">
          <div className="flex flex-col gap-2 landscape:w-2/5">
            <div className={`text-[clamp(3rem,18vh,6rem)] font-extrabold leading-none tracking-tight tabular-nums ${timeColor}`}>
              {formatDigits(digits)}
            </div>
            {periodButtons}
            {errorBanner}
            <div className="mt-auto grid grid-cols-2 gap-2">
              <button onClick={resetToNow} className="h-12 rounded-xl bg-surface text-lg font-bold text-ink active:bg-surface-press">
                Now
              </button>
              <button onClick={closeKeypad} className="h-12 rounded-xl bg-accent text-lg font-extrabold text-on-accent active:bg-accent-press">
                Done
              </button>
            </div>
          </div>

          <div className="grid min-h-48 flex-1 auto-rows-fr grid-cols-3 gap-1.5">
            {KEYS.map((key) => (
              <button key={key} onClick={() => pressDigit(key)} className={`${keyClass} text-3xl`}>
                {key}
              </button>
            ))}
            <button onClick={() => editDigits("")} className={`${keyClass} text-lg text-muted`}>
              Clear
            </button>
            <button onClick={() => pressDigit("0")} className={`${keyClass} text-3xl`}>
              0
            </button>
            <button onClick={backspace} aria-label="Backspace" className={`${keyClass} flex items-center justify-center text-muted`}>
              <Delete size={28} />
            </button>
          </div>
        </div>
      </Screen>
    );
  }

  return (
    <Screen title={title} onClose={onClose}>
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setKeypadOpen(true)}
            className="flex flex-1 items-baseline gap-3 rounded-2xl bg-surface px-4 py-2 text-left active:bg-surface-press"
          >
            <span className={`text-[clamp(3rem,16vh,6rem)] font-extrabold leading-none tracking-tight tabular-nums ${timeColor}`}>
              {formatDigits(digits)}
            </span>
            <span className="text-base font-semibold text-muted">Tap to change</span>
          </button>
          <div className="w-40">{periodButtons}</div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Toggle on={peed} onClick={() => setPeed((v) => !v)} label="💦 Pee" />
          <Toggle on={pooped} onClick={() => setPooped((v) => !v)} label="💩 Poop" />
        </div>

        {errorBanner}

        <button
          onClick={save}
          className="mt-auto h-14 w-full rounded-2xl bg-accent text-2xl font-extrabold text-on-accent active:bg-accent-press"
        >
          {walk ? "Save changes" : "Save walk"}
        </button>
      </div>
    </Screen>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`flex h-14 items-center justify-between rounded-2xl px-4 text-xl font-extrabold ${
        on ? "bg-good text-on-good" : "bg-surface text-muted active:bg-surface-press"
      }`}
    >
      {label}
      <span className="text-base font-bold">{on ? "Yes" : "No"}</span>
    </button>
  );
}
