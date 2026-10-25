import { useEffect, useRef, useState } from "react";
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
import { db } from "../lib/firebase";
import { isSameTrackerDay } from "../lib/time";

// Stored values are Vietnamese: ăn sáng (breakfast), đi bộ (walk), ăn chiều (dinner).
export type EventType = "an_sang" | "di_bo" | "an_chieu";
export type MealType = Exclude<EventType, "di_bo">;

export type TrackerEvent = {
  id: string;
  type: EventType;
  time: Date;
  peed?: boolean;
  pooped?: boolean;
};

export type WalkFields = Pick<TrackerEvent, "time" | "peed" | "pooped">;

export type Gender = "male" | "female";
export type Profile = { name: string; gender: Gender };

export type SyncStatus = "local" | "connecting" | "live" | "error";

const EVENT_TYPES: EventType[] = ["an_sang", "di_bo", "an_chieu"];
const DEFAULT_PROFILE: Profile = { name: "Carl", gender: "male" };
const PROFILE_STORAGE_KEY = "dogProfile";

function normalizeProfile(raw: { name?: unknown; gender?: unknown } | undefined): Profile {
  const name = String(raw?.name ?? "").trim().slice(0, 40);
  return {
    name: name || DEFAULT_PROFILE.name,
    gender: raw?.gender === "female" ? "female" : "male",
  };
}

// The Firestore copy wins once it loads; localStorage just avoids a flash of the default name.
function loadCachedProfile(): Profile {
  try {
    const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
    return saved ? normalizeProfile(JSON.parse(saved)) : DEFAULT_PROFILE;
  } catch {
    return DEFAULT_PROFILE;
  }
}

function cacheProfile(profile: Profile) {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Not worth surfacing; the profile is also in Firestore.
  }
}

function byNewest(a: TrackerEvent, b: TrackerEvent) {
  return b.time.getTime() - a.time.getTime();
}

export function useTracker() {
  const [events, setEvents] = useState<TrackerEvent[]>([]);
  const [lyLevel, setLyLevel] = useState(20);
  const [profile, setProfile] = useState<Profile>(loadCachedProfile);
  const [connected, setConnected] = useState(false);
  // A failed listener is dead for good; a failed write clears on the next successful one.
  const [listenerError, setListenerError] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const lyWriteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!db) return;

    const onError = (error: Error) => setListenerError(error.message);

    const unsubEvents = onSnapshot(
      query(collection(db, "events"), orderBy("time", "desc")),
      (snapshot) => {
        const next: TrackerEvent[] = [];
        for (const entry of snapshot.docs) {
          const data = entry.data();
          // Skip malformed docs rather than guessing a time for them.
          if (!(data.time instanceof Timestamp) || !EVENT_TYPES.includes(data.type)) continue;
          next.push({
            id: entry.id,
            type: data.type,
            time: data.time.toDate(),
            peed: Boolean(data.peed),
            pooped: Boolean(data.pooped),
          });
        }
        setEvents(next);
        setConnected(true);
      },
      onError
    );

    const unsubLy = onSnapshot(
      doc(db, "state", "ly"),
      (snap) => {
        const value = Number(snap.data()?.value);
        if (snap.exists() && !Number.isNaN(value)) setLyLevel(Math.max(0, Math.min(100, value)));
      },
      onError
    );

    const unsubProfile = onSnapshot(
      doc(db, "state", "profile"),
      (snap) => {
        if (!snap.exists()) return;
        const next = normalizeProfile(snap.data());
        setProfile(next);
        cacheProfile(next);
      },
      onError
    );

    return () => {
      unsubEvents();
      unsubLy();
      unsubProfile();
      if (lyWriteTimer.current) clearTimeout(lyWriteTimer.current);
    };
  }, []);

  const write = (pending: Promise<unknown>) =>
    pending.then(
      () => setWriteError(null),
      (error: Error) => setWriteError(`Couldn't save: ${error.message}`)
    );

  const addEvent = (fields: Omit<TrackerEvent, "id">) => {
    if (!db) {
      const id = `local-${fields.time.getTime()}-${Math.random().toString(36).slice(2, 6)}`;
      setEvents((prev) => [{ ...fields, id }, ...prev].sort(byNewest));
      return;
    }
    write(addDoc(collection(db, "events"), { ...fields, time: Timestamp.fromDate(fields.time) }));
  };

  const removeEvent = (id: string) => {
    if (!db) {
      setEvents((prev) => prev.filter((item) => item.id !== id));
      return;
    }
    write(deleteDoc(doc(db, "events", id)));
  };

  const addWalk = (walk: WalkFields) => addEvent({ type: "di_bo", ...walk });

  const updateWalk = (id: string, walk: WalkFields) => {
    if (!db) {
      setEvents((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...walk } : item)).sort(byNewest)
      );
      return;
    }
    write(updateDoc(doc(db, "events", id), { ...walk, time: Timestamp.fromDate(walk.time) }));
  };

  /** Meals are a yes/no per day: tapping logs it, tapping again undoes it. */
  const toggleMeal = (type: MealType) => {
    const now = new Date();
    const loggedToday = events.filter((item) => item.type === type && isSameTrackerDay(item.time, now));
    if (loggedToday.length > 0) {
      loggedToday.forEach((item) => removeEvent(item.id));
    } else {
      addEvent({ type, time: now });
    }
  };

  const updateLyLevel = (value: number) => {
    const level = Math.max(0, Math.min(100, Math.round(value)));
    setLyLevel(level);
    const firestore = db;
    if (!firestore) return;
    // Dragging fires dozens of updates a second; only write once the finger settles.
    if (lyWriteTimer.current) clearTimeout(lyWriteTimer.current);
    lyWriteTimer.current = setTimeout(() => {
      write(setDoc(doc(firestore, "state", "ly"), { value: level, updatedAt: Timestamp.now() }, { merge: true }));
    }, 120);
  };

  const saveProfile = async (next: Profile) => {
    const normalized = normalizeProfile(next);
    setProfile(normalized);
    cacheProfile(normalized);
    if (!db) return;
    await write(setDoc(doc(db, "state", "profile"), { ...normalized, updatedAt: Timestamp.now() }, { merge: true }));
  };

  const syncError = listenerError ?? writeError;
  const syncStatus: SyncStatus = !db ? "local" : syncError ? "error" : connected ? "live" : "connecting";

  return {
    events,
    lyLevel,
    profile,
    syncStatus,
    syncError,
    addWalk,
    updateWalk,
    removeEvent,
    toggleMeal,
    updateLyLevel,
    saveProfile,
  };
}
