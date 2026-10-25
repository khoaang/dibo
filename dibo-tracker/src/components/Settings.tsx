import { useState } from "react";
import type { Gender, Profile, SyncStatus } from "../hooks/useTracker";
import { Screen } from "./Screen";

type SettingsProps = {
  profile: Profile;
  syncStatus: SyncStatus;
  syncError: string | null;
  onSave: (profile: Profile) => Promise<void>;
  onClose: () => void;
};

const SYNC_DESCRIPTION: Record<SyncStatus, string> = {
  local: "Not connected to Firebase. Changes stay on this screen only.",
  connecting: "Connecting to Firebase…",
  live: "Synced with Firebase.",
  error: "Firebase isn't syncing.",
};

const GENDERS: { value: Gender; label: string }[] = [
  { value: "male", label: "Boy" },
  { value: "female", label: "Girl" },
];

export function Settings({ profile, syncStatus, syncError, onSave, onClose }: SettingsProps) {
  const [name, setName] = useState(profile.name);
  const [gender, setGender] = useState(profile.gender);
  const [saving, setSaving] = useState(false);
  const changed = name.trim() !== profile.name || gender !== profile.gender;

  const save = async () => {
    setSaving(true);
    await onSave({ name, gender });
    onClose();
  };

  return (
    <Screen title="Settings" onClose={onClose}>
      <div className="space-y-3">
        <label className="block">
          <div className="mb-1 text-sm font-semibold text-muted">Dog's name</div>
          <input
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            className="h-12 w-full rounded-xl bg-surface px-3 text-lg text-ink outline-none focus:ring-2 focus:ring-accent"
          />
        </label>

        <div>
          <div className="mb-1 text-sm font-semibold text-muted">Boy or girl</div>
          <div className="grid grid-cols-2 gap-2">
            {GENDERS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setGender(value)}
                className={`h-12 rounded-xl text-base font-bold transition ${
                  gender === value ? "bg-accent text-on-accent" : "bg-surface text-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={save}
          disabled={!changed || saving}
          className="h-12 w-full rounded-xl bg-accent text-base font-extrabold text-on-accent transition disabled:bg-surface-press disabled:text-faint"
        >
          {saving ? "Saving…" : "Save"}
        </button>

        <p className="text-sm text-muted">
          {SYNC_DESCRIPTION[syncStatus]}
          {syncError && <span className="mt-1 block text-on-alert">{syncError}</span>}
        </p>
      </div>
    </Screen>
  );
}
