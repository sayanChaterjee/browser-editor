interface Config {
  SERVICE_NAME: string;
  PORT: number;
  DATABASE_URL: string;
  KAFKA_BROKER: string;
  KAFKA_CA_CERT: string;
  KAFKA_SERVICE_KEY: string;
  KAFKA_SERVICE_CERT: string;
  LOG_LEVEL: string;
  REDIS_URL: string;
}

export const config: Config = {
  SERVICE_NAME: require('../../package.json').name,
  PORT: Number(process.env.PORT) || 3002,
  DATABASE_URL: process.env.DATABASE_URL || '',
  KAFKA_BROKER: process.env.KAFKA_BROKER || 'localhost:9092',
  KAFKA_CA_CERT: process.env.KAFKA_CA_CERT || '',
  KAFKA_SERVICE_KEY: process.env.KAFKA_SERVICE_KEY || '',
  KAFKA_SERVICE_CERT: process.env.KAFKA_SERVICE_CERT || '',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  REDIS_URL: process.env.REDIS_URL || 'http://localhost:6379',
};

if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL is not set in environment variables. Using default empty string which might fail.');
}
