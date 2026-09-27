import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Consenti solo richieste POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    // 1. Estrai e verifica il token di autorizzazione del trainer dall'header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Manca il token di autorizzazione o formato non valido.' });
    }
    const token = authHeader.replace('Bearer ', '');

    // 2. Configura le variabili d'ambiente di Supabase
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Configurazione server incompleta (variabili d\'ambiente mancanti).' });
    }

    // 3. Verifica l'identità del trainer tramite il client pubblico e il token ricevuto
    const supabasePublic = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabasePublic.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Sessione non valida o utente non autenticato.' });
    }

    const trainerId = user.id;

    // 4. Estrai i dati inviati dal corpo della richiesta (body)
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Nome ed email del cliente sono obbligatori.' });
    }

    // 5. Inizializza il client Supabase con i privilegi amministrativi (Service Role Key)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // 6. Crea l'utente nel sistema di autenticazione Supabase Auth con una password temporanea
    const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
    const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password: tempPassword,
      email_confirm: true,
      user_metadata: { role: 'client', name: name.trim() }
    });

    if (createAuthError) {
      return res.status(400).json({ error: createAuthError.message });
    }

    const newAuthUserId = authData.user.id;

    // 7. Inserisci il record corrispondente nella tabella "clients" collegandolo al trainer
    const { error: dbError } = await supabaseAdmin
      .from('clients')
      .insert({
        trainer_id: trainerId,
        auth_user_id: newAuthUserId,
        name: name.trim(),
        intake: {}
      });

    if (dbError) {
      // Se fallisce l'inserimento nel DB, rimuoviamo l'utente auth per pulizia
      await supabaseAdmin.auth.admin.deleteUser(newAuthUserId);
      return res.status(400).json({ error: dbError.message });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Cliente creato con successo.',
      clientId: newAuthUserId 
    });

  } catch (err) {
    console.error('Errore critico in create-client:', err);
    return res.status(500).json({ error: err.message || 'Errore interno del server.' });
  }
}
