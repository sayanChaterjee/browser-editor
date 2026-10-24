import { Router, Request, Response } from 'express';
import { verifyToken } from '../middlewares/auth.middleware';
import Project from '../models/project.model';
import { z } from 'zod';
import redis from '../config/redis';
import logger from '../config/logger';
import { cacheLookups } from '../config/metrics';

const codeRouter = Router();

// Schema for validation
const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required').optional(),
  html: z.string().optional(),
  css: z.string().optional(),
  js: z.string().optional(),
  timeLeft: z.number().optional(),
  timeTaken: z.number().optional(),
});

const BUFFER_FIELDS = ['html', 'css', 'js', 'updatedAt'] as const;
const PROJECT_ID_TTL = 3600;

// MongoDB (and the project caches built from it) lags behind the Redis write-behind
// buffer until the flusher runs, so reads overlay the buffered fragments on top.
async function withLatestEdits(projects: any[]): Promise<any[]> {
  if (projects.length === 0) return projects;

  const pipeline = redis.pipeline();
  projects.forEach((p) => pipeline.hgetall(`project:buffer:${p._id}`));
  const results = (await pipeline.exec()) || [];

  return projects.map((project, i) => {
    const [err, buffer] = results[i] as [Error | null, Record<string, string>];
    if (err || !buffer || buffer.userId !== project.userId) return project;

    const merged = { ...project };
    for (const field of BUFFER_FIELDS) {
      if (buffer[field] !== undefined) merged[field] = buffer[field];
    }
    return merged;
  });
}

// Resolves a project's id from its name without a MongoDB read on the hot save path.
async function findProjectId(userId: string, name: string): Promise<string | undefined> {
  const idsKey = `user:project-ids:${userId}`;
  const cachedId = await redis.hget(idsKey, name);
  if (cachedId) return cachedId;

  const project = await Project.findOne({ userId, name }, { _id: 1 }).lean();
  return project?._id.toString();
}

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
        cacheLookups.inc({ cache: 'list', result: 'hit' });
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        return res.json(await withLatestEdits(parsed));
      }
      logger.warn('[GET /api/v1/code] Cached projects is not an array, discarding...');
      await redis.del(cacheKey);
    }

    cacheLookups.inc({ cache: 'list', result: 'miss' });
    logger.info(`[GET /api/v1/code] Fetching projects from MongoDB for userId: ${userId}`);
    const projects = (await Project.find({ userId }).sort({ updatedAt: -1 })).map((p) => p.toJSON());

    // Store in cache for 5 minutes (list is more dynamic)
    await redis.set(cacheKey, JSON.stringify(projects), 'EX', 300);

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.json(await withLatestEdits(projects));
  } catch (error) {
    logger.error('[GET /api/v1/code] Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /submissions - Get all user's previous submissions
codeRouter.get('/submissions', verifyToken, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.userId!;
    const submissions = await Submission.find({ userId }).sort({ createdAt: -1 });
    res.json(submissions);
  } catch (error) {
    logger.error('[GET /api/v1/code/submissions] Error:', error);
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
    logger.error('[GET /api/v1/code/submissions/:projectId] Error:', error);
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
      const parsed = JSON.parse(cachedProject);
      // STRICT OWNERSHIP CHECK: Ensure cached project belongs to the current user
      if (parsed.userId === req.userId) {
        cacheLookups.inc({ cache: 'project', result: 'hit' });
        const [latest] = await withLatestEdits([parsed]);
        return res.json(latest);
      }
      logger.warn(`[GET /api/v1/code/:projectId] Cache hit for ${projectId} but userId mismatch. Purging stale cache.`);
      await redis.del(cacheKey);
    }

    cacheLookups.inc({ cache: 'project', result: 'miss' });
    const project = await Project.findById(projectId);

    if (!project || project.userId !== req.userId) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Cache result
    const projectJson = project.toJSON();
    await redis.set(cacheKey, JSON.stringify(projectJson), 'EX', 3600);

    const [latest] = await withLatestEdits([projectJson]);
    res.json(latest);
  } catch (error) {
    logger.error(`[GET /api/v1/code/:projectId] Error for projectId ${req.params.projectId}:`, error);
    res.status(500).json({ message: 'Server error' });
  }
});

import { conflictLock } from '../middlewares/lock.middleware';

// POST /save - Create or update a project (Write-Behind Pattern)
codeRouter.post('/save', verifyToken, conflictLock, async (req: Request, res: Response): Promise<any> => {
  try {
    const { name, html, css, js, timeLeft } = projectSchema.parse(req.body);
    const userId = req.userId!;

    if (!name) {
      return res.status(400).json({ message: 'Project name is required' });
    }

    // 1. Identify or Create Project ID (Redis first, MongoDB only on a miss)
    let projectId = await findProjectId(userId, name);

    // 2. Write-Behind Cache Update: Store fragments in a Redis Hash
    const fragments = {
      html: html || '',
      css: css || '',
      js: js || '',
      updatedAt: new Date().toISOString()
    };

    // If project doesn't exist yet, we must create it in DB once to get an ID
    if (!projectId) {
      const project = await Project.create({
        userId,
        name,
        ...fragments,
        timeLeft
      });
      projectId = project._id.toString();
    }

    const bufferKey = `project:buffer:${projectId}`;
    const snapshotKey = `project:${projectId}:snapshots`;
    const idsKey = `user:project-ids:${userId}`;
    const snapshot = JSON.stringify({ ...fragments, timestamp: fragments.updatedAt });

    // All cache writes in one atomic round trip
    await redis
      .multi()
      .hset(bufferKey, { ...fragments, userId })
      .expire(bufferKey, 3600)
      .sadd('dirty_projects', projectId) // picked up by the flusher worker
      .lpush(snapshotKey, snapshot) // 3. Version Control: keep the last 5 snapshots
      .ltrim(snapshotKey, 0, 4)
      .hset(idsKey, name, projectId)
      .expire(idsKey, PROJECT_ID_TTL)
      .del(`user:projects:${userId}`) // 4. Invalidate List Cache
      .exec();

    res.json({ ...fragments, userId, name, _id: projectId, status: 'saved_to_cache' });
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
codeRouter.patch('/sync/:projectId', verifyToken, conflictLock, async (req: Request, res: Response): Promise<any> => {
  try {
    const { projectId } = req.params;
    const { patches, html, css, js } = req.body;

    if (!Array.isArray(patches) && html === undefined && css === undefined && js === undefined) {
      return res.status(400).json({ message: 'Invalid sync data: either patches or fragments must be provided' });
    }

    const bufferKey = `project:buffer:${projectId}`;
    const dirtyKey = `dirty_projects`;

    // 1. Ownership Check (Cache First)
    let currentData = await redis.hgetall(bufferKey);

    if (Object.keys(currentData).length > 0) {
      if (currentData.userId !== req.userId) {
        logger.warn(`[PATCH /api/v1/code/sync/:projectId] User mismatch for ${projectId}. Denying sync.`);
        return res.status(404).json({ message: 'Project not found' });
      }
    } else {
      const project = await Project.findById(projectId);
      if (!project || project.userId !== req.userId) {
        return res.status(404).json({ message: 'Project not found' });
      }
      currentData = {
        html: project.html,
        css: project.css,
        js: project.js,
        userId: project.userId,
        updatedAt: project.updatedAt.toISOString()
      };
      // Backfill cache
      await redis.hset(bufferKey, currentData);
    }

    // 2. Perform Update
    let updatedFragments: any = {};

    if (html !== undefined || css !== undefined || js !== undefined) {
      // Partial update via direct fields
      if (html !== undefined) updatedFragments.html = html;
      if (css !== undefined) updatedFragments.css = css;
      if (js !== undefined) updatedFragments.js = js;
      updatedFragments.updatedAt = new Date().toISOString();

      await redis.hset(bufferKey, updatedFragments);
    } else if (Array.isArray(patches)) {
      // RFC6902 patches
      const result = jsonpatch.applyPatch(currentData, patches);
      updatedFragments = result.newDocument;
      updatedFragments.updatedAt = new Date().toISOString();

      await redis.hset(bufferKey, updatedFragments);
    } else {
      return res.status(400).json({ message: 'Invalid sync data' });
    }

    // 3. Mark as dirty
    await redis.sadd(dirtyKey, projectId as string);

    // 4. Snapshots
    const snapshotKey = `project:${projectId}:snapshots`;
    const snapshot = JSON.stringify({
      html: updatedFragments.html,
      css: updatedFragments.css,
      js: updatedFragments.js,
      timestamp: updatedFragments.updatedAt
    });
    await redis.lpush(snapshotKey, snapshot);
    await redis.ltrim(snapshotKey, 0, 4);

    res.json({ ...updatedFragments, status: 'synced_fragment' });
  } catch (error: any) {
    logger.error('[PATCH /api/v1/code/sync] Error:', error);
    res.status(500).json({ message: 'Incremental sync failed', error: error.message });
  }
});

import { CodeUtils } from '../utils/codeUtils';

// GET /preview/:projectId - Get assembled HTML preview for the iframe
codeRouter.get('/preview/:projectId', verifyToken, async (req: Request, res: Response): Promise<any> => {
  try {
    const { projectId } = req.params;
    const bufferKey = `project:buffer:${projectId}`;
    let projectContext = await redis.hgetall(bufferKey);

    if (Object.keys(projectContext).length === 0) {
      const dbProject = await Project.findById(projectId);
      if (!dbProject) return res.status(404).send('Project not found');
      // Ownership check for DB fetched project
      if (dbProject.userId !== req.userId) {
        return res.status(404).json({ message: 'Project not found' });
      }
      projectContext = {
        html: dbProject.html,
        css: dbProject.css,
        js: dbProject.js,
        userId: dbProject.userId // Store userId for consistency, though not strictly needed for preview generation
      };
    } else {
      // Ownership check for buffer fetched project
      if (projectContext.userId !== req.userId) {
        logger.warn(`[GET /api/v1/code/preview/:projectId] User mismatch for ${projectId} in buffer. Denying preview.`);
        return res.status(404).json({ message: 'Project not found' });
      }
    }

    const fullHtml = CodeUtils.generateFullPreview(
      projectContext.html || '',
      projectContext.css || '',
      projectContext.js || ''
    );

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(fullHtml);
  } catch (error) {
    logger.error('[GET /api/v1/code/preview] Error:', error);
    res.status(500).json({ message: 'Failed to generate preview' });
  }
});

// POST /warning/:projectId - Increment a warning counter
codeRouter.post('/warning/:projectId', verifyToken, async (req: Request, res: Response): Promise<any> => {
  try {
    const { projectId } = req.params;
    const userId = req.userId!;

    const project = await Project.findOneAndUpdate(
      { _id: projectId, userId },
      { $inc: { warningCount: 1 } },
      { new: true }
    );

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    await redis.del(`project:${projectId}`);

    logger.info(`Warning count incremented for project ${projectId}: ${project.warningCount}`);
    res.json({ warningCount: project.warningCount });
  } catch (error) {
    logger.error('Error incrementing project warning count:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /submit - Submit a snapshot of the current code
codeRouter.post('/submit', verifyToken, async (req: Request, res: Response): Promise<any> => {
  try {
    const { html, css, js, timeLeft, timeTaken } = projectSchema.parse(req.body);
    const { projectId } = req.body;
    const userId = req.userId!;

    if (!projectId) {
      return res.status(400).json({ message: 'projectId is required' });
    }

    const project = await Project.findOne({ _id: projectId, userId });

    const submission = await Submission.create({
      userId,
      projectId,
      html,
      css,
      js,
      timeLeft,
      timeTaken: timeTaken || 0,
      warningCount: project ? project.warningCount : 0
    });

    res.status(201).json(submission);
  } catch (error) {
    logger.error('[POST /api/v1/code/submit] Error:', error);
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
      redis.del(listCacheKey),
      redis.hdel(`user:project-ids:${req.userId}`, project.name)
    ]);

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// --- ADMIN ROUTES ---

import { config } from '../config';

// GET /admin/projects/:userId - Get all projects for any user (for admin dashboard)
codeRouter.get('/admin/projects/:userId', verifyToken, async (req: Request, res: Response): Promise<any> => {
  try {
    const userEmail = ((req as any).userEmail || '').toLowerCase();
    if (!config.ADMIN_EMAILS.includes(userEmail)) {
      logger.warn(`Unauthorized access attempt to admin projects by ${userEmail}`);
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }

    const { userId } = req.params;
    const projects = await Project.find({ userId }).sort({ updatedAt: -1 });
    res.json(projects);
  } catch (error) {
    logger.error(`[GET /api/v1/code/admin/projects/${req.params.userId}] Error:`, error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /admin/submissions/:userId - Get all submissions for any user (for admin dashboard)
codeRouter.get('/admin/submissions/:userId', verifyToken, async (req: Request, res: Response): Promise<any> => {
  try {
    const userEmail = ((req as any).userEmail || '').toLowerCase();
    if (!config.ADMIN_EMAILS.includes(userEmail)) {
      logger.warn(`Unauthorized access attempt to admin submissions by ${userEmail}`);
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }

    const { userId } = req.params;
    const submissions = await Submission.find({ userId }).sort({ createdAt: -1 });
    res.json(submissions);
  } catch (error) {
    logger.error(`[GET /api/v1/code/admin/submissions/${req.params.userId}] Error:`, error);
    res.status(500).json({ message: 'Server error' });
  }
});

export { codeRouter };
