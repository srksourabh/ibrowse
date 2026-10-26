# Speaks the text in a file into a WAV file with a Windows voice, for the demo video's sound.
param(
  [Parameter(Mandatory = $true)][string]$TextFile,
  [Parameter(Mandatory = $true)][string]$Out,
  [string]$Voice = 'Microsoft Zira Desktop',
  [int]$Rate = 1
)
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $synth.SelectVoice($Voice)
  $synth.Rate = $Rate
  $synth.SetOutputToWaveFile($Out)
  $synth.Speak([System.IO.File]::ReadAllText($TextFile))
} finally {
  $synth.Dispose()
}
