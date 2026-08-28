/**
 * Webpage Reader - Text-to-Speech (TTS) Engine
 * Manages speech synthesis playback, rate/pitch adjustment, voice selection, and sentence boundary events.
 */

window.WebReaderTTS = (function () {
  'use strict';

  let synth = window.speechSynthesis;
  let currentUtterance = null;
  let paragraphsQueue = [];
  let currentIndex = 0;

  let state = 'idle'; // 'idle' | 'playing' | 'paused'
  let currentRate = 1.0;
  let currentPitch = 1.0;
  let selectedVoice = null;

  // Event Callbacks
  let onParagraphStartCallback = null;
  let onStateChangeCallback = null;
  let onFinishCallback = null;

  /**
   * Load available browser voices
   */
  function getVoices() {
    if (!synth) return [];
    return synth.getVoices().filter(v => v.lang.startsWith('en') || v.lang.startsWith('es') || v.lang.startsWith('fr') || v.lang.startsWith('de') || v.lang.startsWith('it') || v.lang.startsWith('ja'));
  }

  /**
   * Set speech rate (0.5x - 3.0x)
   */
  function setRate(rate) {
    currentRate = Math.max(0.5, Math.min(3.0, rate));
    if (state === 'playing') {
      // Re-trigger current index with updated rate
      speakParagraph(currentIndex);
    }
  }

  /**
   * Set speech pitch (0.5 - 1.5)
   */
  function setPitch(pitch) {
    currentPitch = Math.max(0.5, Math.min(1.5, pitch));
  }

  /**
   * Set selected voice by voice URI or Name
   */
  function setVoice(voiceName) {
    const voices = getVoices();
    const found = voices.find(v => v.name === voiceName || v.voiceURI === voiceName);
    if (found) {
      selectedVoice = found;
    }
  }

  /**
   * Notify state change listener
   */
  function updateState(newState) {
    state = newState;
    if (typeof onStateChangeCallback === 'function') {
      onStateChangeCallback(state);
    }
  }

  /**
   * Speak specific paragraph index from queue
   */
  function speakParagraph(index) {
    if (!synth || index < 0 || index >= paragraphsQueue.length) {
      updateState('idle');
      if (typeof onFinishCallback === 'function') onFinishCallback();
      return;
    }

    currentIndex = index;
    const para = paragraphsQueue[currentIndex];

    // Cancel current active speech
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(para.text);
    utterance.rate = currentRate;
    utterance.pitch = currentPitch;

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onstart = () => {
      updateState('playing');
      if (typeof onParagraphStartCallback === 'function') {
        onParagraphStartCallback(currentIndex, para.id, para.text);
      }
    };

    utterance.onend = () => {
      if (state === 'playing') {
        currentIndex++;
        if (currentIndex < paragraphsQueue.length) {
          speakParagraph(currentIndex);
        } else {
          updateState('idle');
          if (typeof onFinishCallback === 'function') onFinishCallback();
        }
      }
    };

    utterance.onerror = (e) => {
      console.warn('[WebReader TTS] Utterance error:', e);
      if (state === 'playing') {
        currentIndex++;
        speakParagraph(currentIndex);
      }
    };

    currentUtterance = utterance;
    synth.speak(utterance);
  }

  /**
   * Start or restart reading a list of paragraphs
   */
  function play(paragraphs, startIndex = 0) {
    if (!paragraphs || paragraphs.length === 0) return;
    paragraphsQueue = paragraphs;
    speakParagraph(startIndex);
  }

  /**
   * Pause ongoing speech
   */
  function pause() {
    if (synth && state === 'playing') {
      synth.pause();
      updateState('paused');
    }
  }

  /**
   * Resume paused speech
   */
  function resume() {
    if (synth && state === 'paused') {
      synth.resume();
      updateState('playing');
    } else if (state === 'idle' && paragraphsQueue.length > 0) {
      speakParagraph(currentIndex);
    }
  }

  /**
   * Stop speech synthesis completely
   */
  function stop() {
    if (synth) {
      synth.cancel();
      updateState('idle');
      currentIndex = 0;
    }
  }

  /**
   * Next paragraph
   */
  function next() {
    if (currentIndex + 1 < paragraphsQueue.length) {
      speakParagraph(currentIndex + 1);
    }
  }

  /**
   * Previous paragraph
   */
  function previous() {
    if (currentIndex - 1 >= 0) {
      speakParagraph(currentIndex - 1);
    }
  }

  /**
   * Register event listeners
   */
  function onParagraphStart(fn) { onParagraphStartCallback = fn; }
  function onStateChange(fn) { onStateChangeCallback = fn; }
  function onFinish(fn) { onFinishCallback = fn; }

  // Initialize available voices
  if (synth) {
    synth.onvoiceschanged = () => {
      const voices = getVoices();
      if (voices.length > 0 && !selectedVoice) {
        selectedVoice = voices[0];
      }
    };
  }

  return {
    getVoices,
    setRate,
    setPitch,
    setVoice,
    play,
    pause,
    resume,
    stop,
    next,
    previous,
    onParagraphStart,
    onStateChange,
    onFinish,
    getState: () => state,
    getCurrentIndex: () => currentIndex
  };
})();
