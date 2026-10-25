import { skip } from '../test/env';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEvent } from '@ceditor/contracts';
import mongoose from 'mongoose';
import { handleEvent, STARTER_PROJECT_NAME } from './handlers';
import Project from '../models/project.model';
import { useTestDatabases } from '../test/setup';

// Handlers must be safe to repeat: the consumer skips recorded events, but a crash between
// handling and recording redelivers one.
useTestDatabases();

const meta = { source: 'test' };
const now = () => new Date().toISOString();

test('user.registered.v1 creates the starter project exactly once', { skip }, async () => {
  const event = createEvent('user.registered.v1', { userId: 'new-user', name: 'New', registeredAt: now() }, meta);
  await handleEvent(event);
  await handleEvent(event); // redelivered

  const projects = await Project.find({ userId: 'new-user' });
  assert.equal(projects.length, 1);
  assert.equal(projects[0].name, STARTER_PROJECT_NAME);
  assert.match(projects[0].html, /Welcome/);
});

test('strike.recorded.v1 only ever raises the project strike count', { skip }, async () => {
  const project = await Project.create({ userId: 'player', name: 'contest' });
  const strike = (strikeCount: number, userId = 'player', projectId = String(project._id)) =>
    createEvent('strike.recorded.v1', { userId, projectId, strikeCount, recordedAt: now() }, meta);

  await handleEvent(strike(2));
  await handleEvent(strike(1)); // older event delivered late
  assert.equal((await Project.findById(project._id))!.warningCount, 2);

  // Another user's event for this project, or a malformed id, changes nothing
  await handleEvent(strike(4, 'someone-else'));
  await handleEvent(strike(4, 'player', 'not-an-object-id'));
  assert.equal((await Project.findById(project._id))!.warningCount, 2);

  await handleEvent(strike(3));
  assert.equal((await Project.findById(project._id))!.warningCount, 3);
});

test('events this service does not use are ignored', { skip }, async () => {
  const before = await Project.countDocuments();
  await handleEvent(createEvent('user.banned.v1', { userId: 'player', bannedBy: 'admin', bannedAt: now() }, meta));
  await handleEvent(
    createEvent(
      'submission.created.v1',
      {
        submissionId: String(new mongoose.Types.ObjectId()),
        userId: 'player',
        projectId: 'p',
        contestId: null,
        timeTakenSeconds: 1,
        strikeCount: 0,
        submittedAt: now(),
      },
      meta,
    ),
  );
  assert.equal(await Project.countDocuments(), before);
});
