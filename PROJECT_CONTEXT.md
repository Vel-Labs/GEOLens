# Project Context — GEO Lens

Reviewed: 2026-10-12. This is a source-backed interpretation, not a live status or new acceptance record.

Project identity: `workspace:40_Code/projects/geo-lens-extension-v0.1.0`

Topics: `chrome-extension`, `seo-audit`, `heuristic-scoring`, `page-inspection`, `clipboard-export`, `browser-acceptance`

## At a glance

| Question | Answer | Evidence |
| --- | --- | --- |
| Why does this project exist? | GEO Lens is a local-first Chrome extension MVP for page-level SEO, GEO, answerability, structured data, and evidence review. It gives marketers and SEOs page and section feedback with highlights and copyable audit material. | [README.md](README.md) |
| What is implemented, and what remains unverified? | The inspected source includes Manifest V3 wiring, active-tab page inspection, heuristic scoring, highlights, a side panel, local extension storage, and clipboard exports. This was source inspection only; Chrome loading and actual browser behavior were not tested. | [project-context-evidence.md](docs/project-context-evidence.md) |
| What do the grades establish? | The grades are heuristic review signals. They do not predict search ranking or AI citations. The scoring document explicitly says the model is not a ranking-factor oracle; extraction gaps such as Shadow DOM and SPA timing remain on the roadmap. | [SCORING_MODEL.md](docs/SCORING_MODEL.md), [PRODUCT_ROADMAP.md](docs/PRODUCT_ROADMAP.md) |
| What is the data and privacy boundary? | No provider API call was found in the inspected source, but the extension copies page-derived audit material for users to paste into external AI services. Local processing therefore does not mean zero privacy risk. | [project-context-evidence.md](docs/project-context-evidence.md) |
| What acceptance is recorded, and who owns it? | The reviewed docs contain no browser acceptance receipt, tested version, accepted browser scope, or named acceptance owner. The existing install instructions and implementation claims are not acceptance evidence. | [project-context-evidence.md](docs/project-context-evidence.md) |
| How fresh is this context? | This source and document review is dated 2026-10-12. The May 25 implementation-file and October 10 README filesystem timestamps do not show a fresh browser acceptance; current browser behavior remains unknown. | [project-context-evidence.md](docs/project-context-evidence.md) |
| What is the smallest useful follow-up? | Record one owner-named Chrome acceptance pass on a safe test page. Pin the extension version and tested flows, including audit rendering, highlights, local history, and clipboard copy, and state the external-paste privacy boundary. | [project-context-evidence.md](docs/project-context-evidence.md) |

## Related projects

| Project | Relationship | Connection | Review when | Evidence |
| --- | --- | --- | --- | --- |
| Not declared | — | No connection inferred | Review only after supporting evidence exists | None yet |

Topics aid discovery; they do not establish dependencies or classify AI sessions. Relationships identify review candidates only. No automatic downstream updates or runtime migration.

## Agent-readable source

This block owns the tables above. After editing it, regenerate this page with `python3 scripts/project_context.py /absolute/PROJECT_CONTEXT.md` from this repo. Evidence paths are relative to this repository; keep other projects referenced by their stable identities. Validation checks table agreement and source pins, not acceptance or live state. Do not publish private context merely because a repo has publication intent.

```json
{
  "schema": "project-context-v1",
  "identity": "workspace:40_Code/projects/geo-lens-extension-v0.1.0",
  "name": "GEO Lens",
  "reviewed_on": "2026-10-12",
  "path_basis": "repository",
  "topics": [
    "chrome-extension",
    "seo-audit",
    "heuristic-scoring",
    "page-inspection",
    "clipboard-export",
    "browser-acceptance"
  ],
  "summary": [
    {
      "question": "Why does this project exist?",
      "answer": "GEO Lens is a local-first Chrome extension MVP for page-level SEO, GEO, answerability, structured data, and evidence review. It gives marketers and SEOs page and section feedback with highlights and copyable audit material.",
      "evidence": [
        {
          "path": "README.md",
          "sha256": "e3dca77c2fb8f308a0b13051b9988c4c34530e1fff8121e8b83bc3dbd531cdc3",
          "excerpt": "GEO Lens is a local-first Chrome extension MVP for auditing SEO, GEO, answerability, structured data, and page-level evidence."
        }
      ]
    },
    {
      "question": "What is implemented, and what remains unverified?",
      "answer": "The inspected source includes Manifest V3 wiring, active-tab page inspection, heuristic scoring, highlights, a side panel, local extension storage, and clipboard exports. This was source inspection only; Chrome loading and actual browser behavior were not tested.",
      "evidence": [
        {
          "path": "docs/project-context-evidence.md",
          "sha256": "8ceaaca19fcb9e7ea8f0e398b870f702b23991599bc393bc12f0242285b9604e",
          "excerpt": "Thus the inspected implementation supports a source-level feature summary, while actual Chrome loading, page behavior, clipboard flow, accessibility, and result quality remain unverified."
        }
      ]
    },
    {
      "question": "What do the grades establish?",
      "answer": "The grades are heuristic review signals. They do not predict search ranking or AI citations. The scoring document explicitly says the model is not a ranking-factor oracle; extraction gaps such as Shadow DOM and SPA timing remain on the roadmap.",
      "evidence": [
        {
          "path": "docs/SCORING_MODEL.md",
          "sha256": "5567feb5b931fa1db6fb8a8c51c55a6208768ef2b75fa5466d7a0c6a10f8b6e5",
          "excerpt": "The model is heuristic by design. It is not a ranking-factor oracle and should not pretend to be one."
        },
        {
          "path": "docs/PRODUCT_ROADMAP.md",
          "sha256": "06b5ac287e44fdfacb07220fc3e36f1889188d76f878b479a0e1edf753b62af3",
          "excerpt": "Add support for: - Shadow DOM. - Iframes where allowed. - SPA hydration timing. - Article extraction fallback."
        }
      ]
    },
    {
      "question": "What is the data and privacy boundary?",
      "answer": "No provider API call was found in the inspected source, but the extension copies page-derived audit material for users to paste into external AI services. Local processing therefore does not mean zero privacy risk.",
      "evidence": [
        {
          "path": "docs/project-context-evidence.md",
          "sha256": "8ceaaca19fcb9e7ea8f0e398b870f702b23991599bc393bc12f0242285b9604e",
          "excerpt": "This source search does not establish runtime behavior, overall privacy safety, or zero privacy risk: users can paste copied page-derived material into an external service."
        }
      ]
    },
    {
      "question": "What acceptance is recorded, and who owns it?",
      "answer": "The reviewed docs contain no browser acceptance receipt, tested version, accepted browser scope, or named acceptance owner. The existing install instructions and implementation claims are not acceptance evidence.",
      "evidence": [
        {
          "path": "docs/project-context-evidence.md",
          "sha256": "8ceaaca19fcb9e7ea8f0e398b870f702b23991599bc393bc12f0242285b9604e",
          "excerpt": "It contains no browser acceptance receipt naming an owner, tested extension version, or accepted scope."
        }
      ]
    },
    {
      "question": "How fresh is this context?",
      "answer": "This source and document review is dated 2026-10-12. The May 25 implementation-file and October 10 README filesystem timestamps do not show a fresh browser acceptance; current browser behavior remains unknown.",
      "evidence": [
        {
          "path": "docs/project-context-evidence.md",
          "sha256": "8ceaaca19fcb9e7ea8f0e398b870f702b23991599bc393bc12f0242285b9604e",
          "excerpt": "The May 25 implementation-file and October 10 README filesystem timestamps are not browser acceptance evidence."
        }
      ]
    },
    {
      "question": "What is the smallest useful follow-up?",
      "answer": "Record one owner-named Chrome acceptance pass on a safe test page. Pin the extension version and tested flows, including audit rendering, highlights, local history, and clipboard copy, and state the external-paste privacy boundary.",
      "evidence": [
        {
          "path": "docs/project-context-evidence.md",
          "sha256": "8ceaaca19fcb9e7ea8f0e398b870f702b23991599bc393bc12f0242285b9604e",
          "excerpt": "It contains no browser acceptance receipt naming an owner, tested extension version, or accepted scope."
        }
      ]
    }
  ],
  "related_projects": []
}
```
