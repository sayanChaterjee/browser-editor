import type { PublishContestEvent } from '../events/publisher';
import Attempt from '../models/attempt.model';
import Contest from '../models/contest.model';
import Submission, { ISubmission } from '../models/submission.model';

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
 * Stores a submission with the attempt's strike count and the contest active at the time.
 * Everything it needs is in this service, so submitting works even if code-service is down.
 */
export async function createSubmission(input: SubmissionInput, publish: PublishContestEvent): Promise<ISubmission> {
  const [attempt, activeContest] = await Promise.all([
    Attempt.findOne({ userId: input.userId, projectId: input.projectId }).lean(),
    Contest.findOne({ status: 'active' }, { _id: 1 }).lean(),
  ]);

  const submission = await Submission.create({
    ...input,
    timeTaken: input.timeTaken || 0,
    contestId: activeContest ? String(activeContest._id) : null,
    warningCount: attempt?.strikeCount ?? 0,
  });

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
