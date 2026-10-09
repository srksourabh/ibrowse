# Privacy policy

*Applies to the iBrowse browser extension. Last updated 2026-10-09.*

**Short version: iBrowse runs on your device. It has no servers, no accounts and no analytics. It sends nothing anywhere unless you turn on a Google Gemini feature yourself.**

## What iBrowse reads

When Explore Mode is on, iBrowse reads the page you are looking at (text, links, buttons, images, form fields) so it can describe it to you. This happens inside your browser. When Explore Mode is off, iBrowse does nothing.

## What is stored

Stored only in your browser's extension storage, on your device:

- your settings;
- your Google Gemini key, if you enter one;
- whether the first-run tour has been shown.

We cannot see any of it. Removing the extension deletes it.

## What is sent, and when

| Feature | Sent | To | Only if |
|---|---|---|---|
| Local voice, exploring, reading, briefing | Nothing | Nowhere | Always |
| Cloud voice | The text being read | Google Gemini | You turned it on, gave a key, and allowed the permission |
| Page summary | Readable page text | Google Gemini | You turned AI on and pressed Alt+Shift+M |
| Image description | The one image under the pointer | Google Gemini | You turned AI on and pressed Alt+Shift+D |

Never sent: form field values, passwords, cookies, your browsing history, or anything while Explore Mode is off. Requests carry your key in a header, never in an address.

Google's handling of that data is governed by Google's terms and your own Gemini account. You can turn every cloud feature off at any time in settings, which also stops all transmission.

## Hardware

Haptic devices connect locally through WebHID or the Gamepad API. Device profiles are JSON files you choose. Nothing about your devices is transmitted.

## What we do not do

We do not run analytics or telemetry, use tracking, sell data, show ads, or build profiles. There is no account to create.

## Children

iBrowse collects no personal information from anyone, including children.

## Changes

Material changes will be listed in the [CHANGELOG](CHANGELOG.md) and will never turn a feature on by default.

## Contact

Raise an issue, or use the private reporting route in [SECURITY.md](SECURITY.md) for anything sensitive.
