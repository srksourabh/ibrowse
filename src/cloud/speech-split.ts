/** Short enough that the first sound arrives quickly, long enough to keep the number of requests down. */
const DEFAULT_MAX_CHARS = 1200

/** Splits one over-long piece at spaces, and a single over-long word wherever it must. */
function splitLongPiece(piece: string, max: number): string[] {
  const chunks: string[] = []
  let current = ''
  for (const word of piece.split(' ')) {
    if (word.length > max) {
      if (current) chunks.push(current)
      current = ''
      for (let i = 0; i < word.length; i += max) chunks.push(word.slice(i, i + max))
      continue
    }
    const joined = current ? `${current} ${word}` : word
    if (joined.length <= max) {
      current = joined
    } else {
      chunks.push(current)
      current = word
    }
  }
  if (current) chunks.push(current)
  return chunks
}

/**
 * Cuts text into pieces no longer than `max`, at sentence ends where it can,
 * so each can be spoken on its own and the next fetched while it plays.
 */
export function splitForSpeech(text: string, max: number = DEFAULT_MAX_CHARS): string[] {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat === '') return []
  const chunks: string[] = []
  let current = ''
  for (const sentence of flat.split(/(?<=[.!?])\s+/)) {
    if (sentence.length > max) {
      if (current) chunks.push(current)
      current = ''
      chunks.push(...splitLongPiece(sentence, max))
      continue
    }
    const joined = current ? `${current} ${sentence}` : sentence
    if (joined.length <= max) {
      current = joined
    } else {
      chunks.push(current)
      current = sentence
    }
  }
  if (current) chunks.push(current)
  return chunks
}
