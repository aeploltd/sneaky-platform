# Sneaky Hosting Platform - Deployment Guide

## Production Deployment

### Prerequisites

- Docker & Docker Compose
- Domain name with DNS access
- SSL certificates (Let's Encrypt recommended)
- Cloud provider account (AWS/GCP/Azure)

### Environment Configuration

1. **Create production environment file:**
```bash
cp .env.example .env.production
```

2. **Update production variables:**
```env
NODE_ENV=production
DATABASE_URL=postgresql://user:password@prod-db:5432/sneaky_hosting
REDIS_URL=redis://prod-redis:6379
JWT_SECRET=your-super-secure-production-jwt-secret
FRONTEND_URL=https://your-domain.com

# Email configuration
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=your-sendgrid-api-key

# Stripe configuration
STRIPE_SECRET_KEY=sk_live_your_live_stripe_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# AWS configuration
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-production-bucket
```

### Docker Production Setup

1. **Create production Docker Compose file:**
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: sneaky_hosting
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

  backend:
    build:
      context: ./sneaky-backend
      dockerfile: Dockerfile.prod
    environment:
      NODE_ENV: production
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  frontend:
    build:
      context: ./sneaky-frontend
      dockerfile: Dockerfile.prod
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
    volumes:
      - ./ssl:/etc/nginx/ssl
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

2. **Deploy to production:**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Kubernetes Deployment

1. **Create namespace:**
```bash
kubectl create namespace sneaky-hosting
```

2. **Apply configurations:**
```bash
kubectl apply -f k8s/
```

### Monitoring & Logging

1. **Set up monitoring:**
- Prometheus for metrics
- Grafana for dashboards
- AlertManager for alerts

2. **Configure logging:**
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Or use cloud logging services

### Security Checklist

- [ ] SSL/TLS certificates configured
- [ ] Database credentials secured
- [ ] API keys in environment variables
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Security headers implemented
- [ ] Regular security updates scheduled

### Backup Strategy

1. **Database backups:**
```bash
# Daily automated backups
0 2 * * * pg_dump $DATABASE_URL > /backups/db_$(date +%Y%m%d).sql
```

2. **File backups:**
```bash
# S3 sync for uploaded files
aws s3 sync /app/uploads s3://your-backup-bucket/uploads
```

### Performance Optimization

1. **Database optimization:**
- Connection pooling
- Query optimization
- Proper indexing

2. **Caching strategy:**
- Redis for session storage
- CDN for static assets
- Application-level caching

3. **Load balancing:**
- Multiple backend instances
- Database read replicas
- CDN integration

### Scaling Considerations

1. **Horizontal scaling:**
- Multiple backend instances
- Load balancer configuration
- Session store externalization

2. **Database scaling:**
- Read replicas
- Connection pooling
- Query optimization

3. **Monitoring scaling:**
- Resource usage tracking
- Performance metrics
- Auto-scaling rules