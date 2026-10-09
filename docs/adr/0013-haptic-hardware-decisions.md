# ADR-0013: How haptic hardware connects

Status: accepted. Builds on ADR-0005.

## Context
ADR-0005 decided that hardware attaches through drivers and that sound is complete on its own. Building it raised questions of where each driver can run, what is on by default, and how a blind user sets it up.

## Decisions

### 1. Each driver runs where its API exists
Checked in Chromium: `navigator.hid.getDevices` exists in the extension's service worker and `navigator.getGamepads` does not; a web page has both.
- **Gamepad and the simulator run in the page.** Controllers are only exposed to a focused, secure page, after a button press.
- **WebHID runs in the background worker.** Its permission belongs to an origin. In a page that is the website's origin, so the user would have to grant the device again on every site. In the worker it is the extension's origin: paired once, used everywhere. Pages reach it through a `RelayDriver` that sends messages.
- **Pairing happens on an extension page**, because `requestDevice` needs a user gesture in a document.

### 2. Sound only is the default; the simulator is opt-in
ADR-0005 called the simulator the default. But Earcons already make sound for every event, so a simulator on top would play two sounds for each. The default is now no driver, and the simulator is for evaluators and developers.

### 3. Haptics connect only while Explore Mode is on
Otherwise a user with a device chosen but unplugged would hear "No haptic device has been paired" on every page they open, with Explore Mode off. That would break ADR-0003. A small `HapticSwitch` connects the driver when Explore Mode turns on and lets it go when it turns off.

### 4. Every Earcon fires its Haptic Event
One bridge, rather than haptic calls scattered through the code. Sound and touch can never disagree, and a new place that plays an Earcon gets the haptic for free. The haptic is fired first, because the browser may refuse to start sound before the first click, and touch feedback should not depend on that.

### 5. The background worker reconnects on demand
Chrome stops an idle worker and starts it again. Nothing is assumed to still be connected: every effect connects first if it must, and many effects arriving together share one connection attempt. Without this, the first effect after a restart would fail and the manager would drop a healthy device.

### 6. A failure is said once, then sound carries on
A device that cannot connect, throws, or is unplugged is dropped, and one sentence explains it. Only the top frame speaks, so a page with iframes does not say it several times.

### 7. Two ways to add a device
- A **Device Profile** (JSON): the raw report bytes for each event, and which byte carries the intensity. No code needed. Profiles are validated strictly, with every problem listed in plain words, and unknown fields are rejected because they are usually typos.
- A **`HapticDriver`**: for devices that need code. A conformance harness checks it against the contract.

The profile format is `schema: 1`. A later format will use a new number, so old profiles keep working.

**Only profiles can be added by users.** Manifest V3 forbids loading code from outside the extension's package, so a third party's driver cannot be plugged in at run time. Drivers reach users by being contributed to the extension, which is open source. This is a real limit on "anyone can connect any hardware": it is true for devices a profile can describe, and needs a contribution for the rest.

### 8. Confirm and page change gained triggers
The PRD had haptic events for "action confirmed" and "page changed" but nothing in the product produced them. Activating a control now plays the confirm Earcon (and so its haptic), and turning Explore Mode on fires `page-change`.

## Consequences
- PRD §7 is corrected: the default driver, where each driver runs, pairing, and the SDK contents.
- The `hapticDriver` and `hapticProfileId` settings are new.
- No real device was available. The WebHID path is checked against the real API in Chromium up to "no device has been granted", and against fakes beyond that.
- Gamepad only works on https pages, and only once a button has been pressed.
- The SDK is in the repository. It is not published to npm yet.
