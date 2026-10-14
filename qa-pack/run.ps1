<#
  Volt POS E2E — QA launcher
  ==========================

  Double-click target (wrapped by Run-Volt-Tests.exe via ps2exe, or run directly:
  right-click -> Run with PowerShell).

  What it does, in order:
    1. Resolves a Node runtime (bundled .\node\node.exe preferred, else system Node).
    2. First run only: installs dependencies and version-matches the WebView2 driver
       to THIS machine (msedgedriver MUST match the local WebView2 Runtime or the
       session hangs silently — see scripts/setup-drivers.ts).
    3. Shows a menu to pick a suite / spec and runs it against the dev build.

  This bundle ships configs/env/.env.dev as-is, so it runs with CARD_SETTLE=1:
  every card/gift-card lane CHARGES A REAL CARD. That is intentional for this pack.
#>

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# ── Locate the bundle root ────────────────────────────────────────────────────
# run.ps1 lives at the repo/bundle root next to package.json.
$Root = $PSScriptRoot
if (-not $Root) { $Root = Split-Path -Parent $MyInvocation.MyCommand.Path }
Set-Location -LiteralPath $Root

function Write-Head($text) {
  Write-Host ''
  Write-Host ('=' * 70) -ForegroundColor Cyan
  Write-Host "  $text" -ForegroundColor Cyan
  Write-Host ('=' * 70) -ForegroundColor Cyan
}
function Write-Info($text) { Write-Host "  [i] $text" -ForegroundColor Gray }
function Write-Ok($text)   { Write-Host "  [+] $text" -ForegroundColor Green }
function Write-Warn($text) { Write-Host "  [!] $text" -ForegroundColor Yellow }
function Write-Err($text)  { Write-Host "  [x] $text" -ForegroundColor Red }

# ── Resolve Node + npm, put them first on PATH ────────────────────────────────
$BundledNodeDir = Join-Path $Root 'node'
$BundledNode    = Join-Path $BundledNodeDir 'node.exe'

if (Test-Path -LiteralPath $BundledNode) {
  $env:Path = "$BundledNodeDir;$env:Path"
  Write-Ok "Using bundled Node: $BundledNode"
} else {
  $sysNode = (Get-Command node.exe -ErrorAction SilentlyContinue)
  if (-not $sysNode) {
    Write-Err 'No Node runtime found.'
    Write-Host ''
    Write-Host '  This bundle has no .\node\node.exe and Node is not installed on this PC.'
    Write-Host '  Either repackage with portable Node bundled (package-qa.ps1 -NodeZip ...),'
    Write-Host '  or install Node 22.5+ from https://nodejs.org and re-run.'
    Read-Host '  Press Enter to exit'
    exit 1
  }
  Write-Info "Using system Node: $($sysNode.Source)"
}

# Sanity: Node >= 22.5 (node:sqlite is used by the DB helpers / preflight).
$nodeVer = (& node.exe --version).TrimStart('v')
$maj = [int]($nodeVer.Split('.')[0]); $min = [int]($nodeVer.Split('.')[1])
if ($maj -lt 22 -or ($maj -eq 22 -and $min -lt 5)) {
  Write-Err "Node $nodeVer is too old (need >= 22.5). Update Node or use the bundled runtime."
  Read-Host '  Press Enter to exit'
  exit 1
}

$NpmCmd = Join-Path $BundledNodeDir 'npm.cmd'
if (-not (Test-Path -LiteralPath $NpmCmd)) { $NpmCmd = 'npm' }  # system npm on PATH

# ── Run a command, stream output, return its exit code ────────────────────────
function Invoke-Npm {
  param([string[]]$Args)
  & $NpmCmd @Args
  return $LASTEXITCODE
}

# ── First-run bootstrap (idempotent) ──────────────────────────────────────────
$BootMarker = Join-Path $Root '.qa-bootstrapped'

function Invoke-Bootstrap {
  param([switch]$Force)

  Write-Head 'FIRST-RUN SETUP'

  # 1. Dependencies.
  $hasModules = Test-Path -LiteralPath (Join-Path $Root 'node_modules\.bin')
  if ($Force -or -not $hasModules) {
    Write-Info 'Installing dependencies (npm ci)... first time can take a few minutes.'
    $hasLock = Test-Path -LiteralPath (Join-Path $Root 'package-lock.json')
    $code = if ($hasLock) { Invoke-Npm @('ci') } else { Invoke-Npm @('install') }
    if ($code -ne 0) {
      Write-Err 'Dependency install failed. Check the output above (proxy / registry access?).'
      Read-Host '  Press Enter to exit'; exit 1
    }
    Write-Ok 'Dependencies installed.'
  } else {
    Write-Ok 'Dependencies already present.'
  }

  # 2. Drivers — version-match msedgedriver to THIS machine's WebView2 Runtime.
  #    tauri-driver.exe is shipped in .drivers and left as-is.
  Write-Info 'Matching the WebView2 driver to this machine (npm run setup:drivers)...'
  $code = Invoke-Npm @('run', 'setup:drivers')
  if ($code -ne 0) {
    Write-Warn 'Driver setup reported a problem. The menu still opens, but a mismatched'
    Write-Warn 'msedgedriver makes the session HANG silently. Use menu option [D] to retry.'
  } else {
    Write-Ok 'Driver matched to local WebView2 Runtime.'
  }

  New-Item -ItemType File -Path $BootMarker -Force | Out-Null
}

if (-not (Test-Path -LiteralPath $BootMarker)) {
  Invoke-Bootstrap
}

# ── Lane runners ──────────────────────────────────────────────────────────────
# ENV is forced to dev; the dev config drives the dev build and loads .env.dev.
$env:ENV = 'dev'

function Run-NpmScript {
  param([string]$Script, [string[]]$Extra = @())
  Write-Head "RUNNING: npm run $Script $($Extra -join ' ')"
  $argv = @('run', $Script) + $Extra
  Invoke-Npm $argv | Out-Null
  Show-RunTail
}

function Run-Suite {
  param([string]$Suite)
  Write-Head "RUNNING suite: $Suite"
  # Replicate the test:* lane: preflight gate, then wdio with --suite.
  $pf = Invoke-Npm @('run', 'preflight')
  if ($pf -ne 0) {
    Write-Err 'Preflight failed — lane not started (see the table above).'
    return
  }
  & npx.cmd wdio run configs/wdio/wdio.dev.conf.ts --suite $Suite
  Show-RunTail
}

function Show-RunTail {
  Write-Host ''
  if ($LASTEXITCODE -eq 0) { Write-Ok 'Lane finished: all specs passed.' }
  else { Write-Warn "Lane finished with failures (exit $LASTEXITCODE). See the spec output above." }
  Write-Host ''
  Write-Host '  Reports:' -ForegroundColor Gray
  Write-Host '    Allure HTML : npm run report:allure ; npm run report:open' -ForegroundColor Gray
  Write-Host '    Dashboard   : npm run dashboard  (opens the React run viewer)' -ForegroundColor Gray
  Read-Host '  Press Enter to return to the menu'
}

# ── Spec picker ───────────────────────────────────────────────────────────────
function Pick-Spec {
  $specs = Get-ChildItem -Path (Join-Path $Root 'tests') -Recurse -Filter '*.spec.ts' |
           Sort-Object FullName
  if (-not $specs) { Write-Warn 'No spec files found under tests\.'; return }

  Write-Head 'PICK A SPEC'
  for ($i = 0; $i -lt $specs.Count; $i++) {
    $rel = $specs[$i].FullName.Substring($Root.Length).TrimStart('\')
    Write-Host ('   {0,3}  {1}' -f ($i + 1), $rel)
  }
  $sel = Read-Host '  Spec number (blank to cancel)'
  if (-not $sel) { return }
  $idx = 0
  if (-not [int]::TryParse($sel, [ref]$idx)) { Write-Warn 'Not a number.'; return }
  if ($idx -lt 1 -or $idx -gt $specs.Count) { Write-Warn 'Out of range.'; return }
  $target = $specs[$idx - 1].FullName
  Run-NpmScript 'test:spec' @($target)
}

# ── Menu ──────────────────────────────────────────────────────────────────────
function Show-Menu {
  Write-Head 'VOLT POS — QA TEST RUNNER  (ENV=dev, charges REAL cards)'
  Write-Host '   1   Smoke          (read-only, fast)'
  Write-Host '   2   Regression     (full functional suite)'
  Write-Host '   3   Home           (regression/home)'
  Write-Host '   4   Checkout       (regression/checkout)'
  Write-Host '   5   Order History  (regression/order-history)'
  Write-Host '   6   Settings       (regression/settings)'
  Write-Host '   7   EVERYTHING     (full dev lane, all specs)'
  Write-Host '   8   Pick one spec  (choose a single .spec.ts)'
  Write-Host ''
  Write-Host '   D   Re-match drivers / reinstall deps' -ForegroundColor DarkGray
  Write-Host '   Q   Quit' -ForegroundColor DarkGray
  Write-Host ''
}

:menu while ($true) {
  Show-Menu
  $choice = (Read-Host '  Choose').Trim().ToUpper()
  switch ($choice) {
    '1' { Run-Suite 'smoke' }
    '2' { Run-NpmScript 'test:regression' }
    '3' { Run-Suite 'home' }
    '4' { Run-Suite 'checkout' }
    '5' { Run-Suite 'orderHistory' }
    '6' { Run-Suite 'settings' }
    '7' { Run-NpmScript 'test:dev' }
    '8' { Pick-Spec }
    'D' { Invoke-Bootstrap -Force }
    'Q' { break menu }
    default { Write-Warn "Unknown choice: '$choice'" }
  }
}

Write-Host ''
Write-Ok 'Bye.'
