const { getSupabaseAdmin } = require('./supabase');

let isChecked = false;

async function connectDB() {
  if (isChecked) return;

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('users').select('id').limit(1);

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    isChecked = true;
    console.log('Supabase connected');
  } catch (err) {
    console.error('Supabase connection error:', err.message || err);
    process.exit(1);
  }
}

module.exports = connectDB;
