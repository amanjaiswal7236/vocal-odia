# Vocal – Voice Tutor (Next.js)

A modern, AI-powered voice practice and language learning platform. Real-time voice conversations with AI (Google Gemini), structured courses, shadowing, and free-form document practice. Built with Next.js, PostgreSQL, and improved type safety.

## Features

- ✅ User authentication (Sign Up / Sign In)
- ✅ PostgreSQL database integration
- ✅ Admin role-based access
- ✅ Real-time voice conversations with AI (Google Gemini)
- ✅ Shadowing sessions for pronunciation practice
- ✅ Structured course system with modules and lessons
- ✅ Daily quests and gamification
- ✅ User profiles with progress tracking
- ✅ Admin dashboard for content management

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v12 or higher)
- Google Gemini API Key

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Database Setup

1. Create a PostgreSQL database:
```bash
createdb vocalodia
```

Or using psql:
```sql
CREATE DATABASE vocalodia;
```

2. Copy `.env.example` to `.env` and update database credentials:
```bash
cp .env.example .env
```

### 3. Environment Variables

Update the `.env` file with your configuration:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=vocalodia
DB_USER=postgres
DB_PASSWORD=postgres

# JWT Secret (change this in production!)
JWT_SECRET=your-secret-key-change-in-production

# Admin Password (for initial admin creation)
ADMIN_PASSWORD=admin123

# Gemini API Key
NEXT_PUBLIC_GEMINI_API_KEY=your-gemini-api-key

# Azure Blob Storage (Optional - for audio recording storage)
# Get your connection string from Azure Portal > Storage Account > Access Keys
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=YOUR_ACCOUNT;AccountKey=YOUR_KEY;EndpointSuffix=core.windows.net
AZURE_STORAGE_CONTAINER_NAME=audio-recordings
```

**Note:** 
- For production, consider moving the Gemini API key to server-side API routes instead of exposing it to the client.
- Azure Blob Storage is optional. If not configured, audio recording features will be skipped gracefully without breaking the app.

### 4. Initialize Database

Run the initialization endpoint to set up tables and seed data:

```bash
# Start the development server first
npm run dev

# Then visit or curl:
curl http://localhost:3000/api/init
```

Or visit `http://localhost:3000/api/init` in your browser.

### 5. Run the Application

```bash
npm run dev
```

The app will be available at:
- Frontend: http://localhost:3000
- API Routes: http://localhost:3000/api/*

## Default Admin Credentials

- **Email:** admin@vocalodia.com
- **Password:** admin123

The admin user is automatically created on first database initialization.

## Project Structure

```
├── app/                    # Next.js app router
│   ├── api/               # API routes
│   │   ├── auth/         # Authentication endpoints
│   │   ├── content/      # Content management endpoints
│   │   └── init/         # Database initialization
│   ├── page.tsx          # Main app page
│   └── layout.tsx        # Root layout
├── components/           # React components
├── lib/                  # Library code
│   ├── auth/            # Authentication middleware
│   ├── db/              # Database utilities
│   ├── services/        # Client-side services
│   └── utils/           # Utility functions
├── types/               # TypeScript type definitions
└── public/             # Static assets
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - User registration
- `POST /api/auth/signin` - User login

### Content
- `GET /api/content/scenarios` - Get all scenarios
- `GET /api/content/courses` - Get all courses
- `GET /api/content/courses/user/:userId` - Get user-specific courses with progress
- `GET /api/content/nuggets` - Get daily nuggets
- `GET /api/content/shadowing-tasks` - Get shadowing tasks
- `GET /api/content/quests/user/:userId` - Get user quests
- `GET /api/content/badges` - Get badges
- `GET /api/content/stats/user/:userId` - Get user stats

### Admin (requires authentication)
- `POST /api/content/scenarios` - Create scenario
- `PUT /api/content/scenarios/:id` - Update scenario
- `DELETE /api/content/scenarios/:id` - Delete scenario
- `POST /api/content/courses` - Create course
- `POST /api/content/nuggets` - Create nugget
- `DELETE /api/content/nuggets/:id` - Delete nugget

### Utility
- `GET /api/health` - Health check
- `GET /api/init` - Initialize database (run once)

## Improvements Over Original

1. **Next.js App Router**: Modern routing with server components support
2. **Better Type Safety**: Improved TypeScript types throughout
3. **API Routes**: Server-side API endpoints instead of separate Express server
4. **Improved Error Handling**: Better error messages and handling
5. **Environment Variables**: Proper Next.js environment variable handling
6. **Code Organization**: Better folder structure and separation of concerns
7. **Database Connection Pooling**: Improved database connection management

## Development

- Frontend runs on port 3000 (Next.js default)
- Database runs on PostgreSQL default port 5432
- Hot reload enabled in development mode

## Production Deployment

1. Set up environment variables in your hosting platform
2. Build the application: `npm run build`
3. Start the production server: `npm start`
4. Ensure PostgreSQL is accessible from your hosting environment
5. Run database initialization: `GET /api/init`

## Security Notes

- Change `JWT_SECRET` in production
- Consider moving Gemini API key to server-side API routes
- Use environment variables for all sensitive data
- Enable HTTPS in production
- Implement rate limiting for API routes

## License

MIT
