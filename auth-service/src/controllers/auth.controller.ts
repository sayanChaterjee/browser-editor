import { Request, Response } from 'express';
import { z } from 'zod';
import AuthService from '../services/auth.service';

const registerSchema = z.object({
  name: z.string().min(3).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
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

    const accessToken = await this.authService.refresh(refreshToken);

    return res.status(200).json({ accessToken });
  }

  async logout(req: Request, res: Response): Promise<any> {
    await this.authService.logout(req.userId!, req.token);

    res.clearCookie('refreshToken');

    return res.status(200).json({ message: 'logged out successfully' });
  }
}
