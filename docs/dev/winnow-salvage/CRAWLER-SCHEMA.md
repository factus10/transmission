# Crawler SQLite Schema

Reference schema for `SQLiteStore`. Use `better-sqlite3` in the main process.

> ⚠️ `better-sqlite3` requires a native rebuild after install:
> ```bash
> npm run rebuild
> ```
> Ensure `package.json` includes:
> ```json
> "scripts": {
>   "rebuild": "electron-rebuild -f -w better-sqlite3"
> }
> ```

---

## `pages` Table

```sql
CREATE TABLE IF NOT EXISTS pages (

  -- Identity
  url                       TEXT PRIMARY KEY,
  crawl_timestamp           TEXT,

  -- HTTP
  status_code               INTEGER,
  status                    TEXT,
  content_type              TEXT,
  response_ms               INTEGER,
  redirect_url              TEXT,
  redirect_type             TEXT,
  last_modified             TEXT,
  language                  TEXT,

  -- Indexability
  indexable                 INTEGER,          -- 1 = indexable, 0 = not
  indexability_status       TEXT,             -- "Indexable" | "noindex" | "blocked:robots" | "canonical:non-self"
  meta_robots               TEXT,
  canonical                 TEXT,

  -- Content: crawled
  title                     TEXT,
  title_length              INTEGER,
  meta_description          TEXT,
  meta_description_length   INTEGER,
  h1                        TEXT,
  h2_1                      TEXT,
  h2_2                      TEXT,

  -- Content: computed from extracted text
  word_count                INTEGER,
  sentence_count            INTEGER,
  avg_words_per_sentence    REAL,
  text_ratio                REAL,
  flesch_score              REAL,
  readability               TEXT,             -- "Very Easy" | "Easy" | "Standard" | "Fairly Difficult" | "Difficult" | "Very Difficult"

  -- IA signals
  crawl_depth               INTEGER,
  folder_depth              INTEGER,

  -- Link signals
  inlinks                   INTEGER,
  unique_inlinks            INTEGER,
  outlinks                  INTEGER,
  unique_outlinks           INTEGER,
  external_outlinks         INTEGER,

  -- GA4 (populated in separate pass)
  ga4_sessions              INTEGER,
  ga4_pageviews             INTEGER,
  ga4_bounce_rate           REAL,
  ga4_avg_engagement        REAL,

  -- AI assessment (populated in separate pass)
  ai_assessment             TEXT,             -- JSON: { contentType, audience, kkeRecommendation, rationale }
  screenshot_path           TEXT,             -- relative path from crawl DB directory

  -- KKE decisions (user input)
  kke_decision              TEXT,             -- "Keep" | "Kill" | "Evolve"
  mra_notes                 TEXT
);
```

---

## Supporting Tables

```sql
-- Tracks links between pages for inlink/outlink counting
CREATE TABLE IF NOT EXISTS links (
  source_url    TEXT,
  target_url    TEXT,
  is_external   INTEGER,    -- 1 = external domain, 0 = internal
  PRIMARY KEY (source_url, target_url)
);

-- Crawl session metadata
CREATE TABLE IF NOT EXISTS crawl_meta (
  key           TEXT PRIMARY KEY,
  value         TEXT
);
-- Keys: seed_url, started_at, completed_at, total_pages, status
```

---

## Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_status_code    ON pages (status_code);
CREATE INDEX IF NOT EXISTS idx_indexable      ON pages (indexable);
CREATE INDEX IF NOT EXISTS idx_kke_decision   ON pages (kke_decision);
CREATE INDEX IF NOT EXISTS idx_crawl_depth    ON pages (crawl_depth);
CREATE INDEX IF NOT EXISTS idx_word_count     ON pages (word_count);
```

---

## Computed Field Notes

### `status` (derived from `status_code`)
```js
function statusLabel(code) {
  if (code >= 200 && code < 300) return 'OK';
  if (code === 301) return 'Moved Permanently';
  if (code === 302) return 'Found';
  if (code === 404) return 'Not Found';
  if (code >= 500) return 'Server Error';
  return String(code);
}
```

### `indexability` and `indexability_status`
```js
function indexability(metaRobots, canonical, pageUrl, statusCode) {
  if (statusCode !== 200) return { indexable: 0, status: 'non-200' };
  if (metaRobots && /noindex/i.test(metaRobots)) return { indexable: 0, status: 'noindex' };
  if (canonical && canonical !== pageUrl) return { indexable: 0, status: 'canonical:non-self' };
  return { indexable: 1, status: 'Indexable' };
}
```

### `folder_depth` (derived from URL)
```js
function folderDepth(url) {
  const path = new URL(url).pathname;
  return path.split('/').filter(Boolean).length;
}
```

### `text_ratio`
```js
function textRatio(rawHtml, extractedText) {
  return extractedText.length / rawHtml.length;
}
```

### `flesch_score` and `readability`
Use the `flesch-kincaid` npm package:
```js
import { fleschReadingEase } from 'flesch-kincaid';

const score = fleschReadingEase({ sentence: sentenceCount, word: wordCount, syllable: syllableCount });

function readabilityLabel(score) {
  if (score >= 90) return 'Very Easy';
  if (score >= 70) return 'Easy';
  if (score >= 60) return 'Standard';
  if (score >= 50) return 'Fairly Difficult';
  if (score >= 30) return 'Difficult';
  return 'Very Difficult';
}
```
Additional dependency needed: `syllable` (counts syllables for Flesch formula).

### `ai_assessment` JSON shape
```json
{
  "contentType": "string",
  "audience": "string",
  "kkeRecommendation": "Keep | Kill | Evolve",
  "rationale": "one sentence"
}
```
