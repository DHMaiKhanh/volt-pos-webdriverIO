# Volt POS — E2E Automation

End-to-end test automation for the **Volt POS** Windows desktop application: a Tauri v2 app with a
React 19 frontend rendered inside WebView2, a Rust backend, and three SQLCipher-encrypted SQLite
databases on the till itself.

The suite drives the **real, packaged application** — the same `.exe` a salon installs — through the
W3C WebDriver protocol. It logs in, builds orders, takes payments, issues refunds and reads the
income reports, exactly as a staff member would.

---

## Why WebdriverIO + tauri-driver, and not Playwright or Cypress

Playwright and Cypress are browser tools. They attach to an HTTP origin and speak CDP, or they run
inside the page. Volt POS gives them nothing to attach to.

- **The UI is not served over HTTP.** In a packaged build Tauri serves the frontend bundle from its
  custom protocol — `http://tauri.localhost` on Windows — straight out of the binary's embedded
  assets. `http://localhost:1420` exists only while a developer runs `tauri dev` with Vite in front
  of it. There is no dev server, no port, and no URL to hand to `page.goto()`.
- **GraphQL does not travel over the network.** The frontend's fetcher (`src/lib/graphql-fetcher.ts`
  in the app repo) invokes the Tauri command `commands.graphql` over IPC; the Rust side executes the
  query against the local encrypted SQLite database. Nothing crosses a socket, so there is no
  request to intercept, stub, wait for, or assert on. Playwright's `route()` and Cypress's
  `cy.intercept()` have no surface area here.
- **Half the product is native.** Two OS windows (staff plus customer display), the cash drawer, the
  card terminal, the receipt printer, the single-instance guard and the auto-updater all live in
  Rust. A browser-only driver cannot see any of it.

`tauri-driver` is Tauri's official WebDriver server. It launches the application binary, hands the
WebView2 side of it to `msedgedriver`, and proxies a standard WebDriver session on
`127.0.0.1:4444`. WebdriverIO speaks that protocol natively and — unlike a browser-first tool — does
not assume it is driving a browser. That combination is the only supported way to automate a Tauri
desktop app, and it exercises the shipped artifact rather than a stand-in.

---

## Three environments means three different executables

This is the most important fact about running the suite, and it is not a configuration preference —
it is how the app is compiled.

`src-tauri/build.rs` in the app repo emits the backend address as a **compile-time** variable:

```rust
println!("cargo:rustc-env=UPSTREAM_BASE_URI={}", upstream_base_uri);
```

and the Rust code reads it back through the `env!()` macro, which the compiler expands and bakes
into the binary as a string constant:

```rust
const UPSTREAM_PUSHING_URI: &str = concat!(env!("UPSTREAM_BASE_URI"), "/syncing/pushing");
```

There is no runtime lookup. Nothing this suite sets — no environment variable, no CLI flag, no
config file, no IPC call — can move an installed build from dev to staging or production. **dev,
staging and prod are three separate `.exe` files, produced by three separate CI runs.**

So `ENV` selects **which binary to drive**, not which backend to talk to:

| `ENV`     | Drives a build compiled against          | Lane config                         |
| --------- | ---------------------------------------- | ----------------------------------- |
| `dev`     | `https://volt-pos.v2.dev-fastboypay.com` | `configs/wdio/wdio.dev.conf.ts`     |
| `staging` | `https://sys.stage.volt-pos.fastboy.dev` | `configs/wdio/wdio.staging.conf.ts` |
| `prod`    | `https://volt-pos.v2.fastboypay.com`     | `configs/wdio/wdio.prod.conf.ts`    |

Each lane needs its own `APP_PATH` pointing at the matching install. A machine can hold several
builds at once, all named `volt-pos-app.exe`, so every run prints a banner naming the exact binary
it resolved plus every other build it found and did not use. Read that banner. A green run against
the wrong executable is the most expensive result this suite can produce, because it looks like a
pass.

Full detail: [`docs/environments.md`](docs/environments.md).

---

## Quick start

**Prerequisites** — Windows 10/11 with an interactive desktop session, Node 22.18 (see `.nvmrc`),
Rust (for `cargo install tauri-driver`), the WebView2 Runtime, and an installed Volt POS build for
the environment you intend to test. Step-by-step from a clean machine:
[`docs/getting-started.md`](docs/getting-started.md).

```powershell
npm run setup                                           # install deps + fetch tauri-driver/msedgedriver
Copy-Item configs/env/.env.example configs/env/.env.dev # then fill in APP_PATH and credentials
npm run preflight                                       # verify drivers, binary, ports, app data
npm test                                                # ENV=dev, full suite
```

`npm run preflight` is the gate worth trusting: it resolves the executable, checks the driver
binaries exist, confirms port 4444 is free, reports which builds are installed, and fails with a
specific remedy instead of letting a session hang.

---

## Commands

| Command                                                               | What it does                                                                                          |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm run setup`                                                       | `npm install` plus `setup:drivers`. Run once per machine.                                             |
| `npm run setup:drivers`                                               | Installs `tauri-driver` and the `msedgedriver` matching the local WebView2 Runtime into `.drivers/`.  |
| `npm run preflight`                                                   | Pre-run health check: drivers, resolved binary, free port, app data, credentials.                     |
| `npm test`                                                            | Alias for `test:dev`.                                                                                 |
| `npm run test:dev`                                                    | Full suite against the dev build. Writes allowed, one retry.                                          |
| `npm run test:staging`                                                | Full suite against the staging build. `bail: 1` — stops at the first failure.                         |
| `npm run test:prod`                                                   | **Smoke only**, read-only, no retries. See the safety rails below.                                    |
| `npm run test:smoke`                                                  | The `@smoke` suite against dev.                                                                       |
| `npm run test:regression`                                             | The `@regression` suite against dev.                                                                  |
| `npm run test:critical`                                               | Grep-filtered `@critical` lane — the revenue path that gates a release.                               |
| `npm run test:spec -- tests/regression/checkout/cash-payment.spec.ts` | A single spec file.                                                                                   |
| `npm run app:launch`                                                  | Starts the installed app with WebView2 remote debugging enabled, for attach mode.                     |
| `npm run app:kill`                                                    | Kills leftover app and driver processes (`volt-pos-app.exe`, `tauri-driver.exe`, `msedgedriver.exe`). |
| `npm run test:attach`                                                 | Runs specs against an already-running app over CDP. See attach mode below.                            |
| `npm run db:reset`                                                    | Snapshots then wipes `%APPDATA%\VoltPOS\Databases\<merchantId>`. Never runs against prod.             |
| `npm run db:backup`                                                   | Snapshot only — copies the databases into `.db-backups/` and deletes nothing.                         |
| `npm run audit:testids`                                               | Diffs every `data-testid` the suite depends on against the app source and prints what is missing.     |
| `npm run report:allure`                                               | Generates the Allure HTML report into `reports/allure-report`.                                        |
| `npm run report:open`                                                 | Opens the generated report.                                                                           |
| `npm run report:serve`                                                | Generates and serves the report in one step.                                                          |
| `npm run lint`                                                        | ESLint, zero warnings tolerated.                                                                      |
| `npm run lint:fix`                                                    | ESLint with `--fix`.                                                                                  |
| `npm run format`                                                      | Prettier write.                                                                                       |
| `npm run format:check`                                                | Prettier check — what CI enforces.                                                                    |
| `npm run typecheck`                                                   | `tsc --noEmit` under `strict` plus `noUncheckedIndexedAccess`.                                        |
| `npm run verify`                                                      | `typecheck` + `lint` + `format:check`. The merge gate.                                                |
| `npm run clean`                                                       | Removes `reports/`, `logs/`, `.tmp/`.                                                                 |
| `npm run prepare`                                                     | Installs the husky hooks. npm runs it for you after `npm install`.                                    |

---

## Repository layout

| Path                       | Contents                                                                                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `configs/constants/`       | `timeouts.ts` (one timeout budget for the whole suite), `paths.ts` (every path, including `%APPDATA%\VoltPOS`).                                                  |
| `configs/env/`             | `loadEnv.ts` (typed run config plus `assertWritesAllowed`), `resolveApp.ts` (which `.exe` to drive), `.env.example`. Real `.env.*` files are git-ignored.        |
| `configs/wdio/`            | `wdio.shared.conf.ts` holds all behaviour; the four per-lane files state only their differences.                                                                 |
| `src/pages/`               | One page object per screen, extending `BasePage`. Owns that screen's actions; its selectors come from the catalogue.                                             |
| `src/components/`          | Dialogs, sheets, keypads and nav chrome, extending `BaseComponent`. Every lookup is scoped to a root element.                                                    |
| `src/flows/`               | Multi-screen business actions ("create an order and pay it in cash", "get back to the till"). Specs call flows; flows call pages.                                |
| `src/helpers/`             | `selectors.ts` (the `Locator` model), `wait.ts`, `window.ts` (dual-window switching), `updater.ts`, `steps.ts` (the in-app step overlay).                        |
| `src/support/`             | `UiObject.ts` (the find/click/wait engine), `net.ts`, `process.ts`, and the two WebdriverIO services.                                                            |
| `src/db/`                  | `reset.ts`, `appLogs.ts` — filesystem work against the app's data directory — plus `VoltPosDb.ts`, which reads a snapshot copy where the build is not encrypted. |
| `src/constants/testids.ts` | **The selector catalogue.** Every `data-testid` the suite depends on, with its reviewed fallback. What `audit:testids` diffs against the app.                    |
| `src/constants/routes.ts`  | Router paths transcribed from the app's `routeTree.gen.ts`.                                                                                                      |
| `src/data/`                | Static fixtures (staff, services, payment methods) and builders, read from `.env`. Not yet wired into any spec.                                                  |
| `src/utils/`               | `money.ts` (cents parsing plus `expectCentsEqual`), `date.ts`, `string.ts`, `logger.ts`.                                                                         |
| `src/types/testTags.ts`    | The tag vocabulary (`@smoke`, `@critical`, `@write`, …) and the `title()` helper.                                                                                |
| `tests/setup/`             | `rootHooks.ts` — the Mocha root hooks, loaded via `mochaOpts.require`. Signs in once per spec file.                                                              |
| `tests/smoke/`             | Read-only specs. The only suite permitted against production.                                                                                                    |
| `tests/regression/`        | Full functional coverage, grouped by feature area. Creates data.                                                                                                 |
| `scripts/`                 | Operator tooling: driver setup, preflight, launch/kill, DB reset, testid audit.                                                                                  |
| `docs/`                    | Architecture, getting started, environments, writing tests, troubleshooting.                                                                                     |
| `reports/`                 | Allure results and report, failure screenshots, app-log tails, WebdriverIO logs. Git-ignored.                                                                    |
| `.drivers/`                | Locally installed `tauri-driver.exe` and `msedgedriver.exe`. Preferred over anything on `PATH`.                                                                  |

---

## Production safety rails

A production build talks to the live payment gateway and pushes every local row upstream through
`/syncing/pushing`. A checkout spec run there does not simulate a sale — it makes one: a real order
against a real merchant, a real card authorization, real money in someone's end-of-day report. Four
independent mechanisms stand between the suite and that outcome.

1. **The prod lane refuses to run anything but smoke.** `configs/wdio/wdio.prod.conf.ts` throws on
   load if `ENV !== 'prod'`, then hard-pins both `specs` and the only registered suite to
   `tests/smoke/**`. Passing `--suite regression` to it selects nothing.
2. **`assertWritesAllowed(action)` guards every data-creating flow.** `loadEnv()` forces
   `WRITE_ALLOWED = false` for prod unless `ALLOW_PROD_WRITES=i-know-what-i-am-doing` is set
   verbatim — a spelled-out opt-in, because a plain boolean is too easy to flip by accident in a CI
   matrix. The guard **throws** rather than skipping: a checkout spec that silently no-ops reads as
   a pass and hides the fact that the lane was never covered at all.
3. **The database is never reset.** `RESET_DB` is forced `false` for prod. Those files belong to a
   live till and hold orders that have not finished syncing upstream.
4. **No retries.** `specFileRetries` is `0` and `bail` is `1`. A flaky production result is a
   finding; re-running it destroys the finding.

Anything tagged `@write` or `@payment` therefore belongs in `tests/regression/`, never in
`tests/smoke/`.

---

## Attach mode

Normally `tauri-driver` launches its own copy of the binary — a clean process, a known boot, and the
right default for every scheduled run. Attach mode is the exception:

```powershell
npm run app:launch    # starts the installed app with --remote-debugging-port
npm run test:attach
```

WebView2 exposes a Chrome DevTools Protocol endpoint when it is started with a remote-debugging
port, and `msedgedriver` connects to it through `ms:edgeOptions.debuggerAddress` instead of starting
a browser. `tauri-driver` is not involved in this mode at all.

**What it is for:** driving an app a human already has open — an installed production till, a build
reproducing a customer-reported defect, a session someone logged into by hand — without reinstalling
or restarting anything.

**The trade-off:** the app's state is whatever the operator left behind, not a clean boot. The
current screen, the signed-in staff member, the cart contents and the local database are all
unknown. Attach mode is for smoke checks and defect reproduction; the regression suite must not run
in it, because its specs assume they start from a known screen. Retries are disabled there for the
same reason.

---

## Where results land

- `reports/allure-results/` — raw Allure results, labeled with `env`, `mode` and `upstream`.
- `reports/screenshots/` — a PNG per failed test, also attached to the Allure result.
- `reports/app-logs/` — the tail of the app's own rolling log (`%LOCALAPPDATA%\VoltPOS\logs\`) at the
  moment of failure. A desktop app leaves no browser console to reopen, so this plus the screenshot
  is the entire post-mortem.
- `logs/e2e.log` — the framework's own structured log, which survives a truncated CI console.

---

## Documentation

| Document                                             | Read it when                                                    |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| [`docs/getting-started.md`](docs/getting-started.md) | Setting up a machine, or getting a build for an environment.    |
| [`docs/architecture.md`](docs/architecture.md)       | Understanding the layers, or changing the framework itself.     |
| [`docs/environments.md`](docs/environments.md)       | Deciding what may run where, or chasing a wrong-backend result. |
| [`docs/writing-tests.md`](docs/writing-tests.md)     | Writing a new spec, page object or flow.                        |
| [`docs/troubleshooting.md`](docs/troubleshooting.md) | A run hangs, dies, or passes when it should not.                |
| [`CONTRIBUTING.md`](CONTRIBUTING.md)                 | Opening a pull request.                                         |
| [`docker/README.md`](docker/README.md)               | Someone asks why this does not run in a container.              |
