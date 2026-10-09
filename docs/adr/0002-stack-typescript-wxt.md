# ADR-0002: TypeScript, WXT, Vitest, Playwright

Status: accepted

## Context
We need a typed contract for the hardware SDK and a reliable way to test an extension in a real browser.

## Decision
Strict TypeScript, WXT on Vite for Manifest V3, Vitest for unit tests, Playwright with the extension loaded for end-to-end tests. The options page is plain semantic HTML, with no UI framework.

## Consequences
- A typed `HapticDriver` interface can be published as the SDK.
- A UI framework is not needed for a mostly spoken product.
