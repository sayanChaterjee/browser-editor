import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import type { PublishContestEvent } from '../events/publisher';
import Contest from '../models/contest.model';
import Submission from '../models/submission.model';
import { createSubmission, recordStrike, setDisqualified } from './attempts';

// Needs a real MongoDB: CI provides one; locally e.g.
// MONGO_TEST_URL=mongodb://localhost:27017/contest_test npm test -w contest-service
const url = process.env.MONGO_TEST_URL;
const skip = url ? false : 'MONGO_TEST_URL not set';

before(async () => {
  if (!url) return;
  await mongoose.connect(url);
  await mongoose.connection.dropDatabase();
  await mongoose.model('Attempt').syncIndexes();
});

after(async () => {
  if (url) await mongoose.disconnect();
});

function collector() {
  const events: { type: string; data: any }[] = [];
  const publish: PublishContestEvent = (type, data) => void events.push({ type, data });
  return { events, publish };
}

const projectA = new mongoose.Types.ObjectId().toString();
const projectB = new mongoose.Types.ObjectId().toString();

test('strikes count per user and project, and each one is announced', { skip }, async () => {
  const { events, publish } = collector();

  assert.equal(await recordStrike('alice', projectA, publish), 1);
  assert.equal(await recordStrike('alice', projectA, publish), 2);
  assert.equal(await recordStrike('alice', projectB, publish), 1);
  assert.equal(await recordStrike('bob', projectA, publish), 1);

  assert.deepEqual(
    events.map((e) => [e.type, e.data.userId, e.data.projectId, e.data.strikeCount]),
    [
      ['strike.recorded.v1', 'alice', projectA, 1],
      ['strike.recorded.v1', 'alice', projectA, 2],
      ['strike.recorded.v1', 'alice', projectB, 1],
      ['strike.recorded.v1', 'bob', projectA, 1],
    ],
  );
});

test('a submission records the strikes so far and the active contest', { skip }, async () => {
  const { events, publish } = collector();
  const contest = await Contest.create({
    title: 'Test contest',
    startTime: new Date(),
    endTime: new Date(Date.now() + 3600_000),
    status: 'active',
  });

  const submission = await createSubmission(
    { userId: 'alice', projectId: projectA, html: '<h1>done</h1>', timeTaken: 120 },
    publish,
  );

  assert.equal(submission.warningCount, 2);
  assert.equal(submission.contestId, String(contest._id));
  assert.equal(submission.timeTaken, 120);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'submission.created.v1');
  assert.equal(events[0].data.submissionId, String(submission._id));
  assert.equal(events[0].data.strikeCount, 2);

  await Contest.deleteMany({});
});

test('a submission without strikes or an active contest', { skip }, async () => {
  const { publish } = collector();
  const submission = await createSubmission({ userId: 'carol', projectId: projectB }, publish);
  assert.equal(submission.warningCount, 0);
  assert.equal(submission.contestId, null);
});

test('ban disqualifies only that user; unban reinstates', { skip }, async () => {
  const { publish } = collector();
  await createSubmission({ userId: 'bob', projectId: projectA }, publish);

  assert.equal(await setDisqualified('alice', true), 1);
  assert.equal((await Submission.find({ userId: 'alice', disqualified: true })).length, 1);
  assert.equal((await Submission.find({ userId: 'bob', disqualified: true })).length, 0);

  // Repeating it (a redelivered event) changes nothing
  assert.equal(await setDisqualified('alice', true), 0);

  assert.equal(await setDisqualified('alice', false), 1);
  assert.equal((await Submission.find({ disqualified: true })).length, 0);
});
