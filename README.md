# CardLens 🔍🎴

> **Turn any image, screenshot, or manga panel into rich Anki cards in seconds.**  
> A lightweight, local-first companion app running on-device via Termux (or desktop) that combines Google Lens OCR, Yomitan dictionary lookups, live image pre-processing filters, and 1-tap or automated Anki card image attachment.

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
- 🎨 **Image Pre-Processing Filters:** Real-time canvas filters (Contrast boost, Sharpen, Invert colors, B&W / Grayscale) with live preview to clarify low-contrast or stylized game text before OCR.
- 🔍 **Google Lens OCR Backend:** High-accuracy Japanese text recognition powered by `chrome-lens-py` running locally on Starlette / ASGI.
- 📖 **Yomitan-Optimized:** Renders clean, selectable Japanese typography designed specifically for Yomitan's one-tap popup dictionary and card creation.
- 🤖 **Auto-Attach Mode:** Pre-polls recent notes and automatically detects newly created cards from Yomitan via diff polling, attaching the screenshot seamlessly with a visual progress dock and cancel/attach buttons.
- 🎴 **1-Tap Anki Attachment:** Manual fallback to upload the cropped image into Anki's media collection and attach it to the latest card via AnkiConnect (`localhost:8765`).
- 🔊 **Synthetic Audio Cues:** Zero-dependency Web Audio clicks, OCR blips, and card attach chimes (with a toggle in Settings).
- ⌨️ **Desktop Shortcuts:** Full keyboard workflow (`Enter` to crop, `R`/`Shift+R` to rotate, `A` to attach, `N` for new capture, `Esc` to cancel).
- 📝 **Custom Field Formatting:** Customize the image tag template (e.g. `<img src="{filename}">` or custom wrapper divs) in Settings.
- ✨ **1-Tap Anki Auto-Detection:** Automatically detect your target deck and picture field directly from your latest card via AnkiConnect (or import Yomitan settings JSON).
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
│  3. (Optional) Apply filters: Contrast/Sharpen/Invert  │
│  4. Tap "Extract Text"                                 │
└──────────────────────────┬─────────────────────────────┘
                           │ POST /ocr (Base64)
                           ▼
┌────────────────────────────────────────────────────────┐
│  Starlette Backend (Termux on Android / Localhost:5050)│
│  • Google Lens OCR via chrome-lens-py                  │
│  • Returns: { "text": "冒険の始まり..." }               │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│  Firefox Android / Browser (Yomitan Extension)         │
│  • Tap Japanese word in OCR text box                   │
│  • Yomitan pop-up shows definition + audio             │
│  • Tap [+] to create Anki card                         │
└──────────────────────────┬─────────────────────────────┘
                           │ Card created via AnkiConnect
                           ▼
┌────────────────────────────────────────────────────────┐
│  CardLens PWA                                          │
│  • Auto-Attach: Polls diff & attaches automatically    │
│    OR Manual: Tap "Attach Image to Card"               │
│  • storeMediaFile -> findNotes -> updateNoteFields     │
│  • Cropped screenshot attached to note's Picture field!│
└────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start & Setup

### 📱 Android Setup (Fresh Install to Running in 3 Minutes)

> [!IMPORTANT]
> **Do not install Termux from Google Play** (the Play Store build is abandoned and broken). Always install Termux from F-Droid.

#### Step 1: Install Required Apps
1. Install the following apps from **[F-Droid](https://f-droid.org/)** (or via direct APK downloads):
   - **[Termux](https://f-droid.org/packages/com.termux/)**
   - **[Termux:Widget](https://f-droid.org/packages/com.termux.widget/)** *(optional, for one-tap home screen launch; must be installed from F-Droid to match Termux's signing key)*
   - **[AnkiDroid](https://f-droid.org/packages/com.ichi2.anki/)**
   - **[AnkiConnect Android](https://github.com/kamwithk/AnkiconnectAndroid)** *(from IzzyOnDroid F-Droid repo or GitHub releases)*
2. In **[Firefox for Android](https://www.mozilla.org/firefox/browsers/mobile/android/)**, install the **[Yomitan](https://addons.mozilla.org/firefox/addon/yomitan/)** add-on and load your Japanese dictionary.

#### Step 2: Run the 1-Line Termux Setup
Open **Termux** on your phone and paste this single command:
```bash
pkg update -y && pkg install -y curl && curl -sL https://raw.githubusercontent.com/valpr/card-lens/main/setup_termux.sh | bash
```
*What this automated script does:*
- Updates packages and installs `python`, `git`, and build tools
- Clones CardLens to `~/cardlens` and installs dependencies in an isolated `venv`
- Installs the global `cardlens` command into your PATH
- Sets up the home screen launcher for Termux:Widget

#### Step 3: Grant Android Background Permissions (30 seconds)
Android will kill background services by default unless you grant these:
1. Go to Android **Settings** → **Apps** → **Termux**:
   - **Battery** → Select **Unrestricted** (or "Don't optimize").
   - *(If using Termux:Widget)* **Appear on top** / **Display pop-up window while running in background** → **Allow**.
2. Open **AnkiConnect Android** and toggle the service to **Started**.

#### Step 4: Launch CardLens
Pick whichever method you prefer:
- **One-Tap Home Screen Shortcut (Termux:Widget):** Long-press an empty space on your home screen → **Widgets** → **Termux:Widget** → drag the **Termux shortcut (1×1)** onto your screen and tap `CardLens.sh`. Tap it anytime to launch!
- **Terminal:** Open Termux and simply run:
  ```bash
  cardlens
  ```

#### Step 5: Open CardLens & Install PWA
1. Open Firefox for Android and navigate to:
   ```text
   http://localhost:5050
   ```
2. Tap the Firefox menu (`⋮`) → **"Add to Home screen"** (or **"Install"**).
3. Tap the **CardLens** icon on your home screen to use it in full-screen standalone mode!
4. The first-time wizard will guide you to auto-configure with your Yomitan settings or Anki deck.

---

### 2. Desktop Setup (Windows / macOS / Linux)

You can also run CardLens on your computer to mine cards from PC games, emulators, or manga readers:

1. **Clone & Install Dependencies:**
   ```bash
   git clone https://github.com/valpr/card-lens.git
   cd card-lens
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

### 3. First-Time Setup & AnkiConnect Configuration

When you open `http://localhost:5050` for the first time, the **First-Time Setup Wizard** automatically welcomes you to configure your Anki deck and picture fields.

You can configure your settings in **seconds** using either method:

#### 🔌 Method A: Live AnkiConnect Auto-Detection (Recommended)
If AnkiConnect Android is running (`http://localhost:8765`):
1. Tap **"✨ Auto-Detect from Recent Anki Card"** in the wizard.
2. CardLens queries your most recently created card in AnkiDroid and auto-populates the exact deck name and picture field used by your note model!
3. Tap **"Save & Finish Setup"** — you're completely configured in one tap with zero manual typing!
4. *(Optional)* You can also pick your deck and picture field directly from live dropdowns populated straight from Anki.

#### ⚡ Method B: Instant Yomitan Settings Import (Alternative)
If you prefer configuring via your Yomitan profile:
1. In Yomitan, export your settings:  
   **Yomitan Settings → Backup → Export Settings** (downloads `yomitan-settings-YYYY-MM-DD.json`).
2. In CardLens, drop or select this `.json` file in the setup wizard (or in **⚙️ Settings → Import Yomitan JSON**).
3. CardLens automatically extracts:
   - Your AnkiConnect server URL (`http://localhost:8765`)
   - Your target Anki deck (e.g. `Mining` or `Japanese`)
   - Your picture/screenshot field (e.g. `Picture`, `Image`, or `Screenshot`)
   - Your note model (e.g. `Kaishi 1.5k`, `Animecards`)
4. Review the detected settings and tap **"Confirm & Apply Settings"**.

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
2. **Crop & Enhance:**
   - Drag and pinch the crop box around the dialogue box or text bubble.
   - *(Optional)* Tap a filter chip (`Contrast`, `Sharpen`, `Invert`, or `B&W`) to boost text readability.
   - Tap **"Extract Text ➔"** (or press `Enter`).
3. **Mine with Yomitan:**
   - The recognized Japanese text renders in large, selectable typography.
   - Tap on any unfamiliar word. Yomitan's popup will display definitions, readings, and pitch accent.
   - Tap the green **`+`** button in Yomitan to add the note to Anki.
4. **Attach Image:**
   - **Auto-Attach Mode:** If enabled, CardLens automatically detects the new card within 1–2 seconds and attaches the image with a subtle completion chime!
   - **Manual Mode:** Tap **"📎 Attach Image to Card"** (or press `A`) to attach the image to your newest card.
5. **Repeat:**
   - Tap **"🔄 New Capture"** (or press `N`) to jump straight back to capturing your next sentence.

---

## ⌨️ Desktop Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Enter` | Crop & Extract Text |
| `R` | Rotate Image 90° Clockwise |
| `Shift + R` | Rotate Image 90° Counter-Clockwise |
| `A` | Attach Cropped Image to Card |
| `N` | Start New Capture |
| `Escape` | Close Modal / Cancel Auto-Attach Polling |
| `Ctrl + V` | Paste Image from Clipboard |

---

## 🧪 Testing & Validation

The codebase includes automated unit and integration tests covering the Starlette ASGI server, OCR pipeline, static assets, and AnkiConnect client:

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
card-lens/
├── .github/
│   └── workflows/
│       └── ci.yml            # Automated CI workflow
├── main.py                   # Starlette ASGI backend & OCR endpoint (POST /ocr)
├── run.sh                    # Server launcher with auto-update git pull & address banner
├── requirements.txt          # Python dependencies
├── setup_termux.sh           # Automated Termux installation script (Port 5050)
├── test_ankiconnect.sh       # Bash verification script for AnkiConnect
├── LICENSE                   # BSD 3-Clause License
├── README.md                 # Project documentation & user guide
├── tests/
│   ├── test_api.py           # Backend API unit tests & static mount validation
│   └── test_ankiconnect.mjs  # AnkiConnect JS client unit tests
└── frontend/
    ├── index.html            # PWA single-page interface
    ├── styles.css            # Dark OLED console styling
    ├── app.js                # UI controller, camera capture, filters & audio cues
    ├── ankiconnect.js        # AnkiConnect API client module & auto-attach polling
    ├── manifest.json         # PWA web app manifest (CardLens)
    ├── sw.js                 # Service Worker (app shell offline caching)
    ├── icons/                # PWA app icons (192x192, 512x512, favicon)
    └── vendor/
        └── cropperjs/        # Vendored Cropper.js (offline ready)
```

---

## 🛠️ Troubleshooting & FAQ

<details>
<summary><strong>Q: "Permission denied" error when running run.sh on Termux.</strong></summary>

1. **Quick Fix:** Run `chmod +x run.sh && ./run.sh` or `bash run.sh`.
2. **Repository in Shared Storage:** Make sure CardLens is located in Termux's internal home directory (`~/cardlens` or `/data/data/com.termux/files/home/cardlens`), **not** in `/sdcard` or `/storage/emulated/0`. Android mounts external and shared storage with `noexec`, preventing any script or binary execution.
</details>

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

- By default, CardLens searches for the most recently added card in your configured deck (`deck:"Mining" added:1`). Always tap **"Attach Image"** (or let Auto-Attach run) right after creating your card with Yomitan.
- In Settings or the Setup Wizard, ensure **Picture Field Name** matches your note type's picture field (e.g. `Picture`, `Image`, or `Screenshot`).
</details>

<details>
<summary><strong>Q: Can I customize how the image tag is saved into the card?</strong></summary>

Yes! In **⚙️ Settings → Image Field Template**, you can change `<img src="{filename}">` to any custom HTML format (e.g. `<div class="screenshot"><img src="{filename}"></div>`).
</details>

---

## 📄 License

BSD 3-Clause License. See [LICENSE](LICENSE) for details. Designed with ❤️ for Japanese language learners and immersion miners.
