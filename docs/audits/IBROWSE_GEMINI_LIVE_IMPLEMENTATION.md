# iBrowse Gemini Live Production Integration

**Date:** November 25, 2026  
**Branch:** `main`  
**Status:** **PARTIALLY IMPLEMENTED** *(Backend + extension + mocked/local-HTTP integration verified; live Google `auth_tokens` + `BidiGenerateContentConstrained` WebSocket unverified locally due to missing live Google API credentials and un-deployed server).*

---

## 1. Original Problem & Architecture
- Previously, `CloudHost` (`src/background/cloud-host.ts`) initialized `new GeminiLiveClient({})` without any ephemeral token provider, and there was no backend token-minting service in the repository (`scripts/serve.mjs` was strictly a static file server).
- As a result, `GeminiLiveClient` refused to connect and every cloud speech request fell back to REST TTS.

## 2. New Architecture

```
+-----------------------------+      1. POST /api/auth/device (ECDSA P-256 JWK)     +-------------------------------+
|  Chrome Extension           | -------------------------------------------------> |  iBrowse Token Backend        |
|  (src/background/           | <------------------------------------------------- |  (server/token-service.mjs    |
|   cloud-host.ts +           |      2. { deviceId, HMAC-signed deviceToken }      |   via scripts/serve.mjs)      |
|   src/cloud/device-auth.ts) |                                                    |                               |
|                             |      3. POST /api/gemini/live-token                |  - Verifies HMAC + ECDSA PoP  |
|  - Memory-only live token   |         Bearer + Timestamp + Nonce + ECDSA Sig     |  - Rate limit (20/min, 200/d) |
|  - Never stores live token  | -------------------------------------------------> |  - Holds GEMINI_API_KEY       |
|  - Never sends ?key= on WS  | <------------------------------------------------- |                               |
+-----------------------------+      4. { token: "auth_tokens/...", expiresAt }    +---------------+---------------+
              |                                                                                    |
              | 5. WSS BidiGenerateContentConstrained                                              | 3b. POST /v1alpha/auth_tokens
              |    ?access_token=auth_tokens/...                                                   |     x-goog-api-key: GEMINI_API_KEY
              v                                                                                    v
+--------------------------------------------------------------------------------------------------+
|                            Google Gemini API (generativelanguage.googleapis.com)                 |
+--------------------------------------------------------------------------------------------------+
```

## 3. Backend Implementation & Authentication Mechanism
- **Module:** `server/token-service.mjs` (typed via `server/token-service.d.mts`), mounted on `scripts/serve.mjs` at `/api/auth/device` and `/api/gemini/live-token` (with `liveTokenService` status exposed on `GET /health`).
- **Device Authentication (No Hardcoded Shared Secret):**
  - iBrowse has no user account/OAuth login system. On first use, `DeviceAuth` generates an ECDSA P-256 keypair via WebCrypto (`crypto.subtle`) and registers its public JWK at `POST /api/auth/device` (rate-limited at `10/min` per IP).
  - The server issues a server-generated `deviceId` (`randomUUID()`) inside an HMAC-SHA256-signed `deviceToken` (`IBROWSE_TOKEN_SIGNING_SECRET`) binding the public JWK.
  - Every `POST /api/gemini/live-token` request requires `Authorization: Bearer <deviceToken>` plus Proof-of-Possession headers (`X-Device-Timestamp` within ±60s, single-use replay-protected `X-Device-Nonce`, and `X-Device-Signature` over `${deviceToken}.${ts}.${nonce}`).
  - **Trade-off:** Device registration is open to unauthenticated extension installs on first run, mitigated by per-IP registration limits, per-device rate limits (`20/min`), and per-device daily quotas (`200/day`).
- **Google API Contract (`POST https://generativelanguage.googleapis.com/v1alpha/auth_tokens`):**
  - Header: `x-goog-api-key: GEMINI_API_KEY` (server-side only).
  - Request body: `{ uses: 1, expireTime, newSessionExpireTime, liveConnectConstraints: { model, config: { responseModalities: ['AUDIO'] } } }`.
  - Response mapped to `{ token: data.name, expiresAt, model }`; upstream Google error details and API keys are never exposed to clients.

## 4. Extension Integration, Token & WebSocket Lifecycle
- **Settings & UI:** `liveTokenServiceUrl` added to `Settings` (`src/shared/settings.ts`), `SETTINGS_FIELDS` (`src/settings/schema.ts`), and `#live-status` in `entrypoints/options/index.html` + `entrypoints/options/main.ts` (clearly showing whether a token server is configured or REST voice fallback is active).
- **Token & WebSocket Lifecycle:**
  - `CloudHost` (`src/background/cloud-host.ts`) instantiates `DeviceAuth` and passes `getEphemeralToken` to `GeminiLiveClient`.
  - `GeminiLiveClient` (`src/cloud/gemini-live.ts`) connects exclusively to `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=...` and tracks `#tokenExpiresAt` with a 30s refresh buffer.
  - Ephemeral tokens live in memory only and are never written to IndexedDB or `chrome.storage`.
  - **Audio Streaming & Fallback:** PCM 24kHz audio chunks are decoded via `pcm16ToWavBase64` and routed through `CloudVoiceService` / iBrowse spatial audio. If `liveTokenServiceUrl` is empty or the token server is unavailable, `withLiveVoiceFallback` enters a 30s cooldown and falls back to REST `GeminiClient.synthesize()` (`x-goog-api-key` header).

## 5. Security Verification
- `git grep "?key=" -- src/ entrypoints/ server/`: **0 matches**.
- `git grep "GEMINI_API_KEY" -- src/ entrypoints/`: **0 matches**.
- `Select-String` scan of `.output/chrome-mv3/*.js` and `.output/chrome-mv3/chunks/*.js`: **0 matches** for `IBROWSE_TOKEN_SIGNING_SECRET`, `auth_tokens/`, `?key=`, or `GEMINI_API_KEY`.

## 6. Deployment Requirements (`Dockerfile` & `railway.json`)
Existing `Dockerfile` (`CMD ["npm", "start"]`) and `railway.json` (`"startCommand": "npm start"`, `"healthcheckPath": "/health"`) already launch `scripts/serve.mjs` over HTTPS on Railway. Set these server-side environment variables before deploying:
- `GEMINI_API_KEY`: Google Gemini API key (server-side only).
- `IBROWSE_TOKEN_SIGNING_SECRET`: Random 32+ byte hex secret for signing device tokens.
- `GEMINI_LIVE_MODEL`: e.g. `models/gemini-2.5-flash-native-audio-preview-12-2025`.
- `GEMINI_LIVE_TOKEN_TTL=600`, `GEMINI_LIVE_NEW_SESSION_TTL=120`, `GEMINI_LIVE_TOKEN_SERVICE_ENABLED=true`.
- **Rollback:** Set `GEMINI_LIVE_TOKEN_SERVICE_ENABLED=false` (returns `503`, causing extension to cleanly use REST TTS fallback without redeploying).

## 7. Files Changed, Tests & Results
- **Commits:**
  - `13387f1` — `feat(backend): add authenticated Gemini Live token service` (`server/token-service.mjs`, `scripts/serve.mjs`, `.env.example`, `tests/server/token-service.test.ts`)
  - `ec3d03f` — `feat(gemini): connect extension to ephemeral token backend` (`src/cloud/device-auth.ts`, `src/background/cloud-host.ts`, `src/shared/settings.ts`, `src/settings/schema.ts`, `entrypoints/options/index.html`, `entrypoints/options/main.ts`, `server/token-service.d.mts`)
  - `7bbffd7` — `test(gemini): add Live authentication integration coverage` (`tests/cloud/live-integration.test.ts`)
- **Test Results:**
  - `npm run typecheck`: **0 errors**
  - `npm test` (`vitest run --coverage`): **85 / 85** files, **1,194 / 1,194** passed (`95.6%` stmts, `90.67%` branches, `97.39%` funcs, `95.6%` lines)
  - `npm run build`: **Succeeded** (`.output/chrome-mv3`)
  - `npm run test:e2e`: **103 passed, 10 skipped, 0 failed**

## 8. Remaining Limitations
- Live Google `POST /v1alpha/auth_tokens` and live `BidiGenerateContentConstrained` WebSocket audio streaming were tested against a real local Node HTTP server + real WebCrypto ECDSA P-256 + mocked Google API / fake WebSocket (`tests/cloud/live-integration.test.ts`), **not** against live Google servers (no live `GEMINI_API_KEY` or deployed Railway URL in this environment).
