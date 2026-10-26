# Dibo

A little kiosk for keeping track of our dog: when he was last walked, whether he's
pooped today, and whether he's had breakfast and dinner. It runs full-screen on a
Raspberry Pi with a 7" touchscreen by the door, and syncs through Firestore so
everyone in the house sees the same thing.

## What's on the screen

- **Last walk**: the time of the last walk, how long ago that was, and a badge that
  goes from green to yellow, orange, then red as it gets closer to 8 hours.
- **The dog**: a small pixel chihuahua that reacts to the same thing (happy, antsy,
  begging for a walk, or asleep at night). Tapping it opens the walk list.
- **Did he poop / Breakfast / Dinner**: tap Breakfast or Dinner to mark it done, and
  tap again to undo. Poop comes from the walks logged today.
- **Lỳ meter**: the slider on the right. Drag it up when he's being stubborn (lỳ)
  and down when he's being good (ngoan).

"Today" rolls over at **3am**, so a late-night walk still counts toward the evening
it belongs to. The theme switches to a dim night palette from 7pm to 7am.

## Running it locally

```bash
npm install
npm run dev
```

Without a `.env`, the app runs in offline mode: everything works, but nothing is
saved or synced. To connect it to Firebase, create a project with Firestore enabled,
copy `.env.example` to `.env`, and fill in your web app config.

Firestore layout:

| Path             | What's in it                                                       |
| ---------------- | ------------------------------------------------------------------ |
| `events/*`       | `{ type, time, peed?, pooped? }`, where `type` is `di_bo` (walk), `an_sang` (breakfast) or `an_chieu` (dinner) |
| `state/ly`       | `{ value }`, the Lỳ meter from 0 to 100                            |
| `state/profile`  | `{ name, gender }`                                                 |

## Code layout

- `src/hooks/useTracker.ts`: all the data, whether from Firestore or in memory
- `src/hooks/useNow.ts`: a clock that ticks on the minute
- `src/lib/time.ts`: the 3am day boundary and keypad time parsing
- `src/components/`: one file per screen, plus the Lỳ meter and the pixel dog

## On the Pi

See [PI_SETUP.md](../PI_SETUP.md). In short, `setup-pi.sh` installs everything and
sets up autostart, and `start-kiosk.sh` pulls the latest `main` on every boot,
rebuilds if anything changed, and keeps Chromium open in kiosk mode.
