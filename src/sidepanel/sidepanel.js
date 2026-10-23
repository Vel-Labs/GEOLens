const state = {
  audit: null,
  settings: {
    strictness: 'balanced',
    autoHighlight: true,
    brandTerms: '',
    showGood: true,
    showBad: true,
    showSchema: true
  },
  highlightsVisible: true,
  selectedSectionId: null,
  onboardingStep: 0
};

const els = {
  auditButton: document.getElementById('auditButton'),
  copyPromptButton: document.getElementById('copyPromptButton'),
  copyTldrButton: document.getElementById('copyTldrButton'),
  copyEditorBriefButton: document.getElementById('copyEditorBriefButton'),
  copyScoreButton: document.getElementById('copyScoreButton'),
  exportJsonButton: document.getElementById('exportJsonButton'),
  exportMarkdownButton: document.getElementById('exportMarkdownButton'),
  toggleHighlightsButton: document.getElementById('toggleHighlightsButton'),
  clearHighlightsButton: document.getElementById('clearHighlightsButton'),
  overallGrade: document.getElementById('overallGrade'),
  modePill: document.getElementById('modePill'),
  lastChecked: document.getElementById('lastChecked'),
  statusBox: document.getElementById('statusBox'),
  overviewEmpty: document.getElementById('overviewEmpty'),
  overviewContent: document.getElementById('overviewContent'),
  sectionsList: document.getElementById('sectionsList'),
  sectionFilter: document.getElementById('sectionFilter'),
  evidenceContent: document.getElementById('evidenceContent'),
  publishContent: document.getElementById('publishContent'),
  historyContent: document.getElementById('historyContent'),
  schemaContent: document.getElementById('schemaContent'),
  strictnessInput: document.getElementById('strictnessInput'),
  autoHighlightInput: document.getElementById('autoHighlightInput'),
  showGoodInput: document.getElementById('showGoodInput'),
  showBadInput: document.getElementById('showBadInput'),
  brandTermsInput: document.getElementById('brandTermsInput'),
  saveSettingsButton: document.getElementById('saveSettingsButton'),
  showOnboardingButton: document.getElementById('showOnboardingButton'),
  onboardingOverlay: document.getElementById('onboardingOverlay'),
  onboardingTitle: document.getElementById('onboardingTitle'),
  onboardingBody: document.getElementById('onboardingBody'),
  onboardingProgress: document.getElementById('onboardingProgress'),
  prevOnboardingButton: document.getElementById('prevOnboardingButton'),
  nextOnboardingButton: document.getElementById('nextOnboardingButton'),
  closeOnboardingButton: document.getElementById('closeOnboardingButton')
};

const onboardingSteps = [
  {
    title: 'Welcome to GEO Lens',
    html: `<p>This extension audits the current page locally for SEO, GEO, answerability, schema, weak marketing copy, and LLM-ready evidence.</p><p>It is designed for marketers, SEOs, content strategists, and product teams.</p>`
  },
  {
    title: 'Run your first audit',
    html: `<p>Open a normal website page and click <strong>Audit current page</strong>. GEO Lens will grade the page and add visual highlights.</p><p>Chrome blocks internal pages like <code>chrome://</code>, the Chrome Web Store, and some PDFs.</p>`
  },
  {
    title: 'Use the highlights',
    html: `<p>Blue marks are intent-driven phrases. Green outlines are answer-like blocks. Red and orange marks flag weak copy or unsupported claims.</p><p>Every major section receives a grade from F to A+.</p>`
  },
  {
    title: 'Bring Your Own Bot',
    html: `<p>Click <strong>Copy LLM prompt</strong> to copy a concise audit packet. Paste it into ChatGPT, Claude, Gemini, Perplexity, or your internal LLM.</p><p>No API key is needed. No page content is sent by this extension.</p>`
  }
];

function gradeBand(grade = '') {
  const first = String(grade).charAt(0).toLowerCase();
  return ['a', 'b', 'c', 'd', 'f'].includes(first) ? first : 'c';
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setStatus(message, type = '') {
  els.statusBox.textContent = message;
  els.statusBox.className = `status ${type}`.trim();
}

function setButtonsEnabled(enabled) {
  [
    els.copyPromptButton,
    els.copyTldrButton,
    els.copyEditorBriefButton,
    els.copyScoreButton,
    els.exportJsonButton,
    els.exportMarkdownButton,
    els.toggleHighlightsButton,
    els.clearHighlightsButton
  ].forEach(button => {
    button.disabled = !enabled;
  });
}

async function loadInitialState() {
  const stored = await chrome.storage.local.get([
    'geoLensSettings',
    'geoLensOnboardingComplete',
    'latestAudit',
    'geoLensLastError'
  ]);

  if (stored.geoLensSettings) {
    state.settings = { ...state.settings, ...stored.geoLensSettings };
  }
  syncSettingsToForm();

  const activeState = await chrome.runtime.sendMessage({ type: 'GEO_LENS_GET_AUDIT_FOR_ACTIVE_TAB' }).catch(() => null);
  if (activeState?.audit) {
    renderAudit(activeState.audit);
    setStatus('Loaded saved audit for the current page. Refresh after changing page state or Google Docs tabs.', 'good');
  } else if (stored.latestAudit) {
    renderAudit(stored.latestAudit);
    setStatus('Loaded the most recent audit. Refresh to audit the current page.', 'good');
  } else if (stored.geoLensLastError) {
    setStatus(stored.geoLensLastError, 'bad');
  }

  if (!stored.geoLensOnboardingComplete) {
    showOnboarding(0);
  }
}

function syncSettingsToForm() {
  els.strictnessInput.value = state.settings.strictness || 'balanced';
  els.autoHighlightInput.checked = state.settings.autoHighlight !== false;
  els.showGoodInput.checked = state.settings.showGood !== false;
  els.showBadInput.checked = state.settings.showBad !== false;
  els.brandTermsInput.value = state.settings.brandTerms || '';
}

function readSettingsFromForm() {
  return {
    strictness: els.strictnessInput.value,
    autoHighlight: els.autoHighlightInput.checked,
    showGood: els.showGoodInput.checked,
    showBad: els.showBadInput.checked,
    showSchema: true,
    brandTerms: els.brandTermsInput.value.trim()
  };
}

async function saveSettings() {
  state.settings = readSettingsFromForm();
  await chrome.storage.local.set({ geoLensSettings: state.settings });
  setStatus('Settings saved.', 'good');
}

async function runAudit() {
  setStatus('Running local page audit...');
  els.auditButton.disabled = true;
  try {
    state.settings = readSettingsFromForm();
    await chrome.storage.local.set({ geoLensSettings: state.settings });
    const response = await chrome.runtime.sendMessage({
      type: 'GEO_LENS_RUN_AUDIT_FROM_PANEL',
      options: state.settings
    });

    if (!response?.ok) {
      throw new Error(response?.error || 'Audit failed. Try clicking the extension icon on the page again.');
    }

    renderAudit(response.audit);
    setStatus('Audit complete. Use Copy LLM prompt for BYOB analysis.', 'good');
  } catch (error) {
    setStatus(String(error.message || error), 'bad');
  } finally {
    els.auditButton.disabled = false;
  }
}

function renderAudit(audit) {
  state.audit = audit;
  state.highlightsVisible = true;
  els.overallGrade.textContent = audit.grade || '—';
  els.overallGrade.className = `grade-pill badge ${gradeBand(audit.grade)}`;
  els.modePill.textContent = audit.mode === 'google-doc' ? 'Draft mode' : 'Audit mode';
  els.lastChecked.textContent = `Checked ${formatAuditTime(audit.auditedAt)}`;
  setButtonsEnabled(true);
  els.toggleHighlightsButton.textContent = 'Hide highlights';

  els.overviewEmpty.classList.add('hidden');
  els.overviewContent.classList.remove('hidden');

  renderOverview(audit);
  renderSections(audit);
  renderEvidence(audit);
  renderPublish(audit);
  renderHistory(audit);
  renderSchema(audit);
}

function clearAuditDisplay(message = 'Refresh to audit the current page.') {
  state.audit = null;
  state.selectedSectionId = null;
  els.overallGrade.textContent = '—';
  els.overallGrade.className = 'grade-pill';
  els.modePill.textContent = 'Ready';
  els.lastChecked.textContent = 'Not checked yet';
  setButtonsEnabled(false);
  els.overviewEmpty.classList.remove('hidden');
  els.overviewContent.classList.add('hidden');
  els.sectionsList.innerHTML = '';
  els.evidenceContent.innerHTML = '';
  els.publishContent.innerHTML = '';
  els.historyContent.innerHTML = '';
  els.schemaContent.innerHTML = '';
  setStatus(message);
}

function renderOverview(audit) {
  const easyWins = getEasyWins(audit);
  const checklist = getArticleChecklist(audit);
  const doneCount = checklist.filter(item => item.done).length;
  const nextAction = easyWins[0]?.text || 'Refresh after your next content change.';
  const isDraft = audit.mode === 'google-doc';

  els.overviewContent.innerHTML = `
    <div class="guide-hero">
      <div>
        <p class="eyebrow">${isDraft ? 'Draft guide' : 'Page audit'}</p>
        <h2>${audit.grade} · ${audit.score}/100</h2>
        <p>${escapeHtml(nextAction)}</p>
      </div>
      <span class="mode-pill">${doneCount}/${checklist.length} ready</span>
    </div>

    <div class="card">
      <h2>Easy wins</h2>
      ${renderEasyWins(easyWins)}
    </div>

    <div class="card">
      <h2>Article progress</h2>
      ${renderChecklist(checklist)}
    </div>

    <details class="details-card">
      <summary>Score details</summary>
      <div class="score-grid compact">
        ${scoreCard('Overall', audit.grade, audit.score)}
        ${scoreCard(isDraft ? 'Draft' : 'SEO', isDraft ? audit.geo.grade : audit.seo.grade, isDraft ? audit.geo.score : audit.seo.score)}
        ${scoreCard('Answer quality', audit.geo.grade, audit.geo.score)}
        ${scoreCard(isDraft ? 'Publish Prep' : 'Schema', isDraft ? 'N/A' : audit.schema.grade, isDraft ? 'N/A' : audit.schema.score)}
      </div>
    </details>
  `;
}

function scoreCard(label, grade, score) {
  const numericScore = Number(score);
  const scoreText = Number.isFinite(numericScore)
    ? `${numericScore}<small>/100</small>`
    : escapeHtml(score);
  return `
    <div class="score-card">
      <div class="label">${escapeHtml(label)}</div>
      <div class="score"><span class="badge ${gradeBand(grade)}">${escapeHtml(grade)}</span> ${scoreText}</div>
    </div>
  `;
}

function formatAuditTime(value) {
  if (!value) return 'never';
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(value));
  } catch (_error) {
    return 'recently';
  }
}

function getEasyWins(audit) {
  const items = [];
  const highPriority = audit.recommendations
    .filter(item => item.priority === 'High')
    .slice(0, 4)
    .map(item => ({ label: item.type, text: item.text }));

  items.push(...highPriority);

  if (audit.geo.metrics.answerSections / audit.geo.metrics.totalSections < 0.5) {
    items.unshift({ label: 'Answer quality', text: 'Add direct answer blocks under the most important headings.' });
  }
  if (audit.geo.metrics.unsupportedSections > 0) {
    items.unshift({ label: 'Proof needed', text: 'Add sources, dates, examples, or standards near strong claims.' });
  }
  if (audit.geo.metrics.intentSections / audit.geo.metrics.totalSections < 0.45) {
    items.push({ label: 'Reader questions', text: 'Rewrite vague headings so they match the questions readers would ask.' });
  }
  if (audit.mode === 'google-doc') {
    items.push({ label: 'Before upload', text: 'Draft the meta title, meta description, image alt text, and schema notes before publishing.' });
  }

  return uniqueByText(items).slice(0, 5);
}

function getArticleChecklist(audit) {
  const metrics = audit.geo.metrics;
  const hasFaq = audit.sections.some(section => /faq|frequently asked|questions/i.test(section.heading));
  const hasClaims = metrics.unsupportedSections === 0;
  const hasStrongStructure = metrics.totalSections >= 4 && metrics.intentSections / metrics.totalSections >= 0.45;
  const hasAnswerBlocks = metrics.answerSections / metrics.totalSections >= 0.45;
  const hasEvidence = metrics.evidenceSections / metrics.totalSections >= 0.35;
  const hasEntities = metrics.entityRichSections / metrics.totalSections >= 0.35;
  const checklist = [
    { label: 'Clear article structure', detail: 'Use headings that match reader questions.', done: hasStrongStructure },
    { label: 'Direct answers', detail: 'Give the answer early in each important section.', done: hasAnswerBlocks },
    { label: 'Proof for claims', detail: 'Support strong claims with evidence.', done: hasClaims },
    { label: 'Concrete examples', detail: 'Use numbers, dates, links, examples, or named standards.', done: hasEvidence },
    { label: 'Named entities', detail: 'Make products, people, places, and concepts explicit.', done: hasEntities },
    { label: 'FAQ-ready ending', detail: 'Add FAQ coverage when the topic has obvious follow-up questions.', done: hasFaq }
  ];

  if (audit.mode === 'google-doc') {
    checklist.push({ label: 'Publish metadata planned', detail: 'Prepare title, description, canonical, alt text, and schema in the CMS.', done: false });
  }

  return checklist;
}

function uniqueByText(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = item.text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function renderEasyWins(items) {
  if (!items.length) return '<p class="muted">No urgent fixes detected. Refresh after your next edit.</p>';
  return `<ol class="easy-win-list">${items.slice(0, 3).map(item => `
    <li>
      <span>${escapeHtml(item.label)}</span>
      <p>${escapeHtml(item.text)}</p>
    </li>
  `).join('')}</ol>`;
}

function renderChecklist(items) {
  return `<ul class="progress-list">${items.map(item => `
    <li class="${item.done ? 'done' : ''}">
      <span class="check-dot">${item.done ? 'OK' : ''}</span>
      <span><strong>${escapeHtml(item.label)}</strong><br><span class="muted">${escapeHtml(item.detail)}</span></span>
    </li>
  `).join('')}</ul>`;
}

function renderRecommendationList(items) {
  if (!items.length) return '<p class="muted">No recommendations generated.</p>';
  return `<ul class="recommendation-list">${items.map(item => `
    <li>
      <span class="badge ${item.priority === 'High' ? 'f' : 'c'}">${escapeHtml(item.priority)}</span>
      <span><strong>${escapeHtml(item.type)}:</strong> ${escapeHtml(item.text)}</span>
    </li>
  `).join('')}</ul>`;
}

function renderCheckList(checks) {
  return `<ul class="check-list">${checks.map(check => `
    <li>
      <span class="badge ${check.status === 'pass' ? 'a' : 'f'}">${check.status === 'pass' ? 'OK' : 'Fix'}</span>
      <span><strong>${escapeHtml(check.label)}</strong><br><span class="muted">${escapeHtml(check.details)}</span></span>
    </li>
  `).join('')}</ul>`;
}

function renderGeoChecks(checks) {
  return `<ul class="check-list">${checks.map(check => `
    <li>
      <span class="badge ${check.status === 'pass' ? 'a' : 'c'}">${escapeHtml(check.value)}</span>
      <span><strong>${escapeHtml(check.label)}</strong><br><span class="muted">${escapeHtml(check.details)}</span></span>
    </li>
  `).join('')}</ul>`;
}

function renderSections(audit) {
  const filter = els.sectionFilter.value;
  let sections = [...audit.sections];
  if (filter === 'weak') sections = sections.filter(section => section.score < 80 || section.negatives.length);
  if (filter === 'strong') sections = sections.filter(section => section.score >= 85);
  if (filter === 'claims') sections = sections.filter(section => section.metrics.unsupportedClaim);

  if (!sections.length) {
    els.sectionsList.innerHTML = '<div class="empty-state"><h2>No sections match this filter</h2><p>Try a different filter.</p></div>';
    return;
  }

  els.sectionsList.innerHTML = sections.map(section => `
    <article class="section-card ${state.selectedSectionId === section.id ? 'is-active' : ''}" data-section-id="${escapeHtml(section.id)}">
      <header>
        <div>
          <div class="section-title">${escapeHtml(section.heading)}</div>
          <div class="section-meta">${section.wordCount} words · ${section.metrics.intentPhraseCount} intent phrases · ${section.metrics.entityCount} entities</div>
        </div>
        <span class="badge ${gradeBand(section.grade)}">${escapeHtml(section.grade)}</span>
      </header>
      ${section.evidence.firstAnswerCandidate ? `<p><strong>Answer candidate:</strong> ${escapeHtml(section.evidence.firstAnswerCandidate)}</p>` : ''}
      ${section.negatives.length ? `<p><strong>Problems:</strong> ${escapeHtml(section.negatives.join(' '))}</p>` : ''}
      ${section.opportunities.length ? `<p><strong>Fix:</strong> ${escapeHtml(section.opportunities.join(' '))}</p>` : ''}
      ${section.evidence.intentPhrases.length ? renderPills(section.evidence.intentPhrases, 'Intent') : ''}
      ${section.evidence.entities.length ? renderPills(section.evidence.entities, 'Entities') : ''}
      ${section.evidence.vaguePhrases.length ? renderPills(section.evidence.vaguePhrases, 'Weak copy') : ''}
      <div class="section-actions">
        <button data-action="focus" data-section-id="${escapeHtml(section.id)}">Focus on page</button>
        <button data-action="copy-section" data-section-id="${escapeHtml(section.id)}">Copy section prompt</button>
      </div>
    </article>
  `).join('');
}

function renderPills(items, label) {
  return `
    <div class="small-note">${escapeHtml(label)}</div>
    <div class="pill-row">${items.slice(0, 10).map(item => `<span class="pill">${escapeHtml(item)}</span>`).join('')}</div>
  `;
}

function renderEvidence(audit) {
  const strongest = audit.sections
    .filter(section => section.score >= 85)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  const weakest = audit.sections
    .filter(section => section.score < 80 || section.negatives.length)
    .sort((a, b) => a.score - b.score)
    .slice(0, 8);
  const claimSections = audit.sections.filter(section => section.metrics.unsupportedClaim);

  els.evidenceContent.innerHTML = `
    <div class="card">
      <h2>Strong evidence to preserve</h2>
      ${strongest.length ? sectionEvidenceList(strongest, 'positive') : '<p class="muted">No strong sections detected yet.</p>'}
    </div>
    <div class="card">
      <h2>Weak evidence to fix</h2>
      ${weakest.length ? sectionEvidenceList(weakest, 'negative') : '<p class="muted">No weak sections detected.</p>'}
    </div>
    <div class="card">
      <h2>Unsupported claim watchlist</h2>
      ${claimSections.length ? sectionEvidenceList(claimSections, 'claim') : '<p class="muted">No unsupported claims detected by the heuristic.</p>'}
    </div>
  `;
}

function sectionEvidenceList(sections, mode) {
  return `<ul class="evidence-list">${sections.map(section => {
    const text = mode === 'positive'
      ? section.positives.join(' ')
      : mode === 'claim'
        ? 'Strong claim appears without obvious proof nearby. Add a source, metric, standard, or date.'
        : [...section.negatives, ...section.opportunities].join(' ');
    return `
      <li class="${state.selectedSectionId === section.id ? 'is-active' : ''}" data-section-id="${escapeHtml(section.id)}" data-evidence-mode="${escapeHtml(mode)}">
        <span class="badge ${gradeBand(section.grade)}">${escapeHtml(section.grade)}</span>
        <span><strong>${escapeHtml(section.heading)}</strong><br><span class="muted">${escapeHtml(text || 'No note.')}</span></span>
      </li>
    `;
  }).join('')}</ul>`;
}

function renderSchema(audit) {
  const schema = audit.schema;
  const warnings = schema.warnings || [];
  const invalid = schema.invalid || [];
  els.schemaContent.innerHTML = `
    <div class="card">
      <h2>Structured data score</h2>
      <p><span class="badge ${gradeBand(schema.grade)}">${escapeHtml(schema.grade)}</span> ${schema.score}/100</p>
      <div class="pill-row">
        <span class="pill">${schema.jsonLdCount} JSON-LD blocks</span>
        <span class="pill">${schema.validBlocks} valid</span>
        <span class="pill">${schema.invalidBlocks} invalid</span>
      </div>
    </div>
    <div class="card">
      <h2>Detected schema types</h2>
      ${schema.types.length ? renderPills(schema.types, 'Types') : '<p class="muted">No schema types detected.</p>'}
    </div>
    <div class="card">
      <h2>Warnings</h2>
      ${warnings.length ? `<ul class="evidence-list">${warnings.map(warning => `<li><span class="badge c">Warn</span><span>${escapeHtml(warning)}</span></li>`).join('')}</ul>` : '<p class="muted">No schema warnings.</p>'}
    </div>
    ${invalid.length ? `<div class="card"><h2>Invalid JSON-LD</h2>${invalid.map(item => `<pre class="code-block">Block ${item.index}: ${escapeHtml(item.message)}\n${escapeHtml(item.preview)}</pre>`).join('')}</div>` : ''}
  `;
}

function renderPublish(audit) {
  const uploadChecklist = [
    { label: 'Map H1/H2/H3 in the CMS', done: audit.geo.metrics.intentSections / audit.geo.metrics.totalSections >= 0.45 },
    { label: 'Draft final meta title', done: false },
    { label: 'Draft final meta description', done: false },
    { label: 'Confirm canonical URL', done: audit.mode !== 'google-doc' && Boolean(audit.seo.metadata.canonical) },
    { label: 'Add alt text for meaningful images', done: audit.mode !== 'google-doc' && audit.seo.metadata.imageCount === audit.seo.metadata.imagesWithAlt },
    { label: 'Add schema or schema notes', done: audit.mode !== 'google-doc' && audit.schema.validBlocks > 0 },
    { label: 'Source strong claims', done: audit.geo.metrics.unsupportedSections === 0 }
  ];

  els.publishContent.innerHTML = `
    <div class="card">
      <h2>Before publishing</h2>
      <p class="muted">Use this as the handoff checklist from draft to website.</p>
      ${renderChecklist(uploadChecklist)}
    </div>
    <div class="card">
      <h2>Copy handoff</h2>
      <div class="button-stack">
        <button id="publishTldrButton">Copy TLDR</button>
        <button id="publishBriefButton">Copy editor brief</button>
      </div>
    </div>
  `;

  document.getElementById('publishTldrButton')?.addEventListener('click', () => copyText(buildTldrBrief(audit), 'TLDR copied.'));
  document.getElementById('publishBriefButton')?.addEventListener('click', () => copyText(buildEditorBrief(audit), 'Editor brief copied.'));
}

async function renderHistory(currentAudit) {
  const stored = await chrome.storage.local.get(['auditHistory', 'recentAudits', 'recentAuditOrder']).catch(() => ({}));
  const currentKey = normalizeAuditUrl(currentAudit.url);
  const samePageAudits = (stored.auditHistory || [])
    .filter(audit => normalizeAuditUrl(audit.url) === currentKey)
    .slice(0, 8);
  const recentAudits = (stored.recentAuditOrder || [])
    .map(key => stored.recentAudits?.[key])
    .filter(Boolean)
    .slice(0, 8);
  const audits = samePageAudits.length ? samePageAudits : recentAudits;

  if (!audits.length) {
    els.historyContent.innerHTML = '<div class="empty-state"><h2>No history yet</h2><p>Run a few audits and recent scores will appear here.</p></div>';
    return;
  }

  const previous = samePageAudits[1] || null;
  const delta = previous ? currentAudit.score - previous.score : null;

  els.historyContent.innerHTML = `
    <div class="card">
      <h2>${samePageAudits.length ? 'Score over time' : 'Recent audits'}</h2>
      <p class="muted">${delta === null ? 'Run this page again to see score movement.' : `Latest change: ${delta >= 0 ? '+' : ''}${delta} points.`}</p>
    </div>
    <div class="history-list">
      ${audits.map(audit => `
        <article class="history-item ${audit.url === currentAudit.url ? 'current' : ''}">
          <span class="badge ${gradeBand(audit.grade)}">${escapeHtml(audit.grade)}</span>
          <div>
            <strong>${escapeHtml(audit.title || 'Untitled')}</strong>
            <p>${escapeHtml(formatAuditTime(audit.auditedAt))} · ${audit.score}/100</p>
          </div>
        </article>
      `).join('')}
    </div>
  `;
}

function normalizeAuditUrl(url = '') {
  return String(url).split('#')[0];
}

async function copyText(text, label = 'Copied') {
  await navigator.clipboard.writeText(text);
  setStatus(label, 'good');
}

function buildTldrBrief(audit) {
  const wins = getEasyWins(audit).slice(0, 3).map(item => item.text);
  return [
    `${audit.mode === 'google-doc' ? 'Draft' : 'Page'} score: ${audit.grade} (${audit.score}/100).`,
    `Last checked: ${formatAuditTime(audit.auditedAt)}.`,
    wins.length ? `Biggest wins: ${wins.join(' ')}` : 'No urgent fixes detected.',
    audit.geo.metrics.unsupportedSections ? `${audit.geo.metrics.unsupportedSections} section(s) need stronger proof.` : 'No unsupported-claim sections detected.'
  ].join('\n');
}

function buildEditorBrief(audit) {
  const wins = getEasyWins(audit).slice(0, 5);
  const weakSections = audit.sections
    .filter(section => section.score < 80 || section.negatives.length)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);

  return [
    `GEO Lens editor brief`,
    `URL: ${audit.url}`,
    `Score: ${audit.grade} (${audit.score}/100)`,
    `Last checked: ${formatAuditTime(audit.auditedAt)}`,
    '',
    'Easy wins:',
    ...wins.map((item, index) => `${index + 1}. ${item.text}`),
    '',
    'Sections needing attention:',
    ...weakSections.map((section, index) => `${index + 1}. ${section.heading} (${section.grade}, ${section.score}/100): ${[...section.negatives, ...section.opportunities].join(' ') || 'Tighten answer quality and evidence.'}`),
    '',
    'Before publish:',
    '- Map the final H1/H2/H3 structure.',
    '- Add title, meta description, canonical, image alt text, and schema in the CMS.',
    '- Add sources, dates, examples, or standards near strong claims.'
  ].join('\n');
}

function buildScoreSummary(audit) {
  return [
    `GEO Lens audit for ${audit.url}`,
    `Overall: ${audit.grade} (${audit.score}/100)`,
    `SEO: ${audit.seo.grade} (${audit.seo.score}/100)`,
    `GEO: ${audit.geo.grade} (${audit.geo.score}/100)`,
    `Schema: ${audit.schema.grade} (${audit.schema.score}/100)`,
    '',
    'Priority fixes:',
    ...audit.recommendations.slice(0, 8).map((item, index) => `${index + 1}. [${item.priority}] ${item.type}: ${item.text}`)
  ].join('\n');
}

function buildSectionPrompt(section, audit) {
  return [
    'You are an expert SEO/GEO content strategist. Rewrite or improve this page section for answer-engine visibility.',
    `Page: ${audit.url}`,
    `Section: ${section.heading}`,
    `Grade: ${section.grade} (${section.score}/100)`,
    `Problems: ${section.negatives.join(' ') || 'None detected.'}`,
    `Opportunities: ${section.opportunities.join(' ') || 'Improve clarity, entity naming, and evidence.'}`,
    `Detected intent phrases: ${section.evidence.intentPhrases.join(', ') || 'None'}`,
    `Detected entities: ${section.evidence.entities.join(', ') || 'None'}`,
    '',
    'Current section preview:',
    section.textPreview,
    '',
    'Return a better heading, a 1 to 2 sentence direct answer block, and 3 tactical improvements. Do not invent unsupported facts.'
  ].join('\n');
}

function buildMarkdownReport(audit) {
  const isDraft = audit.mode === 'google-doc';
  return [
    `# GEO Lens ${isDraft ? 'Google Docs Draft Audit' : 'Audit'}`,
    '',
    `**URL:** ${audit.url}`,
    `**Title:** ${audit.title}`,
    `**Audited:** ${audit.auditedAt}`,
    '',
    `## Scores`,
    '',
    `| Area | Grade | Score |`,
    `|---|---:|---:|`,
    `| Overall | ${audit.grade} | ${audit.score}/100 |`,
    `| ${isDraft ? 'Draft' : 'SEO'} | ${isDraft ? audit.geo.grade : audit.seo.grade} | ${isDraft ? audit.geo.score : audit.seo.score}/100 |`,
    `| GEO | ${audit.geo.grade} | ${audit.geo.score}/100 |`,
    `| ${isDraft ? 'Publish Prep' : 'Schema'} | ${isDraft ? 'N/A' : audit.schema.grade} | ${isDraft ? 'N/A' : `${audit.schema.score}/100`} |`,
    '',
    `## Priority Fixes`,
    '',
    ...audit.recommendations.map((item, index) => `${index + 1}. **[${item.priority}] ${item.type}:** ${item.text}`),
    '',
    `## Sections`,
    '',
    ...audit.sections.map(section => [
      `### ${section.grade} · ${section.heading}`,
      '',
      `Score: ${section.score}/100`,
      '',
      section.positives.length ? `**Strengths:** ${section.positives.join(' ')}` : '',
      section.negatives.length ? `**Problems:** ${section.negatives.join(' ')}` : '',
      section.opportunities.length ? `**Opportunities:** ${section.opportunities.join(' ')}` : '',
      section.evidence.firstAnswerCandidate ? `**Answer candidate:** ${section.evidence.firstAnswerCandidate}` : '',
      ''
    ].filter(Boolean).join('\n')),
    '',
    `## Schema`,
    '',
    `Detected types: ${audit.schema.types.join(', ') || 'None'}`,
    `Warnings: ${audit.schema.warnings.join(' ') || 'None'}`
  ].join('\n');
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function slugHost(url) {
  try {
    return new URL(url).hostname.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  } catch (_error) {
    return 'page';
  }
}

function showOnboarding(step = 0) {
  state.onboardingStep = Math.max(0, Math.min(step, onboardingSteps.length - 1));
  const current = onboardingSteps[state.onboardingStep];
  els.onboardingTitle.textContent = current.title;
  els.onboardingBody.innerHTML = current.html;
  els.onboardingProgress.innerHTML = onboardingSteps.map((_, index) => `<span class="dot ${index === state.onboardingStep ? 'active' : ''}"></span>`).join('');
  els.prevOnboardingButton.disabled = state.onboardingStep === 0;
  els.nextOnboardingButton.textContent = state.onboardingStep === onboardingSteps.length - 1 ? 'Finish' : 'Next';
  els.onboardingOverlay.classList.remove('hidden');
}

async function closeOnboarding() {
  els.onboardingOverlay.classList.add('hidden');
  await chrome.storage.local.set({ geoLensOnboardingComplete: true });
}

function activateTab(tabName) {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${tabName}`);
  });
}

function scrollReportElementIntoView(element) {
  if (!element) return false;
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  element.classList.add('is-active');
  setTimeout(() => element.classList.remove('is-active'), 3000);
  return true;
}

function revealSectionInPanel(sectionId) {
  if (!state.audit || !sectionId) return;
  const section = state.audit.sections.find(item => item.id === sectionId);
  if (!section) return;

  state.selectedSectionId = sectionId;
  els.sectionFilter.value = 'all';
  renderSections(state.audit);
  renderEvidence(state.audit);
  activateTab('sections');

  requestAnimationFrame(() => {
    const selector = `[data-section-id="${CSS.escape(sectionId)}"]`;
    const target = els.sectionsList.querySelector(selector) || els.evidenceContent.querySelector(selector);
    if (scrollReportElementIntoView(target)) {
      setStatus(`Selected section: ${section.heading}`, 'good');
    }
  });
}

async function toggleHighlights() {
  state.highlightsVisible = !state.highlightsVisible;
  const response = await chrome.runtime.sendMessage({
    type: 'GEO_LENS_TOGGLE_HIGHLIGHTS_FROM_PANEL',
    enabled: state.highlightsVisible
  });
  if (!response?.ok) throw new Error(response?.error || 'Could not toggle highlights.');
  els.toggleHighlightsButton.textContent = state.highlightsVisible ? 'Hide highlights' : 'Show highlights';
}

async function clearHighlights() {
  const response = await chrome.runtime.sendMessage({ type: 'GEO_LENS_CLEAR_HIGHLIGHTS_FROM_PANEL' });
  if (!response?.ok) throw new Error(response?.error || 'Could not clear highlights.');
  setStatus('Highlights cleared.', 'good');
}

async function focusSection(sectionId) {
  const response = await chrome.runtime.sendMessage({
    type: 'GEO_LENS_FOCUS_SECTION_FROM_PANEL',
    sectionId
  });
  if (!response?.ok) throw new Error(response?.error || 'Could not focus section.');
}

function bindEvents() {
  els.auditButton.addEventListener('click', runAudit);
  els.copyTldrButton.addEventListener('click', () => state.audit && copyText(buildTldrBrief(state.audit), 'TLDR copied.'));
  els.copyEditorBriefButton.addEventListener('click', () => state.audit && copyText(buildEditorBrief(state.audit), 'Editor brief copied.'));
  els.copyPromptButton.addEventListener('click', () => state.audit && copyText(state.audit.byobPrompt, 'LLM prompt copied. Paste it into your preferred AI tool.'));
  els.copyScoreButton.addEventListener('click', () => state.audit && copyText(buildScoreSummary(state.audit), 'Score summary copied.'));
  els.exportJsonButton.addEventListener('click', () => {
    if (!state.audit) return;
    downloadFile(`geo-lens-${slugHost(state.audit.url)}.json`, JSON.stringify(state.audit, null, 2), 'application/json');
  });
  els.exportMarkdownButton.addEventListener('click', () => {
    if (!state.audit) return;
    downloadFile(`geo-lens-${slugHost(state.audit.url)}.md`, buildMarkdownReport(state.audit), 'text/markdown');
  });
  els.toggleHighlightsButton.addEventListener('click', () => toggleHighlights().catch(error => setStatus(String(error.message || error), 'bad')));
  els.clearHighlightsButton.addEventListener('click', () => clearHighlights().catch(error => setStatus(String(error.message || error), 'bad')));
  els.saveSettingsButton.addEventListener('click', saveSettings);
  els.showOnboardingButton.addEventListener('click', () => showOnboarding(0));
  els.sectionFilter.addEventListener('change', () => state.audit && renderSections(state.audit));

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => activateTab(tab.dataset.tab));
  });

  document.addEventListener('click', event => {
    document.querySelectorAll('.menu-button[open]').forEach(menu => {
      if (!menu.contains(event.target)) menu.removeAttribute('open');
    });
  });

  els.sectionsList.addEventListener('click', async event => {
    const button = event.target.closest('button[data-action]');
    if (!button || !state.audit) return;
    const section = state.audit.sections.find(item => item.id === button.dataset.sectionId);
    if (!section) return;

    try {
      if (button.dataset.action === 'focus') {
        await focusSection(section.id);
      }
      if (button.dataset.action === 'copy-section') {
        await copyText(buildSectionPrompt(section, state.audit), 'Section prompt copied.');
      }
    } catch (error) {
      setStatus(String(error.message || error), 'bad');
    }
  });

  els.prevOnboardingButton.addEventListener('click', () => showOnboarding(state.onboardingStep - 1));
  els.nextOnboardingButton.addEventListener('click', async () => {
    if (state.onboardingStep >= onboardingSteps.length - 1) {
      await closeOnboarding();
    } else {
      showOnboarding(state.onboardingStep + 1);
    }
  });
  els.closeOnboardingButton.addEventListener('click', closeOnboarding);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'GEO_LENS_AUDIT_COMPLETE') {
    renderAudit(message.audit);
    setStatus('Audit complete. Use Copy LLM prompt for BYOB analysis.', 'good');
  }
  if (message?.type === 'GEO_LENS_PAGE_CONTEXT_CHANGED') {
    if (message.audit) {
      renderAudit(message.audit);
      setStatus('Loaded saved audit for this page. Refresh if the visible content changed.', 'good');
    } else {
      clearAuditDisplay('This page or Google Docs tab has not been audited yet. Click Refresh.');
    }
  }
  if (message?.type === 'GEO_LENS_SECTION_SELECTED') {
    revealSectionInPanel(message.sectionId);
  }
  if (message?.type === 'GEO_LENS_ERROR') {
    setStatus(message.error, 'bad');
  }
});

bindEvents();
loadInitialState().catch(error => setStatus(String(error.message || error), 'bad'));
