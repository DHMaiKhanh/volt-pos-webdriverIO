# Environments

Three environments, three executables, one machine. This document explains why they cannot be
collapsed into a runtime flag, what each one talks to, where each one keeps its data, and what is
allowed to run against which.

---

## The backend is compiled in, not configured

Most test frameworks treat "environment" as a variable: point the base URL somewhere else and the
same build behaves differently. That model does not apply here, and assuming it does is how a test
run ends up billing a live merchant.

The chain, end to end:

**1. The build script reads an environment variable at compile time.**
`src-tauri/build.rs`:

```rust
let upstream_base_uri = std::env::var("UPSTREAM_BASE_URI")
    .unwrap_or_else(|_| "https://volt-pos.v2.dev-fastboypay.com".to_string());
println!("cargo:rustc-env=UPSTREAM_BASE_URI={}", upstream_base_uri);
```

`cargo:rustc-env` is a build-script directive to the **compiler**. It is not a runtime environment
variable; it is an instruction that says "when you compile this crate, define this name".

**2. The application source expands it into a string constant.**
`src-tauri/src/upstream_http_client/syncing.rs`:

```rust
const UPSTREAM_PUSHING_URI: &str = concat!(env!("UPSTREAM_BASE_URI"), "/syncing/pushing");
```

`env!()` is a macro. `rustc` replaces it with the literal text during compilation, and `concat!`
glues the pieces together at compile time as well. By the time the `.exe` exists, that line has
become a fixed byte sequence inside the binary. There is no lookup left to perform, no variable to
override, no config file to edit.

**3. Every upstream call in the app is built the same way.** The same pattern produces the
addresses for `/syncing/pulling`, `/syncing/lsn`, `/refresh_token`, `/logout`,
`/sso/generate_merchant_qr`, `/sso/exchange_merchant_token`, `/merchant_settings`, `/gift_card/*`,
`/go_check_in/*`, `/object_files/*` and `/audit_log`.

**4. The updater endpoint is fixed too, and signed per environment.** Each
`src-tauri/tauri.<env>.conf.json` carries both the updater endpoint and a **different minisign
public key**. A dev build cannot even verify an update served by the production endpoint — the
signature check fails on a key mismatch. The environments are cryptographically separate, not just
addressed differently.

### What that means for this suite

`ENV` selects **which `.exe` to launch**. Nothing more.

| Attempted trick                                 | Result                                                                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `UPSTREAM_BASE_URI=…` in `.env.dev`             | Recorded for the run banner and assertions. The app ignores it.                                                    |
| Passing a CLI flag to the app                   | No such flag exists.                                                                                               |
| Editing a file in the install directory         | The address is inside the compiled binary, not a config file.                                                      |
| `APP_ENV_*` passthrough in `TauriDriverService` | Reaches the app process, but nothing in the app reads it for the backend address. It is there for WebView2 tuning. |

`loadEnv()` still carries `UPSTREAM_BASE_URI`, `UPSTREAM_AUTH_BASE_URI` and `UPDATER_ENDPOINT` per
environment. They exist for **reporting and assertion**: the run banner prints them, Allure records
them as a label, and a spec may assert that the data it sees is consistent with the backend it was
told about. They never change the app's behaviour.

---

## Endpoints per environment

Transcribed from `src-tauri/build.rs` and `src-tauri/tauri.<env>.conf.json` in the app repo, and
mirrored in `configs/env/loadEnv.ts` so a mismatch is visible without opening the Rust source.

|                              | `dev`                                                                      | `staging`                                                                          | `prod`                                                                 |
| ---------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **`UPSTREAM_BASE_URI`**      | `https://volt-pos.v2.dev-fastboypay.com`                                   | `https://sys.stage.volt-pos.fastboy.dev`                                           | `https://volt-pos.v2.fastboypay.com`                                   |
| **`UPSTREAM_AUTH_BASE_URI`** | `https://sys.v2.dev-fastboypay.com`                                        | `https://sys.stage.volt-pos.fastboy.dev`                                           | `https://sys.v2.fastboypay.com`                                        |
| **Updater endpoint**         | `…dev-fastboypay.com/auto_update/check_version_update/{{current_version}}` | `…stage.volt-pos.fastboy.dev/auto_update/check_version_update/{{current_version}}` | `…fastboypay.com/auto_update/check_version_update/{{current_version}}` |
| **Updater public key**       | dev minisign key                                                           | staging minisign key                                                               | production minisign key                                                |
| **Payment gateway**          | Fastboy sandbox (`FASTBOY_PAYMENT_BASE_URI`)                               | staging gateway                                                                    | **live gateway — real card authorizations**                            |
| **CI build input**           | `develop`                                                                  | `staging`                                                                          | `production`                                                           |
| **Lane config**              | `configs/wdio/wdio.dev.conf.ts`                                            | `configs/wdio/wdio.staging.conf.ts`                                                | `configs/wdio/wdio.prod.conf.ts`                                       |

The auth host is worth noticing: on dev and prod it is a **different host** from the data host, and
on staging it is the same one. Credentials are per environment. Dev credentials do not authenticate
against staging, and a login failure after switching builds is usually this and not a broken
selector.

---

## Where each build keeps its data

Every Windows build uses the Tauri identifier `VoltPOS`, set in `src-tauri/tauri.windows.conf.json`
— which overrides the base identifier `com.fastboy.volt-pos`. So `app_data_dir()` resolves to
`%APPDATA%\VoltPOS` for **all three environments**.

```
%APPDATA%\VoltPOS\
├── Databases\
│   └── <merchantId>\            e.g. 14  — one folder per merchant that has signed in
│       ├── Main\<uuid>          app data: orders, staff, services, settings
│       ├── Pushing\<uuid>       rows queued for /syncing/pushing
│       └── Pulling\<uuid>       rows received from /syncing/pulling
├── credentials                  stored session/refresh token
└── settings.json                device-level settings

%LOCALAPPDATA%\VoltPOS\logs\     the app's own rolling log (tauri-plugin-log)
%LOCALAPPDATA%\volt-pos\         the install directory: volt-pos-app.exe
```

Each `<uuid>` database file is accompanied by `<uuid>-wal` and `<uuid>-shm` (SQLite write-ahead
log and shared-memory index). `src/db/reset.ts` removes all three together; deleting only the main
file leaves a WAL that SQLite will happily replay.

`configs/constants/paths.ts` exposes this as `appDataRoot(identifier?)` and
`merchantDbDir(merchantId, identifier?)`. Use those rather than rebuilding the path — getting the
identifier wrong (`com.fastboy.volt-pos` instead of `VoltPOS`) makes every DB helper point at a
folder that does not exist and silently do nothing.

### The databases are encrypted

All three SQLite files are **SQLCipher**-encrypted. A plain `node:sqlite` or `better-sqlite3` open
of the Main database fails; the key is derived inside the app. This framework does not decrypt them
and does not pretend to. `src/db/` works at the filesystem level only — copy, delete, tail a log.

Expected values in assertions come from the UI or from the test data, never from a decrypted row.

### One data directory, three environments — the collision

Because the identifier is shared, a dev build and a production build **use the same
`%APPDATA%\VoltPOS` tree**. If both have been signed into with a merchant whose id happens to be
the same number, they write into the same `Databases\<merchantId>` folder.

Practical consequences:

- After swapping which build you drive, the local database was written by a _different_ backend.
  Set `RESET_DB=true` in `.env.dev` / `.env.staging`, or run `npm run db:reset` by hand.
- `npm run db:reset` always snapshots into `.db-backups/` before deleting, and it is forced off for
  `prod` in `loadEnv()`, because those rows may not have finished syncing upstream yet.
- Never run `db:reset` on a machine that is also somebody's real till.

---

## What may run where

|                           | `dev`                                      | `staging`                                         | `prod`                                                     |
| ------------------------- | ------------------------------------------ | ------------------------------------------------- | ---------------------------------------------------------- |
| **Purpose**               | day-to-day development and the nightly run | the release gate, after QC signs off on the build | proof that the shipped build works on real infrastructure  |
| **Spec set**              | everything                                 | everything                                        | `tests/smoke/**` only — hard-pinned in `wdio.prod.conf.ts` |
| **Tags allowed**          | all                                        | all                                               | `@smoke` only                                              |
| **Creates data**          | yes                                        | yes                                               | **no** — `WRITE_ALLOWED` is forced `false`                 |
| **`@write` / `@payment`** | yes                                        | yes                                               | never                                                      |
| **DB reset**              | yes                                        | yes                                               | forced off                                                 |
| **Retries**               | 1                                          | 1                                                 | 0                                                          |
| **`bail`**                | 0 (run everything)                         | 1 (stop at the first failure)                     | 1                                                          |
| **Typical trigger**       | local, plus the nightly schedule           | manual, on the staging cherry-pick build          | manual, right after a production release                   |

### The rules behind the table

**Production is read-only, and the guard throws rather than skips.** A production build talks to
the live payment gateway and pushes every local row upstream through `/syncing/pushing`. A checkout
spec there creates a real order against a real merchant with a real card authorization. Any flow
that creates data calls `assertWritesAllowed('<action>')` first, which throws with the environment
and the upstream host named in the message. It does not silently skip, because a skipped checkout
spec reads as a pass and hides that the lane was never covered.

The one override is deliberately awkward:

```
ALLOW_PROD_WRITES=i-know-what-i-am-doing
```

Nothing less than that exact string enables writes on prod. It is spelled out because a plain
boolean is too easy to flip by accident in a CI matrix, and there is no path back from a real
charge.

**Staging bails on the first failure.** It runs against the build QC has signed off on. If that
build is broken, twenty more minutes proving the rest still works is time nobody gets back.

**Dev runs everything and retries once.** One retry absorbs the genuinely non-deterministic parts
of a desktop run — a sync round trip landing late, the WebView2 host taking an extra beat after a
window switch. It does not absorb a real bug: a spec that fails twice fails.

**Production never retries.** A flaky production result is information about production. Re-running
it deletes the information.

---

## Proving which build actually ran

The most expensive failure mode in this suite is not a red run. It is a **green run against the
wrong executable**, because nothing looks wrong. Four independent checks:

1. **The run banner.** Printed by `onPrepare` before the first spec: the resolved binary path, the
   upstream host, the merchant, and every other Volt POS build found on the machine but not used.
2. **`desc.txt`** from the CI artifact, which records the environment, version, branch and build
   time of the installer you actually ran. Keep it next to the binary.
3. **The Allure labels.** Every result carries `env`, `mode` and `upstream`, so a stored report can
   be re-read months later and still answer the question.
4. **The version in the app.** The sidebar and the login screen both render the app version from
   `deviceContext.appVersion`. Compare it to `desc.txt`.

If the banner's "other builds found" list is not empty, spend the extra second confirming the one
at the top is the one you meant. Set `APP_PATH` explicitly in CI; discovery is a convenience for
laptops, not a policy for a pipeline.
