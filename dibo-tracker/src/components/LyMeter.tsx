import { useRef, type PointerEvent } from "react";

type LyMeterProps = {
  level: number;
  onChange: (level: number) => void;
};

/** Vertical drag slider: top is lỳ (stubborn), bottom is ngoan (good). */
export function LyMeter({ level, onChange }: LyMeterProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const updateFromPointer = (e: PointerEvent) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const y = Math.min(rect.bottom, Math.max(rect.top, e.clientY));
    onChange(((rect.bottom - y) / rect.height) * 100);
  };

  return (
    <aside className="flex w-14 shrink-0 flex-col items-center text-sm font-extrabold">
      <div className="text-on-alert">Lỳ</div>
      {/* The whole column is the touch target, not just the thin bar. */}
      <div
        ref={trackRef}
        className="relative my-3 flex w-full flex-1 touch-none justify-center"
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          updateFromPointer(e);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) updateFromPointer(e);
        }}
      >
        <div className="h-full w-2.5 rounded-full bg-linear-to-b from-rose-400 via-amber-300 to-emerald-400" />
        <div
          className="pointer-events-none absolute left-1/2 h-4 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink shadow-md ring-[3px] ring-canvas"
          style={{ top: `${100 - level}%` }}
        />
      </div>
      <div className="text-on-good">Ngoan</div>
      <div className="font-bold tabular-nums text-muted">{level}%</div>
    </aside>
  );
}
