interface Config {
  SERVICE_NAME: string;
  PORT: number;
  DATABASE_URL: string;
  KAFKA_BROKER: string;
  LOG_LEVEL: string;
  REDIS_URL: string;
  ADMIN_EMAILS: string[];
}

export const config: Config = {
  SERVICE_NAME: require('../../package.json').name,
  PORT: Number(process.env.PORT) || 3002,
  DATABASE_URL: process.env.DATABASE_URL || '',
  KAFKA_BROKER: process.env.KAFKA_BROKER || 'localhost:9092',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  REDIS_URL: process.env.REDIS_URL || 'http://localhost:6379',
  ADMIN_EMAILS: (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()),
};

if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL is not set in environment variables. Using default empty string which might fail.');
}
