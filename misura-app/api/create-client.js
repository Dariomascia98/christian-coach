import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Manca il token di autorizzazione o formato non valido.' });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Configurazione server incompleta (variabili d\'ambiente mancanti).' });
    }

    const supabasePublic = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabasePublic.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Sessione non valida o utente non autenticato.' });
    }

    const trainerId = user.id;

    // Riceviamo anche la password dal client (body)
    const { name, email, password } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Nome ed email del cliente sono obbligatori.' });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // Usa la password inserita dal trainer, altrimenti generane una di sicurezza
    const clientPassword = password && password.trim() !== '' 
      ? password.trim() 
      : Math.random().toString(36).slice(-8) + 'A1!';

    const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password: clientPassword,
      email_confirm: true,
      user_metadata: { role: 'client', name: name.trim() }
    });

    if (createAuthError) {
      return res.status(400).json({ error: createAuthError.message });
    }

    const newAuthUserId = authData.user.id;

    const { error: dbError } = await supabaseAdmin
      .from('clients')
      .insert({
        trainer_id: trainerId,
        auth_user_id: newAuthUserId,
        name: name.trim(),
        intake: {}
      });

    if (dbError) {
      await supabaseAdmin.auth.admin.deleteUser(newAuthUserId);
      return res.status(400).json({ error: dbError.message });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Cliente creato con successo.',
      clientId: newAuthUserId,
      passwordUsed: clientPassword // Restituisce la password impostata
    });

  } catch (err) {
    console.error('Errore critico in create-client:', err);
    return res.status(500).json({ error: err.message || 'Errore interno del server.' });
  }
}
