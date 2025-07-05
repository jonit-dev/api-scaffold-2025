# API Scaffold

A TypeScript Express API scaffold with routing-controllers, TypeDI, and Supabase integration.

## Features

- **TypeScript** with decorators support
- **Express** with routing-controllers
- **Dependency Injection** with TypeDI
- **Database** integration with Supabase
- **Authentication** with JWT
- **Validation** with class-validator
- **Security** with Helmet, CORS, and rate limiting
- **Testing** with Jest and Supertest
- **Linting** with ESLint and Prettier
- **Docker** support

## Quick Start

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