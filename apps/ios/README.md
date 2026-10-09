# iBrowse for iOS (plan only)

> **Status: plan. Not built.** Building and testing need a Mac with Xcode, which this project does not currently have. See [ADR-0015](../../docs/adr/0015-windows-and-ios-as-separate-products.md).

## Scope

iOS does not let one app read another, and VoiceOver already provides touch exploration across the system. The useful, honest scope is an **iBrowse web browser** for iPhone and iPad:

- a `WKWebView` browser with iBrowse's page briefing ("Picture on the left, hero section, 34 paragraphs. Want me to read it?");
- touch exploration with the same grammar, working *with* VoiceOver rather than against it (a Companion mode);
- **Core Haptics** feedback for the eight iBrowse events, so the phone itself is the haptic device;
- `AVSpeechSynthesizer` for speech, with optional Gemini voice using the user's own key;
- the same privacy rules: local by default, cloud opt-in.

## Open questions to settle before building

| Question | Why it matters |
|---|---|
| Does it add value over Safari with VoiceOver? | The briefing, the hover-style exploration and haptics are the differentiators. Test with blind iPhone users before committing. |
| How to avoid double speech with VoiceOver | Likely route through `UIAccessibility.post(notification: .announcement …)`. |
| Page analysis | Reuse the extension's TypeScript logic injected into the web view, or reimplement in Swift. Reuse is faster and keeps one set of rules. |
| Distribution | App Store review, an Apple Developer account, privacy nutrition labels. |

## Proposed structure

```
apps/ios/
  iBrowse/             SwiftUI app and WKWebView host
  iBrowseCore/         Swift package: grammar, placement, haptic event mapping
  iBrowseTests/
```

## Next step

When a Mac is available: create the Xcode project, inject the extension's content logic into `WKWebView`, and verify with VoiceOver on a real device before anything else.
