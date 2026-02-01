import { Router } from 'express';
import authRoutes from './auth';
import userRoutes from './users';
import serverRoutes from './servers';

const router = Router();

// Mount route modules
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/servers', serverRoutes);

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    message: 'Sneaky Hosting V2 API',
    version: '2.0.0',
    modules: {
      auth: '/api/auth',
      users: '/api/users',
      servers: '/api/servers'
    },
    demo: {
      note: 'Use "Bearer demo-token" for authentication',
      endpoints: [
        'GET /api/users/profile',
        'GET /api/servers',
        'POST /api/servers'
      ]
    }
  });
});

export default router;