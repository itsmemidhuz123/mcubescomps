import { createClient } from '@supabase/supabase-js';

let supabaseClient = null;

export function getSupabase() {
    if (!supabaseClient) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
            throw new Error(`Supabase not configured. URL: ${!!supabaseUrl}, Key: ${!!supabaseAnonKey}`);
        }

        supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    }
    return supabaseClient;
}

export default getSupabase;