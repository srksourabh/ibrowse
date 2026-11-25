# iBrowse Critical Remediation Report: Voice & Gemini Live Authentication

**Date:** November 25, 2026  
**Scope:** Remediation of **BUG-008** (Voice question suppression & end-of-turn handling) and **BUG-004** (Gemini Live ephemeral authentication)  
**Branch:** `main`  

---

## 1. BUG-008: Voice Assistant Premature Response & Question Suppression

### 1.1 Original Reported Issue
- Commit `faab8de` introduced `VoiceRunner.#lastQuestion`, which suppressed any question with identical text within a fixed `1,000 ms` window.
- Independent audit reproduced a Playwright E2E regression in `e2e/conversation.spec.ts:132:3`:
  1. User asks `"Is there free delivery?"` while `aiAssist` is `false`.
  2. User enables `aiAssist` (`true`).
  3. User immediately asks `"Is there free delivery?"` again within `1,000 ms`.
  4. `VoiceRunner` silently dropped the second question, so `"One moment."` was never spoken.
- Additionally, `ChromeRecognizer` used `interimResults = false` and `continuous = false`, causing Chrome's speech engine to terminate on brief pauses during multi-sentence or longer questions.

### 1.2 Independently Confirmed Root Cause
1. **Text+Time Suppression in `VoiceRunner`:** `VoiceRunner.run()` deduplicated based on transcript text and elapsed time (`< 1000 ms`) instead of recognition/session identity. Because `ListeningController` already resolves one promise per listening session, `VoiceRunner` only needed optional logical event-ID deduplication—not global suppression of identical user questions.
2. **Non-Continuous Recognition:** `ChromeRecognizer` set `interimResults = false` and `continuous = false`, preventing interim speech tokens from resetting `settleTimer` (`NATURAL_PAUSE_MS = 1000`) while the user was still speaking.

### 1.3 Original Behavior vs. New Implementation
- **Original:** `VoiceRunner` stored `#lastQuestion = { text, time }` and dropped matching questions `< 1000 ms`. `ChromeRecognizer` ran with `interimResults = false, continuous = false`.
- **New Implementation:**
  - `ListeningController` (`src/voice/listening.ts`) assigns a monotonic `session.id` to each listening session and passes it to `onHeard(text, session.id)`.
  - `session/voice.ts` forwards `eventId` to `runner.run(parseUtterance(text), eventId)`.
  - `VoiceRunner` (`src/voice/runner.ts`) replaces `#lastQuestion` with a bounded `#processedEvents` `Set<string | number>` (max 64 entries). Only duplicate deliveries of the *same* `eventId` are ignored; separate user actions, retries after failure/cancellation, and questions after settings changes are always processed.
  - `ChromeRecognizer` (`src/voice/chrome-recognizer.ts`) enables `interimResults = true` and `continuous = true`, clearing and resetting `settleTimer` (`NATURAL_PAUSE_MS = 1000`) on every interim or final speech token, and cleaning up all timers in `stop()` and `cancel()`.

### 1.4 Security & Functional Impact
- Fixes the `e2e/conversation.spec.ts:132:3` regression.
- Allows immediate repeated questions, retries after errors/cancellations, and multi-sentence questions with natural pauses.
- Trade-off: `ChromeRecognizer` still uses a `1000 ms` post-speech settle window (`NATURAL_PAUSE_MS`) when `continuous = true` because Chrome's Web Speech API does not expose a native end-of-turn confidence event; push-to-talk release (`stop()`) bypasses the wait immediately.

### 1.5 Files Changed & Tests
- **Files Changed:** `src/voice/runner.ts`, `src/voice/listening.ts`, `src/voice/chrome-recognizer.ts`, `src/session/voice.ts`, `tests/voice/runner.test.ts`, `tests/voice/listening.test.ts`, `tests/voice/chrome-recognizer.test.ts`
- **Tests Added/Updated:**
  - `tests/voice/runner.test.ts` (28 tests): identical questions across sessions, duplicate `eventId` suppression, immediate retry after failure/settings change.
  - `tests/voice/chrome-recognizer.test.ts` (25 tests): continuous interim mode, multi-sentence pauses, empty transcript handling.
  - `tests/voice/listening.test.ts` (15 tests): session `eventId` propagation.
- **Before / After Results:**
  - `e2e/conversation.spec.ts`: **17 passed, 1 failed** → **18 passed, 0 failed**.
- **Commit Hash:** `a276927`

---

## 2. BUG-004: Gemini Live Ephemeral Authentication

### 2.1 Original Reported Issue
- Commit `027296e` added `sanitizeWsUrl()` and an optional `getEphemeralToken` hook in `GeminiLiveClient`, but no production caller existed and `GeminiLiveClient` still fell back to transmitting the permanent Gemini API key in `?key=...` of the WebSocket URL.

### 2.2 Independently Confirmed Root Cause
- **Pure Client-Side BYOK Architecture:** Inspection of `src/background/cloud-host.ts`, `scripts/serve.mjs`, `Dockerfile`, and `railway.json` confirmed that iBrowse has **no trusted backend token-minting server** (`scripts/serve.mjs` only serves static docs/demo/zip assets).
- **Unsafe Fallback:** `GeminiLiveClient.#getAuthCredential()` fell back to `this.#deps.getKey()`, appending `?key=<PERMANENT_API_KEY>` to `BidiGenerateContent`.
- **Wrong Endpoint for Ephemeral Tokens:** Google's official Gemini Live ephemeral token contract (`v1alpha` `authTokens.create`) requires connecting to `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=auth_tokens/...`.

### 2.3 Original Behavior vs. New Implementation
- **Original:** `CloudHost` constructed `new GeminiLiveClient({ getKey: loadVaultKey })`, sending the permanent API key in the WebSocket query string.
- **New Implementation:**
  - Removed `getKey` from `GeminiLiveDeps` and removed the `?key=` fallback entirely from `GeminiLiveClient` (`src/cloud/gemini-live.ts`).
  - Updated `LIVE_WS_URL` to `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained`.
  - Enforced ephemeral token validation (`expiresAt > now + 30_000`) on connect and reconnect (`#tokenExpiresAt` tracked per connection). Missing, rejected, or expired tokens throw `CloudError('auth-failed')`—never falling back to `?key=`.
  - Added `createTokenServiceProvider()` (`src/cloud/gemini-live.ts`) implementing HTTPS-only token fetching with `AbortController` timeout, `Authorization` header support, and zero storage persistence.
  - Updated `CloudHost` (`src/background/cloud-host.ts`) to instantiate `new GeminiLiveClient({})`. Without a deployed token service, `withLiveVoiceFallback(liveVoice, client)` cleanly routes TTS to REST `GeminiClient.synthesize()`, which sends `x-goog-api-key` in an HTTPS header (never in a URL).

### 2.4 Production Authentication Architecture

```
+---------------------------+        POST /token (HTTPS + Auth)       +---------------------------+
|  iBrowse Extension (BG)   | --------------------------------------> |  Trusted Token Service    |
|  - GeminiLiveClient       |                                         |  (Not yet deployed)       |
|  - createTokenService...  | <-------------------------------------- |  - Holds GEMINI_API_KEY   |
|  - Memory-only token      |     { token: "auth_tokens/...",         |  - Calls v1alpha          |
|    (never persisted)      |       expiresAt: <epoch_ms> }           |    authTokens.create()    |
+---------------------------+                                         +---------------------------+
              |
              | WSS: BidiGenerateContentConstrained?access_token=auth_tokens/...
              v
+-------------------------------------------------------------------+
|  Google Gemini Live API (generativelanguage.googleapis.com)       |
+-------------------------------------------------------------------+

Fallback when no Trusted Token Service is configured:
  GeminiLiveClient throws CloudError('auth-failed')
    --> withLiveVoiceFallback() enters 30s cooldown (LIVE_COOLDOWN_MS)
    --> REST GeminiClient.synthesize() via HTTPS POST + x-goog-api-key header
```

- **Permanent server-side API key:** Never stored in or sent to WebSockets by the extension. (For BYOK REST TTS/AI, the user's vault key is sent only via `x-goog-api-key` HTTPS header in `GeminiClient`, never in URLs.)
- **Ephemeral session credential:** Minted server-side via `authTokens.create` (`uses: 1`, short `expire_time`, `live_connect_constraints`), held only in memory in `GeminiLiveClient`, never written to IndexedDB or `chrome.storage`.
- **Reconnection & expiration:** Before reusing `#socket`, `#connect()` checks `now < #tokenExpiresAt - 30_000`; expired sessions close and request a fresh ephemeral token.

### 2.5 Files Changed, Tests & Remaining Limitations
- **Files Changed:** `src/cloud/gemini-live.ts`, `src/background/cloud-host.ts`, `tests/cloud/gemini-live.test.ts`
- **Tests Added/Updated:** `tests/cloud/gemini-live.test.ts` (12 tests): `BidiGenerateContentConstrained` URL & `access_token`, no `?key=` fallback, expired token rejection & fresh token on reconnect, `createTokenServiceProvider` HTTPS enforcement/403/timeout handling, `sanitizeWsUrl`.
- **Remaining Limitations (Blocker for full Live WS):** iBrowse does not currently include a deployed backend token-minting server. Until a trusted backend service implementing `v1alpha` `authTokens.create` is deployed and wired to `createTokenServiceProvider`, `GeminiLiveClient` will decline to open WebSockets and `withLiveVoiceFallback` will route speech synthesis through REST `GeminiClient.synthesize()`.
- **Commit Hash:** `64b83c7`

---

## 3. Full Regression Verification Results

| Check | Command | Baseline | After Remediation |
|---|---|---|---|
| **TypeScript** | `npm run typecheck` | 0 errors | **0 errors** |
| **Unit Tests** | `npm test` | 83 files, 1,178 tests | **83 files, 1,186 tests passed** |
| **Coverage** | `vitest run --coverage` | 95.95% stmts, 91.22% branch, 97.34% funcs | **95.9% stmts, 91.31% branch, 97.35% funcs** |
| **Production Build** | `npm run build` | 241.08 kB | **Succeeded** |
| **Playwright E2E** | `npm run test:e2e` | 102 passed, 10 skipped, 1 failed | **103 passed, 10 skipped, 0 failed** |
| **Security Grep** | `git grep "?key=" -- src/ entrypoints/` | N/A | **0 matches** |
