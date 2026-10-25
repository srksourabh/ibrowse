/** Why a cloud request failed, in words a person can hear. No network code and no key, so pages may use it. */
export type CloudErrorKind =
  | 'no-key'
  | 'bad-key'
  | 'bad-model'
  | 'bad-request'
  | 'rate-limit'
  | 'server'
  | 'network'
  | 'empty'

const SPOKEN: Readonly<Record<CloudErrorKind, string>> = {
  'no-key': 'No Google key has been entered. Add one in settings.',
  'bad-key': 'Google did not accept the key. Check it in settings.',
  'bad-model': 'Google does not know that model. Check the model name in settings.',
  'bad-request': 'Google could not process that request.',
  'rate-limit': 'Google says the limit has been reached for now. Using the local voice.',
  server: "Google's service is having trouble. Using the local voice.",
  network: 'Could not reach Google. Check your connection.',
  empty: 'Google sent back nothing to use.',
}

/**
 * A failure of a cloud request. `spoken` is a sentence a person can hear. It
 * is fixed text: nothing from the response, and never the key, is put in it.
 */
export class CloudError extends Error {
  readonly kind: CloudErrorKind
  readonly spoken: string

  constructor(kind: CloudErrorKind) {
    super(kind)
    this.name = 'CloudError'
    this.kind = kind
    this.spoken = SPOKEN[kind]
  }
}
