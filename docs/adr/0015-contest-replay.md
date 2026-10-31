# 0015: Contest replay for admins

**Status:** accepted

## Context
The contest signals (ADR 0011) say *that* something looks off - a large paste, code that
wasn't typed - but not *when* or *what*. A reviewer had the final code and a few totals, and
no way to see how the code came about.

## Decision
- **The editor's heartbeats (every 15 s) also carry the code's size**, appended to the
  attempt as a timeline point (time, typed, pasted, size) in the same atomic update as the
  counts; the latest 1,000 points are kept.
- **About once a minute, when the code changed, a heartbeat carries the code itself**: a
  snapshot (html, css, js) in its own collection, at most 300 per attempt. Unchanged code
  isn't stored again. Submitting always sends a final snapshot, so the replay ends on the
  submitted code. (A window-closing beacon carries one only if it's under 50 KB.)
- **Admins open a replay from a submission**: a chart of code size over the contest with
  pastes and offline gaps marked, a scrubber over the snapshots, and each snapshot's code
  and live preview. The outline (`GET /contest/admin/replay/:submissionId`) has no code; each
  snapshot's code is fetched when it's shown. Only activity up to the submission counts.

## Alternatives
- **Every keystroke (an edit log):** an exact replay, but far more data and far more invasive.
- **Snapshots from code-service's autosave:** the code is there every 10 s, but it belongs to
  another service, and contest-service would need to read its database or call it.
- **Diffs instead of full snapshots:** smaller, but more code to apply and verify; a contest's
  worth of full snapshots is a few megabytes at most.

## Consequences
- A jump in size (paste, scripted edit) shows on the chart where it happened, and the
  snapshots around it show what arrived.
- Storage: one snapshot a minute per contestant when they're changing code; capped.
- Granularity is a minute: a reviewer sees the code before and after a jump, not each key.
