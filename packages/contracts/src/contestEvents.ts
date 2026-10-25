import { z } from 'zod';
import { envelope } from './envelope';

// Published by contest-service on TOPICS.contestEvents, keyed by userId.

/** An anti-cheat strike (e.g. the user left the contest tab). strikeCount is the new total. */
export const StrikeRecordedV1 = envelope(
  'strike.recorded.v1',
  z.object({
    userId: z.string().min(1),
    projectId: z.string().min(1),
    strikeCount: z.number().int().nonnegative(),
    recordedAt: z.string().datetime(),
  }),
);

/** A contest entry was submitted. */
export const SubmissionCreatedV1 = envelope(
  'submission.created.v1',
  z.object({
    submissionId: z.string().min(1),
    userId: z.string().min(1),
    projectId: z.string().min(1),
    // The contest that was active when it was submitted, if any
    contestId: z.string().nullable(),
    timeTakenSeconds: z.number().nonnegative(),
    strikeCount: z.number().int().nonnegative(),
    submittedAt: z.string().datetime(),
  }),
);

export const ContestEvent = z.discriminatedUnion('type', [StrikeRecordedV1, SubmissionCreatedV1]);

export type StrikeRecordedV1 = z.infer<typeof StrikeRecordedV1>;
export type SubmissionCreatedV1 = z.infer<typeof SubmissionCreatedV1>;
export type ContestEvent = z.infer<typeof ContestEvent>;
