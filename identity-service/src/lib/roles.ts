import mongoose from 'mongoose';
import { config } from '../config';
import logger from '../config/logger';

/**
 * Roles: every user is a "user" or an "admin", stored on the user record and carried to the
 * other services as a claim in the gateway's signed user token. Admins promote and demote each
 * other from the admin page.
 *
 * ADMIN_EMAILS (identity-service only) names the owners: always admins, never demoted or
 * banned, so the app can't end up without one. It is applied when an owner signs up and at
 * every start (for owners who already have an account).
 */

export const isOwner = (email: string | null | undefined) => config.ADMIN_EMAILS.includes((email ?? '').toLowerCase());

/** Gives the owners the admin role (Better Auth's "user" collection; emails are stored lower-case). */
export async function syncOwnerRoles(): Promise<void> {
  if (config.ADMIN_EMAILS.length === 0) return;
  const result = await mongoose.connection.db!
    .collection('user')
    .updateMany({ email: { $in: config.ADMIN_EMAILS }, role: { $ne: 'admin' } }, { $set: { role: 'admin' } });
  if (result.modifiedCount > 0) logger.info(`Gave the admin role to ${result.modifiedCount} owner account(s)`);
}
