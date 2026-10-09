# iBrowse haptics SDK

Make your haptic device work with iBrowse. A blind person using iBrowse feels the page through your hardware: a click when the pointer reaches a button, a tick for each word, a thud at the end of a paragraph.

There are two ways in. Pick the first if you can.

| | You write | How it reaches users | Best for |
|---|---|---|---|
| **A. Device Profile** | A JSON file | Users import it themselves. **No change to iBrowse.** | USB HID devices where each effect is a fixed report |
| **B. Driver** | A TypeScript class | You contribute it to iBrowse (it is open source, MIT) | Anything else: serial, Bluetooth, a vendor library, effects that need computing |

Both sit behind the same event vocabulary, so users get the same feedback whichever you choose.

> **Why a driver has to be contributed.** Chrome extensions cannot load code from anywhere but their own package, so a driver you publish elsewhere cannot be plugged in at run time. A Device Profile is data, not code, which is why users can add one themselves. A driver goes into the extension through a pull request, which adds it to `src/haptics/factory.ts`.

## The events

iBrowse reports eight tactile moments. Your device may express all of them or only some; events it cannot express are skipped, not faked.

| Event | When | Reference waveform |
|---|---|---|
| `enter-interactive` | The pointer reaches a button, link or control | Dual pulse, 240 Hz, 20 ms then 15 ms |
| `enter-static` | The pointer reaches plain text | One gentle pulse, 150 Hz, 12 ms |
| `word-tick` | The wheel steps to the next word | Sharp tick, 280 Hz, 8 ms |
| `boundary` | The end or start of a block of text | Damped double thud, 90 Hz, 40 ms each |
| `edge-cross` | A screen edge, or a new block | Ramp 120 to 220 Hz, 30 ms |
| `action-confirm` | A control was pressed | One pulse, 180 Hz, 35 ms |
| `error` | An error, or a disabled control | Triple buzz, 110 Hz |
| `page-change` | Explore Mode on, or a new page | Rising double pulse |

The exact numbers are in `HAPTIC_EFFECTS`. They are references: a real device should do what feels right for those moments on its own hardware. iBrowse limits how often each event repeats (a cool-down) and scales everything by the user's intensity setting, so your driver does not have to.

## A. Describe your device as JSON

Write a **Device Profile**. The format is in [`device-profile.schema.json`](device-profile.schema.json), and a complete example is in [`examples/example-haptic-mouse.profile.json`](examples/example-haptic-mouse.profile.json).

```json
{
  "schema": 1,
  "id": "my-mouse",
  "name": "My haptic mouse",
  "match": { "vendorId": 4660, "productId": 22136 },
  "reportId": 2,
  "events": {
    "enter-interactive": [1, 16, 0],
    "boundary": [1, 19, 0]
  },
  "intensity": { "byteIndex": 2, "max": 255 }
}
```

- `match` says which attached device this is for. Give `usagePage` and `usage` too if the device has several interfaces.
- `events` holds the raw output report for each event you support, without the report id.
- `intensity` is optional. If given, that byte of every report is replaced by the user's intensity (0 to 1), scaled to 0 to `max`.
- `name` is spoken aloud, so make it something a person would say.

Check a profile in code with `validateDeviceProfile(json)`. It lists every problem, in plain words.

**For users:** press **Alt+Shift+P** to open hardware setup, paste the profile into the import box and press Enter on Import, choose it, then Pair a device. The browser's own device chooser appears; choose your device. The page speaks each step, so it works with the keyboard alone.

## B. Write a driver

Implement `HapticDriver`:

```ts
import type { HapticDriver } from '@ibrowse/haptics'

class MyDriver implements HapticDriver {
  readonly id = 'my-device'           // lower case, digits, dashes
  readonly name = 'My device'         // spoken aloud
  capabilities() { return { events: 'all' as const } }
  async connect() {
    return found ? { ok: true as const } : { ok: false as const, reason: 'My device is not plugged in.' }
  }
  async disconnect() { /* let go of the device */ }
  play(event, intensity) { /* intensity is 0 to 1; do not block, do not throw */ }
  onDisconnect(listener) { /* call listener() if the device goes away */ return () => { /* stop listening */ } }
}
```

The contract, in short:

- `connect()` never throws for a missing device. Return `{ ok: false, reason }`, where `reason` is **a sentence a person can hear**: it is spoken aloud.
- `play()` must not block, and must not throw for an event you do not support or an intensity outside 0 to 1. Clamp it.
- `onDisconnect()` returns a function that stops listening.
- Nothing may be assumed about the order of calls: `play` can come before `connect` and after `disconnect`, and must then do nothing.

A complete, working example, with a pluggable transport so it can be tested with no hardware, is in [`examples/example-driver.ts`](examples/example-driver.ts).

### Prove it follows the contract

```ts
import { runConformance } from '@ibrowse/haptics'

const report = await runConformance(new MyDriver(fakeTransport))
console.log(report.results)   // each check: pass, fail (with detail) or skip
expect(report.passed).toBe(true)
```

`runConformance` checks the driver's id and name, its declared events, that `connect` succeeds or explains why not, that every supported event plays at intensities 0, 0.5 and 1 without throwing, that an out-of-range intensity (negative, above 1, NaN, infinity) is survived, that playing after disconnect is safe, and that `onDisconnect` returns an unsubscribe function. If the driver cannot connect (no device), the playing checks are skipped, not failed, so you can run it in CI with a fake.

## Running in a browser extension

Where your driver runs matters:

- **In a web page**, a Gamepad or simulator-style driver works. Browsers expose controllers only to a focused, secure page after a button press.
- **WebHID** permission belongs to the origin that asked. iBrowse keeps HID devices in its background worker, so the user pairs once for every website.

Only Device Profiles can be added by users at run time. A driver ships inside the extension, so contribute it (see above). The `@ibrowse/haptics` name in the examples is what the SDK will be published as; until then, import from `src/haptics` in this repository.

## Versions

The profile format is `schema: 1`. A future format will use a new number, and iBrowse will keep reading schema 1 profiles. The event vocabulary only ever grows.

## Files

| File | What it is |
|---|---|
| [`device-profile.schema.json`](device-profile.schema.json) | JSON Schema for profiles |
| [`examples/example-haptic-mouse.profile.json`](examples/example-haptic-mouse.profile.json) | A complete profile with placeholder ids |
| [`examples/example-driver.ts`](examples/example-driver.ts) | A complete driver with a pluggable transport |

The code behind the public API is in `src/haptics/index.ts`.
