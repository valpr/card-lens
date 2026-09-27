/**
 * Console Capture - Main Application Controller
 */

// Application State
let cropper = null;
let currentCroppedBase64 = null;
let currentOcrText = '';
let rawOcrText = '';
let isLinesMerged = false;
let currentFilter = 'normal';
let isAutoAttachEnabled = false;
let pollingInterval = null;
let captureBaselineNoteIds = new Set();
let attachedNoteIds = new Set();
let isPolling = false;
let isEditingOcr = false;

// Text Focus (Box) State
let currentCropMode = 'crop'; // 'crop' | 'trace'
let traceBounds = null; // { minX, minY, maxX, maxY } in container px
let isDrawingTrace = false;
let traceStartPoint = null; // { x, y } where drag started
let traceEndPoint = null; // { x, y } current drag position

// DOM Elements
const stages = {
  capture: document.getElementById('captureSection'),
  crop: document.getElementById('cropSection'),
  result: document.getElementById('resultSection')
};

const elements = {
  cameraInput: document.getElementById('cameraInput'),
  galleryInput: document.getElementById('galleryInput'),
  dropZone: document.getElementById('dropZone'),
  
  // Crop & Trace
  btnModeCrop: document.getElementById('btnModeCrop'),
  btnModeTrace: document.getElementById('btnModeTrace'),
  traceActiveBadge: document.getElementById('traceActiveBadge'),
  imageToCrop: document.getElementById('imageToCrop'),
  traceCanvas: document.getElementById('traceCanvas'),
  traceGuide: document.getElementById('traceGuide'),
  btnClearTrace: document.getElementById('btnClearTrace'),
  filterChips: document.getElementById('filterChips'),
  btnRotateLeft: document.getElementById('btnRotateLeft'),
  btnRotateRight: document.getElementById('btnRotateRight'),
  btnResetCrop: document.getElementById('btnResetCrop'),
  btnCancelCrop: document.getElementById('btnCancelCrop'),
  btnSubmitCrop: document.getElementById('btnSubmitCrop'),

  loadingIndicator: document.getElementById('loadingIndicator'),
  loadingMessage: document.getElementById('loadingMessage'),
  ocrCard: document.getElementById('ocrCard'),
  ocrText: document.getElementById('ocrText'),
  ocrTextContainer: document.getElementById('ocrTextContainer'),
  ocrTextInput: document.getElementById('ocrTextInput'),
  ocrEditHint: document.getElementById('ocrEditHint'),
  detectedLangBadge: document.getElementById('detectedLangBadge'),
  focusedOcrBadge: document.getElementById('focusedOcrBadge'),
  btnToggleAutoAttach: document.getElementById('btnToggleAutoAttach'),
  autoAttachStateText: document.getElementById('autoAttachStateText'),
  pollingBanner: document.getElementById('pollingBanner'),
  pollingCountdown: document.getElementById('pollingCountdown'),
  btnCancelPolling: document.getElementById('btnCancelPolling'),
  btnToggleMergeLines: document.getElementById('btnToggleMergeLines'),
  btnEditOcrText: document.getElementById('btnEditOcrText'),
  btnCopyText: document.getElementById('btnCopyText'),
  cropPreviewImg: document.getElementById('cropPreviewImg'),
  btnAttachAnki: document.getElementById('btnAttachAnki'),
  btnAdjustCrop: document.getElementById('btnAdjustCrop'),
  btnNewCapture: document.getElementById('btnNewCapture'),

  btnSettings: document.getElementById('btnSettings'),
  btnSettingsCrop: document.getElementById('btnSettingsCrop'),
  btnSettingsResult: document.getElementById('btnSettingsResult'),
  appHeader: document.querySelector('.app-header'),
  settingsModal: document.getElementById('settingsModal'),
  btnCloseSettings: document.getElementById('btnCloseSettings'),
  modalBackdrop: document.getElementById('modalBackdrop'),
  settingsForm: document.getElementById('settingsForm'),
  inputAnkiUrl: document.getElementById('inputAnkiUrl'),
  inputAnkiDeck: document.getElementById('inputAnkiDeck'),
  inputAnkiField: document.getElementById('inputAnkiField'),
  inputFormatTemplate: document.getElementById('inputFormatTemplate'),
  inputAutoAttach: document.getElementById('inputAutoAttach'),
  inputAutoMergeLines: document.getElementById('inputAutoMergeLines'),
  inputSoundFeedback: document.getElementById('inputSoundFeedback'),
  selectOcrLang: document.getElementById('selectOcrLang'),
  btnTestAnki: document.getElementById('btnTestAnki'),

  // Settings Quick Tools
  settingsYomitanInput: document.getElementById('settingsYomitanInput'),
  btnSettingsAutoDetect: document.getElementById('btnSettingsAutoDetect'),
  btnFetchAnkiData: document.getElementById('btnFetchAnkiData'),
  deckList: document.getElementById('deckList'),
  fieldList: document.getElementById('fieldList'),
  btnOpenWizardFromSettings: document.getElementById('btnOpenWizardFromSettings'),

  // Setup Wizard
  setupWizardModal: document.getElementById('setupWizardModal'),
  wizardBackdrop: document.getElementById('wizardBackdrop'),
  btnSkipWizard: document.getElementById('btnSkipWizard'),
  btnSkipWizardBottom: document.getElementById('btnSkipWizardBottom'),
  wizardYomitanFileInput: document.getElementById('wizardYomitanFileInput'),
  wizardDropZone: document.getElementById('wizardDropZone'),
  yomitanPreviewBox: document.getElementById('yomitanPreviewBox'),
  yomitanPreviewDeck: document.getElementById('yomitanPreviewDeck'),
  yomitanPreviewFieldSelect: document.getElementById('yomitanPreviewFieldSelect'),
  yomitanPreviewModel: document.getElementById('yomitanPreviewModel'),
  btnApplyYomitanConfig: document.getElementById('btnApplyYomitanConfig'),
  btnWizardAutoDetect: document.getElementById('btnWizardAutoDetect'),
  wizardDeckSelect: document.getElementById('wizardDeckSelect'),
  wizardFieldSelect: document.getElementById('wizardFieldSelect'),
  btnApplyAnkiDiscovery: document.getElementById('btnApplyAnkiDiscovery'),

  toastContainer: document.getElementById('toastContainer')
};

let pendingYomitanConfig = null;

// ==========================================
// Web Audio Feedback (Clicks & Chimes)
// ==========================================
let audioCtx = null;
let isSoundEnabled = localStorage.getItem('sound_feedback') !== 'false';

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Pre-unlock AudioContext on first touch/click
window.addEventListener('pointerdown', () => getAudioContext(), { once: true });

function playSound(type = 'click') {
  if (!isSoundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    switch (type) {
      case 'click':
      case 'tick':
        // Gentle wood-block / Switch click (short sine drop)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.02);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
        osc.start(now);
        osc.stop(now + 0.02);
        break;

      case 'ocr':
      case 'pop':
        // Soft ascending two-tone blip
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.07); // A5
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
        osc.start(now);
        osc.stop(now + 0.07);
        break;

      case 'success':
        // Cheerful harmonic chime (C5 -> E5 -> G5)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.06);
        osc.frequency.setValueAtTime(783.99, now + 0.12);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.28);
        break;

      case 'error':
        // Muted low boop
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(130, now + 0.12);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
        break;
    }
  } catch (_) {}
}

// ==========================================
// Initialization & PWA
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  initServiceWorker();
  initEventListeners();
  initFilterControls();
  initTraceControls();
  initKeyboardShortcuts();
  loadSavedSettings();
  checkFirstTimeSetup();
});

function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registered with scope:', reg.scope);
          // Check for service worker updates immediately on page load
          reg.update().catch(() => {});
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration failed:', err);
        });

      // Reload page once if a new service worker takes over to ensure UI is fresh
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    });
  }
}

// ==========================================
// UI Stage Switching
// ==========================================
function switchStage(stageName) {
  Object.keys(stages).forEach((key) => {
    if (key === stageName) {
      stages[key].classList.add('active');
    } else {
      stages[key].classList.remove('active');
    }
  });

  if (stageName !== 'result') {
    stopAutoAttachPolling();
  }

  // Automatically hide the header when engaging with crop or result stages, restore on capture stage
  const header = elements.appHeader || document.querySelector('.app-header');
  if (header) {
    if (stageName === 'capture') {
      header.classList.remove('header-hidden');
    } else {
      header.classList.add('header-hidden');
    }
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// Toast Notifications
// ==========================================
function showToast(message, type = 'info', duration = 3500) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ==========================================
// Image Enhancement Filters
// ==========================================
function initFilterControls() {
  if (!elements.filterChips) return;
  const chips = elements.filterChips.querySelectorAll('.filter-chip');
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      chips.forEach((c) => {
        c.classList.remove('active');
        c.setAttribute('aria-checked', 'false');
      });
      chip.classList.add('active');
      chip.setAttribute('aria-checked', 'true');
      currentFilter = chip.dataset.filter || 'normal';
      applyFilterPreview(currentFilter);
      playSound('click');
    });
  });
}

function applyFilterPreview(filter) {
  let cssFilter = 'none';
  switch (filter) {
    case 'contrast':
      cssFilter = 'contrast(160%) brightness(105%)';
      break;
    case 'sharpen':
      cssFilter = 'contrast(125%) brightness(102%) drop-shadow(0 0 1px #000)';
      break;
    case 'invert':
      cssFilter = 'invert(1)';
      break;
    case 'grayscale':
      cssFilter = 'grayscale(1) contrast(130%)';
      break;
    case 'normal':
    default:
      cssFilter = 'none';
      break;
  }
  elements.imageToCrop.style.filter = cssFilter;
  const viewBoxImg = document.querySelector('.cropper-view-box img');
  if (viewBoxImg) {
    viewBoxImg.style.filter = cssFilter;
  }
}

function applyCanvasFilter(canvas, filter) {
  if (filter === 'normal') return canvas;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;
  const len = d.length;

  if (filter === 'grayscale') {
    for (let i = 0; i < len; i += 4) {
      const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(imgData, 0, 0);
  } else if (filter === 'invert') {
    for (let i = 0; i < len; i += 4) {
      d[i] = 255 - d[i];
      d[i + 1] = 255 - d[i + 1];
      d[i + 2] = 255 - d[i + 2];
    }
    ctx.putImageData(imgData, 0, 0);
  } else if (filter === 'contrast') {
    const factor = (259 * (140 + 255)) / (255 * (259 - 140));
    for (let i = 0; i < len; i += 4) {
      d[i] = Math.min(255, Math.max(0, factor * (d[i] - 128) + 128));
      d[i + 1] = Math.min(255, Math.max(0, factor * (d[i + 1] - 128) + 128));
      d[i + 2] = Math.min(255, Math.max(0, factor * (d[i + 2] - 128) + 128));
    }
    ctx.putImageData(imgData, 0, 0);
  } else if (filter === 'sharpen') {
    const src = new Uint8ClampedArray(d);
    const w = canvas.width;
    const h = canvas.height;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          const up = ((y - 1) * w + x) * 4 + c;
          const down = ((y + 1) * w + x) * 4 + c;
          const left = (y * w + (x - 1)) * 4 + c;
          const right = (y * w + (x + 1)) * 4 + c;
          const val = 5 * src[idx + c] - src[up] - src[down] - src[left] - src[right];
          d[idx + c] = Math.min(255, Math.max(0, val));
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }
  return canvas;
}

// ==========================================
// Auto-Attach Polling Management
// ==========================================
async function startAutoAttachPolling() {
  stopAutoAttachPolling();

  try {
    const existingIds = await AnkiConnect.getRecentNoteIds();
    // Establish baseline snapshot if not already initialized for this capture
    if (!captureBaselineNoteIds || captureBaselineNoteIds.size === 0) {
      captureBaselineNoteIds = new Set(existingIds);
    }
  } catch (e) {
    console.warn('Could not take AnkiConnect note snapshot:', e);
  }

  isPolling = true;
  updatePollingBannerText();
  elements.pollingBanner.classList.remove('hidden');

  updateAttachButtonState();
  resumeAutoAttachPolling();
}

function updatePollingBannerText() {
  if (!elements.pollingCountdown) return;
  if (attachedNoteIds.size > 0) {
    elements.pollingCountdown.textContent = `✓ Auto-attached to ${attachedNoteIds.size} card(s). Waiting for more in Yomitan...`;
  } else {
    elements.pollingCountdown.textContent = 'Auto-attach active. Tap words in Yomitan to create cards.';
  }
}

function updateAttachButtonState() {
  if (!elements.btnAttachAnki) return;
  elements.btnAttachAnki.disabled = false;
  if (attachedNoteIds.size > 0) {
    elements.btnAttachAnki.innerHTML = `<span class="btn-text">✓ Attached (${attachedNoteIds.size}) · Add Next</span>`;
  } else {
    elements.btnAttachAnki.innerHTML = '<span class="btn-text">📎 Attach Image to Card</span>';
  }
}

function resumeAutoAttachPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  pollingInterval = setInterval(async () => {
    if (!isPolling || document.hidden) return;
    try {
      const currentIds = await AnkiConnect.getRecentNoteIds();
      const newIds = currentIds.filter(id => !captureBaselineNoteIds.has(id) && !attachedNoteIds.has(id));
      if (newIds.length > 0) {
        // Sort ascending (oldest first) so cards are attached in creation sequence
        newIds.sort((a, b) => a - b);
        for (const targetNoteId of newIds) {
          const result = await AnkiConnect.attachImageToNote(targetNoteId, currentCroppedBase64);
          attachedNoteIds.add(targetNoteId);
          playSound('success');

          const label = result.noteName ? `"${result.noteName}"` : `Note #${result.noteId}`;
          showToast(`✅ Auto-attached to ${label} (${result.fieldUsed}) [Card #${attachedNoteIds.size}]`, 'success', 5000);
        }

        updateAttachButtonState();
        updatePollingBannerText();
      }
    } catch (e) {
      console.warn('Polling check error:', e);
    }
  }, 1500);
}

function stopAutoAttachPolling() {
  isPolling = false;
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  if (elements.pollingBanner) {
    elements.pollingBanner.classList.add('hidden');
  }
}

function handleCancelPolling() {
  stopAutoAttachPolling();
  updateAttachButtonState();
  playSound('click');
  showToast('Auto-attach paused. You can still attach manually.', 'info');
}

function toggleAutoAttach() {
  isAutoAttachEnabled = !isAutoAttachEnabled;
  updateAutoAttachUI();
  localStorage.setItem('anki_auto_attach', isAutoAttachEnabled ? 'true' : 'false');
  playSound('click');
  showToast(`Auto-Attach turned ${isAutoAttachEnabled ? 'ON' : 'OFF'}`, 'info');

  if (isAutoAttachEnabled && currentOcrText && stages.result.classList.contains('active')) {
    startAutoAttachPolling();
  } else if (!isAutoAttachEnabled && isPolling) {
    handleCancelPolling();
  }
}

function updateAutoAttachUI() {
  if (isAutoAttachEnabled) {
    elements.btnToggleAutoAttach.classList.add('active');
    elements.autoAttachStateText.textContent = 'ON';
    if (elements.inputAutoAttach) elements.inputAutoAttach.checked = true;
  } else {
    elements.btnToggleAutoAttach.classList.remove('active');
    elements.autoAttachStateText.textContent = 'OFF';
    if (elements.inputAutoAttach) elements.inputAutoAttach.checked = false;
  }
}

// ==========================================
// Keyboard Shortcuts & Escape Handler
// ==========================================
function initKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    const isTyping = e.target.matches('input, textarea, select');

    if (e.key === 'Escape') {
      if (isEditingOcr) {
        cancelOcrEdit();
        e.preventDefault();
        return;
      }
      if (!elements.settingsModal.classList.contains('hidden')) {
        closeSettings();
        e.preventDefault();
        return;
      }
      if (!elements.setupWizardModal.classList.contains('hidden')) {
        closeSetupWizard(false);
        e.preventDefault();
        return;
      }
      if (isPolling) {
        handleCancelPolling();
        e.preventDefault();
        return;
      }
      if (stages.crop.classList.contains('active')) {
        destroyCropper();
        switchStage('capture');
        e.preventDefault();
        return;
      }
      if (stages.result.classList.contains('active')) {
        handleNewCapture();
        e.preventDefault();
        return;
      }
    }

    if (isTyping) return;

    if (stages.crop.classList.contains('active')) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleCropSubmit();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        if (e.shiftKey) {
          cropper && cropper.rotate(-90);
        } else {
          cropper && cropper.rotate(90);
        }
        playSound('click');
      }
    } else if (stages.result.classList.contains('active')) {
      if ((e.key === 'a' || e.key === 'A') && !elements.btnAttachAnki.disabled) {
        e.preventDefault();
        handleAttachToAnki();
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        toggleEditOcr();
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        handleAdjustCrop();
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        handleNewCapture();
      }
    }
  });
}

// ==========================================
// Event Listeners
// ==========================================
function initEventListeners() {
  // File inputs
  elements.cameraInput.addEventListener('change', handleFileInput);
  elements.galleryInput.addEventListener('change', handleFileInput);

  // Drag and drop
  elements.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.dropZone.classList.add('dragover');
  });
  elements.dropZone.addEventListener('dragleave', () => {
    elements.dropZone.classList.remove('dragover');
  });
  elements.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.dropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      loadImageFromFile(e.dataTransfer.files[0]);
    }
  });

  // Clipboard paste support
  window.addEventListener('paste', (e) => {
    if (e.clipboardData && e.clipboardData.items) {
      for (const item of e.clipboardData.items) {
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            loadImageFromFile(file);
            showToast('Image pasted from clipboard', 'info');
            break;
          }
        }
      }
    }
  });

  // Crop Controls
  elements.btnRotateLeft.addEventListener('click', () => {
    if (cropper) {
      cropper.rotate(-90);
      playSound('click');
    }
  });
  elements.btnRotateRight.addEventListener('click', () => {
    if (cropper) {
      cropper.rotate(90);
      playSound('click');
    }
  });
  elements.btnResetCrop.addEventListener('click', () => {
    if (cropper) {
      cropper.reset();
      clearTrace();
      playSound('click');
    }
  });
  elements.btnCancelCrop.addEventListener('click', () => {
    destroyCropper();
    switchStage('capture');
  });
  elements.btnSubmitCrop.addEventListener('click', handleCropSubmit);

  // Results Controls
  if (elements.btnToggleMergeLines) elements.btnToggleMergeLines.addEventListener('click', toggleMergeLines);
  if (elements.btnEditOcrText) elements.btnEditOcrText.addEventListener('click', toggleEditOcr);
  elements.btnCopyText.addEventListener('click', copyOcrText);
  elements.btnAttachAnki.addEventListener('click', handleAttachToAnki);
  if (elements.btnAdjustCrop) elements.btnAdjustCrop.addEventListener('click', handleAdjustCrop);
  elements.btnNewCapture.addEventListener('click', handleNewCapture);
  elements.btnToggleAutoAttach.addEventListener('click', toggleAutoAttach);
  elements.btnCancelPolling.addEventListener('click', handleCancelPolling);

  if (elements.ocrTextInput) {
    elements.ocrTextInput.addEventListener('input', () => {
      elements.ocrTextInput.style.height = 'auto';
      elements.ocrTextInput.style.height = Math.max(90, elements.ocrTextInput.scrollHeight) + 'px';
    });

    elements.ocrTextInput.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        saveOcrEdit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelOcrEdit();
      }
    });
  }

  // Battery safeguard: Pause polling when page is in background, resume when active
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (isPolling && pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
    } else {
      if (isPolling && !pollingInterval && stages.result.classList.contains('active')) {
        resumeAutoAttachPolling();
      }
    }
  });

  // Settings Modal Controls
  if (elements.btnSettings) elements.btnSettings.addEventListener('click', openSettings);
  if (elements.btnSettingsCrop) elements.btnSettingsCrop.addEventListener('click', openSettings);
  if (elements.btnSettingsResult) elements.btnSettingsResult.addEventListener('click', openSettings);
  elements.btnCloseSettings.addEventListener('click', closeSettings);
  elements.modalBackdrop.addEventListener('click', closeSettings);
  elements.settingsForm.addEventListener('submit', saveSettings);
  elements.btnTestAnki.addEventListener('click', testAnkiConnection);

  // Settings Quick Tools
  elements.settingsYomitanInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) handleYomitanFile(e.target.files[0], false);
  });
  elements.btnSettingsAutoDetect.addEventListener('click', () => autoDetectRecentCard(false));
  elements.btnFetchAnkiData.addEventListener('click', loadAnkiDecksAndFields);
  elements.btnOpenWizardFromSettings.addEventListener('click', () => {
    closeSettings();
    openSetupWizard();
  });

  // Setup Wizard
  elements.btnSkipWizard.addEventListener('click', () => closeSetupWizard(true));
  elements.btnSkipWizardBottom.addEventListener('click', () => closeSetupWizard(true));
  elements.wizardBackdrop.addEventListener('click', () => closeSetupWizard(false));
  elements.wizardYomitanFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) handleYomitanFile(e.target.files[0], true);
  });
  elements.btnApplyYomitanConfig.addEventListener('click', applyYomitanConfig);
  elements.btnWizardAutoDetect.addEventListener('click', () => autoDetectRecentCard(true));
  elements.btnApplyAnkiDiscovery.addEventListener('click', applyWizardAnkiSelection);

  // Wizard Drag and Drop
  elements.wizardDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.wizardDropZone.style.borderColor = 'var(--accent-green)';
  });
  elements.wizardDropZone.addEventListener('dragleave', () => {
    elements.wizardDropZone.style.borderColor = '';
  });
  elements.wizardDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.wizardDropZone.style.borderColor = '';
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleYomitanFile(e.dataTransfer.files[0], true);
    }
  });
}

// ==========================================
// Image Loading & Cropping
// ==========================================
function handleFileInput(e) {
  if (e.target.files && e.target.files[0]) {
    loadImageFromFile(e.target.files[0]);
    // Reset file input so same file can be picked again if needed
    e.target.value = '';
  }
}

function loadImageFromFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('Please select a valid image file.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    initCropper(dataUrl);
  };
  reader.onerror = () => {
    showToast('Failed to read image file.', 'error');
  };
  reader.readAsDataURL(file);
}

function initCropper(imageUrl) {
  destroyCropper();
  elements.imageToCrop.src = imageUrl;
  switchStage('crop');

  cropper = new Cropper(elements.imageToCrop, {
    viewMode: 1,
    dragMode: 'move',
    autoCropArea: 0.85,
    restore: false,
    guides: true,
    center: true,
    highlight: false,
    cropBoxMovable: true,
    cropBoxResizable: true,
    toggleDragModeOnDblclick: false,
    responsive: true,
    ready() {
      resizeTraceCanvas();
      setCropMode('crop');
      clearTrace();
    },
    crop() {
      renderTraceCanvas();
    }
  });
}

function destroyCropper() {
  if (cropper) {
    cropper.destroy();
    cropper = null;
  }
  clearTrace();
  setCropMode('crop');
  elements.imageToCrop.src = '';
  elements.imageToCrop.style.filter = 'none';
  currentFilter = 'normal';
  if (elements.filterChips) {
    const chips = elements.filterChips.querySelectorAll('.filter-chip');
    chips.forEach((c) => {
      const isNorm = c.dataset.filter === 'normal';
      c.classList.toggle('active', isNorm);
      c.setAttribute('aria-checked', isNorm ? 'true' : 'false');
    });
  }
}

// ==========================================
// Box Text Focus Controller
// ==========================================
function initTraceControls() {
  if (!elements.traceCanvas) return;

  const canvas = elements.traceCanvas;

  canvas.addEventListener('pointerdown', (e) => {
    if (currentCropMode !== 'trace') return;
    canvas.setPointerCapture(e.pointerId);
    isDrawingTrace = true;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    traceStartPoint = { x, y };
    traceEndPoint = { x, y };
    renderTraceCanvas();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!isDrawingTrace || !traceStartPoint) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    traceEndPoint = { x, y };
    renderTraceCanvas();
  });

  const finishGesture = () => {
    if (!isDrawingTrace) return;
    isDrawingTrace = false;
    calculateTraceBounds();
    traceStartPoint = null;
    traceEndPoint = null;
    renderTraceCanvas();
    updateTraceUI();
    playSound('pop');
  };

  canvas.addEventListener('pointerup', finishGesture);
  canvas.addEventListener('pointercancel', finishGesture);

  if (elements.btnModeCrop) {
    elements.btnModeCrop.addEventListener('click', () => setCropMode('crop'));
  }
  if (elements.btnModeTrace) {
    elements.btnModeTrace.addEventListener('click', () => setCropMode('trace'));
  }
  if (elements.btnClearTrace) {
    elements.btnClearTrace.addEventListener('click', clearTrace);
  }

  window.addEventListener('resize', () => {
    if (stages.crop.classList.contains('active')) {
      resizeTraceCanvas();
    }
  });
}

function resizeTraceCanvas() {
  if (!elements.traceCanvas || !elements.imageToCrop) return;
  const wrapper = elements.imageToCrop.parentElement;
  if (!wrapper) return;

  const rect = wrapper.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  elements.traceCanvas.width = rect.width * dpr;
  elements.traceCanvas.height = rect.height * dpr;
  elements.traceCanvas.style.width = `${rect.width}px`;
  elements.traceCanvas.style.height = `${rect.height}px`;

  const ctx = elements.traceCanvas.getContext('2d');
  ctx.scale(dpr, dpr);
  renderTraceCanvas();
}

function setCropMode(mode) {
  currentCropMode = mode;
  if (mode === 'crop') {
    if (elements.btnModeCrop) {
      elements.btnModeCrop.classList.add('active');
      elements.btnModeCrop.setAttribute('aria-selected', 'true');
    }
    if (elements.btnModeTrace) {
      elements.btnModeTrace.classList.remove('active');
      elements.btnModeTrace.setAttribute('aria-selected', 'false');
    }
    if (elements.traceCanvas) {
      elements.traceCanvas.classList.remove('active');
    }
    if (elements.traceGuide) {
      elements.traceGuide.classList.add('hidden');
    }
    if (cropper) {
      cropper.enable();
    }
  } else {
    if (elements.btnModeCrop) {
      elements.btnModeCrop.classList.remove('active');
      elements.btnModeCrop.setAttribute('aria-selected', 'false');
    }
    if (elements.btnModeTrace) {
      elements.btnModeTrace.classList.add('active');
      elements.btnModeTrace.setAttribute('aria-selected', 'true');
    }
    if (elements.traceCanvas) {
      elements.traceCanvas.classList.add('active');
    }
    if (elements.traceGuide) {
      elements.traceGuide.classList.remove('hidden');
    }
    resizeTraceCanvas();
    if (cropper) {
      cropper.disable();
    }
  }
  renderTraceCanvas();
}

function calculateTraceBounds() {
  if (!traceStartPoint || !traceEndPoint) {
    return; // Don't wipe existing bounds on an accidental micro-tap
  }

  let minX = Math.min(traceStartPoint.x, traceEndPoint.x);
  let minY = Math.min(traceStartPoint.y, traceEndPoint.y);
  let maxX = Math.max(traceStartPoint.x, traceEndPoint.x);
  let maxY = Math.max(traceStartPoint.y, traceEndPoint.y);

  // Minimum gesture threshold (10px) to prevent tiny accidental taps from creating boxes
  if (maxX - minX < 10 || maxY - minY < 10) {
    return;
  }

  // Clamp within outer crop box
  if (cropper) {
    const cb = cropper.getCropBoxData();
    if (cb && cb.width > 0 && cb.height > 0) {
      minX = Math.max(cb.left, minX);
      minY = Math.max(cb.top, minY);
      maxX = Math.min(cb.left + cb.width, maxX);
      maxY = Math.min(cb.top + cb.height, maxY);
    }
  }

  if (maxX - minX >= 10 && maxY - minY >= 10) {
    traceBounds = { minX, minY, maxX, maxY };
  }
}

function renderTraceCanvas() {
  if (!elements.traceCanvas) return;
  const ctx = elements.traceCanvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = elements.traceCanvas.width / dpr;
  const h = elements.traceCanvas.height / dpr;

  ctx.clearRect(0, 0, w, h);

  const cropBox = cropper ? cropper.getCropBoxData() : null;

  // 1. Live Box Dragging (in progress)
  if (isDrawingTrace && traceStartPoint && traceEndPoint) {
    ctx.save();
    const bx = Math.min(traceStartPoint.x, traceEndPoint.x);
    const by = Math.min(traceStartPoint.y, traceEndPoint.y);
    const bw = Math.abs(traceEndPoint.x - traceStartPoint.x);
    const bh = Math.abs(traceEndPoint.y - traceStartPoint.y);

    // Translucent cyan fill
    ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
    ctx.fillRect(bx, by, bw, bh);

    // Dashed border
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);

    // Corner markers
    ctx.setLineDash([]);
    ctx.fillStyle = '#38bdf8';
    const hs = 6;
    ctx.fillRect(bx - hs / 2, by - hs / 2, hs, hs);
    ctx.fillRect(bx + bw - hs / 2, by - hs / 2, hs, hs);
    ctx.fillRect(bx - hs / 2, by + bh - hs / 2, hs, hs);
    ctx.fillRect(bx + bw - hs / 2, by + bh - hs / 2, hs, hs);

    // Real-time dimensions tag
    if (bw > 30 && bh > 20) {
      const dimText = `${Math.round(bw)} × ${Math.round(bh)}`;
      ctx.font = '10px monospace';
      ctx.fillStyle = 'rgba(18, 18, 20, 0.85)';
      const textW = ctx.measureText(dimText).width + 8;
      ctx.fillRect(bx, by + bh + 4, textW, 14);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(dimText, bx + 4, by + bh + 14);
    }
    ctx.restore();
    return;
  }

  // 2. Snapped Focus Area (after gesture finishes)
  if (!isDrawingTrace && traceBounds) {
    const { minX, minY, maxX, maxY } = traceBounds;
    const bx = minX;
    const by = minY;
    const bw = maxX - minX;
    const bh = maxY - minY;

    ctx.save();

    // Spotlight effect: Dim outside focus box inside cropBox
    if (cropBox) {
      ctx.fillStyle = currentCropMode === 'trace' ? 'rgba(0, 0, 0, 0.42)' : 'rgba(0, 0, 0, 0.22)';
      ctx.beginPath();
      // Outer rectangle (cropBox)
      ctx.rect(cropBox.left, cropBox.top, cropBox.width, cropBox.height);
      // Cutout inner focus box (counter-clockwise)
      ctx.rect(bx + bw, by, -bw, bh);
      ctx.fill();
    }

    // Highlight fill over the focused text
    ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.fillRect(bx, by, bw, bh);

    // Dashed focus border
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(bx, by, bw, bh);

    // High-contrast corner brackets (Google Lens style)
    ctx.setLineDash([]);
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#38bdf8';
    const corner = Math.min(12, bw / 3, bh / 3);

    // Top-left
    ctx.beginPath();
    ctx.moveTo(bx, by + corner);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx + corner, by);
    ctx.stroke();

    // Top-right
    ctx.beginPath();
    ctx.moveTo(bx + bw - corner, by);
    ctx.lineTo(bx + bw);
    ctx.lineTo(bx + bw, by + corner);
    ctx.stroke();

    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(bx, by + bh - corner);
    ctx.lineTo(bx, by + bh);
    ctx.lineTo(bx + corner, by + bh);
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(bx + bw - corner, by + bh);
    ctx.lineTo(bx + bw);
    ctx.lineTo(bx + bw, by + bh - corner);
    ctx.stroke();

    // Badge tag: 🎯 OCR Focus
    const tag = '🎯 OCR Focus';
    ctx.font = 'bold 11px sans-serif';
    const tagW = ctx.measureText(tag).width + 12;
    const tagY = Math.max(18, by - 5);

    ctx.fillStyle = 'rgba(18, 18, 20, 0.9)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(bx, tagY - 14, tagW, 16, 4);
    } else {
      ctx.rect(bx, tagY - 14, tagW, 16);
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.fillText(tag, bx + 6, tagY - 2);

    ctx.restore();
  }
}

function updateTraceUI() {
  const hasTrace = traceBounds !== null;
  if (elements.traceActiveBadge) {
    elements.traceActiveBadge.classList.toggle('hidden', !hasTrace);
  }
  if (elements.btnClearTrace) {
    elements.btnClearTrace.classList.toggle('hidden', !hasTrace);
  }
  const guideText = elements.traceGuide?.querySelector('.trace-guide-text');
  if (guideText) {
    guideText.textContent = hasTrace 
      ? '✓ Text focused! Drag again to adjust, or Extract below' 
      : '👆 Drag a box around text to focus';
  }
  const submitText = elements.btnSubmitCrop?.querySelector('.btn-text');
  if (submitText) {
    submitText.textContent = hasTrace ? 'Extract Focused Text ➔' : 'Extract Text ➔';
  }
}

function clearTrace() {
  traceBounds = null;
  traceStartPoint = null;
  traceEndPoint = null;
  isDrawingTrace = false;
  renderTraceCanvas();
  updateTraceUI();
}

// ==========================================
// Crop Submit & OCR API Request
// ==========================================
async function handleCropSubmit() {
  if (!cropper) return;

  // Validate crop dimensions (minimum 16x16px to prevent accidental micro-crops)
  const cropData = cropper.getData();
  if (!cropData || cropData.width < 16 || cropData.height < 16) {
    showToast('Selected crop is too small (minimum 16×16 px).', 'error');
    playSound('error');
    return;
  }

  // Extract outer cropped region as high-resolution canvas (for the Anki card)
  const cardCanvas = cropper.getCroppedCanvas({
    maxWidth: 2048,
    maxHeight: 2048,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high'
  });

  if (!cardCanvas) {
    showToast('Unable to extract cropped area.', 'error');
    playSound('error');
    return;
  }

  // Determine OCR target canvas: Traced sub-region vs full card canvas
  let ocrCanvas = cardCanvas;
  let isTraceUsed = false;

  if (traceBounds && cropper) {
    const cropBox = cropper.getCropBoxData();
    if (cropBox && cropBox.width > 0 && cropBox.height > 0) {
      // Find intersection between trace bounds and crop box
      const interMinX = Math.max(cropBox.left, traceBounds.minX);
      const interMinY = Math.max(cropBox.top, traceBounds.minY);
      const interMaxX = Math.min(cropBox.left + cropBox.width, traceBounds.maxX);
      const interMaxY = Math.min(cropBox.top + cropBox.height, traceBounds.maxY);

      if (interMaxX > interMinX && interMaxY > interMinY) {
        // Calculate relative coordinates inside cropped card canvas
        const normX1 = (interMinX - cropBox.left) / cropBox.width;
        const normY1 = (interMinY - cropBox.top) / cropBox.height;
        const normX2 = (interMaxX - cropBox.left) / cropBox.width;
        const normY2 = (interMaxY - cropBox.top) / cropBox.height;

        // Add 4% margin around focused text so furigana and kanji strokes aren't clipped
        const padX = cardCanvas.width * 0.04;
        const padY = cardCanvas.height * 0.04;

        const subX = Math.max(0, Math.floor(normX1 * cardCanvas.width - padX));
        const subY = Math.max(0, Math.floor(normY1 * cardCanvas.height - padY));
        const subW = Math.min(cardCanvas.width - subX, Math.ceil((normX2 - normX1) * cardCanvas.width + padX * 2));
        const subH = Math.min(cardCanvas.height - subY, Math.ceil((normY2 - normY1) * cardCanvas.height + padY * 2));

        if (subW > 16 && subH > 16) {
          const subCanvas = document.createElement('canvas');
          subCanvas.width = subW;
          subCanvas.height = subH;
          const subCtx = subCanvas.getContext('2d');
          subCtx.drawImage(cardCanvas, subX, subY, subW, subH, 0, 0, subW, subH);
          ocrCanvas = subCanvas;
          isTraceUsed = true;
        }
      }
    }
  }

  // The Card Picture for Anki is ALWAYS the full framed card canvas
  currentCroppedBase64 = cardCanvas.toDataURL('image/jpeg', 0.92);
  elements.cropPreviewImg.src = currentCroppedBase64;

  // Apply pixel enhancement filter to OCR target
  applyCanvasFilter(ocrCanvas, currentFilter);
  const ocrPayload = ocrCanvas.toDataURL('image/jpeg', 0.95);

  // Reset capture session attached notes and establish baseline for this crop
  cancelOcrEdit();
  attachedNoteIds.clear();
  try {
    const existing = await AnkiConnect.getRecentNoteIds();
    captureBaselineNoteIds = new Set(existing);
  } catch (_) {
    captureBaselineNoteIds = new Set();
  }

  // Transition to Results & Loading state
  switchStage('result');
  elements.loadingIndicator.classList.remove('hidden');
  elements.ocrCard.classList.add('hidden');
  updateAttachButtonState();

  if (elements.focusedOcrBadge) {
    elements.focusedOcrBadge.classList.toggle('hidden', !isTraceUsed);
  }

  const ocrLang = localStorage.getItem('ocr_lang') || 'ja';

  try {
    const response = await fetch('/ocr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image: ocrPayload,
        language: ocrLang || null
      })
    });

    if (!response.ok) {
      let errDetail = `Server error (${response.status})`;
      try {
        const errJson = await response.json();
        if (errJson.detail) errDetail = errJson.detail;
      } catch (_) {}
      throw new Error(errDetail);
    }

    const data = await response.json();
    rawOcrText = data.text ? data.text.trim() : '';
    const autoMergePref = localStorage.getItem('anki_auto_merge_lines') === 'true';
    isLinesMerged = autoMergePref;
    applyLineMergeState();

    elements.detectedLangBadge.textContent = (data.detected_language || ocrLang || 'JA').toUpperCase();

    elements.loadingIndicator.classList.add('hidden');
    elements.ocrCard.classList.remove('hidden');

    playSound('ocr');

    if (!rawOcrText) {
      showToast('No text detected in cropped region. Try adjusting your crop.', 'info');
    } else if (isAutoAttachEnabled) {
      startAutoAttachPolling();
    }
  } catch (err) {
    elements.loadingIndicator.classList.add('hidden');
    playSound('error');
    showToast(`OCR Failed: ${err.message}`, 'error', 5000);
    // Return to crop stage so user can retry or adjust crop box
    switchStage('crop');
  }
}

// ==========================================
// Yomitan & AnkiConnect Integration
// ==========================================
async function handleAttachToAnki() {
  if (!currentCroppedBase64) {
    showToast('No cropped image available to attach.', 'error');
    playSound('error');
    return;
  }

  const btn = elements.btnAttachAnki;
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-text">⏳ Checking Anki...</span>';

  try {
    const currentIds = await AnkiConnect.getRecentNoteIds();
    if (!currentIds || currentIds.length === 0) {
      throw new Error('No recent Anki cards found today. Create a card with Yomitan first!');
    }

    // Filter for cards added since this capture began that haven't been attached yet
    const unattachedNewIds = currentIds.filter(id => !captureBaselineNoteIds.has(id) && !attachedNoteIds.has(id));

    let targetNoteId = null;

    if (unattachedNewIds.length > 0) {
      // Pick newest unattached card
      unattachedNewIds.sort((a, b) => b - a);
      targetNoteId = unattachedNewIds[0];
    } else {
      // If all cards created during this capture session were already attached:
      if (attachedNoteIds.size > 0) {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
        playSound('click');
        showToast(`All cards mined for this image (${attachedNoteIds.size}) already have pictures attached. Tap a new word in Yomitan first!`, 'info', 4500);
        return;
      }

      // Check if the latest card in Anki matches the current image text (e.g. photo taken right after mining)
      currentIds.sort((a, b) => b - a);
      const latestNoteId = currentIds[0];
      const noteInfo = await AnkiConnect.getNoteInfo(latestNoteId);
      const fields = noteInfo.fields || {};

      // Check if picture field is already filled
      const config = AnkiConnect.getConfig();
      const picField = config.pictureField;
      let existingPic = '';
      if (picField in fields) {
        existingPic = fields[picField]?.value || '';
      } else {
        const candidate = Object.keys(fields).find(k => /picture|image|photo|screenshot/i.test(k));
        if (candidate) existingPic = fields[candidate]?.value || '';
      }

      // Get expression / first field text
      const firstVal = Object.values(fields)[0]?.value?.replace(/<[^>]+>/g, '').trim() || '';
      const sentenceVal = fields['Sentence']?.value?.replace(/<[^>]+>/g, '').trim() || '';

      const isTextMatch = (firstVal && (currentOcrText.includes(firstVal) || rawOcrText.includes(firstVal))) ||
                          (sentenceVal && (currentOcrText.includes(sentenceVal) || rawOcrText.includes(sentenceVal)));

      if (isTextMatch && !existingPic) {
        // Safe match: note text matches current image OCR text and picture field is empty
        targetNoteId = latestNoteId;
      } else {
        // Overwrite Guard: Stop and warn
        btn.disabled = false;
        btn.innerHTML = originalHtml;
        playSound('error');
        if (existingPic) {
          showToast(`⚠️ No new card detected. Latest card "${firstVal}" already has a picture attached! Mine a new card with Yomitan first.`, 'error', 5500);
        } else {
          showToast(`⚠️ No new card detected for this image! Mine a word with Yomitan first.`, 'error', 5500);
        }
        return;
      }
    }

    btn.innerHTML = '<span class="btn-text">⏳ Attaching...</span>';
    const result = await AnkiConnect.attachImageToNote(targetNoteId, currentCroppedBase64);
    attachedNoteIds.add(targetNoteId);
    playSound('success');

    const label = result.noteName ? `"${result.noteName}"` : `Note #${result.noteId}`;
    showToast(`✅ Image attached to ${label} (${result.fieldUsed}) [Card #${attachedNoteIds.size}]`, 'success', 4500);

    // Briefly show attached status, then update to ready state
    btn.innerHTML = `<span class="btn-text">✓ Attached (${attachedNoteIds.size})</span>`;
    setTimeout(() => {
      if (stages.result.classList.contains('active')) {
        updateAttachButtonState();
      }
    }, 1800);

    updatePollingBannerText();
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
    playSound('error');
    showToast(`Anki Error: ${err.message}`, 'error', 5000);
  }
}

function handleAdjustCrop() {
  stopAutoAttachPolling();
  cancelOcrEdit();
  switchStage('crop');
  playSound('click');
}

function handleNewCapture() {
  stopAutoAttachPolling();
  cancelOcrEdit();
  destroyCropper();
  currentCroppedBase64 = null;
  captureBaselineNoteIds.clear();
  attachedNoteIds.clear();
  rawOcrText = '';
  currentOcrText = '';
  isLinesMerged = false;
  if (elements.btnToggleMergeLines) {
    elements.btnToggleMergeLines.classList.remove('active');
    elements.btnToggleMergeLines.textContent = '☵ Join';
    elements.btnToggleMergeLines.disabled = true;
  }
  elements.ocrText.textContent = '';
  if (elements.ocrTextInput) elements.ocrTextInput.value = '';
  elements.cropPreviewImg.src = '';
  updateAttachButtonState();
  switchStage('capture');
  playSound('click');
}

// ==========================================
// OCR Text Inline Editing
// ==========================================
function toggleEditOcr() {
  if (isEditingOcr) {
    saveOcrEdit();
  } else {
    enterOcrEdit();
  }
}

function enterOcrEdit() {
  if (!stages.result.classList.contains('active')) return;
  isEditingOcr = true;
  if (elements.ocrTextInput) {
    elements.ocrTextInput.value = currentOcrText || rawOcrText;
  }
  if (elements.ocrText) elements.ocrText.classList.add('hidden');
  if (elements.ocrTextInput) elements.ocrTextInput.classList.remove('hidden');
  if (elements.ocrTextContainer) elements.ocrTextContainer.classList.add('editing');
  if (elements.ocrEditHint) elements.ocrEditHint.classList.remove('hidden');

  if (elements.btnEditOcrText) {
    elements.btnEditOcrText.classList.add('active');
    elements.btnEditOcrText.textContent = '✓ Done';
    elements.btnEditOcrText.title = 'Save edited text (Ctrl+Enter)';
  }

  if (elements.ocrTextInput) {
    elements.ocrTextInput.style.height = 'auto';
    elements.ocrTextInput.style.height = Math.max(90, elements.ocrTextInput.scrollHeight) + 'px';
    elements.ocrTextInput.focus();
    const len = elements.ocrTextInput.value.length;
    elements.ocrTextInput.setSelectionRange(len, len);
  }

  playSound('click');
}

function saveOcrEdit() {
  if (!isEditingOcr) return;
  if (elements.ocrTextInput) {
    const newText = elements.ocrTextInput.value.trim();
    rawOcrText = newText;
    applyLineMergeState();
  }

  cancelOcrEdit(false);
  playSound('pop');
  showToast('Text updated! Ready for Yomitan.', 'info', 2500);
}

function cancelOcrEdit(silent = true) {
  isEditingOcr = false;
  if (elements.ocrTextInput) elements.ocrTextInput.classList.add('hidden');
  if (elements.ocrText) elements.ocrText.classList.remove('hidden');
  if (elements.ocrTextContainer) elements.ocrTextContainer.classList.remove('editing');
  if (elements.ocrEditHint) elements.ocrEditHint.classList.add('hidden');

  if (elements.btnEditOcrText) {
    elements.btnEditOcrText.classList.remove('active');
    elements.btnEditOcrText.textContent = '✏️ Edit';
    elements.btnEditOcrText.title = 'Edit extracted text (E)';
  }
}

function copyOcrText() {
  if (!currentOcrText) return;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(currentOcrText)
      .then(() => showToast('Text copied to clipboard!', 'info'))
      .catch(() => fallbackCopyText());
  } else {
    fallbackCopyText();
  }
}

function fallbackCopyText() {
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(elements.ocrText);
  selection.removeAllRanges();
  selection.addRange(range);
  try {
    document.execCommand('copy');
    showToast('Text copied to clipboard!', 'info');
  } catch (err) {
    showToast('Could not copy automatically. Select text manually.', 'error');
  }
}

// ==========================================
// Japanese / Multiline OCR Text Formatting
// ==========================================
function formatMergedLines(text) {
  if (!text) return '';
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) return text.trim();

  let merged = lines[0];
  for (let i = 1; i < lines.length; i++) {
    const prev = lines[i - 1];
    const curr = lines[i];
    // If both ends are alphanumeric ASCII (e.g. English words), join with space
    if (/[a-zA-Z0-9]$/.test(prev) && /^[a-zA-Z0-9]/.test(curr)) {
      merged += ' ' + curr;
    } else {
      // In Japanese / CJK, join seamlessly without spaces
      merged += curr;
    }
  }
  return merged;
}

function toggleMergeLines() {
  if (!rawOcrText) return;
  isLinesMerged = !isLinesMerged;
  applyLineMergeState();
  playSound('click');
  showToast(isLinesMerged ? 'Lines joined for Yomitan' : 'Lines split to original format', 'info', 2000);
}

function applyLineMergeState() {
  if (!elements.btnToggleMergeLines) return;
  const lines = rawOcrText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const hasMultipleLines = lines.length > 1;

  elements.btnToggleMergeLines.disabled = !hasMultipleLines;

  if (isLinesMerged && hasMultipleLines) {
    elements.btnToggleMergeLines.classList.add('active');
    elements.btnToggleMergeLines.textContent = '☵ Split';
    elements.btnToggleMergeLines.title = 'Split back to original line breaks';
    currentOcrText = formatMergedLines(rawOcrText);
  } else {
    elements.btnToggleMergeLines.classList.remove('active');
    elements.btnToggleMergeLines.textContent = '☵ Join';
    elements.btnToggleMergeLines.title = 'Join lines for seamless Yomitan scanning';
    currentOcrText = rawOcrText;
  }

  if (elements.ocrText) {
    elements.ocrText.textContent = currentOcrText || (rawOcrText ? '' : '(No text detected in this region)');
  }
}

// ==========================================
// Settings Modal
// ==========================================
function loadSavedSettings() {
  const config = AnkiConnect.getConfig();
  elements.inputAnkiUrl.value = config.url;
  elements.inputAnkiDeck.value = config.deck;
  elements.inputAnkiField.value = config.pictureField;
  if (elements.inputFormatTemplate) {
    elements.inputFormatTemplate.value = config.formatTemplate || '<img src="{filename}">';
  }
  
  isAutoAttachEnabled = config.autoAttach;
  updateAutoAttachUI();

  if (elements.inputSoundFeedback) {
    elements.inputSoundFeedback.checked = isSoundEnabled;
  }

  if (elements.inputAutoMergeLines) {
    elements.inputAutoMergeLines.checked = localStorage.getItem('anki_auto_merge_lines') === 'true';
  }

  const savedLang = localStorage.getItem('ocr_lang');
  if (savedLang !== null) {
    elements.selectOcrLang.value = savedLang;
  }
}

function openSettings() {
  loadSavedSettings();
  elements.settingsModal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  elements.settingsModal.scrollTop = 0;
  const content = elements.settingsModal.querySelector('.modal-content');
  if (content) content.scrollTop = 0;
}

function closeSettings() {
  elements.settingsModal.classList.add('hidden');
  if (!elements.setupWizardModal || elements.setupWizardModal.classList.contains('hidden')) {
    document.body.classList.remove('modal-open');
  }
}

function saveSettings(e) {
  e.preventDefault();
  const autoAttachVal = elements.inputAutoAttach ? elements.inputAutoAttach.checked : isAutoAttachEnabled;
  const formatTemplateVal = elements.inputFormatTemplate ? elements.inputFormatTemplate.value : '<img src="{filename}">';

  if (elements.inputSoundFeedback) {
    isSoundEnabled = elements.inputSoundFeedback.checked;
    localStorage.setItem('sound_feedback', isSoundEnabled ? 'true' : 'false');
  }

  if (elements.inputAutoMergeLines) {
    localStorage.setItem('anki_auto_merge_lines', elements.inputAutoMergeLines.checked ? 'true' : 'false');
  }

  AnkiConnect.saveConfig({
    url: elements.inputAnkiUrl.value,
    deck: elements.inputAnkiDeck.value,
    pictureField: elements.inputAnkiField.value,
    autoAttach: autoAttachVal,
    formatTemplate: formatTemplateVal
  });
  localStorage.setItem('ocr_lang', elements.selectOcrLang.value);

  isAutoAttachEnabled = autoAttachVal;
  updateAutoAttachUI();

  playSound('success');
  showToast('Settings saved!', 'success');
  closeSettings();
}

async function testAnkiConnection() {
  const testUrl = elements.inputAnkiUrl.value.trim();
  elements.btnTestAnki.disabled = true;
  elements.btnTestAnki.textContent = 'Testing...';

  try {
    // Temporarily save to test with current input
    AnkiConnect.saveConfig({ url: testUrl });
    const version = await AnkiConnect.checkConnection();
    showToast(`Connected! AnkiConnect version: ${version}`, 'success');
  } catch (err) {
    showToast(err.message, 'error', 5000);
  } finally {
    elements.btnTestAnki.disabled = false;
    elements.btnTestAnki.textContent = 'Test AnkiConnect';
  }
}

// ==========================================
// First-Time Setup Wizard & Helpers
// ==========================================
function checkFirstTimeSetup() {
  if (!AnkiConnect.isSetupCompleted()) {
    setTimeout(() => openSetupWizard(), 350);
  }
}

function openSetupWizard() {
  elements.setupWizardModal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  elements.setupWizardModal.scrollTop = 0;
  const content = elements.setupWizardModal.querySelector('.modal-content');
  if (content) content.scrollTop = 0;
  loadWizardDecksAndFields();
}

function closeSetupWizard(markCompleted = false) {
  elements.setupWizardModal.classList.add('hidden');
  if (!elements.settingsModal || elements.settingsModal.classList.contains('hidden')) {
    document.body.classList.remove('modal-open');
  }
  if (markCompleted) {
    AnkiConnect.setSetupCompleted(true);
  }
}

function handleYomitanFile(file, isWizard = true) {
  if (!file) return;
  if (!file.name.endsWith('.json')) {
    showToast('Please select a .json file exported from Yomitan.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const config = AnkiConnect.parseYomitanSettings(e.target.result);
      if (isWizard) {
        pendingYomitanConfig = config;
        elements.yomitanPreviewDeck.textContent = config.deck || '(Not set)';
        elements.yomitanPreviewModel.textContent = config.model || '(Not set)';

        // Populate field options so user can review and choose if they want to override
        const fieldOptions = config.allFields && config.allFields.length > 0 
          ? config.allFields 
          : [config.pictureField, 'Picture', 'Image', 'Screenshot'];
        updateSelectOptions(elements.yomitanPreviewFieldSelect, fieldOptions, config.pictureField);

        elements.yomitanPreviewBox.classList.remove('hidden');
        showToast('Yomitan settings loaded! Please review and confirm below.', 'info', 4500);
      } else {
        // Direct apply in Settings modal
        elements.inputAnkiUrl.value = config.server;
        if (config.deck) elements.inputAnkiDeck.value = config.deck;
        if (config.pictureField) elements.inputAnkiField.value = config.pictureField;
        showToast(`Imported: Deck "${config.deck}", Field "${config.pictureField}"`, 'success');
      }
    } catch (err) {
      showToast(`Error reading Yomitan file: ${err.message}`, 'error');
    }
  };
  reader.readAsText(file);
}

function applyYomitanConfig() {
  if (!pendingYomitanConfig) return;
  const chosenField = elements.yomitanPreviewFieldSelect.value || pendingYomitanConfig.pictureField;
  AnkiConnect.saveConfig({
    url: pendingYomitanConfig.server,
    deck: pendingYomitanConfig.deck,
    pictureField: chosenField
  });
  AnkiConnect.setSetupCompleted(true);
  loadSavedSettings();
  showToast(`✅ Saved! Deck: "${pendingYomitanConfig.deck}", Field: "${chosenField}"`, 'success');
  closeSetupWizard(true);
}

async function autoDetectRecentCard(isWizard = true) {
  const btn = isWizard ? elements.btnWizardAutoDetect : elements.btnSettingsAutoDetect;
  const origText = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = 'Detecting...';

  try {
    const res = await AnkiConnect.detectFromRecentCard();
    if (isWizard) {
      // Ensure the detected deck is selected without wiping existing deck options
      let deckFound = false;
      for (const opt of elements.wizardDeckSelect.options) {
        if (opt.value === res.deckName) {
          deckFound = true;
          break;
        }
      }
      if (!deckFound && res.deckName) {
        const opt = document.createElement('option');
        opt.value = res.deckName;
        opt.textContent = res.deckName;
        elements.wizardDeckSelect.appendChild(opt);
      }
      elements.wizardDeckSelect.value = res.deckName;
      updateSelectOptions(elements.wizardFieldSelect, res.fields, res.pictureField);
      showToast(`Found card! Deck: "${res.deckName}", Field: "${res.pictureField}"`, 'success');
    } else {
      elements.inputAnkiDeck.value = res.deckName;
      elements.inputAnkiField.value = res.pictureField;
      showToast(`Detected: Deck "${res.deckName}", Field "${res.pictureField}"`, 'success');
    }
  } catch (err) {
    showToast(err.message, 'error', 5000);
  } finally {
    btn.disabled = false;
    btn.innerHTML = origText;
  }
}

async function loadAnkiDecksAndFields() {
  elements.btnFetchAnkiData.disabled = true;
  elements.btnFetchAnkiData.textContent = '...';

  try {
    const decks = await AnkiConnect.getDeckNames();
    elements.deckList.innerHTML = '';
    decks.forEach(deck => {
      const opt = document.createElement('option');
      opt.value = deck;
      elements.deckList.appendChild(opt);
    });

    const models = await AnkiConnect.getModelNames();
    const allFields = new Set();
    for (const m of models.slice(0, 8)) {
      try {
        const fields = await AnkiConnect.getModelFieldNames(m);
        fields.forEach(f => allFields.add(f));
      } catch (_) {}
    }

    elements.fieldList.innerHTML = '';
    allFields.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f;
      elements.fieldList.appendChild(opt);
    });

    showToast(`Loaded ${decks.length} decks and ${allFields.size} fields from Anki`, 'info');
  } catch (err) {
    showToast(`Could not load Anki data: ${err.message}`, 'error');
  } finally {
    elements.btnFetchAnkiData.disabled = false;
    elements.btnFetchAnkiData.textContent = 'Load';
  }
}

async function loadWizardDecksAndFields() {
  try {
    const decks = await AnkiConnect.getDeckNames();
    if (decks && decks.length > 0) {
      updateSelectOptions(elements.wizardDeckSelect, decks, elements.wizardDeckSelect.value);
    }
  } catch (_) {
    // Silently continue if Anki is not running yet during initial load
  }
}

function updateSelectOptions(selectElem, options, selectedValue) {
  selectElem.innerHTML = '';
  options.forEach(optVal => {
    const opt = document.createElement('option');
    opt.value = optVal;
    opt.textContent = optVal;
    if (optVal === selectedValue) opt.selected = true;
    selectElem.appendChild(opt);
  });
}

function applyWizardAnkiSelection() {
  const deck = elements.wizardDeckSelect.value;
  const pictureField = elements.wizardFieldSelect.value;
  AnkiConnect.saveConfig({ deck, pictureField });
  AnkiConnect.setSetupCompleted(true);
  loadSavedSettings();
  showToast(`✅ Saved! Deck: "${deck}", Field: "${pictureField}"`, 'success');
  closeSetupWizard(true);
}
