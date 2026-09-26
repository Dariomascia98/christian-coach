import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const { name, username, password } = req.body;

  // Connessione amministrativa lato server
  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // 1. Crea l'utente senza toccare la sessione del Coach sul browser
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: username.trim(),
      password: password,
      email_confirm: true
    });

    if (authError) throw authError;

    // 2. Inserisce il profilo nella tabella profiles
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert([
        {
          id: authData.user.id,
          name: name,
          username: username.trim(),
          role: 'client'
        }
      ]);

    if (profileError) throw profileError;

    return res.status(200).json({ ok: true, user: authData.user });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}
