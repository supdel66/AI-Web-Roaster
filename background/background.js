/**
 * AI Web Roaster - Background Script
 * Manages right-click context menu and hotkey shortcuts for triggering instant roasts.
 */

const extensionApi = typeof browser !== 'undefined' ? browser : chrome;

/**
 * Register Context Menu on Installation
 */
extensionApi.runtime.onInstalled.addListener(() => {
  extensionApi.contextMenus.create({
    id: 'trigger-ai-roast',
    title: '🔥 Roast This Webpage',
    contexts: ['page', 'selection']
  });
});

/**
 * Handle Context Menu Clicks
 */
extensionApi.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) return;

  if (info.menuItemId === 'trigger-ai-roast') {
    extensionApi.tabs.sendMessage(tab.id, { action: 'TRIGGER_MANUAL_ROAST' });
  }
});

/**
 * Handle Hotkey (Alt + R)
 */
extensionApi.commands.onCommand.addListener((command) => {
  if (command === 'trigger-roast') {
    extensionApi.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        extensionApi.tabs.sendMessage(tabs[0].id, { action: 'TRIGGER_MANUAL_ROAST' });
      }
    });
  }
});

/**
 * Handle HTTP Fetch from Background Worker to bypass HTTPS Loopback / CORS restrictions
 */
extensionApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'FETCH_ROAST') {
    const serverUrl = 'https://ai-web-roaster.onrender.com/roast';
    fetch(serverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message.payload || {})
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.toString() }));
    return true; // Async response
  }
});
