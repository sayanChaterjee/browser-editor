import { loadConfig, z, envRequired, envNumber, envList, envUserTokenPublicKey } from '@ceditor/common';

const schema = z.object({
  PORT: envNumber(3001),
  LOG_LEVEL: z.string().default('info'),
  // Bearer token for /metrics (Prometheus); unset = endpoint disabled
  METRICS_TOKEN: z.string().default(''),
  DATABASE_URL: envRequired('MongoDB connection string'),
  // Shared with the gateway: revoking a user's sessions also clears the gateway's session cache
  REDIS_URL: z.string().default('redis://localhost:6379'),
  KAFKA_BROKER: z.string().default('localhost:9092'),
  INTERNAL_GATEWAY_SECRET: envRequired('shared with the API gateway'),
  // Verifies the user tokens the gateway signs
  USER_TOKEN_PUBLIC_KEY: envUserTokenPublicKey(),
  ADMIN_EMAILS: envList('').transform((emails) => emails.map((e) => e.toLowerCase())),
  ALLOWED_ORIGINS: envList('http://localhost:3000'),
  // Public URL of the frontend (requests reach auth through its /api proxy)
  BETTER_AUTH_URL: envRequired('public frontend URL, e.g. http://localhost:3005').url('must be a URL, e.g. http://localhost:3005'),
  BETTER_AUTH_SECRET: envRequired('generate with: openssl rand -base64 32'),
  FRONTEND_URL: z.string().default(''),
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
});

export const config = {
  SERVICE_NAME: require('../../package.json').name as string,
  ...loadConfig(schema),
};
