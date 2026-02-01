import { Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { createError } from '../middleware/errorHandler';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body;

    if (!email || !password) {
      throw createError('Email and password are required', 400);
    }

    const result = await this.authService.login(email, password);
    
    res.json({
      message: 'Login successful',
      ...result
    });
  }

  async register(req: Request, res: Response): Promise<void> {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      throw createError('Email, password, and name are required', 400);
    }

    const result = await this.authService.register({ email, password, name });
    
    res.status(201).json({
      message: 'Registration successful',
      ...result
    });
  }

  async getDemoToken(req: Request, res: Response): Promise<void> {
    res.json({
      message: 'Demo token for testing',
      token: 'demo-token',
      usage: 'Add "Authorization: Bearer demo-token" to your requests',
      example: {
        header: 'Authorization: Bearer demo-token',
        curl: 'curl -H "Authorization: Bearer demo-token" http://localhost:3001/api/users/profile'
      }
    });
  }
}