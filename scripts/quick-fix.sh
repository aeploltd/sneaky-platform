#!/bin/bash

# Quick Fix Script for Common Deployment Issues
# This script addresses the most common problems encountered during deployment

echo "🚀 Sneaky Hosting Platform - Quick Fix"
echo "====================================="

# Detect which machine we're on based on existing files
if [ -f ".env.database" ]; then
    MACHINE_TYPE="database"
elif [ -f ".env.dashboard" ]; then
    MACHINE_TYPE="dashboard"
else
    echo "❓ Cannot determine machine type. Please specify:"
    echo "1) Database Server"
    echo "2) Dashboard Host"
    read -p "Enter choice (1 or 2): " choice
    case $choice in
        1) MACHINE_TYPE="database" ;;
        2) MACHINE_TYPE="dashboard" ;;
        *) echo "Invalid choice"; exit 1 ;;
    esac
fi

echo "🔍 Detected machine type: $MACHINE_TYPE"
echo ""

# Common fixes for both machines
echo "🔧 Applying common fixes..."

# Fix package-lock.json issues
for dir in sneaky-backend sneaky-frontend sneaky-database; do
    if [ -d "$dir" ] && [ ! -f "$dir/package-lock.json" ]; then
        echo "📦 Creating package-lock.json for $dir..."
        cd $dir
        npm install --package-lock-only 2>/dev/null || npm install --dry-run > /dev/null 2>&1
        cd ..
    fi
done

# Fix Dockerfile npm ci issues
if [ -f "sneaky-database/Dockerfile" ]; then
    sed -i 's/npm ci --only=production/npm install --only=production/g' sneaky-database/Dockerfile
fi

# Machine-specific fixes
if [ "$MACHINE_TYPE" = "database" ]; then
    echo "🗄️  Applying database server fixes..."
    
    # Stop services
    docker-compose -f docker-compose.database-server.yml down 2>/dev/null || true
    
    # Clean up
    docker rm -f sneaky-postgres sneaky-db-monitor postgres-exporter 2>/dev/null || true
    
    # Check environment
    if [ ! -f ".env.database" ]; then
        echo "❌ Missing .env.database file. Creating template..."
        cat > .env.database << 'EOF'
# Database Configuration
DB_NAME=sneaky_hosting
DB_USER=sneaky_admin
DB_PASSWORD=change_this_password
DB_HOST=0.0.0.0
DB_PORT=5432

# Redis connection (points to dashboard host)
REDIS_HOST=192.168.1.101
REDIS_PORT=6379
REDIS_PASSWORD=change_this_password

# Monitoring
NODE_ENV=production
EOF
        echo "⚠️  Please edit .env.database with your actual configuration"
        exit 1
    fi
    
    # Start services
    source .env.database
    docker-compose -f docker-compose.database-server.yml --env-file .env.database up -d
    
    echo "⏳ Waiting for PostgreSQL..."
    sleep 15
    
    if docker exec sneaky-postgres pg_isready -U ${DB_USER:-sneaky_admin} 2>/dev/null; then
        echo "✅ Database server is running"
    else
        echo "❌ Database server failed to start"
        docker logs sneaky-postgres --tail 10
    fi

elif [ "$MACHINE_TYPE" = "dashboard" ]; then
    echo "🖥️  Applying dashboard host fixes..."
    
    # Stop services
    docker-compose -f docker-compose.distributed.yml down 2>/dev/null || true
    
    # Check environment
    if [ ! -f ".env.dashboard" ]; then
        echo "❌ Missing .env.dashboard file. Creating template..."
        cat > .env.dashboard << 'EOF'
# Database Connection
DB_HOST=192.168.1.100
DB_PORT=5432
DB_NAME=sneaky_hosting
DB_USER=sneaky_admin
DB_PASSWORD=change_this_password
DATABASE_URL=postgresql://sneaky_admin:change_this_password@192.168.1.100:5432/sneaky_hosting

# Local Redis
REDIS_PASSWORD=change_this_password

# Application Configuration
NODE_ENV=production
JWT_SECRET=change_this_jwt_secret
FRONTEND_URL=http://localhost:3000
REACT_APP_API_URL=http://localhost:3001
REACT_APP_WS_URL=ws://localhost:3001
EOF
        echo "⚠️  Please edit .env.dashboard with your actual configuration"
        exit 1
    fi
    
    source .env.dashboard
    
    # Test database connectivity
    if timeout 5 bash -c "</dev/tcp/$DB_HOST/5432" 2>/dev/null; then
        echo "✅ Database server is reachable"
    else
        echo "❌ Cannot reach database server at $DB_HOST:5432"
        echo "Please ensure database server is running and accessible"
        exit 1
    fi
    
    # Fix Prisma issues
    cd sneaky-backend
    cat > .env << EOF
DATABASE_URL=$DATABASE_URL
EOF
    
    npx prisma generate 2>/dev/null || echo "⚠️  Prisma generate had issues"
    npx prisma migrate deploy 2>/dev/null || echo "⚠️  Migration had issues (may be normal)"
    
    rm .env
    cd ..
    
    # Start services
    docker-compose -f docker-compose.distributed.yml --env-file .env.dashboard up -d
    
    echo "⏳ Waiting for services..."
    sleep 20
    
    # Check services
    if curl -f http://localhost:3001/health > /dev/null 2>&1; then
        echo "✅ Backend API is running"
    else
        echo "❌ Backend API failed to start"
    fi
    
    if curl -f http://localhost:3000 > /dev/null 2>&1; then
        echo "✅ Frontend is running"
    else
        echo "❌ Frontend failed to start"
    fi
fi

echo ""
echo "🎉 Quick fix completed!"
echo ""
echo "📊 Current Status:"
if [ "$MACHINE_TYPE" = "database" ]; then
    docker-compose -f docker-compose.database-server.yml ps
else
    docker-compose -f docker-compose.distributed.yml ps
fi

echo ""
echo "🔧 If issues persist, try:"
echo "  - Check logs: docker logs <container_name>"
echo "  - Restart services: docker-compose restart"
echo "  - Full rebuild: docker-compose up --build -d"