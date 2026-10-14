==============================================================================
  VOLT POS — E2E TEST RUNNER (QA)
==============================================================================

  !! WARNING — THIS PACK CHARGES REAL CARDS !!
  Card and gift-card test lanes run against the dev backend with real settlement
  turned on (CARD_SETTLE=1). Only run on a terminal you are authorised to use.

------------------------------------------------------------------------------
  WHAT YOU NEED ON THIS PC (one time)
------------------------------------------------------------------------------
  1. Windows 10/11 (64-bit). This suite is Windows-only.
  2. The Volt POS **dev** app installed (the .exe build under test).
     The runner finds it automatically if installed to the usual location
     (%LOCALAPPDATA%\volt-pos). If not, tell the dev to set APP_PATH.
  3. The Microsoft **WebView2 Runtime** (the app needs it to render):
     https://developer.microsoft.com/microsoft-edge/webview2/
  4. Internet access — the app syncs to the dev backend, and the first run
     downloads the matching browser driver from Microsoft.
  5. Node is bundled (\node\node.exe). If this pack has no \node folder,
     install Node 22.5+ from https://nodejs.org first.

------------------------------------------------------------------------------
  HOW TO RUN
------------------------------------------------------------------------------
  Option A (simplest):
      Double-click  Run-Volt-Tests.exe

  Option B (no .exe in this pack):
      Right-click  run.ps1  ->  "Run with PowerShell"
      (If Windows blocks it, open PowerShell in this folder and run:
          powershell -ExecutionPolicy Bypass -File .\run.ps1 )

  The FIRST run installs dependencies and matches the browser driver to this
  PC. That takes a few minutes. Later runs skip straight to the menu.

------------------------------------------------------------------------------
  THE MENU
------------------------------------------------------------------------------
  1  Smoke          read-only sanity checks (fast)
  2  Regression     full functional suite (creates orders, charges cards)
  3  Home           home-screen specs only
  4  Checkout       checkout specs only
  5  Order History  order-history specs only
  6  Settings       settings specs only
  7  EVERYTHING     every spec in the dev lane
  8  Pick one spec  run a single test file
  D  Re-match drivers / reinstall dependencies  (use if a run hangs)
  Q  Quit

------------------------------------------------------------------------------
  IF A RUN HANGS OR "DOES NOTHING"
------------------------------------------------------------------------------
  Almost always the browser driver no longer matches this PC's WebView2
  (Windows updated it). Fix: menu option [D], or close and reopen the runner.
  A mismatched driver does NOT show an error — it just hangs, then times out.

------------------------------------------------------------------------------
  RESULTS
------------------------------------------------------------------------------
  Pass/fail prints live in the window. For a nicer report after a run, the dev
  can open the Allure report (npm run report:allure) or the dashboard
  (npm run dashboard).

  Questions: contact the automation owner (khanh_do@fastboy.net).
==============================================================================
