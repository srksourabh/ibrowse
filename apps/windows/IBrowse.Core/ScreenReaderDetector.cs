using System.Diagnostics;

namespace IBrowse.Core;

/// <summary>Companion mode: when a screen reader is running, iBrowse stays quiet so nothing is said twice.</summary>
public sealed class ScreenReaderDetector : IDisposable
{
    private static readonly string[] Names = ["nvda", "jfw", "narrator", "zoomtext", "supernova"];
    public static readonly TimeSpan CacheDuration = TimeSpan.FromSeconds(2);

    private readonly Func<string[]> processEnumerator;
    private readonly Func<long> timestampProvider;
    private long lastCheckTimestamp;
    private bool cachedResult;
    private readonly object syncLock = new();

    public ScreenReaderDetector(Func<string[]>? processEnumerator = null, Func<long>? timestampProvider = null)
    {
        this.processEnumerator = processEnumerator ?? DefaultEnumerateProcesses;
        this.timestampProvider = timestampProvider ?? Stopwatch.GetTimestamp;
        lastCheckTimestamp = 0;
        cachedResult = false;
    }

    private static string[] DefaultEnumerateProcesses()
    {
        try
        {
            var processes = Process.GetProcesses();
            try
            {
                return processes.Select(p => p.ProcessName.ToLowerInvariant()).ToArray();
            }
            finally
            {
                foreach (var p in processes)
                {
                    p.Dispose();
                }
            }
        }
        catch
        {
            return Array.Empty<string>();
        }
    }

    public bool IsRunning()
    {
        long now = timestampProvider();
        long elapsedTicks = now - lastCheckTimestamp;
        double elapsedSeconds = (double)elapsedTicks / Stopwatch.Frequency;

        if (lastCheckTimestamp == 0 || elapsedSeconds >= CacheDuration.TotalSeconds)
        {
            lock (syncLock)
            {
                now = timestampProvider();
                elapsedTicks = now - lastCheckTimestamp;
                elapsedSeconds = (double)elapsedTicks / Stopwatch.Frequency;
                if (lastCheckTimestamp == 0 || elapsedSeconds >= CacheDuration.TotalSeconds)
                {
                    cachedResult = CheckRunning();
                    lastCheckTimestamp = now;
                }
            }
        }

        return cachedResult;
    }

    public void InvalidateCache()
    {
        lock (syncLock)
        {
            lastCheckTimestamp = 0;
        }
    }

    private bool CheckRunning()
    {
        try
        {
            var currentProcesses = processEnumerator();
            return currentProcesses.Any(name => Names.Contains(name));
        }
        catch
        {
            return false;
        }
    }

    public void Dispose()
    {
    }

    private static readonly ScreenReaderDetector DefaultInstance = new();
    public static bool IsRunningDefault() => DefaultInstance.IsRunning();
    public static void InvalidateDefault() => DefaultInstance.InvalidateCache();
}
