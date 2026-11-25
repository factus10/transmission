// The client-name guard (scripts/check-denylist.js). These tests build their own
// throwaway list from fictional names, so they say nothing about what the real
// list contains, and they also check that the real list passes the current tree.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { normalizeTerm, hashTerm, makeMatcher } = require('../scripts/check-denylist.js');

const SALT = 'test-salt';
function matcherFor(terms) {
  const entries = terms.map(([t, cs]) => ({ h: hashTerm(SALT, normalizeTerm(t, cs), !!cs), cs: !!cs }));
  const byHash = new Map(entries.map((e, i) => [e.h, { index: i + 1, cs: e.cs }]));
  return makeMatcher({ list: { salt: SALT }, byHash, maxWords: 4 });
}

describe('check-denylist matching', () => {
  const match = matcherFor([
    ['Gamma State'],          // #1 a two-word name
    ['gamma.edu'],            // #2 a domain
    ['Delta'],                // #3 one word
    ["Omega Children's"],     // #4 an apostrophe
    ['GSU', true],            // #5 a case-sensitive acronym
  ]);

  test('whole words and phrases, any case', () => {
    assert.deepEqual(match('placeholder="e.g. GAMMA state Delta"'), [1, 3]);
    assert.deepEqual(match('a deltaic plain, a gamma ray, stateless'), []);
  });
  test('a domain matches itself and any subdomain, not a lookalike', () => {
    assert.deepEqual(match('https://www.dept.gamma.edu/about'), [2]);
    assert.deepEqual(match('https://gamma.education.org'), []);
  });
  test('underscored file names split into words', () => {
    assert.deepEqual(match('/www_delta_x_edu_shot.png'), [3]);
  });
  test('apostrophes are optional, straight or curly', () => {
    assert.deepEqual(match('Omega Children’s and Omega Childrens'), [4]);
  });
  test('case-sensitive entries ignore the lower-case word', () => {
    assert.deepEqual(match('the GSU audit'), [5]);
    assert.deepEqual(match('gsu'), []);
  });
});

describe('check-denylist CLI', () => {
  const script = path.join(__dirname, '..', 'scripts', 'check-denylist.js');
  test('the real list passes the current tree', () => {
    execFileSync(process.execPath, [script, '--tree'], { stdio: 'pipe' });
  });
  test('a hit exits 1 and reports the entry number, never the term', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'denylist-'));
    const list = path.join(dir, 'list.json');
    fs.writeFileSync(list, JSON.stringify({ salt: SALT, maxWords: 2, entries: [{ h: hashTerm(SALT, 'gamma state', false) }] }));
    const msg = path.join(dir, 'msg.txt');
    fs.writeFileSync(msg, 'Fix the Gamma State sitemap\n# a comment line mentioning gamma state is ignored\n');
    let err;
    try {
      execFileSync(process.execPath, [script, '--message', msg], { stdio: 'pipe', env: { ...process.env, DENYLIST_FILE: list } });
    } catch (e) { err = e; }
    assert.ok(err, 'expected a non-zero exit');
    assert.equal(err.status, 1);
    const out = String(err.stderr);
    assert.match(out, /commit message:1 {2}— denylist entry #1/);
    assert.doesNotMatch(out, /:2 /);
    assert.doesNotMatch(out, /gamma/i);
  });
});
