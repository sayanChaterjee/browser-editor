# 0005: Contests in their own service

**Status:** accepted (Session 5)

## Context
code-service handled both the editor workspace (projects, saves) and contests (contest admin,
submissions, anti-cheat strikes). Strikes were stored on the project, and submitting read
them from there.

## Decision
- contest-service owns contests, submissions and strikes, with its own database. Strikes are
  stored per user and project ("attempts"), so submitting needs nothing from another service.
- It publishes `strike.recorded.v1`; code-service keeps a copy of the count on the project
  (`$max`, so out-of-order or repeated events are harmless) for the admin view.
- The frontend was not changed in this step. The gateway mapped the old paths
  (`/api/v1/code/submit`, `/warning/:id`, `/admin/submissions/:id`) to contest-service until the
  frontend called `/api/v1/contest/...` directly, then the aliases were removed (expand, then
  contract: the old paths kept working for tabs still running the previous frontend).

## Alternatives
- **contest-service asks code-service for the strike count at submit time:** one source of
  truth, but submitting (the end of a contest, the worst moment) would fail whenever
  code-service is down or asleep.
- **Keep contests in code-service:** fewer moving parts, but two unrelated domains in one
  deployable.

## Consequences
- The project's strike count is eventually consistent (normally milliseconds behind).
- `submission.created.v1` is published with no consumer yet; it's the hook for a grader.
