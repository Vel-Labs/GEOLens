# GEO Lens scoring model

This document explains the starter scoring model.

The model is heuristic by design. It is not a ranking-factor oracle and should not pretend to be one.

The goal is to give marketers and SEOs a practical signal about whether a page is technically understandable, answerable, citation-ready, and useful for AI/search retrieval.

---

## Grade bands

| Score | Grade |
|---:|---:|
| 97-100 | A+ |
| 93-96 | A |
| 90-92 | A- |
| 87-89 | B+ |
| 83-86 | B |
| 80-82 | B- |
| 77-79 | C+ |
| 73-76 | C |
| 70-72 | C- |
| 67-69 | D+ |
| 63-66 | D |
| 60-62 | D- |
| 0-59 | F |

---

## Overall page score

The starter MVP uses this weighting:

```text
Overall = SEO * 30% + GEO * 55% + Structured Data * 15%
```

Why GEO is weighted heavily:

SEO fundamentals matter, but this tool’s differentiator is answerability and page-level evidence.

---

## SEO score

The SEO score checks basic technical and page-structure items:

| Check | Why it matters |
|---|---|
| Title exists | Search engines and users need a page label. |
| Title length is useful | Extremely short or long titles are usually weak. |
| Meta description exists | Useful for search snippets and page summaries. |
| Meta description length is useful | Encourages concise page positioning. |
| Canonical exists | Helps avoid duplicate URL ambiguity. |
| Exactly one visible H1 | Gives the page a clear primary topic. |
| Heading structure exists | Makes content easier to scan and chunk. |
| Robots meta does not block indexing | Detects obvious noindex mistakes. |
| Viewport exists | Basic mobile-readiness check. |
| HTML lang exists | Helps accessibility and language interpretation. |
| JSON-LD exists | Supports machine-readable context. |
| Images have alt text | Helps accessibility and image understanding. |
| Links are descriptive | Improves crawlability and user clarity. |

---

## Structured data score

The schema score checks:

- JSON-LD block count.
- Valid JSON parsing.
- Detected `@type` values.
- Common useful types such as Article, BlogPosting, Product, FAQPage, BreadcrumbList, Organization, LocalBusiness, WebPage, and HowTo.
- Invalid JSON-LD warnings.

Important: schema presence does not guarantee rich results or AI visibility. It only improves machine-readable context.

---

## GEO score

The GEO score evaluates whether sections are likely to be useful for answer engines.

A strong GEO section usually has:

- A clear user-intent heading.
- A direct answer near the top.
- Named entities.
- Evidence or proof points.
- Concise chunkable formatting.
- A table, list, FAQ, or comparison when appropriate.

A weak GEO section usually has:

- Vague marketing copy.
- Unsupported claims.
- No direct answer.
- No specific entities.
- Dense paragraphs.
- Thin content.
- Clever headings that do not say what the section is about.

---

## Section scoring logic

Each section starts near the middle and moves up/down based on evidence.

Positive signals:

| Signal | Approximate impact |
|---|---:|
| Question-like heading | +15 |
| Intent-driven language | +8 |
| Direct answer-like sentence | +20 |
| Strong entity signals | +12 |
| Evidence signals | +14 |
| Chunkable structure | +8 |
| Comparison framing | +4 |

Negative signals:

| Signal | Approximate impact |
|---|---:|
| No direct answer | -12 |
| Weak entity clarity | -8 |
| No evidence | -8 |
| Vague marketing phrases | Up to -18 |
| Unsupported strong claim | -12 |
| Wall of text | -10 |
| Thin section | -10 |

Strictness settings:

- Generous: +5
- Balanced: 0
- Strict: -5

---

## Intent phrases

The MVP detects terms such as:

- what is
- how to
- how does
- why does
- can I
- should I
- best way
- best practices
- compare
- vs
- pricing
- cost
- examples
- steps
- checklist
- template
- guide
- review
- benefits
- risks
- pros and cons
- alternatives

Later versions should allow custom intent dictionaries by vertical.

---

## Vague marketing phrases

The MVP flags phrases such as:

- industry-leading
- best-in-class
- world-class
- next-generation
- cutting-edge
- game-changing
- revolutionary
- seamless
- robust
- powerful
- innovative
- unmatched
- state-of-the-art
- trusted by millions
- ultimate solution

These phrases are not automatically bad in every case. They are bad when unsupported, generic, or used instead of a concrete answer.

---

## Unsupported claim detection

The MVP flags claim risk when strong claim words appear without nearby evidence signals.

Claim words include:

- best
- most
- leading
- secure
- safest
- fastest
- easiest
- guaranteed
- proven
- trusted
- certified
- number one
- #1
- millions
- billions

Evidence signals include:

- External links.
- Numbers.
- Percentages.
- Dates.
- Source language.
- Study/report/research language.
- Last updated/reviewed/author signals.

This is imperfect, but useful. The tool should flag review candidates, not make legal claims.

---

## What would make the scoring v1-ready

Add detectors for:

- Source proximity around individual claims.
- Author and reviewer credibility.
- Last updated date.
- Entity consistency across page/schema/title/headings.
- FAQ extraction quality.
- Table quality.
- Product comparison quality.
- Search-intent clusters.
- Local intent.
- Ecommerce purchase intent.
- Documentation intent.
- Security/legal/medical claim risk.

Add tests:

- One test page for each section score band.
- One test page with excellent GEO structure.
- One test page with terrible marketing copy.
- One test page with invalid schema.
- One test page with shadow DOM/SPA content.

---

## Strong warning

Do not overfit the grade.

The right product behavior is:

```text
Score -> Evidence -> Reason -> Suggested action -> Copy/paste prompt
```

A score without evidence is a vanity metric.
