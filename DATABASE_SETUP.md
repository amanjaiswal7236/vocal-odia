# Database Setup Guide

## Quick Fix for Database Connection Errors

If you're seeing `ECONNREFUSED` errors, follow these steps:

### 1. Check if PostgreSQL is Running

**Windows:**
```powershell
# Check if PostgreSQL service is running
Get-Service -Name postgresql*

# Start PostgreSQL service if not running
Start-Service -Name postgresql-x64-*
```

**Mac/Linux:**
```bash
# Check if PostgreSQL is running
pg_isready

# Start PostgreSQL (if using Homebrew on Mac)
brew services start postgresql

# Or using systemd (Linux)
sudo systemctl start postgresql
```

### 2. Create the Database

```bash
# Using psql command line
psql -U postgres
CREATE DATABASE vocalodia;
\q
```

Or using createdb:
```bash
createdb -U postgres vocalodia
```

### 3. Configure Environment Variables

Create a `.env` file in the project root with:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=vocalodia
DB_USER=postgres
DB_PASSWORD=your_postgres_password
JWT_SECRET=your-secret-key-change-in-production
NEXT_PUBLIC_GEMINI_API_KEY=your-gemini-api-key
```

**Important:** Replace `your_postgres_password` with your actual PostgreSQL password.

### 4. Initialize the Database

After starting the dev server (`npm run dev`), visit:
```
http://localhost:3000/api/init
```

Or use curl:
```bash
curl http://localhost:3000/api/init
```

### 5. Verify Database Connection

Check the health endpoint:
```
http://localhost:3000/api/health
```

This will show if the database is connected.

## Common Issues

### Issue: `ECONNREFUSED`
**Solution:** PostgreSQL is not running. Start the PostgreSQL service.

### Issue: `3D000` - Database does not exist
**Solution:** Create the database first:
```sql
CREATE DATABASE vocalodia;
```

### Issue: `28P01` - Authentication failed
**Solution:** Check your `DB_USER` and `DB_PASSWORD` in the `.env` file.

### Issue: `ENOTFOUND` - Host not found
**Solution:** Check your `DB_HOST` in the `.env` file. Use `localhost` for local development.

## Testing the Connection

You can test the database connection by visiting:
- Health check: `http://localhost:3000/api/health`
- Database init: `http://localhost:3000/api/init`

## Default PostgreSQL Setup

If you just installed PostgreSQL, the default settings are:
- **Host:** localhost
- **Port:** 5432
- **User:** postgres
- **Password:** (set during installation)
- **Database:** (needs to be created)

## Need Help?

1. Check the terminal output for detailed error messages
2. Visit `/api/health` to see database connection status
3. Verify your `.env` file has the correct values
4. Ensure PostgreSQL is running and accessible

