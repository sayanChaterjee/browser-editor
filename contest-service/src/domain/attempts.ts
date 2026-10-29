import type { PublishContestEvent } from '../events/publisher';
import Attempt from '../models/attempt.model';
import Contest from '../models/contest.model';
import Submission, { ISubmission } from '../models/submission.model';
import { assessSubmission, THRESHOLDS } from './activity';
import { fingerprint, similarity, submissionCode } from './similarity';

/** Records an anti-cheat strike on the user's attempt and returns the new total. */
export async function recordStrike(userId: string, projectId: string, publish: PublishContestEvent): Promise<number> {
  const attempt = await Attempt.findOneAndUpdate(
    { userId, projectId },
    { $inc: { strikeCount: 1 } },
    { upsert: true, new: true },
  );
  publish('strike.recorded.v1', {
    userId,
    projectId,
    strikeCount: attempt.strikeCount,
    recordedAt: new Date().toISOString(),
  });
  return attempt.strikeCount;
}

export interface SubmissionInput {
  userId: string;
  projectId: string;
  html?: string;
  css?: string;
  js?: string;
  timeLeft?: number;
  timeTaken?: number;
}

/**
 * Stores a submission with the attempt's strike count, the contest active at the time, and the
 * evidence a reviewer needs: activity signals, similarity to other entries and to the contest's
 * target, and the flags they raise. Everything it needs is in this service, so submitting
 * works even if code-service is down.
 */
export async function createSubmission(input: SubmissionInput, publish: PublishContestEvent): Promise<ISubmission> {
  const [attempt, activeContest] = await Promise.all([
    Attempt.findOne({ userId: input.userId, projectId: input.projectId }).lean(),
    Contest.findOne({ status: 'active' }, { _id: 1, html: 1, css: 1, js: 1 }).lean(),
  ]);
  const contestId = activeContest ? String(activeContest._id) : null;
  const code = submissionCode(input);
  const print = fingerprint(code);

  // Other users' entries in the same contest (a user's own earlier submissions don't count)
  const others = contestId && print.length
    ? await Submission.find({ contestId, userId: { $ne: input.userId } }).select('userId signals fingerprint').lean()
    : [];
  const scored = others
    .map((other) => ({ other, score: Math.round(similarity(print, other.fingerprint) * 100) / 100 }))
    .sort((a, b) => b.score - a.score);
  const closest = scored[0] && scored[0].score > 0
    ? { score: scored[0].score, submissionId: String(scored[0].other._id), userId: scored[0].other.userId }
    : null;

  const { signals, flags } = assessSubmission({
    activity: attempt?.activity,
    timeTakenSeconds: input.timeTaken || 0,
    finalChars: code.length - 2, // without the two separators submissionCode adds
    similarity: closest,
    targetSimilarity: activeContest ? similarity(print, fingerprint(submissionCode(activeContest))) : 0,
  });

  const submission = await Submission.create({
    ...input,
    timeTaken: input.timeTaken || 0,
    contestId,
    warningCount: attempt?.strikeCount ?? 0,
    signals,
    flags,
    fingerprint: print,
  });

  // A copy implicates both entries: earlier ones it matches get the match too, unless they
  // already show a closer one
  const matches = scored.filter(({ other, score }) =>
    score >= THRESHOLDS.similarity && score > (other.signals?.similarity?.score ?? 0));
  await Promise.all(matches.map(({ other, score }) =>
    Submission.updateOne(
      { _id: other._id },
      {
        $set: { 'signals.similarity': { score, submissionId: String(submission._id), userId: submission.userId } },
        $addToSet: { flags: 'similar-submission' },
      },
    )));

  publish('submission.created.v1', {
    submissionId: String(submission._id),
    userId: submission.userId,
    projectId: submission.projectId,
    contestId: submission.contestId,
    timeTakenSeconds: submission.timeTaken,
    strikeCount: submission.warningCount,
    submittedAt: submission.createdAt.toISOString(),
  });
  return submission;
}

/** Ban/unban (user.banned.v1 / user.unbanned.v1): flags or clears all of the user's submissions. */
export async function setDisqualified(userId: string, disqualified: boolean): Promise<number> {
  // Only submissions whose flag changes, so a redelivered event touches nothing
  const result = await Submission.updateMany({ userId, disqualified: { $ne: disqualified } }, { $set: { disqualified } });
  return result.modifiedCount;
}
