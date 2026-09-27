/**
 * Console Capture - Main Application Controller
 */

// Application State
let cropper = null;
let currentCroppedBase64 = null;
let currentOcrText = '';
let currentFilter = 'normal';
let isAutoAttachEnabled = false;
let pollingInterval = null;
let pollingCountdownInterval = null;
let snapshotNoteIds = new Set();
let isPolling = false;

// Tracing / Focus State
let currentCropMode = 'crop'; // 'crop' | 'trace'
let traceStrokes = []; // Array of strokes, each is array of {x, y}
let traceBounds = null; // { minX, minY, maxX, maxY }
let isDrawingTrace = false;
let currentStroke = [];

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
  detectedLangBadge: document.getElementById('detectedLangBadge'),
  focusedOcrBadge: document.getElementById('focusedOcrBadge'),
  btnToggleAutoAttach: document.getElementById('btnToggleAutoAttach'),
  autoAttachStateText: document.getElementById('autoAttachStateText'),
  pollingBanner: document.getElementById('pollingBanner'),
  pollingCountdown: document.getElementById('pollingCountdown'),
  btnCancelPolling: document.getElementById('btnCancelPolling'),
  btnCopyText: document.getElementById('btnCopyText'),
  cropPreviewImg: document.getElementById('cropPreviewImg'),
  btnAttachAnki: document.getElementById('btnAttachAnki'),
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
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration failed:', err);
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
    snapshotNoteIds = new Set(existingIds);
  } catch (e) {
    console.warn('Could not take AnkiConnect note snapshot:', e);
    snapshotNoteIds = new Set();
  }

  isPolling = true;
  let remainingSeconds = 45;

  elements.pollingCountdown.textContent = `Tap word in Yomitan to create card (${remainingSeconds}s left)`;
  elements.pollingBanner.classList.remove('hidden');
  elements.btnAttachAnki.innerHTML = '<span class="btn-text">⏳ Waiting for Yomitan...</span>';
  elements.btnAttachAnki.disabled = true;

  pollingCountdownInterval = setInterval(() => {
    remainingSeconds -= 1;
    if (remainingSeconds <= 0) {
      stopAutoAttachPolling();
      showToast('Auto-attach timed out. You can tap "Attach Image" manually.', 'info', 4500);
      elements.btnAttachAnki.disabled = false;
      elements.btnAttachAnki.innerHTML = '<span class="btn-text">📎 Attach Image to Card</span>';
    } else {
      elements.pollingCountdown.textContent = `Tap word in Yomitan to create card (${remainingSeconds}s left)`;
    }
  }, 1000);

  pollingInterval = setInterval(async () => {
    if (!isPolling) return;
    try {
      const currentIds = await AnkiConnect.getRecentNoteIds();
      const newIds = currentIds.filter(id => !snapshotNoteIds.has(id));
      if (newIds.length > 0) {
        newIds.sort((a, b) => b - a);
        const targetNoteId = newIds[0];

        stopAutoAttachPolling();

        const result = await AnkiConnect.attachImageToNote(targetNoteId, currentCroppedBase64);
        playSound('success');

        const label = result.noteName ? `"${result.noteName}"` : `Note #${result.noteId}`;
        showToast(`✅ Auto-attached to ${label} (${result.fieldUsed})`, 'success', 5000);
        elements.btnAttachAnki.disabled = true;
        elements.btnAttachAnki.innerHTML = '<span class="btn-text">✓ Auto-Attached to Card</span>';
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
  if (pollingCountdownInterval) {
    clearInterval(pollingCountdownInterval);
    pollingCountdownInterval = null;
  }
  elements.pollingBanner.classList.add('hidden');
}

function handleCancelPolling() {
  stopAutoAttachPolling();
  elements.btnAttachAnki.disabled = false;
  elements.btnAttachAnki.innerHTML = '<span class="btn-text">📎 Attach Image to Card</span>';
  playSound('click');
  showToast('Auto-attach cancelled. Manual attach available.', 'info');
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
  elements.btnCopyText.addEventListener('click', copyOcrText);
  elements.btnAttachAnki.addEventListener('click', handleAttachToAnki);
  elements.btnNewCapture.addEventListener('click', handleNewCapture);
  elements.btnToggleAutoAttach.addEventListener('click', toggleAutoAttach);
  elements.btnCancelPolling.addEventListener('click', handleCancelPolling);

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
// Drawing / Tracing Text Focus Controller
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

    currentStroke = [{ x, y }];
    traceStrokes.push(currentStroke);
    renderTraceCanvas();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!isDrawingTrace) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    currentStroke.push({ x, y });
    renderTraceCanvas();
  });

  const finishStroke = () => {
    if (!isDrawingTrace) return;
    isDrawingTrace = false;
    calculateTraceBounds();
    renderTraceCanvas();
    updateTraceUI();
    playSound('pop');
  };

  canvas.addEventListener('pointerup', finishStroke);
  canvas.addEventListener('pointercancel', finishStroke);

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
}

function calculateTraceBounds() {
  if (traceStrokes.length === 0) {
    traceBounds = null;
    return;
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let hasPoints = false;

  traceStrokes.forEach(stroke => {
    stroke.forEach(pt => {
      hasPoints = true;
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    });
  });

  if (hasPoints) {
    const radius = 14;
    traceBounds = {
      minX: Math.max(0, minX - radius),
      minY: Math.max(0, minY - radius),
      maxX: maxX + radius,
      maxY: maxY + radius
    };
  } else {
    traceBounds = null;
  }
}

function renderTraceCanvas() {
  if (!elements.traceCanvas) return;
  const ctx = elements.traceCanvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = elements.traceCanvas.width / dpr;
  const h = elements.traceCanvas.height / dpr;

  ctx.clearRect(0, 0, w, h);

  if (traceStrokes.length === 0) return;

  // 1. Draw glowing highlighter strokes (Google Lens style cyan)
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.shadowColor = 'rgba(56, 189, 248, 0.6)';
  ctx.shadowBlur = 12;
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.lineWidth = 26;

  traceStrokes.forEach(stroke => {
    if (stroke.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(stroke[0].x, stroke[0].y);
    for (let i = 1; i < stroke.length; i++) {
      ctx.lineTo(stroke[i].x, stroke[i].y);
    }
    ctx.stroke();
  });

  // Core stroke
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.lineWidth = 14;
  traceStrokes.forEach(stroke => {
    if (stroke.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(stroke[0].x, stroke[0].y);
    for (let i = 1; i < stroke.length; i++) {
      ctx.lineTo(stroke[i].x, stroke[i].y);
    }
    ctx.stroke();
  });
  ctx.restore();

  // 2. Draw neat focus bounding box around all strokes when finished drawing
  if (!isDrawingTrace && traceBounds) {
    const { minX, minY, maxX, maxY } = traceBounds;
    const pad = 6;
    const bx = minX - pad;
    const by = minY - pad;
    const bw = (maxX - minX) + pad * 2;
    const bh = (maxY - minY) + pad * 2;

    ctx.save();
    // Dashed focus box
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(bx, by, bw, bh);

    // Corner brackets
    ctx.setLineDash([]);
    ctx.lineWidth = 3;
    const corner = Math.min(10, bw / 4, bh / 4);

    ctx.beginPath();
    ctx.moveTo(bx, by + corner);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx + corner, by);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(bx + bw - corner, by);
    ctx.lineTo(bx + bw);
    ctx.lineTo(bx + bw, by + corner);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(bx, by + bh - corner);
    ctx.lineTo(bx, by + bh);
    ctx.lineTo(bx + corner, by + bh);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(bx + bw - corner, by + bh);
    ctx.lineTo(bx + bw);
    ctx.lineTo(bx + bw, by + bh - corner);
    ctx.stroke();

    // Badge label
    const tag = '🎯 OCR Focus';
    ctx.font = 'bold 11px sans-serif';
    const tagW = ctx.measureText(tag).width + 8;
    const tagY = Math.max(16, by - 4);

    ctx.fillStyle = 'rgba(18, 18, 20, 0.85)';
    ctx.fillRect(bx, tagY - 12, tagW, 14);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(tag, bx + 4, tagY - 1);

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
      ? '✓ Text focused! Extract below or trace again' 
      : '👆 Trace with finger over text to focus OCR';
  }
  const submitText = elements.btnSubmitCrop?.querySelector('.btn-text');
  if (submitText) {
    submitText.textContent = hasTrace ? 'Extract Focused Text ➔' : 'Extract Text ➔';
  }
}

function clearTrace() {
  traceStrokes = [];
  traceBounds = null;
  currentStroke = [];
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

  // Transition to Results & Loading state
  switchStage('result');
  elements.loadingIndicator.classList.remove('hidden');
  elements.ocrCard.classList.add('hidden');
  elements.btnAttachAnki.disabled = false;
  elements.btnAttachAnki.innerHTML = '<span class="btn-text">📎 Attach Image to Card</span>';

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
    currentOcrText = data.text ? data.text.trim() : '';

    elements.ocrText.textContent = currentOcrText || '(No text detected in this region)';
    elements.detectedLangBadge.textContent = (data.detected_language || ocrLang || 'JA').toUpperCase();

    elements.loadingIndicator.classList.add('hidden');
    elements.ocrCard.classList.remove('hidden');

    playSound('ocr');

    if (!currentOcrText) {
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

  stopAutoAttachPolling();

  const btn = elements.btnAttachAnki;
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-text">⏳ Attaching...</span>';

  try {
    const result = await AnkiConnect.attachImageToLatestNote(currentCroppedBase64);
    const label = result.noteName ? `"${result.noteName}"` : `Note #${result.noteId}`;
    playSound('success');
    showToast(`✅ Image attached to ${label} (${result.fieldUsed})`, 'success', 4500);
    btn.innerHTML = '<span class="btn-text">✓ Attached to Card</span>';
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
    playSound('error');
    showToast(`Anki Error: ${err.message}`, 'error', 5000);
  }
}

function handleNewCapture() {
  stopAutoAttachPolling();
  destroyCropper();
  currentCroppedBase64 = null;
  currentOcrText = '';
  elements.ocrText.textContent = '';
  elements.cropPreviewImg.src = '';
  elements.btnAttachAnki.disabled = false;
  elements.btnAttachAnki.innerHTML = '<span class="btn-text">📎 Attach Image to Card</span>';
  switchStage('capture');
  playSound('click');
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
