# Single Server Deployment Guide

Deploy the complete Sneaky Hosting Platform on a single server - perfect for development, testing, or small-scale production environments.

## 🚀 Quick Start

```bash
# Clone the repository
git clone <your-repo-url>
cd sneaky-hosting-platform

# Make scripts executable
chmod +x scripts/*.sh

# Run the single server deployment
./scripts/deploy-single-server.sh
```

That's it! The script will guide you through the setup process.

## 📋 What Gets Deployed

The single server deployment includes all components:

- **PostgreSQL Database** - Data storage
- **Redis Cache** - Session storage and caching
- **Backend API** - Node.js/Express server
- **Frontend Dashboard** - React application
- **Database Monitor** - Health monitoring and metrics

## 🔧 Configuration Options

During deployment, you'll be prompted for:

- **JWT Secret** - Authentication security (auto-generated if not provided)
- **Database Password** - PostgreSQL password
- **Redis Password** - Redis authentication
- **Domain/IP** - Your server's domain or IP address
- **Email Settings** - For notifications (optional)

## 📊 Service Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Single Server                        │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  Frontend   │  │   Backend   │  │ PostgreSQL  │    │
│  │   :3000     │◄─┤    :3001    │◄─┤   :5432     │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
│                           │                             │
│                    ┌─────────────┐                     │
│                    │    Redis    │                     │
│                    │    :6379    │                     │
│                    └─────────────┘                     │
└─────────────────────────────────────────────────────────┘
```

## 🌐 Access Points

After deployment, access your platform at:

- **Frontend Dashboard**: http://your-server:3000
- **Backend API**: http://your-server:3001
- **API Documentation**: http://your-server:3001/api-docs
- **Health Check**: http://your-server:3001/health

## 🛠️ Management Commands

The deployment creates a management script for easy operations:

```bash
# Start all services
./manage-sneaky.sh start

# Stop all services
./manage-sneaky.sh stop

# Restart services
./manage-sneaky.sh restart

# Check service status and health
./manage-sneaky.sh status

# View service logs
./manage-sneaky.sh logs

# Create database backup
./manage-sneaky.sh backup

# Update platform (pull latest code and rebuild)
./manage-sneaky.sh update
```

## 💾 Backup & Recovery

### Automated Backups

The deployment automatically sets up:
- Daily database backups at 2 AM
- 7-day backup retention
- Compressed backup files in `./backups/` directory

### Manual Backup

```bash
# Create immediate backup
./manage-sneaky.sh backup

# Or use the backup script directly
./backup-database.sh
```

### Restore from Backup

```bash
# Stop services
./manage-sneaky.sh stop

# Restore database
gunzip -c backups/sneaky_backup_YYYYMMDD_HHMMSS.sql.gz | \
docker exec -i sneaky-postgres psql -U sneaky_admin sneaky_hosting

# Start services
./manage-sneaky.sh start
```

## 📈 Monitoring

### Service Health

```bash
# Check all service health
./manage-sneaky.sh status

# Check individual services
docker logs sneaky-backend --tail 50
docker logs sneaky-frontend --tail 50
docker logs sneaky-postgres --tail 50
docker logs sneaky-redis --tail 50
```

### Resource Monitoring

```bash
# Monitor Docker container resources
docker stats

# Check system resources
htop
df -h
```

### Application Monitoring

- **Health Endpoint**: http://your-server:3001/health
- **API Documentation**: http://your-server:3001/api-docs
- **Database Metrics**: Available through the backend API

## 🔒 Security Considerations

### Firewall Configuration

The deployment script automatically configures basic firewall rules:

```bash
# Allow web traffic
sudo ufw allow 3000  # Frontend
sudo ufw allow 3001  # Backend API

# SSH access (ensure this is configured before enabling firewall)
sudo ufw allow ssh
```

### Production Security Checklist

For production deployments, consider:

- [ ] Change default passwords
- [ ] Configure SSL/TLS certificates
- [ ] Set up proper domain names
- [ ] Configure email notifications
- [ ] Set up monitoring and alerting
- [ ] Regular security updates
- [ ] Database access restrictions
- [ ] API rate limiting (already included)

## 🔧 Customization

### Environment Variables

Edit the `.env` file to customize:

```env
# Database settings
POSTGRES_PASSWORD=your_secure_password

# Application settings
JWT_SECRET=your_jwt_secret
FRONTEND_URL=https://your-domain.com

# Email notifications
EMAIL_HOST=smtp.your-provider.com
EMAIL_USER=your-email@domain.com
EMAIL_PASSWORD=your-email-password

# Cloud provider settings (optional)
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret

# Payment processing (optional)
STRIPE_SECRET_KEY=your_stripe_key
```

### SSL/HTTPS Setup

For production with SSL:

1. **Get SSL certificates** (Let's Encrypt recommended):
```bash
sudo apt install certbot
sudo certbot certonly --standalone -d your-domain.com
```

2. **Update nginx configuration** in `sneaky-frontend/nginx.conf`

3. **Rebuild frontend**:
```bash
docker-compose build frontend
docker-compose up -d frontend
```

## 🚨 Troubleshooting

### Common Issues

**Services won't start:**
```bash
# Check Docker status
docker ps -a

# Check logs
./manage-sneaky.sh logs

# Restart services
./manage-sneaky.sh restart
```

**Database connection issues:**
```bash
# Check PostgreSQL
docker exec sneaky-postgres pg_isready -U sneaky_admin

# Check database logs
docker logs sneaky-postgres
```

**Frontend not accessible:**
```bash
# Check if port is open
netstat -tuln | grep 3000

# Check frontend logs
docker logs sneaky-frontend
```

### Performance Optimization

**For better performance:**

1. **Increase Docker resources** (if using Docker Desktop)
2. **Optimize PostgreSQL settings** in docker-compose.yml
3. **Enable Redis persistence** for better caching
4. **Use SSD storage** for database volumes

### Scaling Considerations

**When you outgrow single server:**

1. **Move to multi-server setup** using the multi-machine deployment scripts
2. **Add load balancer** for multiple frontend instances
3. **Separate database server** for better performance
4. **Use managed services** (RDS, ElastiCache, etc.)

## 📞 Support

If you encounter issues:

1. **Check the logs**: `./manage-sneaky.sh logs`
2. **Verify service health**: `./manage-sneaky.sh status`
3. **Review troubleshooting guide**: `TROUBLESHOOTING.md`
4. **Check Docker resources**: `docker stats`
5. **Verify network connectivity**: Test ports 3000, 3001

## 🎯 Next Steps

After successful deployment:

1. **Access the dashboard** at http://your-server:3000
2. **Create your first user account**
3. **Explore the API documentation** at http://your-server:3001/api-docs
4. **Set up monitoring and alerts**
5. **Configure backup verification**
6. **Plan for scaling** as your needs grow

Your enterprise hosting platform is now ready for use!