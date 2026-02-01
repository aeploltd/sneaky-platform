# Sneaky Hosting Platform

Enterprise-grade hosting dashboard for cloud infrastructure management.

## Architecture

- **sneaky-frontend**: React TypeScript dashboard with Material-UI
- **sneaky-backend**: Node.js Express API with TypeScript
- **sneaky-database**: PostgreSQL with Redis caching

## Quick Start

```bash
# Install dependencies
npm install

# Start development environment
npm run dev

# Or use Docker
npm run docker:up
```

## Services

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- PostgreSQL: localhost:5432
- Redis: localhost:6379

## Features

- Multi-tenant hosting management
- Real-time server monitoring
- Resource allocation and scaling
- Billing and usage tracking
- Security and compliance tools
- API management
- Automated deployments

## Development

Each service can be run independently:

```bash
npm run dev:frontend
npm run dev:backend
npm run dev:database
```

## Production Deployment

```bash
npm run build
docker-compose -f docker-compose.prod.yml up -d
```