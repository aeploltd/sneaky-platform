# Sneaky Hosting Platform V2

Simple, clean boilerplate for building your hosting platform.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development servers
npm run dev

# Or use Docker
npm start
```

## 📁 Structure

```
v2/
├── frontend/          # React + TypeScript + Vite
├── backend/           # Express + TypeScript
├── database/          # Prisma + PostgreSQL
└── docker-compose.yml # Container orchestration
```

## 🔧 Development

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3001
- **Database**: PostgreSQL on port 5432

## 📝 What's Included

### Frontend
- React 18 with TypeScript
- Vite for fast development
- Basic routing with React Router
- Clean, dark theme styling
- API connection example

### Backend
- Express server with TypeScript
- Basic middleware (CORS, Helmet)
- Health check endpoint
- Ready for your API routes

### Database
- Prisma ORM setup
- PostgreSQL database
- Basic User and Server models
- Migration ready

## 🛠️ Build Your Features

This is a minimal boilerplate. Add your own:

- Authentication system
- API routes and controllers
- Database models and relationships
- UI components and pages
- Business logic and services

## 📚 Commands

```bash
# Development
npm run dev              # Start both frontend and backend
npm run dev:frontend     # Frontend only
npm run dev:backend      # Backend only

# Database
cd database
npm run migrate          # Run database migrations
npm run generate         # Generate Prisma client
npm run studio          # Open Prisma Studio

# Docker
npm start               # Start all services
npm stop                # Stop all services
npm run clean           # Clean up containers and volumes
```

## 🎯 Next Steps

1. Set up your environment variables (copy `.env.example` to `.env`)
2. Design your database schema in `database/schema.prisma`
3. Build your API routes in `backend/src/`
4. Create your UI components in `frontend/src/`
5. Add authentication, authorization, and business logic

Happy coding! 🚀