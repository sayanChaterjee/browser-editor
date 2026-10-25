import { skip } from '../test/env';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AddressInfo } from 'net';
import express from 'express';
import { codeRouter } from './code.route';
import Project from '../models/project.model';
import redis from '../config/redis';
import { flushDirtyProjects } from '../scripts/flusher.worker';
import { useTestDatabases } from '../test/setup';

// The save path: edits go to a Redis buffer; reads overlay the buffer on MongoDB; the
// flusher writes buffers to MongoDB.
useTestDatabases();

const USER = 'writer-1';

async function api(method: string, path: string, body?: unknown) {
  const app = express();
  app.use(express.json());
  app.use(codeRouter);
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const res = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-user-id': USER },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
  } finally {
    server.close();
  }
}

let projectId: string;

test('first save creates the project and buffers the edit', { skip }, async () => {
  const res = await api('POST', '/save', { name: 'wb', html: 'v1' });
  assert.equal(res.status, 200);
  projectId = res.body._id;

  assert.ok(await Project.findById(projectId), 'created in MongoDB to get an id');
  assert.equal(await redis.hget(`project:buffer:${projectId}`, 'html'), 'v1');
  assert.ok(await redis.sismember('dirty_projects', projectId));
});

test('later saves only touch Redis, and reads still return the latest edit', { skip }, async () => {
  await new Promise((resolve) => setTimeout(resolve, 20)); // released lock, newer timestamp
  await api('POST', '/save', { name: 'wb', html: 'v2' });

  assert.equal((await Project.findById(projectId))!.html, 'v1', 'MongoDB not written yet');
  assert.equal((await api('GET', `/${projectId}`)).body.html, 'v2');
  const list = (await api('GET', '/')).body;
  assert.equal(list.find((p: { _id: string }) => p._id === projectId).html, 'v2');
});

test('the flusher writes buffered edits to MongoDB and clears the dirty mark', { skip }, async () => {
  assert.equal(await flushDirtyProjects(), 1);
  assert.equal((await Project.findById(projectId))!.html, 'v2');
  assert.equal(await redis.sismember('dirty_projects', projectId), 0);
  assert.equal(await flushDirtyProjects(), 0, 'nothing left to flush');
});

test('a save that lands while the flusher is writing is not lost', { skip }, async () => {
  await api('POST', '/save', { name: 'wb', html: 'v3' });

  // Simulate a save arriving between the flusher's read of the buffer and its cleanup
  const original = Project.findByIdAndUpdate.bind(Project);
  (Project as any).findByIdAndUpdate = async (...args: Parameters<typeof original>) => {
    await redis.hset(`project:buffer:${projectId}`, { html: 'v4', updatedAt: new Date(Date.now() + 1000).toISOString() });
    await redis.sadd('dirty_projects', projectId);
    return original(...args);
  };
  try {
    await flushDirtyProjects();
  } finally {
    (Project as any).findByIdAndUpdate = original;
  }

  assert.equal((await Project.findById(projectId))!.html, 'v3', 'the flush wrote what it read');
  assert.ok(await redis.sismember('dirty_projects', projectId), 'the newer edit keeps the project dirty');

  await flushDirtyProjects();
  assert.equal((await Project.findById(projectId))!.html, 'v4', 'and the next cycle writes it');
});
