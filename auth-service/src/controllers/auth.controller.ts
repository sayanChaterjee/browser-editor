import { Request, Response } from 'express';
import { z } from 'zod';
import AuthService from '../services/auth.service';
import { producer } from '../config/kafka';

const registerSchema = z.object({
  name: z.string().min(3).max(100),
  email: z.string().email().refine((val) => val.toLowerCase().endsWith('@gmail.com'), {
    message: "Email must be a @gmail.com address",
  }),
  password: z.string().min(6).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(6),
});

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  async register(req: Request, res: Response): Promise<any> {
    const { name, email, password } = registerSchema.parse(req.body);

    const user = await this.authService.register({
      name,
      email,
      password,
    });

    // Publish event
    try {
      await producer.send({
        topic: 'user-registered',
        messages: [{ value: JSON.stringify({ userId: user.id, name: user.name, email: user.email }) }],
      });
    } catch (err) {
      console.error('Failed to send kafka message', err);
    }

    return res.status(201).json(user);
  }

  async login(req: Request, res: Response): Promise<any> {
    const { email, password } = loginSchema.parse(req.body);

    const result = await this.authService.login(email, password);

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(200).json({
      accessToken: result.accessToken,
      name: result.name,
      email: result.email,
    });
  }

  async refresh(req: Request, res: Response): Promise<any> {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ message: 'missing refresh token' });
  }

  const { accessToken, refreshToken: newRefreshToken } =
    await this.authService.refresh(refreshToken);

  res.cookie('refreshToken', newRefreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.status(200).json({ accessToken });
}

  async logout(req: Request, res: Response): Promise<any> {
    await this.authService.logout(req.userId!, req.token);

    res.clearCookie('refreshToken');

    return res.status(200).json({ message: 'logged out successfully' });
  }

  async forgotPassword(req: Request, res: Response): Promise<any> {
  const { email } = forgotPasswordSchema.parse(req.body);
  await this.authService.forgotPassword(email);

  return res.status(200).json({ message: 'If an account exists, a reset link has been sent.' });
}

async resetPassword(req: Request, res: Response): Promise<any> {
  const { token, newPassword } = resetPasswordSchema.parse(req.body);
  await this.authService.resetPassword(token, newPassword);

  return res.status(200).json({ message: 'Password updated successfully' });
}
}
