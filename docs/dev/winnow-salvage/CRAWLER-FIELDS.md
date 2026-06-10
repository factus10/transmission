# Crawler Fields Reference — Content Strategy / KKE

This document defines which fields to collect during a crawl, which to compute from extracted content, and which to skip. Derived from Screaming Frog's export schema, filtered for content strategy and KKE/MRA work.

---

## Tier 1 — Crawl Directly, Always Capture

These come from HTTP headers or raw HTML parsing. Collect for every page.

| Field | Source | Notes |
|---|---|---|
| `url` | Crawl | Primary key |
| `crawl_timestamp` | Crawl | ISO 8601 string |
| `status_code` | HTTP response | 200, 301, 302, 404, 500, etc. |
| `status` | Derived from status_code | Human-readable label |
| `content_type` | HTTP `Content-Type` header | Scope HTML vs PDF vs feed |
| `response_ms` | Crawl timing | ms from request to first byte |
| `redirect_url` | HTTP `Location` header | Only populated for 3xx |
| `redirect_type` | Derived | "301", "302", "meta-refresh", etc. |
| `last_modified` | HTTP `Last-Modified` header | Key freshness signal |
| `language` | `<html lang>` attribute | |
| `indexable` | Derived | 1 if indexable, 0 if not |
| `indexability_status` | Derived | Reason: "Indexable", "noindex", "blocked:robots", "canonical:non-self", etc. |
| `meta_robots` | `<meta name="robots">` content | Raw value |
| `canonical` | `<link rel="canonical">` href | |
| `title` | `<title>` text | |
| `meta_description` | `<meta name="description">` content | |
| `h1` | First `<h1>` text | |
| `h2_1` | First `<h2>` text | |
| `h2_2` | Second `<h2>` text | |
| `crawl_depth` | Crawl | Hops from seed URL |
| `folder_depth` | Derived from URL path | Count of `/` segments |
| `inlinks` | Crawl graph | Total links pointing to this URL from within crawl |
| `unique_inlinks` | Crawl graph | Deduplicated source URLs |
| `outlinks` | Parsed from HTML | Total internal links on the page |
| `unique_outlinks` | Parsed from HTML | Deduplicated targets |
| `external_outlinks` | Parsed from HTML | Links to other domains |

---

## Tier 2 — Compute from Extracted Text

These are not HTTP fields — they require running calculations on the extracted page text after HTML parsing. Use the `extracted_text` as input (stripped of HTML tags, nav, footer boilerplate if possible).

| Field | How to compute | Library |
|---|---|---|
| `word_count` | Split on whitespace, count tokens | plain JS |
| `sentence_count` | Split on `.!?` with basic rules | plain JS or `compromise` |
| `avg_words_per_sentence` | `word_count / sentence_count` | derived |
| `text_ratio` | `len(text_content) / len(raw_html)` | derived |
| `flesch_score` | Standard Flesch Reading Ease formula | `flesch-kincaid` npm package |
| `readability` | Binned label from Flesch score | see bins below |
| `title_length` | `title.length` | derived |
| `meta_description_length` | `meta_description.length` | derived |

**Flesch score bins for `readability` label:**

| Score | Label |
|---|---|
| 90–100 | Very Easy |
| 70–89 | Easy |
| 60–69 | Standard |
| 50–59 | Fairly Difficult |
| 30–49 | Difficult |
| 0–29 | Very Difficult |

---

## Tier 3 — Populated in Separate Passes (Post-Crawl)

These are not collected during the crawl. They are written back to SQLite in dedicated passes after the crawl completes.

### GA4 Pass
| Field | Source |
|---|---|
| `ga4_sessions` | GA4 Data API |
| `ga4_pageviews` | GA4 Data API |
| `ga4_bounce_rate` | GA4 Data API |
| `ga4_avg_engagement` | GA4 Data API |

### AI Assessment Pass
| Field | Source |
|---|---|
| `ai_assessment` | Anthropic API — JSON string |
| `screenshot_path` | BrowserWindow capture — relative path |

### KKE Decisions (Manual / AI-assisted)
| Field | Source |
|---|---|
| `kke_decision` | User input in KKE table |
| `mra_notes` | User input in KKE table |

---

## Fields to Skip

Do not implement these. They are either SF-proprietary computations, SEO-technical rather than content-strategic, or not derivable from a standard crawl.

| Field | Reason to skip |
|---|---|
| Title/Meta Pixel Width | Requires font rendering — not worth it |
| Meta Keywords | Obsolete |
| CO2 / Carbon Rating | SF proprietary model |
| Link Score | SF proprietary PageRank-like metric |
| Hash | Internal deduplication only, not user-facing |
| Near Duplicate fields | Requires full-crawl embedding comparison — superseded by AI pass |
| Semantic Similarity fields | SF runs embeddings across full crawl — your AI pass does this better |
| Size / Transferred bytes | Performance engineering, not content strategy |
| rel="next/prev", amphtml | Pagination/AMP — SEO not content |
| Unique JS Inlinks/Outlinks | Edge case |
| Cookies, HTTP Version | Infrastructure |
| Mobile Alternate Link | SEO |
| URL Encoded Address | Redundant |
| Grammar Errors | SF uses noisy third-party API |
| % of Total | SF UI metric only |
