import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { ArrowLeft, Footprints, MoonStar, Sun, Trash2 } from "lucide-react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "./lib/firebase";

type EventType = "an_sang" | "di_bo" | "an_chieu";
type View = "home" | "walk";

type EventItem = {
  id: string;
  type: EventType;
  time: Date;
  peed?: boolean;
  pooped?: boolean;
};

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getMealButtonClass(lastEvent: EventItem | undefined, now: Date): string {
  if (!lastEvent) return "bg-rose-500 text-white";
  return isSameDay(lastEvent.time, now) ? "bg-emerald-500 text-white" : "bg-rose-500 text-white";
}

function getWalkButtonClass(lastEvent: EventItem | undefined, now: Date): string {
  if (!lastEvent) return "bg-slate-400 text-white";
  const hours = (now.getTime() - lastEvent.time.getTime()) / (1000 * 60 * 60);
  if (hours < 4) return "bg-emerald-500 text-white";
  if (hours < 8) return "bg-amber-500 text-white";
  return "bg-rose-500 text-white";
}

function App() {
  const [now, setNow] = useState(new Date());
  const [view, setView] = useState<View>("home");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [lyMeter, setLyMeter] = useState(20);
  const [walkPee, setWalkPee] = useState(false);
  const [walkPoop, setWalkPoop] = useState(false);
  const lyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;

    const eventsQuery = query(collection(db, "events"), orderBy("time", "desc"));
    const unsubEvents = onSnapshot(eventsQuery, (snapshot) => {
      const nextEvents: EventItem[] = snapshot.docs.map((entry) => {
        const data = entry.data();
        const rawTime = data.time;
        const time =
          rawTime instanceof Timestamp
            ? rawTime.toDate()
            : rawTime?.toDate
              ? rawTime.toDate()
              : new Date();
        return {
          id: entry.id,
          type: data.type as EventType,
          time,
          peed: Boolean(data.peed),
          pooped: Boolean(data.pooped),
        };
      });
      setEvents(nextEvents);
    });

    const lyRef = doc(db, "state", "ly");
    const unsubLy = onSnapshot(lyRef, (snap) => {
      if (!snap.exists()) return;
      const value = Number(snap.data().value);
      if (!Number.isNaN(value)) setLyMeter(Math.max(0, Math.min(100, value)));
    });

    return () => {
      unsubEvents();
      unsubLy();
    };
  }, []);

  const queueLySync = (value: number) => {
    const firestore = db;
    if (!isFirebaseConfigured || !firestore) return;
    if (lyDebounceRef.current) clearTimeout(lyDebounceRef.current);
    lyDebounceRef.current = setTimeout(() => {
      void setDoc(doc(firestore, "state", "ly"), {
        value,
        updatedAt: Timestamp.now(),
      });
    }, 180);
  };

  const setLyValue = (value: number) => {
    const normalized = Math.max(0, Math.min(100, value));
    setLyMeter(normalized);
    queueLySync(normalized);
  };

  const addMealEvent = (type: "an_sang" | "an_chieu") => {
    const time = new Date();
    const todayMealLogs = events.filter((item) => item.type === type && isSameDay(item.time, time));

    const firestore = db;
    if (!isFirebaseConfigured || !firestore) {
      setEvents((prev) => {
        const withoutTodayMeal = prev.filter(
          (item) => !(item.type === type && isSameDay(item.time, time))
        );
        return [{ id: `${type}-${time.getTime()}`, type, time }, ...withoutTodayMeal];
      });
      return;
    }

    void (async () => {
      await Promise.all(todayMealLogs.map((item) => deleteDoc(doc(firestore, "events", item.id))));
      await addDoc(collection(firestore, "events"), {
        type,
        time: Timestamp.fromDate(time),
      });
    })();
  };

  const saveWalkEvent = () => {
    const time = new Date();
    const firestore = db;
    if (!isFirebaseConfigured || !firestore) {
      setEvents((prev) => [
        {
          id: `di_bo-${time.getTime()}`,
          type: "di_bo",
          time,
          peed: walkPee,
          pooped: walkPoop,
        },
        ...prev,
      ]);
    } else {
      void addDoc(collection(firestore, "events"), {
        type: "di_bo",
        time: Timestamp.fromDate(time),
        peed: walkPee,
        pooped: walkPoop,
      });
    }
    setWalkPee(false);
    setWalkPoop(false);
    setView("home");
  };

  const removeEvent = (id: string) => {
    const firestore = db;
    if (!isFirebaseConfigured || !firestore) {
      setEvents((prev) => prev.filter((item) => item.id !== id));
      return;
    }
    void deleteDoc(doc(firestore, "events", id));
  };

  const lastAnSang = events.find((item) => item.type === "an_sang");
  const lastDiBo = events.find((item) => item.type === "di_bo");
  const lastAnChieu = events.find((item) => item.type === "an_chieu");
  const todayWalks = events.filter((item) => item.type === "di_bo" && isSameDay(item.time, now));
  const lastAnSangText = lastAnSang ? format(lastAnSang.time, "HH:mm") : "--";
  const lastDiBoText = lastDiBo ? format(lastDiBo.time, "HH:mm") : "--";
  const lastAnChieuText = lastAnChieu ? format(lastAnChieu.time, "HH:mm") : "--";

  if (view === "walk") {
    return (
      <div className="min-h-screen bg-[#f7f7f5] p-[clamp(0.75rem,1.6vw,1.25rem)] font-mono text-[#1f2937]">
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.14),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(16,185,129,0.08),transparent_45%),repeating-linear-gradient(0deg,rgba(15,23,42,0.03)_0_1px,transparent_1px_18px),repeating-linear-gradient(90deg,rgba(15,23,42,0.03)_0_1px,transparent_1px_18px)]" />
        <div className="mx-auto w-full max-w-[min(100%,56rem)]">
          <button
            onClick={() => setView("home")}
            className="mb-[clamp(0.6rem,1.5vw,1rem)] inline-flex h-[clamp(2.75rem,6vw,3.5rem)] items-center gap-2 rounded-lg border-2 border-slate-300/70 bg-white/90 px-[clamp(0.9rem,2.2vw,1.4rem)] text-[clamp(0.95rem,1.8vw,1.15rem)] font-medium shadow-[4px_4px_0_rgba(15,23,42,0.12)] backdrop-blur-sm transition hover:translate-x-px hover:translate-y-px hover:shadow-[3px_3px_0_rgba(15,23,42,0.12)]"
          >
            <ArrowLeft size={18} />
            Quay lại
          </button>

          <section className="rounded-2xl border-2 border-sky-100/90 bg-white/90 p-[clamp(0.95rem,2.4vw,1.5rem)] shadow-[6px_6px_0_rgba(14,116,144,0.12)] backdrop-blur-md">
            <h1 className="mb-[clamp(0.75rem,1.8vw,1.2rem)] text-[clamp(1.45rem,3vw,2.15rem)] font-semibold tracking-wide text-slate-800">
              Log đi bộ
            </h1>

            <div className="mb-[clamp(0.75rem,1.9vw,1.2rem)]">
              <p className="mb-2 text-[clamp(0.95rem,1.9vw,1.1rem)] font-medium text-slate-600">Bé có đái không?</p>
              <button
                onClick={() => setWalkPee((v) => !v)}
                className={`h-[clamp(3.2rem,8vw,4.2rem)] w-full rounded-2xl text-[clamp(1rem,2.2vw,1.25rem)] font-medium transition ${
                  walkPee
                    ? "border-2 border-emerald-700/30 bg-emerald-500 text-white shadow-[4px_4px_0_rgba(5,150,105,0.32)]"
                    : "border-2 border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {walkPee ? "Có đái" : "Chưa đái"}
              </button>
            </div>

            <div className="mb-[clamp(0.95rem,2.2vw,1.35rem)]">
              <p className="mb-2 text-[clamp(0.95rem,1.9vw,1.1rem)] font-medium text-slate-600">Bé có ỉa không?</p>
              <button
                onClick={() => setWalkPoop((v) => !v)}
                className={`h-[clamp(3.2rem,8vw,4.2rem)] w-full rounded-2xl text-[clamp(1rem,2.2vw,1.25rem)] font-medium transition ${
                  walkPoop
                    ? "border-2 border-amber-700/30 bg-amber-500 text-white shadow-[4px_4px_0_rgba(217,119,6,0.3)]"
                    : "border-2 border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {walkPoop ? "Có ỉa" : "Chưa ỉa"}
              </button>
            </div>

            <button
              onClick={saveWalkEvent}
              className="h-[clamp(3.2rem,8vw,4.2rem)] w-full rounded-2xl border-2 border-sky-900/20 bg-sky-600 text-[clamp(1rem,2.3vw,1.25rem)] font-semibold text-white shadow-[4px_4px_0_rgba(3,105,161,0.36)] transition hover:bg-sky-500"
            >
              Lưu log đi bộ
            </button>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f5] p-[clamp(0.75rem,1.6vw,1.25rem)] font-mono text-[#1f2937]">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,rgba(14,165,233,0.16),transparent_52%),radial-gradient(ellipse_at_bottom_left,rgba(16,185,129,0.08),transparent_48%),repeating-linear-gradient(0deg,rgba(15,23,42,0.03)_0_1px,transparent_1px_18px),repeating-linear-gradient(90deg,rgba(15,23,42,0.03)_0_1px,transparent_1px_18px)]" />
      <div className="mx-auto w-full max-w-[min(100%,96rem)]">
        <div className="mb-[clamp(0.7rem,1.6vw,1.25rem)] flex items-center justify-end text-right">
          <div>
            <div className="text-[clamp(2rem,6vw,4.25rem)] font-semibold leading-none tracking-tight text-slate-800 [text-shadow:2px_2px_0_rgba(125,211,252,0.25)]">
              {format(now, "HH:mm")}
            </div>
            <div className="mt-1 text-[clamp(0.8rem,1.7vw,1.05rem)] uppercase tracking-[0.12em] text-slate-500">
              {format(now, "dd/MM", { locale: vi })}
            </div>
          </div>
        </div>

        <main className="grid gap-[clamp(0.65rem,1.5vw,1rem)] lg:grid-cols-12">
          <MealsPanel
            anSangClass={getMealButtonClass(lastAnSang, now)}
            anChieuClass={getMealButtonClass(lastAnChieu, now)}
            anSangTime={lastAnSangText}
            anChieuTime={lastAnChieuText}
            onAnSang={() => addMealEvent("an_sang")}
            onAnChieu={() => addMealEvent("an_chieu")}
          />

          <div className="rounded-2xl border-2 border-cyan-100/90 bg-white/90 p-[clamp(0.75rem,1.8vw,1.2rem)] shadow-[6px_6px_0_rgba(15,23,42,0.1)] backdrop-blur-md lg:col-span-8">
            <div className="mb-2 text-[clamp(0.95rem,1.8vw,1.15rem)] font-semibold uppercase tracking-widest text-slate-700">
              Đi bộ hôm nay
            </div>
            <WalkPill
              title="Đi bộ"
              icon={<Footprints size={18} />}
              buttonClass={getWalkButtonClass(lastDiBo, now)}
              lastTime={lastDiBoText}
              todayWalks={todayWalks}
              onPress={() => setView("walk")}
              onRemove={removeEvent}
            />
          </div>
        </main>

        <section className="mt-[clamp(0.8rem,1.8vw,1.35rem)] rounded-2xl border-2 border-violet-100/90 bg-white/90 p-[clamp(0.95rem,2.2vw,1.5rem)] shadow-[6px_6px_0_rgba(76,29,149,0.12)] backdrop-blur-md">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[clamp(1.1rem,2.1vw,1.55rem)] font-semibold uppercase tracking-[0.08em]">Lỳ meter</h2>
            <span className="text-[clamp(1.1rem,2.1vw,1.55rem)] font-semibold">{lyMeter}%</span>
          </div>

          <div className="relative mb-4 h-[clamp(2.8rem,7vw,3.6rem)]">
            <div className="absolute inset-x-0 top-1/2 h-[clamp(0.85rem,1.9vw,1.2rem)] -translate-y-1/2 rounded-full bg-linear-to-r from-emerald-500 via-amber-400 to-rose-500" />
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={lyMeter}
              onChange={(e) => setLyValue(Number(e.target.value))}
              className="absolute inset-0 h-full w-full cursor-pointer touch-none appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-[clamp(0.85rem,1.9vw,1.2rem)] [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:mt-[-11px] [&::-webkit-slider-thumb]:h-10 [&::-webkit-slider-thumb]:w-10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-md [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-slate-900 [&::-webkit-slider-thumb]:shadow-[3px_3px_0_rgba(15,23,42,0.45)] [&::-moz-range-track]:h-[clamp(0.85rem,1.9vw,1.2rem)] [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:h-10 [&::-moz-range-thumb]:w-10 [&::-moz-range-thumb]:rounded-md [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-slate-900 [&::-moz-range-thumb]:shadow-[3px_3px_0_rgba(15,23,42,0.45)]"
              aria-label="Lỳ meter"
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function MealsPanel({
  anSangClass,
  anChieuClass,
  anSangTime,
  anChieuTime,
  onAnSang,
  onAnChieu,
}: {
  anSangClass: string;
  anChieuClass: string;
  anSangTime: string;
  anChieuTime: string;
  onAnSang: () => void;
  onAnChieu: () => void;
}) {
  return (
    <div className="rounded-2xl border-2 border-sky-100/90 bg-linear-to-br from-sky-50/90 to-indigo-50/85 p-[clamp(0.6rem,1.4vw,1rem)] shadow-[6px_6px_0_rgba(14,116,144,0.14)] backdrop-blur-md lg:col-span-4">
      <div className="mb-2 px-1 text-[clamp(0.95rem,1.8vw,1.15rem)] font-semibold uppercase tracking-widest text-slate-700">
        Bữa ăn
      </div>
      <button
        onClick={onAnSang}
        className={`flex h-[clamp(2.7rem,6vw,3.4rem)] w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-900/10 text-[clamp(0.95rem,1.8vw,1.15rem)] font-semibold shadow-[3px_3px_0_rgba(15,23,42,0.14)] transition hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_rgba(15,23,42,0.14)] ${anSangClass}`}
      >
        <Sun size={18} />
        Ăn sáng
      </button>
      <div className="mb-2 mt-1 text-center text-[clamp(1.45rem,3.3vw,2.35rem)] font-bold tracking-tight text-slate-700">
        {anSangTime}
      </div>

      <button
        onClick={onAnChieu}
        className={`flex h-[clamp(2.7rem,6vw,3.4rem)] w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-900/10 text-[clamp(0.95rem,1.8vw,1.15rem)] font-semibold shadow-[3px_3px_0_rgba(15,23,42,0.14)] transition hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_rgba(15,23,42,0.14)] ${anChieuClass}`}
      >
        <MoonStar size={18} />
        Ăn chiều
      </button>
      <div className="mt-1 text-center text-[clamp(1.45rem,3.3vw,2.35rem)] font-bold tracking-tight text-slate-700">
        {anChieuTime}
      </div>
    </div>
  );
}

function WalkPill({
  title,
  icon,
  buttonClass,
  lastTime,
  todayWalks,
  onPress,
  onRemove,
}: {
  title: string;
  icon: React.ReactNode;
  buttonClass: string;
  lastTime: string;
  todayWalks: EventItem[];
  onPress: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div>
      <button
        onClick={onPress}
        className={`flex h-[clamp(3.2rem,8vw,4.2rem)] w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-900/10 text-[clamp(1rem,2.2vw,1.25rem)] font-semibold shadow-[4px_4px_0_rgba(15,23,42,0.2)] transition hover:translate-x-px hover:translate-y-px hover:shadow-[3px_3px_0_rgba(15,23,42,0.2)] ${buttonClass}`}
      >
        {icon}
        {title}
      </button>
      <div className="mt-1 text-center text-[clamp(1.6rem,4.2vw,2.85rem)] font-bold tracking-tight text-slate-700">
        {lastTime}
      </div>

      <div className="mt-2 max-h-[clamp(14rem,36vh,24rem)] overflow-auto rounded-xl border-2 border-slate-200/80 bg-white/80 p-[clamp(0.45rem,1vw,0.75rem)]">
        {todayWalks.length === 0 ? (
          <div className="px-2 py-2 text-[clamp(0.9rem,1.8vw,1.08rem)] text-slate-400">Chưa có đi bộ hôm nay</div>
        ) : null}
        {todayWalks.map((item) => (
          <div key={item.id} className="mb-1 flex items-center justify-between rounded-lg border-2 border-slate-200/70 bg-white px-2 py-[clamp(0.4rem,1.1vw,0.6rem)] shadow-[2px_2px_0_rgba(15,23,42,0.08)] last:mb-0">
            <div className="flex items-center gap-2 text-[clamp(0.9rem,1.8vw,1.08rem)]">
              <span className="font-semibold">{format(item.time, "HH:mm")}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[clamp(0.75rem,1.6vw,0.95rem)] text-slate-600">
                {(item.peed ? "Đái" : "") +
                  (item.peed && item.pooped ? ", " : "") +
                  (item.pooped ? "Ỉa" : "") || "Không"}
              </span>
            </div>
            <button
              onClick={() => onRemove(item.id)}
              className="rounded border border-transparent p-1 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-500"
              aria-label="Xóa log"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
