# Getting started

From a freshly imaged Windows machine to a green run. Budget about an hour, most of it waiting for
Rust and the app build.

Everything below assumes **Windows 10 or 11 with a real, interactive desktop session**. The suite
drives a GUI application: it needs a logged-in desktop, not a service account and not an SSH shell.
See [`../docker/README.md`](../docker/README.md) for why there is no container option.

---

## 1. Node 22

`.nvmrc` pins **22.18.0**, and `package.json` requires `>=22.5.0`.

With [nvm-windows](https://github.com/coreybutler/nvm-windows):

```powershell
nvm install 22.18.0
nvm use 22.18.0
node --version   # v22.18.0
```

Or install Node 22 LTS from nodejs.org. Either is fine; the version matters because the framework
uses modern Node APIs and ESM throughout.

---

## 2. Rust, for tauri-driver

`tauri-driver` is a Rust binary distributed through crates.io. There is no npm package and no
prebuilt download, so a Rust toolchain has to exist on the machine even though nothing in this repo
is written in Rust.

Install [rustup](https://rustup.rs) — the default `stable-x86_64-pc-windows-msvc` toolchain is the
right one. It will offer to install the **Visual Studio C++ Build Tools** if they are missing;
accept, because linking `tauri-driver` needs them.

```powershell
rustup default stable
rustc --version
cargo install tauri-driver --locked
```

That produces `%USERPROFILE%\.cargo\bin\tauri-driver.exe`. `npm run setup:drivers` runs this step
for you and copies the result into `.drivers/`, so you can skip straight to step 5 and come back
here only if it fails.

---

## 3. WebView2 Runtime and a matching msedgedriver

Volt POS renders inside the **WebView2 Runtime**, which ships with Windows 11 and with any recent
Edge install. Confirm it is present and note the version:

```powershell
$key = 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
(Get-ItemProperty $key).pv
# e.g. 151.0.4129.107
```

If the key is missing, install the Evergreen WebView2 Runtime from Microsoft.

`msedgedriver.exe` must match that version. **A mismatch does not produce an error** — the session
opens and then hangs until the timeout, which is the single most confusing failure this suite has.
`npm run setup:drivers` reads the registry value above and fetches the matching driver into
`.drivers/`; the framework prefers that copy over anything on `PATH` precisely so an unrelated
msedgedriver installed for browser work cannot be picked up silently.

Note that WebView2 auto-updates in the background. A machine that worked last month can break
overnight — re-run `npm run setup:drivers` when a run starts hanging for no reason.

---

## 4. Get a build of the app for your environment

You need an installed Volt POS executable **compiled for the environment you intend to test**. This
is not optional and not substitutable: the upstream address is baked in at compile time, so there
is no such thing as "the app pointed at staging". See [`environments.md`](environments.md).

### Option A — a CI build (what QA should use)

The app repo builds installers through its `Build Volt Pos` workflow
(`.github/workflows/release.yml`), triggered manually with an `environment` input of `develop`,
`staging` or `production`. The run produces an artifact named **`tauri-nsis`** containing:

| File            | What it is                                                            |
| --------------- | --------------------------------------------------------------------- |
| `binary.exe`    | The NSIS installer (renamed from `volt-pos_<version>_x64-setup.exe`). |
| `signature.sig` | The updater signature.                                                |
| `desc.txt`      | Version, **environment**, branch, build timestamp and author.         |

**Read `desc.txt` first, every time.** It is the only artifact-side proof of which backend the
installer was compiled against; the installer filename does not say.

Run the installer. It is an NSIS bundle with `installMode: currentUser`, so it installs without
administrator rights to:

```
%LOCALAPPDATA%\volt-pos\volt-pos-app.exe
```

### The trap: all three environments install to the same place

`productName` is `volt-pos` for every environment — the per-environment configs override the
updater endpoint and the version, not the product name. So the dev, staging and production
installers all target `%LOCALAPPDATA%\volt-pos\volt-pos-app.exe` and **each one replaces the last**.

To keep more than one on a machine, copy the installed directory aside before installing the next
build, and point `APP_PATH` at the copy:

```powershell
npm run app:kill
Copy-Item "$env:LOCALAPPDATA\volt-pos" "$env:LOCALAPPDATA\volt-pos-dev" -Recurse
# then install the staging build, which takes over %LOCALAPPDATA%\volt-pos
```

```dotenv
# configs/env/.env.dev
APP_PATH=C:/Users/<you>/AppData/Local/volt-pos-dev/volt-pos-app.exe
```

They also share one app-data directory (`%APPDATA%\VoltPOS`), because the Windows identifier is
`VoltPOS` for every build. Switching which build you drive therefore leaves you with a local
database that a _different_ backend wrote. Set `RESET_DB=true` in the non-production environment
files, or wipe the merchant folder by hand with `npm run db:reset`, whenever you swap builds.

### Option B — build it yourself from source

Useful when you need a build of a branch CI has not built, or a debug build with devtools.

```powershell
cd D:\2.POS\volt-pos\volt-pos
npm ci
$env:UPSTREAM_BASE_URI      = 'https://volt-pos.v2.dev-fastboypay.com'
$env:UPSTREAM_AUTH_BASE_URI = 'https://sys.v2.dev-fastboypay.com'
npx tauri build --config ./src-tauri/tauri.dev.conf.json
```

The environment variables must be set **before** the build; `src-tauri/build.rs` reads them and
emits them as `cargo:rustc-env`, and changing them afterwards does nothing to an existing binary.
The unpackaged executable lands in `<repo>/target/release/volt-pos-app.exe` (or `target/debug/` for
a debug build) — at the **workspace** root, not under `src-tauri/`: the app repo's top-level
`Cargo.toml` is a workspace with `src-tauri` and `src-entity` as members, so Cargo puts one shared
`target/` beside it. `resolveApp.ts` probes exactly those two paths and will discover the binary
automatically when `VOLT_POS_SRC` points at the repo.

---

## 5. Install this suite

```powershell
git clone <this-repo> e2e_volt_pos_webdriverIO
cd e2e_volt_pos_webdriverIO
npm run setup
```

`npm run setup` runs `npm install` and then `setup:drivers`, which installs `tauri-driver` through
cargo and downloads the `msedgedriver` matching your WebView2 Runtime into `.drivers/`.

---

## 6. Configure the environment file

```powershell
Copy-Item configs/env/.env.example configs/env/.env.dev
notepad configs/env/.env.dev
```

The fields that actually block a first run:

| Variable         | Why it matters                                                                                                                                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_PATH`       | The exact executable to drive. Leave it blank only if you have precisely one build installed.                                                                                                                                                           |
| `VOLT_POS_SRC`   | Path to the app repo. Enables the source-build fallback and `npm run audit:testids`.                                                                                                                                                                    |
| `MERCHANT_ID`    | Selects the folder under `%APPDATA%\VoltPOS\Databases\`. A wrong value makes every DB helper silently no-op.                                                                                                                                            |
| `STAFF_TOKEN`    | The only typed credential the app has: `/login` is a QR login, so the fallback is the staff-token form at `/login-staff-token`. Environment-specific - a dev token is rejected by staging. Usually unused, since a device stays signed in between runs. |
| `OWNER_PASSCODE` | Owner-level passcode: settings, reports, refunds.                                                                                                                                                                                                       |
| `STAFF_PASSCODE` | Staff passcode used by payment flows. That staff member must hold the `completed_payment` permission.                                                                                                                                                   |

`.env.dev`, `.env.staging`, `.env.prod` and `.env.local` are all git-ignored. `.env.example` is
tracked and must never hold a real credential.

### Account prerequisites

Payment specs need a merchant whose data supports them. Before the first run, confirm on that
environment:

- a staff member exists whose passcode is `STAFF_PASSCODE` **and** whose role carries
  `completed_payment` — the passcode dialog (`passcode-guard-dialog`) appears after
  "Complete Payment" and the flow types the digits into it;
- at least one service exists to add to an order;
- the merchant's language is the one your specs expect, if any of them still lean on text
  selectors.

---

## 7. Preflight

```powershell
npm run preflight
```

It resolves the executable, checks the driver binaries, confirms port 4444 is free, verifies the
app-data directory, and reports every other Volt POS build it can see on the machine. Fix whatever
it reports before running a spec — a failure here is a one-line message, whereas the same problem
inside a session is a two-minute hang followed by a misleading selector error.

---

## 8. First run

```powershell
npm run test:smoke
```

Watch the banner it prints first:

```
==============================================================================
 VOLT POS E2E — ENV=dev  MODE=launch
==============================================================================
 Binary under test : C:\Users\you\AppData\Local\volt-pos-dev\volt-pos-app.exe
 Upstream API      : https://volt-pos.v2.dev-fastboypay.com
 Merchant          : 14
 Writes allowed    : true
 Reset DB          : false
 Spec retries      : 1
------------------------------------------------------------------------------
 Other builds found on this machine (NOT used):
   - install: volt-pos: C:\Users\you\AppData\Local\volt-pos\volt-pos-app.exe
==============================================================================
```

Two lines deserve a second of attention every single run: **Binary under test** and **Upstream
API**. If the "other builds" list is not empty, be certain the one at the top is the one you meant.

The app then boots: splash screen (migrations, opening three SQLCipher databases, a sync
handshake), login if it is not already authenticated, then home. A cold first boot against a fresh
database can take most of the 90-second `APP_BOOT` budget — that is the app, not the suite.

---

## 9. Read the results

```powershell
npm run report:allure
npm run report:open
```

Failures also leave a screenshot in `reports/screenshots/` and a tail of the app's own log in
`reports/app-logs/`, both attached to the Allure result.

If anything hung, died, or passed suspiciously fast, go to
[`troubleshooting.md`](troubleshooting.md) — every entry there is a failure that has actually
happened on this app.

---

## 10. Before you write your first spec

Read [`writing-tests.md`](writing-tests.md) and run `npm run verify` before you commit. The husky
pre-commit hook runs `typecheck` plus `lint-staged`, so a type error stops the commit rather than
the pull request.
