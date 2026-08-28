/**
 * Webpage Reader - Firefox Background Script (MV3)
 * Manages right-click context menus, keyboard commands, and background message passing.
 */

// Global API compatibility check for Firefox (supports browser.* and chrome.*)
const extensionApi = typeof browser !== 'undefined' ? browser : chrome;

/**
 * Register Context Menus on Installation
 */
extensionApi.runtime.onInstalled.addListener(() => {
  // Context Menu: Open Reader Mode
  extensionApi.contextMenus.create({
    id: 'open-reader-mode',
    title: '📖 Open in Webpage Reader',
    contexts: ['page', 'selection']
  });

  // Context Menu: Read Selected Text
  extensionApi.contextMenus.create({
    id: 'read-selected-text',
    title: '🔊 Read Selected Text Out Loud',
    contexts: ['selection']
  });
});

/**
 * Handle Context Menu Item Clicks
 */
extensionApi.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) return;

  if (info.menuItemId === 'open-reader-mode') {
    extensionApi.tabs.sendMessage(tab.id, { action: 'TOGGLE_READER' });
  } else if (info.menuItemId === 'read-selected-text') {
    extensionApi.tabs.sendMessage(tab.id, { action: 'READ_SELECTION' });
  }
});

/**
 * Handle Keyboard Command Hotkeys (Alt + R)
 */
extensionApi.commands.onCommand.addListener((command) => {
  if (command === 'toggle-reader') {
    extensionApi.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        extensionApi.tabs.sendMessage(tabs[0].id, { action: 'TOGGLE_READER' });
      }
    });
  }
});
