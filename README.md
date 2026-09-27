# CardLens 🔍🎴

> **Turn any image, screenshot, or manga panel into rich Anki cards in seconds.**  
> A lightweight, local-first companion app running on-device via Termux (or desktop) that combines Google Lens OCR, Yomitan dictionary lookups, and 1-tap Anki card image attachment.

---

## 🌟 Why CardLens?

When immersing in Japanese through games (Switch, Steam Deck, PC), manga, visual novels, or physical books, turning an unfamiliar sentence into an Anki flashcard is often tedious:
1. Taking a screenshot or photo.
2. Typing out kanji manually or dealing with clunky cloud OCR apps.
3. Looking up definitions in a dictionary.
4. Manually copy-pasting definitions and saving/attaching the image to Anki.

**CardLens automates the entire visual mining loop without external servers or subscriptions:**
- 📸 **Any Image Source:** Snap a photo of a screen or book, import gallery screenshots, drag-and-drop, or paste directly from your clipboard (`Ctrl+V`).
- ✂️ **Touch-Friendly Cropper:** Crop directly to the dialogue box with pinch/drag controls, 90° rotation, and offline-vendored Cropper.js.
- 🔍 **Google Lens OCR Backend:** High-accuracy Japanese text recognition powered by `chrome-lens-py` running locally on FastAPI.
- 📖 **Yomitan-Optimized:** Renders clean, selectable Japanese typography designed specifically for Yomitan's one-tap popup dictionary and card creation.
- 🎴 **One-Tap Anki Attachment:** Tapping **"Attach Image"** uploads the cropped image into Anki's media collection and updates the latest card via AnkiConnect Android (`localhost:8765`).
- ⚡ **1-Click Yomitan Setup:** Drop your exported Yomitan settings JSON to auto-configure your target deck and picture field in one click!
- 🛡️ **Zero Port Conflicts:** Serves on port `5050` by default, avoiding collision with Android Wireless ADB (`port 5555`).
- 📱 **Installable PWA:** Installs directly to your Android home screen as a standalone, fullscreen app with offline-cached app shell.

---

## 🔄 How the Workflow Works

```text
 [ Screen / Manga / Photo / Clipboard ]
                   │
                   ▼
┌────────────────────────────────────────────────────────┐
│  CardLens PWA (http://localhost:5050)                  │
│  1. Load image (Camera, Gallery, or Clipboard Paste)   │
│  2. Crop text region with touch/mouse controls         │
│  3. Tap "Extract Text"                                 │
└──────────────────────────┬─────────────────────────────┘
                           │ POST /ocr (Base64)
                           ▼
┌────────────────────────────────────────────────────────┐
│  FastAPI Backend (Termux on Android / Localhost:5050)  │
│  • Google Lens OCR via chrome-lens-py                  │
│  • Returns: { "text": "冒険の始まり..." }               │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│  Firefox Android (Yomitan Extension)                   │
│  • Tap Japanese word in OCR text box                   │
│  • Yomitan pop-up shows definition + audio             │
│  • Tap [+] to create Anki card                         │
└──────────────────────────┬─────────────────────────────┘
                           │ Card created via AnkiConnect
                           ▼
┌────────────────────────────────────────────────────────┐
│  CardLens PWA                                          │
│  • Tap "Attach Image to Card"                          │
│  • storeMediaFile -> findNotes -> updateNoteFields     │
│  • Cropped screenshot attached to note's Picture field!│
└────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start & Setup

### Prerequisites

For the mobile workflow, you will need an Android device with:
1. **[Termux](https://f-droid.org/packages/com.termux/)** (from F-Droid, **not** Google Play).
2. **[Termux:Widget](https://f-droid.org/packages/com.termux.widget/)** (optional, for one-tap home screen launch).
3. **[Firefox for Android](https://www.mozilla.org/firefox/browsers/mobile/android/)** with the **[Yomitan](https://addons.mozilla.org/firefox/addon/yomitan/)** extension and Japanese dictionaries installed.
4. **[AnkiDroid](https://f-droid.org/packages/com.ichi2.anki/)** + **[AnkiConnect Android](https://github.com/kamwithk/AnkiconnectAndroid)** (available on IzzyOnDroid F-Droid repo).

---

### 1. Termux Setup (Android)

1. Open Termux and run the setup script:
   ```bash
   curl -sL https://raw.githubusercontent.com/YOUR_REPO/cardlens/main/setup_termux.sh | bash
   ```
   *Or clone the repository and run:*
   ```bash
   cd cardlens
   bash setup_termux.sh
   ```

2. **Disable Android Battery Optimization for Termux:**
   - Go to Android **Settings** → **Apps** → **Termux** → **Battery** → Select **Unrestricted**.
   - (Optional) In Termux, run `termux-wake-lock` to keep background services awake during long mining sessions.

3. **Start the Server:**
   - Either tap the **"CardLens"** shortcut widget on your home screen, or run:
     ```bash
     cd ~/cardlens
     uvicorn main:app --host 0.0.0.0 --port 5050
     ```

---

### 2. Desktop Setup (Windows / macOS / Linux)

You can also run CardLens on your computer to mine cards from PC games, emulators, or manga readers:

1. **Clone & Install Dependencies:**
   ```bash
   git clone https://github.com/YOUR_REPO/cardlens.git
   cd cardlens
   pip install -r requirements.txt
   ```

2. **Launch the Server:**
   ```bash
   uvicorn main:app --host 127.0.0.1 --port 5050
   ```

3. **Open the App:**
   - Navigate to `http://localhost:5050` in your browser.
   - Use clipboard paste (`Ctrl+V`) to paste any screenshot immediately into the cropper!

---

### 3. First-Time Setup & Yomitan Auto-Configuration

When you open `http://localhost:5050` for the first time, the **First-Time Setup Wizard** automatically welcomes you to configure your Anki deck and picture fields.

You can configure your settings in **seconds** using either method:

#### ⚡ Method A: Instant Yomitan Settings Import (Recommended)
1. In Yomitan, export your settings:  
   **Yomitan Settings → Backup → Export Settings** (downloads `yomitan-settings-YYYY-MM-DD.json`).
2. In CardLens, drop or select this `.json` file in the setup wizard (or in **⚙️ Settings → Import Yomitan JSON**).
3. CardLens automatically extracts:
   - Your AnkiConnect server URL (`http://localhost:8765`)
   - Your target Anki deck (e.g. `Mining` or `Japanese`)
   - Your picture/screenshot field (e.g. `Picture`, `Image`, or `Screenshot`)
   - Your note model (e.g. `Kaishi 1.5k`, `Animecards`)
4. Review the detected settings and tap **"Confirm & Apply Settings"** — you're completely configured with zero manual typing!

#### 🔌 Method B: Live Anki Auto-Detection
If AnkiConnect is already running:
1. Tap **"✨ Auto-Detect from Recent Anki Card"** in the wizard.
2. CardLens queries your most recently created card in AnkiDroid and auto-populates the exact deck name and picture field used by your card!
3. Alternatively, pick your deck and picture field directly from live dropdowns populated straight from Anki.

You can also re-run the wizard or adjust fields anytime by tapping the **⚙️ Settings** icon in the header.

---

### 4. Install as a PWA (Home Screen)

1. Open `http://localhost:5050` in Firefox on Android.
2. Tap the browser menu (three dots) → **"Add to Home screen"** (or **"Install"**).
3. Tap the **CardLens** icon on your home screen. It will launch in full-screen standalone mode without any browser address bar!

---

## 🕹️ Daily Mining Walkthrough

1. **Capture:**
   - **Method A (Camera):** Tap **Camera** and take a quick photo of your Switch screen, TV, or physical manga.
   - **Method B (Gallery / Screenshot):** Transfer a screenshot or select from your gallery, then tap **Gallery**.
   - **Method C (Clipboard Paste):** Press your screenshot hotkey (e.g. `Win+Shift+S`) and press `Ctrl+V` in CardLens.
2. **Crop:**
   - Drag and pinch the crop box around the dialogue box or text bubble.
   - Tap **"Extract Text ➔"**.
3. **Mine with Yomitan:**
   - The recognized Japanese text renders in large, selectable text.
   - Tap on any unfamiliar word. Yomitan's popup will display definitions, readings, and pitch accent.
   - Tap the green **`+`** button in Yomitan to add the note to AnkiDroid.
4. **Attach Image:**
   - Tap **"📎 Attach Image to Card"**.
   - CardLens uploads the cropped image into Anki's media database and attaches it directly to the card you just created!
5. **Repeat:**
   - Tap **"🔄 New Capture"** to jump straight back to capturing your next sentence.

---

## 🧪 Testing & Validation

The codebase includes automated unit and integration tests covering the FastAPI server, OCR pipeline, static assets, and AnkiConnect client:

```bash
# Run Python backend & OCR integration tests
python -m unittest discover tests

# Run AnkiConnect client unit tests (Node.js)
node tests/test_ankiconnect.mjs

# Validate AnkiConnect Android connectivity via bash
bash test_ankiconnect.sh
```

---

## 📁 Project Structure

```text
cardlens/
├── main.py                   # FastAPI backend & OCR endpoint (POST /ocr)
├── requirements.txt          # Python dependencies
├── setup_termux.sh           # Automated Termux installation script (Port 5050)
├── test_ankiconnect.sh       # Bash verification script for AnkiConnect
├── milestones.md             # Implementation milestones & test specifications
├── mobile_image_to_anki_architecture_plan.md # Architectural blueprint
├── tests/
│   ├── test_api.py           # Backend API unit tests & static mount validation
│   └── test_ankiconnect.mjs  # AnkiConnect JS client unit tests
└── frontend/
    ├── index.html            # PWA single-page interface
    ├── styles.css            # Dark OLED console styling
    ├── app.js                # UI controller, camera capture & OCR handling
    ├── ankiconnect.js        # AnkiConnect API client module
    ├── manifest.json         # PWA web app manifest (CardLens)
    ├── sw.js                 # Service Worker (app shell offline caching)
    ├── icons/                # PWA app icons (192x192, 512x512, favicon)
    └── vendor/
        └── cropperjs/        # Vendored Cropper.js (offline ready)
```

---

## 🛠️ Troubleshooting & FAQ

<details>
<summary><strong>Q: What if Google Lens OCR fails or changes?</strong></summary>

The backend uses `chrome-lens-py` to interface with Google Lens. If the upstream endpoint ever changes, `main.py` is modularly structured so you can swap in alternative OCR engines (such as `manga-ocr`, `easyocr`, or Google Cloud Vision) behind the exact same `POST /ocr` contract without modifying the frontend.
</details>

<details>
<summary><strong>Q: AnkiConnect gives a "Cannot connect" error on Android.</strong></summary>

1. Ensure the **AnkiConnect Android** app is opened and the service is toggled to **Started**.
2. Make sure battery optimization is disabled for AnkiConnect Android so Android does not kill the background service.
3. Tap **⚙️ Settings** in CardLens and ensure the URL is set to `http://localhost:8765`.
</details>

<details>
<summary><strong>Q: The image was attached to the wrong field or note.</strong></summary>

- By default, CardLens searches for the most recently added card in your configured deck (`deck:"Mining" added:1`). Always tap **"Attach Image"** right after creating your card with Yomitan.
- In Settings or the Setup Wizard, ensure **Picture Field Name** matches your note type's picture field (e.g. `Picture`, `Image`, or `Screenshot`).
</details>

---

## 📄 License

MIT License. Designed with ❤️ for Japanese language learners and immersion miners.
