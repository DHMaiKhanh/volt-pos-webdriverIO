<#
  package-qa.ps1 — assemble the distributable QA bundle.

  Produces:  dist-qa\VoltPOS-Tests\         (the runnable folder)
             dist-qa\VoltPOS-Tests.zip       (hand this to QA)

  Usage (from the project root):

    # Minimal: assumes QA machines have Node 22.5+ installed.
    powershell -ExecutionPolicy Bypass -File qa-pack\package-qa.ps1

    # Self-contained: bundle a portable Node so QA needs nothing installed.
    #   Download node-v22.18.0-win-x64.zip from https://nodejs.org/dist/v22.18.0/
    powershell -ExecutionPolicy Bypass -File qa-pack\package-qa.ps1 `
        -NodeZip C:\downloads\node-v22.18.0-win-x64.zip

    # Also vendor node_modules so the first run needs no npm registry access.
    powershell -ExecutionPolicy Bypass -File qa-pack\package-qa.ps1 -VendorDeps

  Notes
    * configs\env\.env.dev IS copied (git-ignored on disk) so the pack runs with
      the real STAFF_TOKEN and CARD_SETTLE=1 — this bundle charges real cards.
      Only hand it to trusted QA.
    * .drivers\tauri-driver.exe is shipped. msedgedriver is re-matched on the QA
      machine at first run (it must match that machine's WebView2 Runtime).
#>

param(
  [string]$NodeZip,
  [switch]$VendorDeps,
  [switch]$NoZip
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Root = Split-Path -Parent $PSScriptRoot        # project root (qa-pack\.. )
$Dist = Join-Path $Root 'dist-qa'
$Out  = Join-Path $Dist 'VoltPOS-Tests'

function Say($t)  { Write-Host "  $t" -ForegroundColor Cyan }
function Ok($t)   { Write-Host "  [+] $t" -ForegroundColor Green }
function Warn($t) { Write-Host "  [!] $t" -ForegroundColor Yellow }

Say '== Building Volt POS QA bundle =='

# ── Clean output ──────────────────────────────────────────────────────────────
if (Test-Path -LiteralPath $Out) { Remove-Item -LiteralPath $Out -Recurse -Force }
New-Item -ItemType Directory -Path $Out -Force | Out-Null

# ── Copy the project with robocopy, excluding scratch/output/vcs ──────────────
# robocopy exit codes 0-7 are success; 8+ are failures.
$excludeDirs = @(
  '.git', 'dist-qa', 'reports', 'logs', '.tmp', '.db-backups',
  'node_modules',                      # re-added below only if -VendorDeps
  (Join-Path 'dashboard' 'node_modules')
)
$roboArgs = @($Root, $Out, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP')
foreach ($d in $excludeDirs) { $roboArgs += @('/XD', (Join-Path $Root $d)) }

Say 'Copying project files...'
& robocopy @roboArgs | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed (code $LASTEXITCODE)" }
Ok 'Project files copied.'

# run.ps1 goes to the bundle root so it sits next to package.json.
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'run.ps1') -Destination (Join-Path $Out 'run.ps1') -Force
if (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'README-QA.txt')) {
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'README-QA.txt') -Destination (Join-Path $Out 'README-QA.txt') -Force
}

# ── Confirm the secret env + drivers made it across ───────────────────────────
$envDev = Join-Path $Out 'configs\env\.env.dev'
if (Test-Path -LiteralPath $envDev) { Ok '.env.dev bundled (real token, CARD_SETTLE as configured).' }
else { Warn '.env.dev NOT found — QA run will use defaults (no token, merchant 14). Check configs\env\.env.dev exists.' }

$tauri = Join-Path $Out '.drivers\tauri-driver.exe'
if (Test-Path -LiteralPath $tauri) { Ok 'tauri-driver.exe bundled.' }
else { Warn 'tauri-driver.exe missing from .drivers — QA machine will need cargo to build it.' }

# ── Optional: bundle a portable Node ──────────────────────────────────────────
if ($NodeZip) {
  if (-not (Test-Path -LiteralPath $NodeZip)) { throw "NodeZip not found: $NodeZip" }
  Say 'Unpacking portable Node...'
  $tmp = Join-Path $Dist '_nodetmp'
  if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Recurse -Force }
  Expand-Archive -LiteralPath $NodeZip -DestinationPath $tmp -Force
  # The zip extracts to node-vX.Y.Z-win-x64\ ; flatten it to .\node
  $inner = Get-ChildItem -LiteralPath $tmp -Directory | Select-Object -First 1
  $nodeDest = Join-Path $Out 'node'
  Move-Item -LiteralPath $inner.FullName -Destination $nodeDest -Force
  Remove-Item -LiteralPath $tmp -Recurse -Force
  if (Test-Path -LiteralPath (Join-Path $nodeDest 'node.exe')) { Ok 'Portable Node bundled at .\node\node.exe' }
  else { throw 'Portable Node layout unexpected — node.exe not found after extract.' }
} else {
  Warn 'No -NodeZip given: QA machines must have Node 22.5+ installed.'
}

# ── Optional: vendor node_modules (prod + dev) so first run needs no registry ──
if ($VendorDeps) {
  Say 'Vendoring node_modules (npm ci in the bundle)...'
  Push-Location $Out
  try {
    $npm = if ($NodeZip) { Join-Path $Out 'node\npm.cmd' } else { 'npm' }
    & $npm ci
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed (code $LASTEXITCODE)" }
    Ok 'node_modules vendored.'
  } finally { Pop-Location }
} else {
  Warn 'node_modules not vendored: first run on the QA machine does npm ci (needs internet).'
}

# ── Zip ───────────────────────────────────────────────────────────────────────
if (-not $NoZip) {
  $zip = Join-Path $Dist 'VoltPOS-Tests.zip'
  if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }
  Say 'Compressing...'
  Compress-Archive -Path $Out -DestinationPath $zip -Force
  Ok "Bundle ready: $zip"
}

Write-Host ''
Ok  "Folder: $Out"
Say 'To wrap the launcher as an .exe (optional):'
Write-Host '    Install-Module ps2exe -Scope CurrentUser' -ForegroundColor Gray
Write-Host "    ps2exe `"$Out\run.ps1`" `"$Out\Run-Volt-Tests.exe`" -noConsole:`$false -title 'Volt POS Tests'" -ForegroundColor Gray
Write-Host ''
Say 'Then zip the folder again (or re-run without -NoZip) so the .exe is included.'
