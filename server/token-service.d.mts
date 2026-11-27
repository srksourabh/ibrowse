import type { IncomingMessage, ServerResponse } from 'node:http'

export interface TokenServiceOptions {
  readonly env?: Record<string, string | undefined>
  readonly fetch?: typeof fetch
  readonly now?: () => number
  readonly apiKey?: string
  readonly enabled?: string
  readonly signingSecret?: string
  readonly model?: string
  readonly tokenTtlSec?: number
  readonly newSessionTtlSec?: number
  readonly registerLimitPerMin?: number
  readonly tokenLimitPerMin?: number
  readonly tokenDailyQuota?: number
  readonly globalLimitPerMin?: number
  readonly allowedOrigins?: string
}

export interface TokenService {
  readonly isEnabled: boolean
  readonly model: string
  health(): {
    readonly liveTokenService: boolean
    readonly checks: {
      readonly geminiApiKeyConfigured: boolean
      readonly signingSecretConfigured: boolean
    }
  }
  handle(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean>
}

export function createTokenService(options?: TokenServiceOptions): TokenService
