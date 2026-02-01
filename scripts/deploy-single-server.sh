#!/bin/bash

# Single Server Deployment Script
# Deploy the entire Sneaky Hosting Platform on one server

set -e

echo "🚀 Deploying Sneaky Hosting Platform on Single Server"
echo "===================================================="

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "❌ Please don't run this script as root"
    exit 1
fi

# Check prerequisites
echo "🔍 Checking prerequisites..."
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed. Aborting." >&2; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "❌ Docker Compose is required but not installed. Aborting." >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Aborting." >&2; exit 1; }

echo "✅ Prerequisites check passed"

# Stop any existing services
echo "🛑 Stopping any existing services..."
docker-compose down 2>/dev/null || true
docker rm -f $(docker ps -aq --filter "name=sneaky") 2>/dev/null || true

# Get configuration from user
echo ""
echo "📝 Configuration Setup"
echo "====================="

read -p "Enter JWT Secret (or press Enter to generate): " JWT_SECRET
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "sneaky-jwt-secret-$(date +%s)")
    echo "🔑 Generated JWT Secret: $JWT_SECRET"
fi

read -p "Enter database password (or press Enter for default): " DB_PASSWORD
DB_PASSWORD=${DB_PASSWORD:-sneaky_secure_2024}

read -p "Enter Redis password (or press Enter for default): " REDIS_PASSWORD
REDIS_PASSWORD=${REDIS_PASSWORD:-sneaky_redis_2024}

read -p "Enter your domain/IP (or press Enter for localhost): " DOMAIN_NAME
if [ -z "$DOMAIN_NAME" ]; then
    DOMAIN_NAME="localhost"
fi

read -p "Enter email host (optional, for notifications): " EMAIL_HOST
read -p "Enter email user (optional): " EMAIL_USER
read -p "Enter email password (optional): " EMAIL_PASSWORD

# Create environment file
echo ""
echo "📝 Creating environment configuration..."
cat > .env << EOF
# Database Configuration
DATABASE_URL=postgresql://sneaky_admin:$DB_PASSWORD@postgres:5432/sneaky_hosting
POSTGRES_DB=sneaky_hosting
POSTGRES_USER=sneaky_admin
POSTGRES_PASSWORD=$DB_PASSWORD

# Redis Configuration
REDIS_URL=redis://:$REDIS_PASSWORD@redis:6379
REDIS_PASSWORD=$REDIS_PASSWORD

# Application Configuration
NODE_ENV=production
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# Server Configuration
PORT=3001
FRONTEND_URL=http://$DOMAIN_NAME:3000
REACT_APP_API_URL=http://$DOMAIN_NAME:3001
REACT_APP_WS_URL=ws://$DOMAIN_NAME:3001

# Email Configuration (optional)
EMAIL_HOST=${EMAIL_HOST:-smtp.gmail.com}
EMAIL_PORT=587
EMAIL_USER=$EMAIL_USER
EMAIL_PASSWORD=$EMAIL_PASSWORD

# Monitoring Configuration
METRICS_INTERVAL=30000
CPU_ALERT_THRESHOLD=80
MEMORY_ALERT_THRESHOLD=85
DISK_ALERT_THRESHOLD=90

# AWS Configuration (optional - for production features)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_S3_BUCKET=

# Stripe Configuration (optional - for billing features)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
EOF

echo "✅ Environment configuration created"

# Create package-lock.json files if missing
echo "📦 Ensuring package-lock.json files exist..."
for dir in sneaky-backend sneaky-frontend sneaky-database; do
    if [ -d "$dir" ] && [ ! -f "$dir/package-lock.json" ]; then
        echo "  Creating package-lock.json for $dir..."
        cd $dir
        npm install --package-lock-only 2>/dev/null || echo "  Using existing dependencies"
        cd ..
    fi
done

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install service dependencies
echo "📦 Installing service dependencies..."
cd sneaky-backend && npm install && cd ..
cd sneaky-frontend && npm install && cd ..
cd sneaky-database && npm install && cd ..

# Generate Prisma client
echo "🔧 Generating Prisma client..."
cd sneaky-backend
npx prisma generate
cd ..

# Build applications
echo "🏗️  Building applications..."
cd sneaky-backend && npm run build && cd ..
cd sneaky-frontend && npm run build && cd ..
cd sneaky-database && npm run build && cd ..

# Start services with Docker Compose
echo "🚀 Starting all services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 30

# Run database migrations
echo "🗄️  Running database migrations..."
cd sneaky-backend
npx prisma migrate deploy 2>/dev/null || echo "⚠️  Migrations may need manual setup"
cd ..

# Check service health
echo ""
echo "🏥 Checking service health..."

# Check PostgreSQL
if docker exec sneaky-postgres pg_isready -U sneaky_admin >/dev/null 2>&1; then
    echo "✅ PostgreSQL is running"
else
    echo "❌ PostgreSQL failed to start"
    docker logs sneaky-postgres --tail 10
fi

# Check Redis
if docker exec sneaky-redis redis-cli -a $REDIS_PASSWORD ping >/dev/null 2>&1; then
    echo "✅ Redis is running"
else
    echo "❌ Redis failed to start"
    docker logs sneaky-redis --tail 10
fi

# Check Backend API (with retries)
backend_ready=false
for i in {1..10}; do
    if curl -f http://localhost:3001/health >/dev/null 2>&1; then
        echo "✅ Backend API is running"
        backend_ready=true
        break
    else
        echo "⏳ Waiting for backend API... (attempt $i/10)"
        sleep 5
    fi
done

if [ "$backend_ready" = false ]; then
    echo "❌ Backend API failed to start"
    echo "Backend logs:"
    docker logs sneaky-backend --tail 20
fi

# Check Frontend
if curl -f http://localhost:3000 >/dev/null 2>&1; then
    echo "✅ Frontend is running"
else
    echo "⚠️  Frontend may still be starting up"
fi

# Setup firewall (if ufw is available)
if command -v ufw >/dev/null 2>&1; then
    echo "🔒 Configuring firewall..."
    sudo ufw allow 3000 comment "Sneaky Frontend" 2>/dev/null || true
    sudo ufw allow 3001 comment "Sneaky Backend API" 2>/dev/null || true
    echo "✅ Firewall configured"
fi

# Create management script
echo "🔧 Creating management script..."
cat > manage-sneaky.sh << 'EOF'
#!/bin/bash

case "$1" in
    start)
        echo "🚀 Starting Sneaky Hosting Platform..."
        docker-compose up -d
        ;;
    stop)
        echo "🛑 Stopping Sneaky Hosting Platform..."
        docker-compose down
        ;;
    restart)
        echo "🔄 Restarting Sneaky Hosting Platform..."
        docker-compose restart
        ;;
    status)
        echo "📊 Sneaky Hosting Platform Status:"
        docker-compose ps
        echo ""
        echo "🔗 Service Health:"
        curl -f http://localhost:3001/health >/dev/null 2>&1 && echo "✅ Backend API: Healthy" || echo "❌ Backend API: Unhealthy"
        curl -f http://localhost:3000 >/dev/null 2>&1 && echo "✅ Frontend: Healthy" || echo "❌ Frontend: Unhealthy"
        docker exec sneaky-redis redis-cli ping >/dev/null 2>&1 && echo "✅ Redis: Healthy" || echo "❌ Redis: Unhealthy"
        docker exec sneaky-postgres pg_isready -U sneaky_admin >/dev/null 2>&1 && echo "✅ PostgreSQL: Healthy" || echo "❌ PostgreSQL: Unhealthy"
        ;;
    logs)
        docker-compose logs -f
        ;;
    backup)
        echo "💾 Creating database backup..."
        mkdir -p backups
        docker exec sneaky-postgres pg_dump -U sneaky_admin sneaky_hosting > backups/sneaky_backup_$(date +%Y%m%d_%H%M%S).sql
        echo "✅ Backup created in backups/ directory"
        ;;
    update)
        echo "🔄 Updating Sneaky Hosting Platform..."
        git pull
        docker-compose down
        docker-compose build --no-cache
        docker-compose up -d
        ;;
    *)
        echo "Sneaky Hosting Platform Management"
        echo "Usage: $0 {start|stop|restart|status|logs|backup|update}"
        echo ""
        echo "Commands:"
        echo "  start   - Start all services"
        echo "  stop    - Stop all services"
        echo "  restart - Restart all services"
        echo "  status  - Show service status and health"
        echo "  logs    - Follow service logs"
        echo "  backup  - Create database backup"
        echo "  update  - Update and rebuild platform"
        exit 1
        ;;
esac
EOF

chmod +x manage-sneaky.sh

# Create backup script
echo "💾 Setting up automated backups..."
cat > backup-database.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

echo "Creating backup at $(date)"
if docker exec sneaky-postgres pg_dump -U sneaky_admin sneaky_hosting > $BACKUP_DIR/sneaky_backup_$DATE.sql; then
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

chmod +x backup-database.sh

# Setup daily backup cron job
(crontab -l 2>/dev/null; echo "0 2 * * * $(pwd)/backup-database.sh >> $(pwd)/backup.log 2>&1") | crontab - 2>/dev/null || echo "⚠️  Could not setup automatic backups (cron not available)"

# Display final status
echo ""
echo "🎉 Sneaky Hosting Platform Deployment Complete!"
echo "=============================================="
echo ""
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "🌐 Access URLs:"
echo "  🖥️  Frontend Dashboard: http://$DOMAIN_NAME:3000"
echo "  🔌 Backend API: http://$DOMAIN_NAME:3001"
echo "  📚 API Documentation: http://$DOMAIN_NAME:3001/api-docs"
echo "  ❤️  Health Check: http://$DOMAIN_NAME:3001/health"

echo ""
echo "🔧 Management Commands:"
echo "  ./manage-sneaky.sh start     # Start all services"
echo "  ./manage-sneaky.sh stop      # Stop all services"
echo "  ./manage-sneaky.sh status    # Check service health"
echo "  ./manage-sneaky.sh logs      # View service logs"
echo "  ./manage-sneaky.sh backup    # Create database backup"

echo ""
echo "📁 Important Files:"
echo "  .env                 # Environment configuration"
echo "  docker-compose.yml   # Service definitions"
echo "  manage-sneaky.sh     # Management script"
echo "  backup-database.sh   # Backup script"

echo ""
echo "🔍 Troubleshooting:"
echo "  Check logs: ./manage-sneaky.sh logs"
echo "  Check status: ./manage-sneaky.sh status"
echo "  Restart services: ./manage-sneaky.sh restart"

echo ""
echo "✅ Your enterprise hosting platform is ready!"
echo "🚀 Visit http://$DOMAIN_NAME:3000 to get started"