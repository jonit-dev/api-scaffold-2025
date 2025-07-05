import 'reflect-metadata'; // CRITICAL: Must be imported first for TypeDI
import { Container } from 'typedi';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { beforeAll, afterAll, afterEach } from 'vitest';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Global test setup
beforeAll(async () => {
  // Set up test Supabase client
  const supabaseUrl = process.env.TEST_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.TEST_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not found in test environment');
  }

  const testSupabase = createClient(supabaseUrl, supabaseKey);

  // Register test Supabase client in TypeDI container
  Container.set('supabase', testSupabase);

  // Clear and seed test database (if needed)
  await clearTestData();
  await seedTestData();
});

afterAll(async () => {
  // Cleanup after all tests
  await clearTestData();
  Container.reset();
});

afterEach(async () => {
  // Cleanup after each test
  // Reset container instances for fresh test state
  Container.reset();
});

async function clearTestData() {
  try {
    // Clear test data from Supabase tables
    const supabase = Container.get('supabase') as any;
    
    // Only clear if we have a real supabase client
    if (supabase && typeof supabase.from === 'function') {
      // Clear tables in dependency order
      const { error: userSessionsError } = await supabase.from('user_sessions').delete().neq('id', '');
      const { error: usersError } = await supabase.from('users').delete().neq('id', '');
      if (userSessionsError) throw userSessionsError;
      if (usersError) throw usersError;
    }
  } catch (error) {
    // In test environment, ignore cleanup errors
    console.warn('Test cleanup warning:', (error as Error).message);
  }
}

async function seedTestData() {
  try {
    // Seed any required test data
    const supabase = Container.get('supabase') as any;
    
    // Only seed if we have a real supabase client
    if (supabase && typeof supabase.from === 'function') {
      // Add any default test data here
      // Example: Create test users, etc.
      const { error: seedError } = await supabase.from('health_check').insert({ status: 'healthy' });
      if (seedError) throw seedError;
    }
  } catch (error) {
    // In test environment, ignore seeding errors
    console.warn('Test seeding warning:', (error as Error).message);
  }
}