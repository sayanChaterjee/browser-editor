import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Db, MongoClient, ObjectId } from 'mongodb';
import { deletePasswordAccounts } from './delete-password-accounts';

// Needs a real MongoDB: CI provides one; locally e.g.
// MONGO_TEST_URL=mongodb://localhost:27017/x npm test -w identity-service
const url = process.env.MONGO_TEST_URL;
const skip = url ? false : 'MONGO_TEST_URL not set';
let client: MongoClient;
let dbs: { auth: Db; code: Db; contest: Db };

const passwordOnly = new ObjectId();
const googleOnly = new ObjectId();
const both = new ObjectId();
const admin = new ObjectId();

before(async () => {
  if (!url) return;
  client = await MongoClient.connect(url);
  dbs = { auth: client.db('cleanup_test_auth'), code: client.db('cleanup_test_code'), contest: client.db('cleanup_test_contest') };
  await Promise.all(Object.values(dbs).map((db) => db.dropDatabase()));

  await dbs.auth.collection('user').insertMany([
    { _id: passwordOnly, name: 'old', email: 'old@local.host' },
    { _id: googleOnly, name: 'g', email: 'g@gmail.com' },
    { _id: both, name: 'both', email: 'both@gmail.com' },
    { _id: admin, name: 'admin', email: 'Admin@Example.com' },
  ]);
  await dbs.auth.collection('account').insertMany([
    { userId: passwordOnly, providerId: 'credential' },
    { userId: googleOnly, providerId: 'google' },
    { userId: both, providerId: 'credential' },
    { userId: both, providerId: 'google' },
    { userId: admin, providerId: 'credential' },
  ]);
  await dbs.auth.collection('session').insertMany([{ userId: passwordOnly }, { userId: googleOnly }]);
  for (const id of [passwordOnly, googleOnly]) {
    await dbs.code.collection('projects').insertOne({ userId: String(id), name: 'p' });
    await dbs.contest.collection('submissions').insertOne({ userId: String(id) });
    await dbs.contest.collection('participants').insertOne({ userId: String(id) });
  }
});

after(async () => {
  if (!url) return;
  await Promise.all(Object.values(dbs).map((db) => db.dropDatabase()));
  await client.close();
});

const protect = new Set(['admin@example.com']);

test('dry run lists password-only users (admins kept) and changes nothing', { skip }, async () => {
  const { doomed, kept, counts } = await deletePasswordAccounts(dbs, protect, false);
  assert.deepEqual(doomed.map((u) => u.name), ['old']);
  assert.deepEqual(kept.map((u) => u.name), ['admin']);
  assert.deepEqual(counts, {
    users: 1, 'auth.account': 1, 'auth.session': 1,
    'code.projects': 1, 'code.submissions': 0,
    'contest.submissions': 1, 'contest.participants': 1, 'contest.attempts': 0,
  });
  assert.equal(await dbs.auth.collection('user').countDocuments(), 4);
});

test('apply deletes them and their data in every service; Google users untouched', { skip }, async () => {
  await deletePasswordAccounts(dbs, protect, true);
  assert.deepEqual((await dbs.auth.collection('user').find().toArray()).map((u) => u.name).sort(), ['admin', 'both', 'g']);
  assert.equal(await dbs.auth.collection('account').countDocuments({ userId: passwordOnly }), 0);
  assert.equal(await dbs.auth.collection('session').countDocuments(), 1);
  assert.equal(await dbs.code.collection('projects').countDocuments({ userId: String(passwordOnly) }), 0);
  assert.equal(await dbs.code.collection('projects').countDocuments({ userId: String(googleOnly) }), 1);
  assert.equal(await dbs.contest.collection('submissions').countDocuments(), 1);
  assert.equal(await dbs.contest.collection('participants').countDocuments(), 1);

  // Running again finds nothing
  assert.equal((await deletePasswordAccounts(dbs, protect, true)).doomed.length, 0);
});
