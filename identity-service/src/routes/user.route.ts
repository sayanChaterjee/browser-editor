import { Router, Request, Response } from 'express';
import { forgetUserSessions } from '@ceditor/common';
import { getAuth } from '../lib/auth';
import redis from '../config/redis';
import logger from '../config/logger';
import { config } from '../config';
import { requireAdmin, requireUser } from '../middlewares/userContext.middleware';
import { publishUserEvent } from '../events/publisher';

// Users are Better Auth's own records; its internal adapter handles ID conversion and
// keeps its session cache consistent, so all access goes through it.
const users = async () => (await getAuth().$context).internalAdapter;

// Response shape the frontend expects (`_id` kept for the admin UI)
const toUserResponse = (user: any) => ({
  _id: user.id,
  id: user.id,
  name: user.name,
  email: user.email,
  image: user.image ?? null,
  warningCount: user.warningCount ?? 0,
  banned: user.banned ?? false,
  createdAt: user.createdAt,
});

const userRouter = Router();
userRouter.use(requireUser);

userRouter.get('/profile', async (req: Request, res: Response): Promise<any> => {
  const user = await (await users()).findUserById(req.userContext!.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ ...toUserResponse(user), isAdmin: req.userContext!.isAdmin });
});

// Admin: every user, newest first
userRouter.get('/all', requireAdmin, async (req: Request, res: Response) => {
  const all = await (await users()).listUsers(1000, 0, { field: 'createdAt', direction: 'desc' });
  res.json(all.map(toUserResponse));
});

userRouter.post('/warning/:userId', requireAdmin, async (req: Request, res: Response): Promise<any> => {
  const adapter = await users();
  const user = await adapter.findUserById(req.params.userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const updated = await adapter.updateUser(user.id, { warningCount: ((user as any).warningCount ?? 0) + 1 });
  logger.info(`Warning count for user ${user.id}: ${updated.warningCount}`);
  res.json({ warningCount: updated.warningCount });
});

/**
 * Ban: blocks new sign-ins (database hook in lib/auth), deletes the user's sessions and
 * clears them from the gateway's session cache, so their next request is rejected. Then
 * announces user.banned.v1 for other services (code-service disqualifies submissions).
 */
userRouter.post('/admin/:userId/ban', requireAdmin, async (req: Request, res: Response): Promise<any> => {
  const adapter = await users();
  const user = await adapter.findUserById(req.params.userId);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (config.ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    return res.status(400).json({ message: 'Admins cannot be banned' });
  }

  await adapter.updateUser(user.id, { banned: true });
  await adapter.deleteUserSessions(user.id);
  try {
    await forgetUserSessions(redis, user.id);
  } catch (err: any) {
    // The gateway reads the same Redis, so while it's down it can't serve cached sessions either
    logger.warn(`Could not clear cached sessions for ${user.id}: ${err.message}`);
  }

  publishUserEvent('user.banned.v1', {
    userId: user.id,
    bannedBy: req.userContext!.id,
    bannedAt: new Date().toISOString(),
  });
  logger.info(`User ${user.id} banned by ${req.userContext!.email}`);
  res.json({ ...toUserResponse(user), banned: true });
});

userRouter.post('/admin/:userId/unban', requireAdmin, async (req: Request, res: Response): Promise<any> => {
  const adapter = await users();
  const user = await adapter.findUserById(req.params.userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  await adapter.updateUser(user.id, { banned: false });
  publishUserEvent('user.unbanned.v1', {
    userId: user.id,
    unbannedBy: req.userContext!.id,
    unbannedAt: new Date().toISOString(),
  });
  logger.info(`User ${user.id} unbanned by ${req.userContext!.email}`);
  res.json({ ...toUserResponse(user), banned: false });
});

export { userRouter };
