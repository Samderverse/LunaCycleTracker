# Changelog

## 2.1.1

- Light, medium and heavy bleeding now tick "Count this as part of a period" automatically; spotting stays opt-in. Existing entries saved without the box are counted on upgrade.
- Up to two unlogged days inside a period are bridged, so a missed entry no longer splits one period into two.
- The one-day placeholder created at setup no longer drags the average period length towards one day.
- The calendar's predicted period now uses your learned average period length.
- Changing "Most recent known period start" in Settings now updates predictions.
- The app refreshes the date, cycle day and reminders when reopened on a new day.
- Backups are prepared first, then saved through the share sheet (Files, iCloud Drive), with a download fallback. The last-backup date is no longer recorded if the share is cancelled.
- Dialogs can be closed with Escape, are labelled for screen readers and return focus when closed; choice chips announce whether they are selected.
- The service worker bypasses the browser cache when installing a new version.
- Fixed the header still saying "Welcome" after setup, and removed a CSP directive that browsers ignore in a meta tag.

## 2.1.0

- Added private smart in-app reminders shown when Luna Daily is opened.
- Added daily check-in reminder when today has no entry.
- Added period-due-soon reminder based on the current predicted range.
- Added optional fertile-window reminder when fertile estimates are enabled.
- Added encrypted-backup reminders.
- Added end-of-cycle summary cards.
- Added recurring pre-period symptom pattern insights after enough history exists.
- Added an app-update notice for existing installations.
- Added reminder controls in Settings.

## 2.0.0

- Complete private PWA rebuild with local storage, logging, calendar, predictions, insights and encrypted backups.
