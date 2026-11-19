using System.Globalization;
using System.Speech.Synthesis;

namespace IBrowse.Windows;

/// <summary>Speaks with the voices installed in Windows, preferring Indian English (en-IN). A new sentence replaces the old one.</summary>
internal sealed class Voice : IDisposable
{
    private readonly SpeechSynthesizer synth = new();

    public Voice()
    {
        try
        {
            synth.SelectVoiceByHints(VoiceGender.NotSet, VoiceAge.NotSet, 0, new CultureInfo("en-IN"));
        }
        catch
        {
            // Keep the system default voice if no Indian English voice is installed.
        }
    }

    public void Say(string text)
    {
        synth.SpeakAsyncCancelAll();
        synth.SpeakAsync(text);
    }

    public void Dispose() => synth.Dispose();
}
