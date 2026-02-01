#!/bin/bash

# Dashboard Host Deployment Script
# Run this script on your dashboard/frontend server

set -e

echo "🖥️  Setting up Sneaky Hosting Dashboard Host..."

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "❌ Please don't run this script as root"
    exit 1
fi

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed. Aborting." >&2; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "❌ Docker Compose is required but not installed. Aborting." >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Aborting." >&2; exit 1; }

# Get configuration from user
echo "📝 Please provide the following configuration details:"

read -p "Database Host IP: " DB_HOST
if [ -z "$DB_HOST" ]; then
    echo "❌ Database host IP is required"
    exit 1
fi

read -p "Database Password: " DB_PASSWORD
if [ -z "$DB_PASSWORD" ]; then
    echo "❌ Database password is required"
    exit 1
fi

read -p "Redis Password (or press Enter for default): " REDIS_PASSWORD
REDIS_PASSWORD=${REDIS_PASSWORD:-sneaky_redis_2024}

read -p "JWT Secret (or press Enter to generate): " JWT_SECRET
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(openssl rand -base64 32)
    echo "🔑 Generated JWT Secret: $JWT_SECRET"
fi

read -p "Domain name (or press Enter for IP): " DOMAIN_NAME
if [ -z "$DOMAIN_NAME" ]; then
    DOMAIN_NAME=$(hostname -I | awk '{print $1}')
fi

read -p "Email Host (optional): " EMAIL_HOST
read -p "Email User (optional): " EMAIL_USER
read -p "Email Password (optional): " EMAIL_PASSWORD

# Create environment file
cat > .env.dashboard << EOF
# Database Connection
DB_HOST=$DB_HOST
DB_PORT=5432
DB_NAME=sneaky_hosting
DB_USER=sneaky_admin
DB_PASSWORD=$DB_PASSWORD
DATABASE_URL=postgresql://sneaky_admin:$DB_PASSWORD@$DB_HOST:5432/sneaky_hosting

# Local Redis
REDIS_PASSWORD=$REDIS_PASSWORD

# Application Configuration
NODE_ENV=production
JWT_SECRET=$JWT_SECRET
FRONTEND_URL=http://$DOMAIN_NAME:3000
REACT_APP_API_URL=http://$DOMAIN_NAME:3001
REACT_APP_WS_URL=ws://$DOMAIN_NAME:3001

# Email Configuration
EMAIL_HOST=${EMAIL_HOST:-smtp.gmail.com}
EMAIL_PORT=587
EMAIL_USER=$EMAIL_USER
EMAIL_PASSWORD=$EMAIL_PASSWORD

# Monitoring
METRICS_INTERVAL=30000
CPU_ALERT_THRESHOLD=80
MEMORY_ALERT_THRESHOLD=85
DISK_ALERT_THRESHOLD=90
EOF

echo "✅ Environment configuration created"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

cd sneaky-backend
npm install
cd ..

cd sneaky-frontend
npm install
cd ..

cd sneaky-database
npm install
cd ..

# Generate Prisma client
echo "🔧 Generating Prisma client..."
cd sneaky-backend
npx prisma generate
cd ..

# Test database connection
echo "🔍 Testing database connection..."
cd sneaky-backend
if npx prisma db pull --force; then
    echo "✅ Database connection successful"
else
    echo "❌ Database connection failed. Please check your database server and credentials."
    exit 1
fi
cd ..

# Run database migrations
echo "🗄️  Running database migrations..."
cd sneaky-backend
npx prisma migrate deploy
cd ..

# Build applications
echo "🏗️  Building applications..."
cd sneaky-backend
npm run build
cd ..

cd sneaky-frontend
npm run build
cd ..

cd sneaky-database
npm run build
cd ..

# Pull required images
echo "📦 Pulling Docker images..."
docker-compose -f docker-compose.distributed.yml pull

# Start services
echo "🚀 Starting dashboard services..."
docker-compose -f docker-compose.distributed.yml --env-file .env.dashboard up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 15

# Check service health
echo "🏥 Checking service health..."

# Check Redis
if docker exec sneaky-redis redis-cli -a $REDIS_PASSWORD ping > /dev/null 2>&1; then
    echo "✅ Redis is running"
else
    echo "❌ Redis failed to start"
    docker logs sneaky-redis
fi

# Check Backend
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ Backend API is running"
else
    echo "❌ Backend API failed to start"
    docker logs sneaky-backend
fi

# Check Frontend
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Frontend is running"
else
    echo "❌ Frontend failed to start"
    docker logs sneaky-frontend
fi

# Setup firewall rules
echo "🔒 Configuring firewall..."
sudo ufw allow 3000 comment "Sneaky Frontend"
sudo ufw allow 3001 comment "Sneaky Backend API"
sudo ufw allow from $DB_HOST to any port 6379 comment "Redis from database server"
sudo ufw --force enable
echo "✅ Firewall rules configured"

# Create monitoring script
cat > /opt/monitor-services.sh << 'EOF'
#!/bin/bash

echo "=== Sneaky Hosting Platform Status ==="
echo "Date: $(date)"
echo ""

echo "🐳 Docker Services:"
docker-compose -f docker-compose.distributed.yml ps

echo ""
echo "💾 Resource Usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

echo ""
echo "🔗 Service Health:"
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ Backend API: Healthy"
else
    echo "❌ Backend API: Unhealthy"
fi

if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Frontend: Healthy"
else
    echo "❌ Frontend: Unhealthy"
fi

if docker exec sneaky-redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis: Healthy"
else
    echo "❌ Redis: Unhealthy"
fi

echo ""
echo "📊 Recent Logs (last 10 lines):"
echo "--- Backend ---"
docker logs sneaky-backend --tail 10 2>/dev/null || echo "No logs available"
echo ""
echo "--- Frontend ---"
docker logs sneaky-frontend --tail 10 2>/dev/null || echo "No logs available"
EOF

sudo mv /opt/monitor-services.sh /opt/monitor-services.sh
sudo chmod +x /opt/monitor-services.sh

# Create service management script
cat > manage-services.sh << 'EOF'
#!/bin/bash

case "$1" in
    start)
        echo "🚀 Starting Sneaky Hosting services..."
        docker-compose -f docker-compose.distributed.yml --env-file .env.dashboard up -d
        ;;
    stop)
        echo "🛑 Stopping Sneaky Hosting services..."
        docker-compose -f docker-compose.distributed.yml down
        ;;
    restart)
        echo "🔄 Restarting Sneaky Hosting services..."
        docker-compose -f docker-compose.distributed.yml restart
        ;;
    status)
        /opt/monitor-services.sh
        ;;
    logs)
        docker-compose -f docker-compose.distributed.yml logs -f
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        exit 1
        ;;
esac
EOF

chmod +x manage-services.sh

# Display final status
echo ""
echo "🎉 Dashboard host setup completed!"
echo ""
echo "📊 Service Status:"
docker-compose -f docker-compose.distributed.yml ps

echo ""
echo "🌐 Access URLs:"
echo "  Frontend: http://$DOMAIN_NAME:3000"
echo "  Backend API: http://$DOMAIN_NAME:3001"
echo "  API Documentation: http://$DOMAIN_NAME:3001/api-docs"
echo "  Health Check: http://$DOMAIN_NAME:3001/health"

echo ""
echo "🔧 Management Commands:"
echo "  Start services: ./manage-services.sh start"
echo "  Stop services: ./manage-services.sh stop"
echo "  Restart services: ./manage-services.sh restart"
echo "  Check status: ./manage-services.sh status"
echo "  View logs: ./manage-services.sh logs"

echo ""
echo "📝 Configuration Files:"
echo "  Environment: .env.dashboard"
echo "  Docker Compose: docker-compose.distributed.yml"

echo ""
echo "🔍 Troubleshooting:"
echo "  Monitor services: /opt/monitor-services.sh"
echo "  View logs: docker logs <container_name>"
echo "  Check connectivity: telnet $DB_HOST 5432"

echo ""
echo "✅ Setup complete! You can now access the Sneaky Hosting Platform."