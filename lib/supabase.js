import { createClient } from '@supabase/supabase-js';

let supabaseClient = null;

export function getSupabase() {
    if (!supabaseClient) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
            console.error('Missing Supabase env vars:', { supabaseUrl: !!supabaseUrl, supabaseAnonKey: !!supabaseAnonKey });
            throw new Error('Supabase environment variables are not configured');
        }

        supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    }
    return supabaseClient;
}

export default getSupabase;