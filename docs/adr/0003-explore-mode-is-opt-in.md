# ADR-0003: Explore Mode is opt-in and otherwise inert

Status: accepted

## Context
Hijacking the wheel and touch input on every site would break normal browsing for everyone.

## Decision
Nothing is intercepted until Explore Mode is on. It is turned on by a hotkey, or by the setting "always start in Explore Mode".

## Consequences
- Normal scrolling is never affected for users who haven't enabled the setting.
- The user can still scroll the page in Explore Mode. The key for that is Alt + wheel, because Ctrl + wheel is the browser's zoom (see ADR-0011, which supersedes the earlier "Ctrl + wheel" wording here).
