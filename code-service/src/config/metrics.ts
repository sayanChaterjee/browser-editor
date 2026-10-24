import { createMetrics, prom } from '@ceditor/common';
import { config } from '.';
import redis from './redis';

export const metrics = createMetrics(config.SERVICE_NAME, { token: config.METRICS_TOKEN });
const registers = [metrics.registry];

export const cacheLookups = new prom.Counter({
  name: 'project_cache_lookups_total',
  help: 'Project read cache lookups by cache (project, list) and result (hit, miss)',
  labelNames: ['cache', 'result'] as const,
  registers,
});

// Write-behind backlog: projects whose latest edits are only in Redis so far
new prom.Gauge({
  name: 'writebehind_dirty_projects',
  help: 'Projects with edits buffered in Redis, waiting for the flusher',
  registers,
  async collect() {
    this.set(await redis.scard('dirty_projects').catch(() => 0));
  },
});

export const flusherRuns = new prom.Counter({
  name: 'flusher_runs_total',
  help: 'Flusher cycles by result (success, error)',
  labelNames: ['result'] as const,
  registers,
});

export const flusherProjectsFlushed = new prom.Counter({
  name: 'flusher_projects_flushed_total',
  help: 'Projects written from the Redis buffer to MongoDB',
  registers,
});

export const flusherDuration = new prom.Histogram({
  name: 'flusher_run_duration_seconds',
  help: 'Duration of a flusher cycle',
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers,
});

export const eventsConsumed = new prom.Counter({
  name: 'events_consumed_total',
  help: 'Events consumed from Kafka, by topic, type and result (processed, duplicate, invalid, dead_lettered)',
  labelNames: ['topic', 'type', 'result'] as const,
  registers: [metrics.registry],
});
