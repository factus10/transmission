# Screenshot Checklist

Capture these views to showcase the app's features. Use the Stanford OHS crawl (or similar) for realistic data. Assign a mix of KKE statuses to several rows first so badges and the progress bar have color.

**Recommended window size:** 1440x900

---

### Core Workflow
1. **Empty state** — app launched, no file open ("No file open" + Open File button)
2. **Main audit view** — file loaded, row selected, page visible in browser, KKE buttons and metadata in field bar
3. **KKE assignment** — a row with Keep/Kill/Evolve status showing the colored badge in the sidebar

### Sidebar & Filtering
4. **Text search active** — filter text entered, row count showing filtered results
5. **KKE status filter** — dropdown open showing filter options (All, Keep, Kill, Evolve, etc.)
6. **Multi-select** — several rows selected with the bulk action bar visible at bottom of sidebar
7. **Flagged rows** — a few rows with star icons lit, filtered to "Flagged"

### Field Bar & Audit Controls
8. **Tags in action** — chip input with several tags assigned, tag dropdown open
9. **Notes popover** — notes popover open with some rationale text
10. **Meta fields** — field bar showing Screaming Frog metadata (Title, Status Code, etc.)

### Sitemap
11. **Sitemap editor (Tree view)** — full-panel tree editor showing hierarchy with indented nodes, labels, slugs, computed paths
12. **Sitemap assignment popover** — cascading dropdowns with an assigned node showing in the green box at top
13. **Drag-to-assign** — sidebar row being dragged onto a tree node (if capturable)

### Redirect Editor
14. **Redirect editor** — full-panel view showing Kill pages with source URLs, destination fields, and default destination input

### Progress & Reports
15. **Progress dashboard** — modal open showing client/project fields, stats, color bar, group breakdown
16. **PDF export preview** — a generated PDF opened in Preview (showing the branded report)

### Browser Features
17. **Viewport simulation** — browser showing a narrow mobile viewport (SM 390px)
18. **Side-by-side compare** — split browser view with two pages
19. **Content extraction** — extraction results showing word count, headings, links

### Rubrics & Assessment
20. **Assessment result** — field bar showing an assessment recommendation with the assess button
21. **Rubric editor** — modal open with rubric markdown being edited
22. **Batch assessment** — progress indicator showing batch AI assessment running

### Settings & Configuration
23. **Settings popover** — settings open showing auto-advance, rubric dir, API key, custom KKE states, sidebar columns
24. **Custom KKE states** — a custom state defined and visible in the KKE buttons row

### Help
25. **Help window** — separate help window open alongside the main app window

### Dark Mode
26. **Dark mode** — any main view (audit view or sitemap editor) in macOS dark mode

### Menu Bar
27. **File menu** — showing Open, Open Recent, Save, Import/Merge, Export…
28. **Reports menu** — open, showing the three grouped sections (stakeholder narratives · IA & components · migration reports)
29. **Migration menu** — open, showing the export/validation tools (Pre-Handoff Check, Migration Tracker, Export Redirect Map, Redirect Chain Check)
30. **Help menu** — open, showing Getting Started, Product Tour, Keyboard Shortcuts

### Onboarding & Guidance
31. **Welcome dialog** — first-run welcome with the numbered steps and the Open / Tour / Shortcuts buttons
32. **Product tour** — a tour step mid-walkthrough: spotlight ring on a real element (e.g. the view switcher) with the step card and progress dots
33. **Keyboard cheat-sheet** — the `?` overlay showing the grouped shortcuts
34. **Settings scope labels** — App Settings header ("Applies to you, across all files") and Project Settings header ("Saved with this file") side by side or in turn

### Components (Design Patterns)
35. **Components cluster** — the violet COMPONENTS cluster expanded with a few component chips on a page
36. **Component picker** — the add-component dropdown open, grouped by category with complexity badges
37. **Component Library editor** — `Project → Component Library…` two-pane editor (list left, detail form right)
38. **Component Inventory report** — `Reports → Component Inventory…` frequency table with one-off flags and co-occurring pairs

### New Workflows (this release)
39. **Pre-Handoff Check** — the report modal showing a mix of passed (✓) and flagged (⚠) checks with fix hints
40. **AI Suggest for Unreviewed** — a populated Suggested_KKE badge after an AI pass (or the progress toast mid-run)
41. **Compare KKE vs SME** — the full-screen comparison: summary counts, status filter, and the Auditor / SME / Final / Status table
42. **Note snippets** — the Notes popover with the Snippets… menu open
43. **Page thumbnail** — hovering a visited sidebar row with the screenshot preview popped out beside it
44. **Save state** — title bar showing "✓ All changes saved" (and/or "⟳ Saving…")

---

## Tips

- Use the Stanford OHS crawl for realistic data
- Assign a mix of KKE statuses to several rows first so badges and the progress bar have color; assign a few pages to sitemap nodes and set 2–3 SME decisions so the migration, IA, and KKE-vs-SME shots have content
- Window size around 1440x900 captures well without feeling cramped
- Capture light mode first, then switch system appearance for the dark mode shot
- For the thumbnail shot, visit a few rows first (so they're cached) before hovering
- For onboarding shots, the welcome/tour are reachable anytime from the **Help** menu — no need to reset first-run state
