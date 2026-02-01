#!/bin/bash

# Database Server Deployment Script
# Run this script on your dedicated database server

set -e

echo "🗄️  Setting up Sneaky Hosting Database Server..."

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "❌ Please don't run this script as root"
    exit 1
fi

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed. Aborting." >&2; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "❌ Docker Compose is required but not installed. Aborting." >&2; exit 1; }

# Stop any existing services first
echo "🛑 Stopping any existing services..."
docker-compose -f docker-compose.database-server.yml down 2>/dev/null || true

# Clean up any existing containers
docker rm -f sneaky-postgres sneaky-db-monitor postgres-exporter 2>/dev/null || true

# Create package-lock.json if missing
if [ ! -f "sneaky-database/package-lock.json" ]; then
    echo "📦 Creating package-lock.json for database service..."
    cd sneaky-database
    npm install --package-lock-only 2>/dev/null || echo "Using existing dependencies"
    cd ..
fi

# Get configuration from user
read -p "Enter database password (or press Enter for default): " DB_PASSWORD
DB_PASSWORD=${DB_PASSWORD:-sneaky_secure_2024}

read -p "Enter Redis host IP (dashboard server): " REDIS_HOST
if [ -z "$REDIS_HOST" ]; then
    echo "❌ Redis host IP is required"
    exit 1
fi

read -p "Enter Redis password: " REDIS_PASSWORD
REDIS_PASSWORD=${REDIS_PASSWORD:-sneaky_redis_2024}

# Create environment file
cat > .env.database << EOF
# Database Configuration
DB_NAME=sneaky_hosting
DB_USER=sneaky_admin
DB_PASSWORD=$DB_PASSWORD
DB_HOST=0.0.0.0
DB_PORT=5432

# Redis connection (points to dashboard host)
REDIS_HOST=$REDIS_HOST
REDIS_PORT=6379
REDIS_PASSWORD=$REDIS_PASSWORD

# Monitoring
NODE_ENV=production
EOF

echo "✅ Environment configuration created"

# Create backup directory
sudo mkdir -p /opt/sneaky-backups
sudo chown $USER:$USER /opt/sneaky-backups

# Create logs directory
mkdir -p logs

# Pull required images
echo "📦 Pulling Docker images..."
docker-compose -f docker-compose.database-server.yml pull

# Build services (this will handle the npm install)
echo "🏗️  Building database services..."
docker-compose -f docker-compose.database-server.yml --env-file .env.database build --no-cache

# Start services
echo "🚀 Starting database services..."
docker-compose -f docker-compose.database-server.yml --env-file .env.database up -d

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 10

# Check if PostgreSQL is running
if docker exec sneaky-postgres pg_isready -U sneaky_admin; then
    echo "✅ PostgreSQL is running successfully"
else
    echo "❌ PostgreSQL failed to start"
    docker logs sneaky-postgres
    exit 1
fi

# Setup firewall rules
echo "🔒 Configuring firewall..."
read -p "Enter dashboard host IP for firewall rules: " DASHBOARD_IP
if [ ! -z "$DASHBOARD_IP" ]; then
    sudo ufw allow from $DASHBOARD_IP to any port 5432 comment "PostgreSQL from dashboard"
    sudo ufw allow from $DASHBOARD_IP to any port 9187 comment "Postgres exporter"
    sudo ufw --force enable
    echo "✅ Firewall rules configured"
fi

# Create backup script
cat > /opt/sneaky-backups/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/sneaky-backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="sneaky_hosting"
DB_USER="sneaky_admin"

echo "Starting backup at $(date)"

# Create backup
if docker exec sneaky-postgres pg_dump -U $DB_USER $DB_NAME > $BACKUP_DIR/sneaky_backup_$DATE.sql; then
    # Compress backup
    gzip $BACKUP_DIR/sneaky_backup_$DATE.sql
    echo "✅ Backup completed: sneaky_backup_$DATE.sql.gz"
    
    # Keep only last 7 days of backups
    find $BACKUP_DIR -name "sneaky_backup_*.sql.gz" -mtime +7 -delete
    echo "🧹 Old backups cleaned up"
else
    echo "❌ Backup failed"
    exit 1
fi
EOF

chmod +x /opt/sneaky-backups/backup.sh

# Setup cron job for daily backups
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/sneaky-backups/backup.sh >> /opt/sneaky-backups/backup.log 2>&1") | crontab -

echo "✅ Backup script created and scheduled"

# Display status
echo ""
echo "🎉 Database server setup completed!"
echo ""
echo "📊 Service Status:"
docker-compose -f docker-compose.database-server.yml ps

echo ""
echo "🔗 Connection Details:"
echo "  Database Host: $(hostname -I | awk '{print $1}')"
echo "  Database Port: 5432"
echo "  Database Name: sneaky_hosting"
echo "  Database User: sneaky_admin"
echo "  Monitoring Port: 9187"

echo ""
echo "📝 Next Steps:"
echo "1. Note down the database connection details above"
echo "2. Use these details when setting up the dashboard host"
echo "3. Monitor logs: docker logs sneaky-postgres -f"
echo "4. Check backups: ls -la /opt/sneaky-backups/"

echo ""
echo "🔧 Useful Commands:"
echo "  View logs: docker-compose -f docker-compose.database-server.yml logs -f"
echo "  Stop services: docker-compose -f docker-compose.database-server.yml down"
echo "  Restart services: docker-compose -f docker-compose.database-server.yml restart"
echo "  Manual backup: /opt/sneaky-backups/backup.sh"