# Security policy

iBrowse reads the pages a person visits and can, only if they opt in, send text and images to Google Gemini with their own key. We treat security and privacy reports seriously.

## Supported versions

| Version | Supported |
|---|---|
| 0.x (latest release) | Yes |
| Anything older | No |

## Reporting a vulnerability

**Do not open a public issue.** Use GitHub's private reporting: **Security → Report a vulnerability** on this repository. Include what you found, how to reproduce it, and the impact you expect.

You can expect:

- An acknowledgement within **3 working days**.
- An assessment and plan within **10 working days**.
- Credit in the release notes, unless you prefer to stay anonymous.

Please give us a reasonable time to fix a problem before you disclose it.

## What we most want to hear about

- Anything that sends page content, form values, passwords or the Gemini key anywhere without the user's opt-in.
- The key appearing in a log, an address, a spoken sentence, or code that runs in a web page.
- A web page being able to run extension code, change settings, or read the key.
- A hostile page steering the AI features (prompt injection that causes actions, not just odd wording).
- Haptic device profiles (JSON) that can run code or reach beyond the declared device.

## Design properties we promise

These are tested, so a regression is a bug we want reported:

- Nothing leaves the device unless the user turned a cloud feature on, entered a key, and granted the browser permission for `generativelanguage.googleapis.com`.
- The key is only used by the background worker and the settings page. A test fails if page-side code imports it.
- Form values and passwords are never collected for AI features.
- AI answers are spoken, never run.
- Third-party drivers cannot be loaded at run time; users add only JSON device profiles.

## Out of scope

Vulnerabilities in Chrome, in Google's services, or in a user's own machine; findings that need a malicious extension already installed; social engineering.
