/** 16 kHz mono is plenty for speech and keeps each request small. */
export const SAMPLE_RATE = 16000
const BUFFER_SIZE = 4096

export interface Recording {
  /** What was recorded; empty when cancelled. Rejects with a recogniser-style error code. */
  readonly samples: Promise<Float32Array>
  stop(): void
  cancel(): void
}

function concat(chunks: readonly Float32Array[]): Float32Array {
  const all = new Float32Array(chunks.reduce((n, chunk) => n + chunk.length, 0))
  let offset = 0
  for (const chunk of chunks) {
    all.set(chunk, offset)
    offset += chunk.length
  }
  return all
}

/** The browser's media error, as the error code the rest of iBrowse speaks from. */
function codeFor(error: unknown): string {
  const name = (error as { name?: string } | null)?.name
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'not-allowed'
  return name === 'NotFoundError' ? 'audio-capture' : 'failed'
}

/**
 * Records one voice request for Gemini (ADR-0017 #1), until stopped, cancelled
 * or `maxMs` runs out. A stop that comes before the microphone is ready still
 * counts. The microphone is released as soon as the recording ends.
 */
export function recordMicrophone(maxMs: number): Recording {
  let ended: boolean | null = null // null: still going; true: cancelled; false: stopped
  let finish: (cancelled: boolean) => void = () => {}
  const end = (cancelled: boolean): void => {
    ended ??= cancelled
    finish(ended)
  }

  const samples = (async () => {
    const stream = await navigator.mediaDevices
      .getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
      .catch((error: unknown) => {
        throw new Error(codeFor(error))
      })
    const context = new AudioContext({ sampleRate: SAMPLE_RATE })
    const source = context.createMediaStreamSource(stream)
    const processor = context.createScriptProcessor(BUFFER_SIZE, 1, 1)
    const chunks: Float32Array[] = []
    processor.onaudioprocess = (event) => chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)))
    source.connect(processor)
    processor.connect(context.destination)

    const cancelled = await new Promise<boolean>((resolve) => {
      finish = resolve
      if (ended !== null) resolve(ended)
      setTimeout(() => resolve(false), maxMs)
    })
    processor.disconnect()
    source.disconnect()
    stream.getTracks().forEach((track) => track.stop())
    await context.close()
    return cancelled ? new Float32Array(0) : concat(chunks)
  })()

  return { samples, stop: () => end(false), cancel: () => end(true) }
}
