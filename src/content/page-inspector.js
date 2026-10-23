(() => {
  if (window.__geoLensInjected) {
    return;
  }
  window.__geoLensInjected = true;

  const STATE = {
    audit: null,
    highlightsVisible: true,
    sectionElements: new Map()
  };

  const VERSION = '0.1.5';
  const EXTENSION_CLASS_PREFIX = 'geo-lens-';
  let lastObservedUrl = location.href;
  const BAD_PHRASE_REGEX = /\b(industry[-\s]?leading|best[-\s]?in[-\s]?class|world[-\s]?class|next[-\s]?generation|cutting[-\s]?edge|game[-\s]?changing|revolutionary|seamless|robust|powerful|innovative|unmatched|unrivaled|state[-\s]?of[-\s]?the[-\s]?art|trusted by millions|market[-\s]?leading|ultimate solution|all[-\s]?in[-\s]?one solution)\b/gi;
  const INTENT_PHRASE_REGEX = /\b(what is|what are|how to|how does|how do|why does|why do|when should|where can|who should|can i|can you|should i|best way|best practices|compare|comparison|vs\.?|versus|pricing|cost|examples?|steps?|checklist|template|guide|review|benefits?|risks?|pros and cons|alternatives?)\b/gi;
  const DIRECT_ANSWER_REGEX = /\b(is|are|means|refers to|works by|allows|helps|lets|uses|protects|provides|includes|enables|prevents|should|can|will|does)\b/i;
  const CLAIM_REGEX = /\b(best|most|leading|secure|safest|fastest|easiest|guaranteed|proven|trusted|certified|number one|#1|millions|billions|unmatched|unrivaled)\b/i;
  const QUESTION_HEADING_REGEX = /^(what|how|why|who|when|where|which|can|should|does|do|is|are|will|best|compare|vs\.?|pricing|cost)\b/i;
  const DATE_OR_NUMBER_REGEX = /(\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s?(?:%|percent|users?|customers?|sites?|pages?|seconds?|minutes?|hours?|days?|years?)\b|\$\s?\d|\b(?:19|20)\d{2}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b)/i;
  const SOURCE_WORD_REGEX = /\b(according to|source|study|research|report|survey|data from|cited by|published|last updated|updated on|reviewed by|author)\b/i;
  const COMMON_ENTITY_STOPWORDS = new Set([
    'The', 'This', 'That', 'These', 'Those', 'When', 'Where', 'What', 'Why', 'How', 'Can', 'Should', 'Do', 'Does', 'Are', 'Is',
    'Home', 'About', 'Contact', 'Products', 'Services', 'Features', 'Pricing', 'Blog', 'Article', 'Page', 'FAQ', 'FAQs', 'Privacy',
    'Terms', 'Cookie', 'Login', 'Sign', 'Subscribe', 'Download', 'Learn', 'Read', 'More', 'Get', 'Start', 'Started'
  ]);

  function cleanText(text = '') {
    return String(text)
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function countWords(text = '') {
    const matches = cleanText(text).match(/\b[\w'-]+\b/g);
    return matches ? matches.length : 0;
  }

  function clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, value));
  }

  function unique(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function gradeFromScore(score) {
    if (score >= 97) return 'A+';
    if (score >= 93) return 'A';
    if (score >= 90) return 'A-';
    if (score >= 87) return 'B+';
    if (score >= 83) return 'B';
    if (score >= 80) return 'B-';
    if (score >= 77) return 'C+';
    if (score >= 73) return 'C';
    if (score >= 70) return 'C-';
    if (score >= 67) return 'D+';
    if (score >= 63) return 'D';
    if (score >= 60) return 'D-';
    return 'F';
  }

  function gradeBand(grade = '') {
    const first = String(grade).charAt(0).toLowerCase();
    return ['a', 'b', 'c', 'd', 'f'].includes(first) ? first : 'c';
  }

  function isVisibleElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
    if (element.closest(`.${EXTENSION_CLASS_PREFIX}floating-status, .${EXTENSION_CLASS_PREFIX}section-badge`)) return false;
    if (element.closest('script, style, noscript, template, svg, canvas, iframe')) return false;
    const style = window.getComputedStyle(element);
    if (!style || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isProbablyNavigation(element) {
    return Boolean(element.closest('nav, footer, aside, [role="navigation"], [aria-label*="breadcrumb" i], [class*="breadcrumb" i], [class*="nav" i], [class*="menu" i], [class*="footer" i], [id*="footer" i]'));
  }

  function isGoogleDocsDocument() {
    return location.hostname === 'docs.google.com' && location.pathname.startsWith('/document/');
  }

  function getScopeRoot() {
    return document.querySelector('main') || document.querySelector('article') || document.querySelector('[role="main"]') || document.body;
  }

  function getMetaContent(selector) {
    const el = document.querySelector(selector);
    return cleanText(el?.getAttribute('content') || '');
  }

  function getLinkHref(selector) {
    const el = document.querySelector(selector);
    return cleanText(el?.getAttribute('href') || '');
  }

  function getRobotsMeta() {
    return getMetaContent('meta[name="robots" i], meta[name="googlebot" i]');
  }

  function parseBrandTerms(raw = '') {
    return unique(String(raw)
      .split(/[\n,]/)
      .map(item => cleanText(item))
      .filter(item => item.length > 1));
  }

  function findRegexMatches(text, regex, max = 12) {
    const matches = [];
    const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`);
    let match;
    while ((match = re.exec(text)) && matches.length < max) {
      matches.push(cleanText(match[0]));
      if (match.index === re.lastIndex) re.lastIndex += 1;
    }
    return unique(matches);
  }

  function splitSentences(text = '') {
    return cleanText(text)
      .split(/(?<=[.!?])\s+/)
      .map(sentence => cleanText(sentence))
      .filter(sentence => sentence.length > 0);
  }

  function firstUsefulSentence(text = '') {
    return splitSentences(text).find(sentence => countWords(sentence) >= 8 && countWords(sentence) <= 45) || '';
  }

  function extractEntities(text = '', brandTerms = []) {
    const entities = [];
    const entityRegex = /\b(?:[A-Z][a-z0-9]+|[A-Z]{2,})(?:[\s-]+(?:[A-Z][a-z0-9]+|[A-Z]{2,}|[0-9]+)){0,4}\b/g;
    let match;
    while ((match = entityRegex.exec(text)) && entities.length < 30) {
      const entity = cleanText(match[0]);
      if (!COMMON_ENTITY_STOPWORDS.has(entity) && entity.length > 1 && !/^\d+$/.test(entity)) {
        entities.push(entity);
      }
    }
    for (const term of brandTerms) {
      if (new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i').test(text)) entities.unshift(term);
    }
    return unique(entities).slice(0, 18);
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function extractStructuredData() {
    const scripts = [...document.querySelectorAll('script[type="application/ld+json"]')];
    const items = [];
    const invalid = [];

    for (const [index, script] of scripts.entries()) {
      const raw = script.textContent.trim();
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        const types = extractJsonLdTypes(parsed);
        items.push({ index, types, rawLength: raw.length });
      } catch (error) {
        invalid.push({ index, message: String(error.message || error), preview: raw.slice(0, 180) });
      }
    }

    const allTypes = unique(items.flatMap(item => item.types));
    const recommendedTypes = ['Article', 'BlogPosting', 'Product', 'FAQPage', 'BreadcrumbList', 'Organization', 'LocalBusiness', 'WebPage', 'HowTo'];
    const foundRecommended = allTypes.filter(type => recommendedTypes.includes(type));

    let score = 30;
    if (items.length > 0) score += 35;
    if (allTypes.length > 0) score += 15;
    if (foundRecommended.length > 0) score += 15;
    if (invalid.length > 0) score -= 25;
    score = clamp(score);

    const warnings = [];
    if (items.length === 0) warnings.push('No JSON-LD structured data detected.');
    if (invalid.length > 0) warnings.push(`${invalid.length} JSON-LD block(s) could not be parsed.`);
    if (items.length > 0 && foundRecommended.length === 0) warnings.push('JSON-LD exists, but no common SEO/GEO schema types were detected.');

    return {
      jsonLdCount: scripts.length,
      validBlocks: items.length,
      invalidBlocks: invalid.length,
      types: allTypes,
      recommendedTypesFound: foundRecommended,
      warnings,
      invalid,
      score,
      grade: gradeFromScore(score)
    };
  }

  function extractJsonLdTypes(value) {
    const types = [];

    function visit(node) {
      if (!node) return;
      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }
      if (typeof node !== 'object') return;
      if (node['@type']) {
        if (Array.isArray(node['@type'])) {
          types.push(...node['@type'].map(type => cleanSchemaType(type)));
        } else {
          types.push(cleanSchemaType(node['@type']));
        }
      }
      if (node['@graph']) visit(node['@graph']);
      for (const key of ['mainEntity', 'itemListElement', 'about', 'author', 'publisher']) {
        if (node[key]) visit(node[key]);
      }
    }

    visit(value);
    return unique(types.filter(Boolean));
  }

  function cleanSchemaType(type) {
    return cleanText(String(type)).replace(/^https?:\/\/schema\.org\//i, '');
  }

  function extractSections(options = {}) {
    if (isGoogleDocsDocument()) {
      const docSections = extractGoogleDocSections(options);
      if (docSections.length) return docSections;
    }

    const root = getScopeRoot();
    const selector = 'h1,h2,h3,p,ul,ol,table,blockquote,details,pre';
    const blocks = [...root.querySelectorAll(selector)]
      .filter(isVisibleElement)
      .filter(element => !isProbablyNavigation(element))
      .filter(element => cleanText(element.innerText || element.textContent).length >= 2);

    const sections = [];
    let current = null;
    let sectionIndex = 0;

    for (const block of blocks) {
      const tag = block.tagName.toLowerCase();
      const isHeading = /^h[1-3]$/.test(tag);
      if (isHeading) {
        if (current && cleanText(current.elements.map(el => el.innerText || el.textContent).join('\n')).length > 0) {
          sections.push(current);
        }
        sectionIndex += 1;
        current = {
          id: `section-${sectionIndex}`,
          heading: cleanText(block.innerText || block.textContent) || `Section ${sectionIndex}`,
          level: Number(tag.replace('h', '')),
          headingElement: block,
          elements: [block]
        };
      } else {
        if (!current) {
          sectionIndex += 1;
          current = {
            id: `section-${sectionIndex}`,
            heading: cleanText(document.querySelector('h1')?.innerText || document.title || 'Page body'),
            level: 0,
            headingElement: document.querySelector('h1') || block,
            elements: []
          };
        }
        current.elements.push(block);
      }
    }

    if (current && cleanText(current.elements.map(el => el.innerText || el.textContent).join('\n')).length > 0) {
      sections.push(current);
    }

    const brandTerms = parseBrandTerms(options.brandTerms || '');
    return sections
      .map((section, index) => scoreSection(section, index, brandTerms, options))
      .filter(section => section.wordCount >= 8 || section.heading);
  }

  function extractGoogleDocSections(options = {}) {
    const lineRecords = getGoogleDocLineRecords();
    const sections = [];
    let current = null;
    let sectionIndex = 0;

    for (const [index, record] of lineRecords.entries()) {
      const isHeading = isLikelyDraftHeading(record.text, index);
      if (isHeading) {
        if (current && current.elements.length) sections.push(current);
        sectionIndex += 1;
        current = {
          id: `section-${sectionIndex}`,
          heading: record.text,
          level: index === 0 ? 1 : 2,
          headingElement: record.element,
          elements: [createVirtualBlock('h2', record.text)]
        };
        continue;
      }

      if (!current) {
        sectionIndex += 1;
        current = {
          id: `section-${sectionIndex}`,
          heading: cleanText(document.title.replace(/- Google Docs$/i, '')) || 'Google Docs draft',
          level: 1,
          headingElement: record.element,
          elements: []
        };
      }
      current.elements.push(createVirtualBlock('p', record.text));
    }

    if (current && current.elements.length) sections.push(current);

    const brandTerms = parseBrandTerms(options.brandTerms || '');
    return sections
      .map((section, index) => scoreSection(section, index, brandTerms, options))
      .filter(section => section.wordCount >= 8 || section.heading);
  }

  function getGoogleDocLineRecords() {
    const root = document.querySelector('.kix-appview-editor') ||
      document.querySelector('.kix-page-content-wrapper') ||
      document.querySelector('[role="textbox"]') ||
      document.body;
    const selectors = [
      '.kix-lineview',
      '.kix-lineview-text-block',
      '.kix-wordhtmlgenerator-word-node',
      '[role="textbox"] div',
      '[role="textbox"] span'
    ];

    for (const selector of selectors) {
      const records = uniqueLineRecords([...root.querySelectorAll(selector)]
        .filter(isVisibleElement)
        .map(element => ({ element, text: cleanText(element.innerText || element.textContent || '') }))
        .filter(record => record.text.length >= 2 && record.text.length <= 500));
      if (records.length >= 3) return records;
    }

    return splitSentences(cleanText(root.innerText || root.textContent || ''))
      .slice(0, 120)
      .map(text => ({ text, element: root }));
  }

  function uniqueLineRecords(records) {
    const seen = new Set();
    return records.filter(record => {
      const key = record.text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function isLikelyDraftHeading(text = '', index = 0) {
    const cleaned = cleanText(text);
    const words = countWords(cleaned);
    if (index === 0 && words <= 18) return true;
    if (QUESTION_HEADING_REGEX.test(cleaned) || cleaned.endsWith('?')) return true;
    return words >= 2 && words <= 10 && cleaned.length <= 90 && !/[.!]$/.test(cleaned);
  }

  function createVirtualBlock(tagName, text) {
    const element = document.createElement(tagName);
    element.textContent = text;
    return element;
  }

  function scoreSection(section, index, brandTerms, options = {}) {
    const text = cleanText(section.elements.map(el => el.innerText || el.textContent || '').join('\n'));
    const headingText = cleanText(section.heading || '');
    const wordCount = countWords(text);
    const paragraphs = section.elements.filter(el => el.tagName?.toLowerCase() === 'p');
    const lists = section.elements.filter(el => ['ul', 'ol'].includes(el.tagName?.toLowerCase()));
    const tables = section.elements.filter(el => el.tagName?.toLowerCase() === 'table');
    const links = section.elements.flatMap(el => [...el.querySelectorAll('a[href]')]);
    const externalLinks = links.filter(link => {
      try {
        return new URL(link.href).hostname !== location.hostname;
      } catch (_error) {
        return false;
      }
    });

    const questionHeading = QUESTION_HEADING_REGEX.test(headingText) || headingText.includes('?');
    const intentPhrases = unique([...findRegexMatches(headingText, INTENT_PHRASE_REGEX, 8), ...findRegexMatches(text, INTENT_PHRASE_REGEX, 10)]).slice(0, 12);
    const vaguePhrases = findRegexMatches(text, BAD_PHRASE_REGEX, 12);
    const entities = extractEntities(text, brandTerms);
    const sentences = splitSentences(text);
    const firstSentence = firstUsefulSentence(text);
    const hasDirectAnswer = Boolean(firstSentence && DIRECT_ANSWER_REGEX.test(firstSentence) && (questionHeading || intentPhrases.length > 0 || wordCount >= 25));
    const hasEvidence = externalLinks.length > 0 || DATE_OR_NUMBER_REGEX.test(text) || SOURCE_WORD_REGEX.test(text);
    const unsupportedClaim = CLAIM_REGEX.test(text) && !hasEvidence;
    const hasStructure = lists.length > 0 || tables.length > 0 || paragraphs.length >= 2;
    const hasComparison = /\b(vs\.?|versus|compare|comparison|alternative|pros and cons|better than)\b/i.test(text);
    const averageParagraphWords = paragraphs.length ? Math.round(paragraphs.reduce((sum, p) => sum + countWords(p.innerText), 0) / paragraphs.length) : wordCount;
    const wallOfText = averageParagraphWords > 130 || wordCount > 450;
    const tooThin = wordCount < 35 && !hasDirectAnswer;

    let score = 50;
    const positives = [];
    const negatives = [];
    const opportunities = [];

    if (questionHeading) {
      score += 15;
      positives.push('Heading maps directly to user intent.');
    } else if (intentPhrases.length > 0) {
      score += 8;
      positives.push('Section contains intent-driven language.');
    } else {
      score -= 6;
      opportunities.push('Rewrite the heading as a user question or clearer task phrase.');
    }

    if (hasDirectAnswer) {
      score += 20;
      positives.push('Contains a concise answer-like sentence near the start.');
    } else {
      score -= 12;
      negatives.push('No clear direct answer detected near the start.');
      opportunities.push('Add a 1 to 2 sentence answer block immediately under the heading.');
    }

    if (entities.length >= 3) {
      score += 12;
      positives.push('Strong entity signals detected.');
    } else if (entities.length > 0) {
      score += 6;
      opportunities.push('Add more explicit product, brand, topic, or audience entities.');
    } else {
      score -= 8;
      negatives.push('Weak entity clarity.');
    }

    if (hasEvidence) {
      score += 14;
      positives.push('Includes evidence signals such as links, dates, numbers, or source language.');
    } else {
      score -= 8;
      opportunities.push('Add a source link, concrete metric, date, example, or proof point.');
    }

    if (hasStructure) {
      score += 8;
      positives.push('Section is chunkable because it uses paragraphs, lists, or tables.');
    } else {
      score -= 4;
      opportunities.push('Break the section into a list, table, or shorter paragraphs.');
    }

    if (hasComparison) {
      score += 4;
      positives.push('Comparison language may help answer engines route comparative prompts.');
      if (tables.length === 0) opportunities.push('Consider turning the comparison into a table.');
    }

    if (vaguePhrases.length > 0) {
      score -= Math.min(18, vaguePhrases.length * 4);
      negatives.push(`Vague marketing language detected: ${vaguePhrases.slice(0, 5).join(', ')}.`);
    }

    if (unsupportedClaim) {
      score -= 12;
      negatives.push('Strong claim detected without obvious evidence nearby.');
      opportunities.push('Support strong claims with a source, metric, named standard, or example.');
    }

    if (wallOfText) {
      score -= 10;
      negatives.push('Section may be too dense for clean extraction.');
    }

    if (tooThin) {
      score -= 10;
      negatives.push('Section appears thin or underdeveloped.');
    }

    if (options.strictness === 'strict') score -= 5;
    if (options.strictness === 'generous') score += 5;

    score = clamp(Math.round(score));

    return {
      id: section.id,
      index,
      heading: headingText || `Section ${index + 1}`,
      level: section.level,
      score,
      grade: gradeFromScore(score),
      wordCount,
      metrics: {
        questionHeading,
        intentPhraseCount: intentPhrases.length,
        entityCount: entities.length,
        paragraphCount: paragraphs.length,
        listCount: lists.length,
        tableCount: tables.length,
        linkCount: links.length,
        externalLinkCount: externalLinks.length,
        averageParagraphWords,
        hasDirectAnswer,
        hasEvidence,
        unsupportedClaim,
        wallOfText,
        tooThin
      },
      evidence: {
        firstAnswerCandidate: firstSentence,
        intentPhrases,
        vaguePhrases,
        entities: entities.slice(0, 12)
      },
      positives: unique(positives),
      negatives: unique(negatives),
      opportunities: unique(opportunities),
      textPreview: text.slice(0, 600),
      _elements: section.elements,
      _headingElement: section.headingElement
    };
  }

  function scoreSeo(schema) {
    const title = cleanText(document.title || '');
    const metaDescription = getMetaContent('meta[name="description" i]');
    const canonical = getLinkHref('link[rel="canonical" i]');
    const robots = getRobotsMeta();
    const h1s = [...document.querySelectorAll('h1')].filter(isVisibleElement);
    const headings = [...document.querySelectorAll('h1,h2,h3')].filter(isVisibleElement);
    const viewport = getMetaContent('meta[name="viewport" i]');
    const lang = cleanText(document.documentElement.getAttribute('lang') || '');
    const images = [...document.images].filter(img => isVisibleElement(img));
    const meaningfulImages = images.filter(img => (img.naturalWidth || img.width) > 80 && (img.naturalHeight || img.height) > 80);
    const imagesWithAlt = meaningfulImages.filter(img => cleanText(img.getAttribute('alt') || '').length > 0);
    const links = [...document.querySelectorAll('a[href]')].filter(isVisibleElement);
    const descriptiveLinks = links.filter(link => {
      const text = cleanText(link.innerText || link.getAttribute('aria-label') || link.title || '');
      return text.length > 3 && !/^(click here|read more|learn more|more)$/i.test(text);
    });

    const checks = [];
    addCheck(checks, 'title-present', 'Title tag exists', Boolean(title), 10, title || 'Missing title tag.');
    addCheck(checks, 'title-length', 'Title length is useful', title.length >= 25 && title.length <= 70, 7, `${title.length} characters.`);
    addCheck(checks, 'meta-description-present', 'Meta description exists', Boolean(metaDescription), 10, metaDescription || 'Missing meta description.');
    addCheck(checks, 'meta-description-length', 'Meta description length is useful', metaDescription.length >= 70 && metaDescription.length <= 170, 7, `${metaDescription.length} characters.`);
    addCheck(checks, 'canonical', 'Canonical link exists', Boolean(canonical), 8, canonical || 'Missing canonical link.');
    addCheck(checks, 'h1-count', 'Exactly one visible H1', h1s.length === 1, 10, `${h1s.length} visible H1 tag(s).`);
    addCheck(checks, 'heading-structure', 'Visible heading structure exists', headings.length >= 3, 7, `${headings.length} visible H1-H3 heading(s).`);
    addCheck(checks, 'indexable-robots', 'Robots meta does not block indexing', !/noindex/i.test(robots), 10, robots || 'No robots meta block detected.');
    addCheck(checks, 'viewport', 'Viewport meta exists', Boolean(viewport), 5, viewport || 'Missing viewport meta.');
    addCheck(checks, 'html-lang', 'HTML language is declared', Boolean(lang), 5, lang || 'Missing html lang attribute.');
    addCheck(checks, 'json-ld', 'JSON-LD structured data exists', schema.validBlocks > 0, 8, `${schema.validBlocks} valid JSON-LD block(s).`);
    addCheck(checks, 'image-alt', 'Meaningful images have alt text', meaningfulImages.length === 0 || imagesWithAlt.length / meaningfulImages.length >= 0.8, 6, `${imagesWithAlt.length}/${meaningfulImages.length} meaningful images have alt text.`);
    addCheck(checks, 'descriptive-links', 'Links use descriptive anchor text', links.length === 0 || descriptiveLinks.length / links.length >= 0.75, 4, `${descriptiveLinks.length}/${links.length} links appear descriptive.`);

    const maxScore = checks.reduce((sum, check) => sum + check.maxPoints, 0);
    const rawScore = checks.reduce((sum, check) => sum + check.points, 0);
    const score = Math.round((rawScore / maxScore) * 100);

    return {
      score,
      grade: gradeFromScore(score),
      checks,
      metadata: {
        title,
        titleLength: title.length,
        metaDescription,
        metaDescriptionLength: metaDescription.length,
        canonical,
        robots,
        lang,
        viewport,
        h1Count: h1s.length,
        headingCount: headings.length,
        imageCount: meaningfulImages.length,
        imagesWithAlt: imagesWithAlt.length,
        linkCount: links.length,
        descriptiveLinkCount: descriptiveLinks.length
      }
    };
  }

  function addCheck(checks, id, label, passed, maxPoints, details) {
    checks.push({
      id,
      label,
      status: passed ? 'pass' : 'fail',
      points: passed ? maxPoints : 0,
      maxPoints,
      details
    });
  }

  function scoreGeo(sections) {
    const totalSections = sections.length || 1;
    const avgSectionScore = Math.round(sections.reduce((sum, section) => sum + section.score, 0) / totalSections);
    const intentSections = sections.filter(section => section.metrics.intentPhraseCount > 0 || section.metrics.questionHeading).length;
    const answerSections = sections.filter(section => section.metrics.hasDirectAnswer).length;
    const evidenceSections = sections.filter(section => section.metrics.hasEvidence).length;
    const vagueSections = sections.filter(section => section.evidence.vaguePhrases.length > 0).length;
    const unsupportedSections = sections.filter(section => section.metrics.unsupportedClaim).length;
    const entityRichSections = sections.filter(section => section.metrics.entityCount >= 3).length;

    let score = avgSectionScore;
    if (intentSections / totalSections >= 0.5) score += 5;
    if (answerSections / totalSections >= 0.5) score += 8;
    if (evidenceSections / totalSections >= 0.35) score += 6;
    if (entityRichSections / totalSections >= 0.5) score += 4;
    if (vagueSections / totalSections > 0.3) score -= 8;
    if (unsupportedSections > 0) score -= Math.min(10, unsupportedSections * 2);
    score = clamp(Math.round(score));

    const checks = [
      ratioCheck('intent-coverage', 'Intent coverage', intentSections, totalSections, 0.45),
      ratioCheck('answerability', 'Direct answer coverage', answerSections, totalSections, 0.45),
      ratioCheck('entity-strength', 'Entity-rich sections', entityRichSections, totalSections, 0.45),
      ratioCheck('evidence-readiness', 'Evidence-supported sections', evidenceSections, totalSections, 0.35),
      inverseRatioCheck('vague-copy', 'Low vague-copy density', vagueSections, totalSections, 0.25),
      inverseRatioCheck('unsupported-claims', 'Low unsupported-claim density', unsupportedSections, totalSections, 0.15)
    ];

    return {
      score,
      grade: gradeFromScore(score),
      checks,
      metrics: {
        totalSections,
        intentSections,
        answerSections,
        evidenceSections,
        entityRichSections,
        vagueSections,
        unsupportedSections,
        averageSectionScore: avgSectionScore
      }
    };
  }

  function ratioCheck(id, label, count, total, threshold) {
    const ratio = total ? count / total : 0;
    return {
      id,
      label,
      status: ratio >= threshold ? 'pass' : 'warn',
      value: `${count}/${total}`,
      details: `${Math.round(ratio * 100)}% of sections.`
    };
  }

  function inverseRatioCheck(id, label, count, total, threshold) {
    const ratio = total ? count / total : 0;
    return {
      id,
      label,
      status: ratio <= threshold ? 'pass' : 'warn',
      value: `${count}/${total}`,
      details: `${Math.round(ratio * 100)}% of sections.`
    };
  }

  function buildRecommendations(seo, schema, geo, sections, context = {}) {
    const recommendations = [];

    if (context.mode === 'google-doc') {
      recommendations.push(
        { type: 'Publish prep', priority: 'High', text: 'When uploading, map the draft title and section headings to a clean H1/H2/H3 structure in the CMS.' },
        { type: 'Publish prep', priority: 'High', text: 'When uploading, add the final page title, meta description, canonical URL, image alt text, and schema in the website/CMS layer.' },
        { type: 'Publish prep', priority: 'Medium', text: 'Before publishing, convert strong claims into sourced proof points with links, dates, examples, or named standards.' }
      );
    }

    for (const check of seo.checks.filter(check => check.status === 'fail').slice(0, context.mode === 'google-doc' ? 2 : 5)) {
      recommendations.push({ type: 'SEO', priority: 'High', text: `${check.label}: ${check.details}` });
    }

    for (const warning of schema.warnings.slice(0, context.mode === 'google-doc' ? 1 : 4)) {
      recommendations.push({ type: 'Schema', priority: schema.validBlocks === 0 ? 'High' : 'Medium', text: warning });
    }

    const weakest = [...sections].sort((a, b) => a.score - b.score).slice(0, 5);
    for (const section of weakest) {
      const fix = section.opportunities[0] || section.negatives[0];
      if (fix) recommendations.push({ type: 'GEO', priority: section.score < 70 ? 'High' : 'Medium', text: `${section.heading}: ${fix}` });
    }

    if (geo.metrics.answerSections / geo.metrics.totalSections < 0.4) {
      recommendations.unshift({ type: 'GEO', priority: 'High', text: 'Add direct answer blocks under the most important headings.' });
    }

    return recommendations.slice(0, 12);
  }

  function runAudit(options = {}) {
    clearHighlights();
    const mode = isGoogleDocsDocument() ? 'google-doc' : 'web-page';
    const schema = extractStructuredData();
    const seo = scoreSeo(schema);
    const sectionsWithElements = extractSections(options);
    const geo = scoreGeo(sectionsWithElements);
    const overallScore = mode === 'google-doc'
      ? clamp(Math.round((seo.score * 0.1) + (geo.score * 0.85) + (schema.score * 0.05)))
      : clamp(Math.round((seo.score * 0.3) + (geo.score * 0.55) + (schema.score * 0.15)));
    const recommendations = buildRecommendations(seo, schema, geo, sectionsWithElements, { mode });

    STATE.sectionElements.clear();
    for (const section of sectionsWithElements) {
      STATE.sectionElements.set(section.id, {
        headingElement: section._headingElement,
        elements: section._elements
      });
    }

    const sections = sectionsWithElements.map(section => {
      const { _elements, _headingElement, ...serializable } = section;
      return serializable;
    });

    const audit = {
      version: VERSION,
      auditedAt: new Date().toISOString(),
      url: location.href,
      host: location.hostname,
      mode,
      title: cleanText(document.title || ''),
      score: overallScore,
      grade: gradeFromScore(overallScore),
      seo,
      schema,
      geo,
      sections,
      recommendations,
      byobPrompt: buildByobPrompt({
        url: location.href,
        title: cleanText(document.title || ''),
        mode,
        grade: gradeFromScore(overallScore),
        score: overallScore,
        seo,
        schema,
        geo,
        sections,
        recommendations
      })
    };

    STATE.audit = audit;
    if (options.autoHighlight !== false) {
      applyHighlights(sectionsWithElements, audit, options);
    }
    return audit;
  }

  function clearHighlights() {
    document.querySelectorAll('.geo-lens-mark').forEach(mark => {
      const text = document.createTextNode(mark.textContent || '');
      mark.replaceWith(text);
    });
    document.querySelectorAll('.geo-lens-section-badge, .geo-lens-floating-status').forEach(el => el.remove());
    document.querySelectorAll('.geo-lens-answer-block, .geo-lens-weak-block, .geo-lens-warning-block, .geo-lens-focused-section').forEach(el => {
      el.classList.remove('geo-lens-answer-block', 'geo-lens-weak-block', 'geo-lens-warning-block', 'geo-lens-focused-section');
    });
    STATE.highlightsVisible = true;
  }

  function applyHighlights(sections, audit, options = {}) {
    const showGood = options.showGood !== false;
    const showBad = options.showBad !== false;

    for (const section of sections) {
      if (section._headingElement) {
        section._headingElement.setAttribute('data-geo-lens-section-id', section.id);
        if (!section._headingElement.__geoLensHeadingClickBound) {
          section._headingElement.addEventListener('click', handleInspectedSectionClick);
          section._headingElement.__geoLensHeadingClickBound = true;
        }
        section._headingElement.appendChild(createSectionBadge(section));
      }

      const paragraphs = section._elements.filter(el => el.tagName?.toLowerCase() === 'p');
      if (showGood && section.metrics.hasDirectAnswer && paragraphs[0]) {
        paragraphs[0].classList.add('geo-lens-answer-block');
      }
      if (showBad && section.score < 65) {
        const target = paragraphs[0] || section._headingElement;
        if (target) target.classList.add('geo-lens-weak-block');
      } else if (showBad && section.metrics.unsupportedClaim) {
        const target = paragraphs.find(p => CLAIM_REGEX.test(p.innerText || p.textContent || '')) || paragraphs[0];
        if (target) target.classList.add('geo-lens-warning-block');
      }

      if (showGood) {
        section._elements.slice(0, 10).forEach(el => wrapTextMatches(el, INTENT_PHRASE_REGEX, 'geo-lens-mark-good', 'Intent-driven phrase'));
      }
      if (showBad) {
        section._elements.slice(0, 10).forEach(el => wrapTextMatches(el, BAD_PHRASE_REGEX, 'geo-lens-mark-bad', 'Vague marketing phrase'));
      }
    }

    createFloatingStatus(audit);
  }

  function createSectionBadge(section) {
    const badge = document.createElement('span');
    badge.className = 'geo-lens-section-badge';
    badge.dataset.sectionId = section.id;
    badge.dataset.band = gradeBand(section.grade);
    badge.title = `${section.grade} · ${section.score}/100 · ${section.negatives[0] || section.positives[0] || 'GEO Lens section score'}`;
    badge.textContent = `${section.grade} GEO`;
    badge.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      focusSection(section.id);
      notifySectionSelected(section);
    });
    return badge;
  }

  function notifySectionSelected(section) {
    chrome.runtime.sendMessage({
      type: 'GEO_LENS_PAGE_SECTION_SELECTED',
      sectionId: section.id,
      section: {
        id: section.id,
        heading: section.heading,
        grade: section.grade,
        score: section.score
      }
    }).catch(() => {});
  }

  function handleInspectedSectionClick(event) {
    if (event.target.closest?.('.geo-lens-section-badge')) return;
    const sectionId = event.currentTarget.getAttribute('data-geo-lens-section-id');
    const section = STATE.audit?.sections?.find(item => item.id === sectionId);
    if (section) notifySectionSelected(section);
  }

  function wrapTextMatches(root, regex, className, label) {
    if (!root || root.closest?.('.geo-lens-section-badge, .geo-lens-floating-status')) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest('.geo-lens-mark, .geo-lens-section-badge, .geo-lens-floating-status, script, style, noscript, textarea, input')) {
          return NodeFilter.FILTER_REJECT;
        }
        const text = node.nodeValue || '';
        const testRe = new RegExp(regex.source, regex.flags.replace('g', ''));
        return testRe.test(text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });

    const nodes = [];
    let node;
    while ((node = walker.nextNode()) && nodes.length < 40) {
      nodes.push(node);
    }

    for (const textNode of nodes) {
      const text = textNode.nodeValue || '';
      const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`);
      let lastIndex = 0;
      let match;
      const fragment = document.createDocumentFragment();
      while ((match = re.exec(text))) {
        if (match.index > lastIndex) fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        const mark = document.createElement('mark');
        mark.className = `geo-lens-mark ${className}`;
        mark.title = label;
        mark.textContent = match[0];
        fragment.appendChild(mark);
        lastIndex = re.lastIndex;
        if (match.index === re.lastIndex) re.lastIndex += 1;
      }
      if (lastIndex < text.length) fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      textNode.replaceWith(fragment);
    }
  }

  function createFloatingStatus(audit, options = {}) {
    const status = document.createElement('div');
    status.className = 'geo-lens-floating-status';
    const label = options.message || `GEO Lens: ${audit.grade} · ${audit.score}/100${options.saved ? ' saved' : ''}`;
    status.innerHTML = `<span>${label}</span>`;
    const refreshButton = document.createElement('button');
    refreshButton.type = 'button';
    refreshButton.className = 'geo-lens-refresh-button';
    refreshButton.textContent = 'Refresh';
    refreshButton.title = 'Refresh audit for the currently visible page or Google Docs tab';
    refreshButton.addEventListener('click', () => refreshAuditFromPage(refreshButton));
    status.appendChild(refreshButton);
    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.textContent = 'Clear';
    clearButton.addEventListener('click', clearHighlights);
    status.appendChild(clearButton);
    document.body.appendChild(status);
  }

  async function refreshAuditFromPage(button) {
    const original = button.textContent;
    button.textContent = '...';
    button.disabled = true;
    try {
      await chrome.runtime.sendMessage({ type: 'GEO_LENS_REFRESH_FROM_PAGE' });
    } catch (_error) {
      button.textContent = 'Retry';
      button.disabled = false;
      return;
    }
    button.textContent = original;
    button.disabled = false;
  }

  function installUrlChangeWatcher() {
    const notify = () => setTimeout(handleObservedUrlChange, 250);
    for (const method of ['pushState', 'replaceState']) {
      const original = history[method];
      history[method] = function patchedHistoryMethod(...args) {
        const result = original.apply(this, args);
        notify();
        return result;
      };
    }
    window.addEventListener('popstate', notify);
    window.addEventListener('hashchange', notify);
    setInterval(handleObservedUrlChange, 1200);
  }

  async function handleObservedUrlChange() {
    if (location.href === lastObservedUrl) return;
    lastObservedUrl = location.href;
    clearHighlights();
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GEO_LENS_PAGE_URL_CHANGED',
        url: location.href
      });
      if (response?.audit) {
        STATE.audit = response.audit;
        createFloatingStatus(response.audit, { saved: true });
      } else {
        STATE.audit = null;
        createFloatingStatus(null, { message: 'GEO Lens: Refresh needed' });
      }
    } catch (_error) {
      createFloatingStatus(null, { message: 'GEO Lens: Refresh needed' });
    }
  }

  function toggleHighlights(enabled) {
    STATE.highlightsVisible = enabled;
    const targets = document.querySelectorAll('.geo-lens-mark, .geo-lens-section-badge, .geo-lens-floating-status, .geo-lens-answer-block, .geo-lens-weak-block, .geo-lens-warning-block');
    targets.forEach(target => target.classList.toggle('geo-lens-hidden', !enabled));
    return { visible: enabled };
  }

  function focusSection(sectionId) {
    const record = STATE.sectionElements.get(sectionId);
    const target = record?.headingElement || document.querySelector(`[data-geo-lens-section-id="${CSS.escape(sectionId)}"]`);
    if (!target) return { ok: false, error: 'Section not found on page.' };
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('geo-lens-focused-section');
    setTimeout(() => target.classList.remove('geo-lens-focused-section'), 3500);
    return { ok: true };
  }

  function buildByobPrompt(audit) {
    const weakSections = audit.sections
      .filter(section => section.score < 80 || section.negatives.length > 0)
      .sort((a, b) => a.score - b.score)
      .slice(0, 6);
    const strongSections = audit.sections
      .filter(section => section.score >= 85)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    return [
      'You are an expert SEO, GEO, answer-engine-optimization, and conversion copy auditor.',
      'Review the page audit below. Give practical recommendations that improve search visibility, LLM answerability, citation-worthiness, and marketing clarity.',
      'Be blunt. Prioritize fixes by expected impact. Do not invent facts that are not in the audit.',
      '',
      `URL: ${audit.url}`,
      `Page title: ${audit.title}`,
      `Overall grade: ${audit.grade} (${audit.score}/100)`,
      `SEO: ${audit.seo.grade} (${audit.seo.score}/100)`,
      `GEO: ${audit.geo.grade} (${audit.geo.score}/100)`,
      `Schema: ${audit.schema.grade} (${audit.schema.score}/100)`,
      `Detected schema types: ${audit.schema.types.length ? audit.schema.types.join(', ') : 'None'}`,
      '',
      'Top recommendations from local audit:',
      ...audit.recommendations.slice(0, 8).map((item, index) => `${index + 1}. [${item.priority}] ${item.type}: ${item.text}`),
      '',
      'Weakest sections:',
      ...weakSections.map(section => [
        `- ${section.heading} · ${section.grade} (${section.score}/100)`,
        `  Problems: ${section.negatives.join(' ') || 'No explicit negative note, but score is weak.'}`,
        `  Opportunities: ${section.opportunities.join(' ') || 'Add clearer answer structure and evidence.'}`,
        `  Preview: ${section.textPreview.slice(0, 260).replace(/\s+/g, ' ')}`
      ].join('\n')),
      '',
      'Strongest sections to preserve:',
      ...strongSections.map(section => `- ${section.heading} · ${section.grade} (${section.score}/100): ${section.positives.join(' ')}`),
      '',
      'Please return:',
      '1. The 5 highest-impact fixes.',
      '2. Specific rewrite examples for the weakest sections.',
      '3. Missing schema opportunities.',
      '4. Intent-driven headings or FAQ questions to add.',
      '5. Any claims that need proof, source links, dates, or clearer entity naming.'
    ].join('\n');
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'GEO_LENS_PING') {
      sendResponse({ ok: true, version: VERSION });
      return false;
    }

    if (message?.type === 'GEO_LENS_RUN_AUDIT') {
      try {
        const audit = runAudit(message.options || {});
        sendResponse(audit);
      } catch (error) {
        sendResponse({ error: String(error.message || error) });
      }
      return false;
    }

    if (message?.type === 'GEO_LENS_CLEAR_HIGHLIGHTS') {
      clearHighlights();
      sendResponse({ ok: true });
      return false;
    }

    if (message?.type === 'GEO_LENS_TOGGLE_HIGHLIGHTS') {
      sendResponse(toggleHighlights(Boolean(message.enabled)));
      return false;
    }

    if (message?.type === 'GEO_LENS_FOCUS_SECTION') {
      sendResponse(focusSection(message.sectionId));
      return false;
    }

    return false;
  });

  installUrlChangeWatcher();
})();
