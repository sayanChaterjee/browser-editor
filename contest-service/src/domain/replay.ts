import { isValidObjectId } from 'mongoose';
import Attempt from '../models/attempt.model';
import Contest from '../models/contest.model';
import Snapshot from '../models/snapshot.model';
import Submission from '../models/submission.model';
import { ContestError } from './contests';

/**
 * Contest replay for admins: how a submission's code came about. The editor's heartbeats leave
 * a timeline (typed, pasted, code size every 15 s) and, about once a minute when the code
 * changed, a snapshot of the code. Together they show the code growing, and make a jump (a big
 * paste, or code set from devtools) visible at the moment it happened.
 */

// One contest's worth of snapshots at one a minute; more are refused rather than grown
export const MAX_SNAPSHOTS = 300;

export interface SnapshotCode {
  html: string;
  css: string;
  js: string;
}

const size = ({ html, css, js }: SnapshotCode) => html.length + css.length + js.length;

/**
 * Keeps the code as it is now, unless it's the same as the last snapshot (nothing new to see)
 * or the attempt already has MAX_SNAPSHOTS. Returns whether it was saved.
 */
export async function saveSnapshot(userId: string, projectId: string, code: SnapshotCode, now = new Date()): Promise<boolean> {
  const last = await Snapshot.findOne({ userId, projectId }).sort({ at: -1 }).lean();
  if (last && last.html === code.html && last.css === code.css && last.js === code.js) return false;
  if ((await Snapshot.countDocuments({ userId, projectId })) >= MAX_SNAPSHOTS) return false;
  await Snapshot.create({ userId, projectId, at: now, ...code, chars: size(code) });
  return true;
}

async function submissionFor(submissionId: string) {
  const submission = isValidObjectId(submissionId) ? await Submission.findById(submissionId).lean() : null;
  if (!submission) throw new ContestError(404, 'Submission not found');
  return submission;
}

/** Everything the replay shows except the snapshots' code (fetched one at a time). */
export async function replayFor(submissionId: string) {
  const submission = await submissionFor(submissionId);
  const { userId, projectId } = submission;
  const [attempt, snapshots, contest] = await Promise.all([
    Attempt.findOne({ userId, projectId }).lean(),
    Snapshot.find({ userId, projectId, at: { $lte: submission.createdAt } }, { at: 1, chars: 1 }).sort({ at: 1 }).lean(),
    submission.contestId && isValidObjectId(submission.contestId)
      ? Contest.findById(submission.contestId, { title: 1, startTime: 1, endTime: 1 }).lean()
      : null,
  ]);

  return {
    submission: {
      _id: String(submission._id),
      userId,
      projectId,
      submittedAt: submission.createdAt.toISOString(),
      timeTaken: submission.timeTaken,
      chars: size(submission),
      flags: submission.flags ?? [],
    },
    contest: contest
      ? { title: contest.title, startTime: contest.startTime.toISOString(), endTime: contest.endTime.toISOString() }
      : null,
    timeline: (attempt?.activity?.timeline ?? [])
      .filter((point) => point.at <= submission.createdAt)
      .map((point) => ({ ...point, at: point.at.toISOString() })),
    snapshots: snapshots.map((s) => ({ _id: String(s._id), at: s.at.toISOString(), chars: s.chars })),
  };
}

/** One snapshot's code, if it belongs to this submission's attempt. */
export async function snapshotCode(submissionId: string, snapshotId: string): Promise<SnapshotCode> {
  const submission = await submissionFor(submissionId);
  const snapshot = isValidObjectId(snapshotId)
    ? await Snapshot.findOne({ _id: snapshotId, userId: submission.userId, projectId: submission.projectId }).lean()
    : null;
  if (!snapshot) throw new ContestError(404, 'Snapshot not found');
  return { html: snapshot.html, css: snapshot.css, js: snapshot.js };
}
