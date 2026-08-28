/**
 * Webpage Reader - Reader View Overlay Controller
 * Manages injection of fullscreen Reader View, floating control toolbar, and TTS speech sync.
 */

(function () {
  'use strict';

  let isOverlayActive = false;
  let overlayEl = null;
  let toolbarEl = null;
  let currentArticle = null;

  // Saved user preferences
  let settings = {
    theme: 'theme-dark',
    font: 'font-sans',
    fontSize: 18,
    lineHeight: 1.7,
    textWidth: 740,
    ttsRate: 1.0
  };

  const extApi = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null);

  /**
   * Load stored settings from browser storage
   */
  function loadSettings(callback) {
    if (extApi && extApi.storage && extApi.storage.local) {
      extApi.storage.local.get(settings, (res) => {
        if (res) settings = { ...settings, ...res };
        if (callback) callback();
      });
    } else {
      if (callback) callback();
    }
  }

  /**
   * Save settings to storage
   */
  function saveSettings() {
    if (extApi && extApi.storage && extApi.storage.local) {
      extApi.storage.local.set(settings);
    }
  }

  /**
   * Apply settings to Overlay DOM element
   */
  function applyOverlayStyles() {
    if (!overlayEl) return;

    overlayEl.className = `${settings.theme} ${settings.font}`;
    overlayEl.style.fontSize = `${settings.fontSize}px`;
    overlayEl.style.lineHeight = settings.lineHeight;

    const container = overlayEl.querySelector('.reader-container');
    if (container) {
      container.style.maxWidth = `${settings.textWidth}px`;
    }
  }

  /**
   * Build HTML markup for extracted article blocks
   */
  function renderArticleHTML(article) {
    let contentHTML = '';

    article.blocks.forEach(block => {
      if (block.type === 'heading') {
        contentHTML += `<h${block.level} id="${block.id || ''}">${escapeHTML(block.text)}</h${block.level}>`;
      } else if (block.type === 'paragraph') {
        contentHTML += `<p id="${block.id}">${escapeHTML(block.text)}</p>`;
      } else if (block.type === 'blockquote') {
        contentHTML += `<blockquote id="${block.id}">${escapeHTML(block.text)}</blockquote>`;
      } else if (block.type === 'code') {
        contentHTML += `<pre><code>${escapeHTML(block.text)}</code></pre>`;
      } else if (block.type === 'list') {
        const tag = block.ordered ? 'ol' : 'ul';
        const lis = block.items.map(it => `<li>${escapeHTML(it)}</li>`).join('');
        contentHTML += `<${tag}>${lis}</${tag}>`;
      } else if (block.type === 'image') {
        contentHTML += `<figure><img src="${escapeHTML(block.src)}" alt="${escapeHTML(block.alt)}">${block.alt ? `<figcaption>${escapeHTML(block.alt)}</figcaption>` : ''}</figure>`;
      }
    });

    return `
      <div class="reader-container">
        <header class="reader-header">
          <h1 class="reader-title">${escapeHTML(article.title)}</h1>
          <div class="reader-meta">
            ${article.author ? `<span class="reader-badge">👤 ${escapeHTML(article.author)}</span>` : ''}
            ${article.date ? `<span class="reader-badge">📅 ${escapeHTML(article.date)}</span>` : ''}
            <span class="reader-badge">🌐 ${escapeHTML(article.hostname)}</span>
            <span class="reader-badge">⏱️ ${article.readingTimeMinutes} min read</span>
            <span class="reader-badge">📝 ${article.wordCount} words</span>
          </div>
        </header>
        <main class="reader-content">
          ${contentHTML}
        </main>
      </div>
    `;
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Create Floating Reader Control Toolbar
   */
  function createToolbar() {
    if (toolbarEl) toolbarEl.remove();

    toolbarEl = document.createElement('div');
    toolbarEl.id = 'web-reader-toolbar';

    toolbarEl.innerHTML = `
      <!-- Theme Selector -->
      <select id="toolbar-theme" title="Select Theme">
        <option value="theme-dark" ${settings.theme === 'theme-dark' ? 'selected' : ''}>🌙 Dark</option>
        <option value="theme-sepia" ${settings.theme === 'theme-sepia' ? 'selected' : ''}>📜 Sepia</option>
        <option value="theme-light" ${settings.theme === 'theme-light' ? 'selected' : ''}>☀️ Light</option>
        <option value="theme-oled" ${settings.theme === 'theme-oled' ? 'selected' : ''}>🖤 OLED</option>
        <option value="theme-nordic" ${settings.theme === 'theme-nordic' ? 'selected' : ''}>❄️ Nordic</option>
      </select>

      <!-- Font Selector -->
      <select id="toolbar-font" title="Select Font Style">
        <option value="font-sans" ${settings.font === 'font-sans' ? 'selected' : ''}>Sans-Serif</option>
        <option value="font-serif" ${settings.font === 'font-serif' ? 'selected' : ''}>Serif</option>
        <option value="font-mono" ${settings.font === 'font-mono' ? 'selected' : ''}>Monospace</option>
        <option value="font-dyslexic" ${settings.font === 'font-dyslexic' ? 'selected' : ''}>Dyslexic</option>
      </select>

      <!-- Font Size Controls -->
      <button id="btn-font-dec" title="Decrease Font Size">A-</button>
      <button id="btn-font-inc" title="Increase Font Size">A+</button>

      <div class="toolbar-divider"></div>

      <!-- Text-To-Speech Controls -->
      <button id="btn-tts-prev" title="Previous Paragraph">⏮️</button>
      <button id="btn-tts-play" title="Play/Pause Voice Reader" class="active">▶️</button>
      <button id="btn-tts-next" title="Next Paragraph">⏭️</button>
      <button id="btn-tts-speed" class="speed-btn" title="Cycle Reading Speed">${settings.ttsRate}x</button>

      <div class="toolbar-divider"></div>

      <!-- Close Reader -->
      <button id="btn-close-reader" title="Close Reader View (Esc)">✖</button>
    `;

    document.body.appendChild(toolbarEl);
    attachToolbarEvents();
  }

  /**
   * Attach events to floating toolbar controls
   */
  function attachToolbarEvents() {
    if (!toolbarEl) return;

    // Theme Switcher
    toolbarEl.querySelector('#toolbar-theme').addEventListener('change', (e) => {
      settings.theme = e.target.value;
      applyOverlayStyles();
      saveSettings();
    });

    // Font Switcher
    toolbarEl.querySelector('#toolbar-font').addEventListener('change', (e) => {
      settings.font = e.target.value;
      applyOverlayStyles();
      saveSettings();
    });

    // Font Size Dec/Inc
    toolbarEl.querySelector('#btn-font-dec').addEventListener('click', () => {
      settings.fontSize = Math.max(12, settings.fontSize - 2);
      applyOverlayStyles();
      saveSettings();
    });

    toolbarEl.querySelector('#btn-font-inc').addEventListener('click', () => {
      settings.fontSize = Math.min(36, settings.fontSize + 2);
      applyOverlayStyles();
      saveSettings();
    });

    // TTS Play / Pause
    const playBtn = toolbarEl.querySelector('#btn-tts-play');
    playBtn.addEventListener('click', () => {
      if (!window.WebReaderTTS) return;
      const state = window.WebReaderTTS.getState();

      if (state === 'playing') {
        window.WebReaderTTS.pause();
        playBtn.innerText = '▶️';
        playBtn.classList.remove('active');
      } else if (state === 'paused') {
        window.WebReaderTTS.resume();
        playBtn.innerText = '⏸️';
        playBtn.classList.add('active');
      } else {
        if (currentArticle && currentArticle.ttsParagraphs) {
          window.WebReaderTTS.setRate(settings.ttsRate);
          window.WebReaderTTS.play(currentArticle.ttsParagraphs, 0);
          playBtn.innerText = '⏸️';
          playBtn.classList.add('active');
        }
      }
    });

    // TTS Prev / Next
    toolbarEl.querySelector('#btn-tts-prev').addEventListener('click', () => {
      if (window.WebReaderTTS) window.WebReaderTTS.previous();
    });

    toolbarEl.querySelector('#btn-tts-next').addEventListener('click', () => {
      if (window.WebReaderTTS) window.WebReaderTTS.next();
    });

    // TTS Speed Toggle (1x -> 1.25x -> 1.5x -> 2x -> 0.75x -> 1x)
    const speedBtn = toolbarEl.querySelector('#btn-tts-speed');
    speedBtn.addEventListener('click', () => {
      const speeds = [1.0, 1.25, 1.5, 2.0, 0.75];
      const nextIdx = (speeds.indexOf(settings.ttsRate) + 1) % speeds.length;
      settings.ttsRate = speeds[nextIdx];
      speedBtn.innerText = `${settings.ttsRate}x`;
      if (window.WebReaderTTS) window.WebReaderTTS.setRate(settings.ttsRate);
      saveSettings();
    });

    // Close Reader button
    toolbarEl.querySelector('#btn-close-reader').addEventListener('click', closeReaderOverlay);
  }

  /**
   * Highlight active TTS paragraph & scroll cleanly into view
   */
  function setupTTSHighlighting() {
    if (!window.WebReaderTTS) return;

    window.WebReaderTTS.onParagraphStart((index, paraId) => {
      if (!overlayEl) return;

      // Remove existing highlights
      overlayEl.querySelectorAll('.active-speaking').forEach(el => {
        el.classList.remove('active-speaking');
      });

      if (paraId) {
        const targetEl = overlayEl.querySelector(`#${paraId}`);
        if (targetEl) {
          targetEl.classList.add('active-speaking');
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });

    window.WebReaderTTS.onStateChange((state) => {
      if (!toolbarEl) return;
      const playBtn = toolbarEl.querySelector('#btn-tts-play');
      if (playBtn) {
        playBtn.innerText = state === 'playing' ? '⏸️' : '▶️';
        if (state === 'playing') playBtn.classList.add('active');
        else playBtn.classList.remove('active');
      }
    });
  }

  /**
   * Open Reader Mode Overlay
   */
  function openReaderOverlay() {
    if (isOverlayActive) return;

    loadSettings(() => {
      // Extract clean article content from active document
      if (window.WebReaderExtractor) {
        currentArticle = window.WebReaderExtractor.extractArticle();
      }

      if (!currentArticle) {
        alert('Could not extract article text from this page.');
        return;
      }

      // Create overlay container
      overlayEl = document.createElement('div');
      overlayEl.id = 'web-reader-overlay';
      overlayEl.innerHTML = renderArticleHTML(currentArticle);

      document.body.appendChild(overlayEl);
      document.body.style.overflow = 'hidden'; // Lock background scrolling

      applyOverlayStyles();
      createToolbar();
      setupTTSHighlighting();

      isOverlayActive = true;

      // Escape key handler to exit
      window.addEventListener('keydown', handleKeyDown);
    });
  }

  /**
   * Close Reader Mode Overlay
   */
  function closeReaderOverlay() {
    if (!isOverlayActive) return;

    if (window.WebReaderTTS) {
      window.WebReaderTTS.stop();
    }

    if (overlayEl) {
      overlayEl.remove();
      overlayEl = null;
    }

    if (toolbarEl) {
      toolbarEl.remove();
      toolbarEl = null;
    }

    document.body.style.overflow = '';
    isOverlayActive = false;

    window.removeEventListener('keydown', handleKeyDown);
  }

  /**
   * Keyboard shortcuts
   */
  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      closeReaderOverlay();
    }
  }

  /**
   * Listen for messages from popup or background script
   */
  if (extApi && extApi.runtime && extApi.runtime.onMessage) {
    extApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'TOGGLE_READER') {
        if (isOverlayActive) {
          closeReaderOverlay();
          sendResponse({ status: 'closed' });
        } else {
          openReaderOverlay();
          sendResponse({ status: 'opened' });
        }
      } else if (message.action === 'READ_SELECTION') {
        const selectionText = window.getSelection().toString().trim();
        if (selectionText && window.WebReaderTTS) {
          window.WebReaderTTS.play([{ id: 'selection', text: selectionText }]);
          sendResponse({ status: 'speaking_selection' });
        } else {
          sendResponse({ status: 'no_selection' });
        }
      } else if (message.action === 'GET_READER_STATE') {
        sendResponse({
          isActive: isOverlayActive,
          ttsState: window.WebReaderTTS ? window.WebReaderTTS.getState() : 'idle'
        });
      }
      return true;
    });
  }

  // Global interface
  window.WebReaderOverlay = {
    open: openReaderOverlay,
    close: closeReaderOverlay,
    toggle: () => isOverlayActive ? closeReaderOverlay() : openReaderOverlay()
  };

})();
