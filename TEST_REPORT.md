# Luna Daily v2.1.1 — Test report

Tested on 20 October 2026 in the build environment.

## Automated checks completed

- JavaScript syntax validation with Node.js.
- 21 core logic tests: the original 12, plus 9 regression tests for this release covering missed-day bridging, the gap limit between periods, upgrading entries saved without the period box, spotting staying opt-in, the setup placeholder and average period length, changing the period start in Settings, keeping real entries when the start changes, and version comparison.
- Static PWA audit (unchanged checks) passes.
- Headless Chromium smoke test at iPhone size: setup, header title, the period box ticking and unticking with bleeding choice, chip and dialog accessibility attributes, Escape to close, backup prepare-and-save flow with download fallback, and upgrading a stored 2.1.0 state (update notice shown, unticked heavy days counted). No console errors.

## Remaining real-device check

On the installed iPhone app after GitHub Pages updates: open the app and confirm the 2.1.1 notice appears and existing entries are intact; create a backup and confirm the share sheet opens and the file saves to Files; restore that backup; and log a day with heavy bleeding to confirm the period box ticks itself.
