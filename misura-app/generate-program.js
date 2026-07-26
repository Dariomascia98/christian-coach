import { createClient } from "@supabase/supabase-js";

// Generates a draft weekly program with Claude, in the same day/block/exercise
// shape the app already uses. This never writes to the database — it just
// returns a draft for the trainer to review and edit in the program editor
// before saving.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo non consentito." });

  const { goal, daysPerWeek, level, notes } = req.body || {};
  if (!goal || !daysPerWeek) {
    return res.status(400).json({ error: "Obiettivo e giorni a settimana sono obbligatori." });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Non autenticato." });

  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY non configurata su Vercel." });
  }

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
    return res.status(403).json({ error: "Solo un trainer può generare programmi." });
  }

  const prompt = `Sei un personal trainer esperto. Crea un programma di allenamento settimanale in italiano con queste caratteristiche:
- Obiettivo: ${goal}
- Giorni di allenamento a settimana: ${daysPerWeek}
- Livello: ${level || "intermedio"}
${notes ? `- Note/limitazioni: ${notes}` : ""}

Rispondi SOLO con un oggetto JSON valido (nessun testo prima o dopo, nessun blocco markdown), con questa struttura esatta:

{
  "days": [
    {
      "label": "Giorno A – (gruppo muscolare)",
      "weekdays": ["LU","GI"],
      "blocks": [
        {
          "rounds": "3",
          "restBetweenExercises": "",
          "restAfterRound": "90s",
          "exercises": [
            { "name": "Nome esercizio", "reps": "8-10", "note": "" }
          ]
        }
      ]
    }
  ]
}

Regole:
- "weekdays" usa solo questi codici: LU, MA, ME, GI, VE, SA, DO. Distribuiscili in modo sensato in base al numero di giorni richiesto (es. alternando un giorno di riposo).
- Un blocco con 2 esercizi è un superset, con 3+ è un circuito: in quel caso valorizza anche "restBetweenExercises" (es. "20s"). Per un esercizio singolo lascia "restBetweenExercises" come stringa vuota.
- "reps" è una stringa (es. "8-10", "12", "AMRAP").
- "note" è opzionale: breve indicazione tecnica, lascia stringa vuota se non serve.
- NON includere alcun campo "videoUrl": verrà aggiunto in un secondo momento dal trainer.
- Crea esattamente ${daysPerWeek} giorni, ognuno con 4-6 blocchi sensati per l'obiettivo indicato.`;

  try {
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return res.status(502).json({ error: `Errore dal servizio AI: ${errText.slice(0, 300)}` });
    }

    const aiJson = await aiRes.json();
    const textBlock = (aiJson.content || []).find((b) => b.type === "text");
    if (!textBlock) return res.status(502).json({ error: "Risposta AI senza contenuto testuale." });

    const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return res.status(502).json({ error: "La risposta dell'AI non era in formato JSON valido. Riprova." });
    }

    if (!parsed.days || !Array.isArray(parsed.days)) {
      return res.status(502).json({ error: "Formato inatteso nella risposta dell'AI." });
    }

    return res.status(200).json({ ok: true, days: parsed.days });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Errore imprevisto." });
  }
}
