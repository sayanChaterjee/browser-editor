interface Config {
  SERVICE_NAME: string;
  PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  KAFKA_BROKER: string;
  KAFKA_CA_CERT: string;
  KAFKA_SERVICE_KEY: string;
  KAFKA_SERVICE_CERT: string;
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
  KAFKA_CA_CERT: process.env.KAFKA_CA_CERT || '',
  KAFKA_SERVICE_KEY: process.env.KAFKA_SERVICE_KEY || '',
  KAFKA_SERVICE_CERT: process.env.KAFKA_SERVICE_CERT || '',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'http://localhost:3000',
  BASE_URL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  JWT_SECRET: process.env.BETTER_AUTH_SECRET || '',
};

if (!process.env.DATABASE_URL) {
  console.warn('[WARN] DATABASE_URL is missing. Please set it in .env');
}