# Migration Guide: React + Vite to Next.js

This document outlines the key changes made during the migration from React + Vite to Next.js.

## Architecture Changes

### 1. Routing
- **Before**: Client-side routing with React Router (implicit)
- **After**: Next.js App Router with file-based routing
- **Impact**: Better SEO, server-side rendering support, improved performance

### 2. API Routes
- **Before**: Separate Express.js server (`server/index.js`)
- **After**: Next.js API routes (`app/api/*`)
- **Impact**: Unified codebase, easier deployment, better integration

### 3. Component Structure
- **Before**: All components in `components/` directory
- **After**: Components remain in `components/` but marked with `'use client'` directive
- **Impact**: Better separation of client/server components

### 4. Environment Variables
- **Before**: `VITE_API_URL`, `process.env.API_KEY`
- **After**: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_GEMINI_API_KEY`
- **Impact**: Next.js convention, better security practices

## Key Improvements

### 1. Type Safety
- Improved TypeScript types throughout
- Better type inference for API routes
- Type-safe database queries

### 2. Error Handling
- Better error messages in API routes
- Improved error boundaries
- More descriptive error responses

### 3. Database Connection
- Connection pooling with singleton pattern
- Better error handling for database operations
- Improved initialization flow

### 4. Code Organization
- Clear separation of concerns
- Better folder structure
- Improved maintainability

## File Mapping

| Original Location | New Location | Notes |
|------------------|-------------|-------|
| `server/index.js` | `app/api/*/route.ts` | Split into multiple route files |
| `server/routes/auth.js` | `app/api/auth/*/route.ts` | Next.js route handlers |
| `server/routes/content.js` | `app/api/content/*/route.ts` | Next.js route handlers |
| `server/db/index.js` | `lib/db/index.ts` | TypeScript conversion |
| `services/authService.ts` | `lib/services/authService.ts` | Added 'use client' |
| `services/contentService.ts` | `lib/services/contentService.ts` | Updated API URLs |
| `services/audioUtils.ts` | `lib/utils/audioUtils.ts` | Moved to utils |
| `App.tsx` | `app/page.tsx` | Main app component |
| `index.tsx` | N/A | Not needed in Next.js |
| `vite.config.ts` | `next.config.js` | Next.js configuration |

## Breaking Changes

### 1. API URLs
- Client-side services now use `/api/*` instead of `http://localhost:5000/api/*`
- Update any hardcoded URLs in your code

### 2. Environment Variables
- Must prefix client-side variables with `NEXT_PUBLIC_`
- Server-side variables don't need prefix

### 3. Component Imports
- All imports updated to use `@/` alias
- Relative imports changed to absolute imports

## Migration Checklist

- [x] Create Next.js project structure
- [x] Migrate database setup
- [x] Convert API routes
- [x] Migrate components
- [x] Update services
- [x] Update environment variables
- [x] Create documentation
- [x] Test authentication flow
- [x] Test API endpoints
- [x] Verify component functionality

## Testing the Migration

1. **Database Setup**
   ```bash
   # Create database
   createdb vocalodia
   
   # Initialize (visit /api/init)
   curl http://localhost:3000/api/init
   ```

2. **Authentication**
   - Test sign up flow
   - Test sign in flow
   - Verify JWT tokens

3. **Content Loading**
   - Verify scenarios load
   - Verify courses load
   - Verify quests load

4. **Voice Features**
   - Test live session
   - Test shadowing session
   - Verify audio playback

## Known Issues & Solutions

### Issue: Gemini API Key Exposure
**Problem**: API key is exposed to client-side code
**Solution**: Consider moving to server-side API routes for better security

### Issue: Database Connection Pooling
**Problem**: Multiple connections may be created
**Solution**: Implemented singleton pattern for connection pool

### Issue: Environment Variables
**Problem**: Client-side variables need `NEXT_PUBLIC_` prefix
**Solution**: Updated all references in code

## Future Improvements

1. **Server Components**: Convert some components to server components where possible
2. **API Security**: Move Gemini API calls to server-side routes
3. **Caching**: Implement Next.js caching strategies
4. **Optimization**: Add image optimization, code splitting
5. **Testing**: Add unit tests and integration tests
6. **Monitoring**: Add error tracking and analytics

## Support

For issues or questions about the migration, please refer to the main README.md or create an issue in the repository.


sudo systemctl stop vocal-odia
sleep 5
sudo fuser -k 3003/tcp
sudo cp /home/ubuntu/vocal-odia/vocal-odia.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start vocal-odia