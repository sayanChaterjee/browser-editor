import { isValidObjectId } from 'mongoose';
import { AnyEvent, StrikeRecordedV1, UserRegisteredV1 } from '@ceditor/contracts';
import Project from '../models/project.model';
import redis from '../config/redis';
import logger from '../config/logger';

// Each handler is safe to run twice: the consumer skips events it has recorded, but a
// crash between handling and recording redelivers the event.

export const STARTER_PROJECT_NAME = 'Welcome';

const STARTER_PROJECT = {
  html: `<main>
  <h1>Welcome to CEditor</h1>
  <p>Edit the HTML, CSS and JavaScript panels; the preview updates as you type.</p>
  <button id="greet">Say hello</button>
  <p id="output"></p>
</main>`,
  css: `body {
  font-family: system-ui, sans-serif;
  display: grid;
  place-items: center;
  min-height: 100vh;
  margin: 0;
}
button {
  padding: 0.5rem 1rem;
  cursor: pointer;
}`,
  js: `document.getElementById('greet').addEventListener('click', () => {
  document.getElementById('output').textContent = 'Hello from your first project!';
});`,
};

// Cache invalidation is best effort: a Redis outage must not fail (and dead-letter) an event.
// While Redis is down nothing is served from it, and its caches expire on their own.
async function dropCached(key: string) {
  await redis.del(key).catch(() => logger.warn(`Could not drop cached ${key}: Redis unavailable`));
}

// New users start with a ready-made project instead of an empty editor
async function onUserRegistered({ data }: UserRegisteredV1) {
  try {
    await Project.create({ userId: data.userId, name: STARTER_PROJECT_NAME, ...STARTER_PROJECT });
  } catch (err) {
    // Unique (userId, name): the project already exists, e.g. a redelivered event
    if ((err as { code?: number }).code !== 11000) throw err;
  }
  // The list may have been cached (empty) before this event arrived
  await dropCached(`user:projects:${data.userId}`);
}

// Keeps project.warningCount (shown on the admin dashboard) in step with contest-service,
// which owns strikes. $max makes it idempotent and immune to out-of-order delivery.
async function onStrikeRecorded({ data }: StrikeRecordedV1) {
  if (!isValidObjectId(data.projectId)) return;
  const result = await Project.updateOne(
    { _id: data.projectId, userId: data.userId },
    { $max: { warningCount: data.strikeCount } },
  );
  if (result.modifiedCount > 0) await dropCached(`project:${data.projectId}`);
}

/** Events from identity.user-events and contest.events; types this service doesn't use are skipped. */
export async function handleEvent(event: AnyEvent): Promise<void> {
  switch (event.type) {
    case 'user.registered.v1':
      return onUserRegistered(event);
    case 'strike.recorded.v1':
      return onStrikeRecorded(event);
  }
}
