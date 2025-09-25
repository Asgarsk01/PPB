// Import required libraries
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Validate that required environment variables are present
if (!supabaseUrl) {
    throw new Error('SUPABASE_URL is required but not found in environment variables');
}

if (!supabaseAnonKey) {
    throw new Error('SUPABASE_ANON_KEY is required but not found in environment variables');
}

// Create and configure the Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        // Configure auth settings if needed
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
    }
});

// Export the client for use throughout the application
module.exports = supabase;
