-- Initialize database schema
-- This script runs when the PostgreSQL container starts for the first time

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Create database if it doesn't exist (Docker already creates it)
-- The database is created by the POSTGRES_DB environment variable

-- Set timezone
SET timezone = 'UTC';

-- Create basic database functions if needed
-- (Prisma will handle the actual schema creation)