#!/usr/bin/env node
// Package mcp/skills/* as uploadable skill zips for Claude (Settings →
// Capabilities → Skills), one zip per skill: <name>/SKILL.md inside.
//
//   npm run skills:zip            → dist/skills/<name>.zip
//   node scripts/package-skills.js --out <dir> [--prefix transmission-skill-]
//
// --prefix only changes the zip's file name (the release script uses it so the
// assets read as Transmission's on a release page); the skill inside is still
// <name>/SKILL.md, and the skill's name comes from its frontmatter.
//
// The same SKILL.md files drive three surfaces: the Claude Code plugin (as
// skills), the desktop extension (as + menu prompts, mcp/lib/prompts.js), and
// these uploads. Only the frontmatter differs: `argument-hint` is a Claude Code
// key the upload validator doesn't know, so the zips carry `name` and
// `description` only. The body is copied verbatim.
//
// The skills call the `transmission` MCP tools, so they only work where the
// Transmission extension is connected — the Claude desktop app.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKILLS = path.join(ROOT, 'mcp', 'skills');
const UPLOAD_KEYS = ['name', 'description'];
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Parse the simple `key: value` frontmatter these files use. */
function splitSkill(text) {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!m) throw new Error('missing --- frontmatter ---');
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (kv) fm[kv[1]] = kv[2].trim().replace(/^"(.*)"$/, '$1');
  }
  return { fm, body: m[2] };
}

/** Check a skill against the upload rules; returns a list of problems. */
function validate(fm, dirName) {
  const errs = [];
  if (!fm.name) errs.push('no name');
  else {
    if (!NAME_RE.test(fm.name) || fm.name.length > 64) errs.push(`name "${fm.name}" must be lowercase letters, digits and hyphens, at most 64 characters`);
    if (/anthropic|claude/i.test(fm.name)) errs.push('name may not contain "anthropic" or "claude"');
    if (fm.name !== dirName) errs.push(`name "${fm.name}" differs from its folder "${dirName}"`);
  }
  if (!fm.description) errs.push('no description');
  else {
    if (fm.description.length > 1024) errs.push(`description is ${fm.description.length} characters (max 1024)`);
    if (/[<>]/.test(fm.description)) errs.push('description may not contain < or >');
  }
  return errs;
}

/** The SKILL.md as uploaded: upload keys only, body unchanged. */
function uploadSkillText(text) {
  const { fm, body } = splitSkill(text);
  const head = UPLOAD_KEYS.filter(k => fm[k]).map(k => `${k}: ${fm[k]}`).join('\n');
  return { fm, text: `---\n${head}\n---\n${body}` };
}

async function packageSkills(outDir, { prefix = '' } = {}) {
  const JSZip = require('jszip');
  fs.mkdirSync(outDir, { recursive: true });
  const written = [];
  for (const dir of fs.readdirSync(SKILLS).sort()) {
    const src = path.join(SKILLS, dir, 'SKILL.md');
    if (!fs.existsSync(src)) continue;
    const { fm, text } = uploadSkillText(fs.readFileSync(src, 'utf8'));
    const errs = validate(fm, dir);
    if (errs.length) throw new Error(`${dir}: ${errs.join('; ')}`);
    const zip = new JSZip();
    zip.file(`${fm.name}/SKILL.md`, text);
    // Any other files beside SKILL.md (references, scripts) travel too.
    for (const f of fs.readdirSync(path.join(SKILLS, dir))) {
      if (f === 'SKILL.md' || f.startsWith('.')) continue;
      const p = path.join(SKILLS, dir, f);
      if (fs.statSync(p).isFile()) zip.file(`${fm.name}/${f}`, fs.readFileSync(p));
    }
    const file = path.join(outDir, `${prefix}${fm.name}.zip`);
    fs.writeFileSync(file, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
    written.push(file);
  }
  return written;
}

module.exports = { packageSkills, splitSkill, validate, uploadSkillText, SKILLS };

if (require.main === module) {
  const i = process.argv.indexOf('--out');
  const out = i > 0 ? path.resolve(process.argv[i + 1]) : path.join(ROOT, 'dist', 'skills');
  const pi = process.argv.indexOf('--prefix');
  const prefix = pi > 0 ? String(process.argv[pi + 1] || '') : '';
  if (!/^[A-Za-z0-9._-]*$/.test(prefix)) { console.error('--prefix may use letters, digits, . _ - only'); process.exit(1); }
  packageSkills(out, { prefix })
    .then(files => { files.forEach(f => console.log(path.relative(process.cwd(), f))); })
    .catch(e => { console.error(e.message); process.exit(1); });
}
