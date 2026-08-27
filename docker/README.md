# Containers

**There is no Dockerfile in this directory, and there will not be one.**

This suite drives a Windows GUI application. It launches `volt-pos-app.exe`, waits for a WebView2
window to render, clicks controls inside it and screenshots the result when something fails. None
of that is possible in a Linux container, and a Dockerfile that pretends otherwise would waste
somebody's afternoon before failing for reasons that are already known today.

This page states the blockers, then documents the setups that actually work.

---

## Why a Linux container cannot run this

Five independent blockers, any one of which is fatal on its own.

**1. The application is a Windows PE binary.** It is distributed as an NSIS installer that puts
`volt-pos-app.exe` in `%LOCALAPPDATA%\volt-pos`. There is no Linux build of Volt POS to install in
an image.

**2. The renderer is WebView2, which is Windows-only.** The UI is not a web page served over HTTP;
it is rendered by the Edge WebView2 Runtime embedded in the app process. There is no Linux WebView2.
`tauri-driver` does support Linux — through `WebKitWebDriver` — but that path drives a
WebKitGTK build of a Tauri app, which is a different binary that does not exist for this product.

**3. `msedgedriver.exe` is a Windows executable**, and it must match the locally installed WebView2
Runtime version. Nothing in that sentence has a Linux equivalent.

**4. The app is bound to Windows APIs and hardware.** Single-instance detection
(`tauri-plugin-single-instance`), `%APPDATA%\VoltPOS` for the encrypted databases,
`%LOCALAPPDATA%\VoltPOS\logs`, the receipt printer, the cash drawer, and the MagTek card reader —
which ships as a bundled Windows DLL (`MTSCRA.dll`, declared as a bundle resource in
`src-tauri/tauri.windows.conf.json`). A container would have none of it.

**5. There is no headless mode to fall back on.** A browser has `--headless`. A Tauri desktop app
does not: it opens two OS windows, one of which is deliberately positioned on a second monitor. The
suite screenshots those windows on failure, and a screenshot needs something to have been drawn.

Wine is not an answer either — WebView2 is not a supported Wine workload, and even if the process
started, the automation surface `msedgedriver` needs would not be there.

### What about Windows containers?

Windows Server Core and Nano Server container images exist, and it is a reasonable question. The
answer is still no for this workload: Windows containers have no interactive desktop and no window
composition — processes run in a session with nothing to draw to. WebView2 is not a supported
container workload, and window handles, focus, clicks and screenshots are exactly the things that
stop behaving. Debugging a suite in that environment costs more than the isolation is worth.

---

## What the suite actually needs

| Requirement                                              | Why                                                                                                                                                                    |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows 10 or 11 (or Server with the Desktop Experience) | The binary, WebView2 and msedgedriver are Windows-only.                                                                                                                |
| A **logged-in, interactive** desktop session             | Windows services run in session 0, which has no desktop. GUI automation started from session 0 launches processes that cannot render, and screenshots come back empty. |
| The Edge WebView2 Runtime                                | The renderer. Preinstalled on Windows 11 and on GitHub's `windows-latest` image.                                                                                       |
| Rust toolchain                                           | `tauri-driver` is installed with `cargo install`.                                                                                                                      |
| Node 22                                                  | The suite itself.                                                                                                                                                      |
| An installed Volt POS build for the target environment   | dev/staging/prod are three different `.exe` files.                                                                                                                     |
| Network reach to that environment's backend              | The app syncs on boot; the splash screen does not finish without it.                                                                                                   |
| Screen lock, screensaver and sleep disabled              | A locked session stops rendering, and every click after that lands nowhere.                                                                                            |
| One run at a time on the machine                         | `tauri-driver` proxies a single session, the app enforces single-instance, and both windows share one local database.                                                  |

---

## Option 1 — GitHub-hosted `windows-latest`

What [`../.github/workflows/e2e.yml`](../.github/workflows/e2e.yml) targets by default. The image
has a desktop session, the WebView2 Runtime and Rust, so `tauri-driver` and the app both start.

**Suits:** smoke runs and pull-request checks, provided the environment's backend is reachable from
GitHub's network.

**Limits:**

- The runner is on the public internet. If the dev or staging API is only reachable from the office
  network or through a VPN, the splash screen will never finish and every spec will fail on boot.
- One virtual display. The customer window is created at x:2560 — a second monitor the runner does
  not have — so Windows may clamp it on top of the primary display. `@dual-window` specs still get
  a window handle to switch to, but their screenshots are not necessarily meaningful.
- The installer has to be fetched from somewhere on every run, which is the TODO block in the
  workflow.
- No printer, no cash drawer, no card reader. Hardware-dependent specs cannot run here at all.

## Option 2 — a self-hosted Windows runner (the recommended setup)

A dedicated Windows box — physical or virtual — registered as a GitHub Actions self-hosted runner.
This is what a team running the full regression suite nightly should build.

Setup that matters:

- **Install the runner interactively, not as a Windows service.** `run.cmd` under an auto-logon
  user. A runner installed as a service lands in session 0 and the GUI automation degrades in
  confusing ways rather than failing cleanly.
- **Enable auto-logon** (`netplwiz`, or the `AutoAdminLogon` registry values) so the machine returns
  to a live desktop session after a reboot.
- **Disable the lock screen, the screensaver and sleep.** A locked session stops compositing.
- **Give it the resolution the app expects**, and a second display — real or virtual — if
  `@dual-window` coverage matters, since the customer window is placed at x:2560.
- **Pre-install each environment's build in its own directory** (`%LOCALAPPDATA%\volt-pos-dev`,
  `-staging`, `-prod`) and set `APP_PATH` per GitHub Environment. The workflow's install step
  detects an existing build and skips the download.
- **Control Windows Update.** An unattended reboot in the middle of a run is a failure nobody can
  reproduce. WebView2 also updates itself silently — re-run `npm run setup:drivers` after it does,
  or the sessions start hanging (see [`../docs/troubleshooting.md`](../docs/troubleshooting.md)).
- **One job at a time.** Register a single runner for the label and keep the workflow's
  `concurrency` group; two concurrent jobs would drive each other's app.
- **Attach real hardware if you need hardware coverage** — the printer, the drawer and the card
  reader are the whole reason for using a physical machine.

## Option 3 — a Windows VM with an interactive console

Hyper-V, vSphere, Azure or AWS. Functionally identical to option 2, and appropriate when the runner
must sit inside a network that can reach the internal backends.

The one rule that decides whether it works: the automation must run in a **console session that is
logged in**, not over an RDP session that gets disconnected. Disconnecting an RDP session tears down
the desktop, and everything after that point fails to render. Use auto-logon plus a locally started
runner, and connect with a viewer that leaves the console session intact (Hyper-V's VMConnect, a
vSphere console, or `mstsc /admin` with the caveat that disconnecting still ends the session).

Snapshot the VM once it is configured. Rebuilding this by hand a second time is a bad afternoon.

---

## What a container is genuinely useful for here

Not for running the tests — but the parts of this repository that are just TypeScript will happily
run in a Linux container, and putting them there keeps the Windows runner free for the work that
actually needs it:

- `npm run verify` — typecheck, lint and format check.
- `npm run report:allure` — Allure only needs the JSON results and a JRE, so a report can be
  generated on Linux from an artifact produced on Windows.

Neither of those needs an image committed to this repository; a standard `node:22` step in CI is
enough. If you do add one later, keep it in this directory and name it for what it does
(`Dockerfile.verify`), so nobody mistakes it for a way to run the suite.
