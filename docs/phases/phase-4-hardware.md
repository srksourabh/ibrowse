# Phase 4 — Hardware

Goal: anyone can connect haptic hardware to iBrowse without changing the extension. Sound alone stays complete and is the default.

Source: PRD §7. Decisions: ADR-0005, ADR-0013.

## Where each piece runs (checked in Chromium)
| Piece | Runs in | Why |
|---|---|---|
| Simulator and Gamepad drivers | content script | `navigator.getGamepads` exists only in a page, and only while it is focused |
| WebHID driver | background worker | `navigator.hid.getDevices` exists there; the grant is per origin, so it is made once for the extension, not once per website |
| Pairing | an extension page, opened with Alt+Shift+P | `requestDevice` needs a user gesture in a document |

## Slices (each is red, green, refactor)

| # | Slice | Done when |
|---|---|---|
| 4.1 | **Event vocabulary and effects** — the eight Haptic Events and their waveforms from PRD §7.3, with cool-downs | Tests pin every effect |
| 4.2 | **`HapticDriver` interface and `HapticManager`** — intensity, cool-down, failure and disconnect handling | Tests with fake drivers |
| 4.3 | **Simulator driver** — renders the waveform as low sound; observers for visuals | Tests with a fake audio context |
| 4.4 | **Gamepad driver** — turns an effect into dual-rumble steps | Tests with a fake actuator |
| 4.5 | **Device profiles** — JSON schema, validator, encoder, stored profiles | Tests |
| 4.6 | **HID driver** — opens a paired device and sends the profile's reports | Tests with a fake HID API |
| 4.7 | **Relay driver** — content script to background, for WebHID | Tests |
| 4.8 | **Conformance harness** — what a third-party driver runs to prove it follows the contract | Passes a good fake, fails a bad one by name |
| 4.9 | **Earcon bridge** — each Earcon also fires its Haptic Event, plus "action confirm" and "page change" | Tests |
| 4.10 | **Pairing controller and pairing page** — keyboard and speech only | Tests, then end-to-end |
| 4.11 | **Settings and wiring** — `hapticDriver`, `hapticProfileId`; drivers swapped when settings change | End-to-end |
| 4.12 | **SDK** — public barrel, event spec, profile schema, example driver and profile, README | Example driver passes conformance |

## Out of scope
A real device (none exists to test against), publishing the SDK to npm (Phase 7), Web Serial and Bluetooth drivers, a settings UI beyond the pairing page (Phase 5).

## Exit checklist
- [x] Typecheck, tests, build green; coverage ≥ 80% (99.0% lines, 92.2% branches, 517 unit tests)
- [x] End-to-end (42 tests, passing five runs in a row): the pairing page by keyboard alone, the driver choice saved and spoken, a pasted profile imported or rejected, a missing device reported aloud with sound carrying on, the real WebHID API asked from the worker, and complete quiet while Explore Mode is off
- [x] The example driver passes the conformance harness, and the example profile validates
- [x] Docs updated (ADR-0013, PRD §7, SDK README, `CONTEXT.md`, `CLAUDE.md` layout, README)
- [ ] **Manual:** a real game controller rumbles on hover and wheel (https page, after pressing a button on it)
- [ ] **Manual:** a real HID device receives the profile's reports, and unplugging it is announced
- [ ] **Manual:** the browser's own device chooser appears on Pair a device, and choosing a device is announced
- [ ] **Manual:** the sound simulator is audible once the page has had a click or key press

## Findings
- **Where each API exists was checked, not assumed.** `navigator.hid.getDevices` exists in the extension worker and `navigator.getGamepads` does not. That decided the design (ADR-0013 #1).
- **A design flaw caught while planning the end-to-end tests:** connecting the driver at page load would have spoken "No haptic device has been paired" on every page with Explore Mode off, which breaks ADR-0003. A small `HapticSwitch` now connects it only while Explore Mode is on, with an end-to-end test that the page is silent otherwise.
- **ADR-0005 changed:** the default is sound only, not the simulator, because the Earcons already make sound.
- **A real limit on "anyone can connect any hardware":** only Device Profiles can be added by users. Manifest V3 cannot load a third party's code, so a driver has to be contributed to the open-source extension. The SDK README says so on its first screen.
- **Not exercised end to end:** the browser's device chooser (it needs a visible window and a real device), a Chrome-restarted worker (the reconnect-on-demand logic is unit tested), and anything that needs a real controller or HID device.
- **`src/background` and `src/session` are excluded from coverage** and covered only by the end-to-end suite. Keep decisions out of them.
- The SDK is in the repository but not yet published to npm (Phase 7).
