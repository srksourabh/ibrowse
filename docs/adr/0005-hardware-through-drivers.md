# ADR-0005: Hardware connects through a published driver interface

Status: accepted

## Context
Desktop Chrome has no vibration API. No off-the-shelf mouse matches the original PRD hardware. Others should be able to add devices later.

## Decision
Audio is complete on its own. Haptics go through a typed `HapticDriver` interface with a fixed event vocabulary. v1 ships a Simulator Driver, a Gamepad driver and a WebHID driver, plus an open SDK. Web Serial and Web Bluetooth are later.

## Consequences
- Anyone can add a device without changing the extension.
- The Simulator Driver doubles as the demo and test driver.
