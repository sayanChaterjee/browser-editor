import type { ClientSession } from 'mongoose';
import Contest, { IContest } from '../models/contest.model';
import Participant, { IParticipant } from '../models/participant.model';

/**
 * Contests run on their schedule. `status` is the admin's publish switch: 'pending' is a draft
 * nobody else sees, 'active' is published, 'ended' closes it early. Whether a published contest
 * is upcoming, live or over comes from its start and end times.
 *
 * Users join a contest's room before or during it; the question (the target to build) is only
 * handed out once it is live, so nobody can study it early.
 */

export type Phase = 'draft' | 'upcoming' | 'live' | 'ended';

// Submissions arriving this long after the end still count: the editor auto-submits at time-up
export const SUBMIT_GRACE_MS = 2 * 60_000;

type Schedule = Pick<IContest, 'status' | 'startTime' | 'endTime'>;

export function phaseOf(contest: Schedule, now = new Date()): Phase {
  if (contest.status === 'pending') return 'draft';
  if (contest.status === 'ended' || now >= contest.endTime) return 'ended';
  return now < contest.startTime ? 'upcoming' : 'live';
}

/** What users may see of a contest: never the question, which `question()` gives out when live. */
export function summary(contest: IContest, now = new Date()) {
  return {
    _id: String(contest._id),
    title: contest.title,
    startTime: contest.startTime.toISOString(),
    endTime: contest.endTime.toISOString(),
    phase: phaseOf(contest, now),
  };
}

export class ContestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function published(contestId: string): Promise<IContest> {
  const contest = await Contest.findById(contestId).catch(() => null);
  if (!contest || contest.status === 'pending') throw new ContestError(404, 'Contest not found');
  return contest;
}

/** Published contests for the contests page, with the user's own standing in each. */
export async function listForUser(userId: string, now = new Date()) {
  const contests = await Contest.find({ status: { $ne: 'pending' } }).sort({ startTime: -1 }).limit(100);
  const mine = await Participant.find({ userId, contestId: { $in: contests.map((c) => String(c._id)) } }).lean();
  const byContest = new Map(mine.map((p) => [p.contestId, p]));

  const rows = contests.map((contest) => {
    const me = byContest.get(String(contest._id));
    return { ...summary(contest, now), joined: !!me, submitted: !!me?.submittedAt };
  });
  const ofPhase = (phase: Phase) => rows.filter((row) => row.phase === phase);
  return {
    live: ofPhase('live'),
    // Soonest first
    upcoming: ofPhase('upcoming').reverse(),
    past: ofPhase('ended').slice(0, 20),
  };
}

/** The room: the contest's schedule, how many have joined, and the user's own place in it. */
export async function room(contestId: string, userId: string, now = new Date()) {
  const contest = await published(contestId);
  const [participants, me] = await Promise.all([
    Participant.countDocuments({ contestId }),
    Participant.findOne({ contestId, userId }).lean(),
  ]);
  return {
    contest: summary(contest, now),
    // Lets the browser correct its countdown for a wrong local clock
    serverTime: now.toISOString(),
    participants,
    me: me ? { joinedAt: me.joinedAt.toISOString(), projectId: me.projectId, submittedAt: me.submittedAt?.toISOString() ?? null } : null,
  };
}

/** Enter the room. Allowed until the contest ends; joining again changes nothing. */
export async function join(contestId: string, userId: string, now = new Date()) {
  const contest = await published(contestId);
  if (phaseOf(contest, now) === 'ended') throw new ContestError(409, 'This contest has ended');
  await Participant.updateOne(
    { contestId, userId },
    { $setOnInsert: { joinedAt: now, projectId: null, submittedAt: null } },
    { upsert: true },
  );
  return room(contestId, userId, now);
}

async function participant(contestId: string, userId: string): Promise<IParticipant> {
  const me = await Participant.findOne({ contestId, userId }).lean();
  if (!me) throw new ContestError(403, 'Join the contest first');
  return me;
}

/** The target to build: only for participants, and only once the contest has started. */
export async function question(contestId: string, userId: string, now = new Date()) {
  const contest = await published(contestId);
  if (phaseOf(contest, now) === 'upcoming') throw new ContestError(403, 'The contest has not started yet');
  await participant(contestId, userId);
  return { imageUrl: contest.imageUrl ?? '', html: contest.html ?? '', css: contest.css ?? '', js: contest.js ?? '' };
}

/**
 * Links the project the user works in during the contest. The first one wins (a second tab
 * or a retry gets the existing one back), so each participant has exactly one.
 */
export async function setProject(contestId: string, userId: string, projectId: string, now = new Date()) {
  const contest = await published(contestId);
  if (phaseOf(contest, now) !== 'live') throw new ContestError(409, 'The contest is not live');
  await participant(contestId, userId);
  const linked = await Participant.findOneAndUpdate(
    { contestId, userId, projectId: null },
    { $set: { projectId } },
    { new: true },
  ).lean();
  return { projectId: linked?.projectId ?? (await participant(contestId, userId)).projectId };
}

/**
 * Checks a contest submission: the user joined, and it arrives while the contest is live (or
 * within the grace period after). Returns the contest it belongs to.
 */
export async function checkSubmission(contestId: string, userId: string, now = new Date()): Promise<IContest> {
  const contest = await published(contestId);
  const late = now.getTime() > contest.endTime.getTime() + SUBMIT_GRACE_MS;
  if (contest.status === 'ended' || late) throw new ContestError(409, 'This contest has ended');
  if (now < contest.startTime) throw new ContestError(409, 'The contest has not started yet');
  await participant(contestId, userId);
  return contest;
}

export async function markSubmitted(contestId: string, userId: string, now = new Date(), session?: ClientSession) {
  await Participant.updateOne({ contestId, userId, submittedAt: null }, { $set: { submittedAt: now } }, { session });
}

/** For the old single-page editor: the published contest that is live now, if any. */
export function liveContest(now = new Date()) {
  return Contest.findOne({ status: 'active', startTime: { $lte: now }, endTime: { $gt: now } }).sort({ startTime: 1 });
}
