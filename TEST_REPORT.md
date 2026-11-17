# Luna Daily v3.0.0 — Test report

Tested on 17 November 2026 in the build environment.

## Automated checks completed

- JavaScript syntax validation with Node.js.
- 30 core logic tests: the 21 from 2.1.1, plus 9 new tests covering the fertile window looking ahead once passed, three-cycle period projections, calendar fertile shading following the setting, ring segments, the first-cycle celebration for new and upgrading users, the weekly backup snooze, and sentence-case labels.
- Static PWA audit passes.
- Headless Chromium at iPhone size, dark and light themes: setup, Today layout with the cycle card first, compact reminders, the daily log (switch turning on for heavy bleeding, More details closed by default, Save always visible), the first-cycle celebration appearing once only, calendar swipe and Back to today, tapping an Insights cycle to open its month, backup prepare-and-save, Escape closing pop-ups, and upgrading stored 2.1.1 data. No console errors.

## Remaining real-device check

On the installed iPhone app after GitHub Pages updates: confirm the 3.0.0 notice appears and entries are intact; swipe between calendar months; check the haptic tap when saving an entry (iOS 18 or later); and make and save a backup.
