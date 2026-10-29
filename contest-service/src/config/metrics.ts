import { createMetrics, prom } from '@ceditor/common';
import { config } from '.';

export const metrics = createMetrics(config.SERVICE_NAME, { token: config.METRICS_TOKEN });
const registers = [metrics.registry];

export const submissionsCreated = new prom.Counter({
  name: 'contest_submissions_total',
  help: 'Contest submissions received',
  registers,
});

export const strikesRecorded = new prom.Counter({
  name: 'contest_strikes_total',
  help: 'Anti-cheat strikes recorded',
  registers,
});

export const heartbeatsRecorded = new prom.Counter({
  name: 'contest_heartbeats_total',
  help: 'Contest activity heartbeats received from editors',
  registers,
});

export const submissionFlags = new prom.Counter({
  name: 'contest_submission_flags_total',
  help: 'Flags raised on submissions for review, by flag',
  labelNames: ['flag'] as const,
  registers,
});

export const eventsPublished = new prom.Counter({
  name: 'events_published_total',
  help: 'Events sent to Kafka, by type and result (published, failed = dropped after retries)',
  labelNames: ['type', 'result'] as const,
  registers,
});

export const eventsConsumed = new prom.Counter({
  name: 'events_consumed_total',
  help: 'Events consumed from Kafka, by topic, type and result (processed, duplicate, invalid, dead_lettered)',
  labelNames: ['topic', 'type', 'result'] as const,
  registers,
});
