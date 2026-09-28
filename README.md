# CardLens 🔍🎴

> **Turn any image, screenshot, or manga panel into rich Anki cards in seconds.**  
> A lightweight, local-first companion app running on-device via Termux (or desktop) that combines Google Lens OCR, Yomitan dictionary lookups, live image pre-processing filters, and 1-tap or automated Anki card image attachment.

---

## 🌟 Why CardLens?

When immersing in Japanese through games, manga, visual novels, or physical books, turning an unfamiliar sentence into an Anki flashcard should have as little friction as possible.

- 🎮 **No capture card required.** Just snap a photo of your Switch, TV, Steam Deck, or handheld screen with your phone.
- 📚 **Works with any source.** Physical novels, manga volumes, game screenshots, visual novels, emulators, hard-coded subs.
- 🆓 **Free & self-hosted.** No accounts, no API keys, no subscriptions. The server runs on your own device and uses Google Lens for OCR — no paid cloud services required.

**CardLens is a guide through the visual mining loop:**
- 📸 **Capture from anywhere.** Snap a photo, import a screenshot, drag-and-drop, or paste from your clipboard (`Ctrl+V`).
- ✂️ **Crop & enhance.** Pinch-to-crop on mobile or drag on desktop, with optional filters (contrast, sharpen, invert) to clean up stylized game text.
- 🔍 **Google Lens OCR.** High-accuracy multilingual text recognition with automatic language detection.
- 📖 **Dictionary-ready output.** Clean, selectable text designed for Yomitan and other browser dictionary extensions — tap a word to look it up instantly.
- 🎴 **Automatic Anki attachment.** Creates and attaches the cropped screenshot to your newest card automatically, or with one tap.
- 📱 **Runs on Android & desktop.** Installable as a PWA on your phone or as a local server on Windows, macOS, and Linux.

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
apt update && apt full-upgrade -y && apt install -y curl && curl -sL https://raw.githubusercontent.com/valpr/card-lens/main/setup_termux.sh | bash
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

#### ⚡ Method A: Standalone 1-Click App (Recommended — No Python or Git Needed!)

1. Go to **[CardLens Releases](https://github.com/valpr/card-lens/releases)** and download the package for your OS:
   - **Windows:** `CardLens-Windows-x64.zip`
   - **macOS:** `CardLens-macOS.zip`
   - **Linux:** `CardLens-Linux-x64.tar.gz`
2. Extract the archive and double-click **`CardLens`** (`CardLens.exe` on Windows).
3. The server starts immediately and opens `http://localhost:5050` in your default browser!

---

#### 🐳 Method B: Docker / Home Server (Mine from Phone Without Termux!)

Run CardLens 24/7 on your PC or home server (Raspberry Pi, NAS, Unraid) so any phone or device on your Wi-Fi can mine without installing Termux:

```bash
docker run -d -p 5050:5050 --name cardlens --restart unless-stopped ghcr.io/valpr/card-lens:latest
```

*Or with Docker Compose:*
```bash
docker compose up -d
```
Then simply open `http://<your-computer-ip>:5050` in your phone's browser!

---

#### 🐍 Method C: Python / CLI Setup (For Developers)

```bash
# Option 1: Run directly with pipx
pipx run cardlens

# Option 2: Clone & run in virtual environment
git clone https://github.com/valpr/card-lens.git
cd card-lens
python -m venv venv

# Windows (PowerShell):
venv\Scripts\Activate.ps1
# macOS / Linux:
source venv/bin/activate

pip install -r requirements.txt
python main.py
```

#### 💻 PC Mining Workflows: Choose What Works Best for You

CardLens on PC supports two streamlined workflows:

- **Mode 1: Anki Desktop with AnkiConnect (Automated & 1-Tap Attach)**
  1. In Anki Desktop, go to **Tools → Add-ons** (`Ctrl+Shift+A`).
  2. Click **Get Add-ons...**, paste code **`2055492159`**, and restart Anki.
  3. Keep Anki Desktop open in the background.
  4. *Zero CORS Configuration:* CardLens includes a built-in transparent AnkiConnect proxy (`/api/ankiconnect`), so you never need to edit AnkiConnect's `webCorsOriginList`!
  5. Use 1-tap **"📎 Attach Image to Card"** (or Auto-Attach) to attach crops directly to new Yomitan cards.

- **Mode 2: Standalone Clipboard Mode (Zero Setup - No AnkiConnect Needed!)**
  - Don't have AnkiConnect or prefer adding cards manually?
  - Paste any screenshot (`Ctrl+V`) into CardLens and extract Japanese text with Google Lens OCR.
  - Hover text with Yomitan to read definitions and create cards.
  - 1-Click **"📋 Copy Image"** (or press `I`) or **"📋 Copy Text"** to copy the cropped panel straight to your clipboard and paste (`Ctrl+V`) directly into Anki Desktop's card fields!

---

### 3. First-Time Setup & Onboarding Wizard

When you open `http://localhost:5050` for the first time, the **Setup Wizard** welcomes you with dedicated platform tabs:

#### 💻 PC / Desktop Setup
- **Option 1: AnkiConnect:** Quickly copy the add-on code (`2055492159`), click **"✨ Auto-Detect from Recent Anki Card"**, and CardLens will automatically populate your target deck and picture field!
- **Option 2: 📁 Import Yomitan Settings JSON:** Drop your `yomitan-settings.json` exported from Yomitan to configure deck/fields instantly.
- **Option 3: ⚡ Clipboard Mode:** 1-Click to activate standalone mode without AnkiConnect.

#### 📱 Mobile (Android) Setup
- **Option 1: AnkiConnect Android:** Connect directly to AnkiDroid / AnkiConnect Android (`localhost:8765`) and auto-detect your card.
- **Option 2: 📁 Import Yomitan Settings JSON:** Drop your `yomitan-settings.json` exported from Yomitan to configure deck/fields instantly.
- **Option 3: ⚡ Clipboard Mode:** 1-Click to activate standalone mode without AnkiConnect.

You can switch workflow modes or re-run the wizard anytime from the **⚙️ Settings** modal.

---

### 4. Install as a PWA (Home Screen)

1. Open `http://localhost:5050` in Firefox on Android (or Chrome/Edge on Desktop).
2. Tap the browser menu (`⋮`) → **"Add to Home screen"** (or **"Install CardLens"**).
3. Launch CardLens from your app launcher or desktop shortcut in full-screen standalone mode!

---

## 🕹️ Daily Mining Walkthrough

1. **Capture:**
   - **Method A (Camera):** Tap **Camera** and take a quick photo of your Switch screen, TV, or physical manga.
   - **Method B (Gallery / Screenshot):** Select a screenshot from your device gallery.
   - **Method C (PC Clipboard Paste):** Take a screenshot (`Win+Shift+S`) and press `Ctrl+V` in CardLens.
2. **Crop & Enhance:**
   - Drag the box selection around dialogue text or manga panel.
   - *(Optional)* Tap a filter chip (`Contrast`, `Sharpen`, `Invert`, or `B&W`) to boost readability.
   - Tap **"Extract Text ➔"** (or press `Enter`).
3. **Mine with Yomitan:**
   - Recognized text renders in large, selectable typography.
   - Tap or hover any word with Yomitan to view definitions, readings, and pitch accents.
   - Click the green **`+`** button in Yomitan to create an Anki card.
4. **Attach Image / Copy to Clipboard:**
   - **AnkiConnect Mode:** Tap **"📎 Attach Image to Card"** (or let Auto-Attach run) to update the card in Anki.
   - **Clipboard Mode:** Tap **"📋 Copy Image"** (or press `I`) to copy the panel and paste (`Ctrl+V`) into Anki Desktop.
5. **Repeat:**
   - Tap **"🔄 New Capture"** (or press `N`) to jump straight to the next sentence.

---

## ⌨️ Desktop Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Enter` | Crop & Extract Text |
| `R` | Rotate Image 90° Clockwise |
| `Shift + R` | Rotate Image 90° Counter-Clockwise |
| `A` | Attach Cropped Image to Anki Card |
| `I` / `Shift + C` | 📋 Copy Cropped Image to Clipboard |
| `C` | ✂️ Adjust Crop Selection on Current Image |
| `E` | ✏️ Edit Extracted OCR Text Inline |
| `N` | 🔄 Start New Capture |
| `Escape` | Close Modal / Cancel Polling / Cancel Edit |
| `Ctrl + V` | Paste Image from Clipboard |

---

## 🧪 Testing & Validation

The codebase includes automated unit and integration tests covering the Starlette ASGI server, OCR pipeline, static assets, and AnkiConnect client:

```bash
# Run Python backend & OCR integration tests
python -m unittest discover tests

# Run AnkiConnect client unit tests (Node.js)
node tests/test_ankiconnect.mjs

# Run multilingual script-aware line merging unit tests (Node.js)
node tests/test_line_merging.mjs

# Validate AnkiConnect Android connectivity via bash
bash test_ankiconnect.sh
```

---

## 📁 Project Structure

```text
card-lens/
├── .github/
│   └── workflows/
│       ├── ci.yml            # Automated CI workflow
│       └── release.yml       # Multi-platform binaries, Docker & GitHub Releases
├── cardlens.spec             # PyInstaller desktop bundle specification
├── Dockerfile                # Multi-arch container image
├── docker-compose.yml        # Docker Compose configuration
├── pyproject.toml            # Python packaging & pipx configuration
├── main.py                   # Starlette ASGI backend & OCR endpoint (POST /ocr)
├── run.sh                    # Server launcher & non-destructive updater
├── requirements.txt          # Python dependencies
├── setup_termux.sh           # Automated Termux installation script (Port 5050)
├── test_ankiconnect.sh       # Bash verification script for AnkiConnect
├── LICENSE                   # BSD 3-Clause License
├── README.md                 # Project documentation & user guide
├── tests/
│   ├── test_api.py           # Backend API unit tests & static mount validation
│   ├── test_ankiconnect.mjs  # AnkiConnect JS client unit tests
│   └── test_line_merging.mjs # Line merging JS tests
└── frontend/
    ├── index.html            # PWA single-page interface
    ├── styles.css            # Dark OLED console styling
    ├── app.js                # UI controller, camera capture, filters & audio cues
    ├── ankiconnect.js        # AnkiConnect API client module & auto-attach polling
    ├── manifest.json         # PWA web app manifest (CardLens)
    ├── sw.js                 # Service Worker (app shell offline caching)
    ├── icons/                # PWA app icons (192x192, 512x512, favicon, icon.ico)
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
<summary><strong>Q: AnkiConnect gives a "Cannot connect" error on PC / Desktop.</strong></summary>

1. **Is Anki running?** Make sure the Anki Desktop application is open on your computer.
2. **Is AnkiConnect installed?** In Anki Desktop, go to **Tools → Add-ons** (`Ctrl+Shift+A`), click **Get Add-ons...**, enter code **`2055492159`**, and restart Anki.
3. **CORS issues?** CardLens includes an automatic local proxy (`/api/ankiconnect`), so browser CORS restrictions are handled automatically out of the box.
4. **Prefer no add-ons?** Switch to **Clipboard Mode** in **⚙️ Settings → Card Mining Workflow** to copy cropped images directly to your clipboard (press `I`) and paste (`Ctrl+V`) into Anki Desktop!
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
