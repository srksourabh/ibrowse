using System.Diagnostics;
using IBrowse.Core;

namespace IBrowse.Windows;

/// <summary>Polls the pointer, and speaks the element under it once it has rested there.</summary>
internal sealed class Explorer(Voice voice) : IDisposable
{
    private const int PollMs = 30;
    private readonly HoverGate gate = new();
    private readonly Stopwatch clock = Stopwatch.StartNew();
    private readonly System.Windows.Forms.Timer timer = new() { Interval = PollMs };
    private bool subscribed;

    public bool IsOn { get; private set; }

    public void Toggle()
    {
        IsOn = !IsOn;
        gate.Reset();
        if (IsOn)
        {
            if (!subscribed) { timer.Tick += OnTick; subscribed = true; }
            timer.Start();
        }
        else timer.Stop();
        voice.Say(IsOn ? "Explore mode on" : "Explore mode off");
    }

    private void OnTick(object? sender, EventArgs e)
    {
        var p = System.Windows.Forms.Cursor.Position;
        var element = UiaDescriber.ElementAt(p.X, p.Y);
        if (element is null) return;
        if (!gate.Update(p.X, p.Y, UiaDescriber.KeyOf(element), clock.ElapsedMilliseconds)) return;
        if (ScreenReaderDetector.IsRunning()) return;
        voice.Say(SpokenGrammar.Text(UiaDescriber.Describe(element)));
    }

    public void Dispose() => timer.Dispose();
}
