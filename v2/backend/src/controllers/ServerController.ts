import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { ServerService } from '../services/ServerService';
import { createError } from '../middleware/errorHandler';

export class ServerController {
  private serverService: ServerService;

  constructor() {
    this.serverService = new ServerService();
  }

  async getServers(req: AuthenticatedRequest, res: Response): Promise<void> {
    const servers = await this.serverService.getServers();
    
    res.json({
      message: 'Servers retrieved successfully',
      servers,
      count: servers.length,
      authenticated: !!req.user
    });
  }

  async getServer(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const server = await this.serverService.getServer(id);
    
    if (!server) {
      throw createError('Server not found', 404);
    }
    
    res.json({
      message: 'Server retrieved successfully',
      server
    });
  }

  async createServer(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { name, type, region } = req.body;

    if (!name) {
      throw createError('Server name is required', 400);
    }

    const server = await this.serverService.createServer({
      name,
      type: type || 'web',
      region: region || 'us-east-1',
      status: 'pending'
    });
    
    res.status(201).json({
      message: 'Server created successfully',
      server
    });
  }

  async updateServer(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const updates = req.body;

    const server = await this.serverService.updateServer(id, updates);
    
    if (!server) {
      throw createError('Server not found', 404);
    }
    
    res.json({
      message: 'Server updated successfully',
      server
    });
  }

  async deleteServer(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    
    const deleted = await this.serverService.deleteServer(id);
    
    if (!deleted) {
      throw createError('Server not found', 404);
    }
    
    res.json({
      message: 'Server deleted successfully'
    });
  }
}