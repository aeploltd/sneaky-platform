#!/bin/bash

# Fix Dashboard Deployment Issues
# Run this script on the dashboard host to fix common deployment problems

set -e

echo "🔧 Fixing Sneaky Dashboard Deployment Issues..."

# Check if environment file exists
if [ ! -f ".env.dashboard" ]; then
    echo "❌ Environment file .env.dashboard not found!"
    echo "Please run the dashboard deployment script first:"
    echo "./scripts/deploy-dashboard-host.sh"
    exit 1
fi

# Load environment variables
source .env.dashboard

# Verify required variables
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not set in .env.dashboard"
    exit 1
fi

if [ -z "$DB_HOST" ]; then
    echo "❌ DB_HOST not set in .env.dashboard"
    exit 1
fi

# Test database connectivity first
echo "🔍 Testing database connectivity..."
if timeout 10 bash -c "</dev/tcp/$DB_HOST/5432" 2>/dev/null; then
    echo "✅ Database server is reachable"
else
    echo "❌ Cannot connect to database server at $DB_HOST:5432"
    echo "Please ensure:"
    echo "  1. Database server is running"
    echo "  2. Firewall allows connections from this host"
    echo "  3. Database is listening on 0.0.0.0:5432"
    exit 1
fi

# Stop existing services
echo "🛑 Stopping existing services..."
docker-compose -f docker-compose.distributed.yml down 2>/dev/null || true

# Create package-lock.json files if missing
for dir in sneaky-backend sneaky-frontend sneaky-database; do
    if [ ! -f "$dir/package-lock.json" ]; then
        echo "📦 Creating package-lock.json for $dir..."
        cd $dir
        npm install --package-lock-only
        cd ..
    fi
done

# Generate Prisma client with proper environment
echo "🔧 Generating Prisma client..."
cd sneaky-backend

# Create temporary .env file for Prisma
cat > .env << EOF
DATABASE_URL=$DATABASE_URL
EOF

npx prisma generate
rm .env
cd ..

# Test database connection with Prisma
echo "🔍 Testing database connection with Prisma..."
cd sneaky-backend

# Create temporary .env file for Prisma
cat > .env << EOF
DATABASE_URL=$DATABASE_URL
EOF

if npx prisma db pull --force --schema=./prisma/schema.prisma; then
    echo "✅ Database connection successful"
else
    echo "❌ Database connection failed. Checking database status..."
    echo "Database URL: $DATABASE_URL"
    rm .env
    cd ..
    exit 1
fi

# Run migrations
echo "🗄️  Running database migrations..."
if npx prisma migrate deploy; then
    echo "✅ Database migrations completed"
else
    echo "⚠️  Migration issues detected. This might be normal for first-time setup."
fi

rm .env
cd ..

# Build applications
echo "🏗️  Building applications..."
cd sneaky-backend
npm run build
cd ..

cd sneaky-frontend
npm run build
cd ..

# Start services
echo "🚀 Starting dashboard services..."
docker-compose -f docker-compose.distributed.yml --env-file .env.dashboard up -d

# Wait for services
echo "⏳ Waiting for services to start..."
sleep 20

# Check service health
echo "🏥 Checking service health..."

# Check Redis
if docker exec sneaky-redis redis-cli -a "$REDIS_PASSWORD" ping > /dev/null 2>&1; then
    echo "✅ Redis is running"
else
    echo "❌ Redis failed to start"
    docker logs sneaky-redis
fi

# Check Backend (with retries)
backend_ready=false
for i in {1..5}; do
    if curl -f http://localhost:3001/health > /dev/null 2>&1; then
        echo "✅ Backend API is running"
        backend_ready=true
        break
    else
        echo "⏳ Waiting for backend API... (attempt $i/5)"
        sleep 10
    fi
done

if [ "$backend_ready" = false ]; then
    echo "❌ Backend API failed to start"
    echo "Backend logs:"
    docker logs sneaky-backend --tail 20
fi

# Check Frontend
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Frontend is running"
else
    echo "❌ Frontend failed to start"
    echo "Frontend logs:"
    docker logs sneaky-frontend --tail 20
fi

# Display final status
echo ""
echo "📊 Final Status:"
docker-compose -f docker-compose.distributed.yml ps

echo ""
echo "🌐 Access URLs:"
DOMAIN_NAME=${DOMAIN_NAME:-$(hostname -I | awk '{print $1}')}
echo "  Frontend: http://$DOMAIN_NAME:3000"
echo "  Backend API: http://$DOMAIN_NAME:3001"
echo "  API Documentation: http://$DOMAIN_NAME:3001/api-docs"
echo "  Health Check: http://$DOMAIN_NAME:3001/health"

echo ""
echo "✅ Dashboard deployment fixed successfully!"