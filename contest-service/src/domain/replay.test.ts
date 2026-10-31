import '../test/env';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Snapshot from '../models/snapshot.model';
import Submission from '../models/submission.model';
import Contest from '../models/contest.model';
import { recordActivity } from './activity';
import { MAX_SNAPSHOTS, replayFor, saveSnapshot, snapshotCode } from './replay';
import { ContestError } from './contests';

// Needs a real MongoDB (a replica set: submissions are transactions elsewhere). Locally e.g.
// MONGO_TEST_URL=mongodb://localhost:27017/x npm test -w contest-service
const url = process.env.MONGO_TEST_URL;
const skip = url ? false : 'MONGO_TEST_URL not set';

before(async () => {
  if (!url) return;
  await mongoose.connect(url.replace(/\/[^/?]*(\?|$)/, '/replay_test$1'));
  await mongoose.connection.dropDatabase();
});

after(async () => {
  if (url) await mongoose.disconnect();
});

const T0 = new Date(Date.UTC(2026, 5, 1, 10, 0, 0));
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);
const beat = (typedChars: number, codeChars: number, pasted = 0) =>
  ({ typedChars, pastedChars: pasted, pasteCount: pasted ? 1 : 0, largestPaste: pasted, codeChars });

test('snapshots: saved when the code changed, skipped when not, capped', { skip }, async () => {
  const project = new mongoose.Types.ObjectId().toString();
  assert.equal(await saveSnapshot('ann', project, { html: '<p>1</p>', css: '', js: '' }, at(1)), true);
  assert.equal(await saveSnapshot('ann', project, { html: '<p>1</p>', css: '', js: '' }, at(2)), false, 'unchanged');
  assert.equal(await saveSnapshot('ann', project, { html: '<p>12</p>', css: '', js: '' }, at(3)), true);
  assert.equal((await Snapshot.findOne({ userId: 'ann', at: at(3) }).lean())!.chars, 9);

  const full = new mongoose.Types.ObjectId().toString();
  await Snapshot.insertMany(Array.from({ length: MAX_SNAPSHOTS }, (_, i) => ({ userId: 'bo', projectId: full, at: at(i), html: String(i), css: '', js: '', chars: 1 })));
  assert.equal(await saveSnapshot('bo', full, { html: 'more', css: '', js: '' }, at(999)), false, 'over the cap');
});

test('the replay: timeline and snapshots up to the submission, code fetched per snapshot', { skip }, async () => {
  const project = new mongoose.Types.ObjectId().toString();
  const contest = await Contest.create({ title: 'Replay cup', startTime: at(0), endTime: at(60), status: 'active' });

  await recordActivity('cara', project, { ...beat(0, 100), startChars: 100 }, at(0));
  await recordActivity('cara', project, beat(40, 140), at(1));
  await recordActivity('cara', project, beat(5, 545, 400), at(2)); // a 400-character paste
  await saveSnapshot('cara', project, { html: 'a'.repeat(140), css: '', js: '' }, at(1));
  await saveSnapshot('cara', project, { html: 'a'.repeat(545), css: '', js: '' }, at(2));
  const submission = await Submission.create({ userId: 'cara', projectId: project, contestId: String(contest._id), html: 'a'.repeat(545), timeTaken: 180 });
  // Activity after submitting isn't part of this submission's story
  await recordActivity('cara', project, beat(10, 555), new Date(Date.now() + 60_000));
  await saveSnapshot('cara', project, { html: 'after', css: '', js: '' }, new Date(Date.now() + 60_000));

  const replay = await replayFor(String(submission._id));
  assert.equal(replay.contest!.title, 'Replay cup');
  assert.equal(replay.submission.chars, 545);
  assert.deepEqual(replay.timeline.map((p) => [p.chars, p.pasted]), [[100, 0], [140, 0], [545, 400]]);
  assert.deepEqual(replay.snapshots.map((s) => s.chars), [140, 545]);
  assert.ok(!JSON.stringify(replay).includes('aaaa'), 'no code in the outline');

  const code = await snapshotCode(String(submission._id), replay.snapshots[1]._id);
  assert.equal(code.html.length, 545);

  // A snapshot of someone else's attempt can't be reached through this submission
  const other = await Snapshot.create({ userId: 'dov', projectId: project, at: at(5), html: 'secret', css: '', js: '', chars: 6 });
  await assert.rejects(snapshotCode(String(submission._id), String(other._id)), (e: unknown) => e instanceof ContestError && e.status === 404);
  await assert.rejects(replayFor(new mongoose.Types.ObjectId().toString()), (e: unknown) => e instanceof ContestError && e.status === 404);
});
