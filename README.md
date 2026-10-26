# Dibo

A little kiosk for keeping track of our dog: when he was last walked, whether he's
pooped today, and whether he's had breakfast and dinner. It runs full-screen on a
Raspberry Pi with a 7" touchscreen by the door and syncs through Firestore, so
anyone who logs a walk from another device shows up on the screen too.

## What's on the screen

- **Last walk.** The time of the last walk and how long ago it was. The badge goes
  from green to yellow at 4 hours, orange at 6, and red at 8.
- **The dog.** A pixel chihuahua that follows the same clock: happy after a walk,
  antsy after 4 hours, hopping and asking to go out after 8, asleep late at night.
  Tap it to open the walk list.
- **Did he poop / Breakfast / Dinner.** Tap Breakfast or Dinner to mark it, tap again
  to undo. Poop is filled in from the walks logged today.
- **Lỳ meter.** The slider on the right. Up when he's being stubborn (lỳ), down when
  he's being good (ngoan).

A day runs from 3am to 3am, so a midnight walk still counts toward the evening it
belongs to. The screen uses a light theme from 7am to 7pm and a dim one at night.
All of these are constants in `src/lib/time.ts`, `src/lib/theme.ts` and
`src/components/Dashboard.tsx`.

## Running it

The app lives in `dibo-tracker/`.

```bash
cd dibo-tracker
npm install
npm run dev
```

Without a `.env` it runs offline: everything works, but nothing is saved. To sync,
create a Firebase project with Firestore, copy `.env.example` to `.env` and fill in
the web app config. `.env` is gitignored.

The data is small:

| Path            | Contents                                                                        |
| --------------- | ------------------------------------------------------------------------------- |
| `events/*`      | `{ type, time, peed?, pooped? }`, with `type` one of `di_bo` (walk), `an_sang` (breakfast), `an_chieu` (dinner) |
| `state/ly`      | `{ value }`, the Lỳ meter, 0 to 100                                            |
| `state/profile` | `{ name, gender }`                                                              |

There's no login, so your Firestore security rules are the only thing standing
between the database and anyone who has your config. Don't leave a project on the
default test-mode rules: they either expire (and sync stops) or allow anyone in.

## Code

- `src/hooks/useTracker.ts`: all reads and writes, from Firestore or in memory
- `src/hooks/useNow.ts`: a clock that ticks over on the minute
- `src/lib/time.ts`: the 3am day boundary and keypad time parsing
- `src/components/`: one file per screen, plus the Lỳ meter and the pixel dog

`npm run lint` and `npm run build` should both pass before pushing, since the Pi
builds whatever is on `main`.

## On the Pi

[PI_SETUP.md](PI_SETUP.md) covers the whole setup. Once it's running, the Pi pulls
`main` and rebuilds on every boot, so deploying is: push, then reboot the Pi.
