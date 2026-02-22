import { createClient } from '@supabase/supabase-js';

let supabaseClient = null;

export function getSupabase() {
    if (supabaseClient) return supabaseClient;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase environment variables are not configured');
    }

    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    return supabaseClient;
}

export const supabase = {
    get client() {
        return getSupabase();
    }
};

export default supabase;