# WPT accname fixtures

Copied unchanged from [web-platform-tests](https://github.com/web-platform-tests/wpt) `accname/name/`, commit `68d964a5f292bc4b2c2eba2f21e2b916190b6ad2` (2026-10-25), under the 3-clause BSD licence in `LICENSE.md`.

`e2e/accname.spec.ts` loads each file in Chromium without its scripts and checks every element's `data-expectedlabel` against iBrowse's `describeElement`. To update: download the same files from a newer commit, run `npm run test:e2e -- accname`, and adjust the known-differences list.
