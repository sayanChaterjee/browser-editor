# 0012: Scheduled contests with rooms

**Status:** accepted

## Context
An admin made a contest "active" by hand, and while it was active anyone could press Start
whenever they liked; the timer ran to the end time. Nothing marked who was taking part, and
`/contest/active` sent the target's code to every signed-in user, before they had started.

## Decision
- **Contests run on their schedule.** `status` is the admin's publish switch (`pending` is a
  draft, `active` published, `ended` closed early). A published contest is upcoming, live or
  ended according to its start and end times; nobody has to press anything at the start.
- **Rooms.** Users join a contest (`POST /contest/:id/join`) before or during it; a
  `Participant` record (one per user and contest) holds when they joined, their contest
  project and when they submitted. `GET /contest/:id/room` returns the schedule, the server's
  clock (so the countdown is right whatever the user's clock says) and how many have joined.
- **The question is held back** (`GET /contest/:id/question`) until the start, and only for
  participants. The contest list never includes it.
- **One contest project per participant.** `PUT /contest/:id/project` links it; the first link
  wins, so a second tab or a retry gets the same project.
- **Submissions name their contest** and must arrive while it is live, or within two minutes
  of the end (the editor auto-submits at time-up), from a participant.
- `/contest/active` and submissions without a contest keep working for the single-page editor
  until the frontend moves to the contest pages.

## Alternatives
- **Admin presses Start:** everyone starts together, but the contest then depends on someone
  being there at the right time.
- **Live presence (websockets) in the room:** a true "who's here now" list; polling a count
  every few seconds is enough for a waiting room and works on the free tier.

## Consequences
- The target can't be studied before the start, and late or non-participant submissions are
  refused by the server, not just hidden by the page.
- The waiting room's count is "joined", not "online now".
