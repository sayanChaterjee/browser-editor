import { Router, Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { createSubmission, recordStrike } from '../domain/attempts';
import { publishContestEvent } from '../events/publisher';
import Submission from '../models/submission.model';
import logger from '../config/logger';
import { strikesRecorded, submissionsCreated } from '../config/metrics';
import { requireAdmin, requireUser } from '../middlewares/userContext.middleware';

// Submissions and anti-cheat strikes. The frontend still calls the old code-service paths
// (/api/v1/code/submit, /warning/:id, /admin/submissions/:id); the gateway maps them here.

const attemptRouter = Router();
attemptRouter.use(requireUser);

const submissionSchema = z.object({
  projectId: z.string().refine(isValidObjectId, 'projectId must be a project id'),
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
  const submission = await createSubmission({ ...parsed.data, userId: req.userContext!.id }, publishContestEvent);
  submissionsCreated.inc();
  logger.info(`Submission ${submission._id} for project ${submission.projectId}`);
  res.status(201).json(submission);
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
