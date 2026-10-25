import { Router, Request, Response } from 'express';
import { requireAdmin, requireUser } from '../middlewares/userContext.middleware';
import Contest from '../models/contest.model';
import { z } from 'zod';
import logger from '../config/logger';

const contestRouter = Router();
contestRouter.use(requireUser);

const createContestSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    startTime: z.string(),
    endTime: z.string(),
    imageUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
    html: z.string().optional(),
    css: z.string().optional(),
    js: z.string().optional(),
});

const updateStatusSchema = z.object({
    status: z.enum(['pending', 'active', 'ended']),
});

// GET /contest/active - Get the currently active contest (Public)
contestRouter.get('/active', async (req: Request, res: Response): Promise<any> => {
    try {
        const activeContest = await Contest.findOne({ status: 'active' });
        if (!activeContest) {
            return res.status(404).json({ message: 'No active contest' });
        }
        res.json(activeContest);
    } catch (error) {
        logger.error('[GET /api/v1/contest/active] Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /contest/all - Get all contests (Admin)
contestRouter.get('/all', requireAdmin, async (req: Request, res: Response): Promise<any> => {
    try {
        const contests = await Contest.find().sort({ createdAt: -1 });
        res.json(contests);
    } catch (error) {
        logger.error('[GET /api/v1/contest/all] Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /contest - Create a new contest (Admin)
contestRouter.post('/', requireAdmin, async (req: Request, res: Response): Promise<any> => {
    try {
        const data = createContestSchema.parse(req.body);
        const newContest = await Contest.create({
            title: data.title,
            startTime: new Date(data.startTime),
            endTime: new Date(data.endTime),
            imageUrl: data.imageUrl,
            html: data.html,
            css: data.css,
            js: data.js,
            status: 'pending' // default
        });
        res.status(201).json(newContest);
    } catch (error) {
        logger.error('[POST /api/v1/contest] Error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ errors: error.errors });
        }
        res.status(500).json({ message: 'Server error' });
    }
});

// PATCH /contest/:id/status - Update contest status (Admin)
contestRouter.patch('/:id/status', requireAdmin, async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const { status } = updateStatusSchema.parse(req.body);

        const contest = await Contest.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );

        if (!contest) {
            return res.status(404).json({ message: 'Contest not found' });
        }

        res.json(contest);
    } catch (error) {
        logger.error(`[PATCH /api/v1/contest/${req.params.id}/status] Error:`, error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ errors: error.errors });
        }
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /contest/:id - Update contest details (Admin)
contestRouter.put('/:id', requireAdmin, async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const data = createContestSchema.parse(req.body);

        const contest = await Contest.findByIdAndUpdate(
            id,
            {
                title: data.title,
                startTime: new Date(data.startTime),
                endTime: new Date(data.endTime),
                imageUrl: data.imageUrl,
                html: data.html,
                css: data.css,
                js: data.js,
            },
            { new: true }
        );

        if (!contest) {
            return res.status(404).json({ message: 'Contest not found' });
        }

        res.json(contest);
    } catch (error) {
        logger.error(`[PUT /api/v1/contest/${req.params.id}] Error:`, error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ errors: error.errors });
        }
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE /contest/:id - Delete a contest (Admin)
contestRouter.delete('/:id', requireAdmin, async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const contest = await Contest.findByIdAndDelete(id);

        if (!contest) {
            return res.status(404).json({ message: 'Contest not found' });
        }

        res.json({ message: 'Contest deleted successfully' });
    } catch (error) {
        logger.error(`[DELETE /api/v1/contest/${req.params.id}] Error:`, error);
        res.status(500).json({ message: 'Server error' });
    }
});

export { contestRouter };
