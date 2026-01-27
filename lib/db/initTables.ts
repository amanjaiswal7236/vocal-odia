import { query } from './index';

export const initContentTables = async () => {
  try {
    // Categories (subjects) table - admin-defined
    await query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        order_index INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

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

    // Add hyperparameter columns if they don't exist (for existing databases)
    const hyperparameterColumns = [
      { name: 'temperature', type: 'REAL' },
      { name: 'top_p', type: 'REAL' },
      { name: 'top_k', type: 'INTEGER' },
      { name: 'max_output_tokens', type: 'INTEGER' }
    ];

    for (const col of hyperparameterColumns) {
      try {
        const columnCheck = await query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'scenarios' AND column_name = $1
        `, [col.name]);
        
        if (columnCheck.rows.length === 0) {
          await query(`ALTER TABLE scenarios ADD COLUMN ${col.name} ${col.type}`);
          console.log(`✓ Added ${col.name} column to scenarios table`);
        }
      } catch (error: any) {
        // Column might already exist or table doesn't exist yet
        console.log(`${col.name} column check:`, error.message);
      }
    }

    try {
      const catCol = await query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'scenarios' AND column_name = 'category_id'
      `);
      if (catCol.rows.length === 0) {
        await query('ALTER TABLE scenarios ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL');
        console.log('✓ Added category_id column to scenarios table');
      }
    } catch (error: any) {
      console.log('Scenarios category_id check:', error.message);
    }

    // Courses table
    await query(`
      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        level VARCHAR(20) NOT NULL CHECK (level IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')),
        description TEXT,
        prerequisite_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        is_unlocked BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    try {
      const courseCatCol = await query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'courses' AND column_name = 'category_id'
      `);
      if (courseCatCol.rows.length === 0) {
        await query('ALTER TABLE courses ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL');
        console.log('✓ Added category_id column to courses table');
      }
    } catch (error: any) {
      console.log('Courses category_id check:', error.message);
    }

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
        session_audio_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ User sessions table created/verified');

    // Add session_audio_url column if it doesn't exist
    try {
      const columnCheck = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'user_sessions' AND column_name = 'session_audio_url'
      `);
      
      if (columnCheck.rows.length === 0) {
        await query('ALTER TABLE user_sessions ADD COLUMN session_audio_url TEXT');
        console.log('✓ Added session_audio_url column to user_sessions table');
      }
    } catch (error: any) {
      console.log('Session audio URL column check:', error.message);
    }

    // Conversation messages table to store session conversations
    await query(`
      CREATE TABLE IF NOT EXISTS conversation_messages (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        sender VARCHAR(10) NOT NULL CHECK (sender IN ('user', 'ai')),
        timestamp BIGINT NOT NULL,
        audio_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Conversation messages table created/verified');

    // Add audio_url column if it doesn't exist
    try {
      const columnCheck = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'conversation_messages' AND column_name = 'audio_url'
      `);
      
      if (columnCheck.rows.length === 0) {
        await query('ALTER TABLE conversation_messages ADD COLUMN audio_url TEXT');
        console.log('✓ Added audio_url column to conversation_messages table');
      }
    } catch (error: any) {
      console.log('Message audio URL column check:', error.message);
    }

    // Add detected_language column if it doesn't exist
    try {
      const columnCheck = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'conversation_messages' AND column_name = 'detected_language'
      `);
      
      if (columnCheck.rows.length === 0) {
        await query('ALTER TABLE conversation_messages ADD COLUMN detected_language VARCHAR(10)');
        console.log('✓ Added detected_language column to conversation_messages table');
      }
    } catch (error: any) {
      console.log('Detected language column check:', error.message);
    }

    // Add is_flagged column if it doesn't exist
    try {
      const columnCheck = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'conversation_messages' AND column_name = 'is_flagged'
      `);
      
      if (columnCheck.rows.length === 0) {
        await query('ALTER TABLE conversation_messages ADD COLUMN is_flagged BOOLEAN DEFAULT false');
        console.log('✓ Added is_flagged column to conversation_messages table');
      }
    } catch (error: any) {
      console.log('Is flagged column check:', error.message);
    }

    // Add feedback column if it doesn't exist (thumbs up/down per message)
    try {
      const columnCheck = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'conversation_messages' AND column_name = 'feedback'
      `);
      if (columnCheck.rows.length === 0) {
        await query(`ALTER TABLE conversation_messages ADD COLUMN feedback VARCHAR(10) CHECK (feedback IN ('up', 'down'))`);
        console.log('✓ Added feedback column to conversation_messages table');
      }
    } catch (error: any) {
      console.log('Feedback column check:', error.message);
    }

    // Add feedback_reason column if it doesn't exist (optional reason when thumbs down)
    try {
      const columnCheck = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'conversation_messages' AND column_name = 'feedback_reason'
      `);
      if (columnCheck.rows.length === 0) {
        await query('ALTER TABLE conversation_messages ADD COLUMN feedback_reason TEXT');
        console.log('✓ Added feedback_reason column to conversation_messages table');
      }
    } catch (error: any) {
      console.log('Feedback reason column check:', error.message);
    }

    console.log('Content tables initialized');
  } catch (error) {
    console.error('Error initializing content tables:', error);
    throw error;
  }
};

