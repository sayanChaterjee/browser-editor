import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Contest from '../models/contest.model';
import Participant from '../models/participant.model';
import { createSubmission } from './attempts';
import { ContestError, SUBMIT_GRACE_MS, join, listForUser, phaseOf, question, room, setProject } from './contests';

// Needs a real MongoDB: CI provides one; locally e.g.
// MONGO_TEST_URL=mongodb://localhost:27017/contest_test npm test -w contest-service
const url = process.env.MONGO_TEST_URL;
const skip = url ? false : 'MONGO_TEST_URL not set';

before(async () => {
  if (!url) return;
  await mongoose.connect(url.replace(/\/[^/]*$/, '/contest_rooms_test'));
  await mongoose.connection.dropDatabase();
  await Participant.syncIndexes();
});

after(async () => {
  if (url) await mongoose.disconnect();
});

const T0 = new Date(Date.UTC(2026, 5, 1, 10, 0, 0));
const minutes = (n: number) => new Date(T0.getTime() + n * 60_000);
const noEvents = () => {};

// Starts at T0, runs 60 minutes
const scheduled = (extra: object = {}) =>
  Contest.create({
    title: 'Landing page sprint', startTime: T0, endTime: minutes(60), status: 'active',
    html: '<h1>Target</h1>', css: 'h1 { color: red }', js: '', imageUrl: 'https://example.com/target.png', ...extra,
  });

const rejectsWith = async (status: number, promise: Promise<unknown>) =>
  assert.rejects(promise, (err: unknown) => err instanceof ContestError && err.status === status);

test('phase comes from the schedule; status only publishes or closes early', () => {
  const c = { status: 'active' as const, startTime: T0, endTime: minutes(60) };
  assert.equal(phaseOf(c, minutes(-1)), 'upcoming');
  assert.equal(phaseOf(c, T0), 'live');
  assert.equal(phaseOf(c, minutes(60)), 'ended');
  assert.equal(phaseOf({ ...c, status: 'pending' }, T0), 'draft');
  assert.equal(phaseOf({ ...c, status: 'ended' }, minutes(10)), 'ended');
});

test('the list shows published contests by phase, never drafts or the question', { skip }, async () => {
  const live = await scheduled();
  await scheduled({ title: 'Later', startTime: minutes(120), endTime: minutes(180) });
  await scheduled({ title: 'Soon', startTime: minutes(30), endTime: minutes(90) });
  await scheduled({ title: 'Draft', status: 'pending' });
  await scheduled({ title: 'Old', startTime: minutes(-180), endTime: minutes(-120) });
  await join(String(live._id), 'amy', minutes(1));

  const list = await listForUser('amy', minutes(5));
  assert.deepEqual(list.live.map((c) => [c.title, c.joined]), [['Landing page sprint', true]]);
  assert.deepEqual(list.upcoming.map((c) => c.title), ['Soon', 'Later'], 'soonest first');
  assert.deepEqual(list.past.map((c) => c.title), ['Old']);
  const everything = JSON.stringify(list);
  assert.ok(!everything.includes('Draft') && !everything.includes('Target') && !everything.includes('target.png'));
  await Contest.deleteMany({});
  await Participant.deleteMany({});
});

test('the room: join before the start, count who is waiting, no question until it starts', { skip }, async () => {
  const contest = await scheduled();
  const id = String(contest._id);

  const before = await room(id, 'amy', minutes(-10));
  assert.equal(before.contest.phase, 'upcoming');
  assert.equal(before.me, null);
  assert.equal(before.participants, 0);

  await join(id, 'amy', minutes(-10));
  const joined = await join(id, 'bob', minutes(-5));
  await join(id, 'bob', minutes(-4)); // again: nothing changes
  assert.equal(joined.participants, 2);
  assert.equal(joined.me!.joinedAt, minutes(-5).toISOString());

  await rejectsWith(403, question(id, 'amy', minutes(-1)));
  await rejectsWith(403, question(id, 'cat', minutes(1)));
  assert.deepEqual(await question(id, 'amy', minutes(1)), {
    imageUrl: 'https://example.com/target.png', html: '<h1>Target</h1>', css: 'h1 { color: red }', js: '',
  });

  // Late joiners are welcome until the end; after it, no
  await join(id, 'cat', minutes(30));
  await rejectsWith(409, join(id, 'dan', minutes(61)));
  // Drafts don't exist for users
  const draft = await scheduled({ status: 'pending' });
  await rejectsWith(404, room(String(draft._id), 'amy', minutes(1)));
});

test('each participant gets one contest project: the first link wins', { skip }, async () => {
  const contest = await scheduled();
  const id = String(contest._id);
  const first = new mongoose.Types.ObjectId().toString();
  const second = new mongoose.Types.ObjectId().toString();

  await join(id, 'amy', minutes(-1));
  await rejectsWith(409, setProject(id, 'amy', first, minutes(-1)));
  assert.deepEqual(await setProject(id, 'amy', first, minutes(1)), { projectId: first });
  assert.deepEqual(await setProject(id, 'amy', second, minutes(2)), { projectId: first }, 'a second tab gets the same one');
  await rejectsWith(403, setProject(id, 'zed', first, minutes(1)));
});

test('contest submissions: only participants, only in the window (plus grace), recorded on the room', { skip }, async () => {
  const contest = await scheduled();
  const id = String(contest._id);
  const projectId = new mongoose.Types.ObjectId().toString();
  await join(id, 'amy', minutes(-1));

  await rejectsWith(409, createSubmission({ userId: 'amy', projectId, contestId: id }, noEvents, minutes(-1)));
  await rejectsWith(403, createSubmission({ userId: 'zed', projectId, contestId: id }, noEvents, minutes(5)));

  // Time-up auto-submit arrives just after the end: accepted
  const atEnd = new Date(minutes(60).getTime() + SUBMIT_GRACE_MS - 1000);
  const submission = await createSubmission({ userId: 'amy', projectId, contestId: id, html: '<h1>mine</h1>' }, noEvents, atEnd);
  assert.equal(submission.contestId, id);
  assert.ok((await room(id, 'amy', atEnd)).me!.submittedAt);

  await rejectsWith(409, createSubmission({ userId: 'amy', projectId, contestId: id }, noEvents, minutes(63)));
});

test('without a contestId (the old editor), the contest live now is used', { skip }, async () => {
  await Contest.deleteMany({});
  const now = new Date();
  const live = await scheduled({ startTime: new Date(now.getTime() - 60_000), endTime: new Date(now.getTime() + 60_000) });
  await scheduled({ title: 'Not yet', startTime: new Date(now.getTime() + 3600_000), endTime: new Date(now.getTime() + 7200_000) });
  const submission = await createSubmission({ userId: 'old', projectId: new mongoose.Types.ObjectId().toString() }, noEvents, now);
  assert.equal(submission.contestId, String(live._id));
});
