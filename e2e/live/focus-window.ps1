# Brings the first top-level window whose title contains the given text to the front, so a screen
# reader follows it. Windows only lets the foreground process do that, so an Alt key press is sent
# first, which is the documented way to be allowed to.
param([Parameter(Mandatory = $true)][string]$Title)

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class FocusWindow {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc proc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int max);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int cmd);
  [DllImport("user32.dll")] public static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extra);
  public static bool Bring(string part) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((h, l) => {
      if (!IsWindowVisible(h)) return true;
      var text = new StringBuilder(512);
      GetWindowText(h, text, 512);
      if (text.ToString().Contains(part)) { found = h; return false; }
      return true;
    }, IntPtr.Zero);
    if (found == IntPtr.Zero) return false;
    keybd_event(0x12, 0, 0, UIntPtr.Zero);       // Alt down
    keybd_event(0x12, 0, 2, UIntPtr.Zero);       // Alt up
    ShowWindow(found, 9);                         // restore
    return SetForegroundWindow(found);
  }
}
"@
if ([FocusWindow]::Bring($Title)) { "focused" } else { "not found" }
