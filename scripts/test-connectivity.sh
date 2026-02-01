#!/bin/bash

# Connectivity Test Script
# Use this to test connections between your distributed services

echo "🔍 Testing Sneaky Hosting Platform Connectivity"
echo "=============================================="

# Function to test TCP connection
test_connection() {
    local host=$1
    local port=$2
    local service=$3
    
    if timeout 5 bash -c "</dev/tcp/$host/$port" 2>/dev/null; then
        echo "✅ $service ($host:$port) - Connection successful"
        return 0
    else
        echo "❌ $service ($host:$port) - Connection failed"
        return 1
    fi
}

# Function to test HTTP endpoint
test_http() {
    local url=$1
    local service=$2
    
    if curl -f -s --connect-timeout 5 "$url" > /dev/null; then
        echo "✅ $service ($url) - HTTP check successful"
        return 0
    else
        echo "❌ $service ($url) - HTTP check failed"
        return 1
    fi
}

# Get configuration
if [ -f ".env.dashboard" ]; then
    source .env.dashboard
    echo "📝 Loaded dashboard configuration"
elif [ -f ".env.database" ]; then
    source .env.database
    echo "📝 Loaded database configuration"
else
    echo "❌ No configuration file found. Please run from project directory."
    exit 1
fi

echo ""
echo "🧪 Running connectivity tests..."
echo ""

# Test database connection (if we have DB_HOST)
if [ ! -z "$DB_HOST" ]; then
    echo "🗄️  Database Tests:"
    test_connection "$DB_HOST" "${DB_PORT:-5432}" "PostgreSQL Database"
    
    # Test with psql if available
    if command -v psql >/dev/null 2>&1 && [ ! -z "$DATABASE_URL" ]; then
        if psql "$DATABASE_URL" -c "SELECT version();" >/dev/null 2>&1; then
            echo "✅ PostgreSQL Query Test - Success"
        else
            echo "❌ PostgreSQL Query Test - Failed"
        fi
    fi
    echo ""
fi

# Test Redis connection (if we have REDIS_HOST or local Redis)
if [ ! -z "$REDIS_HOST" ]; then
    echo "🔴 Redis Tests (Remote):"
    test_connection "$REDIS_HOST" "${REDIS_PORT:-6379}" "Redis Cache"
    
    # Test Redis ping if redis-cli is available
    if command -v redis-cli >/dev/null 2>&1; then
        if [ ! -z "$REDIS_PASSWORD" ]; then
            if redis-cli -h "$REDIS_HOST" -p "${REDIS_PORT:-6379}" -a "$REDIS_PASSWORD" ping >/dev/null 2>&1; then
                echo "✅ Redis Ping Test - Success"
            else
                echo "❌ Redis Ping Test - Failed"
            fi
        else
            if redis-cli -h "$REDIS_HOST" -p "${REDIS_PORT:-6379}" ping >/dev/null 2>&1; then
                echo "✅ Redis Ping Test - Success"
            else
                echo "❌ Redis Ping Test - Failed"
            fi
        fi
    fi
else
    echo "🔴 Redis Tests (Local):"
    test_connection "localhost" "6379" "Local Redis Cache"
    
    # Test local Redis with Docker
    if docker ps | grep -q "sneaky-redis"; then
        if docker exec sneaky-redis redis-cli ping >/dev/null 2>&1; then
            echo "✅ Local Redis Docker Test - Success"
        else
            echo "❌ Local Redis Docker Test - Failed"
        fi
    fi
fi

echo ""

# Test web services (if running on dashboard host)
if [ -f "docker-compose.distributed.yml" ]; then
    echo "🌐 Web Services Tests:"
    
    # Test backend API
    test_http "http://localhost:3001/health" "Backend API Health"
    test_connection "localhost" "3001" "Backend API Port"
    
    # Test frontend
    test_http "http://localhost:3000" "Frontend Application"
    test_connection "localhost" "3000" "Frontend Port"
    
    echo ""
fi

# Test external services
echo "🌍 External Services Tests:"
test_connection "8.8.8.8" "53" "DNS (Google)"
test_http "https://httpbin.org/status/200" "Internet Connectivity"

echo ""

# Docker services check
if command -v docker >/dev/null 2>&1; then
    echo "🐳 Docker Services Status:"
    
    if docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(sneaky|postgres|redis)"; then
        echo ""
    else
        echo "❌ No Sneaky services found running in Docker"
    fi
    
    echo ""
fi

# System resources check
echo "💻 System Resources:"
echo "CPU Usage: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%"
echo "Memory Usage: $(free | grep Mem | awk '{printf("%.1f%%", $3/$2 * 100.0)}')"
echo "Disk Usage: $(df -h / | awk 'NR==2{printf "%s", $5}')"

echo ""

# Network interface check
echo "🔗 Network Interfaces:"
ip -4 addr show | grep -E "inet.*scope global" | awk '{print $2}' | while read ip; do
    echo "  Available IP: $ip"
done

echo ""

# Port availability check
echo "🔌 Port Availability Check:"
ports_to_check="3000 3001 5432 6379"
for port in $ports_to_check; do
    if netstat -tuln 2>/dev/null | grep -q ":$port "; then
        echo "  Port $port: ✅ In use"
    else
        echo "  Port $port: ⚪ Available"
    fi
done

echo ""
echo "🏁 Connectivity test completed!"
echo ""
echo "💡 Troubleshooting Tips:"
echo "  - If database connection fails, check firewall rules"
echo "  - If Redis connection fails, verify Redis is running and accessible"
echo "  - If web services fail, check Docker containers are running"
echo "  - Use 'docker logs <container>' to check service logs"
echo "  - Verify environment variables in .env files"