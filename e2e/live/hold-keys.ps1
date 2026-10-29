# Holds Ctrl+Alt+V for the given time as real key presses, so they pass through a running screen
# reader's keyboard hook on their way to the window in front, the same as a person's keyboard.
param([Parameter(Mandatory = $true)][int]$Milliseconds)

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class HoldKeys {
  [DllImport("user32.dll")] public static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extra);
  [DllImport("user32.dll")] public static extern uint MapVirtualKey(uint code, uint mapType);
  // A real keyboard sends a scan code too; the browser's KeyboardEvent.code comes from it.
  public static void Send(byte key, uint flags) { keybd_event(key, (byte)MapVirtualKey(key, 0), flags, UIntPtr.Zero); }
}
"@
$keys = 0x11, 0x12, 0x56 # Ctrl, Alt, V
foreach ($k in $keys) { [HoldKeys]::Send($k, 0) }
Start-Sleep -Milliseconds $Milliseconds
[array]::Reverse($keys)
foreach ($k in $keys) { [HoldKeys]::Send($k, 2) }
"held"
