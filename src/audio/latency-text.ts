import { LATENCY_TARGETS_MS, failingTargets, type LatencyKind, type LatencyReport } from './latency-meter'

const LABELS: Readonly<Record<LatencyKind, string>> = {
  earcon: 'Sound',
  speech: 'Speech start',
  cancel: 'Stopping speech',
}
const ORDER: readonly LatencyKind[] = ['earcon', 'speech', 'cancel']

const NOTHING_YET =
  'No measurements yet. Turn on Measure delays in settings, explore a page for a minute, and try again.'

const plural = (n: number): string => `${n} measurement${n === 1 ? '' : 's'}`

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** The measured delays as a few sentences, for reading aloud. */
export function latencyText(report: LatencyReport): string {
  const sentences: string[] = []
  for (const kind of ORDER) {
    const stats = report[kind]
    if (!stats) continue
    sentences.push(
      `${LABELS[kind]}: typically ${Math.round(stats.p50)} milliseconds, slowest ${Math.round(stats.p95)}, ` +
        `target ${LATENCY_TARGETS_MS[kind]}, from ${plural(stats.count)}.`,
    )
  }
  if (sentences.length === 0) return NOTHING_YET

  const over = failingTargets(report)
  sentences.push(
    over.length === 0
      ? 'All delays are within target.'
      : `Over target: ${joinNames(over.map((kind) => LABELS[kind].toLowerCase()))}.`,
  )
  return sentences.join(' ')
}
