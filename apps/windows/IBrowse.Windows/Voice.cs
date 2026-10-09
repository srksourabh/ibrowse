using System.Speech.Synthesis;

namespace IBrowse.Windows;

/// <summary>Speaks with the voices installed in Windows. A new sentence replaces the old one.</summary>
internal sealed class Voice : IDisposable
{
    private readonly SpeechSynthesizer synth = new();

    public void Say(string text)
    {
        synth.SpeakAsyncCancelAll();
        synth.SpeakAsync(text);
    }

    public void Dispose() => synth.Dispose();
}
