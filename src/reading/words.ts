export function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean)
}

/** Letters separated by commas, so the voice says each one on its own. */
export function spellWord(word: string): string {
  return Array.from(word.replace(/[^\p{L}\p{N}]/gu, '')).join(', ')
}
