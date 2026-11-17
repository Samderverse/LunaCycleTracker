# Changelog

## 3.0.0

**Today**
- Your cycle card now comes first, with a "Period due soon" or "days past estimate" tag. Reminders sit underneath it as compact one-line cards with a single button.
- The cycle ring is sized to your own period length and estimated ovulation, and shows "27 of ~28".
- The install prompt is a one-line banner that expands for instructions.
- The tiles now show your last period (date and length) and your usual cycle.
- Fixed: the fertile-window note showed this cycle's window after it had passed; it now shows the next one.
- Fixed: "Remind me next week" on the backup reminder only hid it for a day.

**Daily log**
- Save is always visible at the bottom.
- Sleep, cervical fluid, activity, tests, medication and notes are folded under "More details", opened automatically when an entry already uses them.
- "Count as part of a period" is a switch, and the five bleeding options fit on one row.
- Labels use sentence case ("Breast tenderness").

**Calendar**
- Shows the next three predicted periods.
- With the fertile-window setting on, shades estimated fertile days and marks the estimated ovulation day with ✦.
- Today stands out more, and entry dots are larger.
- Swipe left or right to change month, with a "Back to today" link.

**Insights**
- Cycle lengths are shown as dots against a shaded band for your usual range; cycles outside it are highlighted. Tap one to open that month in the calendar.
- Commonly logged symptoms are shown as bars.

**Polish**
- A short celebration when your first full cycle is recorded (not shown to people upgrading who already have one).
- A light haptic tap when saving an entry or changing a setting, on phones that support it.
- Better contrast for labels, icons and tags in light mode.

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
