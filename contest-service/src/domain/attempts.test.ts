import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import type { PublishContestEvent } from '../events/publisher';
import Contest from '../models/contest.model';
import Submission from '../models/submission.model';
import Attempt from '../models/attempt.model';
import { createSubmission, recordStrike, setDisqualified } from './attempts';
import { ActivityDelta, assessSubmission, recordActivity } from './activity';

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

// --- Activity signals (heartbeats, typing vs pasting, similarity) ---

const activityProject = new mongoose.Types.ObjectId().toString();
const at = (seconds: number) => new Date(Date.UTC(2026, 0, 1, 10, 0, seconds));
const beat = (typedChars = 0, extra: Partial<ActivityDelta> = {}) =>
  ({ typedChars, pastedChars: 0, pasteCount: 0, largestPaste: 0, ...extra });

test('heartbeats add up; a long silence counts as a gap with its offline time', { skip }, async () => {
  await recordActivity('dana', activityProject, beat(0, { startChars: 120 }), at(0));
  await recordActivity('dana', activityProject, beat(40, { startChars: 999 }), at(15));
  await recordActivity('dana', activityProject, beat(60, { pastedChars: 350, pasteCount: 1, largestPaste: 350 }), at(30));
  const activity = await recordActivity('dana', activityProject, beat(10, { pastedChars: 20, pasteCount: 1, largestPaste: 20 }), at(150));

  assert.equal(activity.heartbeats, 4);
  assert.equal(activity.startChars, 120, 'set by the first heartbeat only');
  assert.equal(activity.typedChars, 110);
  assert.equal(activity.pastedChars, 370);
  assert.equal(activity.pasteCount, 2);
  assert.equal(activity.largestPaste, 350);
  assert.equal(activity.gaps, 1);
  assert.equal(activity.offlineSeconds, 105, '120 s of silence minus the expected 15 s');

  // Strikes and activity live on the same attempt without overwriting each other
  assert.equal(await recordStrike('dana', activityProject, collector().publish), 1);
  assert.equal((await Attempt.findOne({ userId: 'dana', projectId: activityProject }).lean())!.activity!.heartbeats, 4);
});

test('assessSubmission: clean work raises no flags', () => {
  const { signals, flags } = assessSubmission({
    activity: { heartbeats: 40, lastHeartbeatAt: null, gaps: 0, offlineSeconds: 0, startChars: 100, typedChars: 3000, pastedChars: 0, pasteCount: 0, largestPaste: 0 },
    timeTakenSeconds: 600,
    finalChars: 2500,
    similarity: { score: 0.3, submissionId: 's', userId: 'u' },
    targetSimilarity: 0.2,
  });
  assert.deepEqual(flags, []);
  assert.equal(signals.expectedHeartbeats, 40);
  assert.equal(signals.unexplainedChars, 0);
});

test('assessSubmission: each signal raises its flag', () => {
  const { signals, flags } = assessSubmission({
    activity: { heartbeats: 10, lastHeartbeatAt: null, gaps: 3, offlineSeconds: 300, startChars: 100, typedChars: 200, pastedChars: 900, pasteCount: 2, largestPaste: 800 },
    timeTakenSeconds: 600,
    finalChars: 2000, // 100 + 200 + 900 = 1200 explained
    similarity: { score: 0.93, submissionId: 's', userId: 'u' },
    targetSimilarity: 0.88,
  });
  assert.equal(signals.unexplainedChars, 800);
  assert.deepEqual(flags.sort(), ['code-without-typing', 'large-paste', 'matches-target', 'missing-heartbeats', 'offline', 'similar-submission']);
});

test('assessSubmission: no heartbeats at all is flagged, not excused', () => {
  const { flags, signals } = assessSubmission({ activity: null, timeTakenSeconds: 900, finalChars: 4000, similarity: null, targetSimilarity: 0 });
  assert.deepEqual(flags, ['missing-heartbeats']);
  assert.equal(signals.heartbeats, 0);
});

const solution = (name: string) => `
<section class="profile"><img id="avatar" src="a.png"><h2 id="name">${name}</h2><p class="bio">Front-end developer</p>
<button id="follow">Follow</button></section>
.profile { display: grid; place-items: center; gap: 8px; padding: 32px; background: #f5f5f5; border-radius: 12px; }
#avatar { width: 96px; height: 96px; border-radius: 50%; object-fit: cover; }
.bio { color: #666; font-size: 14px; }
let following = false;
document.getElementById('follow').addEventListener('click', () => {
  following = !following;
  document.getElementById('follow').textContent = following ? 'Following' : 'Follow';
});
`;

test('copied entries in a contest are flagged on both sides; a copied target is flagged', { skip }, async () => {
  const { publish } = collector();
  const contest = await Contest.create({
    title: 'Similarity contest',
    startTime: new Date(),
    endTime: new Date(Date.now() + 3600_000),
    status: 'active',
    html: '<main class="target"><h1>Pricing</h1><ul class="plans"><li>Free</li><li>Pro</li><li>Team</li></ul></main>',
    css: '.target { font-family: sans-serif; max-width: 720px; margin: auto; } .plans { display: flex; gap: 16px; list-style: none; } .plans li { flex: 1; padding: 24px; border: 1px solid #ddd; border-radius: 8px; }',
    js: "document.querySelectorAll('.plans li').forEach((li) => li.addEventListener('click', () => li.classList.toggle('picked')));",
  });

  const original = await createSubmission({ userId: 'erin', projectId: projectA, html: solution('Erin'), timeTaken: 60 }, publish);
  assert.deepEqual(original.flags, []);

  // Same code, reformatted, by someone else
  const copy = await createSubmission({ userId: 'finn', projectId: projectB, html: solution('Finn').replace(/\n/g, ' '), timeTaken: 60 }, publish);
  assert.ok(copy.flags.includes('similar-submission'));
  assert.equal(copy.signals!.similarity!.submissionId, String(original._id));
  assert.ok(copy.signals!.similarity!.score >= 0.8);

  const originalNow = await Submission.findById(original._id).lean();
  assert.ok(originalNow!.flags.includes('similar-submission'), 'the earlier entry is flagged too');
  assert.equal(originalNow!.signals!.similarity!.submissionId, String(copy._id));

  // A user's own resubmission isn't a copy
  const resubmit = await createSubmission({ userId: 'erin', projectId: projectA, html: solution('Erin'), timeTaken: 90 }, publish);
  assert.equal(resubmit.signals!.similarity!.userId, 'finn', 'compared with others only');

  // Lifting the target's code from the page
  const lifted = await createSubmission({ userId: 'gus', projectId: projectB, html: contest.html, css: contest.css, js: contest.js, timeTaken: 60 }, publish);
  assert.ok(lifted.flags.includes('matches-target'));
  assert.equal((await Submission.findById(lifted._id).select('fingerprint').lean())!.fingerprint.length > 0, true);

  await Contest.deleteMany({});
});
