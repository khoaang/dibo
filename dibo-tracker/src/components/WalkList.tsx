import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { TrackerEvent } from "../hooks/useTracker";
import { formatClock } from "../lib/time";
import { Screen } from "./Screen";

type WalkListProps = {
  walks: TrackerEvent[];
  onNew: () => void;
  onEdit: (walk: TrackerEvent) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

export function WalkList({ walks, onNew, onEdit, onDelete, onClose }: WalkListProps) {
  // Deleting takes two taps so a stray touch doesn't lose a walk.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  return (
    <Screen title="Today's walks" onClose={onClose}>
      <button
        onClick={onNew}
        className="mb-2 inline-flex h-14 w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-accent text-xl font-extrabold text-on-accent active:bg-accent-press"
      >
        <Plus className="size-6" strokeWidth={2.75} />
        Log a walk
      </button>

      {walks.length === 0 ? (
        <p className="py-10 text-center text-lg text-muted">No walks yet today.</p>
      ) : (
        <ul className="divide-y divide-line">
          {walks.map((walk) => (
            <li key={walk.id} className="flex items-center gap-4 py-2.5">
              <span className="w-[5.5em] text-3xl font-extrabold tabular-nums">{formatClock(walk.time)}</span>
              <span className="flex-1 text-2xl">
                {walk.peed && <span aria-label="Peed">💦</span>}
                {walk.pooped && <span aria-label="Pooped">💩</span>}
                {!walk.peed && !walk.pooped && <span className="text-base text-faint">Nothing</span>}
              </span>
              <button
                onClick={() => onEdit(walk)}
                className="inline-flex h-12 w-28 items-center justify-center gap-2 rounded-xl bg-surface text-lg font-semibold active:bg-surface-press"
              >
                <Pencil className="size-4.5" />
                Edit
              </button>
              {confirmingId === walk.id ? (
                <button
                  onClick={() => onDelete(walk.id)}
                  onBlur={() => setConfirmingId(null)}
                  className="h-12 w-28 rounded-xl bg-rose-600 text-lg font-bold text-white active:bg-rose-500"
                >
                  Delete?
                </button>
              ) : (
                <button
                  onClick={() => setConfirmingId(walk.id)}
                  aria-label="Delete walk"
                  className="inline-flex h-12 w-28 items-center justify-center rounded-xl bg-surface text-on-alert active:bg-surface-press"
                >
                  <Trash2 className="size-5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}
