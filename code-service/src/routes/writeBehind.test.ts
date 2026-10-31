import { skip, userTokenFor } from '../test/env';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AddressInfo } from 'net';
import express from 'express';
import { codeRouter } from './code.route';
import { jsonBody, MAX_FILE_CHARS } from '../middlewares/body.middleware';
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
  app.use(jsonBody);
  app.use(codeRouter);
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const res = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-user-token': userTokenFor(USER) },
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
  const original = Project.updateOne.bind(Project);
  (Project as any).updateOne = async (...args: Parameters<typeof original>) => {
    await redis.hset(`project:buffer:${projectId}`, { html: 'v4', updatedAt: new Date(Date.now() + 20).toISOString() });
    await redis.sadd('dirty_projects', projectId);
    return original(...args);
  };
  try {
    await flushDirtyProjects();
  } finally {
    (Project as any).updateOne = original;
  }

  assert.equal((await Project.findById(projectId))!.html, 'v3', 'the flush wrote what it read');
  assert.ok(await redis.sismember('dirty_projects', projectId), 'the newer edit keeps the project dirty');

  await flushDirtyProjects();
  assert.equal((await Project.findById(projectId))!.html, 'v4', 'and the next cycle writes it');
});

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test('while Redis is down, saves and reads go to MongoDB', { skip }, async () => {
  await pause(50); // later than the previous test's edit
  redis.disconnect();
  try {
    const saved = await api('POST', '/save', { name: 'wb', html: 'v5' });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.status, 'saved_to_db');
    assert.equal((await Project.findById(projectId))!.html, 'v5');

    await pause(5);
    const synced = await api('PATCH', `/sync/${projectId}`, { html: 'v6' });
    assert.equal(synced.status, 200);
    assert.equal(synced.body.status, 'synced_to_db');
    assert.equal((await Project.findById(projectId))!.html, 'v6');

    assert.equal((await api('GET', `/${projectId}`)).body.html, 'v6');
    const list = (await api('GET', '/')).body;
    assert.equal(list.find((p: { _id: string }) => p._id === projectId).html, 'v6');

    const created = await api('POST', '/save', { name: 'made-offline', html: 'new' });
    assert.equal(created.body.status, 'saved_to_db');
    assert.equal((await Project.findById(created.body._id))!.html, 'new');
  } finally {
    await redis.connect();
  }
});

test('after the outage, older Redis copies never replace what was saved to MongoDB', { skip }, async () => {
  await pause(100); // let the reconnect handler drop the stale copies

  // The pre-outage buffer (v4) and cached project were dropped
  assert.equal(await redis.exists(`project:buffer:${projectId}`), 0);
  assert.equal((await api('GET', `/${projectId}`)).body.html, 'v6');

  // Even if a stale buffer survives (e.g. the process restarted during the outage), the
  // flusher won't write it over newer content and reads won't overlay it
  await redis.hset(`project:buffer:${projectId}`, { html: 'stale', userId: USER, updatedAt: new Date(Date.now() - 60_000).toISOString() });
  await redis.sadd('dirty_projects', projectId);
  await redis.del(`project:${projectId}`);

  assert.equal((await api('GET', `/${projectId}`)).body.html, 'v6');
  assert.equal(await flushDirtyProjects(), 0);
  assert.equal((await Project.findById(projectId))!.html, 'v6');
  assert.equal(await redis.sismember('dirty_projects', projectId), 0);

  // And normal write-behind saves resume
  await api('POST', '/save', { name: 'wb', html: 'v7' });
  assert.equal(await flushDirtyProjects(), 1);
  assert.equal((await Project.findById(projectId))!.html, 'v7');
});

test('a save in progress locks only its own project', { skip }, async () => {
  const other = (await api('POST', '/save', { name: 'wb-other', html: 'x' })).body._id;
  await redis.set(`lock:project:${projectId}`, 'locked', 'EX', 15);
  try {
    assert.equal((await api('PATCH', `/sync/${projectId}`, { html: 'blocked' })).status, 409);
    assert.equal((await api('PATCH', `/sync/${other}`, { html: 'y' })).status, 200, 'other projects still save');
  } finally {
    await redis.del(`lock:project:${projectId}`);
  }
});

test('large projects save (up to MAX_FILE_CHARS per file); bigger files are refused', { skip }, async () => {
  const big = '<p>' + 'x'.repeat(300_000) + '</p>'; // past Express's default 100 KB body limit
  const saved = await api('POST', '/save', { name: 'big', html: big, css: 'p{}', js: '' });
  assert.equal(saved.status, 200);
  assert.equal((await api('GET', `/${saved.body._id}`)).body.html.length, big.length);

  const synced = await api('PATCH', `/sync/${saved.body._id}`, { js: 'y'.repeat(400_000) });
  assert.equal(synced.status, 200);

  const tooBig = 'z'.repeat(MAX_FILE_CHARS + 1);
  assert.equal((await api('POST', '/save', { name: 'big', html: tooBig })).status, 400);
  assert.equal((await api('PATCH', `/sync/${saved.body._id}`, { css: tooBig })).status, 413);
});
