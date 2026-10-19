import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://poeexdmvvqfwviatgedj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DgIQCidoCTGGXvTaMNAwvA_w8X1Ua6i';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkTables() {
  const possibleTables = [
    'user_data',
    'user_profiles',
    'profiles',
    'users',
    'candidates',
    'resumes',
    'applications',
    'submissions',
    'contacts',
    'leads',
    'data',
    'forms',
    'job_applications'
  ];

  for (const t of possibleTables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (!error) {
      console.log(`FOUND TABLE: "${t}"!`, data);
    } else if (error.code !== 'PGRST205') {
      console.log(`TABLE "${t}" exists but returned error:`, error.message, error.code);
    }
  }

  process.exit(0);
}

checkTables();
