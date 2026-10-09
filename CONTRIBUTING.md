# Contributing to iBrowse

Thank you for helping. iBrowse is built for blind and low-vision people, so the most valuable contributions are real-world testing, bug reports and hardware profiles, as well as code.

Please read the [Code of Conduct](CODE_OF_CONDUCT.md) first.

## Ways to help

- **Test** with a screen reader, a touchscreen, a gamepad or a haptic device, and report what you hear and feel.
- **Report bugs** with the [bug form](../../issues/new?template=bug_report.yml).
- **Add a haptic device** with a JSON profile. No code is needed. See [sdk/README.md](sdk/README.md).
- **Improve the docs**, especially wording that is spoken aloud.
- **Write code** for an open issue.

## Set up

Requires Node 20 or newer.

```
npm install
npm run dev          # opens Chrome with the extension loaded
npm run typecheck
npm test             # unit tests with coverage
npm run build        # output in .output/chrome-mv3
npm run test:e2e     # needs a build first; drives a real Chromium
```

## How we work

The full rules are in [CLAUDE.md](CLAUDE.md). In short:

1. **Use the shared language.** Terms such as *Briefing*, *Affordance*, *Dwell* and *Explore Mode* are defined in [CONTEXT.md](CONTEXT.md). Use them in code, tests and spoken text.
2. **Test first.** Write a failing test, make it pass, then tidy. One behaviour at a time.
3. **Keep it small.** Functions under 50 lines, files under 400. Change only what the task needs.
4. **Record decisions.** A choice that is hard to reverse or surprising gets an [ADR](docs/adr).
5. **Speech changes need e2e proof.** A fix to speech timing or order is not done until it passes five consecutive `npm run test:e2e` runs. Passing once proves nothing.
6. **Privacy is a feature.** Nothing leaves the device without opt-in. Never log, speak or send passwords, form values or the Gemini key.
7. **Wording is part of the interface.** Spoken sentences are short and plain. Say what it is, then what you can do.

## Pull requests

- Branch from `main`; one change per pull request.
- Commit messages use `type: description` (`feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`).
- Fill in the pull request template. Tick only what you actually ran.
- CI must pass: typecheck, unit tests, build.
- Say what you could **not** verify (for example, no real device). That is welcome, not a failing.

## Adding a setting or a haptic profile

Both are driven by tables, so tests and the options page pick them up automatically. The [contributor skill](.claude/skills/ibrowse-contributor/SKILL.md) walks through each step and works for people as well as AI agents.

## Licence

By contributing you agree your work is released under the [MIT License](LICENSE).
