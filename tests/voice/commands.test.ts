import { describe, expect, it } from 'vitest'
import { parseUtterance, type VoiceCommand } from '../../src/voice/commands'

const command = (text: string): VoiceCommand | null => {
  const result = parseUtterance(text)
  return result.type === 'command' ? result.command : null
}

describe('parseUtterance: commands', () => {
  it.each([
    'click', 'Click it.', 'press', 'press this', 'tap that', 'open it', 'select', 'click here',
    'Please click it', 'can you click this', 'iBrowse, click', 'click on', 'press on it',
  ])('"%s" presses what the pointer is on', (text) => {
    expect(command(text)).toEqual({ kind: 'click' })
  })

  it.each([
    ['click sign in', 'sign in'],
    ['press the Add to basket button', 'add to basket'],
    ['open the contact link', 'contact'],
    ['click on Privacy', 'privacy'],
  ])('"%s" presses something by its name', (text, target) => {
    expect(command(text)).toEqual({ kind: 'click', target })
  })

  it.each([
    ['scroll up', 'up'], ['Scroll down.', 'down'], ['go down', 'down'], ['down', 'down'],
    ['up a bit', 'up'], ['page down', 'down'], ['scroll down please', 'down'], ['move up', 'up'],
  ])('"%s" scrolls %s', (text, direction) => {
    expect(command(text)).toEqual({ kind: 'scroll', direction })
  })

  it.each([
    ['scroll to the top', 'top'], ['go to the top', 'top'], ['top of the page', 'top'],
    ['go to the bottom', 'bottom'], ['scroll to the end', 'bottom'],
  ])('"%s" scrolls to the %s', (text, edge) => {
    expect(command(text)).toEqual({ kind: 'scroll-to', edge })
  })

  it.each([
    ['read', 'this'], ['read this', 'this'], ['read it to me', 'this'],
    ['read the page', 'page'], ['read everything', 'page'], ['read the whole page', 'page'], ['read all', 'page'],
  ])('"%s" reads %s', (text, what) => {
    expect(command(text)).toEqual({ kind: 'read', what })
  })

  it.each([
    ['next page', 'next'], ['go to the next page', 'next'], ['previous page', 'previous'],
  ])('"%s" follows the %s page link', (text, direction) => {
    expect(command(text)).toEqual({ kind: 'page', direction })
  })

  it.each(['go back', 'back', 'take me back'])('"%s" goes back in history', (text) => {
    expect(command(text)).toEqual({ kind: 'back' })
  })

  it.each(['go forward', 'forward'])('"%s" goes forward in history', (text) => {
    expect(command(text)).toEqual({ kind: 'forward' })
  })

  it.each([
    ["what's on the left", 'left'], ['what is in the right panel', 'right'], ['what is in the header', 'header'],
    ["what's at the top", 'header'], ['what is in the footer', 'footer'], ['what is at the bottom', 'footer'],
    ["what's in the main content", 'main'], ['what is in the middle', 'main'],
  ])('"%s" describes the %s panel', (text, panel) => {
    expect(command(text)).toEqual({ kind: 'panel', panel, action: 'describe' })
  })

  it.each([
    ['go to the left panel', 'left'], ['take me to the main content', 'main'], ['jump to the footer', 'footer'],
    ['go to the header', 'header'], ['move to the right side', 'right'],
  ])('"%s" moves to the %s panel', (text, panel) => {
    expect(command(text)).toEqual({ kind: 'panel', panel, action: 'go' })
  })

  it.each([
    ['find search', 'search'], ['where is the login', 'login'], ['where is the search box', 'search box'],
    ['find the contact link', 'contact link'],
  ])('"%s" finds "%s"', (text, target) => {
    expect(command(text)).toEqual({ kind: 'find', target })
  })

  it.each(['yes', 'yeah', 'yes please', 'yep', 'go ahead', 'do it', 'confirm'])('"%s" says yes', (text) => {
    expect(command(text)).toEqual({ kind: 'yes' })
  })

  it.each(['no', 'nope', 'no thanks', "don't", 'do not', 'not now'])('"%s" says no', (text) => {
    expect(command(text)).toEqual({ kind: 'no' })
  })

  it.each(['stop', 'be quiet', 'quiet', 'cancel', 'shut up', 'pause'])('"%s" stops speech', (text) => {
    expect(command(text)).toEqual({ kind: 'stop' })
  })

  it.each(['repeat', 'say that again', 'again', 'what did you say'])('"%s" repeats', (text) => {
    expect(command(text)).toEqual({ kind: 'repeat' })
  })

  it.each(['help', 'what can I say', 'what can you do', 'commands'])('"%s" asks for help', (text) => {
    expect(command(text)).toEqual({ kind: 'help' })
  })

  it('"where am I" says where the user is', () => {
    expect(command('where am I')).toEqual({ kind: 'where' })
  })

  it.each(['describe the page', "what's on this page", 'what is on the page', 'overview'])(
    '"%s" gives the page briefing',
    (text) => {
      expect(command(text)).toEqual({ kind: 'brief' })
    },
  )
})

describe('parseUtterance: questions', () => {
  it.each([
    'What is this page about?',
    'How much does the blue pot cost',
    'Is there free delivery?',
    'summarise the reviews',
  ])('"%s" is a question, kept as said', (text) => {
    expect(parseUtterance(text)).toEqual({ type: 'question', text })
  })

  it('treats silence or filler alone as nothing', () => {
    expect(parseUtterance('  ')).toEqual({ type: 'nothing' })
    expect(parseUtterance('um, uh')).toEqual({ type: 'nothing' })
    expect(parseUtterance('please')).toEqual({ type: 'nothing' })
  })
})
