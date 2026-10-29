# 0011: Contest integrity from signals the server keeps

**Status:** accepted

## Context
Contest anti-cheat ran in the browser: full screen, tab-switch strikes, blocked clipboard
shortcuts. The strike count was kept on the server, but everything else depended on the page
behaving, and someone with devtools can switch the listeners off, block the strike requests
or set the editor's content from a script. The browser also receives the contest's target
code (to show the target), so it can be copied from the network tab.

## Decision
Keep the browser deterrents, and add a record the browser can't take back. Reviewers get
evidence next to the code, not an automatic verdict.

- **Heartbeats.** During a contest the editor reports every 15 s what was typed and what was
  inserted in bulk (one insertion of 80+ characters: a paste, a drop or a scripted edit).
  contest-service adds each report to the attempt in one atomic update and measures the
  silence since the previous one itself (over 45 s is a gap, counted as offline time).
- **Checks at submission.** The submission stores the signals and raises flags:
  - `missing-heartbeats`: under half the expected reports (reports blocked, or the page closed)
  - `offline`: 2+ minutes of gaps
  - `large-paste`: an insertion of 300+ characters, or more pasted than typed
  - `code-without-typing`: the code is longer than the starting size plus everything typed and
    pasted, by 200+ characters. Code set from devtools or React's state skips the editor's
    input entirely, so it shows up here.
  - `similar-submission` / `matches-target`: 80%+ similar to another user's entry in the
    contest, or to the contest's target code.
- **Similarity** uses 5-token shingles of normalised code (comments, whitespace and case
  removed) and a 128-hash bottom-k MinHash sketch per submission, so comparing is cheap and the
  code isn't reloaded. Near-empty code gets no sketch. A match flags both entries.
- **Evidence stays with admins.** The contestant's submit response leaves out signals, flags
  and the sketch, so they don't learn which signals they tripped.

## Alternatives
- **Proctoring (webcam, screen recording):** the strongest signal, and far beyond this project.
- **Keystroke recording / replay:** better evidence than counts, but heavy to store and much
  more invasive.
- **Automatic disqualification on flags:** signals have innocent explanations (a network drop
  looks like missing heartbeats), so a person decides.

## Consequences
- Blocking the reports, scripting the editor, copying another entry and lifting the target
  code each leave a mark that holds up after the browser is closed.
- It can still be beaten: a careful cheater can send fake heartbeats that match fake typing.
  That takes deliberate work, and the similarity checks don't depend on the browser at all.
- One small request every 15 s per contestant; one sketch comparison per other entry at
  submission (a few hundred numbers each).
