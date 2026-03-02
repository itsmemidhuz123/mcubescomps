import { createClient } from '@supabase/supabase-js';

let supabaseClient = null;
let supabaseAdmin = null;

export function getSupabase() {
    if (!supabaseClient) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
            throw new Error(`Supabase not configured`);
        }

        supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    }
    return supabaseClient;
}

export function getSupabaseAdmin() {
    if (!supabaseAdmin) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            console.log('Service role key not available');
            return getSupabase();
        }

        supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false }
        });
    }
    return supabaseAdmin;
}

export default getSupabase;