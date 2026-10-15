// scripts/package-skills.js: one uploadable zip per skill, upload-safe frontmatter.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const JSZip = require('jszip');
const pkg = require('../scripts/package-skills');

test('every skill packages, with only name/description in the frontmatter and the body verbatim', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-'));
  const files = await pkg.packageSkills(dir);
  const skills = fs.readdirSync(pkg.SKILLS).filter(d => fs.existsSync(path.join(pkg.SKILLS, d, 'SKILL.md')));
  assert.equal(files.length, skills.length);
  for (const f of files) {
    const zip = await JSZip.loadAsync(fs.readFileSync(f));
    const name = path.basename(f, '.zip');
    const entries = Object.keys(zip.files).filter(n => !zip.files[n].dir);
    assert.ok(entries.includes(`${name}/SKILL.md`), `${name}: SKILL.md inside a folder named for the skill`);
    const text = await zip.file(`${name}/SKILL.md`).async('string');
    const { fm, body } = pkg.splitSkill(text);
    assert.deepEqual(Object.keys(fm).sort(), ['description', 'name']);
    assert.deepEqual(pkg.validate(fm, name), []);
    const orig = pkg.splitSkill(fs.readFileSync(path.join(pkg.SKILLS, name, 'SKILL.md'), 'utf8'));
    assert.equal(body, orig.body);
    assert.equal(fm.description, orig.fm.description);
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

test('validation catches the upload rules', () => {
  assert.deepEqual(pkg.validate({ name: 'ok-name', description: 'fine' }, 'ok-name'), []);
  assert.equal(pkg.validate({ name: 'Bad_Name', description: 'x' }, 'Bad_Name').length, 1);
  assert.match(pkg.validate({ name: 'claude-helper', description: 'x' }, 'claude-helper')[0], /may not contain/);
  assert.match(pkg.validate({ name: 'a', description: 'x'.repeat(1025) }, 'a')[0], /1025/);
  assert.match(pkg.validate({ name: 'a', description: 'uses <tags>' }, 'a')[0], /< or >/);
});
