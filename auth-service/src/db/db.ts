import mongoose from 'mongoose';
import logger from '../config/logger';
import { config } from '../config';

export const connectDB = async () => {
  try {
    await mongoose.connect(config.DATABASE_URL!);
    logger.info('MongoDB connected');
  } catch (error) {
    logger.error('MongoDB connection failed', error);
    process.exit(1);
  }
};

export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected');
  } catch (error) {
    logger.error('MongoDB disconnection failed', error);
  }
};
