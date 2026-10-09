/** A small least-recently-used cache, so a phrase heard often ("End of page") is paid for once. */
export class AudioCache<T> {
  readonly #max: number
  readonly #entries = new Map<string, T>()

  constructor(max: number) {
    this.#max = max
  }

  get size(): number {
    return this.#entries.size
  }

  get(key: string): T | undefined {
    const value = this.#entries.get(key)
    if (value === undefined) return undefined
    this.#entries.delete(key)
    this.#entries.set(key, value) // now the most recently used
    return value
  }

  set(key: string, value: T): void {
    this.#entries.delete(key)
    this.#entries.set(key, value)
    if (this.#entries.size > this.#max) {
      const oldest = this.#entries.keys().next().value
      if (oldest !== undefined) this.#entries.delete(oldest)
    }
  }

  clear(): void {
    this.#entries.clear()
  }
}
