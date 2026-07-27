# Luna Daily v2.0.0 — Test report

Tested on 27 July 2026.

## Automated core tests

Eight calculation and data tests passed:

- month-boundary date arithmetic
- leap-day date arithmetic
- initial prediction from configured cycle length
- grouping consecutive period days
- preventing spotting from automatically creating a period
- recency-weighted prediction from recorded cycles
- minimum prediction-range allowance
- settings-value clamping

Run with:

```bash
node tests/core-tests.js
```

## Static PWA audit

The audit passed checks for:

- JavaScript syntax
- iPhone viewport metadata
- Apple standalone metadata
- safe-area CSS
- reduced-motion support
- IndexedDB storage
- service-worker registration
- persistent-storage request
- AES-GCM encrypted-backup implementation
- valid manifest and GitHub Pages-safe relative paths
- required runtime files
- icon existence and exact dimensions
- service-worker cache references
- absence of third-party runtime URLs

Run with:

```bash
python tests/static-audit.py
```

## Manual test still required

A real iPhone should receive a final smoke test after GitHub Pages deployment, covering:

1. Add to Home Screen and standalone launch
2. Onboarding
3. Save, edit and delete a daily entry
4. Calendar navigation
5. Encrypted backup export and restore
6. Close/reopen persistence
7. Airplane-mode launch after one online load

The build has been programmatically tested, but no claim is made that it has been physically tested on every iOS version or device.
