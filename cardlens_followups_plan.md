# CardLens Improvement & Follow-ups Roadmap 🔍🎴

This document outlines prioritized architectural and UX enhancements for **CardLens**, categorized by impact, technical feasibility, and workflow efficiency.

---

## 🎯 Prioritization Matrix

| Feature | Pillar | Priority | Effort | Impact |
| :--- | :--- | :---: | :---: | :---: |
| **Auto-Attach Mode (Background Card Polling)** | Workflow Speed | **P0** | Low | High |
| **Image Pre-processing Filters (Contrast / Glare)** | OCR Accuracy | **P0** | Medium | High |
| **Recent Crops History & Re-attach Drawer** | User Safety / QoL | **P1** | Low | Medium |
| **Desktop Keyboard Shortcuts & Modal Esc** | Desktop QoL | **P1** | Very Low | Medium |
| **Custom Field Formatting Templates** | Customization | **P1** | Very Low | Medium |
| **Audio Feedback (Web Audio Clicks & Chimes)** | Ergonomics | **P1** | Very Low | Medium |
| **Multi-Deck Profiles (Gaming vs Manga vs Novels)** | Customization | **P2** | Low | Medium |
| **Live In-App Camera Viewfinder (`getUserMedia`)** | Mobile Ergonomics | **P2** | Medium | High |
| **Offline OCR Engine Fallback (`manga-ocr`)** | Reliability | **P2** | High | High |

---

## 🛠️ Phase 0: Foundational Fixes & Prerequisites (Immediate)

Before layering advanced polling and vision filters, address 3 minor bugs discovered in the core codebase:

1. **Crop Dimension Guard ([`app.js`](file:///D:/Projects/console-capture/frontend/app.js)):** Validate cropped canvas dimensions (`width >= 16 && height >= 16`) before sending `POST /ocr`. Prevents zero/sub-pixel accidental taps from hitting `chrome-lens-py` with an unhandled 400 `LensImageError`.
2. **Wizard Auto-Detect Select Bug ([`app.js#L562`](file:///D:/Projects/console-capture/frontend/app.js#L562)):** `autoDetectRecentCard(isWizard = true)` currently replaces the entire `<select>` list of decks with a 1-item array containing only the detected deck. Keep the full list of decks and set `.value = res.deckName`.
3. **Empty Deck String Fallback ([`ankiconnect.js#L10`](file:///D:/Projects/console-capture/frontend/ankiconnect.js#L10)):** `localStorage.getItem('anki_deck') || 'Mining'` converts an empty deck string `""` back to `'Mining'`. Support searching across all decks if explicitly set to empty (`deck: null` or check `!== null`).

---

## 🚀 Pillar 1: Mining Speed & Automation

### 1.1 Auto-Attach Card Polling (P0)
- **Current Flow:** User crops $\rightarrow$ clicks "Extract Text" $\rightarrow$ taps word in Yomitan to create card $\rightarrow$ clicks "Attach Image to Card".
- **Proposed Flow:** User toggles **"Auto-Attach"** ON (setting persisted in `localStorage`).
  1. **Pre-Poll ID Snapshot:** The moment OCR returns extracted text, CardLens queries `findNotes` on `http://localhost:8765` for target deck cards (`deck:"<deck>" added:1` with fallback to `added:1`) and records a `Set` of all existing note IDs.
     > *Note:* Snapshotting avoids false-positive attachments caused by `added:1` returning cards previously mined earlier in the day.
  2. **Polling Loop:** CardLens begins polling every 1.5 seconds for up to 45 seconds.
  3. **Diff Detection:** On each poll, it queries `findNotes` again and computes `newIDs = currentIDs.filter(id => !snapshotSet.has(id))`.
  4. **Auto-Attach Execution:** When `newIDs.length > 0`, CardLens selects the newest note ID, executes `storeMediaFile` + `updateNoteFields`, terminates polling, and displays a floating success toast:  
     `✅ Auto-attached to "冒険" (Note #12345)`.
  5. **UI State & Cancel UX:** The action dock shows an animated pulsing indicator (`⏳ Waiting for Yomitan card... [Cancel]`) allowing the user to abort polling at any time. If 45s elapses without a new note, polling times out cleanly and leaves the manual "Attach Image" button active.

### 1.2 Custom Field Formatting (P1)
- Allow customizable HTML wrapper templates in Settings modal:
  - **Default:** `<img src="{filename}">`
  - **Centered block:** `<div class="card-screenshot" align="center"><img src="{filename}" loading="lazy"></div>`
  - **Overlay / Collapsible:** `<details><summary>Screenshot</summary><img src="{filename}"></details>`

---

## 🔬 Pillar 2: OCR Accuracy & Glare Reduction

### 2.1 Canvas Pre-processing Filters with Live Preview (P0)
Photos of Switch OLED/LCD screens often introduce reflections, glare, or subpixel moiré that degrades OCR accuracy.
- **Client-Side Toggle Bar in Cropper UI:**
  - **High Contrast:** Stretches luminance histogram on the canvas (`contrast(140%) brightness(105%)`).
  - **Sharpen:** 3x3 convolution kernel to crisp up small kanji strokes.
  - **Invert:** Switches white-on-black dialogue boxes to dark-on-light for engines optimized for print.
  - **Grayscale:** Drops colored background noise in stylized RPG text bubbles.
- **Live Preview:** Applying a filter immediately updates the Cropper preview canvas so the user can visually assess readability *before* pressing "Extract Text".

### 2.2 Local Offline OCR Fallback (`manga-ocr`) (P2)
- Secondary OCR backend in `main.py` using `manga-ocr` or `easyocr`:
  - If Google Lens endpoint fails (network offline or upstream schema break), automatically fallback to local neural OCR.
  - Optimized for Japanese game dialogue and vertical manga typography.

---

## 📱 Pillar 3: Mobile & Desktop Ergonomics

### 3.1 Audio Feedback (Clicks & Chimes via Web Audio) (P1)
- Zero-dependency synthetic Web Audio oscillator cues (works fully offline):
  - **Subtle Wood/Switch Click (20ms):** Filter chip selection, crop rotation, new capture, auto-attach toggle.
  - **Ascending Double Blip (70ms):** OCR text extraction completed.
  - **Harmonic Chime (C5 $\rightarrow$ E5 $\rightarrow$ G5):** Card image attachment success (both auto and manual) and settings saved.
  - **Low Boop (120ms):** Error alerts (crop too small, OCR error, AnkiConnect unreachable).
  - **User Preference:** Toggleable in Settings modal via "Sound feedback (clicks & beeps)".

### 3.2 In-App Live Camera Viewfinder (P2)
- Optional direct in-browser viewfinder using `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })`:
  - Eliminates the system camera app transition round-trip.
  - Shows live camera feed with an adjustable translucent crop rectangle.
  - Tap once $\rightarrow$ freezes frame to canvas $\rightarrow$ launches OCR.

---

## 🛡️ Pillar 4: Safety, History & Desktop Ergonomics

### 4.1 Recent Crops History & Re-attach Drawer (P1)
- Sliding side drawer storing the last 5 cropped images in **IndexedDB** (`cardlens_db` / `crops_store`).
  > *Note:* Uses IndexedDB rather than `sessionStorage` because Android OS kills background PWA processes during memory pressure, which erases `sessionStorage`. IndexedDB persists across app restarts.
  - **Re-attach to Card:** Allows re-using the same dialogue crop when mining multiple words from a single sentence.
  - **Undo / Reassign:** Re-assign crop to an earlier card if attached to the wrong note.

### 4.2 Desktop Keyboard Shortcuts & Accessibility (P1)
For desktop users capturing from PC visual novels, emulators, or manga readers:
- **Clipboard Paste:** `Ctrl+V` pastes images directly from clipboard into cropper (already wired via DOM `paste`).
- **Shortcuts (active only when no `<input>`, `<textarea>`, or `<select>` is focused):**
  - `Enter` / `Space`: Submit crop & run OCR
  - `R`: Rotate 90° clockwise
  - `Shift+R`: Rotate 90° counter-clockwise
  - `A`: Attach image to card (manual mode)
  - `N`: New capture (reset to stage 1)
  - `Esc`: Close open modal / cancel crop / cancel polling

### 4.3 Multi-Deck Profiles (P2)
- Allow saving and switching between named configuration profiles:
  - **Schema:**
    ```json
    {
      "id": "profile_gaming",
      "name": "Switch Gaming",
      "deck": "Japanese::Mining",
      "pictureField": "Picture",
      "ocrLanguage": "ja",
      "formatTemplate": "<img src=\"{filename}\">"
    }
    ```
  - Quick profile switcher dropdown in the app header.

---

## 🗓️ Implementation Phases

```mermaid
flowchart TD
    subgraph Phase 0: Prerequisite Fixes
        P0_1["Crop Dimension Validation"]
        P0_2["Wizard Select Option Fix"]
        P0_3["Empty Deck Fallback Fix"]
    end

    subgraph Phase 1: High-Speed Mining
        A1["Auto-Attach (ID Snapshot Polling)"]
        A2["Canvas Filters (Contrast/Sharpen/Preview)"]
        A3["Custom Field Formatting"]
        A4["Audio Feedback (Web Audio Clicks/Chimes)"]
    end

    subgraph Phase 2: Safety & Desktop Ergonomics
        B1["Recent Crops Drawer (IndexedDB)"]
        B2["Desktop Hotkeys (Focus-Guarded) & Esc"]
        B3["Multi-Deck Profiles Schema"]
    end

    subgraph Phase 3: Advanced Vision
        C1["Live In-App Viewfinder (getUserMedia)"]
        C2["Offline Manga-OCR Fallback"]
    end

    Phase 0 --> Phase 1
    Phase 1 --> Phase 2
    Phase 2 --> Phase 3
```
