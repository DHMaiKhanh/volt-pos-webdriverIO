<#
  Park a parallel test instance's windows off-screen (docs/parallel-instances.md).

  The app places the customer display itself — fullscreen on the "customer"
  monitor, which on a one-monitor machine is the only one — so a seeded
  .window-state.json is not enough: right after a launch both windows of a copy
  cover the screen. This moves every visible "Volt POS…" window of the given
  process image to $X,$Y, sends it to the bottom of the z-order and never
  activates it — and sizes it so its CLIENT area is exactly $ClientWidth ×
  $ClientHeight, the installed app's fullscreen viewport (tauri-plugin-window-state
  drops a saved size whose position is off every monitor, and a frameless window
  still keeps a thin resize border, so neither the seed nor the window size alone
  gives the same layout). The copy runs with --disable-features=CalculateNativeWinOcclusion,
  so it keeps rendering out there.

  -Watch keeps doing that every second (the launch lane relaunches the app per
  group, and the app may move its customer window again) until -StopFile exists
  or the parent lane process is gone.

    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/park-windows.ps1 -Image volt-pos-i1 [-Only customer]
    powershell … -File scripts/park-windows.ps1 -Image volt-pos-i1 -Watch -StopFile .tmp\park-i1.stop -ParentPid 1234
#>
param(
  [Parameter(Mandatory = $true)][string]$Image,
  [int]$X = 4000,
  [int]$Y = 0,
  [int]$ClientWidth = 1920,
  [int]$ClientHeight = 1080,
  [ValidateSet('all', 'customer')][string]$Only = 'all',
  [switch]$Watch,
  [string]$StopFile = '',
  [int]$ParentPid = 0
)

Add-Type @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public static class VoltPark {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  public delegate bool EnumProc(IntPtr hwnd, IntPtr lParam);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int max);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hwnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  public static List<KeyValuePair<IntPtr, string>> Windows(uint[] pids) {
    var found = new List<KeyValuePair<IntPtr, string>>();
    EnumWindows((hwnd, l) => {
      uint pid;
      GetWindowThreadProcessId(hwnd, out pid);
      if (Array.IndexOf(pids, pid) >= 0 && IsWindowVisible(hwnd)) {
        var title = new StringBuilder(256);
        GetWindowText(hwnd, title, 256);
        found.Add(new KeyValuePair<IntPtr, string>(hwnd, title.ToString()));
      }
      return true;
    }, IntPtr.Zero);
    return found;
  }
}
'@
# Physical pixels in and out (GetWindowRect/SetWindowPos), whatever the display scaling.
[void][VoltPark]::SetProcessDPIAware()

$name = [System.IO.Path]::GetFileNameWithoutExtension($Image)
$HWND_BOTTOM = [IntPtr]1
$SWP_NOACTIVATE = 0x0010

function Invoke-Park([bool]$Quiet) {
  $pids = [uint32[]]@(Get-Process -Name $name -ErrorAction SilentlyContinue | ForEach-Object { [uint32]$_.Id })
  if ($pids.Count -eq 0) { return }
  foreach ($w in [VoltPark]::Windows($pids)) {
    if ($w.Value -notmatch 'Volt POS') { continue }
    if ($Only -eq 'customer' -and $w.Value -notmatch 'Customer') { continue }
    $rect = New-Object VoltPark+RECT
    $client = New-Object VoltPark+RECT
    [void][VoltPark]::GetWindowRect($w.Key, [ref]$rect)
    [void][VoltPark]::GetClientRect($w.Key, [ref]$client)
    $clientW = $client.Right - $client.Left
    $clientH = $client.Bottom - $client.Top
    if ($rect.Left -ge $X - 2 -and [math]::Abs($clientW - $ClientWidth) -le 1 -and [math]::Abs($clientH - $ClientHeight) -le 1) { continue }
    # Window = wanted client + whatever frame the window has right now.
    $width = $ClientWidth + ($rect.Right - $rect.Left - $clientW)
    $height = $ClientHeight + ($rect.Bottom - $rect.Top - $clientH)
    [void][VoltPark]::SetWindowPos($w.Key, $HWND_BOTTOM, $X, $Y, $width, $height, $SWP_NOACTIVATE)
    if (-not $Quiet) { "parked: $($w.Value)" }
  }
}

if (-not $Watch) { Invoke-Park $false; exit 0 }
while ($true) {
  if ($StopFile -and (Test-Path $StopFile)) { break }
  if ($ParentPid -gt 0 -and -not (Get-Process -Id $ParentPid -ErrorAction SilentlyContinue)) { break }
  Invoke-Park $true
  Start-Sleep -Milliseconds 1000
}
