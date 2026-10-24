import { createMetrics, prom } from '@ceditor/common';
import { config } from '.';

export const metrics = createMetrics(config.SERVICE_NAME, { token: config.METRICS_TOKEN });

export const kafkaMessages = new prom.Counter({
  name: 'kafka_messages_total',
  help: 'Kafka messages handled by topic and result (processed, invalid, dead_lettered, failed)',
  labelNames: ['topic', 'result'] as const,
  registers: [metrics.registry],
});
