// The skills served as MCP prompts (mcp/lib/prompts.js) — the chat route's
// stand-in for skills.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { handle } = require('../mcp/server');
const { PROMPTS, SKILLS_DIR } = require('../mcp/lib/prompts');

test('every skill is a prompt, and every prompt is a skill', () => {
  const skills = fs.readdirSync(SKILLS_DIR).filter(d => fs.existsSync(path.join(SKILLS_DIR, d, 'SKILL.md'))).sort();
  assert.deepStrictEqual(PROMPTS.map(p => p.name).sort(), skills);
});

test('initialize advertises prompts; prompts/list names each with its argument', () => {
  assert.ok(handle('initialize', {}).capabilities.prompts);
  const { prompts } = handle('prompts/list', {});
  const review = prompts.find(p => p.name === 'section-review');
  assert.deepStrictEqual(review.arguments.map(a => [a.name, a.required]), [['section', true]]);
  assert.ok(prompts.every(p => p.title && p.description));
});

test('prompts/get returns the skill text without frontmatter, the request, and the ground rules', () => {
  const r = handle('prompts/get', { name: 'section-review', arguments: { section: '/news' } });
  assert.strictEqual(r.messages.length, 1);
  const text = r.messages[0].content.text;
  assert.match(text, /^Review this section of the audit: \/news/);
  assert.match(text, /# Section review/);
  assert.doesNotMatch(text, /^---\nname:/m);
  assert.match(text, /# Ask the audit/);            // ground rules appended
  const ask = handle('prompts/get', { name: 'ask-the-audit', arguments: {} }).messages[0].content.text;
  assert.strictEqual(ask.split('# Ask the audit').length, 2);   // not appended to itself
});

test('optional arguments shape the request; a missing required one is an invalid-params error', () => {
  assert.match(handle('prompts/get', { name: 'audit-status', arguments: { since: '2026-10-01' } }).messages[0].content.text, /since 2026-10-01/);
  assert.match(handle('prompts/get', { name: 'audit-status' }).messages[0].content.text, /^Write the audit status note\./);
  assert.throws(() => handle('prompts/get', { name: 'section-review', arguments: {} }), e => e.rpcCode === -32602);
  assert.throws(() => handle('prompts/get', { name: 'nope' }), e => e.rpcCode === -32602);
});
