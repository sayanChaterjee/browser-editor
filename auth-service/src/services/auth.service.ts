import jwt from 'jsonwebtoken';
import ms from 'ms';
import bcrypt from 'bcrypt';

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

    if (!user) {
      throw createError('invalid credentials', 401);
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      throw createError('invalid credentials', 401);
    }

    const token = jwt.sign(
      {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
      },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN as ms.StringValue }
    );

    await redis.setex(
      `auth:${user._id.toString()}:${token}`,
      24 * 60 * 60,
      'true'
    );

    user.lastLogin = new Date();
    await user.save();

    return {
      token,
      name: user.name,
      email: user.email,
    };
  }

  async logout(userId: string, token: string) {
    await redis.del(`auth:${userId}:${token}`);
  }
}

export default AuthService;
