# Backend API - Sneaky Hosting V2

Enhanced backend with modular architecture and demo endpoints.

## 🏗️ Architecture

```
src/
├── controllers/     # Request handlers
├── services/        # Business logic
├── routes/          # Route definitions
├── middleware/      # Custom middleware
├── types/           # TypeScript types
└── server.ts        # Main server file
```

## 🚀 Features

- **Modular Structure** - Clean separation of concerns
- **Error Handling** - Centralized error management
- **Authentication** - Demo auth system with middleware
- **Logging** - Request/response logging
- **Type Safety** - Full TypeScript support

## 📚 API Endpoints

### Authentication
```bash
# Get demo token
GET /api/auth/demo-token

# Login (demo)
POST /api/auth/login
{
  "email": "demo@example.com",
  "password": "demo123"
}

# Register (demo)
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "password123",
  "name": "User Name"
}
```

### Users
```bash
# Get user profile (protected)
GET /api/users/profile
Authorization: Bearer demo-token

# List all users
GET /api/users

# Create user
POST /api/users
{
  "email": "new@example.com",
  "name": "New User"
}
```

### Servers
```bash
# List servers (public)
GET /api/servers

# Get server by ID
GET /api/servers/:id

# Create server (protected)
POST /api/servers
Authorization: Bearer demo-token
{
  "name": "My Server",
  "type": "web",
  "region": "us-east-1"
}

# Update server (protected)
PUT /api/servers/:id
Authorization: Bearer demo-token
{
  "status": "running"
}

# Delete server (protected)
DELETE /api/servers/:id
Authorization: Bearer demo-token
```

## 🔧 Demo Authentication

For testing protected endpoints:

1. **Get demo token**: `GET /api/auth/demo-token`
2. **Use in headers**: `Authorization: Bearer demo-token`

Example:
```bash
curl -H "Authorization: Bearer demo-token" \
     http://localhost:3001/api/users/profile
```

## 🛠️ Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

## 📝 Adding New Modules

1. **Create Controller**: `src/controllers/YourController.ts`
2. **Create Service**: `src/services/YourService.ts`
3. **Create Routes**: `src/routes/your-routes.ts`
4. **Register Routes**: Add to `src/routes/index.ts`

Example structure:
```typescript
// Controller
export class YourController {
  async getItems(req: Request, res: Response) {
    // Handle request
  }
}

// Service
export class YourService {
  async findItems() {
    // Business logic
  }
}

// Routes
router.get('/', asyncHandler(controller.getItems.bind(controller)));
```

## 🔒 Security Notes

- Current auth is demo-only
- Replace with real JWT implementation
- Add input validation
- Implement rate limiting
- Add HTTPS in production