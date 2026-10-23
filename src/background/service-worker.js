const CONTENT_SCRIPT = 'src/content/page-inspector.js';
const CONTENT_CSS = 'src/content/highlights.css';
const MAX_RECENT_AUDITS = 12;

function normalizeAuditUrl(url = '') {
  return String(url).split('#')[0];
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    throw new Error('No active tab found.');
  }
  return tab;
}

function isAuditableUrl(url = '') {
  return /^https?:\/\//i.test(url);
}

async function pingContent(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'GEO_LENS_PING' });
    return Boolean(response && response.ok);
  } catch (_error) {
    return false;
  }
}

async function ensureContentInjected(tab) {
  if (!tab || !tab.id) throw new Error('No tab available for injection.');
  if (!isAuditableUrl(tab.url)) {
    throw new Error('GEO Lens can only audit normal http:// or https:// pages. Chrome internal pages, Web Store pages, PDFs, and browser settings pages are blocked by Chrome.');
  }

  const alreadyInjected = await pingContent(tab.id);
  if (alreadyInjected) return;

  await chrome.scripting.insertCSS({
    target: { tabId: tab.id },
    files: [CONTENT_CSS]
  });

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: [CONTENT_SCRIPT]
  });
}

async function runAuditForTab(tab, options = {}) {
  await ensureContentInjected(tab);
  const audit = await chrome.tabs.sendMessage(tab.id, {
    type: 'GEO_LENS_RUN_AUDIT',
    options
  });

  if (!audit || !audit.url) {
    throw new Error('The page did not return an audit result. Try reloading the page and clicking the extension icon again.');
  }

  const recentUpdate = await buildRecentAuditUpdate(audit);
  await chrome.storage.local.set({
    latestAuditTabId: tab.id,
    latestAudit: audit,
    [`latestAudit_${tab.id}`]: audit,
    ...recentUpdate
  });

  chrome.runtime.sendMessage({ type: 'GEO_LENS_AUDIT_COMPLETE', audit }).catch(() => {});
  return audit;
}

async function buildRecentAuditUpdate(audit) {
  const key = normalizeAuditUrl(audit.url);
  if (!key) return {};
  const stored = await chrome.storage.local.get(['recentAudits', 'recentAuditOrder', 'auditHistory']);
  const recentAudits = stored.recentAudits || {};
  const recentAuditOrder = [key, ...(stored.recentAuditOrder || []).filter(item => item !== key)].slice(0, MAX_RECENT_AUDITS);
  const auditHistory = [audit, ...(stored.auditHistory || [])].slice(0, 30);

  recentAudits[key] = audit;
  for (const oldKey of Object.keys(recentAudits)) {
    if (!recentAuditOrder.includes(oldKey)) delete recentAudits[oldKey];
  }

  return { recentAudits, recentAuditOrder, auditHistory };
}

async function getStoredAuditForTab(tab) {
  return getStoredAuditForUrl(tab?.url || '', tab?.id);
}

async function getStoredAuditForUrl(url, tabId) {
  const key = normalizeAuditUrl(url || '');
  const storageKeys = ['recentAudits'];
  if (tabId) storageKeys.push(`latestAudit_${tabId}`);
  const stored = await chrome.storage.local.get(storageKeys);
  const tabAudit = tabId ? stored[`latestAudit_${tabId}`] : null;
  const recentAudit = key ? stored.recentAudits?.[key] : null;
  const matchingTabAudit = tabAudit && normalizeAuditUrl(tabAudit.url) === key ? tabAudit : null;
  return recentAudit || matchingTabAudit || null;
}

async function notifyPanelForTabContext(tab) {
  if (!tab?.id || !isAuditableUrl(tab.url || '')) return;
  const audit = await getStoredAuditForTab(tab);
  chrome.runtime.sendMessage({
    type: 'GEO_LENS_PAGE_CONTEXT_CHANGED',
    url: tab.url,
    tab: { id: tab.id, title: tab.title, url: tab.url },
    audit
  }).catch(() => {});
}

async function notifyPanelForActiveTab() {
  try {
    const tab = await getActiveTab();
    await notifyPanelForTabContext(tab);
  } catch (_error) {}
}

async function clearHighlightsForTab(tab) {
  await ensureContentInjected(tab);
  return chrome.tabs.sendMessage(tab.id, { type: 'GEO_LENS_CLEAR_HIGHLIGHTS' });
}

async function toggleHighlightsForTab(tab, enabled) {
  await ensureContentInjected(tab);
  return chrome.tabs.sendMessage(tab.id, { type: 'GEO_LENS_TOGGLE_HIGHLIGHTS', enabled });
}

async function focusSectionForTab(tab, sectionId) {
  await ensureContentInjected(tab);
  return chrome.tabs.sendMessage(tab.id, { type: 'GEO_LENS_FOCUS_SECTION', sectionId });
}

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(['geoLensOnboardingComplete', 'geoLensSettings']);
  if (typeof existing.geoLensOnboardingComplete === 'undefined') {
    await chrome.storage.local.set({ geoLensOnboardingComplete: false });
  }
  if (!existing.geoLensSettings) {
    await chrome.storage.local.set({
      geoLensSettings: {
        strictness: 'balanced',
        autoHighlight: true,
        brandTerms: '',
        showGood: true,
        showBad: true,
        showSchema: true
      }
    });
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
    const { geoLensSettings } = await chrome.storage.local.get(['geoLensSettings']);
    await runAuditForTab(tab, geoLensSettings || {});
  } catch (error) {
    await chrome.storage.local.set({ geoLensLastError: String(error.message || error) });
    chrome.runtime.sendMessage({ type: 'GEO_LENS_ERROR', error: String(error.message || error) }).catch(() => {});
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'run-audit') return;
  try {
    const tab = await getActiveTab();
    await chrome.sidePanel.open({ tabId: tab.id });
    const { geoLensSettings } = await chrome.storage.local.get(['geoLensSettings']);
    await runAuditForTab(tab, geoLensSettings || {});
  } catch (error) {
    await chrome.storage.local.set({ geoLensLastError: String(error.message || error) });
    chrome.runtime.sendMessage({ type: 'GEO_LENS_ERROR', error: String(error.message || error) }).catch(() => {});
  }
});

chrome.tabs.onActivated.addListener(() => {
  notifyPanelForActiveTab();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!tab.active) return;
  if (!changeInfo.url && changeInfo.status !== 'complete') return;
  notifyPanelForTabContext(tab);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message?.type === 'GEO_LENS_REFRESH_FROM_PAGE') {
      const tab = _sender.tab;
      if (!tab?.id) throw new Error('No sender tab found for page refresh.');
      const { geoLensSettings } = await chrome.storage.local.get(['geoLensSettings']);
      const audit = await runAuditForTab(tab, geoLensSettings || {});
      sendResponse({ ok: true, audit });
      return;
    }

    if (message?.type === 'GEO_LENS_PAGE_SECTION_SELECTED') {
      chrome.runtime.sendMessage({
        type: 'GEO_LENS_SECTION_SELECTED',
        sectionId: message.sectionId,
        section: message.section
      }).catch(() => {});
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === 'GEO_LENS_PAGE_URL_CHANGED') {
      const tab = _sender.tab;
      const audit = await getStoredAuditForUrl(message.url, tab?.id);
      chrome.runtime.sendMessage({
        type: 'GEO_LENS_PAGE_CONTEXT_CHANGED',
        url: message.url,
        audit
      }).catch(() => {});
      sendResponse({ ok: true, audit });
      return;
    }

    const tab = await getActiveTab();

    switch (message?.type) {
      case 'GEO_LENS_RUN_AUDIT_FROM_PANEL': {
        const audit = await runAuditForTab(tab, message.options || {});
        sendResponse({ ok: true, audit });
        break;
      }
      case 'GEO_LENS_CLEAR_HIGHLIGHTS_FROM_PANEL': {
        const result = await clearHighlightsForTab(tab);
        sendResponse({ ok: true, result });
        break;
      }
      case 'GEO_LENS_TOGGLE_HIGHLIGHTS_FROM_PANEL': {
        const result = await toggleHighlightsForTab(tab, Boolean(message.enabled));
        sendResponse({ ok: true, result });
        break;
      }
      case 'GEO_LENS_FOCUS_SECTION_FROM_PANEL': {
        const result = await focusSectionForTab(tab, message.sectionId);
        sendResponse({ ok: true, result });
        break;
      }
      case 'GEO_LENS_GET_ACTIVE_TAB': {
        sendResponse({ ok: true, tab: { id: tab.id, title: tab.title, url: tab.url } });
        break;
      }
      case 'GEO_LENS_GET_AUDIT_FOR_ACTIVE_TAB': {
        const audit = await getStoredAuditForTab(tab);
        sendResponse({ ok: true, tab: { id: tab.id, title: tab.title, url: tab.url }, audit });
        break;
      }
      default:
        sendResponse({ ok: false, error: 'Unknown GEO Lens message.' });
    }
  })().catch((error) => {
    sendResponse({ ok: false, error: String(error.message || error) });
  });

  return true;
});
