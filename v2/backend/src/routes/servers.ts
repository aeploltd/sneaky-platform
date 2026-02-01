import { Router } from 'express';
import { ServerController } from '../controllers/ServerController';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
const serverController = new ServerController();

/**
 * Server Routes
 */

// GET /api/servers (public with optional auth)
router.get('/', optionalAuth, asyncHandler(serverController.getServers.bind(serverController)));

// POST /api/servers (protected)
router.post('/', authMiddleware, asyncHandler(serverController.createServer.bind(serverController)));

// GET /api/servers/:id (public)
router.get('/:id', asyncHandler(serverController.getServer.bind(serverController)));

// PUT /api/servers/:id (protected)
router.put('/:id', authMiddleware, asyncHandler(serverController.updateServer.bind(serverController)));

// DELETE /api/servers/:id (protected)
router.delete('/:id', authMiddleware, asyncHandler(serverController.deleteServer.bind(serverController)));

export default router;