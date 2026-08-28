/**
 * AI Web Roaster - Popup Logic
 * Communicates with content script on active tab and manages persistent user settings.
 */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const extApi = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null);

  // UI Elements
  const btnInstantRoast = document.getElementById('btn-instant-roast');
  const roastToggle = document.getElementById('roast-toggle');
  const roastIntervalSlider = document.getElementById('roast-interval-slider');
  const roastIntervalVal = document.getElementById('roast-interval-val');

  let currentSettings = {
    roastEnabled: true,
    roastInterval: 300 // default 300 seconds (5 minutes)
  };

  /**
   * Send message to active browser tab with dynamic fallback injection
   */
  function sendMessageToActiveTab(message, callback) {
    if (!extApi || !extApi.tabs) return;

    extApi.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs && tabs[0];
      if (!activeTab || !activeTab.id) return;

      const url = activeTab.url || '';
      if (url.startsWith('chrome://') || url.startsWith('vivaldi://') || url.startsWith('about:')) {
        alert('AI Web Roaster cannot run on browser system pages. Please open a regular website like Wikipedia or a news article!');
        return;
      }

      extApi.tabs.sendMessage(activeTab.id, message, (response) => {
        const lastErr = extApi.runtime.lastError;
        if (lastErr || !response) {
          // Content script not in tab yet! Dynamically inject it now
          if (extApi.scripting) {
            extApi.scripting.insertCSS({
              target: { tabId: activeTab.id },
              files: ['content/roast_toast.css']
            }).then(() => {
              return extApi.scripting.executeScript({
                target: { tabId: activeTab.id },
                files: ['content/roast_toast.js']
              });
            }).then(() => {
              setTimeout(() => {
                extApi.tabs.sendMessage(activeTab.id, message, callback);
              }, 150);
            }).catch(err => {
              console.warn('[AI Web Roaster] Dynamic injection error:', err);
            });
          }
        } else {
          if (callback) callback(response);
        }
      });
    });
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
   * Save options to storage and broadcast to active tab
   */
  function saveSettings() {
    if (extApi && extApi.storage && extApi.storage.local) {
      extApi.storage.local.set(currentSettings);
    }

    // Broadcast updated settings to content script
    sendMessageToActiveTab({
      action: 'UPDATE_ROAST_SETTINGS',
      settings: {
        roastEnabled: currentSettings.roastEnabled,
        roastInterval: currentSettings.roastInterval
      }
    });
  }

  /**
   * Reflect currentSettings object onto popup DOM controls
   */
  function updateUIWithSettings() {
    // Roast Toggle
    if (roastToggle) roastToggle.checked = currentSettings.roastEnabled;

    // Roast Interval Slider (Convert seconds to minutes: 60s - 600s -> 1 - 10 min)
    if (roastIntervalSlider) {
      const minutes = Math.max(1, Math.min(10, Math.round(currentSettings.roastInterval / 60)));
      roastIntervalSlider.value = minutes;
      roastIntervalVal.innerText = `${minutes} min`;
    }
  }

  // Bind Events

  // 1. Instant Roast Button
  if (btnInstantRoast) {
    btnInstantRoast.addEventListener('click', () => {
      sendMessageToActiveTab({ action: 'TRIGGER_MANUAL_ROAST' });
      window.close();
    });
  }

  // 2. Auto Roast Toggle Switch
  if (roastToggle) {
    roastToggle.addEventListener('change', (e) => {
      currentSettings.roastEnabled = e.target.checked;
      saveSettings();
    });
  }

  // 3. Roast Interval Slider Change (Convert 1-10 minutes to seconds)
  if (roastIntervalSlider) {
    roastIntervalSlider.addEventListener('input', (e) => {
      const mins = parseInt(e.target.value, 10);
      currentSettings.roastInterval = mins * 60;
      roastIntervalVal.innerText = `${mins} min`;
      saveSettings();
    });
  }

  // Initialize
  loadSavedSettings();
});
