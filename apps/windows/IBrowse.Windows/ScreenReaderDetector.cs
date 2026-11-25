namespace IBrowse.Windows;

/// <summary>Companion mode detector forwarder.</summary>
internal static class ScreenReaderDetector
{
    public static bool IsRunning() => IBrowse.Core.ScreenReaderDetector.IsRunningDefault();
    public static void Invalidate() => IBrowse.Core.ScreenReaderDetector.InvalidateDefault();
}
