# Release notes (update-manifest `notes`)

One file per released version, named `<version>.txt`. Each is the prose shown in
the **Update Available** dialog to someone still on an older build — passed to
the publish script as:

```bash
npm run release:publish -- --manifest-notes release-notes/2.18.0.txt
```

## Why these live here rather than being generated

`scripts/publish-release.sh` deliberately does not derive this text from
`CHANGELOG.md`. The changelog is a developer record of everything that changed;
this is a short paragraph written for a person deciding whether to update right
now. They answer different questions and read nothing alike.

They are kept per-version because the published manifest holds only the
**current** one — each release overwrites its `notes` field — so without this
directory there would be no record of what users were actually told about any
previous version. That matters when someone reports a problem and the useful
question is what the update dialog claimed at the time.

## Writing one

The script does `readFileSync(...).trim()` and drops the result straight into
the manifest's `notes` field, which `showUpdateModal()` renders with
`escapeHtml()` inside a single `<p>`. So:

- **One paragraph, one line.** No Markdown, no bullets, no headings — none of it
  renders. Internal newlines survive into the JSON but collapse to spaces in the
  dialog, so they only make the file harder to diff.
- **Keep it short.** The dialog is 460px wide. ~300 characters is two or three
  lines; 650 is about ten, which is roughly the ceiling before it stops being a
  summary. Compare `2.17.1.txt` (a small fix release) with `2.18.0.txt` (a large
  one) for the range.
- **Lead with the reason to update today**, not with the largest feature. If a
  release corrects numbers that already went to a client, say so — that is the
  only thing in the note someone has to act on.
- **Don't restate the changelog.** The dialog already has a *What's New* button
  that opens it. This paragraph earns its place by being the part that button
  cannot be: an argument, not an inventory.
- **Don't quote figures you have not measured.** A specific percentage reads as
  a measurement of the reader's own data; describe the mechanism instead.

Files here are not bundled into the app — `build.files` in `package.json` is an
allowlist (`*.js`, `src/`, `assets/`, `rubrics/`, `node_modules/`), so a new
top-level directory is not shipped.
