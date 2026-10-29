# ADR-0019: The first question is "Do you use a screen reader?"

Status: accepted, 2026-10-28. Changes ADR-0014 §8.

## Context
iBrowse starts in Standalone mode. Someone who already uses a screen reader hears two voices from the first moment: theirs and iBrowse's. On install the background worker also said "Welcome to iBrowse. A short tour is opening now." in its own voice, on top of the screen reader reading the new tab.

A web page cannot tell whether a screen reader is running. Only ChromeVox can be detected, and only with an extra permission.

## Decisions

### 1. The tour page asks before anything else
On first run the tour page asks "Do you use a screen reader? Press Y for yes, N for no." The tour starts after the answer. Y and N are read by physical key, so they work on any keyboard layout. There are also two buttons for mouse and touch.

### 2. The question is written first and spoken second
The question goes into a live region at once, so a screen reader reads it with the page. iBrowse says it in its own voice 1.5 seconds later, for someone with no screen reader. If the user answers first, iBrowse never says it.

### 3. The answer sets Screen reader mode and is asked once
Y chooses Companion, N chooses Standalone. Either way iBrowse says how to change it in settings, and remembers that the question was answered. A replayed tour does not ask again.

### 4. The install hook stays silent
The background worker no longer speaks a welcome when it opens the tour. The question is the first thing iBrowse says.

### 5. The thank-you is heard in full
The tour starts only once the thank-you has finished. In Companion mode the thank-you goes into its own live region, so the tour's first step cannot replace it before it is read.

### 6. No detection for now
Nothing is detected, so the question is always spoken after the delay. The code takes a detection hint, so ChromeVox detection can be added later without changing the question.

## Consequences
- A person who installs and walks away hears nothing until the tour tab gets focus and the delay passes. Before, they heard the welcome at once.
- An update does not open the tour, so updating users are not asked unless they replay it from settings. Then they are asked once.
- The separate live region has not been tried with NVDA or JAWS. It needs a manual check.
