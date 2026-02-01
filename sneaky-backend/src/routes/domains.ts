import { Router } from 'express';
import { body, query, validationResult } from 'express-validator';
import { prisma } from '@/database/connection';
import { logger } from '@/utils/logger';
import { asyncHandler, createError } from '@/middleware/errorHandler';
import { AuthenticatedRequest, requireOrganization } from '@/middleware/auth';

const router = Router();

/**
 * @swagger
 * /api/domains:
 *   get:
 *     summary: Get all domains for organization
 *     tags: [Domains]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of domains
 */
router.get('/', [requireOrganization], asyncHandler(async (req: AuthenticatedRequest, res) => {
  const domains = await prisma.domain.findMany({
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
    orderBy: { createdAt: 'desc' }
  });

  res.json({ domains });
}));

/**
 * @swagger
 * /api/domains:
 *   post:
 *     summary: Add a new domain
 *     tags: [Domains]
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
 *             properties:
 *               name:
 *                 type: string
 *               serverId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Domain added successfully
 */
router.post('/', [
  requireOrganization,
  body('name').trim().isLength({ min: 1 }).matches(/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}$/),
  body('serverId').optional().isString()
], asyncHandler(async (req: AuthenticatedRequest, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Invalid domain name format', 400);
  }

  const { name, serverId } = req.body;

  // Check if domain already exists
  const existingDomain = await prisma.domain.findUnique({
    where: { name }
  });

  if (existingDomain) {
    throw createError('Domain already exists', 409);
  }

  // Verify server belongs to organization if provided
  if (serverId) {
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
  }

  const domain = await prisma.domain.create({
    data: {
      name,
      organizationId: req.user!.organizationId,
      serverId: serverId || null,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      status: 'pending'
    }
  });

  logger.info('Domain added', { domainId: domain.id, name, organizationId: req.user!.organizationId });

  res.status(201).json({
    message: 'Domain added successfully',
    domain
  });
}));

export default router;