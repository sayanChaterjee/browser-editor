interface Config {
  SERVICE_NAME: string;
  PORT: number;
  DATABASE_URL: string;
  KAFKA_BROKER: string;
  JWT_SECRET: string;
  LOG_LEVEL: string;
  REDIS_URL: string;
}

export const config: Config = {
  SERVICE_NAME: require('../../package.json').name,
  PORT: Number(process.env.PORT) || 3002,
  DATABASE_URL: process.env.DATABASE_URL || '',
  KAFKA_BROKER: process.env.KAFKA_BROKER || 'localhost:9092',
  JWT_SECRET: process.env.JWT_SECRET || '',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  REDIS_URL: process.env.REDIS_URL || 'http://localhost:6379',
};

if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL is not set in environment variables. Using default empty string which might fail.');
}
