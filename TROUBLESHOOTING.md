# Troubleshooting Guide

This guide helps resolve common issues when deploying the Sneaky Hosting Platform across multiple machines.

## Quick Fix Commands

### For Database Server Issues
```bash
# Run this on your database server
./scripts/fix-database-deployment.sh
```

### For Dashboard Host Issues  
```bash
# Run this on your dashboard host
./scripts/fix-dashboard-deployment.sh
```

### Universal Quick Fix
```bash
# Works on both database and dashboard hosts
./scripts/quick-fix.sh
```

## Common Issues and Solutions

### 1. npm ci Error (Database Server)

**Error:**
```
npm error The `npm ci` command can only install with an existing package-lock.json
```

**Solution:**
```bash
# Fix the Dockerfile and create package-lock.json
sed -i 's/npm ci --only=production/npm install --only=production/g' sneaky-database/Dockerfile

# Rebuild the service
docker-compose -f docker-compose.database-server.yml build --no-cache database-monitor
docker-compose -f docker-compose.database-server.yml up -d
```

### 2. DATABASE_URL Environment Variable Not Found

**Error:**
```
Error: Environment variable not found: DATABASE_URL
```

**Solution:**
```bash
# On dashboard host, ensure .env.dashboard exists and contains DATABASE_URL
cat .env.dashboard | grep DATABASE_URL

# If missing, add it:
echo "DATABASE_URL=postgresql://sneaky_admin:your_password@db_host:5432/sneaky_hosting" >> .env.dashboard

# Create temporary .env for Prisma operations
cd sneaky-backend
echo "DATABASE_URL=postgresql://sneaky_admin:your_password@db_host:5432/sneaky_hosting" > .env
npx prisma generate
npx prisma migrate deploy
rm .env
cd ..
```

### 3. Database Connection Refused

**Error:**
```
Connection refused to database server
```

**Solutions:**

**Check Database Server Status:**
```bash
# On database server
docker logs sneaky-postgres
docker exec sneaky-postgres pg_isready -U sneaky_admin
```

**Check Firewall Rules:**
```bash
# On database server - allow dashboard host
sudo ufw allow from DASHBOARD_HOST_IP to any port 5432

# On dashboard host - test connectivity
telnet DATABASE_HOST_IP 5432
```

**Check PostgreSQL Configuration:**
```bash
# Ensure PostgreSQL is listening on all interfaces
docker exec sneaky-postgres cat /var/lib/postgresql/data/postgresql.conf | grep listen_addresses
```

### 4. Redis Connection Issues

**Error:**
```
Redis connection failed
```

**Solutions:**

**Check Redis Status:**
```bash
# On dashboard host (where Redis runs)
docker logs sneaky-redis
docker exec sneaky-redis redis-cli ping
```

**Test Redis with Password:**
```bash
# If using password authentication
docker exec sneaky-redis redis-cli -a your_redis_password ping
```

**Check Redis Configuration:**
```bash
# Verify Redis is accessible from database server
# On database server:
redis-cli -h DASHBOARD_HOST_IP -p 6379 -a your_redis_password ping
```

### 5. Frontend/Backend Not Starting

**Error:**
```
Service failed to start or not accessible
```

**Solutions:**

**Check Service Logs:**
```bash
docker logs sneaky-backend --tail 50
docker logs sneaky-frontend --tail 50
```

**Verify Port Availability:**
```bash
netstat -tuln | grep -E "(3000|3001)"
```

**Check Environment Variables:**
```bash
# Verify all required variables are set
docker exec sneaky-backend env | grep -E "(DATABASE_URL|REDIS|JWT)"
```

**Restart Services:**
```bash
docker-compose -f docker-compose.distributed.yml restart
```

### 6. Prisma Migration Issues

**Error:**
```
Migration failed or schema sync issues
```

**Solutions:**

**Reset and Recreate Database:**
```bash
# On dashboard host
cd sneaky-backend
echo "DATABASE_URL=your_database_url" > .env

# Reset database (WARNING: This deletes all data)
npx prisma migrate reset --force

# Or just deploy migrations
npx prisma migrate deploy

rm .env
cd ..
```

**Generate Prisma Client:**
```bash
cd sneaky-backend
echo "DATABASE_URL=your_database_url" > .env
npx prisma generate
rm .env
cd ..
```

## Step-by-Step Debugging

### 1. Verify Network Connectivity

```bash
# Test basic connectivity between machines
ping DATABASE_HOST_IP
ping DASHBOARD_HOST_IP

# Test specific ports
telnet DATABASE_HOST_IP 5432  # PostgreSQL
telnet DASHBOARD_HOST_IP 6379  # Redis
telnet DASHBOARD_HOST_IP 3001  # Backend API
```

### 2. Check Service Status

```bash
# On database server
docker-compose -f docker-compose.database-server.yml ps
docker-compose -f docker-compose.database-server.yml logs

# On dashboard host  
docker-compose -f docker-compose.distributed.yml ps
docker-compose -f docker-compose.distributed.yml logs
```

### 3. Verify Environment Configuration

```bash
# Check environment files exist and have correct values
cat .env.database    # On database server
cat .env.dashboard   # On dashboard host

# Verify Docker containers have correct environment
docker exec sneaky-postgres env
docker exec sneaky-backend env
```

### 4. Test Database Operations

```bash
# Connect to PostgreSQL directly
docker exec -it sneaky-postgres psql -U sneaky_admin -d sneaky_hosting

# Run test queries
\dt  # List tables
SELECT version();  # Check PostgreSQL version
SELECT count(*) FROM users;  # Test table access
```

### 5. Check Resource Usage

```bash
# Monitor system resources
htop
df -h
docker stats

# Check for out of memory or disk space issues
dmesg | grep -i "out of memory"
```

## Complete Reset Procedure

If all else fails, here's how to completely reset and redeploy:

### Database Server Reset

```bash
# Stop and remove everything
docker-compose -f docker-compose.database-server.yml down -v
docker system prune -f

# Remove environment file and start fresh
rm .env.database
./scripts/deploy-database-server.sh
```

### Dashboard Host Reset

```bash
# Stop and remove everything
docker-compose -f docker-compose.distributed.yml down -v
docker system prune -f

# Clean up node modules and builds
rm -rf sneaky-*/node_modules
rm -rf sneaky-*/dist
rm -rf sneaky-*/build

# Remove environment file and start fresh
rm .env.dashboard
./scripts/deploy-dashboard-host.sh
```

## Monitoring and Maintenance

### Health Check Commands

```bash
# Database server health
./scripts/test-connectivity.sh
docker exec sneaky-postgres pg_isready -U sneaky_admin

# Dashboard host health
curl http://localhost:3001/health
curl http://localhost:3000

# Resource monitoring
docker stats --no-stream
```

### Log Monitoring

```bash
# Follow logs in real-time
docker-compose -f docker-compose.database-server.yml logs -f
docker-compose -f docker-compose.distributed.yml logs -f

# Check specific service logs
docker logs sneaky-postgres -f
docker logs sneaky-backend -f
```

### Backup and Recovery

```bash
# Manual database backup
docker exec sneaky-postgres pg_dump -U sneaky_admin sneaky_hosting > backup.sql

# Restore from backup
docker exec -i sneaky-postgres psql -U sneaky_admin sneaky_hosting < backup.sql
```

## Getting Help

If you're still experiencing issues:

1. **Check the logs** - Most issues are revealed in the Docker logs
2. **Verify connectivity** - Use the test-connectivity.sh script
3. **Check environment variables** - Ensure all required variables are set correctly
4. **Review firewall rules** - Make sure ports are open between machines
5. **Monitor resources** - Ensure adequate CPU, memory, and disk space

### Useful Commands Reference

```bash
# Service management
docker-compose -f <compose-file> up -d     # Start services
docker-compose -f <compose-file> down      # Stop services  
docker-compose -f <compose-file> restart   # Restart services
docker-compose -f <compose-file> logs -f   # Follow logs

# Container management
docker ps                                   # List running containers
docker logs <container> --tail 50          # View recent logs
docker exec -it <container> bash           # Access container shell
docker stats                               # Monitor resource usage

# Network debugging
telnet <host> <port>                       # Test port connectivity
netstat -tuln                              # List listening ports
ss -tuln                                   # Alternative to netstat
```