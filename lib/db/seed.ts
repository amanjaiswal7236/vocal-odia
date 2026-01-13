import { query } from './index';
import bcrypt from 'bcryptjs';

export const seedData = async () => {
  try {
    console.log('Starting database seeding...');

    // 1. Seed Scenarios
    console.log('Seeding scenarios...');
    const scenariosCheck = await query('SELECT COUNT(*) FROM scenarios');
    if (parseInt(scenariosCheck.rows[0].count) === 0) {
      await query(`
        INSERT INTO scenarios (title, description, icon, prompt, image) VALUES
        ('Job Interview', 'Practice for a tech job interview at an IT park in Bhubaneswar.', 'fa-briefcase', 'You are an HR manager at a growing tech startup in Infocity, Bhubaneswar. Interview the user for a Junior Software Engineer position.', 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&h=600&fit=crop'),
        ('Coffee Shop Conversation', 'Practice casual conversation at a local café.', 'fa-coffee', 'You are a friendly barista at a popular coffee shop in Cuttack. Have a casual conversation with the customer about their day and recommend some local favorites.', 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&h=600&fit=crop'),
        ('Market Shopping', 'Practice bargaining and shopping in a local market.', 'fa-shopping-bag', 'You are a vendor at a local market in Puri. Help the customer shop for vegetables and practice bargaining. Use local references and Odia-influenced English patterns.', 'https://images.unsplash.com/photo-1556910096-6f5e72db6803?w=800&h=600&fit=crop'),
        ('Doctor Appointment', 'Practice describing symptoms and health concerns.', 'fa-user-doctor', 'You are a doctor at a clinic in Bhubaneswar. The patient needs to describe their symptoms. Help them use proper English medical vocabulary.', 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=800&h=600&fit=crop'),
        ('Restaurant Ordering', 'Practice ordering food at a restaurant.', 'fa-utensils', 'You are a waiter at a restaurant serving Odia cuisine. Help the customer order food and answer questions about the menu.', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop')
      `);
      console.log('✓ Scenarios seeded');
    } else {
      console.log('✓ Scenarios already exist, skipping...');
    }

    // 2. Seed Badges
    console.log('Seeding badges...');
    const badgesCheck = await query('SELECT COUNT(*) FROM badges');
    if (parseInt(badgesCheck.rows[0].count) === 0) {
      await query(`
        INSERT INTO badges (name, icon, threshold) VALUES
        ('Cuttack Silver', '🥈', 5),
        ('Puri Gold', '🥇', 15),
        ('Bhubaneswar Diamond', '💎', 50),
        ('Odisha Champion', '🏆', 100),
        ('Language Master', '🌟', 200)
      `);
      console.log('✓ Badges seeded');
    } else {
      console.log('✓ Badges already exist, skipping...');
    }

    // 3. Seed Shadowing Tasks
    console.log('Seeding shadowing tasks...');
    const shadowingCheck = await query('SELECT COUNT(*) FROM shadowing_tasks');
    if (parseInt(shadowingCheck.rows[0].count) === 0) {
      await query(`
        INSERT INTO shadowing_tasks (text, translation, focus_area, order_index) VALUES
        ('I have been living in Bhubaneswar for the past five years.', 'ମୁଁ ଗତ ପାଞ୍ଚ ବର୍ଷ ହେବ ଭୁବନେଶ୍ୱରରେ ରହୁଛି।', 'Present Perfect Continuous', 0),
        ('Would you like to join us for a coffee at KIIT Square?', 'ଆପଣ ଆମ ସହିତ କିଟ୍ ସ୍କୋୟାରରେ କଫି ପିଇବାକୁ ଯିବେ କି?', 'Polite Invitations', 1),
        ('I''ll be taking the initiative to complete the project by Friday.', 'ମୁଁ ଶୁକ୍ରବାର ସୁଦ୍ଧା ପ୍ରକଳ୍ପ ଶେଷ କରିବାକୁ ନିଜେ ଦାୟିତ୍ୱ ନେବି।', 'Corporate Vocabulary', 2),
        ('Could you please help me understand this concept better?', 'ଆପଣ ଦୟାକରି ମୋତେ ଏହି ଧାରଣାଟିକୁ ଭଲ ଭାବରେ ବୁଝାଇ ଦେବେ କି?', 'Polite Requests', 3),
        ('I am working on improving my communication skills.', 'ମୁଁ ମୋର ସଂଚାର ଦକ୍ଷତା ଉନ୍ନତି କରିବା ଉପରେ କାମ କରୁଛି।', 'Self-Introduction', 4),
        ('Let me explain the situation to you clearly.', 'ମୁଁ ଆପଣଙ୍କୁ ସ୍ପଷ୍ଟ ଭାବରେ ପରିସ୍ଥିତି ବୁଝାଇ ଦେଉଛି।', 'Clear Communication', 5)
      `);
      console.log('✓ Shadowing tasks seeded');
    } else {
      console.log('✓ Shadowing tasks already exist, skipping...');
    }

    // 4. Seed Daily Nuggets
    console.log('Seeding daily nuggets...');
    const nuggetsCheck = await query('SELECT COUNT(*) FROM daily_nuggets');
    if (parseInt(nuggetsCheck.rows[0].count) === 0) {
      await query(`
        INSERT INTO daily_nuggets (word, definition, example) VALUES
        ('Collaboration', 'The action of working with someone to produce something.', 'Our team values strong collaboration.'),
        ('Initiative', 'The ability to assess and initiate things independently.', 'She showed great initiative by starting the project.'),
        ('Efficient', 'Achieving maximum productivity with minimum wasted effort.', 'The new system is more efficient than the old one.'),
        ('Deadline', 'The latest time or date by which something should be completed.', 'We need to meet the project deadline.'),
        ('Feedback', 'Information about reactions to a product or performance.', 'Please provide feedback on the presentation.'),
        ('Networking', 'The action or process of interacting with others to exchange information.', 'Networking is important for career growth.'),
        ('Prioritize', 'Designate or treat something as more important than other things.', 'We need to prioritize urgent tasks.'),
        ('Delegate', 'Entrust a task or responsibility to another person.', 'A good manager knows how to delegate effectively.')
      `);
      console.log('✓ Daily nuggets seeded');
    } else {
      console.log('✓ Daily nuggets already exist, skipping...');
    }

    // 5. Seed Courses with Modules and Lessons
    console.log('Seeding courses...');
    const coursesCheck = await query('SELECT COUNT(*) FROM courses');
    if (parseInt(coursesCheck.rows[0].count) === 0) {
      // Course 1: Foundational Fluency
      const course1Result = await query(`
        INSERT INTO courses (title, level, description, is_unlocked) 
        VALUES ('Foundational Fluency', 'BEGINNER', 'Master the basics of English grammar while unlearning direct Odia translations.', true)
        RETURNING id
      `);
      const course1Id = course1Result.rows[0].id;

      const module1Result = await query(`
        INSERT INTO modules (course_id, title, order_index)
        VALUES ($1, 'Timeline & Duration', 0)
        RETURNING id
      `, [course1Id]);
      const module1Id = module1Result.rows[0].id;

      await query(`
        INSERT INTO lessons (module_id, title, objective, prompt, order_index) VALUES
        ($1, 'For vs Since', 'Correctly express how long you have been doing something.', 'Ask the user how long they have lived in their current town. Correct "since" vs "for" errors gently.', 0),
        ($1, 'Present Perfect Tense', 'Use present perfect to talk about past actions with present relevance.', 'Ask the user about their work experience. Correct "I am working since 2 years" to "I have been working for 2 years".', 1)
      `, [module1Id]);

      const module2Result = await query(`
        INSERT INTO modules (course_id, title, order_index)
        VALUES ($1, 'Common Mistakes', 1)
        RETURNING id
      `, [course1Id]);
      const module2Id = module2Result.rows[0].id;

      await query(`
        INSERT INTO lessons (module_id, title, objective, prompt, order_index) VALUES
        ($1, 'Myself vs I am', 'Stop using "Myself" for introductions.', 'Roleplay a networking event. When the user says "Myself [Name]", gently correct to "I am [Name]".', 0),
        ($1, 'Did not + Verb Form', 'Use base form of verb after "did not".', 'Ask the user about something they didn''t do. Correct "did not told" to "did not tell".', 1)
      `, [module2Id]);

      // Course 2: Professional Edge
      const course2Result = await query(`
        INSERT INTO courses (title, level, description, prerequisite_id, is_unlocked)
        VALUES ('Professional Edge', 'INTERMEDIATE', 'Prepare for the corporate world in Odisha''s tech hubs like Infocity.', $1, false)
        RETURNING id
      `, [course1Id]);
      const course2Id = course2Result.rows[0].id;

      const module3Result = await query(`
        INSERT INTO modules (course_id, title, order_index)
        VALUES ($1, 'Modern Networking', 0)
        RETURNING id
      `, [course2Id]);
      const module3Id = module3Result.rows[0].id;

      await query(`
        INSERT INTO lessons (module_id, title, objective, prompt, order_index) VALUES
        ($1, 'First Impressions', 'Master corporate introductions without using "Myself".', 'Imagine a networking event at Fortune Tower. Introduce yourself and ask the user about their role. Correct any "Myself" usage.', 0),
        ($1, 'Email Etiquette', 'Write professional emails with proper structure.', 'Help the user draft a professional email to a colleague. Focus on clarity and politeness.', 1)
      `, [module3Id]);

      const module4Result = await query(`
        INSERT INTO modules (course_id, title, order_index)
        VALUES ($1, 'Meeting Skills', 1)
        RETURNING id
      `, [course2Id]);
      const module4Id = module4Result.rows[0].id;

      await query(`
        INSERT INTO lessons (module_id, title, objective, prompt, order_index) VALUES
        ($1, 'Expressing Opinions', 'Share ideas professionally in meetings.', 'Roleplay a team meeting. Help the user express their opinion on a project proposal professionally.', 0),
        ($1, 'Asking for Clarification', 'Request information politely in professional settings.', 'The user needs to ask their manager for clarification. Help them phrase it professionally.', 1)
      `, [module4Id]);

      // Course 3: Leadership & Nuance
      const course3Result = await query(`
        INSERT INTO courses (title, level, description, prerequisite_id, is_unlocked)
        VALUES ('Leadership & Nuance', 'ADVANCED', 'Communicate complex ideas with precision and confidence.', $1, false)
        RETURNING id
      `, [course2Id]);
      const course3Id = course3Result.rows[0].id;

      const module5Result = await query(`
        INSERT INTO modules (course_id, title, order_index)
        VALUES ($1, 'The Art of Persuasion', 0)
        RETURNING id
      `, [course3Id]);
      const module5Id = module5Result.rows[0].id;

      await query(`
        INSERT INTO lessons (module_id, title, objective, prompt, order_index) VALUES
        ($1, 'Influencing Others', 'Learn to use modal verbs to suggest instead of command.', 'Ask the user to persuade you to adopt a new project tool. Look for overly direct or blunt phrasing and suggest softer alternatives.', 0),
        ($1, 'Giving Constructive Feedback', 'Provide feedback that encourages improvement.', 'Roleplay a performance review. Help the user give feedback to a team member constructively.', 1)
      `, [module5Id]);

      console.log('✓ Courses seeded');
    } else {
      console.log('✓ Courses already exist, skipping...');
    }

    console.log('\n✅ Database seeding completed successfully!');
    console.log('\nSeeded data:');
    console.log('- Scenarios: 5');
    console.log('- Badges: 5');
    console.log('- Shadowing Tasks: 6');
    console.log('- Daily Nuggets: 8');
    console.log('- Courses: 3 (with modules and lessons)');
    
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
};

