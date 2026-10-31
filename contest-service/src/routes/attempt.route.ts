import { Router, Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { createSubmission, recordStrike } from '../domain/attempts';
import { recordActivity } from '../domain/activity';
import { ContestError } from '../domain/contests';
import { publishContestEvent } from '../events/publisher';
import Submission from '../models/submission.model';
import logger from '../config/logger';
import { heartbeatsRecorded, strikesRecorded, submissionFlags, submissionsCreated } from '../config/metrics';
import { requireAdmin, requireUser } from '../middlewares/userContext.middleware';

// Submissions, anti-cheat strikes and contest heartbeats.

const attemptRouter = Router();
attemptRouter.use(requireUser);

const submissionSchema = z.object({
  projectId: z.string().refine(isValidObjectId, 'projectId must be a project id'),
  contestId: z.string().refine(isValidObjectId, 'contestId must be a contest id').optional(),
  html: z.string().optional(),
  css: z.string().optional(),
  js: z.string().optional(),
  timeLeft: z.number().optional(),
  timeTaken: z.number().optional(),
});

// POST /submissions - Submit a snapshot of the current code
attemptRouter.post('/submissions', async (req: Request, res: Response): Promise<any> => {
  const parsed = submissionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.errors });
  }
  let submission;
  try {
    submission = await createSubmission({ ...parsed.data, userId: req.userContext!.id }, publishContestEvent);
  } catch (error) {
    if (error instanceof ContestError) return res.status(error.status).json({ message: error.message });
    throw error;
  }
  submissionsCreated.inc();
  for (const flag of submission.flags) submissionFlags.inc({ flag });
  logger.info(`Submission ${submission._id} for project ${submission.projectId}${submission.flags.length ? ` flagged: ${submission.flags.join(', ')}` : ''}`);
  // The review evidence is for admins: telling contestants which signals they tripped would
  // teach them what to avoid
  const receipt: Record<string, unknown> = submission.toObject();
  for (const reviewOnly of ['signals', 'flags', 'fingerprint']) delete receipt[reviewOnly];
  res.status(201).json(receipt);
});

// Bounds per heartbeat (15 s): far above what anyone types, small enough to keep totals sane
const MAX_CHARS_PER_BEAT = 200_000;
const count = z.number().int().min(0).max(MAX_CHARS_PER_BEAT).default(0);
const activitySchema = z.object({
  typedChars: count,
  pastedChars: count,
  pasteCount: count,
  largestPaste: count,
  startChars: z.number().int().min(0).max(5_000_000).optional(),
});

// POST /activity/:projectId - Contest heartbeat: what was typed and pasted since the last one
attemptRouter.post('/activity/:projectId', async (req: Request, res: Response) => {
  const projectId = String(req.params.projectId);
  const parsed = activitySchema.safeParse(req.body ?? {});
  if (!isValidObjectId(projectId) || !parsed.success) {
    res.status(400).json({ message: 'Invalid activity report' });
    return;
  }
  await recordActivity(req.userContext!.id, projectId, parsed.data);
  heartbeatsRecorded.inc();
  res.status(204).end();
});

// POST /strikes/:projectId - Record an anti-cheat strike (e.g. the user left the contest tab)
attemptRouter.post('/strikes/:projectId', async (req: Request, res: Response): Promise<any> => {
  const projectId = String(req.params.projectId);
  if (!isValidObjectId(projectId)) {
    return res.status(400).json({ message: 'Invalid project id' });
  }
  const strikeCount = await recordStrike(req.userContext!.id, projectId, publishContestEvent);
  strikesRecorded.inc();
  logger.info(`Strike ${strikeCount} for project ${projectId}`);
  // Same response shape as the old code-service /warning route
  res.json({ warningCount: strikeCount });
});

// GET /admin/submissions/:userId - Every submission of a user (admin dashboard)
attemptRouter.get('/admin/submissions/:userId', requireAdmin, async (req: Request, res: Response) => {
  const submissions = await Submission.find({ userId: req.params.userId }).sort({ createdAt: -1 });
  res.json(submissions);
});

export { attemptRouter };
