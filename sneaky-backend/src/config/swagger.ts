import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import { config } from '@/config/environment';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Sneaky Hosting Platform API',
      version: '1.0.0',
      description: 'Enterprise hosting dashboard API documentation',
      contact: {
        name: 'Sneaky Cloud Team',
        email: 'api@sneaky.cloud'
      }
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development server'
      },
      {
        url: 'https://api.sneaky.cloud',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string', format: 'email' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            role: { type: 'string', enum: ['admin', 'user', 'viewer'] },
            organizationId: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Server: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            hostname: { type: 'string' },
            ipAddress: { type: 'string' },
            region: { type: 'string' },
            provider: { type: 'string', enum: ['aws', 'gcp', 'azure', 'digitalocean'] },
            instanceType: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'running', 'stopped', 'terminated'] },
            cpu: { type: 'integer' },
            memory: { type: 'integer' },
            storage: { type: 'integer' },
            monthlyPrice: { type: 'number' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Domain: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'active', 'expired', 'suspended'] },
            sslEnabled: { type: 'boolean' },
            expiresAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Deployment: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            repository: { type: 'string' },
            branch: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'building', 'deployed', 'failed'] },
            deployUrl: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
            path: { type: 'string' }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./src/routes/*.ts'], // paths to files containing OpenAPI definitions
};

const specs = swaggerJsdoc(options);

export const setupSwagger = (app: Express): void => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Sneaky Cloud API Documentation'
  }));
};