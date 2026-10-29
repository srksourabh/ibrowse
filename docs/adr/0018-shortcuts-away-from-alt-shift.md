# ADR-0018: Shortcuts move away from Alt+Shift

Status: accepted, 2026-10-28. Changes the keys named in ADR-0009, ADR-0011 and ADR-0012.

## Context
Every iBrowse shortcut used Alt+Shift. On Windows, Left Alt+Shift is the default key for switching the input language, for example from English to Hindi or Bengali. Many users in India have two or more input languages, so a heading jump could switch their keyboard instead. Ctrl+Shift is the other Windows layout switch, so it has the same risk.

Chrome's commands API rejects any shortcut that holds Ctrl and Alt together, because on many layouts Ctrl+Alt is AltGr. It also allows at most four suggested keys.

## Decisions

### 1. Page shortcuts hold Control and Alt
While Explore Mode is on, the content script handles Ctrl+Alt plus the same keys as before: arrows for headings and pages, Page Up and Page Down for landmarks, W, B, R, D, M and V. Ctrl+Alt+E turns Explore Mode off, Ctrl+Alt+S opens settings and Ctrl+Alt+P opens hardware setup.

To keep AltGr typing working (Hindi Inscript, Bengali and most European layouts use it):
- A key press that reports AltGr is never a shortcut.
- While focus is in a text field, Ctrl+Alt plus a letter is left alone. Arrows and Page Up and Down still work there.

### 2. A setting keeps Alt+Shift for people who learned it
"Shortcut keys" offers Control and Alt, or Alt and Shift. A fresh install gets Control and Alt. An update from a version without the setting keeps Alt and Shift, so nobody's keys change under them without warning.

### 3. The global keys are Alt+I and Alt+O
Turning Explore Mode on must work while it is off, when nothing listens in the page (ADR-0003), so it has to be a browser command. Ctrl+Alt is not allowed there, so it is Alt+I ("I" for iBrowse). Settings is Alt+O ("O" for options). Hardware setup has no default key; it is opened from settings or with Ctrl+Alt+P.

### 4. Every page shortcut is also a browser command
Each one is listed, without a key, at chrome://extensions/shortcuts, so a person can give it any key Chrome allows. A command acts only while Explore Mode is on in that tab.

### 5. Spoken keys follow the setting
The tour, the settings page and spoken hints name the keys the user chose ("Control, Alt and D"), never the "+" form a voice reads as "plus".

## Consequences
- NVDA uses Ctrl+Alt+arrows to move around tables in browse mode. A screen reader takes the keys first, so in a table those keys do the screen reader's job. Users can switch to Alt and Shift or remap the commands.
- Some Intel graphics drivers rotate the screen on Ctrl+Alt+arrows. Most current drivers have this off.
- Alt+I and Alt+O have not been tried with every screen reader; the manual test script covers them.
- The language switch has not been tried on a real Windows machine with two input languages. That is in the manual test script.
