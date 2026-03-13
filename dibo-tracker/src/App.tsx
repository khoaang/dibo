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
      <div className="min-h-screen bg-[#f7f7f5] p-3 text-[#1f2937]">
        <div className="mx-auto max-w-3xl">
          <button
            onClick={() => setView("home")}
            className="mb-3 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-4 text-sm font-medium shadow-sm"
          >
            <ArrowLeft size={16} />
            Quay lại
          </button>

          <section className="rounded-3xl bg-white p-4 shadow-sm">
            <h1 className="mb-4 text-2xl font-semibold">Log đi bộ</h1>

            <div className="mb-3">
              <p className="mb-2 text-sm font-medium text-slate-600">Bé có đái không?</p>
              <button
                onClick={() => setWalkPee((v) => !v)}
                className={`h-14 w-full rounded-2xl text-base font-medium ${
                  walkPee ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                {walkPee ? "Có đái" : "Chưa đái"}
              </button>
            </div>

            <div className="mb-4">
              <p className="mb-2 text-sm font-medium text-slate-600">Bé có ỉa không?</p>
              <button
                onClick={() => setWalkPoop((v) => !v)}
                className={`h-14 w-full rounded-2xl text-base font-medium ${
                  walkPoop ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                {walkPoop ? "Có ỉa" : "Chưa ỉa"}
              </button>
            </div>

            <button
              onClick={saveWalkEvent}
              className="h-14 w-full rounded-2xl bg-sky-600 text-base font-semibold text-white"
            >
              Lưu log đi bộ
            </button>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f5] p-3 text-[#1f2937]">
      <div className="mx-auto max-w-6xl">
        <div className="mb-3 flex items-center justify-end text-right">
          <div>
            <div className="text-3xl font-semibold tracking-tight">{format(now, "HH:mm")}</div>
            <div className="text-xs text-slate-500">{format(now, "dd/MM", { locale: vi })}</div>
          </div>
        </div>

        <main className="grid gap-3 md:grid-cols-12">
          <MealsPanel
            anSangClass={getMealButtonClass(lastAnSang, now)}
            anChieuClass={getMealButtonClass(lastAnChieu, now)}
            anSangTime={lastAnSangText}
            anChieuTime={lastAnChieuText}
            onAnSang={() => addMealEvent("an_sang")}
            onAnChieu={() => addMealEvent("an_chieu")}
          />

          <div className="md:col-span-8 rounded-2xl bg-white p-3 shadow-sm">
            <div className="mb-2 text-sm font-semibold text-slate-700">Đi bộ hôm nay</div>
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

        <section className="mt-4 rounded-3xl bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Lỳ meter</h2>
            <span className="text-lg font-semibold">{lyMeter}%</span>
          </div>

          <div className="relative mb-4">
            <div className="h-4 rounded-full bg-linear-to-r from-emerald-500 via-amber-400 to-rose-500" />
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={lyMeter}
              onChange={(e) => setLyValue(Number(e.target.value))}
              className="absolute inset-0 h-4 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-4 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-slate-900 [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-track]:h-4 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-slate-900 [&::-moz-range-thumb]:shadow-md"
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
    <div className="md:col-span-4 rounded-2xl bg-[#eef6ff] p-2 shadow-sm">
      <div className="mb-2 px-1 text-sm font-semibold text-slate-700">Bữa ăn</div>
      <button
        onClick={onAnSang}
        className={`flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold ${anSangClass}`}
      >
        <Sun size={16} />
        Ăn sáng
      </button>
      <div className="mb-2 mt-1 text-center text-2xl font-bold tracking-tight text-slate-700">{anSangTime}</div>

      <button
        onClick={onAnChieu}
        className={`flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold ${anChieuClass}`}
      >
        <MoonStar size={16} />
        Ăn chiều
      </button>
      <div className="mt-1 text-center text-2xl font-bold tracking-tight text-slate-700">{anChieuTime}</div>
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
        className={`flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-semibold shadow-sm ${buttonClass}`}
      >
        {icon}
        {title}
      </button>
      <div className="mt-1 text-center text-3xl font-bold tracking-tight text-slate-700">{lastTime}</div>

      <div className="mt-2 max-h-56 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
        {todayWalks.length === 0 ? (
          <div className="px-2 py-2 text-sm text-slate-400">Chưa có đi bộ hôm nay</div>
        ) : null}
        {todayWalks.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-slate-50">
            <div className="flex items-center gap-2 text-sm">
              <span>{format(item.time, "HH:mm")}</span>
              <span className="text-xs text-slate-500">
                {(item.peed ? "Đái" : "") +
                  (item.peed && item.pooped ? ", " : "") +
                  (item.pooped ? "Ỉa" : "") || "Không"}
              </span>
            </div>
            <button
              onClick={() => onRemove(item.id)}
              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
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
