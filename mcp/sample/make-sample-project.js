#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
// Build a realistic sample .transmission project — a fictional university
// audit, ~300 rows — for trying the MCP server and its skills without client
// data, and for exercising the skills against known-planted problems.
//
//   node mcp/sample/make-sample-project.js [out.transmission]
//
// Deterministic (seeded PRNG), so the numbers quoted in mcp/skills/*/SKILL.md
// examples stay true. The schema is lifted from project-store.js at runtime,
// exactly as test/mcp-server.test.js does, so this can't drift from the app.
//
// Planted, for the skills to find (see PLANTED at the bottom):
//   - /news/2017 and /news/2018 are almost all Archive; three posts are Migrate
//   - one Migrate page returns 404
//   - two Consolidate pages have no target
//   - a Archive page in the Primary-audience /admissions section
//   - SME overturned a cluster of Archive calls in /research
//   - an undecided tail in /academics and /about
// ════════════════════════════════════════════════════════════════════════════
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { sqlite } = require('../lib/project');

const out = path.resolve(process.argv[2] || path.join(__dirname, 'alpha-university.transmission'));

// ── seeded PRNG (mulberry32) ──
let seed = 20261007;
const rand = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const pick = a => a[Math.floor(rand() * a.length)];
const chance = p => rand() < p;

function liftSchemaSql() {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'project-store.js'), 'utf8');
  const start = src.indexOf('_createSchema() {');
  const open = src.indexOf('this.db.exec(`', start);
  const close = src.indexOf('`);', open);
  if (start < 0 || open < 0 || close < 0) throw new Error('could not lift the schema from project-store.js');
  return src.slice(open + 'this.db.exec(`'.length, close);
}

const HEADERS = [
  'Address', 'Status Code', 'Title 1', 'Meta Description 1', 'H1-1', 'Word Count', 'Crawl Depth', 'Inlinks',
  'Canonical Link Element 1', 'Redirect URL', 'Last Modified', 'Crawl Timestamp', 'GA4 Sessions',
  'MRA_Recommendation', 'Tags', 'Notes', 'Group', 'Primary Tag', 'SME_Decision', 'SME_Notes', 'Content_Owner', 'Final_MRA',
  '_Flagged', 'Redirect_Destination', '_RedirectSource', 'Consolidate_Into', '_ConsolidateTargetId',
  'Published_Status', 'Page_Type', 'Content_Theme', 'Content_Nature', 'Migration_Track', 'Suggested_MRA', 'Suggested_MRA_Sources',
  'Audiences', 'Primary_Audience', 'Jobs_Served', 'Source_Site', 'Sitemap_ID', 'Sitemap_Destination', 'Computed Path', 'Sitemap_SortID', 'Page_Breadcrumb'
];
const blank = () => Object.fromEntries(HEADERS.map(h => [h, '']));

const HOST = 'https://www.alpha.edu';
const LEGACY = 'https://legacy.alpha.edu';
const NEW = 'https://www.alpha.edu';

const AUD = {
  prospective: 'Prospective Students', current: 'Current Students', faculty: 'Faculty & Staff',
  alumni: 'Alumni', parents: 'Parents & Families', media: 'Media', community: 'Community'
};
const NONE = '— None (no target audience)';

// ── sitemap (new site) ──
const NAV = [];
let navN = 0;
function node(number, label, parentNumber, extra = {}) {
  const id = 'n' + String(++navN).padStart(3, '0');
  const path = label.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const parent = NAV.find(n => n.number === parentNumber);
  const computedPath = parent && parent.computedPath ? parent.computedPath + '/' + path : (parent ? path : '');
  const breadcrumb = parent ? parent.breadcrumb + ' > ' + label : label;
  const n = { number, label, path, sortID: number, parentNumber, breadcrumb, computedPath, id, refNodeId: '', inMenu: 'Y', url: '', urlOverride: '', breadcrumbParentId: '', collapse: '', notes: '', phase: '', nodeType: '', navLayer: '', buildPattern: '', buildGuidance: '', writerBrief: '', pageStatus: '', buildAssignee: '', writeAssignee: '', migrateAssignee: '', audiences: '', ...extra };
  NAV.push(n);
  return n;
}
const home = node('1', 'Home', '');
home.computedPath = ''; home.path = '';
const admissions = node('1.1', 'Admissions', '1', { audiences: AUD.prospective + ', ' + AUD.parents, pageStatus: 'In Progress', buildAssignee: 'Priya', writeAssignee: 'Marcus' });
node('1.1.1', 'Undergraduate', '1.1', { pageStatus: 'Built' });
node('1.1.2', 'Graduate', '1.1', { pageStatus: 'In Progress' });
node('1.1.3', 'Tuition and Aid', '1.1', { pageStatus: 'Not Started', writeAssignee: 'Marcus' });
node('1.1.4', 'Visit', '1.1');
const academics = node('1.2', 'Academics', '1', { audiences: AUD.prospective + ', ' + AUD.current });
node('1.2.1', 'Programs', '1.2');
node('1.2.2', 'Departments', '1.2');
node('1.2.3', 'Academic Calendar', '1.2', { audiences: AUD.current });
const research = node('1.3', 'Research', '1', { audiences: AUD.faculty });
node('1.3.1', 'Centers and Institutes', '1.3');
node('1.3.2', 'Funding', '1.3');
const about = node('1.4', 'About', '1');
node('1.4.1', 'Leadership', '1.4');
node('1.4.2', 'History', '1.4');
node('1.4.3', 'Contact', '1.4');
const newsroom = node('1.5', 'News and Events', '1', { audiences: AUD.media + ', ' + AUD.alumni });
node('1.5.1', 'News', '1.5');
node('1.5.2', 'Events', '1.5');
const alumni = node('1.6', 'Alumni', '1', { audiences: AUD.alumni, phase: '' });
node('1.6.1', 'Giving', '1.6');
node('1.7', 'Student Life', '1', { audiences: AUD.current, pageStatus: 'Not Started' });
node('1.8', 'Careers at Alpha', '1', { phase: 'Future', audiences: AUD.faculty });
const byLabel = l => NAV.find(n => n.label === l);

// ── rows ──
const rows = [];
let crawlTs = 0;
function add(o) {
  const r = blank();
  Object.assign(r, o);
  if (!r['Status Code']) r['Status Code'] = '200';
  if (!r['Crawl Timestamp']) r['Crawl Timestamp'] = new Date(Date.UTC(2026, 8, 2, 9, 0, crawlTs++ * 7)).toISOString().replace('T', ' ').slice(0, 19);
  if (!r['Source_Site']) r['Source_Site'] = r.Address.startsWith(LEGACY) ? 'Legacy intranet' : 'Alpha University';
  if (!r['Word Count'] && r['Status Code'] === '200') r['Word Count'] = String(120 + Math.floor(rand() * 1400));
  if (!r['Inlinks']) r['Inlinks'] = String(Math.floor(rand() * 40));
  if (!r['GA4 Sessions'] && r['Status Code'] === '200') r['GA4 Sessions'] = String(Math.floor(rand() ** 2.5 * 6000));
  if (r['Status Code'] === '200' && !r['Canonical Link Element 1']) r['Canonical Link Element 1'] = r.Address;
  rows.push(r);
  return r;
}
function place(r, navNode) {
  r.Sitemap_ID = navNode.id;
  r.Sitemap_Destination = navNode.breadcrumb;
  r['Computed Path'] = navNode.computedPath;
  r.Sitemap_SortID = navNode.sortID;
  r.Page_Breadcrumb = navNode.breadcrumb;
}
function redirectTo(r, dest, source) {
  r.Redirect_Destination = dest;
  r._RedirectSource = source;
}
const aud = (...names) => names.join(', ');
const sources = (ga, rubric, audience) => JSON.stringify({ sources: [{ key: 'ga', rec: ga }, { key: 'rubric', rec: rubric }, { key: 'audience', rec: audience }].filter(s => s.rec), disagreement: new Set([ga, rubric, audience].filter(Boolean)).size > 1 });

// Home
{
  const r = add({ Address: HOST + '/', 'Title 1': 'Alpha University', 'H1-1': 'Welcome to Alpha', MRA_Recommendation: 'Revise', Final_MRA: 'Revise', SME_Decision: 'Approve', Group: 'Home', Page_Type: 'Landing page', Content_Nature: 'Page', Audiences: aud(AUD.prospective, AUD.current, AUD.alumni, AUD.parents), Primary_Audience: AUD.prospective, Content_Owner: 'Comms', Notes: 'Rebuild on the new hero template; keep the three audience doors.', Tags: 'landing, hero', 'GA4 Sessions': '48210', Suggested_MRA: 'Migrate', Suggested_MRA_Sources: sources('Migrate', 'Migrate', 'Migrate') });
  place(r, home);
}

// Admissions — mostly decided, Primary audience, one planted Archive
const admPages = [
  ['', 'Admissions', 'Landing page', 'Migrate', 'Admissions'],
  ['/apply', 'How to Apply', 'Process page', 'Migrate', 'Undergraduate'],
  ['/undergraduate', 'Undergraduate Admissions', 'Landing page', 'Migrate', 'Undergraduate'],
  ['/undergraduate/requirements', 'First-Year Requirements', 'Process page', 'Migrate', 'Undergraduate'],
  ['/undergraduate/transfer', 'Transfer Students', 'Process page', 'Revise', 'Undergraduate'],
  ['/undergraduate/international', 'International Applicants', 'Process page', 'Revise', 'Undergraduate'],
  ['/undergraduate/deadlines', 'Application Deadlines', 'Reference', 'Migrate', 'Undergraduate'],
  ['/graduate', 'Graduate Admissions', 'Landing page', 'Migrate', 'Graduate'],
  ['/graduate/programs', 'Graduate Programs', 'Listing', 'Revise', 'Graduate'],
  ['/graduate/how-to-apply', 'Graduate Application Process', 'Process page', 'Migrate', 'Graduate'],
  ['/tuition', 'Tuition and Fees', 'Reference', 'Revise', 'Tuition and Aid'],
  ['/tuition/2021-22', 'Tuition and Fees 2021–22', 'Reference', 'Archive', ''],
  ['/tuition/2022-23', 'Tuition and Fees 2022–23', 'Reference', 'Archive', ''],
  ['/tuition/2023-24', 'Tuition and Fees 2023–24', 'Reference', 'Archive', ''],
  ['/financial-aid', 'Financial Aid', 'Landing page', 'Migrate', 'Tuition and Aid'],
  ['/financial-aid/scholarships', 'Scholarships', 'Listing', 'Revise', 'Tuition and Aid'],
  ['/financial-aid/fafsa', 'Completing the FAFSA', 'Process page', 'Migrate', 'Tuition and Aid'],
  ['/visit', 'Visit Campus', 'Landing page', 'Migrate', 'Visit'],
  ['/visit/tours', 'Campus Tours', 'Process page', 'Migrate', 'Visit'],
  ['/visit/directions', 'Directions and Parking', 'Reference', 'Migrate', 'Visit'],
  ['/visit/virtual-tour', 'Virtual Tour', 'Interactive', 'Revise', 'Visit'],
  ['/counselors', 'Information for Counselors', 'Landing page', 'Archive', ''],   // PLANTED: Archive in a Primary-audience section
  ['/faq', 'Admissions FAQ', 'FAQ', 'Migrate', 'Admissions'],
  ['/contact', 'Contact Admissions', 'Contact', 'Migrate', 'Admissions'],
];
for (const [p, title, type, kke, nodeLabel] of admPages) {
  const r = add({ Address: HOST + '/admissions' + p, 'Title 1': title + ' | Alpha University', 'H1-1': title, MRA_Recommendation: kke, Final_MRA: kke, SME_Decision: 'Approve', Group: 'Admissions', Page_Type: type, Content_Nature: 'Page', Content_Owner: 'Admissions', Audiences: p.startsWith('/graduate') ? aud(AUD.prospective) : aud(AUD.prospective, AUD.parents), Primary_Audience: AUD.prospective, Jobs_Served: p.includes('tuition') || p.includes('financial') ? 'Work out what it costs' : (p === '' || p.includes('apply') || p.includes('requirements') ? 'Apply' : ''), Published_Status: 'Published', 'Last Modified': '2025-0' + (1 + Math.floor(rand() * 9)) + '-1' + Math.floor(rand() * 9), Notes: kke === 'Archive' ? 'Superseded by the current tuition page.' : '', Suggested_MRA: kke === 'Archive' ? 'Archive' : 'Migrate', Suggested_MRA_Sources: sources(kke === 'Archive' ? 'Archive' : 'Migrate', 'Migrate', 'Migrate') });
  if (p === '/counselors') { r.Notes = ''; r.Suggested_MRA = 'Migrate'; r.Suggested_MRA_Sources = sources('Migrate', 'Migrate', 'Migrate'); r['GA4 Sessions'] = '1840'; }
  if (nodeLabel) place(r, byLabel(nodeLabel));
  if (kke === 'Archive') redirectTo(r, NEW + '/admissions/tuition-and-aid', 'manual');
  if (p === '/tuition/2023-24') { r.Redirect_Destination = ''; r._RedirectSource = ''; }   // owed, blank
}

// Academics — half decided, an undecided tail (PLANTED)
const depts = ['Biology', 'Chemistry', 'Computer Science', 'Economics', 'English', 'History', 'Mathematics', 'Nursing', 'Physics', 'Psychology', 'Sociology', 'Art and Design'];
{
  const r = add({ Address: HOST + '/academics', 'Title 1': 'Academics | Alpha University', 'H1-1': 'Academics', MRA_Recommendation: 'Revise', Group: 'Academics', Page_Type: 'Landing page', Content_Nature: 'Page', Content_Owner: 'Provost', Audiences: aud(AUD.prospective, AUD.current), Primary_Audience: AUD.prospective });
  place(r, academics);
  const pr = add({ Address: HOST + '/academics/programs', 'Title 1': 'Programs of Study | Alpha University', 'H1-1': 'Programs of Study', MRA_Recommendation: 'Migrate', Group: 'Academics', Page_Type: 'Listing', Content_Nature: 'Generated', Content_Owner: 'Provost', Audiences: aud(AUD.prospective), Primary_Audience: AUD.prospective, Jobs_Served: 'Compare programs' });
  place(pr, byLabel('Programs'));
}
depts.forEach((d, i) => {
  const slug = d.toLowerCase().replace(/ and /g, '-').replace(/\s+/g, '-');
  const decided = i < 7;
  const r = add({ Address: HOST + '/academics/departments/' + slug, 'Title 1': 'Department of ' + d + ' | Alpha University', 'H1-1': 'Department of ' + d, MRA_Recommendation: decided ? 'Migrate' : '', Group: 'Academics', Page_Type: 'Landing page', Content_Nature: 'Page', Content_Owner: 'Provost', Audiences: decided ? aud(AUD.prospective, AUD.current, AUD.faculty) : '', Primary_Audience: decided ? AUD.prospective : '', Published_Status: 'Published', Suggested_MRA: 'Migrate', Suggested_MRA_Sources: sources('Migrate', 'Migrate', decided ? 'Migrate' : '') });
  if (decided) place(r, byLabel('Departments'));
  for (const sub of ['faculty', 'courses', 'research']) {
    const s = add({ Address: HOST + '/academics/departments/' + slug + '/' + sub, 'Title 1': d + ' ' + sub[0].toUpperCase() + sub.slice(1) + ' | Alpha University', 'H1-1': d + ' ' + sub, MRA_Recommendation: decided ? (sub === 'research' ? 'Consolidate' : 'Migrate') : '', Group: 'Academics', Page_Type: sub === 'faculty' ? 'Directory' : (sub === 'courses' ? 'Listing' : 'Article'), Content_Nature: sub === 'courses' ? 'Generated' : 'Page', Content_Owner: 'Provost', Audiences: decided ? aud(AUD.current, AUD.faculty) : '', Primary_Audience: decided ? AUD.current : '', Published_Status: 'Published', Suggested_MRA: 'Migrate', Suggested_MRA_Sources: sources('Migrate', sub === 'research' ? 'Revise' : 'Migrate', decided ? 'Migrate' : '') });
    if (decided && sub !== 'research') place(s, byLabel('Departments'));
    if (decided && sub === 'research') {
      if (i < 5) { s.Consolidate_Into = 'research/centers-and-institutes'; s._ConsolidateTargetId = HOST + '/research'; redirectTo(s, NEW + '/research/centers-and-institutes', 'auto'); }
      // PLANTED: i === 5, 6 → Consolidate with no target
    }
  }
});
for (const t of ['academic-calendar', 'academic-calendar/2024-25', 'academic-calendar/2025-26', 'catalog', 'catalog/2023', 'catalog/2024', 'registrar', 'registrar/forms', 'registrar/transcripts']) {
  const old = /2023|2024-25/.test(t);
  const r = add({ Address: HOST + '/academics/' + t, 'Title 1': t.split('/').pop().replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) + ' | Alpha University', MRA_Recommendation: old ? 'Archive' : (t.startsWith('registrar') ? '' : 'Migrate'), Group: 'Academics', Page_Type: t.includes('calendar') ? 'Reference' : (t.includes('catalog') ? 'Document' : 'Process page'), Content_Nature: 'Page', Content_Owner: 'Registrar', Audiences: old ? '' : aud(AUD.current), Primary_Audience: old ? '' : AUD.current, Published_Status: 'Published', Suggested_MRA: old ? 'Archive' : 'Migrate', Suggested_MRA_Sources: sources(old ? 'Archive' : 'Migrate', old ? 'Archive' : 'Migrate', '') });
  if (!old && r.MRA_Recommendation) place(r, byLabel('Academic Calendar'));
  if (old) redirectTo(r, NEW + '/academics/' + t.split('/')[0], 'auto');
}

// Research — decided Archive by auditor, SME overturned a cluster (PLANTED)
{
  const r = add({ Address: HOST + '/research', 'Title 1': 'Research | Alpha University', 'H1-1': 'Research at Alpha', MRA_Recommendation: 'Revise', Final_MRA: 'Revise', SME_Decision: 'Approve', Group: 'Research', Page_Type: 'Landing page', Content_Nature: 'Page', Content_Owner: 'Research Office', Audiences: aud(AUD.faculty, AUD.media), Primary_Audience: AUD.faculty });
  place(r, research);
}
const centers = ['Center for Climate Science', 'Institute for Data Ethics', 'Center for Urban Policy', 'Materials Lab', 'Center for Medieval Studies', 'Language Acquisition Lab', 'Center for Rural Health', 'Quantum Computing Initiative'];
centers.forEach((c, i) => {
  const slug = c.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const overturned = i < 4;
  const r = add({ Address: HOST + '/research/centers/' + slug, 'Title 1': c + ' | Alpha University', 'H1-1': c, MRA_Recommendation: 'Archive', Final_MRA: overturned ? 'Migrate' : 'Archive', SME_Decision: overturned ? 'Change: Migrate' : 'Approve', SME_Notes: overturned ? 'Active center with external funding — must stay.' : '', Group: 'Research', Page_Type: 'Landing page', Content_Nature: 'Page', Content_Owner: 'Research Office', Audiences: aud(AUD.faculty), Primary_Audience: AUD.faculty, Notes: 'No updates since 2019; traffic negligible.', 'Last Modified': '2019-0' + (3 + i % 6) + '-12', Published_Status: 'Published', Suggested_MRA: 'Archive', Suggested_MRA_Sources: sources('Archive', 'Archive', 'Migrate') });
  // The note says "traffic negligible"; make that true for the ones that stay Archive, and modest for the
  // ones the SME kept (so the override reads as funding, not traffic — which is what SME_Notes says).
  r['GA4 Sessions'] = String(overturned ? 300 + Math.floor(rand() * 900) : Math.floor(rand() * 15));
  if (overturned) place(r, byLabel('Centers and Institutes'));
  else redirectTo(r, NEW + '/research/centers-and-institutes', 'auto');
});
for (const t of ['funding', 'funding/internal-grants', 'funding/external', 'compliance', 'compliance/irb', 'compliance/export-controls', 'annual-report-2019', 'annual-report-2020', 'annual-report-2021']) {
  const old = t.startsWith('annual');
  const r = add({ Address: HOST + '/research/' + t, 'Title 1': t.split('/').pop().replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) + ' | Alpha University', MRA_Recommendation: old ? 'Archive' : 'Migrate', Final_MRA: old ? 'Archive' : 'Migrate', SME_Decision: 'Approve', Group: 'Research', Page_Type: old ? 'Document' : 'Process page', Content_Nature: 'Page', Content_Owner: 'Research Office', Audiences: aud(AUD.faculty), Primary_Audience: AUD.faculty, Published_Status: 'Published' });
  if (!old) place(r, byLabel(t.startsWith('funding') ? 'Funding' : 'Research'));
  if (old) r.Redirect_Destination = '404', r._RedirectSource = 'manual';
}

// About — small, partly undecided
for (const [t, title, type, kke] of [['', 'About Alpha', 'Landing page', 'Migrate'], ['/leadership', 'Leadership', 'Directory', 'Migrate'], ['/leadership/president', 'Office of the President', 'Landing page', 'Migrate'], ['/history', 'Our History', 'Article', 'Revise'], ['/mission', 'Mission and Values', 'Article', ''], ['/accreditation', 'Accreditation', 'Reference', ''], ['/contact', 'Contact Us', 'Contact', 'Migrate'], ['/maps', 'Campus Maps', 'Reference', ''], ['/strategic-plan-2018', 'Strategic Plan 2018–2023', 'Document', 'Archive'], ['/strategic-plan', 'Strategic Plan 2024–2029', 'Document', 'Migrate']]) {
  const r = add({ Address: HOST + '/about' + t, 'Title 1': title + ' | Alpha University', 'H1-1': title, MRA_Recommendation: kke, Group: 'About', Page_Type: type, Content_Nature: 'Page', Content_Owner: 'Comms', Audiences: kke ? aud(AUD.prospective, AUD.community) : '', Primary_Audience: kke ? AUD.community : '', Published_Status: 'Published' });
  if (kke && kke !== 'Archive') place(r, byLabel(t.startsWith('/leadership') ? 'Leadership' : t === '/history' ? 'History' : t === '/contact' ? 'Contact' : 'About'));
  if (kke === 'Archive') redirectTo(r, NEW + '/about/strategic-plan', 'manual');
}

// News — the bulk. 2016–2024 posts; old years Archive, three planted Migrates in 2017/2018, 2023+ Migrate, some undecided
const headlines = ['Alpha Announces New Dean of Engineering', 'Commencement Draws Record Crowd', 'Research Team Wins Federal Grant', 'Campus Opens Renovated Library Wing', 'Students Place First in National Competition', 'Alpha Ranked Among Top Regional Universities', 'New Scholarship Honors Longtime Professor', 'Fall Enrollment Reaches New High', 'Alumni Gift Funds Science Center', 'Faculty Member Named Fellow', 'Alpha Hosts Regional Climate Summit', 'Nursing Program Earns Reaccreditation'];
{
  const r = add({ Address: HOST + '/news', 'Title 1': 'News | Alpha University', 'H1-1': 'News', MRA_Recommendation: 'Migrate', Final_MRA: 'Migrate', SME_Decision: 'Approve', Group: 'News', Page_Type: 'Listing', Content_Nature: 'Generated', Content_Owner: 'Comms', Audiences: aud(AUD.media, AUD.alumni, AUD.community), Primary_Audience: AUD.media });
  place(r, byLabel('News'));
}
let plantedMigrate = 0;
for (let year = 2016; year <= 2024; year++) {
  const n = year < 2020 ? 14 : (year < 2023 ? 11 : 9);
  for (let i = 0; i < n; i++) {
    const h = headlines[(year * 7 + i) % headlines.length];
    const slug = h.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + year;
    let kke = year <= 2021 ? 'Archive' : (year >= 2023 ? 'Migrate' : (chance(0.6) ? 'Archive' : ''));
    let notes = kke === 'Archive' ? 'Archival news; no traffic.' : '';
    if ((year === 2017 && i === 3) || (year === 2017 && i === 9) || (year === 2018 && i === 6)) { kke = 'Migrate'; notes = ''; plantedMigrate++; }   // PLANTED
    const r = add({ Address: HOST + '/news/' + year + '/' + slug, 'Title 1': h + ' | Alpha University', 'H1-1': h, 'Meta Description 1': h + '. Read more about this story from Alpha University.', MRA_Recommendation: kke, Final_MRA: year <= 2019 && kke ? kke : '', SME_Decision: year <= 2019 && kke ? 'Approve' : '', Group: 'News', Page_Type: 'News article', Content_Theme: pick(['Campus life', 'Research', 'Achievements', 'Giving']), Content_Nature: 'Content Object', Content_Owner: 'Comms', Audiences: kke === 'Migrate' ? aud(AUD.media, AUD.alumni) : (kke === 'Archive' ? NONE : ''), Primary_Audience: kke === 'Migrate' ? AUD.media : '', 'Last Modified': year + '-' + String(1 + i % 12).padStart(2, '0') + '-1' + (i % 9), Published_Status: 'Published', 'GA4 Sessions': String(year >= 2023 ? 40 + Math.floor(rand() * 900) : Math.floor(rand() * 12)), Notes: notes, Tags: year <= 2019 ? 'archival' : '', Suggested_MRA: year <= 2021 ? 'Archive' : 'Migrate', Suggested_MRA_Sources: sources(year <= 2021 ? 'Archive' : 'Migrate', year <= 2021 ? 'Archive' : 'Migrate', kke === 'Archive' ? 'Archive' : (kke === 'Migrate' ? 'Migrate' : '')) });
    if (kke === 'Migrate') place(r, byLabel('News'));
    if (kke === 'Archive') redirectTo(r, NEW + '/news', 'auto');
  }
}
// PLANTED: a Migrate page that is a 404
{
  const r = add({ Address: HOST + '/news/2023/alpha-launches-new-brand', 'Status Code': '404', 'Title 1': '', MRA_Recommendation: 'Migrate', Group: 'News', Page_Type: 'News article', Content_Nature: 'Content Object', Content_Owner: 'Comms', 'Word Count': '0' });
  place(r, byLabel('News'));
}

// Events — undecided, mostly, plus past-event pages
for (let i = 0; i < 18; i++) {
  const past = i < 12;
  const r = add({ Address: HOST + '/events/' + (past ? '2024' : '2026') + '/event-' + (i + 1), 'Title 1': (past ? 'Past event ' : 'Upcoming: ') + ['Open House', 'Lecture Series', 'Homecoming', 'Career Fair', 'Gala', 'Symposium'][i % 6] + ' | Alpha University', MRA_Recommendation: past ? (i < 8 ? 'Archive' : '') : '', Group: 'Events', Page_Type: 'Event', Content_Nature: 'Content Object', Content_Owner: 'Comms', Audiences: past && i < 8 ? NONE : '', Published_Status: 'Published', Suggested_MRA: past ? 'Archive' : 'Migrate', Suggested_MRA_Sources: sources(past ? 'Archive' : 'Migrate', past ? 'Archive' : 'Migrate', '') });
  if (past) r['GA4 Sessions'] = String(Math.floor(rand() * 30));   // a past event page has no traffic
  if (past && i < 8) redirectTo(r, NEW + '/news-and-events/events', 'auto');
}
{ const r = add({ Address: HOST + '/events', 'Title 1': 'Events | Alpha University', MRA_Recommendation: 'Migrate', Group: 'Events', Page_Type: 'Listing', Content_Nature: 'Generated', Content_Owner: 'Comms', Audiences: aud(AUD.current, AUD.community, AUD.alumni), Primary_Audience: AUD.community }); place(r, byLabel('Events')); }

// Alumni — decided, fine
for (const [t, title, type] of [['', 'Alumni', 'Landing page'], ['/events', 'Alumni Events', 'Listing'], ['/giving', 'Give to Alpha', 'Landing page'], ['/giving/ways-to-give', 'Ways to Give', 'Reference'], ['/giving/annual-fund', 'The Annual Fund', 'Article'], ['/benefits', 'Alumni Benefits', 'Reference'], ['/directory', 'Alumni Directory', 'Interactive'], ['/magazine', 'Alpha Magazine', 'Listing']]) {
  const r = add({ Address: HOST + '/alumni' + t, 'Title 1': title + ' | Alpha University', 'H1-1': title, MRA_Recommendation: 'Migrate', Final_MRA: 'Migrate', SME_Decision: 'Approve', Group: 'Alumni', Page_Type: type, Content_Nature: type === 'Interactive' ? 'Generated' : 'Page', Content_Owner: 'Advancement', Audiences: aud(AUD.alumni), Primary_Audience: AUD.alumni, Jobs_Served: t.includes('giving') ? 'Make a gift' : '', Published_Status: 'Published' });
  place(r, byLabel(t.includes('giving') ? 'Giving' : 'Alumni'));
}

// Student life — undecided, no audiences yet (a classification gap)
for (const t of ['housing', 'dining', 'clubs', 'health', 'counseling', 'recreation', 'campus-safety', 'parking']) {
  add({ Address: HOST + '/student-life/' + t, 'Title 1': t.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) + ' | Alpha University', Group: 'Student Life', Page_Type: 'Landing page', Content_Nature: 'Page', Content_Owner: 'Student Affairs', Published_Status: 'Published', Suggested_MRA: 'Migrate', Suggested_MRA_Sources: sources('Migrate', 'Migrate', '') });
}

// Non-content rows: inherited 301s and 404s, triaged Archive
for (let i = 0; i < 22; i++) {
  const r = add({ Address: HOST + '/old/page-' + (i + 1), 'Status Code': '301', 'Redirect URL': HOST + ['/admissions', '/academics', '/about', '/news', '/research'][i % 5], MRA_Recommendation: 'Archive', Group: '', Content_Owner: '', 'Word Count': '' });
  redirectTo(r, HOST + ['/admissions', '/academics', '/about', '/news', '/research'][i % 5], 'inherited');
}
for (let i = 0; i < 9; i++) {
  add({ Address: HOST + '/broken/link-' + (i + 1), 'Status Code': '404', MRA_Recommendation: 'Archive', Redirect_Destination: '404', _RedirectSource: 'manual', 'Word Count': '' });
}
// query-string variants, Excluded by triage
for (let i = 0; i < 12; i++) {
  add({ Address: HOST + '/academics/programs?page=' + (i + 1), 'Title 1': 'Programs of Study | Alpha University', MRA_Recommendation: 'Exclude', 'Canonical Link Element 1': HOST + '/academics/programs', Group: 'Academics', Page_Type: 'Listing', Content_Nature: 'Generated', Notes: 'Query-string variant of the canonical.' });
}
// Legacy intranet — out of scope
for (let i = 0; i < 15; i++) {
  add({ Address: LEGACY + '/intranet/doc-' + (i + 1), 'Title 1': 'Internal document ' + (i + 1), MRA_Recommendation: 'Exclude', Group: 'Legacy', Page_Type: 'Document', Content_Owner: 'IT' });
}

// ── settings ──
const settings = {
  clientName: 'Alpha University',
  projectName: 'Web replatform content audit',
  siteDomain: 'www.alpha.edu',
  defaultRedirectUrl: NEW + '/',
  siteLibrary: [
    { label: 'Alpha University', hosts: ['alpha.edu'], cms: 'Drupal 7', owner: 'University Communications', inScope: true, color: '#2563eb', notes: '' },
    { label: 'Legacy intranet', hosts: ['legacy.alpha.edu'], cms: 'SharePoint', owner: 'IT', inScope: false, color: '#ea580c', notes: 'Being retired separately; not part of this engagement.' }
  ],
  audienceLibrary: [
    { name: AUD.prospective, tier: 'Primary', color: '#2563eb', description: 'Undergraduate and graduate applicants and their influencers.', notes: '' },
    { name: AUD.current, tier: 'Primary', color: '#0d9488', description: 'Enrolled students.', notes: '' },
    { name: AUD.parents, tier: 'Secondary', color: '#7c3aed', description: '', notes: '' },
    { name: AUD.faculty, tier: 'Secondary', color: '#ca8a04', description: '', notes: '' },
    { name: AUD.alumni, tier: 'Secondary', color: '#db2777', description: '', notes: '' },
    { name: AUD.media, tier: 'Tertiary', color: '#65a30d', description: '', notes: '' },
    { name: AUD.community, tier: 'Tertiary', color: '#0891b2', description: 'Neighbours, local employers, the general public.', notes: '' },
    { name: NONE, tier: 'Not a target', color: '#94a3b8', description: 'Reviewed; serves no target audience.', notes: '' }
  ],
  jobLibrary: [
    { label: 'Apply', statement: 'Understand how to apply and what it takes to get in.', audiences: [AUD.prospective], notes: '' },
    { label: 'Compare programs', statement: 'Work out which program fits me.', audiences: [AUD.prospective], notes: '' },
    { label: 'Work out what it costs', statement: 'See the real cost and what aid I could get.', audiences: [AUD.prospective, AUD.parents], notes: '' },
    { label: 'Make a gift', statement: 'Give, and see what my gift does.', audiences: [AUD.alumni], notes: '' },
    { label: 'Find who to contact', statement: 'Reach the right office or person quickly.', audiences: [], notes: '' },
    { label: 'Register for classes', statement: 'Plan my schedule and register on time.', audiences: [AUD.current], notes: '' },
    { label: 'Find a research partner', statement: 'Identify faculty and centers working in my area.', audiences: [AUD.faculty, AUD.community], notes: '' }
  ],
  pageStatusLibrary: [{ name: 'Not Started', color: '#94a3b8' }, { name: 'In Progress', color: '#f59e0b' }, { name: 'Built', color: '#3b82f6' }, { name: 'In Review', color: '#8b5cf6' }, { name: 'Published', color: '#22c55e' }, { name: 'Blocked', color: '#ef4444' }],
  assigneeLibrary: ['Marcus', 'Priya'],
  contentTypeRegistry: [
    { contentType: 'News article', defaultContentNature: 'Content Object', targetContentType: 'Article', targetSpec: 'Article', defaultMigrationTrack: 'Migrate Records', notes: '' },
    { contentType: 'Event', defaultContentNature: 'Content Object', targetContentType: 'Event', targetSpec: 'Event', defaultMigrationTrack: 'Migrate Records', notes: '' },
    { contentType: 'Landing page', defaultContentNature: 'Page', targetContentType: 'Landing Page', targetSpec: 'Landing Page', defaultMigrationTrack: 'Manual Rebuild', notes: '' },
    { contentType: 'Process page', defaultContentNature: 'Page', targetContentType: 'Standard Page', targetSpec: 'Standard Page', defaultMigrationTrack: 'Scripted', notes: '' }
  ],
  savedFilters: [
    { name: 'Undecided content', filterText: '', kkeFilter: ['_unreviewed'], groupFilter: '', fieldFilters: [{ field: 'Status Code', operator: 'equals', value: '200' }] },
    { name: 'News to review', filterText: '', kkeFilter: ['_unreviewed', 'Migrate'], groupFilter: 'News', fieldFilters: [] },
    { name: 'Needs a home', filterText: '', kkeFilter: ['_needs-placement'], groupFilter: '', fieldFilters: [] },
    { name: 'Possible duplicates', filterText: '', kkeFilter: ['_duplicates'], groupFilter: '', fieldFilters: [] }
  ],
  glossary: { tags: { archival: 'Older than three years with no traffic; kept in the archive export, not the new site.', landing: 'Top-of-section page that routes to everything beneath it.' }, groups: { News: 'Everything under /news, by year.' } },
  columnMap: {},
  breadcrumbHomeLabel: 'Home'
};

// ── changelog: two auditors over three weeks, plus the SME import ──
const log = [];
const t0 = Date.UTC(2026, 8, 8, 14, 0, 0);
let tick = 0;
function logc(auditor, row, field, from, to, dayOffset) {
  log.push([new Date(t0 + dayOffset * 86400000 + (tick++) * 61000).toISOString(), auditor, rows.indexOf(row) + 1, row.Address, field, from, to]);
}
rows.forEach((r, i) => {
  if (r.MRA_Recommendation && r['Status Code'] === '200') logc(i % 3 === 0 ? 'priya' : 'david', r, 'MRA_Recommendation', '', r.MRA_Recommendation, Math.floor(i / 25));
  if (r.Final_MRA && r.Final_MRA !== r.MRA_Recommendation) logc('sme-import', r, 'Final_MRA', '', r.Final_MRA, 16);
  else if (r.Final_MRA) logc('sme-import', r, 'Final_MRA', '', r.Final_MRA, 16);
});
// a few late changes, last week
[rows[30], rows[31], rows[32]].forEach(r => { if (r) logc('david', r, 'MRA_Recommendation', 'Migrate', 'Revise', 19); });

// ── write ──
const { DatabaseSync } = sqlite();
for (const p of [out, out + '-wal', out + '-shm']) if (fs.existsSync(p)) fs.unlinkSync(p);
const db = new DatabaseSync(out);
db.exec('PRAGMA journal_mode = WAL;');
db.exec(liftSchemaSql());
db.exec('PRAGMA user_version = 1;');
const ins = (sql, list) => { const st = db.prepare(sql); for (const a of list) st.run(...a); };
db.exec('BEGIN');
ins('INSERT INTO headers (pos, name) VALUES (?, ?)', HEADERS.map((h, i) => [i, h]));
ins('INSERT INTO rows (idx, data) VALUES (?, ?)', rows.map((r, i) => [i, JSON.stringify(r)]));
ins('INSERT INTO nav_nodes (idx, data) VALUES (?, ?)', NAV.map((n, i) => [i, JSON.stringify(n)]));
ins('INSERT INTO settings (key, value) VALUES (?, ?)', Object.entries(settings).map(([k, v]) => [k, JSON.stringify(v)]));
ins('INSERT INTO meta (key, value) VALUES (?, ?)', [['sheetName', 'Internal HTML'], ['createdAt', '2026-09-08T14:00:00.000Z'], ['savedAt', '2026-09-29T16:42:11.000Z'], ['appVersion', '2.19.1']]);
ins('INSERT INTO changelog (timestamp, auditor, row, url, field, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?)', log);
db.exec('COMMIT');
db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
db.close();
for (const p of [out + '-wal', out + '-shm']) if (fs.existsSync(p)) fs.unlinkSync(p);

const PLANTED = [
  `${plantedMigrate} Migrate posts inside otherwise-Archive /news/2017 and /news/2018`,
  '1 Migrate page returning 404 (/news/2023/alpha-launches-new-brand)',
  '2 Consolidate pages with no target (two department /research pages)',
  '1 Archive in the Primary-audience /admissions section (/admissions/counselors)',
  '4 Archive calls overturned to Migrate by the SME in /research/centers',
  'undecided tails in /academics (5 departments), /about, /events, /student-life',
  '1 Archive page owed a redirect with none (/admissions/tuition/2023-24)'
];
console.log(`Wrote ${rows.length} rows, ${NAV.length} sitemap nodes, ${log.length} changelog entries → ${out}`);
console.log('Planted for the skills to find:\n  - ' + PLANTED.join('\n  - '));
