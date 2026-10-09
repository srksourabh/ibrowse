using System.Windows.Forms;
using IBrowse.Windows;

ApplicationConfiguration.Initialize();

using var voice = new Voice();
using var explorer = new Explorer(voice);
using var hotkey = new HotkeyWindow(explorer.Toggle);
using var tray = new NotifyIcon
{
    Icon = System.Drawing.SystemIcons.Information,
    Text = "iBrowse. Win+Alt+E turns Explore Mode on or off.",
    Visible = true,
    ContextMenuStrip = new ContextMenuStrip(),
};
tray.ContextMenuStrip.Items.Add("Turn Explore Mode on or off", null, (_, _) => explorer.Toggle());
tray.ContextMenuStrip.Items.Add("Quit", null, (_, _) => Application.Exit());

voice.Say("iBrowse is running. Press Windows, Alt and E to turn Explore Mode on.");
Application.Run();
