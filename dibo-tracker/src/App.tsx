import { useEffect, useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { Settings } from "./components/Settings";
import { WalkEditor } from "./components/WalkEditor";
import { WalkList } from "./components/WalkList";
import { useNow } from "./hooks/useNow";
import { useTracker } from "./hooks/useTracker";
import { themeForTime } from "./lib/theme";
import { isSameTrackerDay } from "./lib/time";

type View =
  | { name: "dashboard" }
  | { name: "settings" }
  | { name: "walks" }
  | { name: "walk-editor"; walkId?: string };

function App() {
  const now = useNow();
  const tracker = useTracker();
  const [view, setView] = useState<View>({ name: "dashboard" });
  const theme = themeForTime(now);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const goHome = () => setView({ name: "dashboard" });
  const goWalks = () => setView({ name: "walks" });

  switch (view.name) {
    case "settings":
      return (
        <Settings
          profile={tracker.profile}
          syncStatus={tracker.syncStatus}
          syncError={tracker.syncError}
          onSave={tracker.saveProfile}
          onClose={goHome}
        />
      );

    case "walks":
      return (
        <WalkList
          walks={tracker.events.filter((item) => item.type === "di_bo" && isSameTrackerDay(item.time, now))}
          onNew={() => setView({ name: "walk-editor" })}
          onEdit={(walk) => setView({ name: "walk-editor", walkId: walk.id })}
          onDelete={tracker.removeEvent}
          onClose={goHome}
        />
      );

    case "walk-editor": {
      const walk = view.walkId ? tracker.events.find((item) => item.id === view.walkId) : undefined;
      // The walk was deleted from another device while we were editing it.
      if (view.walkId && !walk) {
        goWalks();
        return null;
      }
      return (
        <WalkEditor
          key={view.walkId ?? "new"}
          walk={walk}
          onSave={(fields) => {
            if (walk) tracker.updateWalk(walk.id, fields);
            else tracker.addWalk(fields);
            goWalks();
          }}
          onClose={goWalks}
        />
      );
    }

    default:
      return (
        <Dashboard
          now={now}
          events={tracker.events}
          profile={tracker.profile}
          syncStatus={tracker.syncStatus}
          lyLevel={tracker.lyLevel}
          onLyChange={tracker.updateLyLevel}
          onToggleMeal={tracker.toggleMeal}
          onOpenWalks={goWalks}
          onOpenSettings={() => setView({ name: "settings" })}
        />
      );
  }
}

export default App;
