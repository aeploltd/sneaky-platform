import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { prisma } from '@/database/connection';
import { config } from '@/config/environment';
import { logger } from '@/utils/logger';
import { asyncHandler, createError } from '@/middleware/errorHandler';
import { CacheService } from '@/config/redis';

const router = Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               organizationName:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: User already exists
 */
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  body('firstName').trim().isLength({ min: 1 }),
  body('lastName').trim().isLength({ min: 1 }),
  body('organizationName').optional().trim().isLength({ min: 1 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400);
  }

  const { email, password, firstName, lastName, organizationName } = req.body;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    throw createError('User already exists', 409);
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Create organization if provided
  let organization = null;
  if (organizationName) {
    const slug = organizationName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    organization = await prisma.organization.create({
      data: {
        name: organizationName,
        slug: `${slug}-${Date.now()}`
      }
    });
  }

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: organization ? 'admin' : 'user',
      organizationId: organization?.id
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      organizationId: true
    }
  });

  // Generate JWT
  const token = jwt.sign(
    { userId: user.id },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  logger.info('User registered successfully', { userId: user.id, email });

  res.status(201).json({
    message: 'User registered successfully',
    user,
    token
  });
}));

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400);
  }

  const { email, password } = req.body;

  // Find user
  const user = await prisma.user.findUnique({
    where: { email, isActive: true },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true
        }
      }
    }
  });

  if (!user) {
    throw createError('Invalid credentials', 401);
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    throw createError('Invalid credentials', 401);
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });

  // Generate JWT
  const token = jwt.sign(
    { userId: user.id },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  // Cache user session
  await CacheService.set(`user:${user.id}`, JSON.stringify({
    id: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId
  }), 3600);

  logger.info('User logged in successfully', { userId: user.id, email });

  res.json({
    message: 'Login successful',
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      organization: user.organization
    },
    token
  });
}));

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as any;
      await CacheService.del(`user:${decoded.userId}`);
    } catch (error) {
      // Token invalid, but that's okay for logout
    }
  }

  res.json({ message: 'Logout successful' });
}));

export default router;