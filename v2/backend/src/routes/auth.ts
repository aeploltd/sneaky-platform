import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
const authController = new AuthController();

/**
 * Auth Routes - Demo Implementation
 */

// POST /api/auth/login
router.post('/login', asyncHandler(authController.login.bind(authController)));

// POST /api/auth/register  
router.post('/register', asyncHandler(authController.register.bind(authController)));

// GET /api/auth/demo-token
router.get('/demo-token', asyncHandler(authController.getDemoToken.bind(authController)));

export default router;