using IBrowse.Core;
using System.Diagnostics;

namespace IBrowse.Tests;

public class ScreenReaderDetectorTests
{
    [Fact]
    public void Returns_true_when_screen_reader_process_is_running()
    {
        var detector = new ScreenReaderDetector(
            processEnumerator: () => ["chrome", "nvda", "explorer"]
        );
        Assert.True(detector.IsRunning());
    }

    [Fact]
    public void Returns_false_when_no_screen_reader_is_running()
    {
        var detector = new ScreenReaderDetector(
            processEnumerator: () => ["chrome", "devenv", "explorer"]
        );
        Assert.False(detector.IsRunning());
    }

    [Fact]
    public void Caches_result_and_does_not_re_enumerate_within_cache_duration()
    {
        int enumCount = 0;
        long fakeTime = 10_000_000;

        var detector = new ScreenReaderDetector(
            processEnumerator: () =>
            {
                enumCount++;
                return ["chrome"];
            },
            timestampProvider: () => fakeTime
        );

        // First call evaluates
        Assert.False(detector.IsRunning());
        Assert.Equal(1, enumCount);

        // Multiple calls within cache duration use cached result without re-enumerating
        for (int i = 0; i < 50; i++)
        {
            fakeTime += (long)(0.030 * Stopwatch.Frequency); // advance 30ms each tick
            Assert.False(detector.IsRunning());
        }
        Assert.Equal(1, enumCount);

        // Once cache duration (2 seconds) passes, next call refreshes
        fakeTime += (long)(2.5 * Stopwatch.Frequency);
        Assert.False(detector.IsRunning());
        Assert.Equal(2, enumCount);
    }

    [Fact]
    public void InvalidateCache_forces_immediate_refresh()
    {
        int enumCount = 0;
        var detector = new ScreenReaderDetector(
            processEnumerator: () =>
            {
                enumCount++;
                return ["chrome"];
            }
        );

        Assert.False(detector.IsRunning());
        Assert.Equal(1, enumCount);

        detector.InvalidateCache();
        Assert.False(detector.IsRunning());
        Assert.Equal(2, enumCount);
    }
}
