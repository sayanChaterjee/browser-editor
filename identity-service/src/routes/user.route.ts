import { Router, Request, Response } from 'express';
import { forgetUserSessions } from '@ceditor/common';
import { getAuth } from '../lib/auth';
import redis from '../config/redis';
import logger from '../config/logger';
import { requireAdmin, requireUser } from '../middlewares/userContext.middleware';
import mongoose, { ClientSession } from 'mongoose';
import { ObjectId } from 'mongodb';
import { outboxRelay, publishUserEvent } from '../events/publisher';
import { isOwner } from '../lib/roles';
import { z } from 'zod';

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
  role: user.role === 'admin' ? 'admin' : 'user',
  // Owners (ADMIN_EMAILS) are always admins: their role can't be changed, nor can they be banned
  isOwner: isOwner(user.email),
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
 * Sets the ban flag and saves the matching event in one transaction (transactional outbox), so
 * other services hear about every ban that happened and no other. Written to Better Auth's
 * "user" collection directly: its adapter can't take part in our transaction.
 */
async function setBanned(userId: string, banned: boolean, saveEvent: (session: ClientSession) => Promise<void>) {
  await mongoose.connection.transaction(async (session) => {
    await mongoose.connection.db!
      .collection('user')
      .updateOne({ _id: new ObjectId(userId) }, { $set: { banned, updatedAt: new Date() } }, { session });
    await saveEvent(session);
  });
  void outboxRelay.wake();
}

/**
 * Ban: blocks new sign-ins (database hook in lib/auth), deletes the user's sessions and
 * clears them from the gateway's session cache, so their next request is rejected. The
 * user.banned.v1 event (contest-service disqualifies submissions) commits with the flag.
 */
userRouter.post('/admin/:userId/ban', requireAdmin, async (req: Request, res: Response): Promise<any> => {
  const adapter = await users();
  const user = await adapter.findUserById(req.params.userId);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (isOwner(user.email) || (user as { role?: string }).role === 'admin') {
    return res.status(400).json({ message: 'Admins cannot be banned' });
  }

  await setBanned(user.id, true, (session) =>
    publishUserEvent('user.banned.v1', {
      userId: user.id,
      bannedBy: req.userContext!.id,
      bannedAt: new Date().toISOString(),
    }, session));
  await adapter.deleteUserSessions(user.id);
  try {
    await forgetUserSessions(redis, user.id);
  } catch (err: any) {
    // The gateway reads the same Redis, so while it's down it can't serve cached sessions either
    logger.warn(`Could not clear cached sessions for ${user.id}: ${err.message}`);
  }

  logger.info(`User ${user.id} banned by ${req.userContext!.email}`);
  res.json({ ...toUserResponse(user), banned: true });
});

userRouter.post('/admin/:userId/unban', requireAdmin, async (req: Request, res: Response): Promise<any> => {
  const adapter = await users();
  const user = await adapter.findUserById(req.params.userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  await setBanned(user.id, false, (session) =>
    publishUserEvent('user.unbanned.v1', {
      userId: user.id,
      unbannedBy: req.userContext!.id,
      unbannedAt: new Date().toISOString(),
    }, session));
  logger.info(`User ${user.id} unbanned by ${req.userContext!.email}`);
  res.json({ ...toUserResponse(user), banned: false });
});

const roleSchema = z.object({ role: z.enum(['user', 'admin']) });

/**
 * Promote or demote. Owners keep their role, and an admin can't drop their own (the app always
 * keeps an admin who can undo mistakes). The user's cached sessions are cleared, so their next
 * request carries the new role in its token.
 */
userRouter.post('/admin/:userId/role', requireAdmin, async (req: Request, res: Response) => {
  const refuse = (status: number, message: string) => res.status(status).json({ message });
  const parsed = roleSchema.safeParse(req.body);
  if (!parsed.success) return void refuse(400, 'role must be "user" or "admin"');
  const adapter = await users();
  const user = await adapter.findUserById(String(req.params.userId));
  if (!user) return void refuse(404, 'User not found');
  if (isOwner(user.email)) return void refuse(400, "An owner's role can't be changed");
  if (user.id === req.userContext!.id) return void refuse(400, "You can't change your own role");

  const updated = await adapter.updateUser(user.id, { role: parsed.data.role });
  try {
    await forgetUserSessions(redis, user.id);
  } catch (err) {
    logger.warn(`Could not clear cached sessions for ${user.id}: ${(err as Error).message}`);
  }
  logger.info(`User ${user.id} is now ${parsed.data.role} (by ${req.userContext!.email})`);
  res.json(toUserResponse(updated));
});

export { userRouter };
