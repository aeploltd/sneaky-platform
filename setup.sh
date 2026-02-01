#!/bin/bash

# Sneaky Hosting Platform Setup Script
echo "🚀 Setting up Sneaky Hosting Platform..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Create environment file
if [ ! -f .env ]; then
    echo "📝 Creating environment file..."
    cp .env.example .env
    echo "✅ Environment file created. Please update .env with your configuration."
else
    echo "✅ Environment file already exists"
fi

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd sneaky-backend
npm install
cd ..

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd sneaky-frontend
npm install
cd ..

# Install database dependencies
echo "📦 Installing database dependencies..."
cd sneaky-database
npm install
cd ..

# Generate Prisma client
echo "🔧 Generating Prisma client..."
cd sneaky-backend
npx prisma generate
cd ..

echo "🎉 Setup completed successfully!"
echo ""
echo "Deployment Options:"
echo ""
echo "🖥️  Single Server (Recommended for most users):"
echo "   ./scripts/deploy-single-server.sh"
echo ""
echo "🖥️  Development Mode:"
echo "   1. Update the .env file with your configuration"
echo "   2. Start services: npm run dev (or npm run docker:up)"
echo ""
echo "🏢 Multi-Machine (Advanced/Production):"
echo "   Database Server: ./scripts/deploy-database-server.sh"
echo "   Dashboard Host:  ./scripts/deploy-dashboard-host.sh"
echo "   Test Setup:      ./scripts/test-connectivity.sh"
echo ""
echo "📚 Documentation:"
echo "   Single server: Run ./scripts/deploy-single-server.sh"
echo "   Multi-machine setup: deployment/multi-machine-setup.md"
echo "   Production deployment: DEPLOYMENT.md"
echo "   Troubleshooting: TROUBLESHOOTING.md"