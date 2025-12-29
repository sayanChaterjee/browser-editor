import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

import { config } from '../config';
import redis from '../config/redis';
import { User } from '../models/user.model';
import { createError } from '../utils';
import { publishUserRegistered } from '../events/producers/userRegistered.producer';

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

    const accessToken = jwt.sign(
      {
        id: user._id.toString(),
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
  }
}

export default AuthService;
