import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { UserService } from '../services/UserService';
import { createError } from '../middleware/errorHandler';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      throw createError('User not authenticated', 401);
    }

    const profile = await this.userService.getProfile(req.user.id);
    
    res.json({
      message: 'Profile retrieved successfully',
      user: profile
    });
  }

  async getUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    const users = await this.userService.getUsers();
    
    res.json({
      message: 'Users retrieved successfully',
      users,
      count: users.length
    });
  }

  async createUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { email, name } = req.body;

    if (!email || !name) {
      throw createError('Email and name are required', 400);
    }

    const user = await this.userService.createUser({ email, name });
    
    res.status(201).json({
      message: 'User created successfully',
      user
    });
  }
}