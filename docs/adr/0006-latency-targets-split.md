# ADR-0006: Separate latency targets for the extension and a future native build

Status: accepted

## Context
`chrome.tts` and Web Audio cannot reach the original 45 ms speech-start target.

## Decision
Extension targets: earcon ≤ 30 ms, speech start ≤ 150 ms, interruption ≤ 20 ms. A built-in Latency Meter checks them on the user's machine. The original numbers remain native-build goals.

## Consequences
- Targets are achievable and testable.
- Interruption stays the strictest target, because it prevents speech pile-up.
