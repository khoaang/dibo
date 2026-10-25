import type { ReactNode } from "react";
import { ChevronRight, Settings } from "lucide-react";
import type { MealType, Profile, SyncStatus, TrackerEvent } from "../hooks/useTracker";
import { formatAgo, formatClock, isSameTrackerDay } from "../lib/time";
import { LyMeter } from "./LyMeter";
import { PixelDog, type DogMood } from "./PixelDog";

type DashboardProps = {
  now: Date;
  events: TrackerEvent[];
  profile: Profile;
  syncStatus: SyncStatus;
  lyLevel: number;
  onLyChange: (level: number) => void;
  onToggleMeal: (type: MealType) => void;
  onOpenWalks: () => void;
  onOpenSettings: () => void;
};

// The badge shifts color as the gap since the last walk grows (in hours).
function walkTone(hoursSince: number | null): string {
  if (hoursSince === null || hoursSince >= 8) return "bg-alert text-on-alert";
  if (hoursSince >= 6) return "bg-late text-on-late";
  if (hoursSince >= 4) return "bg-warn text-on-warn";
  return "bg-good text-on-good";
}

function dogMood(hoursSinceWalk: number | null, now: Date): DogMood {
  if (hoursSinceWalk === null || hoursSinceWalk >= 8) return "needs";
  const hour = now.getHours();
  if (hour >= 22 || hour < 6) return "sleepy";
  if (hoursSinceWalk >= 4) return "antsy";
  return "happy";
}

const DOG_SAYS: Record<DogMood, string> = {
  happy: "All good!",
  antsy: "Walk soon?",
  needs: "Walk me!",
  sleepy: "Zzz…",
};

// Only shown when something is off; a healthy connection needs no badge.
const SYNC_WARNING: Partial<Record<SyncStatus, string>> = {
  local: "Offline",
  connecting: "Connecting…",
  error: "Not syncing",
};

export function Dashboard({
  now,
  events,
  profile,
  syncStatus,
  lyLevel,
  onLyChange,
  onToggleMeal,
  onOpenWalks,
  onOpenSettings,
}: DashboardProps) {
  const today = events.filter((item) => isSameTrackerDay(item.time, now));
  const lastWalk = events.find((item) => item.type === "di_bo");
  const pooped = today.some((item) => item.type === "di_bo" && item.pooped);
  const hadBreakfast = today.some((item) => item.type === "an_sang");
  const hadDinner = today.some((item) => item.type === "an_chieu");
  const hoursSinceWalk = lastWalk ? (now.getTime() - lastWalk.time.getTime()) / 3_600_000 : null;
  const mood = dogMood(hoursSinceWalk, now);
  const pronoun = profile.gender === "female" ? "she" : "he";
  const syncWarning = SYNC_WARNING[syncStatus];

  return (
    <div className="flex h-dvh gap-5 py-4 pl-5 pr-3">
      <main className="flex min-w-0 flex-1 flex-col justify-between">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label>
              Now
              {syncWarning && (
                <span className={`ml-2 normal-case tracking-normal ${syncStatus === "error" ? "text-on-alert" : "text-on-warn"}`}>
                  · {syncWarning}
                </span>
              )}
            </Label>
            <div className="text-[clamp(2.75rem,min(15vh,12vw),8rem)] whitespace-nowrap font-extrabold leading-none tracking-tight tabular-nums">
              {formatClock(now)}
            </div>
          </div>

          <div className="-mr-2 -mt-2 flex items-start">
            <button onClick={onOpenWalks} className="flex items-center gap-3 pt-2" aria-label={`${profile.name}: ${DOG_SAYS[mood]}`}>
              <span className="relative rounded-xl bg-surface px-3 py-1.5 text-base font-bold text-ink max-[520px]:hidden">
                {DOG_SAYS[mood]}
                <span className="absolute -right-1 top-1/2 size-2.5 -translate-y-1/2 rotate-45 rounded-[2px] bg-surface" />
              </span>
              <PixelDog mood={mood} className="h-[clamp(4.25rem,21vh,9rem)]" />
            </button>
            <button
              onClick={onOpenSettings}
              aria-label="Settings"
              className="inline-flex size-11 items-center justify-center rounded-full text-faint active:bg-surface"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>

        <div>
          <Label>
            {profile.name}'s last walk
            {lastWalk && <span className="ml-2 font-bold normal-case tracking-normal text-ink">{formatAgo(lastWalk.time, now)}</span>}
          </Label>
          <div className="flex flex-wrap gap-3">
            <div
              className={`shrink-0 whitespace-nowrap rounded-2xl px-4 py-1.5 text-[clamp(3rem,min(18vh,13vw),10rem)] font-extrabold leading-none tracking-tight tabular-nums ${walkTone(hoursSinceWalk)}`}
            >
              {lastWalk ? formatClock(lastWalk.time) : "None yet"}
            </div>
            <button
              onClick={onOpenWalks}
              className="flex min-h-14 min-w-32 flex-1 items-center justify-center gap-1 rounded-2xl bg-accent text-xl font-extrabold text-on-accent active:bg-accent-press"
            >
              Walks
              <ChevronRight size={24} strokeWidth={2.75} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <StatusTile label={`Did ${pronoun} poop?`} done={pooped} onClick={onOpenWalks} />
          <StatusTile label="Breakfast" done={hadBreakfast} onClick={() => onToggleMeal("an_sang")} />
          <StatusTile label="Dinner" done={hadDinner} onClick={() => onToggleMeal("an_chieu")} />
        </div>
      </main>

      <LyMeter level={lyLevel} onChange={onLyChange} />
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <div className="mb-1.5 text-base font-semibold uppercase tracking-wide text-muted">{children}</div>;
}

function StatusTile({ label, done, onClick }: { label: string; done: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl px-4 py-2.5 text-left transition-transform active:scale-[0.97] ${
        done ? "bg-good text-on-good" : "bg-alert text-on-alert"
      }`}
    >
      <div className="truncate text-base font-semibold opacity-80">{label}</div>
      <div className="text-[clamp(1.5rem,5vw,2.5rem)] font-extrabold leading-tight">{done ? "Yes" : "Not yet"}</div>
    </button>
  );
}
