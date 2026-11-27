# iBrowse Complete Pre-Merge Audit & Readiness Report

**Date:** November 27, 2026  
**Repository:** `UDS-PROJECTS/iBrowse/ibrowse` (`https://github.com/srksourabh/ibrowse.git`)  
**Current Branch:** `main` (ahead of `origin/main` by 21 implementation/remediation commits prior to this report; 0 behind)  
**Target PR Status:** Currently committed directly on local `main` *(see Section I for PR branch guidance)*  

---

## A. Executive Summary

A full-stack architectural, security, regression, and release-readiness audit was performed across all commits introduced after `origin/main` (`eba035a`), resulting in four additional permanent root-cause fixes (`0b8b14c`, `00298f4`, `2929527`, `a2cbb63`) and 100% passing automated TypeScript, unit, integration, backend, security, production-build, and Playwright E2E checks.

- **Extension & Backend Automated Health:** **1,200 / 1,200** Vitest tests pass (`87 / 87` files, `96.06%` statement coverage), `tsc --noEmit` reports **0 errors**, Chrome MV3 production bundle builds cleanly (`0` secrets or source maps leaked), and **103 / 103** executable Playwright E2E tests pass (`10` skipped conditional live/hardware/screen-reader specs).
- **External / Infrastructure Caveat:** Live Google API calls (`auth_tokens`, `BidiGenerateContentConstrained`, `v1beta/models`), deployed Railway runtime, and Windows `.NET 10` CI (`dotnet test` — `.NET SDK` not installed locally) remain unverified in this environment.
- **Release Verdict:**
  - **READY TO PUSH** *(to a feature/PR branch or authorized target)*
  - **CONDITIONALLY READY TO MERGE / DEPLOY** *(pending live Google API smoke test with real credentials + CI `windows-latest` .NET pass).*

---

## B. Commit Audit

All 21 commits introduced after baseline `eba035a` (`origin/main`):

| Commit | Purpose | Group | Status | Tests / Verification | Remaining Issues |
|---|---|---|---|---|---|
| `e7a48a7` | Repair CI/CD actions (`@v4`), pin TS `^5.7.3`, Dependabot ignores | Original Bug Fixes | Audited | Local `tsc`, `vitest`, `build` pass | GitHub Actions runner / Windows job await push |
| `d41bd55` | `NavigationCoordinator` for Explore Mode cross-page persistence | Original Bug Fixes | Audited | `navigation-coordinator.test.ts` (9) + `e2e` pass | Prevented SPA clicks rely on `onUpdated` not firing |
| `ab3b682` | Manual redirect loop + SSRF private IP checks in `fetchImage` | Original Bug Fixes | Audited | `image-fetch.test.ts` (44) pass | Browser JS `fetch()` cannot defeat DNS rebinding |
| `027296e` | Initial Live URL sanitization & optional token hook | Original Bug Fixes | Superseded by `64b83c7` | `gemini-live.test.ts` pass | Superseded safely |
| `d26e85e` | Anthropic host permissions & dual-provider AI key checks | Original Bug Fixes | Audited | `manifest.test.ts` (12), `editor.test.ts` pass | Live Claude key test unverified without key |
| `b7a0275` | Cached `IBrowse.Core.ScreenReaderDetector` (2s TTL) | Original Bug Fixes | Code Audited | `ScreenReaderDetectorTests.cs` written | **NOT VERIFIED** locally (no `.NET SDK`) |
| `f9bc8d7` | Bounded 32-entry LRU cache for procedural earcons | Original Bug Fixes | Audited | `earcons.test.ts` (9) pass | None |
| `faab8de` | Initial voice interruption threshold adjustment | Original Bug Fixes | Remediated by `a276927` | E2E regression fixed in `a276927` | None |
| `9c902de` | Candidate key check & granular Google error classification | Original Bug Fixes | Enhanced in `00298f4` | `gemini-client.test.ts`, `editor.test.ts` pass | Live Google API check requires user key |
| `ff43870` | Before/after documentation report for initial 9 fixes | Documentation | Audited | Accurate historical record | None |
| `a276927` | Event-ID deduplication (`VoiceRunner`) & `continuous` `ChromeRecognizer` | Voice Remediation | Audited | `e2e/conversation.spec.ts` (18), voice unit tests pass | Real microphone acoustics unverified in CI |
| `64b83c7` | Remove `?key=` WS fallback & target `BidiGenerateContentConstrained` | Security Remediation | Refined in `0b8b14c` | `gemini-live.test.ts` pass | Dead helper removed cleanly in `0b8b14c` |
| `0ed4287` | Voice & Gemini auth remediation report | Documentation | Audited | Verified | None |
| `13387f1` | Backend token-minting service (`/api/auth/device`, `/api/gemini/live-token`) | Gemini Live Backend | Hardened in `2929527` | `token-service.test.ts` pass | Requires Railway deployment + env vars |
| `ec3d03f` | Extension `DeviceAuth`, `CloudHost`, `liveTokenServiceUrl` UI | Gemini Live Extension | Refined in `0b8b14c` | `live-integration.test.ts` pass | Live Railway + Google WS unverified |
| `7bbffd7` | End-to-end local HTTP + WebCrypto integration tests | Gemini Live Tests | Updated in `0b8b14c` | `live-integration.test.ts` (3) pass | Uses mocked Google & fake WebSocket |
| `ad43bd9` | Gemini Live architecture & deployment doc | Documentation | Audited | Verified | None |
| `0b8b14c` | Propagate token `model` constraint to WS `setup`; remove dead `createTokenServiceProvider` | Pre-Merge Fix #1 | **VERIFIED** | `gemini-live.test.ts` (12), `live-integration.test.ts` (3) pass | Live WS handshake awaits deployment |
| `00298f4` | Classify 403 `PERMISSION_DENIED` without `details` as `auth-failed`; isolate IndexedDB/vault errors | Pre-Merge Fix #2 | **VERIFIED** | `gemini-client.test.ts` (33), `editor.test.ts` (36), `key-vault.test.ts` (1) pass | Live key test requires real key |
| `2929527` | Global rate limit, nonce cap, origin guard, `OPTIONS` CORS, safe `/health` flags | Pre-Merge Fix #3 | **VERIFIED** | `token-service.test.ts` (6) pass | Needs deployed env vars in Railway |
| `a2cbb63` | Clean up `maxMs` timeout in `recordMicrophone` on early stop/cancel | Pre-Merge Fix #4 | **VERIFIED** | `recorder.test.ts` (1) pass | Real microphone audio unverified in CI |

---

## C. What All Recent Commits Bring to iBrowse (Plain Language)

- **Reliability & Navigation:** Turning on Explore Mode now stays active smoothly when following links via mouse, touch, voice, or pagination buttons. Offscreen audio recording cleans up timers cleanly.
- **Better Voice Conversations:** Asking the same question twice (for example, right after turning AI assistance on, or retrying after an error) now works reliably. Continuous speech recognition waits naturally through brief pauses in multi-sentence questions.
- **Accurate AI Key Feedback:** Testing a Gemini API key in Settings tests what you just typed before saving, never overwrites your saved key on failure, and clearly tells you if the Generative Language API is disabled, restricted, out of quota, or invalid.
- **Security Hardening:** Private network redirects (`localhost`, cloud metadata IPs) are blocked when fetching images for AI descriptions. Permanent Gemini API keys are completely eliminated from Gemini Live WebSocket URLs.
- **Gemini Live Token Architecture:** A lightweight backend service (`server/token-service.mjs`) lets the extension register an asymmetric cryptographic device key and mint short-lived Google ephemeral tokens without embedding any server secret in the browser extension.
- **Performance & Memory:** Audio earcons use a bounded 32-item memory cache, and Windows screen-reader detection caches process lookups for 2 seconds instead of scanning OS processes 33 times per second.

---

## D. Gemini API Key Clarification

### 1. Extension BYOK Key vs. Backend Server Key
- **Extension Settings Gemini Key (BYOK — "Bring Your Own Key"):**
  - **Where it lives:** Stored locally on the user's computer inside the extension's own IndexedDB (`ibrowse-secrets`), completely inaccessible to websites/content scripts and never compiled into distributed extension bundles.
  - **What it powers:** REST Gemini calls directly from the extension's background worker (`GeminiClient`: page summaries, image descriptions, Q&A, voice transcription when `voiceInput === 'gemini'`, and REST TTS `GeminiClient.synthesize()`). Sent strictly via HTTPS header `x-goog-api-key`.
- **Backend `.env` `GEMINI_API_KEY`:**
  - **Where it lives:** Environment variable on the trusted Railway/Node server hosting `scripts/serve.mjs` (`server/token-service.mjs`). Never embedded in `wxt.config.ts` public builds, never returned to the extension, never placed in WebSockets.
  - **What it powers:** Server-to-Google `POST https://generativelanguage.googleapis.com/v1alpha/auth_tokens` calls that mint single-use, short-lived ephemeral credentials (`auth_tokens/...`) constrained to `GEMINI_LIVE_MODEL` for `BidiGenerateContentConstrained` WebSockets.

### 2. Can They Be the Same Key? Should Separate Keys Be Used?
- **Technically:** Yes, a single unrestricted AI Studio key *can* work in both places if it has Generative Language API access and works with both `v1beta` REST and `v1alpha/auth_tokens`.
- **Recommendation (Security Best Practice):** Use **two separate Google Cloud / AI Studio API keys**:
  1. **User BYOK key (Extension):** Has **no HTTP referrer restrictions** (because Chrome extension background/options origins are `chrome-extension://<id>` with no web `Referer`, which causes `"Requests from this referrer are blocked"` 403 errors if website referrer restrictions are set!), optionally restricted to **API restrictions → Generative Language API**.
  2. **Backend `GEMINI_API_KEY` (Railway):** Server-only key with independent quota/monitoring, ideally restricted to the Generative Language API and never shared with clients.

### 3. Why Extension Settings Previously Showed "Invalid Key" (Confirmed Root Causes)
1. **Before `9c902de`:** Clicking "Test key" ignored the text box and tested stale/empty IndexedDB storage; HTTP 403 errors (including Generative Language API disabled or HTTP referrer blocks on Chrome extensions) were unconditionally labeled `"Google did not accept the key"`.
2. **Confirmed in this audit (`00298f4`):** HTTP 403 responses with `status: "PERMISSION_DENIED"` and no `details[].reason` still fell through to `'bad-key'`, and storage write exceptions could leak into spoken errors. Both are now permanently fixed.

### 4. Configuration Matrix & Feature Independence

| Configuration | Where Configured | Purpose | Required? |
|---|---|---|---|
| **User Gemini API Key** | Extension Settings → Google key (IndexedDB) | Direct REST AI (`aiAssist`), REST TTS voice fallback, Gemini voice transcription | Optional (required for REST AI / REST TTS without Claude) |
| **User Anthropic API Key** | Extension Settings → Anthropic key (IndexedDB) | Claude Haiku fallback / AI descriptions & summaries | Optional |
| **Live Voice Token Server URL** | Extension Settings → Cloud voice & AI (`liveTokenServiceUrl`) | HTTPS URL of deployed `scripts/serve.mjs` backend for ephemeral Live WebSocket tokens | Optional (when empty, uses REST voice) |
| **Server `GEMINI_API_KEY`** | Railway / Docker server environment | Server-side minting via `v1alpha/auth_tokens` | Required on server if `GEMINI_LIVE_TOKEN_SERVICE_ENABLED=true` |
| **Server `IBROWSE_TOKEN_SIGNING_SECRET`** | Railway / Docker server environment | Stable HMAC-SHA256 key signing registered extension `deviceToken`s | Required for production deployment |

- **REST without Live backend?** Yes—if `liveTokenServiceUrl` is empty and User Gemini API Key is present, all REST AI, transcription, and REST TTS (`GeminiClient.synthesize()`) work independently.
- **Gemini Live without Extension Personal Key?** Yes—if `liveTokenServiceUrl` points to a deployed backend with server `GEMINI_API_KEY`, `GeminiLiveClient` connects via ephemeral `auth_tokens/...` without requiring a user-entered personal key in Settings (though REST fallback if the socket drops needs either a user key or Claude/local TTS).

---

## E. Gemini Live Architecture

1. Extension `DeviceAuth` (`src/cloud/device-auth.ts`) generates an ECDSA P-256 keypair via WebCrypto, registers its public JWK at `POST /api/auth/device` (IP rate-limited), and receives an HMAC-signed `deviceToken` (`deviceId` assigned by server).
2. Before opening/reconnecting `GeminiLiveClient`, `CloudHost` (`src/background/cloud-host.ts`) calls `deviceAuth.fetchLiveToken(settings.liveTokenServiceUrl)` which signs `Authorization`, `X-Device-Timestamp`, `X-Device-Nonce`, and `X-Device-Signature` to `POST /api/gemini/live-token`.
3. `server/token-service.mjs` verifies Origin (if configured), HMAC signature, ECDSA Proof-of-Possession, timestamp skew (`±60s`), bounded non-replay nonce (`50,000` cap), per-device limits (`20/min`, `200/day`), and global rate limit (`120/min`), then calls `POST https://generativelanguage.googleapis.com/v1alpha/auth_tokens` (`uses: 1`, `expireTime`, `newSessionExpireTime`, `liveConnectConstraints`).
4. Extension keeps `{ token, expiresAt, model }` in memory only (never stored in IndexedDB/`chrome.storage`), connects to `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=...`, sends `setup` using `token.model ?? DEFAULT_LIVE_MODEL`, decodes 24 kHz PCM responses, and falls back to REST TTS (`GeminiClient.synthesize`) on failure or missing token server.

---

## F. Issues Found and Fixed During This Pre-Merge Audit

1. **Constrained Model Mismatch & Dead Token Provider (`0b8b14c`):**
   - *Root cause:* `DeviceAuth` discarded `body.model` returned by `/api/gemini/live-token` and `GeminiLiveClient` ignored it in WebSocket `setup`, risking `liveConnectConstraints` rejection on Google; unused `createTokenServiceProvider()` remained dead code in `gemini-live.ts`.
   - *Fix:* Propagate `token.model` from `DeviceAuth` to `GeminiLiveClient` `setup.model`; remove dead `createTokenServiceProvider`. Tests added to `gemini-live.test.ts` and `live-integration.test.ts`.
2. **Gemini API Key `PERMISSION_DENIED` Misclassification & Vault Resilience (`00298f4`):**
   - *Root cause:* HTTP 403 `PERMISSION_DENIED` without `details[].reason` fell through to `'bad-key'`; `saveKey`/`saveAnthropicKey` spoke raw `Error.message` (risking leaking storage error text); `removeKey` lacked error handling and `moveKeyOut` could abort Options startup if IndexedDB failed.
   - *Fix:* Classify all `PERMISSION_DENIED` 403s as `'auth-failed'`; restrict spoken format messages in `secrets.ts`/`editor.ts` to `InvalidKeyError`; wrap vault startup migration and remove operations cleanly. Added `tests/cloud/key-vault.test.ts` + new regression tests in `gemini-client.test.ts` and `editor.test.ts`.
3. **Backend Global Abuse Protection, Bounded Nonce Cache, Origin Guard & Health Flags (`2929527`):**
   - *Root cause:* Multi-device botnets could bypass per-device limits; `seenNonces` lacked a hard size cap under burst load; `/api/*` lacked `OPTIONS` preflight / configurable origin filtering; `/health` didn't surface boolean `geminiApiKeyConfigured` / `signingSecretConfigured` flags.
   - *Fix:* Added `globalLimitPerMin`, `MAX_SEEN_NONCES = 50_000`, `IBROWSE_ALLOWED_ORIGINS` + `OPTIONS` preflight, and safe boolean `health()` checks. Tested in `token-service.test.ts`.
4. **Uncleaned Recording Timeout Timer (`a2cbb63`):**
   - *Root cause:* `recordMicrophone` in `entrypoints/offscreen/recorder.ts` left the `maxMs` `setTimeout` running after early `stop()`/`cancel()`.
   - *Fix:* Cleared timer on early completion and latched `end(false)` on expiry. Verified with new `tests/voice/recorder.test.ts`.

---

## G. Remaining Limitations & Verification Status

- **Verified:** All TypeScript compilation, mocked unit/backend/HTTP+WebCrypto integration tests, Chrome MV3 production bundle contents, manifest permissions, and local Playwright extension E2E (`103` offline extension tests).
- **Partially Verified / Requires External Deployment & Credentials:** Live Google API validation (`v1alpha/auth_tokens`, `BidiGenerateContentConstrained` WS audio, `v1beta/models`), Railway deployed HTTPS runtime, and live microphone acoustics.
- **Not Verified:** Windows native C# companion (`apps/windows/IBrowse.sln`) compilation and xUnit `ScreenReaderDetectorTests.cs` execution (no `.NET SDK` installed locally).

---

## H. Complete Verification Results

| Check | Command | Outcome | Actual Metrics |
|---|---|---|---|
| **TypeScript** | `npm run typecheck` | **PASSED** | `0` errors |
| **Unit, Backend & Integration Tests** | `npm test` (`vitest run --coverage`) | **PASSED** | **87 / 87** files, **1,200 / 1,200** tests passed (`96.06%` stmts, `90.7%` branches, `96.72%` funcs, `96.06%` lines) |
| **Chrome Production Build** | `npm run build` (`wxt build`) | **PASSED** | Built `.output/chrome-mv3` |
| **Bundle & Repo Secret Scan** | `Select-String` on `.output/chrome-mv3/` | **PASSED** | `0` secrets, `0` `?key=`, `0` `.map` source maps, `0` tracked `.env` files |
| **Playwright E2E** | `npm run test:e2e` | **PASSED** | **103 passed**, `10 skipped` (`e2e/live/` external/hardware specs), **0 failed** |
| **Windows .NET** | `dotnet --version` | **UNAVAILABLE** | `No .NET SDKs were found` locally; runs on CI `windows-latest` |

---

## I. Git Readiness

- **Current Branch:** `main`
- **Base Upstream:** `origin/main` at `eba035a` (`0` commits behind, `21` commits ahead before this doc commit → `22` after)
- **Working Tree:** Tracked files clean; two pre-existing audit reports (`docs/audits/IBROWSE_POST_FIX_VERIFICATION.md`, `docs/audits/IBROWSE_FINAL_REMEDIATION_VERIFICATION.md`) preserved untouched as untracked files.
- **PR Workflow Note:** Because work was committed directly onto local `main`, pushing to a PR branch requires creating a branch from `HEAD` before pushing (e.g., `git checkout -b fix/audit-and-gemini-live && git push -u origin fix/audit-and-gemini-live`)—do **not** force-push over `origin/main` if branch protection is enabled.

---

## J. Final Recommendation

- **READY TO PUSH:** **Yes** — push to a PR branch created from `HEAD`.
- **READY TO OPEN PR:** **Yes** — code, security scans, unit/backend tests, extension build, and Playwright E2E all pass with zero regressions.
- **READY TO MERGE TO PRODUCTION:** **Conditionally Ready** — merge once CI (`verify`, `e2e`, and `windows` `.NET 10` jobs) goes green on GitHub Actions, Railway env vars (`GEMINI_API_KEY`, `IBROWSE_TOKEN_SIGNING_SECRET`) are configured, and one smoke test confirms Google `v1alpha/auth_tokens` + live `BidiGenerateContentConstrained` WebSocket audio works with a real Google key.
