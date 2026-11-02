<#
.SYNOPSIS
  Freeze the user's other desktop apps for the length of a GUI run, then thaw them.

.DESCRIPTION
  Three Volt POS apps + their workers need ~4 GB on this 16 GB machine; browsers,
  Discord, WhatsApp and friends hold about as much. Closing them would lose tabs
  and drafts, so instead each process is SUSPENDED (NtSuspendProcess) and its
  working set handed back to Windows (EmptyWorkingSet): a frozen process never
  touches those pages again, so they go to the page file and the RAM is free for
  the run. Thaw resumes them where they were.

  Only names on the list are touched — never Windows, Defender, the firewall,
  WebView2 (Claude and Volt POS draw with it), Claude, node, or the test drivers.
  Edge / Chrome are frozen only for the user's own profile: the GUI window and
  the Portal / web lanes run Edge on their own --user-data-dir.

  Freeze records what it froze in -StateFile; Thaw resumes exactly those (same
  pid AND start time, so a recycled pid is left alone) and deletes the file.
  Running Freeze twice adds nothing that is already frozen.

.EXAMPLE
  powershell -File scripts/freeze-apps.ps1 -Action Freeze -StateFile .tmp/frozen-apps.json
  powershell -File scripts/freeze-apps.ps1 -Action Thaw   -StateFile .tmp/frozen-apps.json
#>
param(
  [Parameter(Mandatory)][ValidateSet('Freeze', 'Thaw')][string]$Action,
  [Parameter(Mandatory)][string]$StateFile,
  # Overrides the list below (a smoke test freezes just a notepad).
  [string[]]$Names
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

Add-Type -Namespace Freeze -Name Native -MemberDefinition @'
[DllImport("ntdll.dll")] public static extern int NtSuspendProcess(IntPtr h);
[DllImport("ntdll.dll")] public static extern int NtResumeProcess(IntPtr h);
[DllImport("psapi.dll")] public static extern bool EmptyWorkingSet(IntPtr h);
[DllImport("kernel32.dll")] public static extern IntPtr OpenProcess(uint access, bool inherit, int pid);
[DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);
'@

# PROCESS_SUSPEND_RESUME | PROCESS_QUERY_INFORMATION | PROCESS_SET_QUOTA
$ACCESS = 0x0800 -bor 0x0400 -bor 0x0100

# Process names (without .exe), matched whole and case-insensitively.
$DefaultNames = @(
  'msedge', 'chrome', 'firefox', 'brave', 'opera',
  'Discord', 'DiscordPTB', 'DiscordCanary', 'WhatsApp', 'WhatsApp.Root', 'Telegram', 'Zalo', 'Slack',
  'ms-teams', 'Teams', 'Skype', 'Spotify',
  'wps', 'wpscloudsvr', 'WINWORD', 'EXCEL', 'POWERPNT', 'OUTLOOK', 'ONENOTE',
  'SnippingTool', 'OneDrive', 'TeamViewer', 'WidgetBoard', 'XboxPcTray', 'PhoneExperienceHost'
)
# PowerShell names are case-insensitive: $NAMES would BE the -Names parameter.
$freezeNames = if ($Names) { $Names } else { $DefaultNames }
# A browser process belongs to the user's own profile only when its command line says so.
$BROWSER_PROFILE = @{
  'msedge' = '\Microsoft\Edge\User Data'
  'chrome' = '\Google\Chrome\User Data'
}

function Get-Frozen {
  if (-not (Test-Path $StateFile)) { return @() }
  try { return @(Get-Content $StateFile -Raw | ConvertFrom-Json) } catch { return @() }
}

function Invoke-OnProcess([int]$ProcessId, [scriptblock]$Body) {
  $h = [Freeze.Native]::OpenProcess($ACCESS, $false, $ProcessId)
  if ($h -eq [IntPtr]::Zero) { return $false }
  try { & $Body $h; return $true } finally { [void][Freeze.Native]::CloseHandle($h) }
}

if ($Action -eq 'Freeze') {
  $frozen = [System.Collections.ArrayList]@(Get-Frozen)
  $known = @{}
  foreach ($f in $frozen) { $known["$($f.pid)"] = $true }
  $me = (Get-CimInstance Win32_Process -Filter "ProcessId=$PID").SessionId
  $mb = 0
  $procs = Get-CimInstance Win32_Process | Where-Object {
    $_.SessionId -eq $me -and $freezeNames -contains ($_.Name -replace '\.exe$', '')
  }
  foreach ($p in $procs) {
    $name = $p.Name -replace '\.exe$', ''
    if ($known["$($p.ProcessId)"]) { continue }
    $ownProfile = $BROWSER_PROFILE[$name]
    if ($ownProfile) {
      $cmd = [string]$p.CommandLine
      # The user's own browser either names its default profile or names none at all.
      if ($cmd -match '--user-data-dir' -and $cmd.IndexOf($ownProfile, [StringComparison]::OrdinalIgnoreCase) -lt 0) { continue }
    }
    $ws = $p.WorkingSetSize
    $ok = Invoke-OnProcess $p.ProcessId {
      param($h)
      [void][Freeze.Native]::NtSuspendProcess($h)
      [void][Freeze.Native]::EmptyWorkingSet($h)
    }
    if ($ok) {
      [void]$frozen.Add([pscustomobject]@{ pid = $p.ProcessId; name = $name; created = "$($p.CreationDate)" })
      $mb += [math]::Round($ws / 1MB)
    }
  }
  $dir = Split-Path $StateFile -Parent
  if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
  ConvertTo-Json -InputObject @($frozen) -Depth 3 | Set-Content -Encoding utf8 $StateFile
  $apps = ($frozen | Select-Object -ExpandProperty name -Unique) -join ', '
  Write-Output "[freeze] đóng băng $($frozen.Count) tiến trình (~$mb MB vừa trả lại RAM): $apps"
}
else {
  $frozen = Get-Frozen
  $n = 0
  foreach ($f in $frozen) {
    $p = Get-CimInstance Win32_Process -Filter "ProcessId=$($f.pid)" -ErrorAction SilentlyContinue
    if (-not $p -or "$($p.CreationDate)" -ne $f.created) { continue }
    if (Invoke-OnProcess $f.pid { param($h) [void][Freeze.Native]::NtResumeProcess($h) }) { $n += 1 }
  }
  Remove-Item $StateFile -Force -ErrorAction SilentlyContinue
  Write-Output "[freeze] rã đông $n/$(@($frozen).Count) tiến trình"
}
