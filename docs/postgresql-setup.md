# Database Setup Guide

This guide covers how to set up and connect to the PostgreSQL database with pgAdmin for database management.

## Quick Start

1. **Copy environment variables**:

   ```bash
   cp .env.example .env
   ```

2. **Start the full stack** (database migrations run automatically):

   ```bash
   docker-compose up -d
   ```

   Or start just the database services:

   ```bash
   docker-compose up -d postgres redis pgadmin
   ```

3. **For local development without Docker**:

   ```bash
   # Start database services only
   docker-compose up -d postgres redis pgadmin

   # Run the app locally
   yarn dev
   ```

## Database Configuration

### Environment Variables

The database connection is configured through environment variables in your `.env` file:

```env
# Database Configuration
DATABASE_URL="postgresql://api_user:api_password@localhost:5432/api_scaffold"
POSTGRES_DB=api_scaffold
POSTGRES_USER=api_user
POSTGRES_PASSWORD=api_password
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# pgAdmin Configuration
PGADMIN_DEFAULT_EMAIL=admin@api-scaffold.com
PGADMIN_DEFAULT_PASSWORD=admin123
PGADMIN_PORT=8080
```

### Docker Services

The `docker-compose.yml` includes four main services:

1. **PostgreSQL** (port 5432) - Database with health checks
2. **Redis** (port 6379) - Cache and session store
3. **pgAdmin** (port 8080) - Database management interface (auto-configured)
4. **App** (port 3000) - API application with automatic migration handling

## Connecting to PostgreSQL

### 1. Via Application

The application automatically connects using the `DATABASE_URL` environment variable.

Test the connection:

```bash
curl http://localhost:3000/health
```

### 2. Via pgAdmin (Web Interface)

#### Access pgAdmin:

- URL: http://localhost:8080
- Email: `admin@api-scaffold.com`
- Password: `admin123`

**Note**: The PostgreSQL server connection is automatically configured when pgAdmin starts. You should see "API Scaffold Database" already available in the server list.

#### How to Add a New Server in pgAdmin:

Follow these steps to manually add the PostgreSQL server:

1. **Access pgAdmin**: Open http://localhost:8080 in your browser
2. **Login**: Use the credentials above (admin@api-scaffold.com / admin123)
3. **Add Server**:
   - Right-click on "Servers" in the left panel
   - Select "Register" → "Server..."
4. **General Tab**:
   - **Name**: `API Scaffold Database` (or any name you prefer)
   - **Server Group**: `Servers` (default)
   - **Comments**: `Local development database` (optional)
5. **Connection Tab**:
   - **Host name/address**: `postgres` (Docker service name)
   - **Port**: `5432`
   - **Maintenance database**: `api_scaffold`
   - **Username**: `api_user`
   - **Password**: `api_password`
   - **Save password**: Check this box for convenience
6. **Advanced Tab** (optional):
   - **Connection timeout**: `10` (seconds)
   - **DB restriction**: Leave blank
7. **Click "Save"**

**Important Notes**:

- Always use `postgres` as the hostname (Docker service name), never `localhost` or `127.0.0.1`
- If you get a connection error, verify that the PostgreSQL container is running with `docker ps`
- The connection will fail if you use `localhost` because pgAdmin runs inside Docker

### 3. Via Command Line (psql)

#### From Host Machine:

```bash
psql -h localhost -p 5432 -U api_user -d api_scaffold
# Password: api_password
```

#### From Docker Container:

```bash
docker exec -it api-scaffold-postgres psql -U api_user -d api_scaffold
```

### 4. Via Database Client Tools

Use these connection parameters in your preferred database client:

- **Host**: `localhost`
- **Port**: `5432`
- **Database**: `api_scaffold`
- **Username**: `api_user`
- **Password**: `api_password`
- **SSL Mode**: `prefer` (optional)

## Database Schema Management

### Prisma Commands

**Note**: When using Docker, migrations are automatically applied on startup. For manual control:

```bash
# Generate Prisma client
npx prisma generate

# Create and apply migration (local development)
npx prisma migrate dev --name migration_name

# Apply pending migrations (production)
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset

# Open Prisma Studio
npx prisma studio
```

### Database Schema

The current schema includes these tables:

- `User` - User accounts and authentication
- `Payment` - Stripe payment records
- `Subscription` - Stripe subscription management
- `WebhookEvent` - Stripe webhook event processing

## Troubleshooting

### Common Issues

1. **Connection Refused**:

   ```bash
   # Check if containers are running
   docker ps

   # Check logs
   docker logs api-scaffold-postgres
   ```

2. **Authentication Failed**:
   - Verify credentials in `.env` file
   - Ensure `DATABASE_URL` matches container environment variables

3. **Port Already in Use**:

   ```bash
   # Find process using port
   lsof -i :5432

   # Kill process (be careful!)
   npx kill-port 5432
   ```

4. **Permission Denied**:
   ```bash
   # Reset Docker volumes
   docker-compose down -v
   docker-compose up -d
   ```

### Container Management

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs postgres
docker-compose logs pgadmin

# Restart specific service
docker-compose restart postgres

# Remove volumes (WARNING: deletes data)
docker-compose down -v
```

## Security Notes

### Development vs Production

**Development** (current setup):

- Simple passwords for easy local development
- pgAdmin accessible without authentication restrictions
- Database exposed on localhost

**Production** (recommendations):

- Use strong, randomly generated passwords
- Restrict pgAdmin access or use VPN
- Use connection pooling
- Enable SSL/TLS connections
- Limit database user permissions

### Environment Security

1. **Never commit `.env` files** to version control
2. **Use different credentials** for each environment
3. **Rotate passwords** regularly in production
4. **Use secrets management** for production deployments

## Production Deployment

For production, consider:

1. **Managed PostgreSQL** (AWS RDS, Google Cloud SQL, etc.)
2. **Connection pooling** (PgBouncer)
3. **Database monitoring**
4. **Automated backups**
5. **SSL/TLS encryption**

Example production `DATABASE_URL`:

```env
DATABASE_URL="postgresql://username:password@your-db-host:5432/dbname?sslmode=require"
```

## Backup and Restore

### Backup Database:

```bash
# Via Docker
docker exec api-scaffold-postgres pg_dump -U api_user api_scaffold > backup.sql

# Via host psql
pg_dump -h localhost -p 5432 -U api_user api_scaffold > backup.sql
```

### Restore Database:

```bash
# Via Docker
docker exec -i api-scaffold-postgres psql -U api_user api_scaffold < backup.sql

# Via host psql
psql -h localhost -p 5432 -U api_user api_scaffold < backup.sql
```
