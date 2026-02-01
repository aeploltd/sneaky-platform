import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { config } from '@/config/environment';
import { logger } from '@/utils/logger';
import { errorHandler } from '@/middleware/errorHandler';
import { authMiddleware } from '@/middleware/auth';
import { setupSwagger } from '@/config/swagger';
import { connectDatabase } from '@/database/connection';
import { connectRedis } from '@/config/redis';

// Route imports
import authRoutes from '@/routes/auth';
import userRoutes from '@/routes/users';
import serverRoutes from '@/routes/servers';
import domainRoutes from '@/routes/domains';
import billingRoutes from '@/routes/billing';
import monitoringRoutes from '@/routes/monitoring';
import deploymentRoutes from '@/routes/deployments';

class SneakyServer {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: config.frontend.url,
        methods: ['GET', 'POST']
      }
    });
    
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
    this.initializeSocketIO();
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors({
      origin: config.frontend.url,
      credentials: true
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP'
    });
    this.app.use('/api/', limiter);

    // Body parsing and compression
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  private initializeRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
      });
    });

    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/users', authMiddleware, userRoutes);
    this.app.use('/api/servers', authMiddleware, serverRoutes);
    this.app.use('/api/domains', authMiddleware, domainRoutes);
    this.app.use('/api/billing', authMiddleware, billingRoutes);
    this.app.use('/api/monitoring', authMiddleware, monitoringRoutes);
    this.app.use('/api/deployments', authMiddleware, deploymentRoutes);

    // Swagger documentation
    setupSwagger(this.app);

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({ error: 'Route not found' });
    });
  }

  private initializeErrorHandling(): void {
    this.app.use(errorHandler);
  }

  private initializeSocketIO(): void {
    this.io.use((socket, next) => {
      // Socket authentication middleware
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }
      // Verify JWT token here
      next();
    });

    this.io.on('connection', (socket) => {
      logger.info(`Client connected: ${socket.id}`);

      socket.on('join-room', (room: string) => {
        socket.join(room);
        logger.info(`Client ${socket.id} joined room: ${room}`);
      });

      socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
      });
    });

    // Make io available globally
    (global as any).io = this.io;
  }

  public async start(): Promise<void> {
    try {
      // Connect to databases
      await connectDatabase();
      await connectRedis();

      // Start server
      this.server.listen(config.port, () => {
        logger.info(`🚀 Sneaky Backend running on port ${config.port}`);
        logger.info(`📚 API Documentation: http://localhost:${config.port}/api-docs`);
        logger.info(`🔍 Health Check: http://localhost:${config.port}/health`);
      });
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
const server = new SneakyServer();
server.start();