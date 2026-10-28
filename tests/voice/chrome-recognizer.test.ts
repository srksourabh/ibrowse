import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ChromeRecognizer,
  chooseMode,
  recognitionErrorText,
  type RecognitionClass,
  type RecognitionLike,
} from '../../src/voice/chrome-recognizer'

let instances: FakeRecognition[] = []

class FakeRecognition implements RecognitionLike {
  lang = ''
  interimResults = true
  continuous = true
  maxAlternatives = 5
  processLocally = false
  onresult: RecognitionLike['onresult'] = null
  onerror: RecognitionLike['onerror'] = null
  onend: RecognitionLike['onend'] = null
  start = vi.fn()
  stop = vi.fn(() => this.onend?.())
  abort = vi.fn(() => this.onend?.())
  constructor() {
    instances.push(this)
  }
  say(text: string): void {
    const alternative = { transcript: text }
    this.onresult?.({ results: [Object.assign([alternative], { isFinal: true })] })
  }
}

const SR = FakeRecognition as unknown as RecognitionClass
/** A recognition class whose static available() answers as given, without touching the shared fake. */
const withAvailable = (available: () => Promise<string>): RecognitionClass =>
  Object.assign(class extends FakeRecognition {}, { available }) as unknown as RecognitionClass

beforeEach(() => {
  instances = []
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe('chooseMode', () => {
  it('chooses on-device recognition when the language is installed on this computer', async () => {
    const available = vi.fn(async () => 'available')
    expect(await chooseMode(withAvailable(available), 'en-GB')).toBe('on-device')
    expect(available).toHaveBeenCalledWith({ langs: ['en-GB'], processLocally: true })
  })

  it.each(['downloadable', 'downloading', 'unavailable'])(
    'uses the online service when on-device is %s, rather than wait for a download',
    async (status) => {
      expect(await chooseMode(withAvailable(async () => status), 'en-GB')).toBe('online')
    },
  )

  it('uses the online service on a browser without on-device recognition', async () => {
    expect(await chooseMode(SR, 'en-GB')).toBe('online')
  })

  it('uses the online service if asking fails', async () => {
    const available = async (): Promise<string> => {
      throw new Error('SyntaxError')
    }
    expect(await chooseMode(withAvailable(available), 'xx')).toBe('online')
  })
})

describe('ChromeRecognizer', () => {
  it('listens once, in the page language, for one final result, on-device when chosen', async () => {
    const listening = new ChromeRecognizer(SR, 'en-GB', 'on-device').listen({ maxMs: 5000 })
    const recognition = instances[0]!
    expect(recognition).toMatchObject({
      lang: 'en-GB',
      interimResults: false,
      continuous: false,
      maxAlternatives: 1,
      processLocally: true,
    })
    expect(recognition.start).toHaveBeenCalled()
    recognition.say('click sign in')
    recognition.onend?.()
    await expect(listening.result).resolves.toBe('click sign in')
  })

  it('does not ask for on-device processing in online mode', () => {
    new ChromeRecognizer(SR, 'en-GB', 'online').listen({ maxMs: 5000 })
    expect(instances[0]!.processLocally).toBe(false)
  })

  it('stops by itself when the window runs out, giving what it heard', async () => {
    const listening = new ChromeRecognizer(SR, 'en-GB', 'online').listen({ maxMs: 5000 })
    vi.advanceTimersByTime(5000)
    expect(instances[0]!.stop).toHaveBeenCalled()
    await expect(listening.result).resolves.toBeNull()
  })

  it('stops early on request, giving what it heard', async () => {
    const listening = new ChromeRecognizer(SR, 'en-GB', 'online').listen({ maxMs: 15000 })
    instances[0]!.say('scroll down')
    listening.stop()
    await expect(listening.result).resolves.toBe('scroll down')
  })

  it('drops what it heard when cancelled', async () => {
    const listening = new ChromeRecognizer(SR, 'en-GB', 'online').listen({ maxMs: 15000 })
    instances[0]!.say('scroll down')
    listening.cancel()
    expect(instances[0]!.abort).toHaveBeenCalled()
    await expect(listening.result).resolves.toBeNull()
  })

  it.each(['no-speech', 'aborted'])('treats "%s" as silence', async (error) => {
    const listening = new ChromeRecognizer(SR, 'en-GB', 'online').listen({ maxMs: 5000 })
    instances[0]!.onerror?.({ error })
    instances[0]!.onend?.()
    await expect(listening.result).resolves.toBeNull()
  })

  it('fails with the browser error for anything else', async () => {
    const listening = new ChromeRecognizer(SR, 'en-GB', 'online').listen({ maxMs: 5000 })
    instances[0]!.onerror?.({ error: 'not-allowed' })
    instances[0]!.onend?.()
    await expect(listening.result).rejects.toThrow('not-allowed')
  })
})

describe('recognitionErrorText', () => {
  it('says how to allow the microphone when it is blocked', () => {
    expect(recognitionErrorText(new Error('not-allowed'))).toBe(
      'The microphone is not allowed. Open settings with Alt and O and turn on voice to allow it.',
    )
    expect(recognitionErrorText(new Error('service-not-allowed'))).toContain('not allowed')
  })

  it('says when there is no microphone', () => {
    expect(recognitionErrorText(new Error('audio-capture'))).toBe('No microphone was found.')
  })

  it('says when the online service cannot be reached', () => {
    expect(recognitionErrorText(new Error('network'))).toBe(
      'Speech recognition needs an internet connection on this computer.',
    )
  })

  it('uses the cloud wording for Gemini key and model problems', () => {
    expect(recognitionErrorText(new Error('no-key'))).toBe('No Google key has been entered. Add one in settings.')
    expect(recognitionErrorText(new Error('bad-key'))).toBe('Google did not accept the key. Check it in settings.')
  })

  it("says when Google's limit is reached, and what to do instead", () => {
    expect(recognitionErrorText(new Error('rate-limit'))).toBe(
      "Google's limit has been reached for now. Chrome's speech recognition can be chosen in settings instead.",
    )
  })

  it('has a plain fallback', () => {
    expect(recognitionErrorText(new Error('weird'))).toBe('I could not listen just now. Please try again.')
  })
})

describe('ChromeRecognizer: a start that fails', () => {
  it('fails at once, rather than waiting out the window', async () => {
    class Broken extends FakeRecognition {
      override start = vi.fn(() => {
        throw new Error('InvalidStateError')
      })
    }
    const listening = new ChromeRecognizer(Broken as unknown as RecognitionClass, 'en-GB', 'online').listen({ maxMs: 5000 })
    await expect(listening.result).rejects.toThrow('InvalidStateError')
  })
})

describe('recognitionErrorText: voice turned off', () => {
  it('says voice commands are off and where to turn them on', () => {
    expect(recognitionErrorText(new Error('voice-off'))).toBe(
      'Voice commands are off. Turn them on in settings, opened with Alt and O.',
    )
  })
})
