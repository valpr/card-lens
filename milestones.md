## Implementation Milestones & Tests

Each milestone is independently testable. Complete them in order — each builds on the previous.

---

### Milestone 1: Termux Environment

**Goal:** Python and all dependencies run in Termux.

**Deliverables:**
- `setup_termux.sh` — automated setup script
- Working Termux installation from F-Droid
- Python + pip installed
- `fastapi`, `uvicorn`, `chrome-lens-py`, `pillow` installed

**Tests:**

| # | Test | Method | Pass Criteria |
|:--|:-----|:-------|:--------------|
| 1.1 | Setup script completes | `bash setup_termux.sh` in a fresh Termux install | Script exits without errors |
| 1.2 | Python runs | `python --version` in Termux | Prints Python 3.x |
| 1.3 | Dependencies import | `python -c "import fastapi, chrome_lens_py, PIL"` | No import errors |

---

### Milestone 2: OCR Endpoint

**Goal:** FastAPI serves a working `/ocr` endpoint in Termux.

**Deliverables:**
- `main.py` — FastAPI app with `POST /ocr`
- `requirements.txt`

**Tests:**

| # | Test | Method | Pass Criteria |
|:--|:-----|:-------|:--------------|
| 2.1 | Server starts | `uvicorn main:app --port 5050` in Termux | No errors, listening on port 5050 |
| 2.2 | Endpoint returns OCR text | `curl -X POST http://localhost:5050/ocr -H "Content-Type: application/json" -d '{"image": "<base64 of Japanese text image>"}'` | Response is `{"text": "..."}` containing correct Japanese characters |
| 2.3 | Bad input returns 4xx | Send malformed JSON or missing `image` field | Returns 400/422, not 500 |
| 2.4 | Non-image Base64 handled | Send Base64 of a text file | Returns a clear error message |

---

### Milestone 3: Static File Serving

**Goal:** FastAPI serves the frontend files on the same port.

**Deliverables:**
- `frontend/` directory with `index.html`
- Static file mount in `main.py`

**Tests:**

| # | Test | Method | Pass Criteria |
|:--|:-----|:-------|:--------------|
| 3.1 | Frontend loads | Open `http://localhost:5050` in Firefox Android | HTML page renders |
| 3.2 | API still works | `POST /ocr` while frontend is mounted | OCR response unchanged |

---

### Milestone 4: Image Input & Crop

**Goal:** The frontend captures a photo and lets the user crop it.

**Deliverables:**
- Cropper.js integrated
- File input with camera/gallery support
- Crop-to-Base64 export

**Tests:**

| # | Test | Method | Pass Criteria |
|:--|:-----|:-------|:--------------|
| 4.1 | Camera capture works | Open `http://localhost:5050` in Firefox Android, tap input, select "Camera" | Device camera opens, photo loads into cropper |
| 4.2 | Gallery pick works | Tap input, select "Gallery", pick an image | Image loads into cropper |
| 4.3 | Touch crop works | Drag crop box on a loaded image | Box is resizable and movable via touch, no scroll interference |
| 4.4 | Crop exports Base64 | Tap a "Crop" button, check console output | `console.log` shows a `data:image/...;base64,...` string of the cropped region only |

---

### Milestone 5: OCR Integration

**Goal:** Cropped image is sent to `/ocr` and returned text is displayed as selectable text.

**Deliverables:**
- Fetch call to `/ocr` in frontend JS
- Text display area

**Tests:**

| # | Test | Method | Pass Criteria |
|:--|:-----|:-------|:--------------|
| 5.1 | End-to-end text extraction | Take photo of Japanese text → crop → submit | Japanese text appears on screen within a few seconds |
| 5.2 | Loading state shown | Submit a crop and observe UI | A spinner or "Processing..." indicator appears during the fetch |
| 5.3 | Error handled | Stop the Termux server, submit a crop | User sees an error message, not a blank screen |
| 5.4 | Text is selectable | Long-press on returned text | Android text selection handles appear; text can be copied |
| 5.5 | Repeat workflow | After text is displayed, start a new photo | Previous result clears, input reappears |

---

### Milestone 6: Image Attachment via AnkiConnect

**Goal:** The PWA can attach the cropped image to the most recently created Anki card.

**Prerequisites:**
- AnkiConnect Android installed, service started on `localhost:8765`
- AnkiDroid installed with a target deck containing at least one note

**Deliverables:**
- "Attach Image" button in the frontend
- AnkiConnect client module (fetch wrapper for `localhost:8765`)

**Tests:**

| # | Test | Method | Pass Criteria |
|:--|:-----|:-------|:--------------|
| 6.1 | AnkiConnect reachable | `curl http://localhost:8765 -d '{"action":"version","version":6}'` from Termux | Returns `{"result": 6, ...}` |
| 6.2 | storeMediaFile works | Call `storeMediaFile` with a small Base64 test image via `curl` | File appears in AnkiDroid's media folder |
| 6.3 | findNotes works | Call `findNotes` with `"deck:YourDeck added:1"` via `curl` | Returns an array of note IDs |
| 6.4 | updateNoteFields works | Call `updateNoteFields` to set a field on a test note via `curl` | Field content updates in AnkiDroid |
| 6.5 | Attach Image button | Crop an image, get OCR text, create a card via Yomitan, tap "Attach Image" | Confirmation appears; card in AnkiDroid now has the cropped image in the Picture field |
| 6.6 | Error when AnkiConnect down | Stop AnkiConnect Android, tap "Attach Image" | User sees an error message, not a silent failure |
| 6.7 | No image to attach | Tap "Attach Image" before cropping any image | Button is disabled or shows a message |

---

### Milestone 7: PWA

**Goal:** The app is installable to the home screen and launches standalone.

**Deliverables:**
- `frontend/manifest.json`
- `frontend/sw.js` (service worker)
- App icon (192×192 + 512×512 PNG)

**Tests:**

| # | Test | Method | Pass Criteria |
|:--|:-----|:-------|:--------------|
| 7.1 | Manifest is valid | Firefox DevTools or Lighthouse | No manifest errors; name, icons, display, start_url all present |
| 7.2 | Installable | In Firefox Android, tap menu → "Add to Home Screen" | App icon appears on home screen |
| 7.3 | Launches standalone | Tap home screen icon | App opens full-screen with no browser address bar |
| 7.4 | App shell cached | Launch PWA, then enable airplane mode, relaunch | The HTML/JS/Cropper.js UI loads (OCR will fail — expected) |

---

### Milestone 8: End-to-End Integration

**Goal:** Full mining workflow produces an Anki card with an attached image.

**Prerequisites (manual setup, not built by us):**
- Firefox Android with Yomitan installed and dictionaries imported
- AnkiConnect Android installed, service started on `localhost:8765`
- AnkiDroid installed with a target deck
- Yomitan configured: AnkiConnect URL → `http://localhost:8765`, card template set

**Tests:**

| # | Test | Method | Pass Criteria |
|:--|:-----|:-------|:--------------|
| 8.1 | Yomitan parses OCR output | Tap a word in the displayed OCR text | Yomitan popup appears with dictionary definition |
| 8.2 | Card created in AnkiDroid | Tap Yomitan's add-to-Anki button | Card appears in AnkiDroid with word, reading, definition, and audio |
| 8.3 | Image attached to card | Tap "Attach Image" after card creation | Card's Picture field contains the cropped image |
| 8.4 | Full workflow under 20s | Time from tapping "submit crop" to card with image in AnkiDroid | ≤ 20 seconds |
| 8.5 | Repeated mining | Create 3 cards with images in a row without restarting anything | All 3 cards have correct images in AnkiDroid |
| 8.6 | Works after phone idle | Lock phone for 10 min, unlock, mine a card with image | Termux server still responds, card + image created |

---

### Milestone Order & Dependencies

```
M1 (Termux env) → M2 (OCR endpoint) → M3 (Static serving)
                                              ↓
                  M4 (Crop UI) → M5 (OCR integration) → M6 (Image attach) → M7 (PWA) → M8 (End-to-end)
```

M4 (crop UI) can be built on desktop and copied to the phone. Everything converges at M5. M6 requires AnkiConnect Android to be set up on the device.
