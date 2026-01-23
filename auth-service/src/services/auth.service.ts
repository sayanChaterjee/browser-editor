import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

import { config } from '../config';
import redis from '../config/redis';
import { User } from '../models/user.model';
import { createError } from '../utils';
import { publishUserRegistered } from '../events/producers/userRegistered.producer';
import { publishSecurityEvent } from '../events/producers/securityEvents.producer';
import { sendResetEmail } from '../utils/mailer';
import logger from '../config/logger';


interface RegisterDto {
  name: string;
  email: string;
  password: string;
}

class AuthService {
  async register({ name, email, password }: RegisterDto) {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw createError('email already in use', 400);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: passwordHash,
    });

    await publishUserRegistered({
      key: user._id.toString(),
      value: {
        id: user._id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
    });

    return {
      id: user._id,
      name: user.name,
      email: user.email,
    };
  }

  async login(email: string, password: string) {
    const user = await User.findOne({ email });
    if (!user) throw createError('invalid credentials', 401);

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw createError('invalid credentials', 401);

    const userId = user._id.toString();

    // Single Session Enforcement: Invalidate all previous sessions for this user
    const oldAuthKeys = await redis.keys(`auth:${userId}:*`);
    const oldRefreshKeys = await redis.keys(`refresh:${userId}:*`);
    const allOldKeys = [...oldAuthKeys, ...oldRefreshKeys];
    if (allOldKeys.length > 0) {
      await redis.del(...allOldKeys);
      logger.info(`Invalidated ${allOldKeys.length} previous sessions for user ${userId}`);
    }

    const accessToken = jwt.sign(
      {
        id: userId,
        email: user.email,
        name: user.name,
      },
      config.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = crypto.randomUUID();

    await redis.setex(
      `auth:${user._id}:${accessToken}`,
      15 * 60,
      'true'
    );

    await redis.setex(
      `refresh:${user._id}:${refreshToken}`,
      7 * 24 * 60 * 60,
      'true'
    );

    user.lastLogin = new Date();
    await user.save();

    return {
      accessToken,
      refreshToken,
      name: user.name,
      email: user.email,
    };
  }

  async refresh(refreshToken: string) {
    const keys = await redis.keys(`refresh:*:${refreshToken}`);
    if (keys.length === 0) {
      throw createError('invalid refresh token', 401);
    }

    const key = keys[0];
    const userId = key.split(':')[1];

    await redis.del(key);

    const newRefreshToken = crypto.randomUUID();
    await redis.setex(
      `refresh:${userId}:${newRefreshToken}`,
      7 * 24 * 60 * 60,
      'true'
    );

    const user = await User.findById(userId);
    if (!user) throw createError('user not found', 404);

    const newAccessToken = jwt.sign(
      {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
      },
      config.JWT_SECRET,
      { expiresIn: '15m' }
    );

    await redis.setex(
      `auth:${user._id}:${newAccessToken}`,
      15 * 60,
      'true'
    );

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(userId: string, accessToken: string) {
    await redis.del(`auth:${userId}:${accessToken}`);

    const refreshKeys = await redis.keys(`refresh:${userId}:*`);
    for (const key of refreshKeys) {
      await redis.del(key);
    }

    // Trigger security event for cache purging across services
    await publishSecurityEvent({ userId, event: 'LOGOUT_ALL' });
  }

  async forgotPassword(email: string) {
    const user = await User.findOne({ email });
    if (!user) return;

    const resetToken = crypto.randomBytes(32).toString('hex');

    await redis.setex(
      `reset_password:${resetToken}`,
      15 * 60,
      user._id.toString()
    );

    await sendResetEmail(user.email, resetToken);
  }

  async resetPassword(token: string, newPassword: string) {
    const redisKey = `reset_password:${token}`;
    const userId = await redis.get(redisKey);

    if (!userId) {
      throw createError('Invalid or expired reset token', 400);
    }

    const user = await User.findById(userId);
    if (!user) throw createError('User not found', 404);

    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.password = passwordHash;
    await user.save();

    await redis.del(redisKey);
    const authKeys = await redis.keys(`auth:${userId}:*`);
    const refreshKeys = await redis.keys(`refresh:${userId}:*`);
    for (const key of [...authKeys, ...refreshKeys]) {
      await redis.del(key);
    }

    // Trigger security event for cache purging across services
    await publishSecurityEvent({ userId: userId.toString(), event: 'PASSWORD_CHANGED' });
  }
}

export default AuthService;
