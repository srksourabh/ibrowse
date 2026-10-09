import type { CloudErrorKind } from './gemini-client'

/** Content script to background: turn this text into speech. The voice and model come from the settings. */
export type CloudSpeechRequest = {
  readonly type: 'cloud-speech'
  readonly id: number
  readonly text: string
}

/** Content script to background: forget request `id`. */
export type CloudCancelRequest = { readonly type: 'cloud-cancel'; readonly id: number }

export type CloudSpeechResponse =
  | { readonly ok: true; readonly base64: string; readonly mimeType: string }
  | {
      readonly ok: false
      readonly kind: CloudErrorKind | 'disabled' | 'cancelled'
      /** A sentence to say. Fixed text: never the key, never anything the service sent. */
      readonly reason: string
    }
