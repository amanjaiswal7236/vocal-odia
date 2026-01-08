import { NextResponse } from 'next/server';
import { testConnection } from '@/lib/db';

export async function GET() {
  const dbTest = await testConnection();
  
  return NextResponse.json({ 
    status: 'ok',
    database: dbTest.success ? 'connected' : 'disconnected',
    databaseError: dbTest.error,
    timestamp: new Date().toISOString(),
  });
}

