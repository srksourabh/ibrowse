import type { HandlerSpec } from '../explore-mode'
import { changeText, invalidText, submitText } from '../forms/changes'
import { ValidationGate } from '../forms/validation-gate'
import { spokenText } from '../hover/affordance-speech'
import { describeElement } from '../hover/describe'
import { createPointerThrottle } from '../hover/pointer-throttle'
import { hitTest } from '../hover/hit-test'
import { routeKey } from '../key-router'
import { blockText } from '../reading/blocks'
import type { FrameActionRequest } from '../shared/messages'
import { StatusZone } from '../status/status'
import { EdgeCue } from '../touch/edge-cue'
import type { Services } from './services'
import type { Tools } from './tools'

/** Side mouse buttons, as reported by `MouseEvent.button`. */
const MOUSE_BACK = 3
const MOUSE_FORWARD = 4

const isEditable = (el: Element | null): boolean =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))

export interface Handlers {
  readonly specs: Record<string, HandlerSpec>
  /** Drops any pointer movement still waiting for the next frame. */
  cancelPending(): void
}

function pointerHandlers(s: Services, t: Tools) {
  // Only the top frame has a top edge or a window edge to speak of.
  const zone = t.isTopFrame
    ? new StatusZone(() => {
        s.earcons.play('edge', 0)
        t.whereAmI()
      })
    : null
  const edgeCue = t.isTopFrame
    ? new EdgeCue((edge) => s.earcons.play('edge', edge === 'left' ? -1 : edge === 'right' ? 1 : 0))
    : null
  const pointer = createPointerThrottle((x, y) => {
    t.briefer.handlePointerMove(x, y)
    if (zone?.update(y)) return
    t.hover.onPointerMove(x, y)
  })
  const isTouch = (e: PointerEvent): boolean => e.pointerType === 'touch'

  const specs: Record<string, HandlerSpec> = {
    pointermove: (event) => {
      if (!(event instanceof PointerEvent)) return
      s.noteScreenPosition(event)
      if (isTouch(event)) {
        t.virtualPointer.noteTouch(event.clientX, event.clientY)
        t.touch.move(event.clientX, event.clientY)
        edgeCue?.update(event.clientX, event.clientY, {
          width: window.innerWidth,
          height: window.innerHeight,
        })
      } else {
        t.virtualPointer.noteMouse()
      }
      pointer.push(event.clientX, event.clientY)
    },
    pointerdown: (event) => {
      s.resumeAudio()
      if (!(event instanceof PointerEvent) || !isTouch(event)) return
      t.virtualPointer.noteTouch(event.clientX, event.clientY)
      t.touch.down(event.clientX, event.clientY)
      pointer.push(event.clientX, event.clientY)
    },
    pointerup: (event) => {
      if (event instanceof PointerEvent && isTouch(event)) t.touch.up(event.clientX, event.clientY)
    },
    // Without this the browser would also "click" what the finger lifted from.
    touchend: (event) => event.preventDefault(),
  }
  return { specs, cancelPending: () => pointer.cancel() }
}

function readingHandlers(s: Services, t: Tools): Record<string, HandlerSpec> {
  const onSideButton = (event: Event): void => {
    if (!(event instanceof MouseEvent)) return
    if (event.button !== MOUSE_BACK && event.button !== MOUSE_FORWARD) return
    event.preventDefault() // keeps the browser from moving through history
    if (event.type === 'mouseup') t.navigator.go(event.button === MOUSE_FORWARD ? 'next' : 'prev')
  }
  return {
    wheel: (event) => {
      if (!(event instanceof WheelEvent)) return
      const { x, y } = t.virtualPointer.pointFor({ x: event.clientX, y: event.clientY })
      t.reader.onWheel({
        deltaY: event.deltaY,
        deltaMode: event.deltaMode,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        clientX: x,
        clientY: y,
        preventDefault: () => event.preventDefault(),
      })
    },
    click: (event) => {
      if (!(event instanceof MouseEvent) || !event.isTrusted || event.button !== 0) return
      const target = hitTest(event.clientX, event.clientY)
      if (!target) return
      const info = describeElement(target)
      // Controls, and elements that may be controls, keep their normal click, and confirm it.
      if (info.affordance === 'interactive') {
        s.earcons.play('confirm', s.panAt(event.clientX))
        return
      }
      if (info.role !== 'image' && blockText(target) !== '') t.reader.readBlock(target)
    },
    mouseup: onSideButton,
    auxclick: onSideButton,
  }
}

function keyboardHandler(s: Services, t: Tools): Record<string, HandlerSpec> {
  const forward = (action: Parameters<Tools['runAction']>[0]): void => {
    const request: FrameActionRequest = { type: 'frame-action', action }
    chrome.runtime.sendMessage(request).catch(s.reportError)
  }
  return {
    keydown: (event) => {
      if (!(event instanceof KeyboardEvent)) return
      s.resumeAudio()
      // Y and N answer the read prompt, but never while the user is typing.
      if (t.isTopFrame && !isEditable(document.activeElement) && t.briefer.handleKey(event.key)) {
        event.preventDefault()
        event.stopPropagation()
        return
      }
      const action = routeKey(event)
      if (!action) return
      // Escape is not swallowed: the page may use it too.
      if (action !== 'stop-speech') {
        event.preventDefault()
        event.stopPropagation()
      }
      // A shortcut pressed inside an iframe is carried out by the top frame.
      if (t.isTopFrame) t.runAction(action)
      else forward(action)
    },
  }
}

function formHandlers(s: Services, t: Tools): Record<string, HandlerSpec> {
  const gate = new ValidationGate()
  const say = (text: string | null, interrupt = true): void => {
    if (text) void s.speech.speak({ text, rate: s.rate() }, { interrupt })
  }
  return {
    focusin: (event) => {
      const el = event.target
      if (!(el instanceof Element) || el === document.body) return
      t.typingEcho.focus(el)
      t.jumps.setCursor(el)
      say(spokenText(describeElement(el), { shortMode: true }), gate.focusMayInterrupt())
    },
    input: (event) => {
      if (event.target instanceof Element) t.typingEcho.onInput(event.target)
    },
    change: (event) => {
      if (event.target instanceof Element) say(changeText(event.target))
    },
    // `invalid` does not bubble, so it has to be caught on the way down.
    invalid: {
      capture: true,
      listener: (event) => {
        if (!(event.target instanceof Element)) return
        gate.noteInvalid()
        s.earcons.play('error', 0)
        say(invalidText(event.target), false)
      },
    },
    // Fired only after validation passes. Caught on the way down, so a page that stops it cannot silence it.
    submit: {
      capture: true,
      listener: (event) => {
        if (!(event.target instanceof HTMLFormElement)) return
        s.earcons.play('confirm', 0)
        say(submitText(event.target, (event as SubmitEvent).submitter), false)
      },
    },
  }
}

export function createHandlers(s: Services, t: Tools): Handlers {
  const pointer = pointerHandlers(s, t)
  return {
    specs: {
      ...pointer.specs,
      ...readingHandlers(s, t),
      ...keyboardHandler(s, t),
      ...formHandlers(s, t),
    },
    cancelPending: pointer.cancelPending,
  }
}
