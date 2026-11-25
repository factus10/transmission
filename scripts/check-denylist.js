#!/usr/bin/env node
//
// Fails when text that is about to enter the repository names a real client
// engagement: an organization, a domain, or a project nickname.
//
//   node scripts/check-denylist.js --staged            # pre-commit: added lines + new paths
//   node scripts/check-denylist.js --message FILE      # commit-msg: the message being written
//   node scripts/check-denylist.js --tree              # CI: every tracked file and path
//   node scripts/check-denylist.js --range A..B        # CI: commit messages in a range
//   node scripts/check-denylist.js --add "term" [--case-sensitive]
//
// WHY THE LIST IS HASHED. This repository is public. A plaintext denylist of
// client names would publish exactly what it exists to keep out. So
// scripts/denylist.json holds salted SHA-256 hashes of normalized terms, and the
// checker hashes the words and word sequences (n-grams) of the text it scans
// and looks for a match. Error messages give the entry NUMBER, never the term.
//
// What this does and doesn't protect: it keeps names out of the tree, out of
// search indexes and away from a casual reader of the list. It does not stop
// someone who already suspects a name from hashing it to confirm. That is the
// trade for a check that runs in CI with no secret.
//
// Matching rules (the same normalization is applied to terms and to text):
//   - apostrophes are dropped ("Children's" == "Childrens"), then text is split
//     into words of letters and digits; a term matches a run of whole words,
//     so "delta" doesn't fire on "deltaic".
//   - a term containing a dot is a DOMAIN and matches a domain in the text or
//     any parent of it ("example.edu" matches "www.dept.example.edu").
//   - entries are case-insensitive unless added with --case-sensitive, which is
//     for short acronyms that are also ordinary words in lower case.

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const LIST_FILE = process.env.DENYLIST_FILE || path.join(__dirname, 'denylist.json');
const LIST_REL = path.relative(ROOT, LIST_FILE).split(path.sep).join('/');

// Never scanned: generated lockfiles and vendored code are not anyone's prose.
const SKIP = [/^node_modules\//, /(^|\/)package-lock\.json$/, /^dist\//];

const WORD = /[A-Za-z0-9]+/g;
const DOMAIN = /[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;

function stripApostrophes(s) { return s.replace(/['’]/g, ''); }

function hashTerm(salt, norm, cs) {
  return crypto.createHash('sha256').update(salt + ':' + (cs ? 'cs' : 'ci') + ':' + norm).digest('hex');
}

// A term's canonical form: a domain stays dotted, anything else becomes its
// words joined by single spaces.
function normalizeTerm(term, cs) {
  let t = stripApostrophes(String(term).trim());
  if (!cs) t = t.toLowerCase();
  if (/^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(t)) return t;
  return (t.match(WORD) || []).join(' ');
}

function loadList(file = LIST_FILE) {
  const list = JSON.parse(fs.readFileSync(file, 'utf8'));
  const byHash = new Map();
  list.entries.forEach((e, i) => byHash.set(e.h, { index: i + 1, cs: !!e.cs }));
  return { list, byHash, maxWords: list.maxWords || 4 };
}

// Every candidate string in a line: word n-grams up to maxWords, plus every
// domain and each of its parent domains. Both cases are produced, since an
// entry is either case-sensitive or not.
function candidates(line, maxWords) {
  const out = [];
  const text = stripApostrophes(line);
  const words = text.match(WORD) || [];
  for (let i = 0; i < words.length; i++) {
    for (let n = 1; n <= maxWords && i + n <= words.length; n++) {
      out.push(words.slice(i, i + n).join(' '));
    }
  }
  for (const d of text.match(DOMAIN) || []) {
    const parts = d.split('.');
    for (let i = 0; i < parts.length - 1; i++) out.push(parts.slice(i).join('.'));
  }
  return out;
}

function makeMatcher({ list, byHash, maxWords }) {
  const cache = new Map();
  return function match(line) {
    const hits = new Set();
    for (const c of candidates(line, maxWords)) {
      for (const [form, cs] of [[c, true], [c.toLowerCase(), false]]) {
        const key = (cs ? 'cs:' : 'ci:') + form;
        let h = cache.get(key);
        if (h === undefined) { h = hashTerm(list.salt, form, cs); cache.set(key, h); }
        const e = byHash.get(h);
        if (e && e.cs === cs) hits.add(e.index);
      }
    }
    return [...hits].sort((a, b) => a - b);
  };
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

function skipped(file) { return file === LIST_REL || SKIP.some(re => re.test(file)); }

function isBinary(buf) { return buf.subarray(0, 8000).includes(0); }

// ── scan modes ───────────────────────────────────────────────────────────────

function scanStaged(match) {
  const findings = [];
  // New and renamed paths: a file name can carry a domain too.
  for (const f of git(['diff', '--cached', '--name-only', '--diff-filter=ACR', '-z']).split('\0').filter(Boolean)) {
    if (skipped(f)) continue;
    for (const n of match(f)) findings.push({ where: f + ' (file name)', entry: n });
  }
  const diff = git(['diff', '--cached', '-U0', '--no-color', '--no-ext-diff', '--text']);
  let file = null, line = 0;
  for (const l of diff.split('\n')) {
    if (l.startsWith('+++ ')) { file = l.startsWith('+++ b/') ? l.slice(6) : null; continue; }
    const h = /^@@ -\S+ \+(\d+)/.exec(l);
    if (h) { line = Number(h[1]); continue; }
    if (!file || skipped(file)) continue;
    if (l.startsWith('+')) {
      for (const n of match(l.slice(1))) findings.push({ where: `${file}:${line}`, entry: n });
      line++;
    }
  }
  return findings;
}

function scanTree(match) {
  const findings = [];
  for (const f of git(['ls-files', '-z']).split('\0').filter(Boolean)) {
    if (skipped(f)) continue;
    for (const n of match(f)) findings.push({ where: f + ' (file name)', entry: n });
    let buf;
    try { buf = fs.readFileSync(path.join(ROOT, f)); } catch { continue; }
    if (isBinary(buf)) continue;
    buf.toString('utf8').split('\n').forEach((l, i) => {
      for (const n of match(l)) findings.push({ where: `${f}:${i + 1}`, entry: n });
    });
  }
  return findings;
}

function scanText(match, text, label) {
  const findings = [];
  text.split('\n').forEach((l, i) => {
    if (l.startsWith('#')) return; // git's own comment lines in a commit message
    for (const n of match(l)) findings.push({ where: `${label}:${i + 1}`, entry: n });
  });
  return findings;
}

function scanRange(match, range) {
  const findings = [];
  const out = git(['log', '--format=%H%x00%B%x01', range]);
  for (const rec of out.split('\x01')) {
    const [sha, body] = rec.replace(/^\n/, '').split('\0');
    if (!sha || body === undefined) continue;
    findings.push(...scanText(match, body, 'commit ' + sha.slice(0, 10) + ' message'));
  }
  return findings;
}

function addTerm(term, cs) {
  const list = JSON.parse(fs.readFileSync(LIST_FILE, 'utf8'));
  const norm = normalizeTerm(term, cs);
  if (!norm) throw new Error('nothing left of that term after normalization');
  const h = hashTerm(list.salt, norm, cs);
  if (list.entries.some(e => e.h === h)) { console.log('Already listed.'); return; }
  list.entries.push(cs ? { h, cs: true } : { h });
  const words = norm.includes('.') ? 1 : norm.split(' ').length;
  list.maxWords = Math.max(list.maxWords || 1, words);
  fs.writeFileSync(LIST_FILE, JSON.stringify(list, null, 2) + '\n');
  console.log(`Added as entry #${list.entries.length}.`);
}

function report(findings, context) {
  if (!findings.length) return 0;
  const byWhere = new Map();
  for (const f of findings) {
    if (!byWhere.has(f.where)) byWhere.set(f.where, []);
    byWhere.get(f.where).push('#' + f.entry);
  }
  const lines = [...byWhere].map(([where, entries]) => `  ${where}  — denylist ${entries.length > 1 ? 'entries' : 'entry'} ${entries.join(', ')}`);
  console.error(`\n✗ ${lines.length} line(s) match the client denylist (${LIST_REL}):\n`);
  for (const l of lines.slice(0, 200)) console.error(l);
  if (lines.length > 200) console.error(`  …and ${lines.length - 200} more`);
  console.error(`\nReal client names, domains, page titles and audit figures don't belong in this
repository (see "Client confidentiality" in CLAUDE.md). Use the fictional sample
instead: Alpha University / Beta College / alpha.edu.${context ? '\n' + context : ''}\n`);
  return 1;
}

function main(argv) {
  const arg = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  if (argv.includes('--add')) { addTerm(arg('--add'), argv.includes('--case-sensitive')); return 0; }
  const match = makeMatcher(loadList());
  if (argv.includes('--staged')) return report(scanStaged(match), 'Fix the lines above, or unstage them.');
  if (argv.includes('--message')) {
    const file = arg('--message');
    return report(scanText(match, fs.readFileSync(file, 'utf8'), 'commit message'), 'Reword the commit message.');
  }
  if (argv.includes('--range')) return report(scanRange(match, arg('--range')));
  if (argv.includes('--tree')) return report(scanTree(match));
  console.error('usage: check-denylist.js --staged | --message FILE | --tree | --range A..B | --add TERM [--case-sensitive]');
  return 2;
}

module.exports = { normalizeTerm, hashTerm, candidates, makeMatcher, loadList };

if (require.main === module) process.exitCode = main(process.argv.slice(2));
