import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    url: process.env.DATABASE_URL || 'postgresql://sneaky_admin:sneaky_secure_2024@localhost:5432/sneaky_hosting'
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  },
  
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:3000'
  },
  
  email: {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    user: process.env.EMAIL_USER || '',
    password: process.env.EMAIL_PASSWORD || ''
  },
  
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || ''
  },
  
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    region: process.env.AWS_REGION || 'us-east-1',
    s3Bucket: process.env.AWS_S3_BUCKET || 'sneaky-hosting-assets'
  },
  
  monitoring: {
    metricsInterval: parseInt(process.env.METRICS_INTERVAL || '30000', 10), // 30 seconds
    alertThresholds: {
      cpu: parseInt(process.env.CPU_ALERT_THRESHOLD || '80', 10),
      memory: parseInt(process.env.MEMORY_ALERT_THRESHOLD || '85', 10),
      disk: parseInt(process.env.DISK_ALERT_THRESHOLD || '90', 10)
    }
  }
};