interface Config {
  SERVICE_NAME: string;
  PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  KAFKA_BROKER: string;
  LOG_LEVEL: string;
  ADMIN_EMAILS: string[];
}

export const config: Config = {
  SERVICE_NAME: require('../../package.json').name,
  PORT: Number(process.env.PORT) || 3003,
  DATABASE_URL: process.env.DATABASE_URL || '',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  KAFKA_BROKER: process.env.KAFKA_BROKER || 'localhost:9092',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  ADMIN_EMAILS: (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()),
};

if (!process.env.DATABASE_URL) {
  console.warn('[WARN] DATABASE_URL is missing. Please set it in .env');
}
