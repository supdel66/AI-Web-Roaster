/**
 * Webpage Reader - Article Extractor Engine
 * Isolates main article text, metadata, and images while removing ads, navs, and clutter.
 */

window.WebReaderExtractor = (function () {
  'use strict';

  // Selectors to eliminate during extraction
  const UNWANTED_SELECTORS = [
    'nav', 'header', 'footer', 'aside', '.sidebar', '#sidebar',
    '.comments', '#comments', '.disqus', '.social-share', '.share-buttons',
    '.ad', '.advertisement', '.banner-ad', '.cookie-banner', '.modal',
    'script', 'style', 'iframe', 'button', 'form', 'input', 'textarea',
    '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
    '.related-posts', '.recommended', '.popover'
  ];

  /**
   * Extract Title from document metadata or primary heading
   */
  function extractTitle() {
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && ogTitle.content) return ogTitle.content.trim();

    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (twitterTitle && twitterTitle.content) return twitterTitle.content.trim();

    const h1 = document.querySelector('h1');
    if (h1 && h1.innerText.trim().length > 3) return h1.innerText.trim();

    return document.title || 'Untitled Webpage';
  }

  /**
   * Extract Byline / Author information
   */
  function extractAuthor() {
    const authorMeta = document.querySelector('meta[name="author"], meta[property="article:author"]');
    if (authorMeta && authorMeta.content) return authorMeta.content.trim();

    const bylineEl = document.querySelector('.byline, .author, [rel="author"], .by-line');
    if (bylineEl && bylineEl.innerText.trim()) return bylineEl.innerText.trim();

    return location.hostname.replace('www.', '');
  }

  /**
   * Extract Article Publication Date
   */
  function extractDate() {
    const dateMeta = document.querySelector('meta[property="article:published_time"], meta[name="date"]');
    if (dateMeta && dateMeta.content) {
      try {
        return new Date(dateMeta.content).toLocaleDateString(undefined, {
          year: 'numeric', month: 'long', day: 'numeric'
        });
      } catch (e) {}
    }

    const timeEl = document.querySelector('time[datetime]');
    if (timeEl && timeEl.getAttribute('datetime')) {
      try {
        return new Date(timeEl.getAttribute('datetime')).toLocaleDateString(undefined, {
          year: 'numeric', month: 'long', day: 'numeric'
        });
      } catch (e) {}
    }

    return null;
  }

  /**
   * Score elements to identify the best article body container
   */
  function findBestContentContainer() {
    // 1. Try standard semantic candidates first
    const candidates = Array.from(document.querySelectorAll('article, main, [role="main"], .post-content, .article-body, .entry-content, .content, #content'));
    
    if (candidates.length > 0) {
      // Pick candidate with highest paragraph density
      let bestCandidate = candidates[0];
      let maxScore = -1;

      candidates.forEach(cand => {
        const paragraphs = cand.querySelectorAll('p');
        const textLength = cand.innerText.trim().length;
        const score = (paragraphs.length * 50) + (textLength * 0.1);
        if (score > maxScore) {
          maxScore = score;
          bestCandidate = cand;
        }
      });
      return bestCandidate;
    }

    // 2. Fallback: evaluate all div / section elements
    const allDivs = Array.from(document.querySelectorAll('div, section'));
    let bestDiv = document.body;
    let maxScore = 0;

    allDivs.forEach(div => {
      const pCount = div.querySelectorAll('p').length;
      if (pCount === 0) return;

      const textLen = div.innerText.trim().length;
      const linkTextLen = Array.from(div.querySelectorAll('a')).reduce((acc, a) => acc + a.innerText.length, 0);

      // Penalty for high link density (navigation menus)
      const linkDensity = textLen > 0 ? (linkTextLen / textLen) : 1;
      if (linkDensity > 0.5) return;

      const score = (pCount * 100) + (textLen * 0.05);
      if (score > maxScore) {
        maxScore = score;
        bestDiv = div;
      }
    });

    return bestDiv;
  }

  /**
   * Clean node content by cloning and purging unwanted noise
   */
  function cleanContentContainer(rawContainer) {
    const clone = rawContainer.cloneNode(true);

    // Remove known noisy selectors
    UNWANTED_SELECTORS.forEach(sel => {
      clone.querySelectorAll(sel).forEach(el => el.remove());
    });

    // Remove hidden elements
    clone.querySelectorAll('*').forEach(el => {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') {
        el.remove();
      }
    });

    return clone;
  }

  /**
   * Extract readable structured elements (Headings, Paragraphs, Lists, Blockquotes, Images)
   */
  function extractStructuredBlocks(container) {
    const blocks = [];
    const elements = container.querySelectorAll('h1, h2, h3, h4, h5, h6, p, ul, ol, blockquote, figure, img, pre, code');

    let paragraphIndex = 0;

    elements.forEach(el => {
      const text = el.innerText.trim();
      const tagName = el.tagName.toLowerCase();

      if (tagName === 'img' || tagName === 'figure') {
        const imgEl = tagName === 'img' ? el : el.querySelector('img');
        if (imgEl && imgEl.src && imgEl.width > 150 && imgEl.height > 100) {
          const caption = el.querySelector('figcaption')?.innerText.trim() || imgEl.alt || '';
          blocks.push({
            type: 'image',
            src: imgEl.src,
            alt: caption
          });
        }
        return;
      }

      if (!text || text.length < 3) return;

      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
        blocks.push({
          type: 'heading',
          level: parseInt(tagName.replace('h', '')),
          text: text
        });
      } else if (tagName === 'blockquote') {
        blocks.push({
          type: 'blockquote',
          text: text,
          id: `para-${paragraphIndex++}`
        });
      } else if (tagName === 'pre' || tagName === 'code') {
        blocks.push({
          type: 'code',
          text: text
        });
      } else if (tagName === 'ul' || tagName === 'ol') {
        const items = Array.from(el.querySelectorAll('li'))
          .map(li => li.innerText.trim())
          .filter(t => t.length > 0);
        if (items.length > 0) {
          blocks.push({
            type: 'list',
            ordered: tagName === 'ol',
            items: items
          });
        }
      } else if (tagName === 'p') {
        // Only include non-trivial paragraphs
        blocks.push({
          type: 'paragraph',
          text: text,
          id: `para-${paragraphIndex++}`
        });
      }
    });

    return blocks;
  }

  /**
   * Main Public Method: Extract full clean article
   */
  function extractArticle() {
    const title = extractTitle();
    const author = extractAuthor();
    const date = extractDate();
    const rawContainer = findBestContentContainer();
    const cleanedContainer = cleanContentContainer(rawContainer);
    const blocks = extractStructuredBlocks(cleanedContainer);

    // Calculate metrics
    const fullText = blocks
      .filter(b => b.text)
      .map(b => b.text)
      .join(' ');

    const words = fullText.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

    // Extract sentences for TTS engine
    const ttsParagraphs = blocks
      .filter(b => ['paragraph', 'heading', 'blockquote'].includes(b.type))
      .map(b => ({
        id: b.id || `block-${Math.random().toString(36).substring(2, 9)}`,
        text: b.text
      }));

    return {
      title,
      author,
      date,
      hostname: location.hostname,
      url: location.href,
      wordCount,
      readingTimeMinutes,
      blocks,
      ttsParagraphs
    };
  }

  return {
    extractArticle
  };
})();
