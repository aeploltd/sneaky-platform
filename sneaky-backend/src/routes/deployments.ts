import { Router } from 'express';
import { body, query, validationResult } from 'express-validator';
import { prisma } from '@/database/connection';
import { logger } from '@/utils/logger';
import { asyncHandler, createError } from '@/middleware/errorHandler';
import { AuthenticatedRequest, requireOrganization } from '@/middleware/auth';

const router = Router();

/**
 * @swagger
 * /api/deployments:
 *   get:
 *     summary: Get all deployments for organization
 *     tags: [Deployments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of deployments
 */
router.get('/', [requireOrganization], asyncHandler(async (req: AuthenticatedRequest, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const [deployments, total] = await Promise.all([
    prisma.deployment.findMany({
      where: {
        organizationId: req.user!.organizationId
      },
      include: {
        server: {
          select: {
            id: true,
            name: true,
            hostname: true,
            status: true
          }
        }
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.deployment.count({
      where: {
        organizationId: req.user!.organizationId
      }
    })
  ]);

  res.json({
    deployments,
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
 * /api/deployments:
 *   post:
 *     summary: Create a new deployment
 *     tags: [Deployments]
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
 *               - repository
 *               - serverId
 *             properties:
 *               name:
 *                 type: string
 *               repository:
 *                 type: string
 *               branch:
 *                 type: string
 *                 default: main
 *               serverId:
 *                 type: string
 *               buildCommand:
 *                 type: string
 *               startCommand:
 *                 type: string
 *               envVars:
 *                 type: object
 *     responses:
 *       201:
 *         description: Deployment created successfully
 */
router.post('/', [
  requireOrganization,
  body('name').trim().isLength({ min: 1, max: 100 }),
  body('repository').trim().isLength({ min: 1 }).matches(/^https:\/\/github\.com\/[\w\-\.]+\/[\w\-\.]+$/),
  body('branch').optional().trim().isLength({ min: 1 }),
  body('serverId').isString(),
  body('buildCommand').optional().trim(),
  body('startCommand').optional().trim(),
  body('envVars').optional().isObject()
], asyncHandler(async (req: AuthenticatedRequest, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400);
  }

  const { name, repository, branch = 'main', serverId, buildCommand, startCommand, envVars } = req.body;

  // Verify server belongs to organization
  const server = await prisma.server.findFirst({
    where: {
      id: serverId,
      organizationId: req.user!.organizationId,
      isActive: true
    }
  });

  if (!server) {
    throw createError('Server not found', 404);
  }

  if (server.status !== 'running') {
    throw createError('Server must be running to deploy', 400);
  }

  // Check if deployment name already exists in organization
  const existingDeployment = await prisma.deployment.findFirst({
    where: {
      name,
      organizationId: req.user!.organizationId
    }
  });

  if (existingDeployment) {
    throw createError('Deployment name already exists', 409);
  }

  const deployment = await prisma.deployment.create({
    data: {
      name,
      repository,
      branch,
      serverId,
      buildCommand,
      startCommand,
      envVars: envVars || {},
      organizationId: req.user!.organizationId,
      status: 'pending',
      deployUrl: `https://${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.${server.hostname}`
    }
  });

  // Start deployment process (simulated)
  setTimeout(async () => {
    try {
      await prisma.deployment.update({
        where: { id: deployment.id },
        data: {
          status: 'building',
          buildLogs: 'Starting build process...\nCloning repository...\nInstalling dependencies...'
        }
      });

      // Simulate build process
      setTimeout(async () => {
        try {
          const success = Math.random() > 0.2; // 80% success rate
          
          await prisma.deployment.update({
            where: { id: deployment.id },
            data: {
              status: success ? 'deployed' : 'failed',
              buildLogs: success 
                ? 'Build completed successfully!\nDeployment is live.'
                : 'Build failed: npm install failed\nError: Module not found'
            }
          });

          // Emit socket event
          const io = (global as any).io;
          if (io) {
            io.to(`deployment:${deployment.id}`).emit('deployment:status', {
              deploymentId: deployment.id,
              status: success ? 'deployed' : 'failed'
            });
          }

        } catch (error) {
          logger.error(`Failed to update deployment ${deployment.id}:`, error);
        }
      }, 30000); // 30 seconds build time

    } catch (error) {
      logger.error(`Failed to start deployment ${deployment.id}:`, error);
    }
  }, 5000); // 5 seconds delay

  logger.info('Deployment created', { deploymentId: deployment.id, organizationId: req.user!.organizationId });

  res.status(201).json({
    message: 'Deployment created successfully',
    deployment
  });
}));

/**
 * @swagger
 * /api/deployments/{id}:
 *   get:
 *     summary: Get deployment details
 *     tags: [Deployments]
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
 *         description: Deployment details
 */
router.get('/:id', requireOrganization, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const deployment = await prisma.deployment.findFirst({
    where: {
      id: req.params.id,
      organizationId: req.user!.organizationId
    },
    include: {
      server: {
        select: {
          id: true,
          name: true,
          hostname: true,
          status: true,
          ipAddress: true
        }
      }
    }
  });

  if (!deployment) {
    throw createError('Deployment not found', 404);
  }

  res.json({ deployment });
}));

/**
 * @swagger
 * /api/deployments/{id}/redeploy:
 *   post:
 *     summary: Redeploy an existing deployment
 *     tags: [Deployments]
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
 *         description: Redeployment initiated
 */
router.post('/:id/redeploy', requireOrganization, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const deployment = await prisma.deployment.findFirst({
    where: {
      id: req.params.id,
      organizationId: req.user!.organizationId
    },
    include: {
      server: true
    }
  });

  if (!deployment) {
    throw createError('Deployment not found', 404);
  }

  if (deployment.server.status !== 'running') {
    throw createError('Server must be running to redeploy', 400);
  }

  // Update deployment status
  await prisma.deployment.update({
    where: { id: deployment.id },
    data: {
      status: 'building',
      buildLogs: 'Redeployment started...\nPulling latest changes...',
      updatedAt: new Date()
    }
  });

  logger.info('Redeployment initiated', { deploymentId: deployment.id });

  res.json({ message: 'Redeployment initiated' });
}));

export default router;