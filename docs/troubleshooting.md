# Troubleshooting

Every entry below is a failure that has actually happened against this application. They are
ordered roughly by how often they occur and how misleading they are.

---

## First, collect the evidence

A desktop app leaves almost nothing behind on its own — there is no browser console to reopen and
no network tab. Four places hold the answer:

| Where                          | What is in it                                                               |
| ------------------------------ | --------------------------------------------------------------------------- |
| `reports/screenshots/`         | A PNG per failed test. Usually identifies the failure category immediately. |
| `reports/app-logs/`            | The tail of the app's own log at the moment of failure.                     |
| `logs/e2e.log`                 | The framework's structured log, including which selector chain was tried.   |
| `%LOCALAPPDATA%\VoltPOS\logs\` | The app's full rolling log (tauri-plugin-log), including Rust-side errors.  |

Two switches make a reproduction far easier to read:

```dotenv
LOG_LEVEL=debug      # driver stdout/stderr, every click and find
KEEP_APP_OPEN=true   # leave the app running after the session so you can look at it
```

---

## The session opens, then nothing happens until the timeout

**Symptom.** `tauri-driver` starts, the log says it is ready on 4444, the app window may or may not
appear, and then WebdriverIO sits on `newSession` (or on the first command) until it gives up.
There is no error message anywhere, which is what makes this one so expensive.

**Cause, almost always.** `msedgedriver.exe` does not match the installed **WebView2 Runtime**
version. The two negotiate on connect and simply stop talking when the major versions differ —
neither side reports a version-mismatch error. WebView2 updates itself silently in the background,
so a machine that worked last week breaks with no local change.

**Confirm it.** Compare the two:

```powershell
$key = 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
(Get-ItemProperty $key).pv          # WebView2 Runtime, e.g. 151.0.4129.107
.\.drivers\msedgedriver.exe --version
```

The major version must match. Anything else is a mismatch, whatever the rest of the number says.

**Fix.**

```powershell
npm run app:kill
npm run setup:drivers   # re-reads the registry and fetches the matching driver
npm run preflight
```

If a system-wide `msedgedriver.exe` is also on `PATH`, leave it alone — `TauriDriverService`
prefers `.drivers/` precisely so an unrelated driver installed for browser work cannot be picked up
silently. Setting `MSEDGEDRIVER_PATH` explicitly in the environment file removes all ambiguity.

---

## `EADDRINUSE` / port 4444 is already in use

**Symptom.** `TauriDriverService` fails to start, or starts and immediately exits, and the session
never connects. On Windows this can also surface as the _previous_ run's driver answering the new
session.

**Cause.** An orphaned `tauri-driver.exe` or `msedgedriver.exe` from a run that was killed with
Ctrl+C, or a socket still in `TIME_WAIT`. `tauri-driver` spawns `msedgedriver`, which spawns the
WebView2 host processes, so killing only the parent leaves a child holding the port.

**Confirm it.**

```powershell
netstat -ano | Select-String ':4444'
tasklist | Select-String 'tauri-driver|msedgedriver|volt-pos'
```

**Fix.**

```powershell
npm run app:kill    # taskkill /F /T on the whole family
npm run preflight
```

`killStaleProcesses` uses `/T` for exactly this reason. If 4444 is genuinely taken by something
else on the machine, move the suite instead: `DRIVER_PORT=4455` in the environment file.

---

## The app launches, but the driver is talking to nothing

**Symptom.** A Volt POS window appears on screen — often the one that was _already_ open — and
every command times out. Screenshots show a perfectly healthy app that ignores the test.

**Cause.** `tauri-plugin-single-instance`. When a second copy of the app starts, Windows hands the
invocation to the existing instance, which focuses its own window and terminates the new process.
`tauri-driver` observes a launch that "succeeded" and opens a session against a process that no
longer exists.

**Confirm it.** Look for a Volt POS window that was open before the run started, or a
`volt-pos-app.exe` in `tasklist` with an older start time than the run.

**Fix.** `AppLifecycleService.beforeSession` clears stale app processes before
`TauriDriverService` starts — that is why the services are registered in that order. If it still
happens:

- something started the app _between_ the cleanup and the launch (a Windows startup entry, a
  colleague on a shared machine, an explorer double-click);
- or `WDIO_MODE=attach` is set (the variable `loadEnv.ts` actually reads — `MODE` alone does
  nothing), in which case neither the app nor the drivers are killed: attach mode drives what
  `npm run app:launch` started, so the session owns neither.

Run `npm run app:kill`, close any tray icon, and check that nothing auto-starts the app on that
machine.

---

## The updater toast steals a click

**Symptom.** An intermittent failure in the top-right region of the screen: a click lands on
nothing, or on the wrong control. The screenshot shows a wide white panel over the header reading
"New update available".

**Cause.** `SoftwareUpdaterTrigger` checks for an update as soon as it mounts, and the Rust side
registers the updater plugin with

```rust
.default_version_comparator(|_current, _update| true)
```

— it treats **every** response as newer, so an installed build under test will reliably get an
update offer. The toast is a sonner `toast.custom` rendered by a `<Toaster position="top-right" />`,
640px wide, appearing about a second after the check resolves. It carries no `data-testid`, so it
cannot be waited on cleanly; it simply arrives on top of real controls.

**Fix.** Leave `AUTO_DISMISS_UPDATER=true` (the default). `src/helpers/updater.ts` runs a watcher
for the session and dismisses the toast whenever it appears; `dismissUpdaterIfPresent()` is
available for a spec that needs to force the issue at a specific moment.

The endpoint cannot be disabled from the test side: it is baked into
`src-tauri/tauri.<env>.conf.json` and the check runs from Rust, out of the webview's reach. See the
appendix if you want to block it at the network level.

---

## The forced-update screen takes over

**Symptom.** `waitForReady()` fails fast with "the forced-update screen took over", or every spec
in the run fails on the same screen. The app shows a full-screen update prompt with no way past it.

**Cause.** The updater response carried `deprecated: true`. `SoftwareUpdaterTrigger` then calls
`updateActions.setForcedUpdate(...)` and the app routes to `/force-update`. Unlike the toast, this
is not dismissible — that is the point of it.

Note the check runs **on every navigation**, throttled to once per five seconds, not only at
startup. So a run can be perfectly healthy for ten minutes and then hit this on a route change. It
is skipped on `/customer`, on `FORCE_UPDATE_SKIP_PATHS` (`/force-update`, `/customer/force-update`),
and entirely when `import.meta.env.DEV` — which a packaged build is not.

**Fix.** Install the version that environment expects. The server has declared the build under test
too old, and no test-side setting overrides that. `BasePage.waitForReady()` recognizes this screen
and says so explicitly rather than timing out on a missing anchor.

---

## The app renders its error boundary instead of the screen

**Symptom.** `waitForReady()` fails with "the app rendered its error boundary instead of the
screen", plus a detail string.

**Cause.** The query behind that screen threw. This is an **environment or account** problem, not a
selector problem: a merchant missing required data, an expired session, a schema mismatch between
the installed build and the backend it was compiled against, or an upstream error.

**Confirm it.** Read the detail in the message, then `reports/app-logs/` and
`%LOCALAPPDATA%\VoltPOS\logs\` for the Rust-side error behind the failed IPC call.

**Fix.** Check, in order:

1. Is this build talking to the backend you think? Compare the run banner's upstream host with
   `desc.txt` from the installer.
2. Is the merchant in `MERCHANT_ID` set up for what the spec needs — services, staff, permissions?
3. Did the local database come from a _different_ environment's build? All environments share
   `%APPDATA%\VoltPOS`, so this happens after swapping installs. Run `npm run db:reset` (never on
   prod) and let the app re-sync.

`waitForReady()` races the error boundary against the readiness anchor precisely so this fails in
about a second instead of after the full timeout with a message blaming the selector.

---

## The splash screen never finishes

**Symptom.** The app sits on `/splashscreen` until the `APP_BOOT` budget (90s) expires.

**Cause.** The splash is not a decoration. It runs the SQLite migrations, opens three
SQLCipher-encrypted databases (Main, Pushing, Pulling) and performs a sync handshake with upstream
before the router mounts. Anything in that chain can stall:

- the upstream host is unreachable from this machine (VPN, proxy, DNS, a hosts entry left behind —
  see the appendix);
- a migration is running against a large local database for the first time after an app update;
- the local database is corrupt or was written by a different build;
- credentials in `%APPDATA%\VoltPOS\credentials` are for a different environment's backend, so the
  handshake is rejected.

**Confirm it.** `%LOCALAPPDATA%\VoltPOS\logs\` shows exactly which stage it stopped at.

**Fix.** Confirm the upstream host resolves and answers from that machine. Then, on a non-production
environment, `npm run db:reset` — it snapshots into `.db-backups/` before deleting, so the previous
state is recoverable. A first cold boot after a reset legitimately takes most of the 90-second
budget; that is the app, not the suite.

---

## Login fails immediately after swapping which build you drive

**Symptom.** Credentials that worked yesterday are rejected. Nothing else changed.

**Cause.** Credentials are per environment, and the auth host is a _different_ host from the data
host on dev and prod (`sys.v2.dev-fastboypay.com`, `sys.v2.fastboypay.com`). Dev credentials do not
authenticate against staging.

**Fix.** Use the `STAFF_TOKEN` from the matching `.env.<ENV>` file, and clear
the stored token in `%APPDATA%\VoltPOS\credentials` if the app is trying to resume the previous
environment's session.

---

## The session is driving the customer display

**Symptom.** Every locator fails on a screen that looks nothing like the one the spec expects. The
screenshot shows the customer-facing display.

**Cause.** A previous `@dual-window` spec switched to the customer window and did not switch back,
or the app opened the customer window with focus.

**Confirm it.** `await browser.getTitle()` returns `VOLT POS - Customer Display`, or
`[data-testid="customer-welcome-screen"]` exists.

**Fix.** Every `@dual-window` spec must switch back to `main` before it finishes; the next spec
assumes it starts on the staff window. Switch by title:
`browser.getWindowHandles()` → `switchToWindow(handle)` → `getTitle() === 'VOLT POS'`.

---

## A spec passed — against the wrong build

**Symptom.** None. That is the problem. The run is green, and it proved nothing about the build you
meant to test.

**Cause.** All three environments compile to the same product name and install to the same path
(`%LOCALAPPDATA%\volt-pos\volt-pos-app.exe`), so an installer for another environment silently
replaced the one you thought was there. Or `APP_PATH` was left blank and discovery picked the first
candidate it found.

**Confirm it.** Four independent checks, in descending order of trust:

1. `desc.txt` from the CI artifact — records the environment, version, branch and build time.
2. The run banner's **Binary under test** and **Upstream API** lines, plus its list of other builds
   found on the machine and _not_ used.
3. The Allure `env` / `upstream` labels on the stored result.
4. The version rendered in the app's sidebar and login screen (`deviceContext.appVersion`).

**Fix.** Set `APP_PATH` explicitly in every environment file and in CI — discovery is a convenience
for laptops, not a policy for a pipeline. Keep each environment's install in its own directory
(`%LOCALAPPDATA%\volt-pos-dev`, `-staging`, `-prod`) and keep `desc.txt` beside each one. See
[`environments.md`](environments.md).

---

## Appendix — hard-blocking the updater endpoint (optional, and not recommended)

`AUTO_DISMISS_UPDATER=true` handles the toast for every normal run. This appendix is for a
dedicated, permanently offline-ish test machine where you want the update check to fail at the
network layer instead.

**Read this caveat before editing anything.** In every environment the updater endpoint lives on
**the same host as the sync API**:

| Environment | Updater host                     | Also serves                                                     |
| ----------- | -------------------------------- | --------------------------------------------------------------- |
| dev         | `volt-pos.v2.dev-fastboypay.com` | `/syncing/pushing`, `/syncing/pulling`, `/merchant_settings`, … |
| staging     | `sys.stage.volt-pos.fastboy.dev` | the same, plus auth                                             |
| prod        | `volt-pos.v2.fastboypay.com`     | the same                                                        |

So a hosts entry pointing that name at `127.0.0.1` blocks **the entire backend**, not just the
updater. The app will not log in, will not sync, and the splash screen will hang.

### The blunt version — only for a fully offline machine

Edit `C:\Windows\System32\drivers\etc\hosts` as Administrator:

```
# Volt POS E2E — blocks the auto-updater AND the whole backend for this environment.
# Remove these lines before running anything that needs to sync or log in.
127.0.0.1 volt-pos.v2.dev-fastboypay.com
```

Flush the resolver and verify:

```powershell
ipconfig /flushdns
Resolve-DnsName volt-pos.v2.dev-fastboypay.com   # must answer 127.0.0.1
```

Undo by deleting the lines and flushing again. A forgotten hosts entry is itself a listed failure
mode above — "the splash screen never finishes" is usually this.

### The version that actually works

Point the host at a **local reverse proxy** that returns 404 for `/auto_update/*` and forwards
everything else upstream. The app's updater speaks HTTPS from Rust (`reqwest`), so the proxy needs
a certificate for that hostname that the Windows machine store trusts — `mkcert` with its CA
installed is the usual way. This is real setup work, justified only for a permanent test rig where
the update prompt must never appear at all.

For every other situation, `AUTO_DISMISS_UPDATER=true` is the answer.
