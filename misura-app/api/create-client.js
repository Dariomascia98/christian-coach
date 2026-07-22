import { createClient } from "@supabase/supabase-js";

// This runs on Vercel's server, never in the browser, so it's the only place
// allowed to use the Supabase service role key (which bypasses row-level
// security). It verifies the caller is really a logged-in trainer before
// creating a new client account on their behalf.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo non consentito." });

  const { name, username, password } = req.body || {};
  if (!name || !username || !password) {
    return res.status(400).json({ error: "Nome, username e password sono obbligatori." });
  }

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

  const { data: callerProfile, error: profileErr } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();
  if (profileErr || callerProfile?.role !== "trainer") {
    return res.status(403).json({ error: "Solo un trainer può creare account cliente." });
  }

  const email = `${username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "")}@misura.local`;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) {
    const msg = createErr.message.includes("already") ? "Username già in uso." : createErr.message;
    return res.status(400).json({ error: msg });
  }

  const { error: insertErr } = await admin.from("profiles").insert({
    id: created.user.id,
    name,
    username: username.trim(),
    role: "client",
    created_by: userData.user.id,
  });
  if (insertErr) {
    await admin.auth.admin.deleteUser(created.user.id); // roll back the orphaned auth user
    const msg = insertErr.message.includes("duplicate") ? "Username già in uso." : insertErr.message;
    return res.status(400).json({ error: msg });
  }

  return res.status(200).json({ ok: true, id: created.user.id });
}
