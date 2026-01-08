import { query } from './index';
import bcrypt from 'bcryptjs';

export const initUsersTable = async () => {
  try {
    // Check if users table exists
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    const tableExists = tableCheck.rows[0].exists;
    
    if (!tableExists) {
      // Create table if it doesn't exist
      await query(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          avatar TEXT,
          role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
          tokens INTEGER DEFAULT 0,
          sessions INTEGER DEFAULT 0,
          last_active BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
          streak INTEGER DEFAULT 0,
          mistakes_fixed TEXT[] DEFAULT ARRAY[]::TEXT[],
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('Users table created');
    } else {
      // Table exists, check and add missing columns
      console.log('Users table exists, checking for missing columns...');
      
      const columns = [
        { name: 'role', sql: "ADD COLUMN role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin'))" },
        { name: 'tokens', sql: 'ADD COLUMN tokens INTEGER DEFAULT 0' },
        { name: 'sessions', sql: 'ADD COLUMN sessions INTEGER DEFAULT 0' },
        { name: 'last_active', sql: 'ADD COLUMN last_active BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000' },
        { name: 'streak', sql: 'ADD COLUMN streak INTEGER DEFAULT 0' },
        { name: 'mistakes_fixed', sql: "ADD COLUMN mistakes_fixed TEXT[] DEFAULT ARRAY[]::TEXT[]" },
        { name: 'created_at', sql: 'ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
        { name: 'avatar', sql: 'ADD COLUMN avatar TEXT' }
      ];
      
      for (const col of columns) {
        const check = await query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = $1;
        `, [col.name]);
        
        if (check.rows.length === 0) {
          await query(`ALTER TABLE users ${col.sql};`);
          console.log(`Added ${col.name} column`);
        }
      }
    }

    // Create admin user if doesn't exist
    const adminCheck = await query('SELECT * FROM users WHERE email = $1', ['admin@vocalodia.com']);
    if (adminCheck.rows.length === 0) {
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      
      await query(
        `INSERT INTO users (email, password_hash, name, role, avatar) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          'admin@vocalodia.com',
          hashedPassword,
          'Admin User',
          'admin',
          'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin'
        ]
      );
      console.log('Admin user created: admin@vocalodia.com / admin123');
    }
  } catch (error) {
    console.error('Error initializing users table:', error);
    throw error;
  }
};

