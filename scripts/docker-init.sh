#!/bin/sh
set -e

echo "🚀 Starting API Scaffold initialization..."

# Wait for database to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until pg_isready -h postgres -p 5432 -U api_user > /dev/null 2>&1; do
  echo "   PostgreSQL not ready yet, retrying in 2 seconds..."
  sleep 2
done
echo "✅ PostgreSQL is ready!"

# Check if migrations exist and database is empty
MIGRATION_COUNT=$(find /app/prisma/migrations -name "*.sql" 2>/dev/null | wc -l || echo "0")

if [ "$MIGRATION_COUNT" -gt 0 ]; then
  echo "📋 Found existing migrations, applying them..."
  npx prisma migrate deploy
else
  echo "🔧 No migrations found, creating initial migration..."
  npx prisma migrate dev --name init --skip-generate
fi

echo "🔄 Generating Prisma client..."
npx prisma generate

echo "🎉 Database setup complete!"

# Start the development server
echo "🚀 Starting development server..."
exec yarn dev