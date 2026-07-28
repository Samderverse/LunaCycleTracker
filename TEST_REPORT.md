# Luna Daily v2.1.0 — Test report

Tested on 28 July 2026 in the build environment.

## Automated checks completed

- JavaScript syntax validation with Node.js.
- 12 core logic tests covering date arithmetic, leap years, cycle prediction, period grouping, spotting handling, prediction ranges, settings clamping, daily check-in reminders, backup reminders, fertile-window reminder controls, and dismissal persistence.
- Static PWA audit covering iPhone viewport metadata, standalone mode, safe-area handling, reduced motion, IndexedDB, persistent storage, encrypted backups, service-worker registration, manifest paths, icons, cached assets, and absence of third-party runtime URLs.
- Service-worker cache version updated to `luna-daily-v2.1.0` so existing installations can retrieve the new build.

## Reminder behaviour reviewed

- Reminders are rendered only inside the app when it is opened.
- No notification permission or external push service is used.
- Daily check-in reminders disappear after a log is saved or are snoozed for the day.
- Period reminders are tied to the current prediction date.
- Fertile-window reminders appear only when the optional fertility estimate is enabled.
- Backup reminders can be deferred for one week.
- Cycle summaries are shown once for a newly completed cycle.
- Symptom insights require the same pre-period symptom across at least three cycles.
- Existing v2.0.0 users receive a one-time update notice after migration.

## Remaining real-device check

A final smoke test should be completed on the installed iPhone PWA after GitHub Pages updates: open and close the app, save a log, dismiss a reminder, reopen the app, and confirm existing data remains intact. This environment cannot physically operate the user's iPhone.
