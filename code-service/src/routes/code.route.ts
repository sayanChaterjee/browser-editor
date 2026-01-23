import { Router, Request, Response } from 'express';
import { verifyToken } from '../middlewares/auth.middleware';
import Project from '../models/project.model';
import { z } from 'zod';
import redis from '../config/redis';
import logger from '../config/logger';

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
    const cacheKey = `user:projects:${userId}`;

    const cachedProjects = await redis.get(cacheKey);
    if (cachedProjects) {
      logger.info('[GET /api/v1/code] Returning projects from cache');
      const parsed = JSON.parse(cachedProjects);
      if (Array.isArray(parsed)) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        return res.json(parsed);
      }
      logger.warn('[GET /api/v1/code] Cached projects is not an array, discarding...');
      await redis.del(cacheKey);
    }

    logger.info(`[GET /api/v1/code] Fetching projects from MongoDB for userId: ${userId}`);
    const projects = await Project.find({ userId }).sort({ updatedAt: -1 });

    // Store in cache for 5 minutes (list is more dynamic)
    await redis.set(cacheKey, JSON.stringify(projects), 'EX', 300);

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.json(projects);
  } catch (error) {
    logger.error('[GET /api/v1/code] Error:', error);
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

import { sanitizeCode } from '../middlewares/sanitizer.middleware';
import { conflictLock } from '../middlewares/lock.middleware';

// POST /save - Create or update a project (Write-Behind Pattern)
codeRouter.post('/save', verifyToken, sanitizeCode, conflictLock, async (req: Request, res: Response): Promise<any> => {
  try {
    const { name, html, css, js, timeLeft } = projectSchema.parse(req.body);
    const userId = req.userId!;

    // 1. Identify or Create Project ID
    let project = await Project.findOne({ userId, name });
    let projectId = project?._id.toString();

    // 2. Write-Behind Cache Update
    const projectData = {
      userId,
      name,
      html,
      css,
      js,
      timeLeft,
      updatedAt: new Date().toISOString()
    };

    // If project doesn't exist yet, we must create it in DB once to get an ID
    // or we can generate a temporary UUID. For consistency, let's ensure it exists.
    if (!project) {
      project = await Project.create({ ...projectData });
      projectId = project._id.toString();
    }

    const projectCacheKey = `project:${projectId}`;
    const dirtyKey = `dirty_projects`;

    // Atomic update in Redis
    await redis.set(projectCacheKey, JSON.stringify({ ...projectData, _id: projectId }), 'EX', 3600);

    // Mark as dirty for the flusher worker
    await redis.sadd(dirtyKey, projectId as string);

    // 3. Version Control: Maintain last 5 Snapshots in Redis
    const snapshotKey = `project:${projectId}:snapshots`;
    const snapshot = JSON.stringify({ html, css, js, timestamp: new Date().toISOString() });
    await redis.lpush(snapshotKey, snapshot);
    await redis.ltrim(snapshotKey, 0, 4); // Keep only 5

    // 4. Invalidate List Cache
    const listCacheKey = `user:projects:${userId}`;
    await redis.del(listCacheKey);

    res.json({ ...projectData, _id: projectId, status: 'saved_to_cache' });
  } catch (error) {
    logger.error('[POST /api/v1/code/save] Error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

import Submission from '../models/submission.model';

// Existing routes...

import jsonpatch from 'fast-json-patch';

// PATCH /sync/:projectId - Incremental Sync (Delta Pattern)
codeRouter.patch('/sync/:projectId', verifyToken, sanitizeCode, conflictLock, async (req: Request, res: Response): Promise<any> => {
  try {
    const { projectId } = req.params;
    const { patches } = req.body; // Array of RFC6902 patches

    if (!Array.isArray(patches)) {
      return res.status(400).json({ message: 'Patches must be an array' });
    }

    const projectCacheKey = `project:${projectId}`;
    const dirtyKey = `dirty_projects`;

    // 1. Get current data (from cache or DB)
    let cachedData = await redis.get(projectCacheKey);
    let currentProject;

    if (cachedData) {
      currentProject = JSON.parse(cachedData);
    } else {
      currentProject = await Project.findById(projectId);
      if (!currentProject || currentProject.userId !== req.userId) {
        return res.status(404).json({ message: 'Project not found' });
      }
      currentProject = currentProject.toObject();
    }

    // 2. Apply Patches
    const result = jsonpatch.applyPatch(currentProject, patches);
    const updatedProject = result.newDocument;

    // Ensure userId didn't change (security check)
    updatedProject.userId = req.userId;
    updatedProject.updatedAt = new Date().toISOString();

    // 3. Write-Behind Update
    await redis.set(projectCacheKey, JSON.stringify(updatedProject), 'EX', 3600);
    await redis.sadd(dirtyKey, projectId as string);

    // 4. Snapshots (optional: every 10 patches or similar, but for now every sync)
    const snapshotKey = `project:${projectId}:snapshots`;
    const snapshot = JSON.stringify({
      html: updatedProject.html,
      css: updatedProject.css,
      js: updatedProject.js,
      timestamp: updatedProject.updatedAt
    });
    await redis.lpush(snapshotKey, snapshot);
    await redis.ltrim(snapshotKey, 0, 4);

    res.json({ ...updatedProject, status: 'synced_delta' });
  } catch (error: any) {
    logger.error('[PATCH /api/v1/code/sync] Error:', error);
    res.status(500).json({ message: 'Incremental sync failed', error: error.message });
  }
});

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

// DELETE /:projectId - Delete a project
codeRouter.delete('/:projectId', verifyToken, async (req: Request, res: Response): Promise<any> => {
  try {
    const { projectId } = req.params;
    const project = await Project.findOneAndDelete({ _id: projectId, userId: req.userId });

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Clear cache
    const projectCacheKey = `project:${projectId}`;
    const listCacheKey = `user:projects:${req.userId}`;
    await Promise.all([
      redis.del(projectCacheKey),
      redis.del(listCacheKey)
    ]);

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

export { codeRouter };
