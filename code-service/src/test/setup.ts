import { before, after } from 'node:test';
import mongoose from 'mongoose';
import redis from '../config/redis';
import { config } from '../config';
import { skip } from './env';

/** Connects to the test MongoDB and Redis, empty, for one test file. */
export function useTestDatabases() {
  before(async () => {
    if (skip) return;
    await mongoose.connect(config.DATABASE_URL);
    await mongoose.connection.dropDatabase();
    await mongoose.model('Project').syncIndexes();
    if (redis.status !== 'ready') await new Promise((resolve) => redis.once('ready', resolve));
    await redis.flushdb();
  });

  after(async () => {
    await mongoose.disconnect();
    redis.disconnect();
  });
}
