import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TypingEcho } from '../../src/forms/typing-echo'

type Mode = 'characters' | 'words' | 'none'

function setup(mode: Mode = 'characters') {
  const speech = {
    speak: vi.fn(async (_utterance: { text: string; rate?: number }) => 'finished' as const),
  }
  const earcons = { play: vi.fn() }
  const echo = new TypingEcho({ speech, earcons, getMode: () => mode, getRate: () => 1 })
  const input = document.createElement('input')
  document.body.append(input)
  echo.focus(input)
  const type = (value: string, field: HTMLInputElement | HTMLTextAreaElement = input) => {
    field.value = value
    echo.onInput(field)
  }
  return { echo, speech, earcons, input, type }
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('TypingEcho: characters', () => {
  it('speaks each character as it is typed', () => {
    const { type, speech } = setup()
    type('a')
    expect(speech.speak).toHaveBeenLastCalledWith({ text: 'a', rate: 1 })
    type('ab')
    expect(speech.speak).toHaveBeenLastCalledWith({ text: 'b', rate: 1 })
  })

  it('names characters a voice would skip', () => {
    const { type, speech } = setup()
    const said = (value: string) => {
      type(value)
      return speech.speak.mock.lastCall![0].text
    }
    expect(said(' ')).toBe('space')
    expect(said(' @')).toBe('at')
    expect(said(' @.')).toBe('dot')
    expect(said(' @.-')).toBe('dash')
  })

  it('finds a character typed in the middle', () => {
    const { type, speech } = setup()
    type('ac')
    type('abc')
    expect(speech.speak).toHaveBeenLastCalledWith({ text: 'b', rate: 1 })
  })

  it('announces a deleted character', () => {
    const { type, speech } = setup()
    type('ab')
    type('a')
    expect(speech.speak).toHaveBeenLastCalledWith({ text: 'deleted b', rate: 1 })
  })

  it('describes a paste or a replacement without reading it all out', () => {
    const { type, speech } = setup()
    type('abc')
    type('abcdefgh')
    expect(speech.speak).toHaveBeenLastCalledWith({ text: 'Added 5 characters', rate: 1 })
    type('xyzxyzxy')
    expect(speech.speak).toHaveBeenLastCalledWith({ text: 'Text changed', rate: 1 })
    type('xy')
    expect(speech.speak).toHaveBeenLastCalledWith({ text: 'Removed 6 characters', rate: 1 })
  })

  it('works in a textarea too', () => {
    const { echo, speech } = setup()
    const area = document.createElement('textarea')
    echo.focus(area)
    area.value = 'x'
    echo.onInput(area)
    expect(speech.speak).toHaveBeenCalledWith({ text: 'x', rate: 1 })
  })
})

describe('TypingEcho: words', () => {
  it('stays quiet until a word is finished, then says the word', () => {
    const { type, speech } = setup('words')
    type('h')
    type('he')
    type('hel')
    expect(speech.speak).not.toHaveBeenCalled()
    type('hel ')
    expect(speech.speak).toHaveBeenCalledWith({ text: 'hel', rate: 1 })
  })

  it('treats punctuation as the end of a word', () => {
    const { type, speech } = setup('words')
    type('hi')
    type('hi,')
    expect(speech.speak).toHaveBeenCalledWith({ text: 'hi', rate: 1 })
  })

  it('still announces deletions', () => {
    const { type, speech } = setup('words')
    type('ab')
    speech.speak.mockClear()
    type('a')
    expect(speech.speak).toHaveBeenCalledWith({ text: 'deleted b', rate: 1 })
  })
})

describe('TypingEcho: off', () => {
  it('says nothing', () => {
    const { type, speech } = setup('none')
    type('a')
    type('')
    expect(speech.speak).not.toHaveBeenCalled()
  })
})

describe('TypingEcho: passwords', () => {
  it.each(['characters', 'words', 'none'] as const)(
    'never speaks what is typed into a password field (%s)',
    (mode) => {
      const { echo, speech, earcons } = setup(mode)
      const password = document.createElement('input')
      password.type = 'password'
      echo.focus(password)
      password.value = 'h'
      echo.onInput(password)
      password.value = 'h '
      echo.onInput(password)
      password.value = 'h'
      echo.onInput(password)
      expect(speech.speak).not.toHaveBeenCalled()
      expect(earcons.play).toHaveBeenCalledWith('tick', 0)
    },
  )
})

describe('TypingEcho: other inputs', () => {
  it('ignores checkboxes, radios and buttons', () => {
    const { echo, speech } = setup()
    for (const type of ['checkbox', 'radio', 'button', 'range']) {
      const other = document.createElement('input')
      other.type = type
      echo.focus(other)
      other.value = 'x'
      echo.onInput(other)
    }
    expect(speech.speak).not.toHaveBeenCalled()
  })
})
