## CardLens Architecture Plan

A lightweight mobile workflow for mining Japanese vocabulary from games, manga, and visual immersion. Everything runs locally on the phone via Termux (or desktop) — no remote servers, no hosting costs, no cold starts. The FastAPI server serves both the PWA frontend and the OCR endpoint on `localhost:5050` (avoiding ADB port 5555). Yomitan and AnkiConnect Android handle card creation, and the PWA attaches the cropped source image to the card via AnkiConnect Android on `localhost:8765`.

### 1. Architecture Overview

```
Termux (background):
  └── FastAPI (localhost:5050)
       ├── GET /        → serves the PWA
       └── POST /ocr    → chrome-lens-py

Firefox Android:
  └── http://localhost:5050
       └── Yomitan → AnkiConnect Android (localhost:8765) → AnkiDroid
```

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Termux Server** | Python + FastAPI (`chrome-lens-py`) on Termux | Runs locally on the phone. Serves the PWA static files and handles OCR requests. Always available, no cold starts. |
| **Frontend PWA** | Static HTML/JS (Cropper.js) + `manifest.json` | Served by the Termux FastAPI instance. Camera/gallery input, touch cropping, displays OCR result as selectable text. Installable to home screen via `http://localhost:5050`. |
| **Yomitan** | Firefox Android extension | Parses tapped text, fetches dictionary definitions and audio, creates Anki cards. Standard configuration. |
| **AnkiConnect Android** | Background Android app (F-Droid) | Exposes `http://localhost:8765` so Yomitan can push cards to AnkiDroid. Standard configuration. |

---

### 2. Implementation Specification

#### A. The Termux Server

A single FastAPI process running in Termux that serves both the frontend and the OCR endpoint.

*   **Static Files:** `app.mount("/", StaticFiles(directory="frontend", html=True))` serves the PWA.
*   **OCR Endpoint:** `POST /ocr` — accepts a JSON payload with a Base64-encoded image, returns extracted text.
*   **Dependencies:** `fastapi`, `uvicorn`, `chrome-lens-py`, `pillow`
*   **Output:** `{"text": "extracted Japanese text"}`
*   **No CORS needed:** Frontend and API are same-origin (`localhost:5050`).

**Termux Setup:**
1.  Install Termux and Termux:Widget from F-Droid (not Play Store — the Play Store version is outdated).
2.  Run `bash setup_termux.sh` — installs Python, dependencies, and creates a Termux:Widget shortcut.
3.  Add the Termux:Widget to your home screen: long-press → Widgets → Termux:Widget.
4.  Tap **"CardLens"** in the widget to start the server on-demand. Stop by swiping away the Termux notification or pressing Ctrl+C.

> **Note:** `chrome-lens-py` uses an unofficial Google Lens endpoint. It works well but has no SLA — if it breaks, swap in a different OCR backend behind the same `/ocr` endpoint.

#### B. The Frontend PWA

A single-page static site packaged as a PWA, served by the Termux FastAPI instance. No backend database. Talks to AnkiConnect Android on `localhost:8765` only for image attachment.

1.  **Image Input:** An `<input type="file" accept="image/*" capture="environment">` element lets the user take a photo directly or pick from their gallery (e.g., a Switch screenshot transferred via "Send to Smart Device").
2.  **Cropping:** The image is loaded into **Cropper.js** for touch-friendly crop selection. The user drags a box around the target Japanese text.
3.  **OCR Request:** The cropped region is extracted as a Base64 string via `canvas.toDataURL()` and sent to `POST /ocr` on the same origin. The cropped image is kept in memory for later attachment.
4.  **Text Display:** The returned Japanese text is rendered as a selectable `<p>` element on the page. The user taps a word → Yomitan creates the card.
5.  **Image Attachment:** After creating a card via Yomitan, the user taps an **"Attach Image"** button. The PWA executes the following AnkiConnect sequence against `http://localhost:8765`:
    *   **`storeMediaFile`:** Uploads the Base64 crop to Anki's media folder with a unique filename (e.g., `crop_{timestamp}.jpg`).
    *   **`findNotes`:** Queries for the most recently added note in the target deck (e.g., `"deck:Mining" added:1`).
    *   **`updateNoteFields`:** Appends `<img src="crop_{timestamp}.jpg">` to the `Picture` field of that note.
    *   On success, show a brief confirmation. On failure, show the error (e.g., AnkiConnect Android not running).
6.  **PWA Setup:**
    *   `manifest.json` with `"display": "standalone"`, `"name"`, `"icons"`, and `"start_url"`.
    *   A basic service worker to cache the app shell (HTML, JS, Cropper.js) for instant launch. OCR and AnkiConnect requests are always network.
    *   `localhost` is treated as a secure context — PWA installation and service workers work over plain HTTP.
    *   User installs via Firefox Android's "Add to Home Screen." Launches full-screen with no browser chrome.

#### C. Yomitan & AnkiConnect Android (Standard Setup)

No custom integration — just configure these tools normally:

1.  **Yomitan:** Install on Firefox Android. Import dictionaries. Point AnkiConnect URL to `http://localhost:8765`. Configure the desired Anki card template and fields.
2.  **AnkiConnect Android:** Install from IzzyOnDroid F-Droid repo. Grant permissions. Tap "Start Service."
3.  **Usage:** The user taps a word in the OCR output text. Yomitan pops up with the definition. The user hits the add button. Card is created in AnkiDroid.

---

### 3. Execution Flow

1. **User** takes a photo of the Switch screen (or picks a transferred screenshot from gallery).
2. **Frontend** displays the image in Cropper.js. User draws a crop box over the text.
3. **Frontend → Termux:** Sends the cropped Base64 image to `POST http://localhost:5050/ocr`. Crop is kept in memory.
4. **Termux → Google:** `chrome-lens-py` hits Google Lens, returns extracted text.
5. **Frontend** renders the text as a selectable paragraph.
6. **User** taps a word. Yomitan parses it, shows the definition popup.
7. **Yomitan → AnkiConnect Android → AnkiDroid:** Card is created with definition and audio.
8. **User** taps "Attach Image" in the PWA.
9. **Frontend → AnkiConnect Android:** `storeMediaFile` + `findNotes` + `updateNoteFields` attaches the crop to the card.

---

### 4. Risks & Mitigations

| Risk | Mitigation |
| :--- | :--- |
| `chrome-lens-py` breaks (unofficial API) | Swap to a different OCR engine behind the same `/ocr` endpoint (e.g., `manga-ocr`, `easyocr`, or Google Cloud Vision). |
| AnkiConnect Android flagged by Play Protect | Install via F-Droid client; disable Play Protect for this app. |
| Poor OCR on angled/glary phone photos | Use Switch's "Send to Smart Device" for pixel-perfect screenshots, or add client-side contrast/sharpen preprocessing on the canvas before sending. |
| Termux killed by Android battery optimization | Disable battery optimization for Termux in Android settings. Optionally use `termux-wake-lock` to prevent sleep. |
| Termux not running when needed | Tap the Termux:Widget "Console Capture" shortcut on the home screen to start the server on-demand. |
| `storeMediaFile` flaky on AnkiConnect Android | Test manually with `curl` before building. If Android storage sandboxing blocks it, may need to grant additional permissions to AnkiConnect Android. |
| Image attached to wrong card | The "Attach Image" button should be tapped immediately after Yomitan creates the card. The `findNotes` query uses `added:1` + deck filter to minimize risk. |