---
name: ibrowse-contributor
description: Work on the iBrowse repository (a Chrome extension that lets blind users explore and operate websites by sound, touch and haptics). Use when building, testing, fixing or extending iBrowse, adding a setting or a haptic device profile, changing spoken wording, or preparing a pull request. Teaches the project's language, test-first workflow, privacy rules and the e2e five-run rule.
---

# iBrowse contributor

iBrowse is a Manifest V3 Chrome extension (TypeScript, WXT, Vitest, Playwright) for blind and low-vision users. Spoken output is the interface, so wording, timing and privacy are product behaviour, not polish.

## Read first, in this order

1. `CLAUDE.md`: working rules (follow them exactly).
2. `CONTEXT.md`: the shared vocabulary. Use these words in code, tests and speech.
3. `docs/adr/`: why things are the way they are. Do not reverse one silently; write a new ADR.
4. `PRD.md`: requirements. `docs/phases/`: what each phase promised and what is still manual.

## Commands

```
npm install
npm run typecheck
npm test              # vitest with coverage; src/session and src/background are excluded (wiring only)
npm run build         # .output/chrome-mv3
npm run test:e2e      # real Chromium with the built extension; build first
npm run screenshots   # refresh docs/images from the built extension
```

Run the narrowest test while working (`npx vitest run tests/hover`), then the full set before finishing.

## Workflow: vertical slices, test first

1. State the behaviour in one sentence, in project vocabulary.
2. Write one failing test. Run it and watch it fail for the right reason.
3. Write the least code that passes. Run it.
4. Refactor with the tests green.
5. Repeat. Never write all the tests, then all the code.

Prefer deep modules with small interfaces. Keep `src/session/**` and `src/background/**` to wiring; put logic in a unit-tested module under `src/`.

Size limits: functions under 50 lines, files under 400. Change only what the task needs, and say what you chose not to do.

## Hard rules

- **Speech timing or order:** a fix is not done until `npm run test:e2e` passes **five consecutive times**. A single pass proves nothing; a race once passed one run and failed two of three.
- **Privacy:** nothing leaves the device without opt-in. Never log, speak or send passwords, form values or the Gemini key. Code that runs in a web page must not import `src/cloud/secrets` or the Gemini client (a test enforces this).
- **Untrusted text:** page text sent to AI goes only inside a fence, and answers are spoken, never run.
- **No voice input** (ADR-0008) and **no run-time third-party drivers** (MV3).
- **Never run against the real Gemini service** in tests. Use a fake `fetch`.
- **Explore Mode is opt-in and inert when off** (ADR-0003). Anything new must do nothing while it is off.
- **Wording:** short, plain, "what it is, then what you can do". Keep the grammar `[Label], [Role], Clickable` / `Text only`.

## Recipes

### Add a setting

1. Add the field to `Settings` and its default in `src/shared/settings.ts`, plus validation.
2. Add one entry to `SETTINGS_FIELDS` in `src/settings/schema.ts` (key, kind, group, label, one-sentence `help`, limits). The options page, the spoken confirmation and the tests are all driven by this table.
3. If turning it on sends data, add `confirmationFor` / `warningFor` text so the two-step consent speaks what will be sent.
4. Write the test in `tests/settings-schema.test.ts` first; add behaviour tests where the setting is used.
5. Add an e2e step in `e2e/settings.spec.ts` if it changes what is spoken.
6. Update the README, PRD section and `CHANGELOG.md`.

### Add a haptic device (no code)

1. Copy `sdk/examples/example-haptic-mouse.profile.json` and edit it to match the device's HID reports.
2. Validate against `sdk/device-profile.schema.json`.
3. Run the conformance suite (`src/haptics/conformance.ts`) through the hardware setup page (Alt+Shift+P) or the tests in `tests/haptics`.
4. Say honestly whether it was tried on the real device.

### Add a haptic driver (code)

Implement the `HapticDriver` interface in `src/haptics`, register it in `src/haptics/factory.ts`, and make it pass conformance. See `sdk/README.md` and `sdk/examples/example-driver.ts`.

### Change spoken text

Find the string through the vocabulary (`grep` for a distinctive phrase), update the test that pins it, then the code. Run the e2e specs that listen to speech.

## Done means

- Typecheck, unit tests and build pass; e2e passes (five runs if speech changed).
- Docs updated: README table, PRD, `CONTEXT.md` for new terms, an ADR for a new decision, `CHANGELOG.md`.
- Your report lists what you did **not** verify (real devices, real Gemini key, NVDA/VoiceOver, real touchscreen). Do not claim what was not run.
- Commit message format: `type: description` (feat, fix, refactor, docs, test, chore, perf, ci).
