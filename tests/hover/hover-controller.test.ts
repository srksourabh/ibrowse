import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LatencyMeter } from '../../src/audio/latency-meter'
import { panFromX } from '../../src/audio/pan'
import type { ElementInfo } from '../../src/hover/describe'
import { DWELL_MS, HYSTERESIS_PX, HoverController } from '../../src/hover/hover-controller'

const BUTTON: ElementInfo = {
  role: 'button',
  label: 'Buy now',
  affordance: 'interactive',
  certainty: 'sure',
  disabled: false,
  state: {},
}
const PARAGRAPH: ElementInfo = { ...BUTTON, role: 'paragraph', label: 'Some text', affordance: 'static' }

function setup(
  overrides: { settings?: { shortMode: boolean; speechRate: number; aiAssist?: boolean } } = {},
) {
  const button = document.createElement('button')
  const paragraph = document.createElement('p')
  document.body.append(button, paragraph)
  const infos = new Map<Element, ElementInfo>([
    [button, BUTTON],
    [paragraph, PARAGRAPH],
  ])
  let target: Element | null = null
  const speech = { speak: vi.fn(async () => 'finished' as const), cancel: vi.fn() }
  const earcons = { play: vi.fn() }
  let clock = 0
  const meter = new LatencyMeter(() => clock)
  const onTarget = vi.fn()
  const onMove = vi.fn()
  const onDescribed = vi.fn()
  const controller = new HoverController({
    onTarget,
    onMove,
    onDescribed,
    resolve: () => target,
    describe: (el) => infos.get(el)!,
    speech,
    earcons,
    meter,
    panAt: (x) => panFromX(x, 1000),
    getSettings: () => overrides.settings ?? { shortMode: false, speechRate: 1 },
  })
  return {
    button,
    paragraph,
    speech,
    earcons,
    meter,
    controller,
    infos,
    onTarget,
    onMove,
    onDescribed,
    hover: (el: Element | null, x = 500, y = 100) => {
      target = el
      controller.onPointerMove(x, y)
    },
    tick: (ms: number) => (clock += ms),
  }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('HoverController', () => {
  it('plays the Earcon straight away, panned by horizontal position, and speaks after the dwell', () => {
    const { hover, button, earcons, speech } = setup()
    hover(button, 250)
    expect(earcons.play).toHaveBeenCalledWith('interactive', -0.5)
    expect(speech.speak).not.toHaveBeenCalled()
    vi.advanceTimersByTime(DWELL_MS)
    expect(speech.speak).toHaveBeenCalledWith(
      { text: 'Buy now — Button, Clickable', rate: 1, pan: -0.5, onStart: expect.any(Function) },
      { interrupt: false },
    )
  })

  it('cancels speech as soon as the pointer moves to something new', () => {
    const { hover, button, paragraph, speech } = setup()
    hover(button)
    speech.cancel.mockClear()
    hover(paragraph, 600)
    expect(speech.cancel).toHaveBeenCalledOnce()
  })

  it('never speaks an element the pointer left before the dwell finished', () => {
    const { hover, button, paragraph, speech } = setup()
    hover(button)
    vi.advanceTimersByTime(DWELL_MS - 10)
    hover(paragraph, 600)
    vi.advanceTimersByTime(DWELL_MS)
    expect(speech.speak).toHaveBeenCalledTimes(1)
    expect(speech.speak).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('Some text') }),
      expect.anything(),
    )
  })

  it('waits its turn instead of cutting off speech that began after the pointer arrived', () => {
    const { hover, button, speech } = setup()
    hover(button)
    vi.advanceTimersByTime(DWELL_MS)
    expect(speech.speak).toHaveBeenCalledWith(expect.anything(), { interrupt: false })
  })

  it('does nothing while the pointer stays on the same element', () => {
    const { hover, button, earcons, speech } = setup()
    hover(button, 500)
    hover(button, 510)
    hover(button, 520)
    vi.advanceTimersByTime(DWELL_MS)
    expect(earcons.play).toHaveBeenCalledOnce()
    expect(speech.speak).toHaveBeenCalledOnce()
  })

  it('ignores a switch of target within the hysteresis band', () => {
    const { hover, button, paragraph, earcons } = setup()
    hover(button, 500)
    hover(paragraph, 500 + HYSTERESIS_PX - 1)
    expect(earcons.play).toHaveBeenCalledOnce()
  })

  it('switches once the pointer is clear of the hysteresis band', () => {
    const { hover, button, paragraph, earcons } = setup()
    hover(button, 500)
    hover(paragraph, 500 + HYSTERESIS_PX + 1)
    expect(earcons.play).toHaveBeenCalledTimes(2)
  })

  it('goes quiet over empty space: cancels speech, plays no Earcon', () => {
    const { hover, button, earcons, speech } = setup()
    hover(button, 100)
    earcons.play.mockClear()
    speech.cancel.mockClear()
    hover(null, 400)
    vi.advanceTimersByTime(DWELL_MS)
    expect(speech.cancel).toHaveBeenCalledOnce()
    expect(earcons.play).not.toHaveBeenCalled()
    expect(speech.speak).not.toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining('Buy') }))
  })

  it('uses the static Earcon for text', () => {
    const { hover, paragraph, earcons } = setup()
    hover(paragraph, 1000)
    expect(earcons.play).toHaveBeenCalledWith('static', 1)
  })

  it('uses the error Earcon for disabled controls and the static one for guesses', () => {
    const { hover, button, paragraph, earcons, infos } = setup()
    infos.set(button, { ...BUTTON, disabled: true })
    hover(button, 100)
    expect(earcons.play).toHaveBeenLastCalledWith('error', expect.any(Number))
    infos.set(paragraph, { ...BUTTON, role: 'generic', certainty: 'maybe' })
    hover(paragraph, 400)
    expect(earcons.play).toHaveBeenLastCalledWith('static', expect.any(Number))
  })

  it('applies short mode and speech rate from settings', () => {
    const { hover, button, speech } = setup({ settings: { shortMode: true, speechRate: 2 } })
    hover(button)
    vi.advanceTimersByTime(DWELL_MS)
    expect(speech.speak).toHaveBeenCalledWith(
      { text: 'Buy now — Button', rate: 2, pan: 0, onStart: expect.any(Function) },
      { interrupt: false },
    )
  })

  it('mentions the AI description for an undescribed image when AI is on', () => {
    const { hover, button, speech, infos } = setup({ settings: { shortMode: false, speechRate: 1, aiAssist: true } })
    infos.set(button, { ...BUTTON, role: 'image', label: '', affordance: 'static' })
    hover(button)
    vi.advanceTimersByTime(DWELL_MS)
    expect(speech.speak).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Image, no description. Press Alt+Shift+D to describe it.' }),
      expect.anything(),
    )
  })

  it('passes the stereo position along, for a voice that can use it', () => {
    const { hover, button, speech } = setup()
    hover(button, 250)
    vi.advanceTimersByTime(DWELL_MS)
    expect(speech.speak).toHaveBeenCalledWith(expect.objectContaining({ pan: -0.5 }), expect.anything())
  })

  it('re-reads the element at dwell time so changed state is spoken', () => {
    const { hover, button, speech, infos } = setup()
    hover(button)
    infos.set(button, { ...BUTTON, state: { checked: true } })
    vi.advanceTimersByTime(DWELL_MS)
    expect(speech.speak).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('checked') }),
      expect.anything(),
    )
  })

  it('tells the cursor which element was reached, once per element', () => {
    const { hover, button, paragraph, controller, onTarget } = setup()
    hover(button, 100)
    hover(button, 110)
    expect(onTarget).toHaveBeenCalledTimes(1)
    expect(onTarget).toHaveBeenCalledWith(button)
    expect(controller.current).toBe(button)
    hover(paragraph, 400)
    expect(onTarget).toHaveBeenLastCalledWith(paragraph)
  })

  it('reports every change of target, empty space included, so a question can be dropped', () => {
    const { hover, button, onMove } = setup()
    hover(button, 100)
    hover(button, 110)
    hover(null, 400)
    expect(onMove.mock.calls).toEqual([[button], [null]])
  })

  it('hands over the description it spoke, so a question can wait until it has finished', async () => {
    const { hover, button, onDescribed } = setup()
    hover(button, 100)
    expect(onDescribed).not.toHaveBeenCalled()
    vi.advanceTimersByTime(DWELL_MS)
    expect(onDescribed).toHaveBeenCalledWith(button, expect.any(Promise))
    await expect(onDescribed.mock.calls[0]![1]).resolves.toBe('finished')
  })

  it('does not report empty space as a target', () => {
    const { hover, button, onTarget } = setup()
    hover(button, 100)
    onTarget.mockClear()
    hover(null, 400)
    expect(onTarget).not.toHaveBeenCalled()
  })

  it('measures how long speech takes to start, from deciding to speak to the sound beginning', () => {
    const { hover, button, speech, meter, tick } = setup()
    hover(button)
    vi.advanceTimersByTime(DWELL_MS)
    const utterance = (speech.speak.mock.calls[0] as unknown as [{ onStart?: () => void }])[0]
    expect(meter.report().speech).toBeNull() // it has not begun yet
    tick(95)
    utterance.onStart!()
    expect(meter.report().speech).toMatchObject({ count: 1, p50: 95 })
  })

  it('records Earcon and cancel latency in the meter', () => {
    const { hover, button, meter } = setup()
    hover(button)
    const report = meter.report()
    expect(report.earcon?.count).toBe(1)
    expect(report.cancel?.count).toBe(1)
  })

  it('does nothing at all while muted, so reading is not interrupted', () => {
    const { hover, button, controller, earcons, speech } = setup()
    controller.setMuted(true)
    hover(button)
    vi.advanceTimersByTime(DWELL_MS)
    expect(earcons.play).not.toHaveBeenCalled()
    expect(speech.cancel).not.toHaveBeenCalled()
    expect(speech.speak).not.toHaveBeenCalled()
  })

  it('resumes announcing once unmuted', () => {
    const { hover, button, controller, earcons } = setup()
    controller.setMuted(true)
    hover(button)
    controller.setMuted(false)
    hover(button)
    expect(earcons.play).toHaveBeenCalledOnce()
  })

  it('cancelDwell() stops a pending description without touching speech', () => {
    const { hover, button, controller, speech } = setup()
    hover(button)
    speech.cancel.mockClear()
    controller.cancelDwell()
    vi.advanceTimersByTime(DWELL_MS)
    expect(speech.speak).not.toHaveBeenCalled()
    expect(speech.cancel).not.toHaveBeenCalled()
  })

  it('stop() clears the pending dwell, cancels speech and forgets the element', () => {
    const { hover, button, controller, speech, earcons } = setup()
    hover(button)
    speech.cancel.mockClear()
    controller.stop()
    vi.advanceTimersByTime(DWELL_MS)
    expect(speech.cancel).toHaveBeenCalledOnce()
    expect(speech.speak).not.toHaveBeenCalled()
    earcons.play.mockClear()
    hover(button) // the same element is announced again after a stop
    expect(earcons.play).toHaveBeenCalledOnce()
  })
})
