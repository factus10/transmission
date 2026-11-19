# Proposal — Client Review field

**Status:** proposed
**Date:** 2026-11-19

**Scope:** give auditors a filterable way to send specific pages to the client for a decision, say how much it matters, and carry that request into the SME round.

---

## 1. The problem

Auditors regularly reach pages they cannot finish on their own: the call depends on something only the client knows, or the auditor has made a call but isn't confident in it. Today there is nowhere to record that properly:

- **Flag (★ / F)** is a single on/off bookmark, stored in the hidden `_Flagged` column (`toggleFlag()` in renderer.js). It has no level and no reason, it's personal to the auditor, and it doesn't reach the SME export.
- **Notes** carry the reasoning, but they can't be filtered in any structured way.
- **A blank MRA** can't tell "nobody looked" from "I looked and can't decide."

Transmission's own methodology already names this gap. *The Five Dimensions* (`docs/methodology/the-five-dimensions.md`, Process State): "The middle states are real … They get parked in Notes, with the Flag bookmark, or in Tags." The CAD proposal (`docs/methodology/content-audit-disposition.md`) adds a Process State column (InReview / PendingSME / PendingStakeholder) for the same reason.

## 2. Design: two questions, kept apart

Confidence ("can I make the call?") and consequence ("how bad is a wrong call?") are separate questions. A single low-to-urgent scale would mix them, and clients read any scale as urgency.

| Column | Values | Meaning |
| --- | --- | --- |
| `Client_Review` | *(blank)*, Needs decision, Please confirm | **Needs decision:** the auditor reviewed the page but couldn't make the call. MRA may stay blank or carry a provisional value. **Please confirm:** the auditor made a call with low confidence. |
| `Client_Review_Priority` | Normal, Urgent | The consequence of a wrong call (legal or compliance risk, high traffic, a contractual requirement). Only meaningful when `Client_Review` is set. |
| `Client_Review_Reason` | Accuracy, Compliance/legal, Ownership, Consolidate target, Domain knowledge, Other | Lets the client route the page to the right SME. An editable per-project vocabulary in Project Settings, like Page Status. |

Notes still carry the specific question for the client.

All three columns join the `auditCols` injection list in `injectAndOrderAuditColumns()` (main.js), so existing projects gain them on open.

## 3. "Open" is derived, not stored

SME import should **not** clear or rewrite `Client_Review`. Instead:

> A client-review item is **open** when `Client_Review` is set and `SME_Decision` is blank (as read by `parseSmeDecision()`).

Reasons:

- The auditor's question stays on the row as a record of what was asked, which the client report and a later audit both want.
- SME import needs no special logic, and there is no resolve step that can disagree with the SME columns.
- It follows the app's existing preference for deriving facts that can be derived (compare `nonContentKind()`, which reads Status Code instead of storing a flag).

An auditor who wants to withdraw a question clears `Client_Review` by hand. That change is logged like any other.

## 4. Behavior

- **Audit view:** a control in the Decide cluster (a quick-chip or keyboard shortcut) to set status, priority and reason, plus a sidebar badge distinct from ★.
- **Filters** (special filters in `applyFilter()`'s `specialFilters` set):
  - `_client-review-open`: open items (§3)
  - `_client-review-urgent`: open and Urgent
  - `_client-review-undecided`: "Reviewed, undecided" (`Client_Review = Needs decision` and MRA blank)
  - by status and by reason through the ordinary field filter, which already covers single-value columns
- **Progress:** `gatherProgressStats()` counts Needs decision separately from Unreviewed, so "X% reviewed" stays honest. A Needs-decision row with a blank MRA has been reviewed; it just isn't decided.
- **SME export:** the three columns ride along read-only (added to `exportHeaders` in `showSmeExportModal()`). Rows with `Client_Review` set sort first (Urgent, then Needs decision, then Please confirm), or go on their own sheet. A new filter option exports only open client-review rows. SMEs answer them like any other row.
- **Reports:** SME Review Status adds open client-review items by owner, priority and reason. The Executive Summary gets a single count line.
- **Pre-Handoff Check:** warns on Urgent items still open.

## 5. MCP server

The server mirrors the special filters and the proposal field allow-list, so it needs matching changes:

- Port the new special filters into `SUPPORTED_SPECIAL_FILTERS` in `mcp/lib/project.js`. They need no renderer state, so they port cleanly.
- Add the three columns to `KNOWN_AUDIT_COLUMNS`.
- Add `Client_Review`, `Client_Review_Priority` and `Client_Review_Reason` to `PROPOSAL_FIELDS` (kind `set`, vocabulary checked against the project's reason list), and mirror them in the renderer's `proposalFieldKind()`. This lets a Claude session propose client-review flags, for example from a `decision-consistency` sweep.
- Mention the column and the "open" rule in `mcp/lib/semantics.js`.

## 6. Open questions

- **Per row or per authority?** CAD asks whether Process State is per authority (auditor vs SME). Proposed: `Client_Review` is, by definition, the auditor's question to the client, so per row is right for now. If CAD later adds per-authority column sets, this becomes the auditor's Process State, and nothing here blocks that.
- **Should Please confirm require a provisional MRA value?** Proposed: yes. Needs decision allows a blank MRA.
- **Should ★ Flag stay as the auditor's private bookmark?** Proposed: yes. It does a different job.

## 7. Interim workaround (until built)

Tags alone **do not work** as a workaround:

- The SME export sends a fixed set of nine columns (URL, Title, MRA, Primary Audience, Audiences, Notes, SME Decision, SME Notes, Content Owner). Tags is not one of them.
- The SME export ignores the sidebar filter. It can only filter by Group or Primary Tag, so it can't export just the tagged rows.

What does work:

1. **Put the request in Notes, which is exported.** Start each note with a fixed prefix, for example `[DECIDE · URGENT · Compliance] Is this page still legally required?`. Searching Notes for `[DECIDE` gives a worklist in the app as well.
2. **Optionally tag the rows** (`review-decide`, `review-confirm`, `review-urgent`, plus a reason tag) for filtering in the app only.
3. **To send the client only those rows**, use File → Export… → Client Export with a column profile that includes the SME columns. It respects the sidebar filter. The SME_Decision dropdown is lost, but SME Import still matches rows by URL.
