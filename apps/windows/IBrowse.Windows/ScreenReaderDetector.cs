using System.Diagnostics;

namespace IBrowse.Windows;

/// <summary>Companion mode: when a screen reader is running, iBrowse stays quiet so nothing is said twice.</summary>
internal static class ScreenReaderDetector
{
    private static readonly string[] Names = ["nvda", "jfw", "narrator", "zoomtext", "supernova"];

    public static bool IsRunning() =>
        Process.GetProcesses().Any(p => Names.Contains(p.ProcessName.ToLowerInvariant()));
}
