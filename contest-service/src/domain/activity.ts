import Attempt, { IActivity } from '../models/attempt.model';
import type { Flag, ISignals } from '../models/submission.model';

/**
 * Contest activity reported by the editor, and how a submission is judged from it.
 *
 * None of this is proof on its own: a reviewer sees the numbers and the flags next to the
 * code. The point is that the server keeps a record the browser can't take back, and that
 * blocking or faking the reports leaves traces too (missing heartbeats, code without typing).
 */

// The editor reports every HEARTBEAT_SECONDS; a longer silence than GAP_SECONDS is a gap
export const HEARTBEAT_SECONDS = 15;
const GAP_SECONDS = 45;

export const THRESHOLDS = {
  // Contests shorter than this don't get the heartbeat check
  minSecondsForHeartbeatCheck: 120,
  missingHeartbeatShare: 0.5,
  offlineSeconds: 120,
  largePasteChars: 300,
  unexplainedChars: 200,
  similarity: 0.8,
};

export interface ActivityDelta {
  typedChars: number;
  pastedChars: number;
  pasteCount: number;
  largestPaste: number;
  // Sent with the first heartbeat: the code's size when the contest started
  startChars?: number;
  // The code's size now (every heartbeat): the replay's size-over-time line
  codeChars?: number;
}

// Heartbeats kept per attempt for the replay: 15 s apart, so over 4 hours
export const MAX_TIMELINE = 1000;

const field = (name: keyof IActivity, fallback: unknown = 0) => ({ $ifNull: [`$activity.${name}`, fallback] });

/**
 * Adds one heartbeat to the user's attempt. One atomic update: MongoDB measures the time since
 * the previous heartbeat itself, so concurrent requests can't miscount a gap.
 */
export async function recordActivity(userId: string, projectId: string, delta: ActivityDelta, now = new Date()): Promise<IActivity> {
  const sinceLast = { $divide: [{ $subtract: [now, '$activity.lastHeartbeatAt'] }, 1000] };
  const late = { $and: [{ $ne: [field('lastHeartbeatAt', null), null] }, { $gt: [sinceLast, GAP_SECONDS] }] };

  const attempt = await Attempt.findOneAndUpdate(
    { userId, projectId },
    [
      {
        $set: {
          activity: {
            heartbeats: { $add: [field('heartbeats'), 1] },
            lastHeartbeatAt: now,
            gaps: { $add: [field('gaps'), { $cond: [late, 1, 0] }] },
            offlineSeconds: {
              $add: [field('offlineSeconds'), { $cond: [late, { $round: [{ $subtract: [sinceLast, HEARTBEAT_SECONDS] }, 0] }, 0] }],
            },
            startChars: { $ifNull: ['$activity.startChars', delta.startChars ?? null] },
            typedChars: { $add: [field('typedChars'), delta.typedChars] },
            pastedChars: { $add: [field('pastedChars'), delta.pastedChars] },
            pasteCount: { $add: [field('pasteCount'), delta.pasteCount] },
            largestPaste: { $max: [field('largestPaste'), delta.largestPaste] },
            timeline: {
              $slice: [
                {
                  $concatArrays: [
                    field('timeline', []),
                    [{ at: now, typed: delta.typedChars, pasted: delta.pastedChars, largestPaste: delta.largestPaste, chars: delta.codeChars ?? null }],
                  ],
                },
                -MAX_TIMELINE,
              ],
            },
          },
        },
      },
    ],
    { upsert: true, new: true, updatePipeline: true },
  ).lean();
  return attempt!.activity!;
}

interface Assessment {
  activity: IActivity | null | undefined;
  timeTakenSeconds: number;
  finalChars: number;
  similarity: ISignals['similarity'];
  targetSimilarity: number;
}

/** The signals stored on a submission, and the flags they raise. */
export function assessSubmission({ activity, timeTakenSeconds, finalChars, similarity, targetSimilarity }: Assessment): {
  signals: ISignals;
  flags: Flag[];
} {
  const a = activity ?? null;
  const typedChars = a?.typedChars ?? 0;
  const pastedChars = a?.pastedChars ?? 0;
  // Without a starting size (no heartbeat ever arrived) this can't be judged; missing
  // heartbeats are flagged instead
  const unexplainedChars = a?.startChars != null ? Math.max(0, finalChars - a.startChars - typedChars - pastedChars) : 0;

  const signals: ISignals = {
    heartbeats: a?.heartbeats ?? 0,
    expectedHeartbeats: Math.floor(timeTakenSeconds / HEARTBEAT_SECONDS),
    gaps: a?.gaps ?? 0,
    offlineSeconds: a?.offlineSeconds ?? 0,
    typedChars,
    pastedChars,
    pasteCount: a?.pasteCount ?? 0,
    largestPaste: a?.largestPaste ?? 0,
    unexplainedChars,
    similarity,
    targetSimilarity: Math.round(targetSimilarity * 100) / 100,
  };

  const flags: Flag[] = [];
  if (
    timeTakenSeconds >= THRESHOLDS.minSecondsForHeartbeatCheck &&
    signals.heartbeats < signals.expectedHeartbeats * THRESHOLDS.missingHeartbeatShare
  ) flags.push('missing-heartbeats');
  if (signals.offlineSeconds >= THRESHOLDS.offlineSeconds) flags.push('offline');
  if (signals.largestPaste >= THRESHOLDS.largePasteChars || pastedChars > Math.max(typedChars, 2 * THRESHOLDS.largePasteChars)) {
    flags.push('large-paste');
  }
  if (unexplainedChars >= THRESHOLDS.unexplainedChars) flags.push('code-without-typing');
  if (similarity && similarity.score >= THRESHOLDS.similarity) flags.push('similar-submission');
  if (signals.targetSimilarity >= THRESHOLDS.similarity) flags.push('matches-target');
  return { signals, flags };
}
