import { createClient } from '@supabase/supabase-js';

// Sostituisci questi valori con le chiavi reali del tuo progetto Supabase
const SUPABASE_URL = 'https://tuo-id-progetto.supabase.co'; 
const SUPABASE_ANON_KEY = 'tua-chiave-anonima-supabase';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
