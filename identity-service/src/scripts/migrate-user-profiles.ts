/**
 * One-off migration for the user-service -> identity-service merge: copies each profile's
 * warningCount from the old user-service database onto the matching Better Auth user.
 *
 * Dry run by default (prints what it would change); pass --apply to write. Safe to re-run:
 * it uses $max, so a count is never lowered and a second run changes nothing.
 *
 *   SOURCE_DATABASE_URL=mongodb://.../ceditor_user DATABASE_URL=mongodb://.../ceditor_auth \
 *     node dist/scripts/migrate-user-profiles.js [--apply]
 */
import { MongoClient, ObjectId } from 'mongodb';

const apply = process.argv.includes('--apply');
const sourceUrl = process.env.SOURCE_DATABASE_URL;
const targetUrl = process.env.DATABASE_URL;

async function main() {
  if (!sourceUrl || !targetUrl) {
    console.error('Set SOURCE_DATABASE_URL (old user-service DB) and DATABASE_URL (identity DB)');
    process.exit(1);
  }

  const source = await MongoClient.connect(sourceUrl);
  const target = await MongoClient.connect(targetUrl);
  try {
    const profiles = source.db().collection('user');
    const users = target.db().collection('user');
    console.log(`${apply ? 'APPLY' : 'DRY RUN'}: ${source.db().databaseName}.user -> ${target.db().databaseName}.user`);

    const stats = { profiles: 0, updated: 0, unchanged: 0, noWarnings: 0, missingUser: 0 };
    for await (const profile of profiles.find({}, { projection: { _id: 1, warningCount: 1 } })) {
      stats.profiles++;
      const id = String(profile._id);
      const warningCount = profile.warningCount ?? 0;
      if (warningCount === 0) {
        stats.noWarnings++;
        continue;
      }

      // Better Auth stores user ids as ObjectIds; user-service kept them as strings
      const user = ObjectId.isValid(id) ? await users.findOne({ _id: new ObjectId(id) }) : null;
      if (!user) {
        stats.missingUser++;
        console.log(`  skip ${id}: no identity user`);
        continue;
      }
      if ((user.warningCount ?? 0) >= warningCount) {
        stats.unchanged++;
        continue;
      }

      console.log(`  ${id}: warningCount ${user.warningCount ?? 0} -> ${warningCount}`);
      if (apply) {
        await users.updateOne({ _id: user._id }, { $max: { warningCount } });
      }
      stats.updated++;
    }

    console.log(stats);
    if (!apply && stats.updated > 0) console.log('Re-run with --apply to write these changes.');
  } finally {
    await source.close();
    await target.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
