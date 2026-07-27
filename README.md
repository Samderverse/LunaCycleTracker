# Luna Daily v2.0.0

A private, mobile-first period and cycle tracker for one person's personal use.

## What is included

- Installable Progressive Web App for iPhone Home Screen
- Offline app shell after the first successful load
- Local IndexedDB storage with localStorage fallback
- Period and spotting logging
- Symptoms, mood, energy, sleep, medication and notes
- Optional cervical-fluid, sexual-activity, pregnancy-test and ovulation-test tracking
- Monthly calendar with logged and predicted period dates
- Transparent cycle-length and next-period estimates
- Menstrual, follicular, estimated ovulation and luteal phase display
- Optional estimated fertile window with safety wording
- Personal cycle and symptom insights
- Dark, light and device themes
- Privacy curtain in the app switcher
- Plain or password-encrypted backups using PBKDF2 and AES-GCM
- Restore and delete-all controls
- No accounts, analytics, advertising, database or third-party runtime services

## Publish through GitHub Pages

1. Create a public GitHub repository, for example `LunaCycleTracker`.
2. Open the repository and choose **Add file → Upload files**.
3. Drag the contents of this folder into GitHub. Keep the `icons` folder intact.
4. Commit the upload.
5. Open **Settings → Pages**.
6. Under **Build and deployment**, choose **Deploy from a branch**.
7. Select `main` and `/ (root)`, then save.
8. Wait for GitHub to provide the Pages address.

The repository root should contain:

```text
index.html
app.js
styles.css
service-worker.js
manifest.webmanifest
icons/
```

The `tests` folder and documentation files may also be uploaded, but the app does not require them at runtime.

## Install on iPhone

1. Open the GitHub Pages address in **Safari**.
2. Tap **Share**.
3. Choose **Add to Home Screen**.
4. Leave **Open as Web App** enabled.
5. Open Luna Daily from the new Home Screen icon before entering real data.

## Updating later

Upload replacement files with the same names to the same repository and commit them. GitHub Pages will redeploy automatically. The app data is stored separately on the iPhone, but creating an encrypted backup before any update is recommended.

## Run locally for development

Service workers require a web server rather than opening `index.html` directly:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Important limitations

- Cycle phases, ovulation timing, fertile windows and future period dates are calendar estimates.
- Do not use the fertile-window estimate as the only method of contraception.
- The tracker does not diagnose conditions or confirm ovulation or pregnancy.
- Deleting the Home Screen web app or clearing Safari website data may remove local entries.
- Keep an encrypted backup somewhere private.
