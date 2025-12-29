import crypto from 'crypto';

export const generateRefreshToken = () => {
  return crypto.randomUUID();
};
