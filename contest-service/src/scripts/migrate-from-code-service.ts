/**
 * One-off migration for the contest-service split: copies contests and submissions from
 * code-service's database, keeping their ids, and seeds attempts (strike counts) from
 * projects that have strikes.
 *
 * Dry run by default (prints what it would change); pass --apply to write. Safe to re-run:
 * documents that already exist are left alone ($setOnInsert) and strike counts only rise ($max).
 *
 *   SOURCE_DATABASE_URL=mongodb://.../ceditor_code DATABASE_URL=mongodb://.../ceditor_contest \
 *     node dist/scripts/migrate-from-code-service.js [--apply]
 */
import { AnyBulkWriteOperation, Document, MongoClient } from 'mongodb';

const apply = process.argv.includes('--apply');
const sourceUrl = process.env.SOURCE_DATABASE_URL;
const targetUrl = process.env.DATABASE_URL;

async function main() {
  if (!sourceUrl || !targetUrl) {
    console.error('Set SOURCE_DATABASE_URL (code-service DB) and DATABASE_URL (contest-service DB)');
    process.exit(1);
  }

  const source = await MongoClient.connect(sourceUrl);
  const target = await MongoClient.connect(targetUrl);
  try {
    const from = source.db();
    const to = target.db();
    console.log(`${apply ? 'APPLY' : 'DRY RUN'}: ${from.databaseName} -> ${to.databaseName}`);

    // Contests and submissions: copied as-is, keeping _id; existing target documents win
    for (const collection of ['contests', 'submissions']) {
      const docs = await from.collection(collection).find().toArray();
      const existing = new Set(
        (await to.collection(collection).find({}, { projection: { _id: 1 } }).toArray()).map((d) => String(d._id)),
      );
      const missing = docs.filter((d) => !existing.has(String(d._id)));
      console.log(`  ${collection}: ${docs.length} in source, ${missing.length} to copy`);

      if (apply && missing.length > 0) {
        const ops: AnyBulkWriteOperation<Document>[] = missing.map((doc) => ({
          updateOne: { filter: { _id: doc._id }, update: { $setOnInsert: doc }, upsert: true },
        }));
        await to.collection(collection).bulkWrite(ops);
      }
    }

    // Attempts: strike counts lived on projects (warningCount)
    const struck = await from
      .collection('projects')
      .find({ warningCount: { $gt: 0 } }, { projection: { _id: 1, userId: 1, warningCount: 1 } })
      .toArray();
    console.log(`  attempts: ${struck.length} project(s) with strikes`);
    if (apply && struck.length > 0) {
      const now = new Date();
      await to.collection('attempts').bulkWrite(
        struck.map((p) => ({
          updateOne: {
            filter: { userId: p.userId, projectId: String(p._id) },
            update: { $max: { strikeCount: p.warningCount }, $setOnInsert: { createdAt: now }, $set: { updatedAt: now } },
            upsert: true,
          },
        })),
      );
    }

    if (!apply) console.log('Re-run with --apply to write these changes.');
  } finally {
    await source.close();
    await target.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
