import { useEffect, useState } from "react";

/** Current time, refreshed right after each minute ticks over. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const scheduleNextTick = () => {
      // Recomputed every tick, so it recovers if the Pi's clock jumps after an NTP sync.
      const msUntilNextMinute = 60_000 - (Date.now() % 60_000);
      timer = setTimeout(() => {
        setNow(new Date());
        scheduleNextTick();
      }, msUntilNextMinute + 50);
    };
    scheduleNextTick();
    return () => clearTimeout(timer);
  }, []);

  return now;
}
