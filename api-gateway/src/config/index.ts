interface Config {
  SERVICE_NAME: string;
  PORT: number;
  DEFAULT_TIMEOUT: number;
  AUTH_JWT_SECRET: string;
  GATEWAY_JWT_SECRET: string;
  GATEWAY_JWT_EXPIRES_IN: string;
  LOG_LEVEL: string;
  REDIS_URL: string;
  AUTH_SERVICE_URL: string;
}

export const config: Config = {
  SERVICE_NAME: require('../../package.json').name,
  PORT: Number(process.env.PORT) || 3000, // casting to number because env variables are strings
  DEFAULT_TIMEOUT: Number(process.env.DEFAULT_TIMEOUT || '30000'),
  AUTH_JWT_SECRET:
    process.env.AUTH_JWT_SECRET || '53be0e0d7c5386052dd9b9319977915b5d48b754a64ada847b8813855fb38da701841040ebf9bb0a48a6a3d5d825542b7111d2eea5dce5c5826d34db831717b3',
  GATEWAY_JWT_SECRET:
    process.env.GATEWAY_JWT_SECRET || '650ae44094a1baa3fd17e0c63b3e97e6a24119cf6855063cc433777dea8d433477d9a9b0a8e4b41f6ace0b884f2303eda20d122d94ef7a481b056593f5d2e6c9',
  GATEWAY_JWT_EXPIRES_IN: process.env.GATEWAY_JWT_EXPIRES_IN || '1m',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
};