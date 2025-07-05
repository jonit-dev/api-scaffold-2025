# TASK-001: Project Setup and Initial Configuration

## Epic

Foundation Setup

## Story Points

5

## Priority

High

## Description

Set up the basic project structure with TypeScript, routing-controllers, and essential dependencies to create a solid foundation for the API scaffold.

## Acceptance Criteria

### ✅ Package.json Configuration

- [x] Create `package.json` with all required dependencies
- [x] Include core packages: `express`, `routing-controllers`, `typedi`, `reflect-metadata`
- [x] Add validation packages: `class-validator`, `class-transformer`
- [x] Include development dependencies: `typescript`, `ts-node`, `@types/express`
- [x] Configure npm scripts for `dev`, `build`, `start`, `test`

### ✅ TypeScript Configuration

- [x] Create `tsconfig.json` with proper compiler options
- [x] Enable `experimentalDecorators` and `emitDecoratorMetadata`
- [x] Configure path mapping for clean imports (`@controllers/*`, `@services/*`, etc.)
- [x] Set up `outDir` and `rootDir` for compilation

### ✅ Project Structure

- [x] Create `src/` directory structure:
  - `controllers/`
  - `services/`
  - `repositories/`
  - `models/`
  - `middlewares/`
  - `config/`
  - `utils/`
  - `exceptions/`
  - `types/`
- [x] Create `tests/` directory structure
- [x] Create `docs/` directory (already exists)
- [x] Create `scripts/` directory for build scripts

### ✅ Environment Configuration

- [x] Create `.env.example` with all required variables
- [x] Set up environment variable structure:
  - Server configuration (PORT, NODE_ENV)
  - Database configuration (Supabase credentials)
  - Security configuration (JWT secrets)
  - Rate limiting configuration
- [x] Install and configure `dotenv` package

### ✅ Basic Files

- [x] Create `src/server.ts` entry point
- [x] Create `.gitignore` file
- [x] Create basic `README.md`
- [x] Create `Dockerfile` for containerization
- [x] Create `docker-compose.yml` for development

## Technical Requirements

### Dependencies to Install

```bash
# Core dependencies (order is important - install reflect-metadata first)
npm install reflect-metadata
npm install express routing-controllers typedi
npm install class-validator class-transformer
npm install @supabase/supabase-js
npm install helmet cors express-rate-limit compression morgan dotenv
npm install bcrypt jsonwebtoken
npm install body-parser multer

# Development dependencies
npm install -D typescript ts-node @types/express
npm install -D @types/bcrypt @types/jsonwebtoken @types/body-parser @types/multer
npm install -D nodemon concurrently
npm install -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
npm install -D prettier eslint-config-prettier eslint-plugin-prettier
npm install -D jest ts-jest @types/jest supertest @types/supertest
```

### Critical Setup Notes

- **reflect-metadata must be imported first** in your application entry point (`src/server.ts`)
- **TypeDI Container integration** must be configured before any controllers are loaded
- **Class-validator and class-transformer** are peer dependencies required by routing-controllers
- **Supabase client configuration** requires environment variables for URL and keys

### tsconfig.json Configuration

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": "./",
    "paths": {
      "@/*": ["src/*"],
      "@controllers/*": ["src/controllers/*"],
      "@services/*": ["src/services/*"],
      "@repositories/*": ["src/repositories/*"],
      "@models/*": ["src/models/*"],
      "@middlewares/*": ["src/middlewares/*"],
      "@config/*": ["src/config/*"],
      "@utils/*": ["src/utils/*"],
      "@exceptions/*": ["src/exceptions/*"],
      "@types/*": ["src/types/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### Critical TypeScript Settings

- `experimentalDecorators: true` - Required for routing-controllers decorators
- `emitDecoratorMetadata: true` - Required for TypeDI dependency injection
- Path mapping for clean imports and better code organization

## Definition of Done

- [x] All dependencies installed and working
- [x] TypeScript compilation successful
- [x] Basic server starts without errors
- [x] All directory structure created
- [x] Environment configuration template ready
- [x] Git repository initialized with proper .gitignore
- [x] Documentation updated with setup instructions

## Testing Strategy

- [x] Verify `yarn dev` starts development server
- [x] Verify `yarn build` compiles TypeScript successfully
- [x] Verify `yarn start` runs production build
- [x] Test import paths work correctly with path mapping

## Notes

- This task establishes the foundation for all subsequent development
- Ensure all decorators work properly before proceeding
- Test TypeDI container integration early
