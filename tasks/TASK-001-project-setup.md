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
- [ ] Create `package.json` with all required dependencies
- [ ] Include core packages: `express`, `routing-controllers`, `typedi`, `reflect-metadata`
- [ ] Add validation packages: `class-validator`, `class-transformer`
- [ ] Include development dependencies: `typescript`, `ts-node`, `@types/express`
- [ ] Configure npm scripts for `dev`, `build`, `start`, `test`

### ✅ TypeScript Configuration
- [ ] Create `tsconfig.json` with proper compiler options
- [ ] Enable `experimentalDecorators` and `emitDecoratorMetadata`
- [ ] Configure path mapping for clean imports (`@controllers/*`, `@services/*`, etc.)
- [ ] Set up `outDir` and `rootDir` for compilation

### ✅ Project Structure
- [ ] Create `src/` directory structure:
  - `controllers/`
  - `services/`
  - `repositories/`
  - `models/`
  - `middlewares/`
  - `config/`
  - `utils/`
  - `exceptions/`
  - `types/`
- [ ] Create `tests/` directory structure
- [ ] Create `docs/` directory (already exists)
- [ ] Create `scripts/` directory for build scripts

### ✅ Environment Configuration
- [ ] Create `.env.example` with all required variables
- [ ] Set up environment variable structure:
  - Server configuration (PORT, NODE_ENV)
  - Database configuration (Supabase credentials)
  - Security configuration (JWT secrets)
  - Rate limiting configuration
- [ ] Install and configure `dotenv` package

### ✅ Basic Files
- [ ] Create `src/server.ts` entry point
- [ ] Create `.gitignore` file
- [ ] Create basic `README.md`
- [ ] Create `Dockerfile` for containerization
- [ ] Create `docker-compose.yml` for development

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
- [ ] All dependencies installed and working
- [ ] TypeScript compilation successful
- [ ] Basic server starts without errors
- [ ] All directory structure created
- [ ] Environment configuration template ready
- [ ] Git repository initialized with proper .gitignore
- [ ] Documentation updated with setup instructions

## Testing Strategy
- [ ] Verify `npm run dev` starts development server
- [ ] Verify `npm run build` compiles TypeScript successfully
- [ ] Verify `npm start` runs production build
- [ ] Test import paths work correctly with path mapping

## Notes
- This task establishes the foundation for all subsequent development
- Ensure all decorators work properly before proceeding
- Test TypeDI container integration early