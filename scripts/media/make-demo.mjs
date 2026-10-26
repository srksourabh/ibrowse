// Turns the demo recording into docs/media: an MP4 with both voices, a captions file,
// a poster frame and a silent GIF for the README. Needs ffmpeg on the PATH.
// Run after `IBROWSE_DEMO=1 npx playwright test e2e/media/demo-video.spec.ts`.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const work = path.join(root, '.output', 'demo')
const media = path.join(root, 'docs', 'media')
mkdirSync(media, { recursive: true })

const { clips, video } = JSON.parse(readFileSync(path.join(work, 'timeline.json'), 'utf8'))
const ffmpeg = (args) => execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' })

/** Seconds of sound in a WAV file. */
function seconds(file) {
  const wav = readFileSync(file)
  const dataAt = wav.indexOf('data') + 4
  return wav.readUInt32LE(dataAt) / wav.readUInt32LE(28)
}

const stamp = (s) => new Date(Math.max(0, s) * 1000).toISOString().slice(11, 23)

// Captions: one cue per line, for the presentation's video player.
const cues = clips.map((clip, i) => {
  const end = clip.at + seconds(clip.file)
  const who = clip.who === 'you' ? 'You' : 'iBrowse'
  return `${i + 1}\n${stamp(clip.at)} --> ${stamp(end)}\n<v ${who}>${clip.text}`
})
writeFileSync(path.join(media, 'ibrowse-demo.vtt'), `WEBVTT\n\n${cues.join('\n\n')}\n`)

// MP4: the video, with every spoken line placed at the moment it was shown.
const inputs = clips.flatMap((clip) => ['-i', clip.file])
const delays = clips.map((clip, i) => `[${i + 1}:a]adelay=${Math.round(clip.at * 1000)}:all=1[a${i}]`)
const mix = `${clips.map((_, i) => `[a${i}]`).join('')}amix=inputs=${clips.length}:normalize=0[voice]`
ffmpeg(['-i', video, ...inputs, '-filter_complex', [...delays, mix].join(';'), '-map', '0:v', '-map', '[voice]',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '27', '-preset', 'slow', '-c:a', 'aac', '-b:a', '96k',
  '-movflags', '+faststart', '-shortest', path.join(media, 'ibrowse-demo.mp4')])

// Poster: a frame from the briefing.
const briefing = clips[1]?.at ?? 5
ffmpeg(['-ss', String(briefing + 1), '-i', video, '-frames:v', '1', path.join(media, 'ibrowse-demo-poster.png')])

// GIF: silent, smaller, for the README, where video does not play inline.
ffmpeg(['-i', video, '-vf', 'fps=8,scale=880:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4',
  path.join(media, 'ibrowse-demo.gif')])

for (const file of ['ibrowse-demo.mp4', 'ibrowse-demo.gif', 'ibrowse-demo-poster.png', 'ibrowse-demo.vtt']) {
  const full = path.join(media, file)
  console.log(`${file}: ${existsSync(full) ? (statSync(full).size / 1024 / 1024).toFixed(2) + ' MB' : 'missing'}`)
}
