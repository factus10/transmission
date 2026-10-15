'use strict';
// The four skills, offered as MCP prompts.
//
// Skills are a Claude Code feature; the Claude app's chat gets this server as a
// desktop extension, which carries tools and prompts but no skills. A prompt is
// the closest chat equivalent: the app lists it in the chat's "+" menu, the user
// picks one, fills in its argument, and the playbook lands in the conversation.
//
// The text is read from mcp/skills/*/SKILL.md at request time, so the skill and
// the prompt are the same words and cannot drift. Each workflow skill leans on
// the ask-the-audit ground rules by name ("follow the ground rules in the
// ask-the-audit skill"), which a chat has no way to load, so those rules are
// appended to every prompt but ask-the-audit's own.

const fs = require('node:fs');
const path = require('node:path');

const SKILLS_DIR = path.join(__dirname, '..', 'skills');
const GROUND_RULES = 'ask-the-audit';

// Short menu text, and the one argument each takes. The SKILL.md descriptions are
// written to make Claude Code pick the skill up on its own ("Use whenever…"),
// which is the wrong register for a menu a person reads.
const PROMPTS = [
  {
    name: 'audit-status', title: 'Audit status',
    description: 'Where the audit stands: progress, what moved recently and by whom, what is still owed before handoff.',
    argument: { name: 'since', description: 'Cover changes since this date (YYYY-MM-DD). Default: the last 7 days.', required: false },
    request: v => v ? `Write the audit status note, covering what moved since ${v}.` : 'Write the audit status note.'
  },
  {
    name: 'section-review', title: 'Section review',
    description: 'Go through one section: its patterns, its exceptions, and proposed decisions for the undecided pages.',
    argument: { name: 'section', description: 'A URL prefix like /news, a Group name, a content type or a sitemap node.', required: true },
    request: v => `Review this section of the audit: ${v}`
  },
  {
    name: 'decision-consistency', title: 'Decision consistency check',
    description: 'Find decisions that contradict their neighbors or their own data, each with the evidence and a question.',
    argument: { name: 'scope', description: 'Limit the check to one section (optional). Default: the whole in-scope inventory.', required: false },
    request: v => v ? `Run the decision consistency check on: ${v}` : 'Run the decision consistency check on the whole in-scope inventory.'
  },
  {
    name: 'rubric-sweep', title: 'Rubric sweep',
    description: 'Apply the project\'s rubric patterns across the audit: find matching pages, read them and their targets, and propose what merges into what.',
    argument: { name: 'scope', description: 'A section like /admissions, or a pattern name (optional). Default: every pattern, the whole in-scope inventory.', required: false },
    request: v => v ? `Run the rubric sweep on: ${v}` : 'Run the rubric sweep across the whole in-scope inventory.'
  },
  {
    name: 'ask-the-audit', title: 'Ask the audit',
    description: 'Answer a question from the project with real counts, each traceable to a filter you can reproduce in Transmission.',
    argument: { name: 'question', description: 'What you want to know, e.g. "how many Keep pages under /news have no audience?"', required: false },
    request: v => v ? `Answer this from the audit: ${v}` : 'Use these rules for every question I ask about the audit in this conversation. Start by orienting yourself in the project, then ask me what I want to know.'
  }
];

/** A SKILL.md minus its frontmatter. */
function skillBody(name) {
  const text = fs.readFileSync(path.join(SKILLS_DIR, name, 'SKILL.md'), 'utf8');
  return text.replace(/^---\n[\s\S]*?\n---\n/, '').trim();
}

function listPrompts() {
  return PROMPTS.map(p => ({
    name: p.name,
    title: p.title,
    description: p.description,
    arguments: [{ name: p.argument.name, description: p.argument.description, required: p.argument.required }]
  }));
}

/** prompts/get. Throws a plain Error with `.invalidParams` set for a bad call. */
function getPrompt(name, args) {
  const p = PROMPTS.find(x => x.name === name);
  if (!p) throw Object.assign(new Error(`Unknown prompt: ${name}`), { invalidParams: true });
  const value = String((args && args[p.argument.name]) || '').trim();
  if (p.argument.required && !value) throw Object.assign(new Error(`The ${p.title} prompt needs "${p.argument.name}".`), { invalidParams: true });
  const parts = [p.request(value), skillBody(p.name)];
  if (p.name !== GROUND_RULES) parts.push(`---\n\nThe "ask-the-audit skill" referred to above is these ground rules:\n\n${skillBody(GROUND_RULES)}`);
  return {
    description: p.description,
    messages: [{ role: 'user', content: { type: 'text', text: parts.join('\n\n') } }]
  };
}

module.exports = { PROMPTS, listPrompts, getPrompt, SKILLS_DIR };
