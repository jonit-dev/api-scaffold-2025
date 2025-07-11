# API Scaffold

A TypeScript Express API scaffold with routing-controllers, TypeDI, and PostgreSQL + Prisma integration.

## Features

- **TypeScript** with decorators support
- **Express** with routing-controllers
- **Dependency Injection** with TypeDI
- **Database** with PostgreSQL + Prisma ORM
- **Database Management** with pgAdmin web interface
- **Caching** with Redis
- **Authentication** with JWT
- **Validation** with class-validator
- **Security** with Helmet, CORS, and rate limiting
- **Testing** with Vitest
- **Linting** with ESLint and Prettier
- **Docker** containerization
- **Stripe** payment integration

## Quick Start

### 🚀 One Command Setup (Recommended)
```bash
docker-compose up --build
```
**That's it!** Everything is automatically configured and ready to use.

See [ONE_COMMAND_SETUP.md](./docs/ONE_COMMAND_SETUP.md) for details.

### 📋 Manual Setup
See [QUICK_START.md](./docs/QUICK_START.md) for step-by-step manual setup.

### Access Points
- **API**: http://localhost:3000/health
- **pgAdmin**: http://localhost:8080 (admin@api-scaffold.com / admin123)
- **Database**: PostgreSQL automatically configured in pgAdmin

## Database Setup

This project uses **PostgreSQL** with **Prisma ORM** and includes **pgAdmin** for database management.

### Default Credentials
- **PostgreSQL**: `api_user:api_password@localhost:5432/api_scaffold`
- **pgAdmin**: `admin@api-scaffold.com` / `admin123` at http://localhost:8080

For detailed database setup and connection instructions, see [DATABASE_SETUP.md](./docs/DATABASE_SETUP.md).

## Development

1. **Install dependencies**

   ```bash
   yarn install
   ```

2. **Set up environment variables**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Run in development mode**
   ```bash
   yarn dev
   ```

## Scripts

- `yarn dev` - Start development server with hot reload
- `yarn build` - Build for production
- `yarn start` - Start production server
- `yarn test` - Run tests
- `yarn test:watch` - Run tests in watch mode
- `yarn test:coverage` - Run tests with coverage
- `yarn lint` - Lint code
- `yarn lint:fix` - Fix linting issues
- `yarn format` - Format code with Prettier
- `yarn typecheck` - Run TypeScript type checking

## Project Structure

```
src/
├── config/          # Configuration files
├── controllers/     # Route controllers
├── services/        # Business logic
├── repositories/    # Data access layer
├── models/          # Data models and DTOs
├── middlewares/     # Custom middleware
├── exceptions/      # Custom exceptions
├── utils/           # Utility functions
└── types/           # TypeScript type definitions
```

## Environment Variables

See `.env.example` for all required environment variables.

## Docker

Build and run with Docker:

```bash
docker-compose up --build
```
