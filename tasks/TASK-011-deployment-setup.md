# TASK-011: Deployment Setup and Documentation

## Epic

DevOps & Deployment

## Story Points

6

## Priority

Low

## Description

Set up deployment configuration, Docker containers, and documentation for deploying the API scaffold to production environments.

## Acceptance Criteria

### ✅ Docker Configuration

- [ ] Create `Dockerfile` for production builds
- [ ] Set up `docker-compose.yml` for development
- [ ] Configure multi-stage Docker builds
- [ ] Set up environment-specific configurations
- [ ] Create Docker ignore file
- [ ] Configure health checks in containers

### ✅ Build Scripts

- [ ] Create build scripts in `scripts/` directory
- [ ] Set up production build process
- [ ] Configure asset optimization
- [ ] Add database migration scripts
- [ ] Create deployment scripts
- [ ] Set up environment validation

### ✅ Environment Configuration

- [ ] Create production environment templates
- [ ] Set up staging environment configuration
- [ ] Configure CI/CD environment variables
- [ ] Add environment validation
- [ ] Create deployment guides
- [ ] Set up monitoring configuration

### ✅ Documentation

- [ ] Create deployment documentation
- [ ] Add environment setup guides
- [ ] Document API endpoints
- [ ] Create troubleshooting guides
- [ ] Add performance optimization tips
- [ ] Create security best practices guide

## Technical Requirements

### Dockerfile Configuration

```dockerfile
# Multi-stage build for production
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Set permissions
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start the application
CMD ["node", "dist/server.js"]
```

### Docker Compose Configuration

```yaml
# docker-compose.yml
version: "3.8"

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    depends_on:
      - postgres
      - redis
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=api_scaffold
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init-db.sql
    ports:
      - "5432:5432"
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./certs:/etc/nginx/certs
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### Build Scripts

```bash
#!/bin/bash
# scripts/build.sh

set -e

echo "🔨 Building API Scaffold..."

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Run linting
echo "🔍 Running linter..."
npm run lint

# Run tests
echo "🧪 Running tests..."
npm test

# Build TypeScript
echo "🏗️ Building TypeScript..."
npm run build

# Create production package
echo "📦 Creating production package..."
tar -czf api-scaffold.tar.gz dist/ node_modules/ package.json

echo "✅ Build complete!"
```

### Deployment Script

```bash
#!/bin/bash
# scripts/deploy.sh

set -e

ENVIRONMENT=${1:-staging}

echo "🚀 Deploying to $ENVIRONMENT..."

# Validate environment
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
  echo "❌ Invalid environment. Use 'staging' or 'production'"
  exit 1
fi

# Load environment variables
if [[ -f ".env.$ENVIRONMENT" ]]; then
  export $(cat .env.$ENVIRONMENT | xargs)
fi

# Build application
./scripts/build.sh

# Deploy with Docker
echo "🐳 Deploying with Docker..."
docker-compose -f docker-compose.$ENVIRONMENT.yml up -d

# Run database migrations
echo "🗄️ Running database migrations..."
npm run db:migrate

# Health check
echo "🔍 Performing health check..."
timeout 30 bash -c 'until curl -f http://localhost:3000/api/health; do sleep 1; done'

echo "✅ Deployment complete!"
```

### API Documentation

````markdown
# API Reference

## Authentication

### POST /api/auth/login

Login with email and password.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```
````

**Response:**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user-id",
      "email": "user@example.com",
      "role": "user"
    },
    "tokens": {
      "accessToken": "jwt-token",
      "refreshToken": "refresh-token"
    }
  }
}
```

### POST /api/auth/register

Register a new user account.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "password123",
  "first_name": "John",
  "last_name": "Doe"
}
```

## Users

### GET /api/users

Get all users (Admin only).

**Query Parameters:**

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `search`: Search query
- `role`: Filter by role
- `status`: Filter by status

### GET /api/users/:id

Get user by ID.

**Parameters:**

- `id`: User ID

### POST /api/users

Create a new user (Admin only).

### PUT /api/users/:id

Update user by ID.

### DELETE /api/users/:id

Delete user by ID (Admin only).

````

### Production Environment Template
```env
# .env.production
NODE_ENV=production
PORT=3000

# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_KEY=your-production-service-key

# JWT
JWT_SECRET=your-secure-jwt-secret-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-secure-refresh-secret
JWT_REFRESH_EXPIRES_IN=7d

# CORS
ALLOWED_ORIGINS=https://yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Monitoring
HEALTH_CHECK_INTERVAL=30000
METRICS_ENABLED=true
````

## Definition of Done

- [ ] Docker configuration complete and tested
- [ ] Build scripts functional
- [ ] Deployment scripts working
- [ ] Environment templates created
- [ ] Documentation complete and accurate
- [ ] Health checks implemented
- [ ] Security configurations applied
- [ ] Performance optimizations in place

## Testing Strategy

- [ ] Test Docker builds locally
- [ ] Verify docker-compose setup
- [ ] Test deployment scripts
- [ ] Validate environment configurations
- [ ] Check health check functionality
- [ ] Test production builds
- [ ] Verify security configurations

## Dependencies

- TASK-010: Testing Setup and Implementation

## Notes

- Use environment-specific configurations
- Implement proper logging and monitoring
- Ensure security best practices
- Document all deployment procedures
- Test deployment process thoroughly
- Consider implementing blue-green deployments
