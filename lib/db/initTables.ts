import { query } from './index';

export const initContentTables = async () => {
  try {
    // Scenarios table
    await query(`
      CREATE TABLE IF NOT EXISTS scenarios (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        icon VARCHAR(50),
        prompt TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Add image column if it doesn't exist (for existing databases)
    try {
      const columnCheck = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'scenarios' AND column_name = 'image'
      `);
      
      if (columnCheck.rows.length === 0) {
        await query('ALTER TABLE scenarios ADD COLUMN image TEXT');
        console.log('✓ Added image column to scenarios table');
      }
    } catch (error: any) {
      // Column might already exist or table doesn't exist yet
      console.log('Image column check:', error.message);
    }

    // Courses table
    await query(`
      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        level VARCHAR(20) NOT NULL CHECK (level IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')),
        description TEXT,
        prerequisite_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
        is_unlocked BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Modules table
    await query(`
      CREATE TABLE IF NOT EXISTS modules (
        id SERIAL PRIMARY KEY,
        course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        order_index INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Lessons table
    await query(`
      CREATE TABLE IF NOT EXISTS lessons (
        id SERIAL PRIMARY KEY,
        module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        objective TEXT,
        prompt TEXT NOT NULL,
        order_index INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // User lesson progress
    await query(`
      CREATE TABLE IF NOT EXISTS user_lesson_progress (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        completed BOOLEAN DEFAULT false,
        completed_at TIMESTAMP,
        UNIQUE(user_id, lesson_id)
      )
    `);

    // Daily nuggets table
    await query(`
      CREATE TABLE IF NOT EXISTS daily_nuggets (
        id SERIAL PRIMARY KEY,
        word VARCHAR(255) NOT NULL,
        definition TEXT NOT NULL,
        example TEXT NOT NULL,
        date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Shadowing tasks table
    await query(`
      CREATE TABLE IF NOT EXISTS shadowing_tasks (
        id SERIAL PRIMARY KEY,
        text TEXT NOT NULL,
        translation TEXT NOT NULL,
        focus_area VARCHAR(255) NOT NULL,
        order_index INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Badges table
    await query(`
      CREATE TABLE IF NOT EXISTS badges (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        icon VARCHAR(10) NOT NULL,
        threshold INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // User quests (daily quests are user-specific)
    await query(`
      CREATE TABLE IF NOT EXISTS user_quests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        label VARCHAR(255) NOT NULL,
        target INTEGER NOT NULL,
        current INTEGER DEFAULT 0,
        completed BOOLEAN DEFAULT false,
        type VARCHAR(20) NOT NULL CHECK (type IN ('session', 'word', 'shadow')),
        date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // User sessions table to track conversation sessions
    await query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        scenario_id VARCHAR(255),
        scenario_title VARCHAR(255),
        is_course_lesson BOOLEAN DEFAULT false,
        course_id VARCHAR(255),
        tokens_used INTEGER DEFAULT 0,
        duration_seconds INTEGER DEFAULT 0,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ User sessions table created/verified');

    console.log('Content tables initialized');
  } catch (error) {
    console.error('Error initializing content tables:', error);
    throw error;
  }
};

