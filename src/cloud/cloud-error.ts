/** Why a cloud request failed, in words a person can hear. No network code and no key, so pages may use it. */
export type CloudErrorKind =
  | 'no-key'
  | 'bad-key'
  | 'auth-failed'
  | 'api-disabled'
  | 'bad-model'
  | 'bad-request'
  | 'rate-limit'
  | 'quota-exceeded'
  | 'permission-required'
  | 'server'
  | 'network'
  | 'empty'
  | 'unknown'

export const CloudErrorCode = {
  NO_KEY: 'no-key',
  INVALID_API_KEY: 'bad-key',
  AUTHENTICATION_FAILED: 'auth-failed',
  API_NOT_ENABLED: 'api-disabled',
  MODEL_UNAVAILABLE: 'bad-model',
  INVALID_REQUEST: 'bad-request',
  RATE_LIMITED: 'rate-limit',
  QUOTA_EXCEEDED: 'quota-exceeded',
  PERMISSION_REQUIRED: 'permission-required',
  PROVIDER_UNAVAILABLE: 'server',
  NETWORK_ERROR: 'network',
  EMPTY_RESPONSE: 'empty',
  UNKNOWN_ERROR: 'unknown',
} as const

const SPOKEN: Readonly<Record<CloudErrorKind, string>> = {
  'no-key': 'No Google key has been entered. Add one in settings.',
  'bad-key': 'Google did not accept the key. Check it in settings.',
  'auth-failed': 'Google rejected the request due to key restrictions or authentication failure.',
  'api-disabled': 'The Generative Language API is not enabled for this Google key. Please enable it in the Google Cloud Console.',
  'bad-model': 'Google does not know that model. Check the model name in settings.',
  'bad-request': 'Google could not process that request.',
  'rate-limit': 'Google says the limit has been reached for now. Using the local voice.',
  'quota-exceeded': 'Google API quota or billing limit exceeded for this key.',
  'permission-required': 'Permission to contact Google was not granted.',
  server: "Google's service is having trouble. Using the local voice.",
  network: 'Could not reach Google. Check your connection.',
  empty: 'Google sent back nothing to use.',
  unknown: 'Could not check the key.',
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
    this.spoken = SPOKEN[kind] ?? SPOKEN.unknown
  }
}
