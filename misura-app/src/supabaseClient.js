import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error(
    "Mancano VITE_SUPABASE_URL e/o VITE_SUPABASE_ANON_KEY. Controlla le variabili d'ambiente su Vercel (o il file .env in locale)."
  );
}

// Client principale (mantiene loggato il Coach)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});

// Client temporaneo (usato SOLO per registrare i clienti senza sconnettere il Coach)
export const supabaseTemp = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});
