/**
 * Webpage Reader - Popup Logic
 * Communicates with content script on active tab and manages persistent user settings.
 */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // UI Elements
  const btnToggleReader = document.getElementById('btn-toggle-reader');
  const btnReadSelection = document.getElementById('btn-read-selection');
  const fontSelect = document.getElementById('font-select');
  const speedSlider = document.getElementById('speed-slider');
  const speedVal = document.getElementById('speed-val');
  const voiceSelect = document.getElementById('voice-select');
  const themeButtons = document.querySelectorAll('.theme-opt');

  let currentSettings = {
    theme: 'theme-dark',
    font: 'font-sans',
    ttsRate: 1.0,
    voiceURI: ''
  };

  const extApi = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null);

  /**
   * Send message to active browser tab
   */
  function sendMessageToActiveTab(message, callback) {
    if (extApi && extApi.tabs) {
      extApi.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0]) {
          extApi.tabs.sendMessage(tabs[0].id, message, (response) => {
            if (callback) callback(response);
          });
        }
      });
    }
  }

  /**
   * Load saved options from storage
   */
  function loadSavedSettings() {
    if (extApi && extApi.storage && extApi.storage.local) {
      extApi.storage.local.get(currentSettings, (res) => {
        if (res) {
          currentSettings = { ...currentSettings, ...res };
          updateUIWithSettings();
        }
      });
    }
  }

  /**
   * Save options to storage
   */
  function saveSettings() {
    if (extApi && extApi.storage && extApi.storage.local) {
      extApi.storage.local.set(currentSettings);
    }
  }

  /**
   * Reflect currentSettings object onto popup DOM controls
   */
  function updateUIWithSettings() {
    // Theme swatches
    themeButtons.forEach(btn => {
      if (btn.dataset.theme === currentSettings.theme) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Font select
    if (fontSelect) fontSelect.value = currentSettings.font;

    // Speed slider
    if (speedSlider) {
      speedSlider.value = currentSettings.ttsRate;
      speedVal.innerText = `${currentSettings.ttsRate}x`;
    }
  }

  /**
   * Populate TTS voice dropdown options
   */
  function populateVoices() {
    if (!voiceSelect || !window.speechSynthesis) return;

    const voices = window.speechSynthesis.getVoices();
    voiceSelect.innerHTML = '<option value="">Default System Voice</option>';

    voices.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.name;
      opt.innerText = `${v.name} (${v.lang})`;
      if (v.name === currentSettings.voiceURI) {
        opt.selected = true;
      }
      voiceSelect.appendChild(opt);
    });
  }

  // Bind Events

  // 1. Toggle Reader Mode
  if (btnToggleReader) {
    btnToggleReader.addEventListener('click', () => {
      sendMessageToActiveTab({ action: 'TOGGLE_READER' });
      window.close(); // Close popup
    });
  }

  // 2. Read Selection
  if (btnReadSelection) {
    btnReadSelection.addEventListener('click', () => {
      sendMessageToActiveTab({ action: 'READ_SELECTION' });
      window.close();
    });
  }

  // 3. Theme picker click
  themeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      currentSettings.theme = btn.dataset.theme;
      updateUIWithSettings();
      saveSettings();
    });
  });

  // 4. Font selector change
  if (fontSelect) {
    fontSelect.addEventListener('change', (e) => {
      currentSettings.font = e.target.value;
      saveSettings();
    });
  }

  // 5. Speed slider input
  if (speedSlider) {
    speedSlider.addEventListener('input', (e) => {
      currentSettings.ttsRate = parseFloat(e.target.value);
      speedVal.innerText = `${currentSettings.ttsRate}x`;
      saveSettings();
    });
  }

  // 6. Voice selector change
  if (voiceSelect) {
    voiceSelect.addEventListener('change', (e) => {
      currentSettings.voiceURI = e.target.value;
      saveSettings();
    });
  }

  // Initialize
  loadSavedSettings();
  populateVoices();
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = populateVoices;
  }
});
