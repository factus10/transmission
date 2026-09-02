// ════════════════════════════════════════════════════════════════════════════
// Sidebar field filters — operator semantics
//
// Run with `npm test`.
//
// Uses the same source-lifting sandbox as the other suites here (see the header
// of test/sankey.test.js for why renderer.js cannot simply be require()d, and
// what that couples these tests to).
// ════════════════════════════════════════════════════════════════════════════
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer.js'), 'utf8');

function extract(name) {
  const decl = '\nfunction ' + name + '(';
  const start = source.indexOf(decl);
  if (start < 0) {
    throw new Error(`renderer.js has no top-level "function ${name}(" — renamed, or no longer declared at column 0?`);
  }
  const end = source.indexOf('\n}\n', start);
  if (end < 0) throw new Error(`could not find the closing brace of ${name}()`);
  return source.slice(start + 1, end + 3);
}

// The operator table is a const array, not a function — lift it by its own text.
function extractOperatorTable() {
  const start = source.indexOf('const FIELD_FILTER_OPERATORS = [');
  if (start < 0) throw new Error('FIELD_FILTER_OPERATORS is no longer declared at column 0');
  const end = source.indexOf('\n];\n', start);
  if (end < 0) throw new Error('could not find the end of FIELD_FILTER_OPERATORS');
  return source.slice(start, end + 4);
}

vm.runInThisContext(
  extractOperatorTable() +
  extract('fieldFilterNumber') +
  extract('fieldFilterCompare') +
  extract('fieldFilterMatches')
);

const ff = (field, operator, value) => ({ field, operator, value });
const match = (cell, operator, value) => fieldFilterMatches({ Col: cell }, ff('Col', operator, value));

describe('operator table', () => {
  test('greater-than and less-than are registered and take a value', () => {
    for (const op of ['greater-than', 'less-than']) {
      const entry = FIELD_FILTER_OPERATORS.find(o => o.value === op);
      assert.ok(entry, `${op} missing from FIELD_FILTER_OPERATORS`);
      assert.equal(entry.needsValue, true);
    }
  });
});

describe('fieldFilterNumber', () => {
  test('accepts plain and comma-grouped numbers', () => {
    assert.equal(fieldFilterNumber('42'), 42);
    assert.equal(fieldFilterNumber(' 42 '), 42);
    assert.equal(fieldFilterNumber('-3.5'), -3.5);
    assert.equal(fieldFilterNumber('.5'), 0.5);
    assert.equal(fieldFilterNumber('1,234'), 1234);
  });
  test('rejects blanks and non-numeric text', () => {
    for (const s of ['', '   ', 'abc', '42px', '1.2.3', '50%', 'NaN']) {
      assert.equal(fieldFilterNumber(s), null, `${JSON.stringify(s)} should not parse`);
    }
  });
});

describe('numeric comparison', () => {
  test('orders numerically, not lexically', () => {
    // The bug a string compare would produce: '9' > '100'.
    assert.equal(match('100', 'greater-than', '9'), true);
    assert.equal(match('100', 'less-than', '9'), false);
    assert.equal(match('9', 'less-than', '100'), true);
  });
  test('comma-grouped cells compare as numbers', () => {
    assert.equal(match('1,234', 'greater-than', '999'), true);
  });
  test('equal values match neither direction', () => {
    assert.equal(match('50', 'greater-than', '50'), false);
    assert.equal(match('50', 'less-than', '50'), false);
  });
  test('negatives and decimals', () => {
    assert.equal(match('-5', 'less-than', '0'), true);
    assert.equal(match('2.5', 'greater-than', '2.25'), true);
  });
});

describe('string comparison fallback', () => {
  test('falls back to code-unit order when either side is non-numeric', () => {
    assert.equal(match('banana', 'greater-than', 'apple'), true);
    assert.equal(match('apple', 'less-than', 'banana'), true);
  });
  test('is case-sensitive ASCII order — uppercase sorts before lowercase', () => {
    assert.equal(match('Z', 'less-than', 'a'), true);
    assert.equal(match('a', 'greater-than', 'Z'), true);
  });
  test('a numeric cell against a non-numeric value compares as text', () => {
    // '9' vs 'abc': digits sort before letters in code-unit order.
    assert.equal(match('9', 'less-than', 'abc'), true);
  });
});

describe('blank cells', () => {
  test('match NEITHER direction — blank is unreviewed, not "smaller than everything"', () => {
    for (const cell of ['', '   ']) {
      assert.equal(match(cell, 'greater-than', '0'), false);
      assert.equal(match(cell, 'less-than', '0'), false);
      assert.equal(match(cell, 'less-than', 'zzz'), false);
    }
  });
  test('a missing column is blank, not a crash', () => {
    assert.equal(fieldFilterMatches({}, ff('Nope', 'greater-than', '1')), false);
    assert.equal(fieldFilterMatches({}, ff('Nope', 'less-than', '1')), false);
  });
});

describe('existing operators still behave', () => {
  test('unchanged operators are case-insensitive as before', () => {
    assert.equal(match('Hello World', 'contains', 'hello'), true);
    assert.equal(match('Hello', 'equals', 'HELLO'), true);
    assert.equal(match('Hello', 'starts-with', 'he'), true);
    assert.equal(match('Hello', 'ends-with', 'LO'), true);
    assert.equal(match('', 'is-blank', ''), true);
    assert.equal(match('x', 'is-not-blank', ''), true);
  });
});
