import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ArrowRight, Pencil, Settings, Trash2, X } from "lucide-react";
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
  return (peed ? "💦 Pee" : "") + (peed && pooped ? ", " : "") + (pooped ? "💩 Poop" : "") || "—";
}

function digitsToTime12(digits: string): { hours: number; minutes: number } | null {
  if (digits.length === 0 || digits.length > 4) return null;
  const normalized = digits.padStart(4, "0");
  const hours = Number(normalized.slice(0, 2));
  const minutes = Number(normalized.slice(2, 4));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

function formatDigitsAsTime(digits: string): string {
  if (digits.length === 0) return "__:__";
  const normalized = digits.padStart(4, "0");
  const hh = normalized.slice(0, 2);
  const mm = normalized.slice(2, 4);
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
  const [walkTypingStarted, setWalkTypingStarted] = useState(false);
  const [showTimeKeypad, setShowTimeKeypad] = useState(false);
  const [walkPee, setWalkPee] = useState(false);
  const [walkPoop, setWalkPoop] = useState(false);

  const [profile, setProfile] = useState<DogProfile>(DEFAULT_PROFILE);
  const [draftProfile, setDraftProfile] = useState<DogProfile>(DEFAULT_PROFILE);
  const lyTrackRef = useRef<HTMLDivElement | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [hasRemoteData, setHasRemoteData] = useState(false);

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
    setSyncError(null);
    setHasRemoteData(false);

    const eventsQuery = query(collection(db, "events"), orderBy("time", "desc"));
    const unsubEvents = onSnapshot(
      eventsQuery,
      (snapshot) => {
        setHasRemoteData(true);
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
      },
      (error) => {
        setSyncError(error.message);
      }
    );

    const lyRef = doc(db, "state", "ly");
    const unsubLy = onSnapshot(
      lyRef,
      (snap) => {
        if (!snap.exists()) return;
        setHasRemoteData(true);
        const value = Number(snap.data().value);
        if (!Number.isNaN(value)) setLyMeter(clampPercentage(value));
      },
      (error) => {
        setSyncError(error.message);
      }
    );

    const profileRef = doc(db, "state", "profile");
    const unsubProfile = onSnapshot(
      profileRef,
      (snap) => {
        if (!snap.exists()) return;
        setHasRemoteData(true);
        const data = snap.data();
        const nextProfile: DogProfile = {
          name: (String(data.name || DEFAULT_PROFILE.name).trim() || DEFAULT_PROFILE.name).slice(0, 40),
          gender: data.gender === "female" ? "female" : "male",
        };
        setProfile(nextProfile);
        setDraftProfile(nextProfile);
      },
      (error) => {
        setSyncError(error.message);
      }
    );

    return () => {
      unsubEvents();
      unsubLy();
      unsubProfile();
    };
  }, []);
  const setLyValue = (value: number) => {
    const normalized = clampPercentage(value);
    setLyMeter(normalized);
    const firestore = db;
    if (!isFirebaseConfigured || !firestore) return;
    void setDoc(
      doc(firestore, "state", "ly"),
      { value: normalized, updatedAt: Timestamp.now() },
      { merge: true }
    );
  };

  const updateLyFromClientY = (clientY: number) => {
    const track = lyTrackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const clampedY = Math.min(rect.bottom, Math.max(rect.top, clientY));
    const ratio = (rect.bottom - clampedY) / rect.height;
    setLyValue(Math.round(ratio * 100));
  };


  useEffect(() => {
    if (view === "settings") setDraftProfile(profile);
  }, [view, profile]);

  const openWalkEntry = () => {
    setWalkMode("new");
    setWalkTargetId(null);
    setWalkDigits(format(new Date(), "hhmm"));
    setWalkPeriod(format(new Date(), "a") as "AM" | "PM");
    setWalkTypingStarted(false);
    setShowTimeKeypad(false);
    setWalkPee(false);
    setWalkPoop(false);
    setView("walk");
  };

  const openEditWalk = (item: EventItem) => {
    setWalkMode("edit");
    setWalkTargetId(item.id);
    setWalkDigits(format(item.time, "hhmm"));
    setWalkPeriod(format(item.time, "a") as "AM" | "PM");
    setWalkTypingStarted(false);
    setShowTimeKeypad(false);
    setWalkPee(Boolean(item.peed));
    setWalkPoop(Boolean(item.pooped));
    setView("walk");
  };

  const toggleMealEvent = (type: "an_sang" | "an_chieu") => {
    const time = new Date();
    const todayMealLogs = events.filter((item) => item.type === type && isSameDay(item.time, time));
    const firestore = db;

    // If already logged today, tapping again unlogs it.
    if (todayMealLogs.length > 0) {
      if (!isFirebaseConfigured || !firestore) {
        const todayIds = new Set(todayMealLogs.map((item) => item.id));
        setEvents((prev) => prev.filter((item) => !todayIds.has(item.id)));
        return;
      }
      void Promise.all(todayMealLogs.map((item) => deleteDoc(doc(firestore, "events", item.id))));
      return;
    }

    if (!isFirebaseConfigured || !firestore) {
      setEvents((prev) =>
        [{ id: `${type}-${time.getTime()}`, type, time }, ...prev].sort(
          (a, b) => b.time.getTime() - a.time.getTime()
        )
      );
      return;
    }

    void addDoc(collection(firestore, "events"), { type, time: Timestamp.fromDate(time) });
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
    setWalkTypingStarted(false);
    setShowTimeKeypad(false);
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
    setWalkDigits((prev) => {
      if (!walkTypingStarted) return digit;
      return prev.length >= 4 ? prev : `${prev}${digit}`;
    });
    setWalkTypingStarted(true);
  };

  const backspaceWalkDigit = () => {
    if (!walkTypingStarted) {
      setWalkDigits("");
      setWalkTypingStarted(true);
      return;
    }
    setWalkDigits((prev) => prev.slice(0, -1));
  };

  const clearWalkDigits = () => {
    setWalkDigits("");
    setWalkTypingStarted(true);
  };
  const nowWalkDigits = () => {
    setWalkDigits(format(new Date(), "hhmm"));
    setWalkPeriod(format(new Date(), "a") as "AM" | "PM");
    setWalkTypingStarted(false);
  };

  const confirmTimeSelection = () => {
    if (!digitsToTime12(walkDigits)) return;
    setShowTimeKeypad(false);
  };

  const lastBreakfast = events.find((item) => item.type === "an_sang");
  const lastDinner = events.find((item) => item.type === "an_chieu");
  const lastWalk = events.find((item) => item.type === "di_bo");
  const todayWalks = events.filter((item) => item.type === "di_bo" && isSameDay(item.time, now));
  const poopedToday = todayWalks.some((item) => item.pooped);
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
  const profileChanged =
    draftProfile.name.trim() !== profile.name || draftProfile.gender !== profile.gender;
  const syncLabel = !isFirebaseConfigured
    ? "Sync: Local only"
    : syncError
      ? "Sync: Error"
      : hasRemoteData
        ? "Sync: Live"
        : "Sync: Connecting";
  const syncClass = !isFirebaseConfigured
    ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
    : syncError
      ? "border-rose-500/50 bg-rose-500/10 text-rose-200"
      : hasRemoteData
        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
        : "border-cyan-500/50 bg-cyan-500/10 text-cyan-200";

  if (view === "settings") {
    return (
      <div className="min-h-screen bg-slate-950 px-2 py-2 text-slate-100">
        <div className="w-full p-1">
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
        <div className="w-full p-1">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-2xl font-black tracking-tight">{walkMode === "edit" ? "Edit walk" : "New walk"}</h2>
            <button
              onClick={() => setView("dashboard")}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-200 transition hover:bg-slate-700"
              aria-label="Close walk details"
            >
              <X size={16} />
            </button>
          </div>

          <button
            onClick={() => setShowTimeKeypad(true)}
            className="mb-2 w-full rounded-xl border border-cyan-500/40 bg-linear-to-br from-slate-900 to-slate-800 px-3 py-4 text-center text-6xl font-bold tabular-nums tracking-wider text-cyan-100 shadow-[0_6px_20px_rgba(6,182,212,0.16)]"
          >
            {formatDigitsAsTime(walkDigits)} {walkPeriod}
          </button>

          {showTimeKeypad ? (
            <div className="mb-2 rounded-xl border border-slate-700 bg-slate-900/90 p-2 shadow-[0_8px_24px_rgba(2,6,23,0.45)]">
              <div className="mb-2 grid grid-cols-2 gap-1">
                <button
                  onClick={() => setWalkPeriod("AM")}
                  className={`h-12 rounded-lg border text-xl font-bold transition ${
                    walkPeriod === "AM"
                      ? "border-cyan-400 bg-cyan-400 text-slate-950"
                      : "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  AM
                </button>
                <button
                  onClick={() => setWalkPeriod("PM")}
                  className={`h-12 rounded-lg border text-xl font-bold transition ${
                    walkPeriod === "PM"
                      ? "border-cyan-400 bg-cyan-400 text-slate-950"
                      : "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
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
                    className="h-16 rounded-lg border border-slate-700 bg-slate-800 text-4xl font-black text-slate-100 transition hover:bg-slate-700 active:scale-[0.99]"
                  >
                    {key}
                  </button>
                ))}
                <button
                  onClick={clearWalkDigits}
                  className="h-16 rounded-lg border border-slate-700 bg-slate-800 text-lg font-bold text-slate-300 transition hover:bg-slate-700"
                >
                  Clear
                </button>
                <button
                  onClick={() => appendWalkDigit("0")}
                  className="h-16 rounded-lg border border-slate-700 bg-slate-800 text-4xl font-black text-slate-100 transition hover:bg-slate-700 active:scale-[0.99]"
                >
                  0
                </button>
                <button
                  onClick={backspaceWalkDigit}
                  className="h-16 rounded-lg border border-slate-700 bg-slate-800 text-lg font-bold text-slate-300 transition hover:bg-slate-700"
                >
                  Back
                </button>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-1">
                <button
                  onClick={nowWalkDigits}
                  className="h-11 rounded-lg border border-slate-700 bg-slate-800 text-base font-semibold text-slate-300 transition hover:bg-slate-700"
                >
                  Current Time
                </button>
                <button
                  onClick={confirmTimeSelection}
                  className="h-11 rounded-lg border border-cyan-500 bg-cyan-500 text-base font-black text-slate-950 transition hover:bg-cyan-400"
                >
                  OK
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-2 grid grid-cols-2 gap-1">
            <button
              onClick={() => setWalkPee((prev) => !prev)}
              className={`h-13 rounded-lg border px-2 text-xl font-black transition ${
                walkPee
                  ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                  : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
              }`}
            >
              💦 Pee: {walkPee ? "Yes" : "No"}
            </button>
            <button
              onClick={() => setWalkPoop((prev) => !prev)}
              className={`h-13 rounded-lg border px-2 text-xl font-black transition ${
                walkPoop
                  ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                  : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
              }`}
            >
              💩 Poop: {walkPoop ? "Yes" : "No"}
            </button>
          </div>

          <button
            onClick={saveWalk}
            className="mt-2 h-14 w-full rounded-xl border border-cyan-500 bg-cyan-500 px-3 text-2xl font-black text-slate-950 transition hover:bg-cyan-400"
          >
            {walkMode === "edit" ? "Save changes" : "Save walk"}
          </button>

          <div className="mt-3 border-t border-slate-800 pt-2">
            <div className="mb-1 text-lg font-bold text-slate-200">Today walks</div>
            <div className="max-h-60 overflow-auto">
              <table className="w-full text-left text-base">
                <thead className="sticky top-0 bg-slate-950 text-slate-400">
                  <tr>
                    <th className="border-b border-slate-700 px-1 py-2 text-lg">Time</th>
                    <th className="border-b border-slate-700 px-1 py-2 text-lg">💦 / 💩</th>
                    <th className="border-b border-slate-700 px-1 py-2 text-base">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {todayWalks.map((item) => (
                    <tr key={item.id} className="border-b border-slate-800">
                      <td className="px-1 py-2 text-xl font-black tabular-nums">{formatTime12(item.time)}</td>
                      <td className="px-1 py-2 text-lg font-semibold">{statusFromFlags(item.peed, item.pooped)}</td>
                      <td className="px-1 py-2">
                        <div className="flex gap-1">
                          <button
                            onClick={() => openEditWalk(item)}
                            className="inline-flex h-9 items-center gap-1 rounded border border-cyan-500/40 bg-cyan-500/15 px-2 text-sm font-semibold text-cyan-300"
                          >
                            <Pencil size={12} />
                            Edit
                          </button>
                          <button
                            onClick={() => removeEvent(item.id)}
                            className="inline-flex h-9 items-center gap-1 rounded border border-rose-500/40 bg-rose-500/15 px-2 text-sm font-semibold text-rose-300"
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
      <div className="relative h-[calc(100dvh-1rem)] w-full pt-1">
        <button
          onClick={() => setView("settings")}
          className="absolute right-0 top-0 z-10 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/90 text-slate-200 shadow-[0_8px_20px_rgba(2,6,23,0.4)] transition hover:bg-slate-800"
          aria-label="Open settings"
        >
          <Settings size={14} />
        </button>
        <div className={`absolute right-11 top-0 z-10 rounded-lg border px-2 py-1 text-xs font-bold ${syncClass}`}>
          {syncLabel}
        </div>

        <section className="grid h-[calc(100%-0.25rem)] grid-cols-[9fr_1fr] gap-2 overflow-hidden">
          <div className="flex min-h-0 flex-col justify-between rounded-2xl border border-slate-800 bg-linear-to-b from-slate-900 via-slate-900 to-slate-950 px-3 py-3 shadow-[0_22px_50px_rgba(2,6,23,0.55)]">
            <div className="flex min-h-0 flex-1 flex-col justify-evenly">
              <div>
                <div className="mb-1 text-xl font-bold uppercase tracking-[0.08em] text-slate-300">Current time ⏰</div>
                <div className="text-[clamp(4.2rem,14.5vh,10.5rem)] font-black tabular-nums leading-[0.9] text-cyan-200">
                  {format(now, "hh:mm a")}
                </div>
              </div>

              <div>
                <div className="mb-1 text-xl font-bold uppercase tracking-[0.08em] text-slate-300">Last walk 🐾</div>
                <div className={`inline-block rounded-xl border px-3 py-1.5 text-[clamp(5rem,17vh,12.5rem)] font-black tabular-nums leading-[0.88] ${walkStatusClass}`}>
                  {lastWalk ? formatTime12(lastWalk.time) : "--:-- --"}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-2">
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                <div className={`rounded-xl border px-2.5 py-2.5 ${poopedToday ? "border-emerald-500/50 bg-emerald-500/10" : "border-rose-500/50 bg-rose-500/10"}`}>
                  <div className="text-base font-semibold text-slate-300">Pooped today? 💩</div>
                  <div className={`text-[clamp(2rem,5vw,2.8rem)] font-black leading-none ${poopedToday ? "text-emerald-300" : "text-rose-300"}`}>
                    {poopedToday ? "✅ YES 💩" : "❌ NO 💩"}
                  </div>
                </div>
              <button
                onClick={() => toggleMealEvent("an_sang")}
                className={`rounded-xl border px-2.5 py-2.5 text-left transition active:scale-[0.99] ${breakfastDoneToday ? "border-emerald-500/50 bg-emerald-500/10" : "border-rose-500/50 bg-rose-500/10"}`}
              >
                  <div className="text-base font-semibold text-slate-300">Breakfast 🍳</div>
                  <div className={`text-[clamp(2rem,5vw,2.8rem)] font-black leading-none ${breakfastDoneToday ? "text-emerald-300" : "text-rose-300"}`}>
                    {breakfastDoneToday ? "✅ YES 🍳" : "❌ NO 🍳"}
                  </div>
              </button>
              <button
                onClick={() => toggleMealEvent("an_chieu")}
                className={`rounded-xl border px-2.5 py-2.5 text-left transition active:scale-[0.99] ${dinnerDoneToday ? "border-emerald-500/50 bg-emerald-500/10" : "border-rose-500/50 bg-rose-500/10"}`}
              >
                  <div className="text-base font-semibold text-slate-300">Dinner 🍽️</div>
                  <div className={`text-[clamp(2rem,5vw,2.8rem)] font-black leading-none ${dinnerDoneToday ? "text-emerald-300" : "text-rose-300"}`}>
                    {dinnerDoneToday ? "✅ YES 🍽️" : "❌ NO 🍽️"}
                  </div>
              </button>
              </div>
              <button
                onClick={openWalkEntry}
                className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-500 bg-cyan-500 text-lg font-black text-slate-950 transition hover:bg-cyan-400"
              >
                Open details
                <ArrowRight size={20} />
              </button>
            </div>
          </div>

          <aside className="flex min-h-0 min-w-14 flex-col rounded-2xl border border-slate-800 bg-slate-900/95 px-1 py-2 shadow-[0_14px_34px_rgba(2,6,23,0.5)]">
            <div className="text-center text-base font-black text-rose-300">Lỳ</div>
            <div
              ref={lyTrackRef}
              className="relative my-2 flex-1 rounded-full border border-slate-700 bg-linear-to-b from-rose-500 via-amber-400 to-emerald-500 touch-none"
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                updateLyFromClientY(e.clientY);
              }}
              onPointerMove={(e) => {
                if (e.buttons !== 1) return;
                updateLyFromClientY(e.clientY);
              }}
            >
              <div
                className="absolute left-1/2 h-3 w-[120%] -translate-x-1/2 rounded-full border border-white/70 bg-slate-100 shadow-[0_0_12px_rgba(255,255,255,0.5)]"
                style={{ top: `calc(${100 - lyMeter}% - 0.375rem)` }}
              />
            </div>
            <div className="text-center text-base font-black text-emerald-300">Ngoan</div>
            <div className="mt-0.5 text-center text-base font-black tabular-nums text-slate-200">{lyMeter}%</div>
          </aside>
        </section>
      </div>
    </div>
  );
}

export default App;
