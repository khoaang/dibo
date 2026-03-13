import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Check, Pencil, Settings, Trash2, X } from "lucide-react";
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

function App() {
  const [now, setNow] = useState(new Date());
  const [view, setView] = useState<View>("dashboard");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [lyMeter, setLyMeter] = useState(20);
  const [walkTimeInput, setWalkTimeInput] = useState(format(new Date(), "HH:mm"));
  const [walkPee, setWalkPee] = useState(false);
  const [walkPoop, setWalkPoop] = useState(false);
  const [editingWalkId, setEditingWalkId] = useState<string | null>(null);
  const [editingWalkTime, setEditingWalkTime] = useState("");
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

  const saveWalk = () => {
    const [hourText, minuteText] = walkTimeInput.split(":");
    const h = Number(hourText);
    const m = Number(minuteText);
    const time = new Date();
    if (!Number.isNaN(h) && !Number.isNaN(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      time.setHours(h, m, 0, 0);
    }

    const newWalk: EventItem = {
      id: `di_bo-${time.getTime()}`,
      type: "di_bo",
      time,
      peed: walkPee,
      pooped: walkPoop,
    };

    const firestore = db;
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
    setWalkTimeInput(format(new Date(), "HH:mm"));
    setWalkPee(false);
    setWalkPoop(false);
    setView("dashboard");
  };

  const openWalkEntry = () => {
    setWalkTimeInput(format(new Date(), "HH:mm"));
    setWalkPee(false);
    setWalkPoop(false);
    setView("walk");
  };

  const startEditWalk = (item: EventItem) => {
    setEditingWalkId(item.id);
    setEditingWalkTime(format(item.time, "HH:mm"));
  };

  const cancelEditWalk = () => {
    setEditingWalkId(null);
    setEditingWalkTime("");
  };

  const saveEditedWalk = (id: string) => {
    const target = events.find((item) => item.id === id && item.type === "di_bo");
    if (!target) return;
    const [hText, mText] = editingWalkTime.split(":");
    const h = Number(hText);
    const m = Number(mText);
    if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return;

    const nextTime = new Date(target.time);
    nextTime.setHours(h, m, 0, 0);

    const firestore = db;
    if (!isFirebaseConfigured || !firestore) {
      setEvents((prev) =>
        [...prev.map((item) => (item.id === id ? { ...item, time: nextTime } : item))].sort(
          (a, b) => b.time.getTime() - a.time.getTime()
        )
      );
      cancelEditWalk();
      return;
    }
    void updateDoc(doc(firestore, "events", id), { time: Timestamp.fromDate(nextTime) }).finally(() => {
      cancelEditWalk();
    });
  };

  const removeEvent = (id: string) => {
    if (editingWalkId === id) cancelEditWalk();
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

  const lastBreakfast = events.find((item) => item.type === "an_sang");
  const lastDinner = events.find((item) => item.type === "an_chieu");
  const todayWalks = events.filter((item) => item.type === "di_bo" && isSameDay(item.time, now));
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
    return (
      <div className="min-h-screen bg-slate-950 px-2 py-2 text-slate-100">
        <div className="mx-auto w-full max-w-3xl p-1">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold">Walk details</h2>
            <button
              onClick={() => setView("dashboard")}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-slate-200 transition hover:bg-slate-700"
              aria-label="Close walk details"
            >
              <X size={16} />
            </button>
          </div>

          <div className="space-y-2">
            <label className="block">
              <div className="mb-1 text-sm font-semibold text-slate-200">Walk time</div>
              <input
                type="time"
                value={walkTimeInput}
                onChange={(e) => setWalkTimeInput(e.target.value)}
                className="h-11 w-full rounded border border-slate-700 bg-slate-950 px-2 text-base text-slate-100 outline-none ring-cyan-500 transition focus:ring-2"
                aria-label="Walk time"
              />
            </label>

            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => setWalkPee((prev) => !prev)}
                className={`h-11 rounded border px-2 text-sm font-semibold transition ${
                  walkPee
                    ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                    : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                }`}
              >
                Pee: {walkPee ? "Yes" : "No"}
              </button>
              <button
                onClick={() => setWalkPoop((prev) => !prev)}
                className={`h-11 rounded border px-2 text-sm font-semibold transition ${
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
              className="h-11 w-full rounded border border-cyan-500 bg-cyan-500 px-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Save walk
            </button>
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

        <section className="grid grid-cols-2 gap-1 pr-9">
          <article className="px-1 py-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Current time</div>
            <div className="mt-1 text-3xl font-bold tabular-nums leading-none">{format(now, "HH:mm:ss")}</div>
          </article>

          <article className="px-1 py-1">
            <div className="mb-1 flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-fuchsia-200">Ly meter</div>
              <div className="rounded bg-fuchsia-500/20 px-1.5 py-0.5 text-sm font-bold text-fuchsia-100">
                {lyMeter}%
              </div>
            </div>
            <div className="relative h-9">
              <div className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded-full bg-linear-to-r from-emerald-400 via-amber-400 to-rose-500 opacity-90" />
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={lyMeter}
                onChange={(e) => setLyValue(Number(e.target.value))}
                className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-3 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:mt-[-7px] [&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white/70 [&::-webkit-slider-thumb]:bg-fuchsia-500 [&::-webkit-slider-thumb]:shadow-[0_0_0_3px_rgba(217,70,239,0.3)] [&::-moz-range-track]:h-3 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:h-7 [&::-moz-range-thumb]:w-7 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white/70 [&::-moz-range-thumb]:bg-fuchsia-500"
                aria-label="Ly meter"
              />
            </div>
          </article>
        </section>

        <section className="border-t border-slate-800 pt-2">
          <h2 className="text-base font-bold">{profile.name}'s meals</h2>
          <div className="mt-2 grid grid-cols-2 gap-1">
            <button
              onClick={() => addMealEvent("an_sang")}
              className="h-12 rounded border border-slate-700 bg-slate-800 px-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-700"
            >
              <div>Breakfast</div>
              <div className="mt-0.5 text-base tabular-nums">{lastBreakfast ? format(lastBreakfast.time, "HH:mm") : "--"}</div>
            </button>
            <button
              onClick={() => addMealEvent("an_chieu")}
              className="h-12 rounded border border-slate-700 bg-slate-800 px-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-700"
            >
              <div>Dinner</div>
              <div className="mt-0.5 text-base tabular-nums">{lastDinner ? format(lastDinner.time, "HH:mm") : "--"}</div>
            </button>
          </div>
        </section>

        <section className="border-t border-slate-800 pt-2">
          <h2 className="text-base font-bold">{profile.name}'s walks</h2>
          <div className="mt-2">
            <button
              onClick={openWalkEntry}
              className="h-11 w-full rounded border border-cyan-500 bg-cyan-500 px-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Add walk details
            </button>
          </div>

          <div className="mt-2 max-h-88 overflow-auto">
            <table className="w-full text-left text-base">
              <thead className="sticky top-0 bg-slate-950 text-slate-300">
                <tr>
                  <th className="border-b border-slate-700 px-2 py-3 text-lg font-bold">Time</th>
                  <th className="border-b border-slate-700 px-2 py-3 text-lg font-bold">Pee / Poop</th>
                  <th className="border-b border-slate-700 px-2 py-3 text-base font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {todayWalks.length === 0 ? (
                  <tr>
                    <td className="px-2 py-4 text-base text-slate-400" colSpan={3}>
                      No walks logged today.
                    </td>
                  </tr>
                ) : (
                  todayWalks.map((item) => (
                    <tr key={item.id} className="border-b border-slate-800">
                      <td className="px-2 py-3 text-3xl font-bold tabular-nums leading-none">
                        {editingWalkId === item.id ? (
                          <input
                            type="time"
                            value={editingWalkTime}
                            onChange={(e) => setEditingWalkTime(e.target.value)}
                            className="h-12 w-40 rounded border border-slate-700 bg-slate-950 px-2 text-2xl font-semibold outline-none ring-cyan-500 transition focus:ring-2"
                            aria-label="Edit walk time"
                          />
                        ) : (
                          <div>{format(item.time, "HH:mm")}</div>
                        )}
                      </td>
                      <td className="px-2 py-3 text-2xl font-semibold leading-none text-slate-200">
                        {(item.peed ? "Pee" : "") +
                          (item.peed && item.pooped ? ", " : "") +
                          (item.pooped ? "Poop" : "") || "None"}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex flex-wrap gap-1">
                          {editingWalkId === item.id ? (
                            <>
                              <button
                                onClick={() => saveEditedWalk(item.id)}
                                className="inline-flex h-9 items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/15 px-2 text-sm font-semibold text-emerald-300"
                                aria-label="Save walk time"
                              >
                                <Check size={14} />
                                Save
                              </button>
                              <button
                                onClick={cancelEditWalk}
                                className="inline-flex h-9 items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 text-sm font-semibold text-slate-200"
                                aria-label="Cancel walk edit"
                              >
                                <X size={14} />
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => startEditWalk(item)}
                              className="inline-flex h-9 items-center gap-1 rounded border border-cyan-500/40 bg-cyan-500/15 px-2 text-sm font-semibold text-cyan-300"
                              aria-label="Edit walk"
                            >
                              <Pencil size={14} />
                              Edit
                            </button>
                          )}
                          <button
                            onClick={() => removeEvent(item.id)}
                            className="inline-flex h-9 items-center gap-1 rounded border border-rose-500/40 bg-rose-500/15 px-2 text-sm font-semibold text-rose-300"
                            aria-label="Delete walk"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;
