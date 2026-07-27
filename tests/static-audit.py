from pathlib import Path
import json, re, sys
from PIL import Image
root=Path(__file__).resolve().parents[1]
errors=[]

def check(ok,msg):
    print(('PASS' if ok else 'FAIL'),msg)
    if not ok: errors.append(msg)

html=(root/'index.html').read_text()
manifest=json.loads((root/'manifest.webmanifest').read_text())
sw=(root/'service-worker.js').read_text()
app=(root/'app.js').read_text()
css=(root/'styles.css').read_text()

check('<meta name="viewport"' in html and 'viewport-fit=cover' in html,'iPhone viewport and safe-area mode declared')
check('apple-mobile-web-app-capable' in html,'Apple standalone metadata declared')
check('manifest.webmanifest' in html,'Manifest linked')
check("env(safe-area-inset-bottom)" in css,'Bottom safe area handled')
check("prefers-reduced-motion" in css,'Reduced-motion preference handled')
check("indexedDB.open" in app,'IndexedDB storage implemented')
check("crypto.subtle.encrypt" in app and "AES-GCM" in app,'Encrypted backup implementation present')
check("navigator.storage.persist" in app,'Persistent-storage request implemented')
check("serviceWorker.register" in app,'Service worker registration implemented')
check("display" in manifest and manifest['display']=='standalone','Manifest uses standalone display')
check(manifest.get('start_url')=='./' and manifest.get('scope')=='./','Manifest uses GitHub Pages-safe relative scope')

for rel in ['index.html','styles.css','app.js','manifest.webmanifest','service-worker.js']:
    check((root/rel).is_file(),f'{rel} exists')
for icon in manifest['icons']:
    p=root/icon['src'];check(p.is_file(),f"Manifest icon exists: {icon['src']}")
    if p.is_file():
        with Image.open(p) as im:
            expected=tuple(map(int,icon['sizes'].split('x')))
            check(im.size==expected,f"Icon dimensions correct: {icon['src']}")

external=re.findall(r'https?://[^\s\"\']+',html+app+css)
check(not external,'No third-party runtime URLs')
for asset in re.findall(r"'\./([^']+)'",sw):
    if asset:
        check((root/asset).exists(),f'Service-worker asset exists: {asset}')

if errors:
    print(f'\n{len(errors)} audit checks failed.')
    sys.exit(1)
print('\nStatic audit passed.')
