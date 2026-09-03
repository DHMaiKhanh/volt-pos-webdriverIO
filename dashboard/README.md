# Volt POS — E2E Run Dashboard

A small, self-contained React app that visualises the E2E suite's run history.
It is a **separate package** from the test framework: its own `package.json`, its
own dependencies, its own build. The test project never imports it.

## How data gets here

There is no manual step. A custom WebdriverIO reporter
(`configs/reporters/DashboardReporter.ts`) records every spec of a run, and the
launcher folds them into one entry appended to `public/data/history.json` when the
run finishes (`configs/reporters/dashboardStore.ts`, wired from
`configs/wdio/wdio.shared.conf.ts`). So **any** test lane feeds the dashboard:

```bash
npm test              # or test:regression, test:smoke, test:spec …
```

Each run adds one record (newest first, last 50 kept). `npm run clean` does **not**
wipe the history — it lives under `dashboard/`, not `reports/`.

## Viewing it

From the **test project root**:

```bash
npm run dashboard:install   # one time — installs this app's deps
npm run dashboard           # starts Vite, opens http://localhost:4321
```

…or from this folder directly: `npm install` then `npm run dev`.

The page **polls `history.json` every few seconds**, so you can leave it open
during a run and watch the latest results appear when the run completes. There is
also a manual **Refresh** button and a light/dark toggle.

## What it shows

- **KPI tiles** for the selected run — pass rate (hero), totals, duration, and a
  pass/fail/skip composition bar.
- **Pass-rate trend** across recent runs — green dots are clean runs, red dots had
  failures; click a dot (or a row in Run history) to inspect that run.
- **Run history** — every recorded run, selectable.
- **Results** — per spec file, expandable to each test, with failure messages and
  stacks. Filter by status or search by name. Failures are expanded by default.

## Building a static bundle

```bash
npm run dashboard:build     # outputs dashboard/dist/
```

`base` is relative, so `dist/` can be served by any static file server (or hosted
in CI as an artifact). It still reads `data/history.json` beside `index.html`.

## Keeping types in sync

`src/types.ts` mirrors `configs/reporters/types.ts` in the test project. They are
duplicated on purpose (two packages, two tsconfigs); keep them aligned when the run
shape changes.
