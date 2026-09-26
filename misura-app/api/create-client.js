import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const { name, username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Nome, username e password sono obbligatori.' });
  }

  // Recupera le variabili d'ambiente da Vercel
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ 
      error: 'Errore configurazione Vercel: SUPABASE_SERVICE_ROLE_KEY o VITE_SUPABASE_URL mancanti nelle Environment Variables.' 
    });
  }

  // Crea il client amministrativo Supabase
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // 1. Crea l'account Auth per il cliente
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: username.trim(),
      password: password,
      email_confirm: true
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    // 2. Inserisce il profilo nella tabella profiles
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert([
        {
          id: authData.user.id,
          name: name ? name.trim() : username.trim(),
          username: username.trim(),
          role: 'client'
        }
      ]);

    if (profileError) {
      return res.status(400).json({ error: `Errore profilo: ${profileError.message}` });
    }

    return res.status(200).json({ ok: true, user: authData.user });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Errore interno del server' });
  }
}
