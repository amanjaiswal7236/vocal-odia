import { NextResponse } from 'next/server';
import { initUsersTable } from '@/lib/db/initUsers';
import { initContentTables } from '@/lib/db/initTables';
import { seedData } from '@/lib/db/seed';
import { testConnection } from '@/lib/db';

export async function GET() {
  try {
    // First, test the database connection
    const connectionTest = await testConnection();
    if (!connectionTest.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Database connection failed',
          details: connectionTest.error,
          hint: 'Please ensure PostgreSQL is running and your .env file is configured correctly. ' +
                'Check DB_HOST, DB_PORT, DB_NAME, DB_USER, and DB_PASSWORD environment variables.'
        },
        { status: 500 }
      );
    }

    // Initialize tables
    await initUsersTable();
    await initContentTables();
    await seedData();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database initialized successfully',
      tables: ['users', 'scenarios', 'daily_nuggets', 'courses', 'modules', 'lessons', 'badges', 'quests', 'user_sessions', 'user_lesson_progress', 'shadowing_tasks']
    });
  } catch (error: any) {
    console.error('Database initialization error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Database initialization failed',
        code: error.code,
        hint: error.code === 'ECONNREFUSED' 
          ? 'PostgreSQL is not running. Please start it and try again.'
          : error.code === '3D000'
          ? `Database "${process.env.DB_NAME || 'vocalodia'}" does not exist. Please create it first with: CREATE DATABASE vocalodia;`
          : error.code === '42501'
          ? 'Permission denied. The database user needs CREATE permission. Run: GRANT ALL PRIVILEGES ON DATABASE vocal_odia TO vocal_user; GRANT ALL ON SCHEMA public TO vocal_user;'
          : undefined
      },
      { status: 500 }
    );
  }
}

