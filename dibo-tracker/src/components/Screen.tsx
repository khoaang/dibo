import { useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useDragScroll } from "../hooks/useDragScroll";

type ScreenProps = {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
};

/** Full-screen sub-page with a title and a close button. */
export function Screen({ title, onClose, children }: ScreenProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useDragScroll(scrollRef);

  return (
    <div ref={scrollRef} className="flex h-dvh flex-col overflow-y-auto px-5 pb-4 pt-3">
      <header className="mb-3 flex items-center justify-between gap-4">
        <h1 className="min-w-0 truncate text-2xl font-extrabold tracking-tight">{title}</h1>
        <button
          onClick={onClose}
          aria-label="Close"
          className="-mr-1 inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-surface text-muted active:bg-surface-press"
        >
          <X className="size-6" />
        </button>
      </header>
      {children}
    </div>
  );
}
