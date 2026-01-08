import pg from 'pg';
import { Pool } from 'pg';

const { Pool: PoolConstructor } = pg;

// Create a singleton pool instance
let pool: Pool | null = null;

export const getPool = (): Pool => {
  if (!pool) {
    const config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'vocalodia',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      // Connection pool settings
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

    console.log('Initializing database connection with config:', {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password ? '***' : 'not set',
    });

    pool = new PoolConstructor(config);

    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
      pool = null; // Reset pool on error to allow reconnection
    });

    pool.on('connect', () => {
      console.log('Database connection established');
    });
  }

  return pool;
};

// Helper function to execute queries with better error handling
export const query = async (text: string, params?: any[]) => {
  const pool = getPool();
  try {
    return await pool.query(text, params);
  } catch (error: any) {
    // Provide more helpful error messages
    if (error.code === 'ECONNREFUSED') {
      throw new Error(
        `Database connection refused. Please ensure PostgreSQL is running and accessible at ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}. ` +
        `Check your .env file for DB_HOST, DB_PORT, DB_NAME, DB_USER, and DB_PASSWORD.`
      );
    }
    if (error.code === 'ENOTFOUND') {
      throw new Error(`Database host not found: ${process.env.DB_HOST || 'localhost'}`);
    }
    if (error.code === '3D000') {
      throw new Error(`Database "${process.env.DB_NAME || 'vocalodia'}" does not exist. Please create it first.`);
    }
    if (error.code === '28P01') {
      throw new Error(`Database authentication failed. Check DB_USER and DB_PASSWORD in your .env file.`);
    }
    throw error;
  }
};

// Test database connection
export const testConnection = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const result = await query('SELECT NOW()');
    return { success: true };
  } catch (error: any) {
    return { 
      success: false, 
      error: error.message || 'Unknown database error' 
    };
  }
};

