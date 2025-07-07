# Development Dockerfile for docker-compose
FROM node:20-alpine

WORKDIR /app

# Install dependencies for native modules and development tools
RUN apk add --no-cache python3 make g++ postgresql-client

# Copy package files
COPY package.json yarn.lock ./

# Install all dependencies (including dev dependencies)
RUN yarn install --frozen-lockfile

# Copy prisma schema
COPY prisma ./prisma

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Default command will be overridden by docker-compose
CMD ["yarn", "dev"]