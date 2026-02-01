# Multi-Machine Deployment Guide

This guide explains how to deploy the Sneaky Hosting Platform across multiple machines for better performance, scalability, and resource distribution.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Database      │    │   Dashboard     │    │   Load          │
│   Server        │    │   Host          │    │   Balancer      │
│                 │    │                 │    │   (Optional)    │
│ • PostgreSQL    │◄───┤ • Frontend      │◄───┤ • Nginx         │
│ • DB Monitor    │    │ • Backend API   │    │ • HAProxy       │
│ • Backups       │    │ • Redis Cache   │    │ • CloudFlare    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Machine Requirements

### Database Server
- **CPU**: 4+ cores
- **RAM**: 8GB+ (16GB recommended)
- **Storage**: SSD with 100GB+ free space
- **Network**: Gigabit connection
- **OS**: Ubuntu 20.04+ or CentOS 8+

### Dashboard Host
- **CPU**: 2+ cores
- **RAM**: 4GB+ (8GB recommended)
- **Storage**: 50GB+ free space
- **Network**: Gigabit connection
- **OS**: Ubuntu 20.04+ or CentOS 8+

## Step-by-Step Setup

### 1. Database Server Setup

**Machine 1 (Database Server - e.g., 192.168.1.100)**

```bash
# Clone the repository
git clone <repository-url>
cd sneaky-hosting-platform

# Create environment file for database server
cat > .env.database << EOF
# Database Configuration
DB_NAME=sneaky_hosting
DB_USER=sneaky_admin
DB_PASSWORD=your_secure_database_password_here
DB_HOST=0.0.0.0
DB_PORT=5432

# Redis connection (points to dashboard host)
REDIS_HOST=192.168.1.101
REDIS_PORT=6379
REDIS_PASSWORD=your_secure_redis_password_here

# Monitoring
NODE_ENV=production
EOF

# Start database services
docker-compose -f docker-compose.database-server.yml --env-file .env.database up -d

# Verify database is running
docker logs sneaky-postgres
docker logs sneaky-db-monitor
```

### 2. Dashboard Host Setup

**Machine 2 (Dashboard Host - e.g., 192.168.1.101)**

```bash
# Clone the repository
git clone <repository-url>
cd sneaky-hosting-platform

# Create environment file for dashboard host
cat > .env.dashboard << EOF
# Database Connection (points to database server)
DB_HOST=192.168.1.100
DB_PORT=5432
DB_NAME=sneaky_hosting
DB_USER=sneaky_admin
DB_PASSWORD=your_secure_database_password_here
DATABASE_URL=postgresql://sneaky_admin:your_secure_database_password_here@192.168.1.100:5432/sneaky_hosting

# Local Redis
REDIS_PASSWORD=your_secure_redis_password_here

# Application Configuration
NODE_ENV=production
JWT_SECRET=your_super_secure_jwt_secret_change_in_production
FRONTEND_URL=http://192.168.1.101:3000
REACT_APP_API_URL=http://192.168.1.101:3001
REACT_APP_WS_URL=ws://192.168.1.101:3001

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# AWS Configuration (if using)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=sneaky-hosting-assets
EOF

# Start dashboard services
docker-compose -f docker-compose.distributed.yml --env-file .env.dashboard up -d

# Verify services are running
docker logs sneaky-backend
docker logs sneaky-frontend
docker logs sneaky-redis
```

### 3. Network Configuration

**Configure Firewall Rules:**

**Database Server (192.168.1.100):**
```bash
# Allow PostgreSQL access from dashboard host
sudo ufw allow from 192.168.1.101 to any port 5432
sudo ufw allow from 192.168.1.101 to any port 9187  # Postgres exporter

# Allow SSH for management
sudo ufw allow ssh
sudo ufw enable
```

**Dashboard Host (192.168.1.101):**
```bash
# Allow web traffic
sudo ufw allow 3000  # Frontend
sudo ufw allow 3001  # Backend API

# Allow Redis access from database server (for monitoring)
sudo ufw allow from 192.168.1.100 to any port 6379

# Allow SSH for management
sudo ufw allow ssh
sudo ufw enable
```

### 4. Database Migration and Setup

**Run from Dashboard Host:**
```bash
# Generate Prisma client
cd sneaky-backend
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# Seed initial data (optional)
npx prisma db seed
```

### 5. SSL/TLS Configuration (Production)

**Update nginx configuration for HTTPS:**

```bash
# On dashboard host, create SSL configuration
cat > sneaky-frontend/nginx-ssl.conf << 'EOF'
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    root /usr/share/nginx/html;
    index index.html;
    
    # Rest of your nginx configuration...
}
EOF
```

## Environment Variables Reference

### Database Server (.env.database)
```env
DB_NAME=sneaky_hosting
DB_USER=sneaky_admin
DB_PASSWORD=secure_password
REDIS_HOST=dashboard_host_ip
REDIS_PORT=6379
REDIS_PASSWORD=redis_password
```

### Dashboard Host (.env.dashboard)
```env
DATABASE_URL=postgresql://user:pass@db_host:5432/db_name
REDIS_PASSWORD=redis_password
JWT_SECRET=jwt_secret
FRONTEND_URL=http://dashboard_host:3000
REACT_APP_API_URL=http://dashboard_host:3001
```

## Monitoring and Health Checks

### Database Server Monitoring
```bash
# Check database status
docker exec sneaky-postgres pg_isready -U sneaky_admin

# Monitor database performance
docker exec sneaky-postgres psql -U sneaky_admin -d sneaky_hosting -c "
SELECT 
    datname,
    numbackends,
    xact_commit,
    xact_rollback,
    blks_read,
    blks_hit
FROM pg_stat_database 
WHERE datname = 'sneaky_hosting';"

# Check database size
docker exec sneaky-postgres psql -U sneaky_admin -d sneaky_hosting -c "
SELECT pg_size_pretty(pg_database_size('sneaky_hosting'));"
```

### Dashboard Host Monitoring
```bash
# Check service status
docker ps
docker logs sneaky-backend --tail 50
docker logs sneaky-frontend --tail 50

# Check Redis status
docker exec sneaky-redis redis-cli ping

# Monitor resource usage
docker stats
```

## Backup Strategy

### Database Backups (Automated)
```bash
# Create backup script on database server
cat > /opt/backup-database.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="sneaky_hosting"
DB_USER="sneaky_admin"

# Create backup
docker exec sneaky-postgres pg_dump -U $DB_USER $DB_NAME > $BACKUP_DIR/sneaky_backup_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/sneaky_backup_$DATE.sql

# Keep only last 7 days of backups
find $BACKUP_DIR -name "sneaky_backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: sneaky_backup_$DATE.sql.gz"
EOF

chmod +x /opt/backup-database.sh

# Add to crontab for daily backups at 2 AM
echo "0 2 * * * /opt/backup-database.sh" | crontab -
```

## Scaling Considerations

### Adding More Dashboard Hosts
1. Deploy additional dashboard hosts with same configuration
2. Use a load balancer (Nginx/HAProxy) to distribute traffic
3. Ensure Redis is accessible from all dashboard hosts

### Database Scaling
1. **Read Replicas**: Add PostgreSQL read replicas for read-heavy workloads
2. **Connection Pooling**: Use PgBouncer for connection management
3. **Partitioning**: Partition large tables by organization or date

### Load Balancer Configuration
```nginx
upstream backend {
    server 192.168.1.101:3001;
    server 192.168.1.102:3001;
    server 192.168.1.103:3001;
}

upstream frontend {
    server 192.168.1.101:3000;
    server 192.168.1.102:3000;
    server 192.168.1.103:3000;
}

server {
    listen 80;
    
    location /api {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Troubleshooting

### Common Issues

1. **Connection Refused Errors**
   - Check firewall rules
   - Verify service is running on correct port
   - Test network connectivity: `telnet host port`

2. **Database Connection Issues**
   - Verify DATABASE_URL format
   - Check PostgreSQL logs
   - Ensure database server is accessible

3. **Redis Connection Issues**
   - Check Redis password configuration
   - Verify Redis is bound to correct interface
   - Test Redis connectivity: `redis-cli -h host -p port ping`

### Useful Commands
```bash
# Test database connection
psql "postgresql://user:pass@host:5432/dbname" -c "SELECT version();"

# Test Redis connection
redis-cli -h host -p port -a password ping

# Check service logs
docker logs container_name --tail 100 -f

# Monitor resource usage
htop
iotop
nethogs
```

This distributed setup provides better performance, scalability, and fault tolerance compared to running everything on a single machine.