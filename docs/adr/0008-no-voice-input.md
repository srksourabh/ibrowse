# ADR-0008: No voice input in v1

Status: superseded by [ADR-0017](0017-voice-conversation.md) on 2026-10-25

## Context
Chrome's speech recognition sends audio to Google, needs microphone access, and hears the extension's own speech.

## Decision
Prompts and navigation use clicks, keys and gestures only.

## Consequences
- Works offline and in noisy rooms, with no microphone permission.
- Revisit only with an on-device recognizer.
