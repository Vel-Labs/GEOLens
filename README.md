# GEO Lens - SEO & AI Search Inspector

GEO Lens is a local-first Chrome extension MVP for auditing SEO, GEO, answerability, structured data, and page-level evidence.

It grades pages and sections from F to A+, highlights good and bad signals directly on the page, and creates a copy/paste-ready LLM audit prompt so users can bring their own bot.

## What it does now

- Audits the current page from the Chrome side panel.
- Detects title, meta description, canonical, robots, H1s, headings, viewport, language, image alt coverage, descriptive links, and JSON-LD.
- Parses JSON-LD and lists schema types.
- Splits the page into visible content sections.
- Scores each section for intent match, direct answer quality, entity clarity, evidence, chunkability, vague marketing language, and unsupported claims.
- Adds on-page badges for section grades.
- Highlights intent phrases, answer blocks, weak copy, and unsupported-claim risk.
- Exports JSON and Markdown reports.
- Copies an LLM-ready audit packet for ChatGPT, Claude, Gemini, Perplexity, or internal LLM tools.
- Includes a first-time walkthrough and local settings.
- Can run a lightweight Google Docs draft audit on visible document content, with publish-prep reminders for CMS upload.

## Quick install for local testing

1. Download or clone this folder.
2. Open Chrome 116 or newer (see `manifest.json`).
3. Visit `chrome://extensions`.
4. Turn on **Developer mode**.
5. Click **Load unpacked**.
6. Select the folder containing `manifest.json` (`geo-lens-extension-v0.1.0` in this Workspace).
7. Open any normal `https://` page.
8. Click the GEO Lens extension icon.
9. Use the side panel to run the audit.

Chrome blocks extensions from auditing some pages, including `chrome://` pages, Chrome Web Store pages, browser settings pages, and some PDFs.

For Google Docs, reload the extension after install or manifest changes, open the document, then click the GEO Lens extension icon. The Docs audit is a draft-readiness pass, not a 1:1 website SEO/schema audit.

Google Docs tabs are audited one visible tab at a time. If you switch document tabs, click the floating **Refresh** button or run the audit again from the side panel. GEO Lens keeps a small recent-audit cache by page URL so returning to a previously audited page or Docs tab can show its last score without forcing an immediate refresh.

## Project structure

```text
geo-lens-extension/
  manifest.json
  assets/
    icon-16.png
    icon-32.png
    icon-48.png
    icon-128.png
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
    BUILD_FROM_ZERO.md
    SCORING_MODEL.md
    PRODUCT_ROADMAP.md
```

## Development notes

See [Project Context](PROJECT_CONTEXT.md) for a dated, source-pinned overview. Edit its JSON block and regenerate the readable tables with `python3 scripts/project_context.py /absolute/path/to/PROJECT_CONTEXT.md` from this directory. Rendering updates the readable tables; check the source pins separately with `python3 -B -c 'from pathlib import Path; from scripts.project_context import check_page; check_page(Path.cwd(), "PROJECT_CONTEXT.md", "workspace:40_Code/projects/geo-lens-extension-v0.1.0")'`. Neither check establishes browser acceptance or live status.

This MVP is intentionally dependency-free. You do not need Node, React, TypeScript, Vite, or a backend to run it.

That is deliberate. For a first Chrome extension, fewer moving pieces is better.

Once the workflow is proven, the next version should move toward TypeScript, tests, a build pipeline, and optional backend services for multi-page crawls or team reporting.

## BYOB prompt philosophy

The extension does not call an LLM. It produces a concise audit packet that the user can paste into their preferred model.

This avoids:

- API-key storage.
- Token billing.
- Privacy risk.
- Vendor lock-in.
- Support issues around model quality.

It also makes the tool more broadly useful inside companies that already have approved AI systems.

## Strong warning

This is a serious MVP, not a finished commercial product. The scoring model is heuristic. It should be treated as an opinionated assistant, not a ground-truth SEO oracle.

Before publishing publicly, add automated tests, permissions review, accessibility QA, edge-case handling, and legal/privacy copy.
