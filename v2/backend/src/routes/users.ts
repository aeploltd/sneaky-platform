import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
const userController = new UserController();

/**
 * User Routes
 */

// GET /api/users/profile (protected)
router.get('/profile', authMiddleware, asyncHandler(userController.getProfile.bind(userController)));

// GET /api/users (demo - list all users)
router.get('/', asyncHandler(userController.getUsers.bind(userController)));

// POST /api/users (demo - create user)
router.post('/', asyncHandler(userController.createUser.bind(userController)));

export default router;