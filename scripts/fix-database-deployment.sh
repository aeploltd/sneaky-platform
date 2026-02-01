#!/bin/bash

# Fix Database Deployment Issues
# Run this script on the database server to fix common deployment problems

set -e

echo "🔧 Fixing Sneaky Database Deployment Issues..."

# Stop any running services
echo "🛑 Stopping existing services..."
docker-compose -f docker-compose.database-server.yml down 2>/dev/null || true

# Remove problematic containers and images
echo "🧹 Cleaning up Docker resources..."
docker rm -f sneaky-postgres sneaky-db-monitor postgres-exporter 2>/dev/null || true
docker rmi sneaky-hosting-platform_database-monitor 2>/dev/null || true

# Create package-lock.json for database service if missing
if [ ! -f "sneaky-database/package-lock.json" ]; then
    echo "📦 Creating package-lock.json for database service..."
    cd sneaky-database
    npm install --package-lock-only
    cd ..
fi

# Fix Dockerfile to use npm install instead of npm ci
echo "🔧 Updating Dockerfile..."
sed -i 's/npm ci --only=production/npm install --only=production/g' sneaky-database/Dockerfile

# Ensure environment file exists
if [ ! -f ".env.database" ]; then
    echo "❌ Environment file .env.database not found!"
    echo "Please run the database deployment script first:"
    echo "./scripts/deploy-database-server.sh"
    exit 1
fi

# Load environment variables
source .env.database

# Create logs directory
mkdir -p logs

# Build and start services
echo "🚀 Building and starting database services..."
docker-compose -f docker-compose.database-server.yml --env-file .env.database build --no-cache
docker-compose -f docker-compose.database-server.yml --env-file .env.database up -d

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 15

# Check PostgreSQL status
if docker exec sneaky-postgres pg_isready -U ${DB_USER:-sneaky_admin}; then
    echo "✅ PostgreSQL is running successfully"
else
    echo "❌ PostgreSQL failed to start. Checking logs..."
    docker logs sneaky-postgres
    exit 1
fi

# Check database monitor status
if docker ps | grep -q "sneaky-db-monitor"; then
    echo "✅ Database monitor is running"
else
    echo "⚠️  Database monitor may have issues. Checking logs..."
    docker logs sneaky-db-monitor 2>/dev/null || echo "No monitor logs available"
fi

# Display final status
echo ""
echo "📊 Final Status:"
docker-compose -f docker-compose.database-server.yml ps

echo ""
echo "🔗 Connection Details:"
echo "  Database Host: $(hostname -I | awk '{print $1}')"
echo "  Database Port: 5432"
echo "  Database Name: ${DB_NAME:-sneaky_hosting}"
echo "  Database User: ${DB_USER:-sneaky_admin}"

echo ""
echo "✅ Database deployment fixed successfully!"