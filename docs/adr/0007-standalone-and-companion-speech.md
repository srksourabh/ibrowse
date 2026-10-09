# ADR-0007: Standalone speech by default, Companion mode optional

Status: accepted

## Context
Most blind users already run a screen reader. Two voices at once is unusable.

## Decision
Default is Standalone: iBrowse speaks with its own voice and the user pauses the screen reader's browse mode while exploring. Companion mode sends announcements to a hidden live region so the screen reader speaks them.

## Consequences
- Spatial panning and fast interruption work only in Standalone.
- Onboarding must explain the choice aloud.
