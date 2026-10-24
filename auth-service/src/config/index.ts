interface Config {
  SERVICE_NAME: string;
  PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  KAFKA_BROKER: string;
  LOG_LEVEL: string;
  ALLOWED_ORIGINS: string;
  BASE_URL: string;
  JWT_SECRET: string;
}

export const config: Config = {
  SERVICE_NAME: require('../../package.json').name,
  PORT: Number(process.env.PORT) || 3001,
  DATABASE_URL:
    process.env.DATABASE_URL || '',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  KAFKA_BROKER: process.env.KAFKA_BROKER || 'localhost:9092',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'http://localhost:3000',
  BASE_URL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  JWT_SECRET: process.env.BETTER_AUTH_SECRET || '',
};

if (!process.env.DATABASE_URL) {
  console.warn('[WARN] DATABASE_URL is missing. Please set it in .env');
}