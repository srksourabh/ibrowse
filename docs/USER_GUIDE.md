# iBrowse — Installation & User Guide (v0.2.0)

iBrowse is a Chrome (Manifest V3) extension that lets blind and low-vision people explore and operate any website by mouse, touch, keyboard, and voice.

---

## 1. Browser Compatibility

| Browser | Supported | How to Load (Unpacked) |
|---|---|---|
| **Google Chrome** (Desktop) | **Yes (Primary)** | `chrome://extensions` → Developer mode → **Load unpacked** |
| **Microsoft Edge** (Desktop) | **Yes** | `edge://extensions` → Developer mode → **Load unpacked** |
| **Brave** (Desktop) | **Yes** | `brave://extensions` → Developer mode → **Load unpacked** |
| **Other Chromium** (Arc, Vivaldi, Opera) | **Yes** (untested in CI) | Extensions page → Developer mode → **Load unpacked** |
| **Firefox / Safari** | **No** (out of scope in v1) | — |

---

## 2. Installing by Platform

### Windows
1. **Browser Extension (Recommended — full v0.2.0 MVP):**
   - **From a Release zip (no build tools needed):** Download `ibrowse-0.2.0-chrome.zip` from [GitHub Releases](https://github.com/srksourabh/ibrowse/releases/tag/v0.2.0) and unzip it to a permanent folder (for example `C:\iBrowse\`).
   - **Or build from source (Node 20+):**
     ```powershell
     git clone https://github.com/srksourabh/ibrowse.git
     cd ibrowse
     npm install
     npm run build
     ```
     The built extension is in `.output\chrome-mv3`.
   - Open Chrome, Edge, or Brave → go to `chrome://extensions` (or `edge://extensions`) → turn on **Developer mode** → click **Load unpacked** → select the unzipped folder (or `.output\chrome-mv3`).
2. **Windows Native Desktop Explorer (Early Preview — for non-browser Windows apps):**
   - Requires Windows 10+ and the **.NET 10 SDK** ([apps/windows/README.md](../apps/windows/README.md)):
     ```powershell
     cd apps/windows
     dotnet run --project IBrowse.Windows
     ```
   - Press **`Win+Alt+E`** to toggle desktop hover speech; quit from the system tray icon.

### Apple (macOS)
- Supported in **Google Chrome, Microsoft Edge, or Brave** on macOS (Safari is not supported).
- Download and unzip `ibrowse-0.2.0-chrome.zip` from [GitHub Releases](https://github.com/srksourabh/ibrowse/releases/tag/v0.2.0) (or build from source with `npm install && npm run build`).
- Open `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the folder.
- **VoiceOver users:** On first run, press **`Y`** when asked *"Do you use a screen reader?"* so iBrowse switches to **Companion mode** and speaks through VoiceOver instead of talking over it.

### Lab / Classroom / Shared Machines
- **Offline multi-machine setup:** Unzip `ibrowse-0.2.0-chrome.zip` to a fixed folder on each machine (e.g., `C:\iBrowse\` or `/opt/ibrowse/`). Node.js is not required on lab machines. Load it via **Load unpacked**, or launch Chrome with:
  ```
  chrome --load-extension="C:\iBrowse"
  ```
- **Enterprise policy (after Chrome Web Store listing):** Force-install via Chrome/Edge `ExtensionInstallForcelist` GPO/MDM using the Web Store extension ID.
- **Zero-install evaluation demo:** Run `npm run demo` on a host machine to serve the browser simulator at `http://localhost:3000`.
- **Privacy:** Runs 100% locally by default—no accounts, servers, or telemetry. Nothing leaves the machine unless a user explicitly enables a Google Gemini feature with their own API key.

### Mobile (iOS & Android)
- **iPhone / iPad (iOS):** Not yet supported. Mobile Safari and Chrome on iOS do not run Chrome MV3 extensions, and the native iOS app is currently plan-only ([apps/ios/README.md](../apps/ios/README.md)).
- **Android:** Standard Chrome for Android does not support Chrome extensions. For experimental testing only, Chromium browsers that support unpacked MV3 extensions (e.g., Kiwi or Mises Browser) can load `ibrowse-0.2.0-chrome.zip`, though mobile Android is not officially tested in v1.
- **Touchscreen Laptops / Tablets (Windows Surface, 2-in-1s, Chromebooks):** Fully supported in desktop Chrome/Edge. Drag a finger to explore and double-tap anywhere to activate.

---

## 3. First Run & Everyday Use

### First Run
When installed, a spoken page opens automatically and asks:
> **"Do you use a screen reader? Press Y for yes, N for no."**
- Press **`Y`** for **Companion mode** (routes speech to NVDA, JAWS, or VoiceOver so you hear one voice).
- Press **`N`** for **Standalone mode** (iBrowse speaks with its own voice).
- A 11-step spoken tour follows (`Enter` next, `Backspace` back, `R` repeat, `Esc` skip). You can replay it anytime from Settings.

### Keyboard, Mouse & Touch Shortcuts

| Action | Shortcut / Gesture |
|---|---|
| Turn **Explore Mode** on or off | **`Alt+I`** or toolbar button (`Ctrl+Alt+E` also turns it off) |
| Answer **"Want me to read it?"** | **`Y`** or **`Enter`** (read) / **`N`** or **`Esc`** (skip) |
| Read a paragraph | **Click** the paragraph |
| Scrub word by word | **Scroll wheel** over text (**`Shift+wheel`** spells the word) |
| Scroll the page | **`Alt+wheel`** |
| Next / previous page | **`Ctrl+Alt+Right`** / **`Left`**, side mouse buttons, or right-click menu |
| Next / previous heading | **`Ctrl+Alt+Down`** / **`Up`** |
| Next / previous landmark | **`Ctrl+Alt+PageDown`** / **`PageUp`** |
| Where am I (title, site, security, tab) | **`Ctrl+Alt+W`**, or move pointer to the top 6 px edge |
| Detailed briefing / read from here | **`Ctrl+Alt+B`** / **`Ctrl+Alt+R`** |
| Describe image / summarise page (AI) | **`Ctrl+Alt+D`** / **`Ctrl+Alt+M`** (requires Gemini key) |
| Open **Settings** (spoken, keyboard-only) | **`Alt+O`** (or **`Ctrl+Alt+S`** in Explore Mode) |
| Open **Hardware / Haptics Setup** | **`Ctrl+Alt+P`** (or from Settings) |
| **Push to talk** (voice commands on) | Hold **`Ctrl+Alt+V`**, speak, let go |
| Stop speech immediately | **`Esc`** |
| Touch: explore / activate | **Drag or tap** to explore / **double-tap anywhere** to activate |

*Tip: In-page shortcuts default to `Ctrl+Alt` (switchable to `Alt+Shift` in Settings), and every command can be remapped at `chrome://extensions/shortcuts`.*

### Voice Commands (Optional)
Enable **Voice commands** in Settings (`Alt+O`). Then either hold **`Ctrl+Alt+V`** or answer when iBrowse rests on an element and asks *"What would you like to do?"*:
- *"click"*, *"press it"*, *"click sign in"*, *"click add to basket"*
- *"scroll down"*, *"scroll up"*, *"go to the top"*, *"go to the bottom"*
- *"read this"*, *"read the page"*
- *"next page"*, *"previous page"*, *"go back"*, *"go forward"*
- *"what is on the left?"*, *"what is in the header?"*, *"go to the main content"*
- *"find the search box"*, *"where is the login?"*
- *"stop"*, *"repeat"*, *"where am I?"*, *"describe the page"*, *"help"*
- Any other spoken sentence is treated as a **question about the page** (answered by AI when enabled). Irreversible actions (buy, pay, send, delete, sign out) always ask for a spoken **"Yes"** first.

---

## 4. More Documentation
- [Full Feature List](FEATURES.md)
- [Interactive Presentation](https://srksourabh.github.io/ibrowse/presentation/) ([PDF](presentation/iBrowse-presentation.pdf))
- [Demo Video](media/ibrowse-demo.mp4)
- [Privacy Policy](../PRIVACY.md)
- [Haptics SDK](../sdk/README.md)
