export type LatencyKind = 'earcon' | 'speech' | 'cancel'

const KINDS: readonly LatencyKind[] = ['earcon', 'speech', 'cancel']

/** Extension targets from PRD §6.1 and ADR-0006. */
export const LATENCY_TARGETS_MS: Readonly<Record<LatencyKind, number>> = {
  earcon: 30,
  speech: 150,
  cancel: 20,
}

export interface LatencyStats {
  readonly count: number
  readonly p50: number
  readonly p95: number
  readonly max: number
}

export type LatencyReport = Readonly<Record<LatencyKind, LatencyStats | null>>

/** Nearest-rank percentile of an ascending-sorted, non-empty list. */
function percentile(sorted: readonly number[], p: number): number {
  const rank = Math.ceil((p / 100) * sorted.length)
  return sorted[Math.max(0, rank - 1)] ?? 0
}

function statsFor(samples: readonly number[]): LatencyStats | null {
  if (samples.length === 0) return null
  const sorted = [...samples].sort((a, b) => a - b)
  return {
    count: sorted.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    max: sorted[sorted.length - 1] ?? 0,
  }
}

export class LatencyMeter {
  readonly #now: () => number
  readonly #samples: Record<LatencyKind, number[]> = { earcon: [], speech: [], cancel: [] }

  constructor(now: () => number = () => performance.now()) {
    this.#now = now
  }

  /** Starts timing. Call the returned function when the sound begins. */
  start(kind: LatencyKind): () => number | undefined {
    const startedAt = this.#now()
    let stopped = false
    return () => {
      if (stopped) return undefined
      stopped = true
      const elapsed = this.#now() - startedAt
      this.#samples[kind].push(elapsed)
      return elapsed
    }
  }

  report(): LatencyReport {
    return {
      earcon: statsFor(this.#samples.earcon),
      speech: statsFor(this.#samples.speech),
      cancel: statsFor(this.#samples.cancel),
    }
  }

  reset(): void {
    KINDS.forEach((kind) => {
      this.#samples[kind] = []
    })
  }
}

/** Kinds whose 95th percentile is over target. Kinds with no samples are not judged. */
export function failingTargets(report: LatencyReport): LatencyKind[] {
  return KINDS.filter((kind) => {
    const stats = report[kind]
    return stats !== null && stats.p95 > LATENCY_TARGETS_MS[kind]
  })
}
