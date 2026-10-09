using System.Runtime.InteropServices;

namespace IBrowse.Windows;

/// <summary>A hidden window that receives the global hotkey, Win+Alt+E.</summary>
internal sealed class HotkeyWindow : System.Windows.Forms.NativeWindow, IDisposable
{
    private const int WmHotkey = 0x0312, HotkeyId = 1;
    private const uint ModAlt = 0x1, ModWin = 0x8, KeyE = 0x45;
    private readonly Action onPressed;

    public HotkeyWindow(Action onPressed)
    {
        this.onPressed = onPressed;
        CreateHandle(new System.Windows.Forms.CreateParams());
        if (!RegisterHotKey(Handle, HotkeyId, ModAlt | ModWin, KeyE))
            throw new InvalidOperationException("Win+Alt+E is already used by another program.");
    }

    protected override void WndProc(ref System.Windows.Forms.Message m)
    {
        if (m.Msg == WmHotkey && m.WParam == HotkeyId) onPressed();
        base.WndProc(ref m);
    }

    public void Dispose()
    {
        UnregisterHotKey(Handle, HotkeyId);
        DestroyHandle();
    }

    [DllImport("user32.dll")] private static extern bool RegisterHotKey(IntPtr hWnd, int id, uint modifiers, uint vk);
    [DllImport("user32.dll")] private static extern bool UnregisterHotKey(IntPtr hWnd, int id);
}
