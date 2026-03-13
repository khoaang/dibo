import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Pencil, Settings, Trash2, X } from "lucide-react";
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
  updateDoc,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "./lib/firebase";

type EventType = "an_sang" | "di_bo" | "an_chieu";
type DogGender = "male" | "female";
type View = "dashboard" | "settings" | "walk";
type WalkMode = "new" | "edit";

type EventItem = {
  id: string;
  type: EventType;
  time: Date;
  peed?: boolean;
  pooped?: boolean;
};

type DogProfile = {
  name: string;
  gender: DogGender;
};

const DEFAULT_PROFILE: DogProfile = {
  name: "Carl",
  gender: "male",
};

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function clampPercentage(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function pronoun(gender: DogGender): string {
  return gender === "female" ? "she" : "he";
}

function statusFromFlags(peed?: boolean, pooped?: boolean): string {
  return (peed ? "Pee" : "") + (peed && pooped ? ", " : "") + (pooped ? "Poop" : "") || "None";
}

function digitsToTime12(digits: string): { hours: number; minutes: number } | null {
  if (digits.length !== 4) return null;
  const hours = Number(digits.slice(0, 2));
  const minutes = Number(digits.slice(2, 4));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

function formatDigitsAsTime(digits: string): string {
  const hh = digits.slice(0, 2).padEnd(2, "_");
  const mm = digits.slice(2, 4).padEnd(2, "_");
  return `${hh}:${mm}`;
}

function formatTime12(time: Date): string {
  return format(time, "hh:mm a");
}

function App() {
  const [now, setNow] = useState(new Date());
  const [view, setView] = useState<View>("dashboard");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [lyMeter, setLyMeter] = useState(20);

  const [walkMode, setWalkMode] = useState<WalkMode>("new");
  const [walkTargetId, setWalkTargetId] = useState<string | null>(null);
  const [walkDigits, setWalkDigits] = useState(format(new Date(), "hhmm"));
  const [walkPeriod, setWalkPeriod] = useState<"AM" | "PM">(format(new Date(), "a") as "AM" | "PM");
  const [walkPee, setWalkPee] = useState(false);
  const [walkPoop, setWalkPoop] = useState(false);

  const [profile, setProfile] = useState<DogProfile>(DEFAULT_PROFILE);
  const [draftProfile, setDraftProfile] = useState<DogProfile>(DEFAULT_PROFILE);
  const lyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("dogProfile");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as Partial<DogProfile>;
      const next: DogProfile = {
        name: (parsed.name || DEFAULT_PROFILE.name).trim() || DEFAULT_PROFILE.name,
        gender: parsed.gender === "female" ? "female" : "male",
      };
      setProfile(next);
      setDraftProfile(next);
    } catch {
      // Ignore invalid local state.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("dogProfile", JSON.stringify(profile));
  }, [profile]);

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
      if (!Number.isNaN(value)) setLyMeter(clampPercentage(value));
    });

    const profileRef = doc(db, "state", "profile");
    const unsubProfile = onSnapshot(profileRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const nextProfile: DogProfile = {
        name: (String(data.name || DEFAULT_PROFILE.name).trim() || DEFAULT_PROFILE.name).slice(0, 40),
        gender: data.gender === "female" ? "female" : "male",
      };
      setProfile(nextProfile);
      setDraftProfile(nextProfile);
    });

    return () => {
      unsubEvents();
      unsubLy();
      unsubProfile();
    };
  }, []);

  useEffect(() => {
    if (view === "settings") setDraftProfile(profile);
  }, [view, profile]);

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
    const normalized = clampPercentage(value);
    setLyMeter(normalized);
    queueLySync(normalized);
  };

  const addMealEvent = (type: "an_sang" | "an_chieu") => {
    const time = new Date();
    const todayMealLogs = events.filter((item) => item.type === type && isSameDay(item.time, time));
    const firestore = db;

    if (!isFirebaseConfigured || !firestore) {
      setEvents((prev) => {
        const withoutToday = prev.filter((item) => !(item.type === type && isSameDay(item.time, time)));
        return [{ id: `${type}-${time.getTime()}`, type, time }, ...withoutToday];
      });
      return;
    }

    void (async () => {
      await Promise.all(todayMealLogs.map((item) => deleteDoc(doc(firestore, "events", item.id))));
      await addDoc(collection(firestore, "events"), { type, time: Timestamp.fromDate(time) });
    })();
  };

  const openWalkEntry = () => {
    setWalkMode("new");
    setWalkTargetId(null);
    setWalkDigits(format(new Date(), "hhmm"));
    setWalkPeriod(format(new Date(), "a") as "AM" | "PM");
    setWalkPee(false);
    setWalkPoop(false);
    setView("walk");
  };

  const openEditWalk = (item: EventItem) => {
    setWalkMode("edit");
    setWalkTargetId(item.id);
    setWalkDigits(format(item.time, "hhmm"));
    setWalkPeriod(format(item.time, "a") as "AM" | "PM");
    setWalkPee(Boolean(item.peed));
    setWalkPoop(Boolean(item.pooped));
    setView("walk");
  };

  const saveWalk = () => {
    const parsedTime = digitsToTime12(walkDigits);
    if (!parsedTime) return;

    const target = walkTargetId ? events.find((item) => item.id === walkTargetId) : undefined;
    const time = new Date(target?.time ?? new Date());
    let hours24 = parsedTime.hours % 12;
    if (walkPeriod === "PM") hours24 += 12;
    time.setHours(hours24, parsedTime.minutes, 0, 0);

    const firestore = db;

    if (walkMode === "edit" && walkTargetId) {
      if (!isFirebaseConfigured || !firestore) {
        setEvents((prev) =>
          [...prev.map((item) =>
            item.id === walkTargetId
              ? { ...item, time, peed: walkPee, pooped: walkPoop }
              : item
          )].sort((a, b) => b.time.getTime() - a.time.getTime())
        );
      } else {
        void updateDoc(doc(firestore, "events", walkTargetId), {
          time: Timestamp.fromDate(time),
          peed: walkPee,
          pooped: walkPoop,
        });
      }
    } else {
      const newWalk: EventItem = {
        id: `di_bo-${time.getTime()}`,
        type: "di_bo",
        time,
        peed: walkPee,
        pooped: walkPoop,
      };
      if (!isFirebaseConfigured || !firestore) {
        setEvents((prev) => [newWalk, ...prev].sort((a, b) => b.time.getTime() - a.time.getTime()));
      } else {
        void addDoc(collection(firestore, "events"), {
          type: "di_bo",
          time: Timestamp.fromDate(time),
          peed: walkPee,
          pooped: walkPoop,
        });
      }
    }

    setWalkMode("new");
    setWalkTargetId(null);
    setWalkDigits(format(new Date(), "hhmm"));
    setWalkPeriod(format(new Date(), "a") as "AM" | "PM");
    setWalkPee(false);
    setWalkPoop(false);
    setView("dashboard");
  };

  const removeEvent = (id: string) => {
    const firestore = db;
    if (!isFirebaseConfigured || !firestore) {
      setEvents((prev) => prev.filter((item) => item.id !== id));
      return;
    }
    void deleteDoc(doc(firestore, "events", id));
  };

  const saveProfile = () => {
    const nextProfile: DogProfile = {
      name: draftProfile.name.trim() || DEFAULT_PROFILE.name,
      gender: draftProfile.gender,
    };
    setProfile(nextProfile);

    const firestore = db;
    if (!isFirebaseConfigured || !firestore) {
      setView("dashboard");
      return;
    }
    void setDoc(
      doc(firestore, "state", "profile"),
      { name: nextProfile.name, gender: nextProfile.gender, updatedAt: Timestamp.now() },
      { merge: true }
    ).finally(() => setView("dashboard"));
  };

  const appendWalkDigit = (digit: string) => {
    setWalkDigits((prev) => (prev.length >= 4 ? prev : `${prev}${digit}`));
  };

  const backspaceWalkDigit = () => {
    setWalkDigits((prev) => prev.slice(0, -1));
  };

  const clearWalkDigits = () => setWalkDigits("");
  const nowWalkDigits = () => {
    setWalkDigits(format(new Date(), "hhmm"));
    setWalkPeriod(format(new Date(), "a") as "AM" | "PM");
  };

  const lastBreakfast = events.find((item) => item.type === "an_sang");
  const lastDinner = events.find((item) => item.type === "an_chieu");
  const lastWalk = events.find((item) => item.type === "di_bo");
  const todayWalks = events.filter((item) => item.type === "di_bo" && isSameDay(item.time, now));
  const breakfastDoneToday = Boolean(lastBreakfast && isSameDay(lastBreakfast.time, now));
  const dinnerDoneToday = Boolean(lastDinner && isSameDay(lastDinner.time, now));
  const walkAgeHours = lastWalk ? (now.getTime() - lastWalk.time.getTime()) / (1000 * 60 * 60) : null;
  const walkStatusClass =
    walkAgeHours === null
      ? "border-rose-500/50 bg-rose-500/10 text-rose-200"
      : walkAgeHours < 4
        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
        : walkAgeHours < 8
          ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
          : "border-rose-500/50 bg-rose-500/10 text-rose-200";
  const breakfastClass = breakfastDoneToday
    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-100"
    : "border-rose-500/50 bg-rose-500/10 text-rose-100";
  const dinnerClass = dinnerDoneToday
    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-100"
    : "border-rose-500/50 bg-rose-500/10 text-rose-100";
  const hasPottyInfo = Boolean(lastWalk && (lastWalk.peed || lastWalk.pooped));
  const pottyClass = hasPottyInfo
    ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-100"
    : "border-slate-700 bg-slate-900 text-slate-100";
  const lyClass =
    lyMeter < 34
      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-100"
      : lyMeter < 67
        ? "border-amber-500/50 bg-amber-500/10 text-amber-100"
        : "border-rose-500/50 bg-rose-500/10 text-rose-100";
  const lyAccentClass = lyMeter < 34 ? "accent-emerald-500" : lyMeter < 67 ? "accent-amber-500" : "accent-rose-500";
  const profileChanged =
    draftProfile.name.trim() !== profile.name || draftProfile.gender !== profile.gender;

  if (view === "settings") {
    return (
      <div className="min-h-screen bg-slate-950 px-2 py-2 text-slate-100">
        <div className="mx-auto w-full max-w-3xl p-1">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold">Settings</h2>
            <button
              onClick={() => setView("dashboard")}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-slate-200 transition hover:bg-slate-700"
              aria-label="Close settings"
            >
              <X size={16} />
            </button>
          </div>

          <div className="space-y-2">
            <label className="block">
              <div className="mb-1 text-sm font-semibold text-slate-200">Dog name</div>
              <input
                value={draftProfile.name}
                onChange={(e) =>
                  setDraftProfile((prev) => ({
                    ...prev,
                    name: e.target.value.slice(0, 40),
                  }))
                }
                className="h-11 w-full rounded border border-slate-700 bg-slate-950 px-2 text-base text-slate-100 outline-none ring-cyan-500 transition focus:ring-2"
              />
            </label>

            <div>
              <div className="mb-1 text-sm font-semibold text-slate-200">Dog gender</div>
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => setDraftProfile((prev) => ({ ...prev, gender: "male" }))}
                  className={`h-11 rounded border text-sm font-semibold ${
                    draftProfile.gender === "male"
                      ? "border-cyan-500 bg-cyan-500 text-slate-950"
                      : "border-slate-700 bg-slate-800 text-slate-200"
                  }`}
                >
                  Boy
                </button>
                <button
                  onClick={() => setDraftProfile((prev) => ({ ...prev, gender: "female" }))}
                  className={`h-11 rounded border text-sm font-semibold ${
                    draftProfile.gender === "female"
                      ? "border-cyan-500 bg-cyan-500 text-slate-950"
                      : "border-slate-700 bg-slate-800 text-slate-200"
                  }`}
                >
                  Girl
                </button>
              </div>
            </div>

            <div className="px-0.5 text-sm text-slate-400">Preview: Did {pronoun(draftProfile.gender)} eat breakfast?</div>

            <button
              onClick={saveProfile}
              disabled={!profileChanged}
              className="h-11 w-full rounded border border-emerald-500 bg-emerald-500 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-700 disabled:text-slate-400"
            >
              Save settings
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === "walk") {
    const keypad = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

    return (
      <div className="min-h-screen bg-slate-950 px-2 py-2 text-slate-100">
        <div className="mx-auto w-full max-w-3xl p-1">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-bold">{walkMode === "edit" ? "Edit walk" : "New walk"}</h2>
            <button
              onClick={() => setView("dashboard")}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-slate-200 transition hover:bg-slate-700"
              aria-label="Close walk details"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mb-2 rounded border border-slate-700 bg-slate-900 px-3 py-3 text-center text-6xl font-bold tabular-nums tracking-wider">
            {formatDigitsAsTime(walkDigits)} {walkPeriod}
          </div>

          <div className="mb-2 grid grid-cols-2 gap-1">
            <button
              onClick={() => setWalkPeriod("AM")}
              className={`h-10 rounded border text-lg font-bold ${
                walkPeriod === "AM"
                  ? "border-cyan-500 bg-cyan-500 text-slate-950"
                  : "border-slate-700 bg-slate-900 text-slate-300"
              }`}
            >
              AM
            </button>
            <button
              onClick={() => setWalkPeriod("PM")}
              className={`h-10 rounded border text-lg font-bold ${
                walkPeriod === "PM"
                  ? "border-cyan-500 bg-cyan-500 text-slate-950"
                  : "border-slate-700 bg-slate-900 text-slate-300"
              }`}
            >
              PM
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1">
            {keypad.map((key) => (
              <button
                key={key}
                onClick={() => appendWalkDigit(key)}
                className="h-16 rounded border border-slate-700 bg-slate-900 text-3xl font-bold text-slate-100 transition hover:bg-slate-800"
              >
                {key}
              </button>
            ))}
            <button
              onClick={clearWalkDigits}
              className="h-16 rounded border border-slate-700 bg-slate-900 text-lg font-semibold text-slate-300 transition hover:bg-slate-800"
            >
              Clear
            </button>
            <button
              onClick={() => appendWalkDigit("0")}
              className="h-16 rounded border border-slate-700 bg-slate-900 text-3xl font-bold text-slate-100 transition hover:bg-slate-800"
            >
              0
            </button>
            <button
              onClick={backspaceWalkDigit}
              className="h-16 rounded border border-slate-700 bg-slate-900 text-lg font-semibold text-slate-300 transition hover:bg-slate-800"
            >
              Back
            </button>
          </div>

          <div className="mt-1">
            <button
              onClick={nowWalkDigits}
              className="h-10 w-full rounded border border-slate-700 bg-slate-900 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
            >
              Use current time
            </button>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1">
            <button
              onClick={() => setWalkPee((prev) => !prev)}
              className={`h-12 rounded border px-2 text-lg font-bold transition ${
                walkPee
                  ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                  : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
              }`}
            >
              Pee: {walkPee ? "Yes" : "No"}
            </button>
            <button
              onClick={() => setWalkPoop((prev) => !prev)}
              className={`h-12 rounded border px-2 text-lg font-bold transition ${
                walkPoop
                  ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                  : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
              }`}
            >
              Poop: {walkPoop ? "Yes" : "No"}
            </button>
          </div>

          <button
            onClick={saveWalk}
            className="mt-2 h-12 w-full rounded border border-cyan-500 bg-cyan-500 px-3 text-lg font-bold text-slate-950 transition hover:bg-cyan-400"
          >
            {walkMode === "edit" ? "Save changes" : "Save walk"}
          </button>

          <div className="mt-3 border-t border-slate-800 pt-2">
            <div className="mb-1 text-sm font-semibold text-slate-300">Today walks</div>
            <div className="max-h-60 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-950 text-slate-400">
                  <tr>
                    <th className="border-b border-slate-700 px-1 py-2">Time</th>
                    <th className="border-b border-slate-700 px-1 py-2">Pee/Poop</th>
                    <th className="border-b border-slate-700 px-1 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {todayWalks.map((item) => (
                    <tr key={item.id} className="border-b border-slate-800">
                      <td className="px-1 py-2 font-semibold tabular-nums">{formatTime12(item.time)}</td>
                      <td className="px-1 py-2">{statusFromFlags(item.peed, item.pooped)}</td>
                      <td className="px-1 py-2">
                        <div className="flex gap-1">
                          <button
                            onClick={() => openEditWalk(item)}
                            className="inline-flex h-8 items-center gap-1 rounded border border-cyan-500/40 bg-cyan-500/15 px-2 text-xs font-semibold text-cyan-300"
                          >
                            <Pencil size={12} />
                            Edit
                          </button>
                          <button
                            onClick={() => removeEvent(item.id)}
                            className="inline-flex h-8 items-center gap-1 rounded border border-rose-500/40 bg-rose-500/15 px-2 text-xs font-semibold text-rose-300"
                          >
                            <Trash2 size={12} />
                            Del
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-2 py-2 text-slate-100">
      <div className="relative mx-auto w-full max-w-3xl space-y-2 pt-1">
        <button
          onClick={() => setView("settings")}
          className="absolute right-0 top-0 inline-flex h-8 w-8 items-center justify-center rounded border border-slate-700 bg-slate-900 text-slate-200 transition hover:bg-slate-800"
          aria-label="Open settings"
        >
          <Settings size={14} />
        </button>

        <section className="grid grid-cols-2 gap-2 pr-9">
          <div className="rounded border border-cyan-500/40 bg-cyan-500/10 px-2 py-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Current time</div>
            <div className="mt-1 text-6xl font-bold tabular-nums leading-none">{format(now, "hh:mm a")}</div>
          </div>
          <div className={`rounded px-2 py-1 ${walkStatusClass}`}>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Last walk</div>
            <div className="mt-1 text-6xl font-bold tabular-nums leading-none">
              {lastWalk ? formatTime12(lastWalk.time) : "--:-- --"}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2">
          <button
            onClick={() => addMealEvent("an_sang")}
            className={`h-20 rounded px-2 text-left transition ${breakfastClass}`}
          >
            <div className="text-sm font-semibold">Breakfast?</div>
            <div className="text-4xl font-bold tabular-nums">{lastBreakfast ? formatTime12(lastBreakfast.time) : "--:-- --"}</div>
          </button>
          <button
            onClick={() => addMealEvent("an_chieu")}
            className={`h-20 rounded px-2 text-left transition ${dinnerClass}`}
          >
            <div className="text-sm font-semibold">Dinner?</div>
            <div className="text-4xl font-bold tabular-nums">{lastDinner ? formatTime12(lastDinner.time) : "--:-- --"}</div>
          </button>
        </section>

        <section className="grid grid-cols-2 gap-2">
          <div className={`h-20 rounded px-2 py-2 ${pottyClass}`}>
            <div className="text-sm font-semibold">Pee / Poop (last walk)</div>
            <div className="mt-1 text-4xl font-bold leading-none">{statusFromFlags(lastWalk?.peed, lastWalk?.pooped)}</div>
          </div>
          <div className={`h-20 rounded px-2 py-2 ${lyClass}`}>
            <div className="mb-1 flex items-center justify-between text-sm font-semibold">
              <span>Ly</span>
              <span>{lyMeter}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={lyMeter}
              onChange={(e) => setLyValue(Number(e.target.value))}
              className={`h-9 w-full cursor-pointer ${lyAccentClass}`}
              aria-label="Ly meter"
            />
          </div>
        </section>

        <button
          onClick={openWalkEntry}
          className="h-14 w-full rounded border border-cyan-500 bg-cyan-500 text-2xl font-bold text-slate-950 transition hover:bg-cyan-400"
        >
          WALK DETAILS
        </button>
      </div>
    </div>
  );
}

export default App;
