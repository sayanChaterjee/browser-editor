import { loadConfig, z, envRequired, envNumber, envUserTokenPublicKey } from '@ceditor/common';

const schema = z.object({
  PORT: envNumber(3004),
  LOG_LEVEL: z.string().default('info'),
  // Bearer token for /metrics (Prometheus); unset = endpoint disabled
  METRICS_TOKEN: z.string().default(''),
  DATABASE_URL: envRequired('MongoDB connection string'),
  KAFKA_BROKER: z.string().default('localhost:9092'),
  INTERNAL_GATEWAY_SECRET: envRequired('shared with the API gateway'),
  // Verifies the user tokens the gateway signs
  USER_TOKEN_PUBLIC_KEY: envUserTokenPublicKey(),
});

export const config = {
  SERVICE_NAME: require('../../package.json').name as string,
  ...loadConfig(schema),
};
