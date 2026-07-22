import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo non consentito." });

  const { clientId } = req.body || {};
  if (!clientId) return res.status(400).json({ error: "clientId mancante." });

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Non autenticato." });

  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const authClient = createClient(supabaseUrl, anonKey);
  const { data: userData, error: userErr } = await authClient.auth.getUser(token);
  if (userErr || !userData?.user) return res.status(401).json({ error: "Sessione non valida, rientra e riprova." });

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: clientProfile, error: cErr } = await admin
    .from("profiles")
    .select("created_by")
    .eq("id", clientId)
    .single();
  if (cErr || clientProfile?.created_by !== userData.user.id) {
    return res.status(403).json({ error: "Non autorizzato a eliminare questo cliente." });
  }

  // Deleting the auth user cascades to profiles, programs, progress, loads
  // (all FKs are ON DELETE CASCADE — see supabase/schema.sql).
  const { error: delErr } = await admin.auth.admin.deleteUser(clientId);
  if (delErr) return res.status(400).json({ error: delErr.message });

  return res.status(200).json({ ok: true });
}
