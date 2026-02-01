import { Router } from 'express';
import { body, query, validationResult } from 'express-validator';
import { prisma } from '@/database/connection';
import { logger } from '@/utils/logger';
import { asyncHandler, createError } from '@/middleware/errorHandler';
import { AuthenticatedRequest, requireOrganization } from '@/middleware/auth';
import { ServerService } from '@/services/ServerService';

const router = Router();

/**
 * @swagger
 * /api/servers:
 *   get:
 *     summary: Get all servers for organization
 *     tags: [Servers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, running, stopped, terminated]
 *       - in: query
 *         name: provider
 *         schema:
 *           type: string
 *           enum: [aws, gcp, azure, digitalocean]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *     responses:
 *       200:
 *         description: List of servers
 */
router.get('/', [
  requireOrganization,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['pending', 'running', 'stopped', 'terminated']),
  query('provider').optional().isIn(['aws', 'gcp', 'azure', 'digitalocean'])
], asyncHandler(async (req: AuthenticatedRequest, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400);
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const where: any = {
    organizationId: req.user!.organizationId,
    isActive: true
  };

  if (req.query.status) {
    where.status = req.query.status;
  }

  if (req.query.provider) {
    where.provider = req.query.provider;
  }

  const [servers, total] = await Promise.all([
    prisma.server.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            deployments: true,
            domains: true
          }
        }
      }
    }),
    prisma.server.count({ where })
  ]);

  res.json({
    servers,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
}));

/**
 * @swagger
 * /api/servers:
 *   post:
 *     summary: Create a new server
 *     tags: [Servers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - provider
 *               - region
 *               - instanceType
 *             properties:
 *               name:
 *                 type: string
 *               provider:
 *                 type: string
 *                 enum: [aws, gcp, azure, digitalocean]
 *               region:
 *                 type: string
 *               instanceType:
 *                 type: string
 *               cpu:
 *                 type: integer
 *               memory:
 *                 type: integer
 *               storage:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Server created successfully
 */
router.post('/', [
  requireOrganization,
  body('name').trim().isLength({ min: 1, max: 100 }),
  body('provider').isIn(['aws', 'gcp', 'azure', 'digitalocean']),
  body('region').trim().isLength({ min: 1 }),
  body('instanceType').trim().isLength({ min: 1 }),
  body('cpu').optional().isInt({ min: 1 }),
  body('memory').optional().isInt({ min: 1 }),
  body('storage').optional().isInt({ min: 10 })
], asyncHandler(async (req: AuthenticatedRequest, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400);
  }

  const { name, provider, region, instanceType, cpu, memory, storage } = req.body;

  // Check if server name already exists in organization
  const existingServer = await prisma.server.findFirst({
    where: {
      name,
      organizationId: req.user!.organizationId,
      isActive: true
    }
  });

  if (existingServer) {
    throw createError('Server name already exists', 409);
  }

  // Get instance specifications and pricing
  const instanceSpecs = await ServerService.getInstanceSpecs(provider, instanceType);
  
  const server = await prisma.server.create({
    data: {
      name,
      hostname: `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.sneaky.cloud`,
      ipAddress: '0.0.0.0', // Will be assigned during provisioning
      region,
      provider,
      instanceType,
      cpu: cpu || instanceSpecs.cpu,
      memory: memory || instanceSpecs.memory,
      storage: storage || instanceSpecs.storage,
      bandwidth: instanceSpecs.bandwidth,
      monthlyPrice: instanceSpecs.monthlyPrice,
      organizationId: req.user!.organizationId,
      status: 'pending'
    }
  });

  // Start server provisioning process
  await ServerService.provisionServer(server.id);

  logger.info('Server created', { serverId: server.id, organizationId: req.user!.organizationId });

  res.status(201).json({
    message: 'Server created successfully',
    server
  });
}));

/**
 * @swagger
 * /api/servers/{id}:
 *   get:
 *     summary: Get server details
 *     tags: [Servers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Server details
 *       404:
 *         description: Server not found
 */
router.get('/:id', requireOrganization, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const server = await prisma.server.findFirst({
    where: {
      id: req.params.id,
      organizationId: req.user!.organizationId,
      isActive: true
    },
    include: {
      deployments: {
        orderBy: { createdAt: 'desc' },
        take: 5
      },
      domains: true,
      metrics: {
        orderBy: { timestamp: 'desc' },
        take: 100
      }
    }
  });

  if (!server) {
    throw createError('Server not found', 404);
  }

  res.json({ server });
}));

/**
 * @swagger
 * /api/servers/{id}/start:
 *   post:
 *     summary: Start server
 *     tags: [Servers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Server start initiated
 */
router.post('/:id/start', requireOrganization, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const server = await prisma.server.findFirst({
    where: {
      id: req.params.id,
      organizationId: req.user!.organizationId,
      isActive: true
    }
  });

  if (!server) {
    throw createError('Server not found', 404);
  }

  if (server.status === 'running') {
    throw createError('Server is already running', 400);
  }

  await ServerService.startServer(server.id);

  res.json({ message: 'Server start initiated' });
}));

/**
 * @swagger
 * /api/servers/{id}/stop:
 *   post:
 *     summary: Stop server
 *     tags: [Servers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Server stop initiated
 */
router.post('/:id/stop', requireOrganization, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const server = await prisma.server.findFirst({
    where: {
      id: req.params.id,
      organizationId: req.user!.organizationId,
      isActive: true
    }
  });

  if (!server) {
    throw createError('Server not found', 404);
  }

  if (server.status === 'stopped') {
    throw createError('Server is already stopped', 400);
  }

  await ServerService.stopServer(server.id);

  res.json({ message: 'Server stop initiated' });
}));

export default router;