import type { Utterance } from '../audio/speech-service'
import type { KeyAction } from '../key-router'

/** The parts of an Utterance that can travel to the background worker. */
export type WireUtterance = Pick<Utterance, 'text' | 'rate' | 'pitch' | 'volume' | 'voiceName'>

/** Content script to background: chrome.tts is not available in content scripts. */
export type SpeechRequest =
  | { readonly type: 'speak'; readonly id: number; readonly utterance: WireUtterance }
  | { readonly type: 'cancel' }

export type SpeechResponse =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string }

/** Background to content script: the sound of speech request `id` has begun. */
export type SpeechStartedNotice = { readonly type: 'speech-started'; readonly id: number }

/** Top frame to background: Explore Mode changed, so the toolbar button can show it. */
export type ExploreStateNotice = { readonly type: 'explore-state'; readonly enabled: boolean }

/** Content script to background: the page is about to change, so turn Explore Mode back on after. */
export type NavigationNotice = { readonly type: 'will-navigate' }

/** Content script in an iframe to background: pass a shortcut up to the top frame. */
export type FrameActionRequest = { readonly type: 'frame-action'; readonly action: KeyAction }

/** Content script to background: which tab is this, among how many? */
export type TabInfoRequest = { readonly type: 'tab-info' }

export type TabInfoResponse =
  | { readonly ok: true; readonly index: number; readonly count: number }
  | { readonly ok: false }

/** Background to content script. */
export type ExploreMessage =
  | { readonly type: 'toggle-explore' }
  | { readonly type: 'resume-explore' }
  | { readonly type: 'next-page' }
  | { readonly type: 'prev-page' }
  | { readonly type: 'action'; readonly action: KeyAction }
  /** What the user said, from the speech recogniser (ADR-0017). Untrusted text: matched, never run. */
  | { readonly type: 'voice-transcript'; readonly text: string }
