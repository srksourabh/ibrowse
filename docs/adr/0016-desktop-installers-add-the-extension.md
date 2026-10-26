# ADR-0016: Windows and Mac installers that add the extension, and a toolbar On/Off switch

Status: accepted. Not built yet: the installers need the Web Store listing first.

## Context
The user asked for Windows and Mac installers with an On/Off switch, acting only in the browser: describing what is there, and guiding the user by hover speech, click and screen reader. The extension already does all of that inside the browser. What a blind user lacks is an easy way to get it installed and a switch they can find. PRD §1.1 had dropped an installer ("distribution is the Chrome Web Store"). Three options were offered: an installer that adds the extension, a separate native desktop app, or only the switch. The user chose the first.

## Decisions

### 1. The installers add the Web Store extension. They contain no exploration code
- **Windows:** a small installer that writes `HKCU\Software\Google\Chrome\Extensions\<id>` and `HKCU\Software\Microsoft\Edge\Extensions\<id>`, each with `update_url` = `https://clients2.google.com/service/update2/crx`. Uninstalling removes those keys.
- **Mac:** a `.pkg` that writes `~/Library/Application Support/Google/Chrome/External Extensions/<id>.json` with the same update URL.
- The browser installs and updates the extension from the store itself, so there is one codebase and one place to release.
- The installer speaks what happens next: that the browser will ask to turn iBrowse on, which key or button confirms that, and that Alt+Shift+E switches Explore Mode on and off.

### 2. The extension gets a toolbar button that switches Explore Mode on and off
Clicking it does the same as Alt+Shift+E. Its title and badge show the state, so the switch can be found by a screen reader as well as by sight.

### 3. A native desktop app is not the route for the browser
Through operating system accessibility APIs a native app sees less of a page than the extension does: no page briefing, Read All or form feedback. ADR-0015's Windows explorer remains a separate product for apps outside the browser.

## Consequences
- The installers can only be built once the extension has a Web Store ID, which comes from the unlisted beta listing.
- To be checked on real machines: browsers add an externally installed extension switched off and ask the user to enable it. That prompt has to be reachable by keyboard and screen reader, and the installer must say what to expect.
- Windows needs a code-signing certificate, or SmartScreen warns about the installer.
- The Mac `.pkg` must be signed and notarised. That needs a Mac and an Apple Developer account, and this project has neither yet.
- PRD §1.1 no longer lists "Enterprise installer" as removed. These are consumer installers.
