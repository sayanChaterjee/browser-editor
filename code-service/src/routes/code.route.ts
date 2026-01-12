import { Router, Request, Response } from 'express';
import { verifyToken } from '../middlewares/auth.middleware';
import Project from '../models/project.model';
import { z } from 'zod';
import redis from '../config/redis';

const codeRouter = Router();

// Schema for validation
const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required').optional(),
  html: z.string().optional(),
  css: z.string().optional(),
  js: z.string().optional(),
  timeLeft: z.number().optional(),
});

// GET / - Get all user's projects
codeRouter.get('/', verifyToken, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.userId!;
    const projects = await Project.find({ userId }).sort({ updatedAt: -1 });
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /:projectId - Get a specific project (Cache First)
codeRouter.get('/:projectId', verifyToken, async (req: Request, res: Response): Promise<any> => {
  try {
    const { projectId } = req.params;
    const cacheKey = `project:${projectId}`;

    // Check cache
    const cachedProject = await redis.get(cacheKey);
    if (cachedProject) {
      return res.json(JSON.parse(cachedProject));
    }

    const project = await Project.findById(projectId);

    if (!project || project.userId !== req.userId) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Cache result
    await redis.set(cacheKey, JSON.stringify(project), 'EX', 3600);

    res.json(project);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /save - Create or update a project
codeRouter.post('/save', verifyToken, async (req: Request, res: Response): Promise<any> => {
  try {
    const { name, html, css, js, timeLeft } = projectSchema.parse(req.body);
    const userId = req.userId!;

    if (!name) {
      return res.status(400).json({ message: 'Project name is required for saving' });
    }

    const project = await Project.findOneAndUpdate(
      { userId, name },
      { html, css, js, timeLeft },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Update cache using name-based key or ID
    const cacheKey = `project:${project._id}`;
    await redis.set(cacheKey, JSON.stringify(project), 'EX', 3600);

    res.json(project);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

import Submission from '../models/submission.model';

// Existing routes...

// GET /submissions - Get all user's previous submissions
codeRouter.get('/submissions', verifyToken, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.userId!;
    const submissions = await Submission.find({ userId }).sort({ createdAt: -1 });
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /submissions/:projectId - Get submissions for a specific project
codeRouter.get('/submissions/:projectId', verifyToken, async (req: Request, res: Response): Promise<any> => {
  try {
    const { projectId } = req.params;
    const submissions = await Submission.find({ projectId, userId: req.userId }).sort({ createdAt: -1 });
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /submit - Submit a snapshot of the current code
codeRouter.post('/submit', verifyToken, async (req: Request, res: Response): Promise<any> => {
  try {
    const { html, css, js, timeLeft } = projectSchema.parse(req.body);
    const { projectId } = req.body;
    const userId = req.userId!;

    if (!projectId) {
      return res.status(400).json({ message: 'projectId is required' });
    }

    const submission = await Submission.create({
      userId,
      projectId,
      html,
      css,
      js,
      timeLeft
    });

    res.status(201).json(submission);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

export { codeRouter };
