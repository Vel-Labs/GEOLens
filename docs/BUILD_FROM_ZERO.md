# Build GEO Lens from zero

This guide assumes you have never built a Chrome extension before.

The goal is to build a local-first Chrome extension that behaves like a Lighthouse-style inspector for SEO, GEO, answerability, structured data, and page-level marketing evidence.

The MVP in this folder is already functional. Use this guide to understand how to rebuild it, modify it, and improve it safely.

---

## 1. What you are building

GEO Lens has four moving parts:

```text
1. manifest.json
   Tells Chrome what the extension is, what permissions it needs, and where its files live.

2. Background service worker
   Coordinates extension events, opens the side panel, injects the content script, and runs audits.

3. Content script
   Runs inside the inspected webpage. Reads the DOM, scans visible content, parses schema, scores sections, and injects highlights.

4. Side panel UI
   Shows the audit report, settings, onboarding, export buttons, and copy/paste LLM prompt.
```

The architecture is intentionally local-first:

```text
Page DOM -> Content Script -> Local Audit Object -> Side Panel Report -> Copy/Export
```

No LLM API. No backend. No database. No tracking.

---

## 2. Install the basic tools

For the current MVP, you only need Chrome and a code editor.

Recommended:

- Google Chrome.
- VS Code.
- A terminal.
- Optional: Node.js later, once you add TypeScript/build tooling.

You do not need npm for this starter version.

---

## 3. Create the folder structure

Create a folder called `geo-lens-extension`.

Inside it, create this structure:

```text
geo-lens-extension/
  manifest.json
  assets/
  src/
    background/
      service-worker.js
    content/
      page-inspector.js
      highlights.css
    sidepanel/
      sidepanel.html
      sidepanel.css
      sidepanel.js
  docs/
```

You can run this in a terminal:

```bash
mkdir -p geo-lens-extension/assets
mkdir -p geo-lens-extension/src/background
mkdir -p geo-lens-extension/src/content
mkdir -p geo-lens-extension/src/sidepanel
mkdir -p geo-lens-extension/docs
```

---

## 4. Understand the manifest

`manifest.json` is the extension’s control file.

The starter manifest uses Manifest V3:

```json
{
  "manifest_version": 3,
  "name": "GEO Lens - SEO & AI Search Inspector",
  "version": "0.1.0",
  "action": {
    "default_title": "Audit this page with GEO Lens"
  },
  "background": {
    "service_worker": "src/background/service-worker.js",
    "type": "module"
  },
  "side_panel": {
    "default_path": "src/sidepanel/sidepanel.html"
  },
  "permissions": [
    "activeTab",
    "scripting",
    "storage",
    "sidePanel",
    "tabs"
  ]
}
```

### Permission choices

Use the narrowest permission model you can tolerate.

This MVP uses:

- `activeTab`: temporary access to the current tab after the user clicks the extension.
- `scripting`: allows the background service worker to inject the content script and CSS.
- `storage`: stores settings, onboarding state, and the latest audit.
- `sidePanel`: shows the persistent side panel report.
- `tabs`: helps find the active tab and read basic tab metadata.

### Why not use `<all_urls>` immediately?

Because it creates a scary install warning: “read and change all your data on all websites.”

For an SEO/GEO tool, that may eventually be acceptable, especially if users want automatic scanning. For a trusted first version, `activeTab` is better because the user explicitly invokes the extension on the page they want audited.

---

## 5. Background service worker

The background service worker is the traffic controller.

It handles:

- Toolbar icon click.
- Keyboard shortcut.
- Opening the side panel.
- Injecting the content script.
- Running the audit.
- Saving the latest audit.
- Relaying commands from the side panel to the current page.

Important functions:

```js
async function getActiveTab()
```

Finds the active browser tab.

```js
async function ensureContentInjected(tab)
```

Injects `highlights.css` and `page-inspector.js` into the current page if they are not already active.

```js
async function runAuditForTab(tab, options)
```

Sends `GEO_LENS_RUN_AUDIT` to the content script and stores the returned audit.

```js
chrome.runtime.onMessage.addListener(...)
```

Receives side panel commands like:

- Run audit.
- Toggle highlights.
- Clear highlights.
- Focus a section on the page.

---

## 6. Content script

The content script is the core product.

It runs inside the webpage and does the inspection work.

### Core jobs

```text
1. Read visible DOM content.
2. Ignore nav/footer/sidebar noise.
3. Parse metadata and JSON-LD.
4. Split content into sections.
5. Score SEO basics.
6. Score GEO/answerability.
7. Score every section from F to A+.
8. Highlight good and bad signals.
9. Return a serializable audit object.
```

### Why the content script is where the value is

Most SEO tools show detached reports. GEO Lens highlights the page itself.

The best UX is not just:

```text
Your page scored C.
```

It is:

```text
This exact paragraph scored C because it is vague, unsupported, and not answerable.
```

That is why the content script stores references to page elements while also creating a clean JSON audit for the side panel.

---

## 7. Section detection

The MVP groups content by visible `h1`, `h2`, and `h3` headings.

It scans these blocks:

```js
h1, h2, h3, p, ul, ol, table, blockquote, details, pre
```

Then it starts a new section whenever it sees a heading.

A section roughly looks like this:

```json
{
  "id": "section-3",
  "heading": "How does Clear Signing protect users?",
  "wordCount": 118,
  "score": 87,
  "grade": "B+",
  "positives": [],
  "negatives": [],
  "opportunities": []
}
```

### Known limitation

This is good enough for an MVP, but not perfect. Modern pages can have complex component structures. Later, improve section detection by using:

- `main` and `article` weighting.
- Visual bounding boxes.
- ARIA landmarks.
- Heading hierarchy trees.
- DOM path clustering.
- Readability-style article extraction.

---

## 8. SEO checks

The MVP checks:

- Title tag exists.
- Title length is useful.
- Meta description exists.
- Meta description length is useful.
- Canonical link exists.
- Exactly one visible H1.
- H1-H3 structure exists.
- Robots meta does not block indexing.
- Viewport meta exists.
- HTML language is declared.
- JSON-LD exists.
- Meaningful images have alt text.
- Links have descriptive anchor text.

The point is not to replace Screaming Frog, Ahrefs, Semrush, Sitebulb, or Search Console.

The point is to cover the obvious SEO fundamentals so the GEO layer has context.

---

## 9. GEO scoring

GEO scoring asks a different question than classic SEO:

```text
Could an answer engine confidently extract, summarize, cite, or route this section for a user's question?
```

A section gains points for:

- Question-like heading.
- Intent phrase.
- Concise direct answer.
- Explicit entities.
- Evidence signals.
- Lists, tables, or chunkable structure.
- Comparison framing when relevant.

A section loses points for:

- Vague marketing language.
- Unsupported claims.
- Too little text.
- Giant wall-of-text paragraphs.
- Weak entity clarity.
- No answer-like sentence near the start.

---

## 10. Highlighting model

The content script adds:

- Section grade badges next to headings.
- Blue marks for intent-driven phrases.
- Green outlines for direct answer blocks.
- Red marks for vague marketing phrases.
- Orange outlines for unsupported claim risk.
- A floating status pill with the overall grade.

The highlighter is intentionally non-destructive. It injects temporary elements and can remove them with the Clear button.

---

## 11. BYOB LLM prompt

The most important product feature is the Copy LLM Prompt button.

Instead of asking the user for an API key, the extension creates a compact audit packet:

```text
You are an expert SEO, GEO, answer-engine-optimization, and conversion copy auditor.
Review the page audit below...

URL: ...
Overall grade: B- (82/100)
SEO: A- (91/100)
GEO: C+ (78/100)
Schema: D (64/100)

Top recommendations:
...

Weakest sections:
...

Please return:
1. The 5 highest-impact fixes.
2. Specific rewrite examples.
3. Missing schema opportunities.
4. Intent-driven headings or FAQ questions to add.
5. Claims that need proof.
```

This is powerful because users can paste it into any approved AI system.

---

## 12. Side panel UI

The side panel has six tabs:

1. Overview
2. Sections
3. Evidence
4. Schema
5. Settings
6. Help

Quality-of-life features included:

- First-time walkthrough.
- Audit button.
- Copy LLM prompt.
- Copy score summary.
- Export JSON.
- Export Markdown.
- Toggle highlights.
- Clear highlights.
- Section filter.
- Focus section on page.
- Copy section-specific prompt.
- Brand/entity boost terms.
- Strictness setting.

---

## 13. Load the extension in Chrome

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the extension folder.
6. Open a normal website page.
7. Click the GEO Lens icon.

When you change code:

1. Go back to `chrome://extensions`.
2. Click the reload button on the GEO Lens extension card.
3. Refresh the webpage you are testing.
4. Click the extension icon again.

---

## 14. Debugging

### Debug side panel

Right-click inside the side panel and choose Inspect.

### Debug content script

Open DevTools on the inspected webpage.

Look at the page console.

### Debug service worker

Go to `chrome://extensions`, find GEO Lens, and click the service worker inspection link.

### Common errors

#### “Could not establish connection”

The content script is not injected yet. Click the extension icon again or reload the inspected page.

#### “Cannot access chrome:// page”

Chrome intentionally blocks extension access to internal browser pages.

#### Highlights look weird

Some websites have aggressive CSS. The MVP uses `!important`, but production needs more edge-case handling.

#### Audit misses page content

The page may be rendered inside a shadow DOM, iframe, app shell, or canvas. Those need later support.

---

## 15. Test checklist

Run the extension on at least these page types:

- Blog article.
- Product page.
- SaaS homepage.
- Documentation page.
- FAQ page.
- Local business page.
- Ecommerce product page.
- Page with no schema.
- Page with invalid JSON-LD.
- Page with lots of vague marketing copy.
- Page with strong headings and answer blocks.

For each page, verify:

- Side panel opens.
- Audit completes.
- Grades make rough sense.
- Section badges appear.
- Highlights can be hidden.
- Highlights can be cleared.
- Copy LLM prompt works.
- Export JSON works.
- Export Markdown works.
- Settings persist.
- First-time walkthrough can be dismissed.

---

## 16. Make the scoring better

The fastest way to improve this tool is not to add an LLM. It is to improve evidence extraction.

Add better detectors for:

- Definition blocks.
- FAQ sections.
- Comparison tables.
- Steps/how-to content.
- Statistics and proof points.
- Author/date/reviewer trust signals.
- Product names.
- Organization names.
- Audience terms.
- Pricing terms.
- Policy/security claims.
- Local intent phrases.
- Ecommerce purchase intent.

Then make the LLM prompt use that extracted evidence.

---

## 17. Productizing the MVP

Before publishing publicly, add:

- TypeScript.
- Unit tests for scoring.
- Snapshot tests for audit objects.
- Better permission strategy.
- Accessibility QA.
- Privacy policy.
- Error telemetry only if users opt in.
- Options page.
- Import/export settings.
- Changelog.
- Versioned scoring model.
- Chrome Web Store listing.

---

## 18. Suggested next technical architecture

For a serious v1:

```text
src/
  background/
  content/
  sidepanel/
  shared/
    scoring/
    detectors/
    schema/
    export/
    prompts/
  tests/
```

Use:

- TypeScript.
- Vite or WXT for extension build tooling.
- Vitest for unit tests.
- Playwright for browser tests.
- ESLint.
- Prettier.
- Zod for audit object validation.

Keep the no-backend BYOB version as the default. Add backend/LLM features only as optional extras.

---

## 19. Publishing checklist

Before uploading to Chrome Web Store:

- Replace placeholder icons with polished brand icons.
- Remove unused permissions.
- Write a privacy policy.
- State clearly that the extension reads page content only when the user invokes it.
- State clearly whether any data leaves the browser. For this MVP, it does not.
- Zip the extension folder.
- Upload the ZIP to the Chrome Web Store developer dashboard.
- Fill out listing details, screenshots, permissions justification, and privacy practices.

---

## 20. Strong product opinion

The commercial edge is not the score. Scores are easy to copy.

The commercial edge is the evidence layer:

```text
This section is weak.
Here is the exact phrase.
Here is why it is weak.
Here is the copy/paste prompt to fix it.
Here is the page highlight so the editor knows where to work.
```

That is the workflow marketers actually need.
