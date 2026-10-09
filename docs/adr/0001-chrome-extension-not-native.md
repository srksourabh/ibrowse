# ADR-0001: Build a Chrome extension, not a native Windows app

Status: accepted

## Context
The first PRD assumed a native Windows daemon using UI Automation and WASAPI. The product need is browsing websites. A native app cannot read page structure as well as the DOM, and it needs an installer and drivers.

## Decision
Ship a Manifest V3 extension (Chrome, also Edge and Brave).

## Consequences
- Gains: direct DOM and ARIA access, a store for distribution, no installer.
- Loses: anything outside the browser (taskbar, desktop apps), desktop `navigator.vibrate`, `chrome://` pages, the built-in PDF viewer.
- The old 12 ms hardware latency target moves to a future native build.
