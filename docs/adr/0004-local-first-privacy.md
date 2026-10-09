# ADR-0004: Local by default; cloud features are opt-in, bring-your-own-key

Status: accepted

## Context
The extension needs access to every site. Users trust it with what they browse.

## Decision
Page analysis, briefing, reading and local OS voices run on the device. Optional cloud voice and AI enrichment use the user's own key, with one provider in v1, and a spoken warning when enabled. The project runs no server.

## Consequences
- Simple Web Store review and privacy policy.
- No billing or hosting for the project.
- Cloud features are limited to what a user's own key allows.
