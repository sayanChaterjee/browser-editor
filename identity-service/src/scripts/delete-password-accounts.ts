/**
 * One-off cleanup when sign-in became Google-only: deletes the users who could only sign in
 * with a username and password (a "credential" account and no Google account), with everything
 * they own in each service's database. Users with a Google account are kept, as are the
 * addresses in ADMIN_EMAILS.
 *
 * Dry run by default (lists who would go and how much data); pass --apply to delete.
 * Re-running is safe: users already deleted are simply not found.
 *
 *   AUTH_DATABASE_URL=mongodb://.../ceditor_auth CODE_DATABASE_URL=mongodb://.../ceditor_code \
 *   CONTEST_DATABASE_URL=mongodb://.../ceditor_contest ADMIN_EMAILS=you@gmail.com \
 *     node dist/scripts/delete-password-accounts.js [--apply]
 *
 * The gateway may keep a deleted user's cached session for up to 5 minutes; their projects and
 * sign-in are gone at once.
 */
import { Db, MongoClient, ObjectId } from 'mongodb';

const apply = process.argv.includes('--apply');
const urls = {
  auth: process.env.AUTH_DATABASE_URL,
  code: process.env.CODE_DATABASE_URL,
  contest: process.env.CONTEST_DATABASE_URL,
};
const protectedEmails = new Set(
  (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
);

// What each service stores per user (userId as a string outside the auth database)
const OWNED: Record<'code' | 'contest', string[]> = {
  code: ['projects', 'submissions'], // submissions: left over from before the contest-service split
  contest: ['submissions', 'participants', 'attempts'],
};

/** Users with a password account and no other way to sign in. */
export async function passwordOnlyUsers(auth: Db, protect: Set<string>) {
  const credentialUserIds = await auth.collection('account').distinct('userId', { providerId: 'credential' });
  const otherUserIds = new Set(
    (await auth.collection('account').distinct('userId', { providerId: { $ne: 'credential' } })).map(String),
  );
  const users = await auth
    .collection('user')
    .find({ _id: { $in: credentialUserIds.filter((id) => !otherUserIds.has(String(id))) } }, { projection: { name: 1, email: 1 } })
    .toArray();
  const kept = users.filter((u) => protect.has(String(u.email).toLowerCase()));
  return { doomed: users.filter((u) => !kept.includes(u)), kept };
}

export async function deletePasswordAccounts(dbs: { auth: Db; code: Db; contest: Db }, protect: Set<string>, write: boolean) {
  const { doomed, kept } = await passwordOnlyUsers(dbs.auth, protect);
  const ids = doomed.map((u) => u._id as ObjectId);
  const idStrings = ids.map(String);
  const counts: Record<string, number> = { users: doomed.length };

  const authFilter = { userId: { $in: ids } };
  for (const collection of ['account', 'session']) {
    counts[`auth.${collection}`] = write
      ? (await dbs.auth.collection(collection).deleteMany(authFilter)).deletedCount
      : await dbs.auth.collection(collection).countDocuments(authFilter);
  }
  for (const service of ['code', 'contest'] as const) {
    for (const collection of OWNED[service]) {
      const filter = { userId: { $in: idStrings } };
      counts[`${service}.${collection}`] = write
        ? (await dbs[service].collection(collection).deleteMany(filter)).deletedCount
        : await dbs[service].collection(collection).countDocuments(filter);
    }
  }
  // Users last, so a run interrupted halfway can be repeated and still find them
  if (write) await dbs.auth.collection('user').deleteMany({ _id: { $in: ids } });
  return { doomed, kept, counts };
}

async function main() {
  if (!urls.auth || !urls.code || !urls.contest) {
    console.error('Set AUTH_DATABASE_URL, CODE_DATABASE_URL and CONTEST_DATABASE_URL (and ADMIN_EMAILS to protect admins)');
    process.exit(1);
  }
  const clients = await Promise.all([urls.auth, urls.code, urls.contest].map((url) => MongoClient.connect(url!)));
  try {
    const [auth, code, contest] = clients.map((client) => client.db());
    console.log(`${apply ? 'APPLY' : 'DRY RUN'}: ${auth.databaseName}, ${code.databaseName}, ${contest.databaseName}`);
    const { doomed, kept, counts } = await deletePasswordAccounts({ auth, code, contest }, protectedEmails, apply);

    for (const user of doomed.slice(0, 50)) console.log(`  - ${user.name} <${user.email}>`);
    if (doomed.length > 50) console.log(`  ... and ${doomed.length - 50} more`);
    for (const user of kept) console.log(`  kept (admin): ${user.name} <${user.email}>`);
    console.log(`  ${apply ? 'deleted' : 'would delete'}:`);
    for (const [what, n] of Object.entries(counts)) console.log(`    ${what}: ${n}`);
    if (!apply) console.log('Nothing changed. Run again with --apply to delete.');
  } finally {
    await Promise.all(clients.map((client) => client.close()));
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
