import { UserBannedV1, UserEvent, UserRegisteredV1, UserUnbannedV1 } from '@ceditor/contracts';
import Project from '../models/project.model';
import Submission from '../models/submission.model';
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

// New users start with a ready-made project instead of an empty editor
async function onUserRegistered({ data }: UserRegisteredV1) {
  try {
    await Project.create({ userId: data.userId, name: STARTER_PROJECT_NAME, ...STARTER_PROJECT });
  } catch (err) {
    // Unique (userId, name): the project already exists, e.g. a redelivered event
    if ((err as { code?: number }).code !== 11000) throw err;
  }
  // The list may have been cached (empty) before this event arrived
  await redis.del(`user:projects:${data.userId}`);
}

async function setDisqualified(userId: string, disqualified: boolean) {
  const result = await Submission.updateMany({ userId }, { $set: { disqualified } });
  logger.info(`${disqualified ? 'Disqualified' : 'Reinstated'} ${result.modifiedCount} submission(s) of user ${userId}`);
}

const onUserBanned = ({ data }: UserBannedV1) => setDisqualified(data.userId, true);
const onUserUnbanned = ({ data }: UserUnbannedV1) => setDisqualified(data.userId, false);

export async function handleUserEvent(event: UserEvent): Promise<void> {
  switch (event.type) {
    case 'user.registered.v1':
      return onUserRegistered(event);
    case 'user.banned.v1':
      return onUserBanned(event);
    case 'user.unbanned.v1':
      return onUserUnbanned(event);
  }
}
