import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import {
  Save, Edit2, Check, Printer, Copy, Plus, Trash2,
  Dumbbell, PlayCircle, Camera, X, ImageOff, TrendingUp, LogOut, UserPlus
} from 'lucide-react';

/* ============================================================
   NOTE IMPORTANTE SULLO SCHEMA DATABASE
   ============================================================
   - tabella "clients": id (uuid), trainer_id (uuid, FK auth.users),
     auth_user_id (uuid, FK auth.users, nullable finché il cliente
     non si registra), name (text), email (text), intake (jsonb)
   - tabella "programs": id, client_id (FK clients), days (jsonb)
   - tabella "progress_entries": id, client_id, date, weight, waist,
     chest, hips, notes, photo (url o base64)
   - Il ruolo "trainer" è determinato dal campo
     user_metadata.role === "trainer" impostato via SQL su
     auth.users.raw_user_meta_data. Chi non ha questo metadata
     viene cercato nella tabella "clients" tramite auth_user_id o email;
     se non trovato, è in stato "pending".
   ============================================================ */

// --- Utility e Costanti Globali ---
const uid = () => Math.random().toString(36).substring(2, 9);
const fmtDate = (dateStr) => {
  if (!dateStr) return "";
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
};

const C = {
  panel: "#1e1e24",
  panelHi: "#2a2a32",
  border: "#3f3f46",
  text: "#f4f4f5",
  textDim: "#a1a1aa",
  accent: "#6366f1",
  accentSoft: "rgba(99, 102, 241, 0.15)",
  positive: "#10b981",
  danger: "#ef4444"
};

const fontDisplay = { fontFamily: "sans-serif", fontWeight: 700 };
const fontBody = { fontFamily: "sans-serif" };
const fontMono = { fontFamily: "monospace" };

const primaryBtn = {
  background: C.accent, color: "#fff", border: "none", borderRadius: 8,
  padding: "8px 14px", ...fontBody, fontSize: 13, fontWeight: 600, cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 6
};

const secondaryBtn = {
  background: C.panelHi, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8,
  padding: "8px 14px", ...fontBody, fontSize: 13, fontWeight: 600, cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 6
};

const iconBtn = {
  background: "transparent", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center"
};

const inputStyle = {
  display: "block", width: "100%", marginTop: 6, padding: "10px 12px",
  background: C.panelHi, border: `1px solid ${C.border}`, borderRadius: 8,
  color: C.text, ...fontBody, fontSize: 14, outline: "none", boxSizing: "border-box"
};

const WEEKDAYS = [
  { code: "1", label: "LUN" }, { code: "2", label: "MAR" }, { code: "3", label: "MER" },
  { code: "4", label: "GIO" }, { code: "5", label: "VEN" }, { code: "6", label: "SAB" }, { code: "7", label: "DOM" }
];

const ACTIVITY_LEVELS = [
  { value: "sedentario", label: "Sedentario", mult: 1.2 },
  { value: "leggero", label: "Leggero (1-3 giorni/sett.)", mult: 1.375 },
  { value: "moderato", label: "Moderato (3-5 giorni/sett.)", mult: 1.55 },
  { value: "intenso", label: "Intenso (6-7 giorni/sett.)", mult: 1.725 },
  { value: "molto_intenso", label: "Molto intenso (atleta/lavoro fisico)", mult: 1.9 },
];

function Field({ label, type = "text", value, onChange }) {
  return (
    <div>
      <label style={{ ...fontMono, fontSize: 11, color: C.textDim, letterSpacing: "0.1em" }}>{(label || "").toUpperCase()}</label>
      <input
        type={type}
        value={value || ""}
        onChange={(e) => onChange && onChange(e.target.value)}
        style={inputStyle}
      />
    </div>
  );
}

function calcBmrTdee({ sex, birthDate, heightCm, startingWeight, activityLevel } = {}) {
  if (!birthDate || !heightCm || !startingWeight) return null;
  const age = Math.floor((new Date() - new Date(birthDate)) / 31557600000);
  const h = parseFloat(heightCm), w = parseFloat(startingWeight);
  if (!age || !h || !w || isNaN(age) || isNaN(h) || isNaN(w)) return null;
  const bmr = sex === "F" ? 10 * w + 6.25 * h - 5 * age - 161 : 10 * w + 6.25 * h - 5 * age + 5;
  const level = ACTIVITY_LEVELS.find((l) => l.value === activityLevel) || ACTIVITY_LEVELS[1];
  return { bmr: Math.round(bmr), tdee: Math.round(bmr * level.mult), age };
}

async function fetchProgram(clientId) {
  if (!clientId) return null;
  try {
    const { data, error } = await supabase
      .from('programs')
      .select('*')
      .eq('client_id', clientId)
      .single();
    if (error) {
      console.error("Errore nel recupero del programma:", error);
      return null;
    }
    return data;
  } catch (err) {
    console.error("Eccezione in fetchProgram:", err);
    return null;
  }
}

// ---------- Helper di aggiornamento immutabile per il programma ----------
function updateDays(days, dayIdx, updater) {
  return days.map((day, i) => (i === dayIdx ? updater(day) : day));
}
function updateBlockInDay(day, blockIdx, updater) {
  return { ...day, blocks: (day.blocks || []).map((block, i) => (i === blockIdx ? updater(block) : block)) };
}
function updateExerciseInBlock(block, exIdx, updater) {
  return { ...block, exercises: (block.exercises || []).map((ex, i) => (i === exIdx ? updater(ex) : ex)) };
}

// ============================================================
// SCHERMATA DI LOGIN / REGISTRAZIONE
// ============================================================
function AuthScreen({ onLoggedIn }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    if (!email || !password) {
      setErrorMsg("Inserisci email e password.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onLoggedIn(data.session);
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          onLoggedIn(data.session);
        } else {
          setErrorMsg("Controlla la tua email per confermare la registrazione.");
        }
      }
    } catch (err) {
      console.error("Errore di autenticazione:", err);
      setErrorMsg(err.message || "Errore durante l'autenticazione.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f12", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <form onSubmit={handleSubmit} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 28, width: "100%", maxWidth: 380 }}>
        <h1 style={{ ...fontDisplay, fontSize: 24, color: C.text, margin: "0 0 4px" }}>CHRIS COACH</h1>
        <p style={{ ...fontBody, fontSize: 13, color: C.textDim, margin: "0 0 20px" }}>
          {mode === "login" ? "Accedi al tuo account" : "Crea un nuovo account"}
        </p>

        <div style={{ marginBottom: 12 }}>
          <Field label="Email" type="email" value={email} onChange={setEmail} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <Field label="Password" type="password" value={password} onChange={setPassword} />
        </div>

        {errorMsg && (
          <p style={{ ...fontBody, fontSize: 13, color: C.danger, marginBottom: 12 }}>{errorMsg}</p>
        )}

        <button type="submit" disabled={loading} style={{ ...primaryBtn, width: "100%", justifyContent: "center", opacity: loading ? 0.7 : 1 }}>
          {loading ? "Attendere..." : mode === "login" ? "Accedi" : "Registrati"}
        </button>

        <button
          type="button"
          onClick={() => { setMode(mode === "login" ? "signup" : "login"); setErrorMsg(""); }}
          style={{ ...secondaryBtn, width: "100%", justifyContent: "center", marginTop: 10, background: "transparent", border: "none" }}
        >
          {mode === "login" ? "Non hai un account? Registrati" : "Hai già un account? Accedi"}
        </button>
      </form>
    </div>
  );
}

// ============================================================
// DASHBOARD TRAINER: elenco clienti + creazione nuovo cliente
// ============================================================
function TrainerDashboard({ session, onLogout }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientPassword, setNewClientPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const loadClients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('trainer_id', session.user.id)
      .order('name', { ascending: true });
    if (error) {
      console.error("Errore nel recupero dei clienti:", error);
    } else {
      setClients(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { loadClients(); }, [session]);

  const handleCreateClient = async (e) => {
    e.preventDefault();
    setCreateError("");
    if (!newClientName || !newClientEmail) {
      setCreateError("Nome ed email sono obbligatori.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/create-client', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ name: newClientName, email: newClientEmail, password: newClientPassword })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Errore nella creazione del cliente.");
      alert(`Cliente creato con successo!\nPassword: ${result.passwordUsed || 'Generata automaticamente'}`);
      setNewClientName("");
      setNewClientEmail("");
      setNewClientPassword("");
      setShowNewClient(false);
      await loadClients();
    } catch (err) {
      console.error("Errore creazione cliente:", err);
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const selectedClient = clients.find((c) => c.id === selectedClientId) || null;

  if (selectedClient) {
    return (
      <ClientWorkspace
        client={selectedClient}
        isTrainer={true}
        siblingClients={clients}
        onBack={() => setSelectedClientId(null)}
        onClientUpdated={loadClients}
      />
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f12", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, maxWidth: 900, margin: "0 auto 24px" }}>
        <h1 style={{ ...fontDisplay, fontSize: 26, color: C.text, margin: 0 }}>I TUOI CLIENTI</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowNewClient(!showNewClient)} style={primaryBtn}>
            <UserPlus size={16} /> Nuovo Cliente
          </button>
          <button onClick={onLogout} style={secondaryBtn}>
            <LogOut size={15} /> Esci
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {showNewClient && (
          <form onSubmit={handleCreateClient} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <h3 style={{ ...fontDisplay, fontSize: 18, color: C.text, margin: "0 0 14px" }}>Aggiungi Nuovo Cliente</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <Field label="Nome completo" value={newClientName} onChange={setNewClientName} />
              <Field label="Email cliente" type="email" value={newClientEmail} onChange={setNewClientEmail} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <Field label="Password temporanea (opzionale)" type="text" value={newClientPassword} onChange={setNewClientPassword} />
              <span style={{ fontSize: 11, color: C.textDim, marginTop: 4, display: "block" }}>Se la lasci vuota, verrà generata automaticamente dal server.</span>
            </div>
            {createError && <p style={{ ...fontBody, fontSize: 13, color: C.danger, marginBottom: 12 }}>{createError}</p>}
            <button type="submit" disabled={creating} style={{ ...primaryBtn, opacity: creating ? 0.7 : 1 }}>
              {creating ? "Creazione..." : "Crea Cliente"}
            </button>
          </form>
        )}

        {loading ? (
          <p style={{ ...fontBody, color: C.textDim, textAlign: "center" }}>Caricamento clienti...</p>
        ) : clients.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: C.textDim, background: C.panel, borderRadius: 12, border: `1px solid ${C.border}` }}>
            <p style={{ ...fontBody, margin: 0 }}>Nessun cliente ancora. Aggiungine uno per iniziare.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            {clients.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedClientId(c.id)}
                style={{
                  ...secondaryBtn, justifyContent: "flex-start", padding: 16, textAlign: "left",
                  flexDirection: "column", alignItems: "flex-start", gap: 4
                }}
              >
                <span style={{ ...fontDisplay, fontSize: 16, color: C.text }}>{c.name}</span>
                <span style={{ ...fontMono, fontSize: 11, color: C.textDim }}>
                  {c.intake?.goal || "Obiettivo non impostato"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// WORKSPACE CLIENTE: anamnesi + programma + progressi
// ============================================================
function ClientWorkspace({ client, isTrainer, siblingClients = [], onBack, onClientUpdated, onLogout }) {
  const [tab, setTab] = useState("intake");
  const [program, setProgram] = useState(null);
  const [progressEntries, setProgressEntries] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoadingData(true);
      const [p, { data: entries, error: entriesError }] = await Promise.all([
        fetchProgram(client.id),
        supabase.from('progress_entries').select('*').eq('client_id', client.id).order('date', { ascending: true })
      ]);
      if (entriesError) console.error("Errore nel recupero dei progressi:", entriesError);
      if (active) {
        setProgram(p || { days: [] });
        setProgressEntries(entries || []);
        setLoadingData(false);
      }
    }
    load();
    return () => { active = false; };
  }, [client.id]);

  const handleSaveIntake = async (form) => {
    const { error } = await supabase.from('clients').update({ intake: form }).eq('id', client.id);
    if (error) {
      console.error("Errore nel salvataggio dell'anamnesi:", error);
      return;
    }
    if (onClientUpdated) onClientUpdated();
  };

  const handleSaveProgram = async (newProgram) => {
    setProgram(newProgram);
    const { error } = await supabase
      .from('programs')
      .upsert({ client_id: client.id, days: newProgram.days }, { onConflict: 'client_id' });
    if (error) console.error("Errore nel salvataggio del programma:", error);
  };

  const handleAddProgressEntry = async (entry) => {
    const { error } = await supabase.from('progress_entries').insert({ ...entry, client_id: client.id });
    if (error) {
      console.error("Errore nel salvataggio della misurazione:", error);
      return;
    }
    setProgressEntries((prev) => [...prev, entry]);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f12", padding: 24 }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          {isTrainer ? (
            <button onClick={onBack} style={secondaryBtn}>← Torna ai clienti</button>
          ) : (
            <button onClick={onLogout} style={secondaryBtn}>
              <LogOut size={15} /> Esci
            </button>
          )}
          <div className="no-print" style={{ display: "flex", gap: 8 }}>
            {["intake", "program", "progress"].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  ...secondaryBtn,
                  borderColor: tab === t ? C.accent : C.border,
                  color: tab === t ? C.accent : C.text
                }}
              >
                {t === "intake" ? "Anamnesi" : t === "program" ? "Programma" : "Progressi"}
              </button>
            ))}
          </div>
        </div>

        {loadingData ? (
          <p style={{ ...fontBody, color: C.textDim, textAlign: "center" }}>Caricamento...</p>
        ) : (
          <>
            {tab === "intake" && (
              <IntakeSection intake={client.intake} isTrainer={isTrainer} onSave={handleSaveIntake} />
            )}
            {tab === "program" && (
              <ProgramSection
                program={program}
                isTrainer={isTrainer}
                clientId={client.id}
                clientName={client.name}
                siblingClients={siblingClients}
                onSave={handleSaveProgram}
              />
            )}
            {tab === "progress" && (
              <ProgressSection entries={progressEntries} onAdd={handleAddProgressEntry} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------- Intake section ----------
export function IntakeSection({ intake = {}, isTrainer, onSave }) {
  const safeIntake = intake || {};
  const [editing, setEditing] = useState(isTrainer && !safeIntake.goal);
  const [form, setForm] = useState({
    birthDate: safeIntake.birthDate || "",
    sex: safeIntake.sex || "M",
    heightCm: safeIntake.heightCm || "",
    startingWeight: safeIntake.startingWeight || "",
    activityLevel: safeIntake.activityLevel || "moderato",
    goal: safeIntake.goal || "",
    injuries: safeIntake.injuries || "",
    notes: safeIntake.notes || "",
  });

  useEffect(() => {
    const si = intake || {};
    setForm({
      birthDate: si.birthDate || "",
      sex: si.sex || "M",
      heightCm: si.heightCm || "",
      startingWeight: si.startingWeight || "",
      activityLevel: si.activityLevel || "moderato",
      goal: si.goal || "",
      injuries: si.injuries || "",
      notes: si.notes || "",
    });
  }, [intake]);

  const handleSave = () => {
    if (onSave) onSave(form);
    setEditing(false);
  };

  const calc = calcBmrTdee(form);

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ ...fontDisplay, fontSize: 22, color: C.text, margin: 0 }}>SCHEDA ANAMNESI</h3>
        {isTrainer && (
          <button onClick={() => { if (editing) handleSave(); else setEditing(true); }} style={secondaryBtn}>
            {editing ? <><Save size={14} /> Salva</> : <><Edit2 size={14} /> Modifica</>}
          </button>
        )}
      </div>

      {editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Data di nascita" type="date" value={form.birthDate} onChange={(v) => setForm({ ...form, birthDate: v })} />
            <div>
              <label style={{ ...fontMono, fontSize: 11, color: C.textDim, letterSpacing: "0.1em" }}>SESSO</label>
              <select value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })} style={inputStyle}>
                <option value="M">Uomo (M)</option>
                <option value="F">Donna (F)</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Altezza (cm)" type="number" value={form.heightCm} onChange={(v) => setForm({ ...form, heightCm: v })} />
            <Field label="Peso Iniziale (kg)" type="number" value={form.startingWeight} onChange={(v) => setForm({ ...form, startingWeight: v })} />
          </div>

          <div>
            <label style={{ ...fontMono, fontSize: 11, color: C.textDim, letterSpacing: "0.1em" }}>LIVELLO DI ATTIVITÀ</label>
            <select value={form.activityLevel} onChange={(e) => setForm({ ...form, activityLevel: e.target.value })} style={inputStyle}>
              {ACTIVITY_LEVELS.map((a) => (<option key={a.value} value={a.value}>{a.label}</option>))}
            </select>
          </div>

          <Field label="Obiettivo principale" value={form.goal} onChange={(v) => setForm({ ...form, goal: v })} />
          <Field label="Infortuni / Limitazioni fisiche" value={form.injuries} onChange={(v) => setForm({ ...form, injuries: v })} />
          <Field label="Note aggiuntive" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />

          <button onClick={handleSave} style={{ ...primaryBtn, marginTop: 10 }}>
            <Save size={16} /> Salva Anamnesi
          </button>
        </div>
      ) : (
        <div>
          {calc && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, background: C.panelHi, padding: 14, borderRadius: 10, marginBottom: 18 }}>
              <div>
                <p style={{ ...fontMono, fontSize: 10, color: C.textDim, margin: 0 }}>ETÀ</p>
                <p style={{ ...fontDisplay, fontSize: 20, color: C.text, margin: "2px 0 0" }}>{calc.age} anni</p>
              </div>
              <div>
                <p style={{ ...fontMono, fontSize: 10, color: C.textDim, margin: 0 }}>BMR STIMATO</p>
                <p style={{ ...fontDisplay, fontSize: 20, color: C.accent, margin: "2px 0 0" }}>{calc.bmr} kcal</p>
              </div>
              <div>
                <p style={{ ...fontMono, fontSize: 10, color: C.textDim, margin: 0 }}>TDEE STIMATO</p>
                <p style={{ ...fontDisplay, fontSize: 20, color: C.positive, margin: "2px 0 0" }}>{calc.tdee} kcal</p>
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <p style={{ ...fontMono, fontSize: 11, color: C.textDim, margin: 0 }}>ALTEZZA / PESO</p>
              <p style={{ ...fontBody, fontSize: 14, color: C.text, margin: "4px 0 0" }}>
                {form.heightCm ? `${form.heightCm} cm` : "—"} / {form.startingWeight ? `${form.startingWeight} kg` : "—"}
              </p>
            </div>
            <div>
              <p style={{ ...fontMono, fontSize: 11, color: C.textDim, margin: 0 }}>ATTIVITÀ</p>
              <p style={{ ...fontBody, fontSize: 14, color: C.text, margin: "4px 0 0" }}>
                {ACTIVITY_LEVELS.find((a) => a.value === form.activityLevel)?.label || form.activityLevel || "—"}
              </p>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <p style={{ ...fontMono, fontSize: 11, color: C.textDim, margin: 0 }}>OBIETTIVO</p>
            <p style={{ ...fontBody, fontSize: 14, color: C.text, margin: "4px 0 0" }}>{form.goal || "Non specificato"}</p>
          </div>

          <div style={{ marginBottom: 12 }}>
            <p style={{ ...fontMono, fontSize: 11, color: C.textDim, margin: 0 }}>INFORTUNI / LIMITAZIONI</p>
            <p style={{ ...fontBody, fontSize: 14, color: C.text, margin: "4px 0 0" }}>{form.injuries || "Nessuno segnalato"}</p>
          </div>

          <div>
            <p style={{ ...fontMono, fontSize: 11, color: C.textDim, margin: 0 }}>NOTE</p>
            <p style={{ ...fontBody, fontSize: 14, color: C.text, margin: "4px 0 0" }}>{form.notes || "—"}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Program Section (Foglio continuo con parametri per singolo esercizio) ----------
export function ProgramSection({ program, isTrainer, clientId, clientName, siblingClients = [], onSave }) {
  const safeProgram = program || {};
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [activeVideoUrl, setActiveVideoUrl] = useState(null);
  const [activeLoadExercise, setActiveLoadExercise] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const days = safeProgram.days || [];
  const currentDay = days[activeDayIdx] || null;

  const handleUpdateProgram = (newDays) => {
    if (onSave) onSave({ ...safeProgram, days: newDays });
  };

  const patchDay = (dayIdx, updater) => handleUpdateProgram(updateDays(days, dayIdx, updater));
  const patchBlock = (dayIdx, blockIdx, updater) => patchDay(dayIdx, (day) => updateBlockInDay(day, blockIdx, updater));
  const patchExercise = (dayIdx, blockIdx, exIdx, updater) => patchBlock(dayIdx, blockIdx, (block) => updateExerciseInBlock(block, exIdx, updater));

  const addDay = () => {
    const newDay = { id: uid(), label: `GIORNO ${days.length + 1}`, weekdays: [], blocks: [] };
    const updated = [...days, newDay];
    handleUpdateProgram(updated);
    setActiveDayIdx(updated.length - 1);
  };

  const deleteDay = (idx) => {
    if (!window.confirm("Sei sicuro di voler eliminare questa giornata di allenamento?")) return;
    const updated = days.filter((_, i) => i !== idx);
    handleUpdateProgram(updated);
    if (activeDayIdx >= updated.length) setActiveDayIdx(Math.max(0, updated.length - 1));
  };

  const addBlock = (dayIdx) => {
    const newBlock = { 
      id: uid(), 
      exercises: [{ id: uid(), name: "", sets: "3", reps: "10-12", rest: "90''", note: "", videoUrl: "" }] 
    };
    patchDay(dayIdx, (day) => ({ ...day, blocks: [...(day.blocks || []), newBlock] }));
  };

  const deleteBlock = (dayIdx, blockIdx) => {
    patchDay(dayIdx, (day) => ({ ...day, blocks: day.blocks.filter((_, i) => i !== blockIdx) }));
  };

  const addExercise = (dayIdx, blockIdx) => {
    const newEx = { id: uid(), name: "", sets: "3", reps: "10", rest: "90''", note: "", videoUrl: "" };
    patchBlock(dayIdx, blockIdx, (block) => ({ ...block, exercises: [...block.exercises, newEx] }));
  };

  const deleteExercise = (dayIdx, blockIdx, exIdx) => {
    patchBlock(dayIdx, blockIdx, (block) => ({ ...block, exercises: block.exercises.filter((_, i) => i !== exIdx) }));
  };

  const copyFromClient = async (sourceClientId) => {
    if (!sourceClientId) return;
    const p = await fetchProgram(sourceClientId);
    if (p && p.days) {
      if (window.confirm("Sostituire il programma corrente con quello selezionato?")) {
        handleUpdateProgram(p.days);
      }
    }
  };

  return (
    <div>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <h3 style={{ ...fontDisplay, fontSize: 22, color: C.text, margin: 0 }}>
          {isTrainer ? `PROGRAMMA DI ${(clientName || "").toUpperCase()}` : "IL TUO PROGRAMMA"}
        </h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => window.print()} style={secondaryBtn} title="Stampa scheda">
            <Printer size={15} /> Stampa
          </button>
          {isTrainer && (
            <button onClick={() => setIsEditing(!isEditing)} style={{ ...secondaryBtn, borderColor: isEditing ? C.accent : C.border, color: isEditing ? C.accent : C.text }}>
              {isEditing ? <Check size={15} /> : <Edit2 size={15} />} {isEditing ? "Fine Modifica" : "Modifica"}
            </button>
          )}
        </div>
      </div>

      {isTrainer && isEditing && (siblingClients || []).length > 0 && (
        <div className="no-print" style={{ background: C.panelHi, padding: 12, borderRadius: 8, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <Copy size={16} color={C.accent} />
          <span style={{ ...fontBody, fontSize: 13, color: C.textDim }}>Copia programma da:</span>
          <select onChange={(e) => copyFromClient(e.target.value)} defaultValue="" style={{ background: C.panel, color: C.text, border: `1px solid ${C.border}`, padding: "6px 10px", borderRadius: 6, fontSize: 13 }}>
            <option value="" disabled>Seleziona cliente...</option>
            {siblingClients.filter((c) => c.id !== clientId).map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        </div>
      )}

      {days.length > 0 && (
        <div className="no-print" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 16 }}>
          {days.map((day, idx) => (
            <button
              key={day.id || idx}
              onClick={() => setActiveDayIdx(idx)}
              style={{
                padding: "8px 14px", borderRadius: 8,
                background: activeDayIdx === idx ? C.panelHi : C.panel,
                border: `1px solid ${activeDayIdx === idx ? C.accent : C.border}`,
                color: activeDayIdx === idx ? C.text : C.textDim,
                ...fontBody, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap"
              }}
            >
              {day.label || `Giorno ${idx + 1}`}
            </button>
          ))}
          {isTrainer && isEditing && (
            <button onClick={addDay} style={{ ...secondaryBtn, padding: "8px 12px" }}>
              <Plus size={15} /> Giorno
            </button>
          )}
        </div>
      )}

      {days.length === 0 ? (
        <div style={{ padding: 20, textAlign: "center", color: C.textDim, background: C.panel, borderRadius: 12, border: `1px solid ${C.border}` }}>
          <Dumbbell size={28} color={C.textDim} style={{ marginBottom: 8 }} />
          <p style={{ ...fontBody, margin: 0 }}>
            {isTrainer ? "Nessun giorno di allenamento ancora creato." : "Nessun programma ancora assegnato dal tuo trainer."}
          </p>
          {isTrainer && (
            <button 
              onClick={() => {
                if (!isEditing) setIsEditing(true);
                addDay();
              }} 
              style={{ ...primaryBtn, marginTop: 12 }}
            >
              <Plus size={16} /> Aggiungi Primo Giorno
            </button>
          )}
        </div>
      ) : currentDay ? (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, borderBottom: `2px solid ${C.accent}`, paddingBottom: 8 }}>
            {isEditing ? (
              <input
                value={currentDay.label || ""}
                onChange={(e) => patchDay(activeDayIdx, (day) => ({ ...day, label: e.target.value }))}
                style={{ background: C.panelHi, border: `1px solid ${C.border}`, color: C.text, padding: "4px 8px", borderRadius: 4, ...fontDisplay, fontSize: 18 }}
              />
            ) : (
              <h2 style={{ ...fontDisplay, fontSize: 20, color: C.accent, margin: 0 }}>{currentDay.label}</h2>
            )}
            {isEditing && (
              <button onClick={() => deleteDay(activeDayIdx)} style={iconBtn} title="Elimina Giorno">
                <Trash2 size={16} color={C.accent} />
              </button>
            )}
          </div>

          {isEditing && (
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {WEEKDAYS.map((w) => {
                const active = (currentDay.weekdays || []).includes(w.code);
                return (
                  <button
                    key={w.code}
                    onClick={() => patchDay(activeDayIdx, (day) => {
                      const curWd = day.weekdays || [];
                      return { ...day, weekdays: active ? curWd.filter((c) => c !== w.code) : [...curWd, w.code] };
                    })}
                    style={{
                      padding: "4px 8px", borderRadius: 6, fontSize: 11, ...fontMono, cursor: "pointer",
                      border: `1px solid ${active ? C.accent : C.border}`,
                      background: active ? C.accentSoft : C.panelHi,
                      color: active ? C.accent : C.textDim
                    }}
                  >
                    {w.label}
                  </button>
                );
              })}
            </div>
          )}

          {(currentDay.blocks || []).map((block, bIdx) => (
            <div key={block.id || bIdx} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.panelHi, padding: "6px 10px", borderRadius: 6, marginBottom: 6 }}>
                <span style={{ ...fontMono, fontSize: 11, color: C.textDim, fontWeight: 700 }}>BLOCCO #{bIdx + 1}</span>
                {isEditing && (
                  <button onClick={() => deleteBlock(activeDayIdx, bIdx)} style={iconBtn} title="Elimina blocco">
                    <Trash2 size={14} color={C.danger} />
                  </button>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 4 }}>
                {(block.exercises || []).map((ex, exIdx) => (
                  <div key={ex.id || exIdx} style={{ padding: "6px 8px", borderBottom: `1px dashed ${C.border}` }}>
                    {isEditing ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", gap: 6, width: "100%", alignItems: "center", flexWrap: "wrap" }}>
                          <input placeholder="Nome Esercizio" value={ex.name || ""} onChange={(e) => patchExercise(activeDayIdx, bIdx, exIdx, (item) => ({ ...item, name: e.target.value }))} style={{ flex: 2, background: C.panelHi, color: C.text, border: `1px solid ${C.border}`, borderRadius: 4, padding: "4px 6px", fontSize: 12 }} />
                          
                          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                            <span style={{ fontSize: 10, color: C.textDim, ...fontMono }}>SERIE:</span>
                            <input placeholder="3" value={ex.sets || ""} onChange={(e) => patchExercise(activeDayIdx, bIdx, exIdx, (item) => ({ ...item, sets: e.target.value }))} style={{ width: 40, background: C.panelHi, color: C.text, border: `1px solid ${C.border}`, borderRadius: 4, padding: "4px 4px", fontSize: 12, textAlign: "center" }} />
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                            <span style={{ fontSize: 10, color: C.textDim, ...fontMono }}>RIP:</span>
                            <input placeholder="10-12" value={ex.reps || ""} onChange={(e) => patchExercise(activeDayIdx, bIdx, exIdx, (item) => ({ ...item, reps: e.target.value }))} style={{ width: 55, background: C.panelHi, color: C.text, border: `1px solid ${C.border}`, borderRadius: 4, padding: "4px 4px", fontSize: 12, textAlign: "center" }} />
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                            <span style={{ fontSize: 10, color: C.textDim, ...fontMono }}>REC:</span>
                            <input placeholder="90''" value={ex.rest || ""} onChange={(e) => patchExercise(activeDayIdx, bIdx, exIdx, (item) => ({ ...item, rest: e.target.value }))} style={{ width: 50, background: C.panelHi, color: C.text, border: `1px solid ${C.border}`, borderRadius: 4, padding: "4px 4px", fontSize: 12, textAlign: "center" }} />
                          </div>

                          <button onClick={() => deleteExercise(activeDayIdx, bIdx, exIdx)} style={iconBtn}><Trash2 size={14} color={C.danger} /></button>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <input placeholder="Link Video YouTube (opzionale)" value={ex.videoUrl || ""} onChange={(e) => patchExercise(activeDayIdx, bIdx, exIdx, (item) => ({ ...item, videoUrl: e.target.value }))} style={{ flex: 1, background: C.panelHi, color: C.text, border: `1px solid ${C.border}`, borderRadius: 4, padding: "4px 6px", fontSize: 11 }} />
                          <input placeholder="Note / Istruzioni" value={ex.note || ""} onChange={(e) => patchExercise(activeDayIdx, bIdx, exIdx, (item) => ({ ...item, note: e.target.value }))} style={{ flex: 1, background: C.panelHi, color: C.text, border: `1px solid ${C.border}`, borderRadius: 4, padding: "4px 6px", fontSize: 11 }} />
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                          <span style={{ ...fontBody, fontWeight: 600, color: C.text, fontSize: 13 }}>{ex.name || "Esercizio"}</span>
                          {ex.videoUrl && (
                            <button onClick={() => setActiveVideoUrl(ex.videoUrl)} style={iconBtn} title="Guarda video">
                              <PlayCircle size={15} color={C.accent} />
                            </button>
                          )}
                          {ex.note && <span style={{ ...fontBody, fontSize: 11, color: C.textDim }}>({ex.note})</span>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 14, ...fontMono, fontSize: 12 }}>
                          <span style={{ color: C.textDim }}>Serie: <strong style={{ color: C.text }}>{ex.sets || "3"}</strong></span>
                          <span style={{ color: C.positive, fontWeight: 600 }}>{ex.reps || "10"} rip</span>
                          <span style={{ color: C.textDim }}>Rec: <strong style={{ color: C.text }}>{ex.rest || "90''"}</strong></span>
                          <button onClick={() => setActiveLoadExercise(ex.name)} style={{ ...secondaryBtn, padding: "4px 8px", fontSize: 11 }}>
                            <Dumbbell size={12} /> Carichi
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {isEditing && (
                  <button onClick={() => addExercise(activeDayIdx, bIdx)} style={{ ...secondaryBtn, justifyContent: "center", fontSize: 11, padding: "4px", marginTop: 4, borderStyle: "dashed" }}>
                    <Plus size={12} /> Aggiungi Esercizio
                  </button>
                )}
              </div>
            </div>
          ))}

          {isEditing && (
            <button onClick={() => addBlock(activeDayIdx)} style={{ ...primaryBtn, marginTop: 8, fontSize: 12, padding: "6px 10px" }}>
              <Plus size={14} /> Aggiungi Blocco
            </button>
          )}
        </div>
      ) : null}

      {activeVideoUrl && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, width: "100%", maxWidth: 600, padding: 16, position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ ...fontDisplay, color: C.text }}>Video Dimostrativo</span>
              <button onClick={() => setActiveVideoUrl(null)} style={iconBtn}><X size={20} color={C.text} /></button>
            </div>
            <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
              <iframe
                src={activeVideoUrl.replace("watch?v=", "embed/")}
                title="Video demo"
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none", borderRadius: 8 }}
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}

      {activeLoadExercise && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, width: "100%", maxWidth: 420, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ ...fontDisplay, color: C.text }}>Carichi — {activeLoadExercise}</span>
              <button onClick={() => setActiveLoadExercise(null)} style={iconBtn}><X size={20} color={C.text} /></button>
            </div>
            <p style={{ ...fontBody, fontSize: 13, color: C.textDim }}>
              Funzione in arrivo: qui potrai registrare i carichi (kg/ripetizioni) per questo esercizio nel tempo.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Progress Section ----------
export function ProgressSection({ entries = [], onAdd }) {
  const safeEntries = entries || [];
  const [showAdd, setShowAdd] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [weight, setWeight] = useState("");
  const [waist, setWaist] = useState("");
  const [chest, setChest] = useState("");
  const [hips, setHips] = useState("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState(null);
  const [photoProcessing, setPhotoProcessing] = useState(false);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoProcessing(true);
    try {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        setPhoto(uploadEvent.target.result);
        setPhotoProcessing(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setPhotoProcessing(false);
    }
  };

  const submitEntry = () => {
    const parsedWeight = parseFloat(weight);
    if (!weight || isNaN(parsedWeight)) return;
    const newEntry = {
      id: uid(), date, weight: parsedWeight,
      waist: waist ? parseFloat(waist) : null,
      chest: chest ? parseFloat(chest) : null,
      hips: hips ? parseFloat(hips) : null,
      notes, photo
    };
    if (onAdd) onAdd(newEntry);
    setShowAdd(false);
    setWeight(""); setWaist(""); setChest(""); setHips(""); setNotes(""); setPhoto(null);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ ...fontDisplay, fontSize: 22, color: C.text, margin: 0 }}>TRACCIAMENTO PROGRESSI</h3>
        <button onClick={() => setShowAdd(!showAdd)} style={primaryBtn}>
          <Plus size={16} /> Nuova Misurazione
        </button>
      </div>

      {showAdd && (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
          <h4 style={{ ...fontDisplay, fontSize: 18, color: C.accent, margin: "0 0 12px" }}>Aggiungi Aggiornamento</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Data" type="date" value={date} onChange={setDate} />
            <Field label="Peso (kg)*" type="number" value={weight} onChange={setWeight} />
            <Field label="Vita (cm)" type="number" value={waist} onChange={setWaist} />
            <Field label="Petto (cm)" type="number" value={chest} onChange={setChest} />
            <Field label="Fianchi (cm)" type="number" value={hips} onChange={setHips} />
            <Field label="Note" value={notes} onChange={setNotes} />
          </div>

          <div style={{ marginTop: 12, marginBottom: 14 }}>
            <label style={{ ...fontMono, fontSize: 11, color: C.textDim, display: "block", marginBottom: 6 }}>FOTO PROGRESSI</label>
            <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: "none" }} id="photo-upload" />
            <label htmlFor="photo-upload" style={{ ...secondaryBtn, display: "inline-flex", cursor: "pointer" }}>
              <Camera size={16} /> {photoProcessing ? "Elaborazione..." : photo ? "Cambia Foto" : "Carica Foto"}
            </label>
            {photo && (
              <div style={{ marginTop: 10, position: "relative", width: 100, height: 100 }}>
                <img src={photo} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
                <button onClick={() => setPhoto(null)} style={{ position: "absolute", top: -6, right: -6, background: C.accent, border: "none", borderRadius: "50%", color: "#fff", width: 20, height: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X size={12} />
                </button>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={submitEntry} style={primaryBtn}>Salva Registro</button>
            <button onClick={() => setShowAdd(false)} style={secondaryBtn}>Annulla</button>
          </div>
        </div>
      )}

      {safeEntries.length === 0 ? (
        <div style={{ padding: 20, textAlign: "center", color: C.textDim, background: C.panel, borderRadius: 12, border: `1px solid ${C.border}` }}>
          <TrendingUp size={28} color={C.textDim} style={{ marginBottom: 8 }} />
          <p style={{ ...fontBody, margin: 0 }}>Nessun dato sul peso o misurazioni inserito finora.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[...safeEntries].reverse().map((entry) => (
            <div key={entry.id || Math.random()} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, display: "flex", gap: 14, alignItems: "center" }}>
              {entry.photo ? (
                <img src={entry.photo} alt="Progress" style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 8 }} />
              ) : (
                <div style={{ width: 70, height: 70, borderRadius: 8, background: C.panelHi, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ImageOff size={20} color={C.textDim} />
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ ...fontMono, fontSize: 12, color: C.textDim }}>{fmtDate(entry.date)}</span>
                  <span style={{ ...fontDisplay, fontSize: 20, color: C.positive }}>{entry.weight} kg</span>
                </div>
                <div style={{ display: "flex", gap: 12, ...fontMono, fontSize: 11, color: C.textDim }}>
                  {entry.waist && <span>Vita: {entry.waist}cm</span>}
                  {entry.chest && <span>Petto: {entry.chest}cm</span>}
                  {entry.hips && <span>Fianchi: {entry.hips}cm</span>}
                </div>
                {entry.notes && <p style={{ ...fontBody, fontSize: 13, color: C.text, margin: "6px 0 0" }}>{entry.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// COMPONENTE APP PRINCIPALE (Con Auto-Collegamento Email)
// ============================================================
export default function App() {
  const [session, setSession] = useState(undefined);
  const [role, setRole] = useState(null); // "trainer" | "client" | "pending"
  const [myClientRecord, setMyClientRecord] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setRole(null);
      setMyClientRecord(null);
      return;
    }

    const isTrainer = session.user.user_metadata?.role === "trainer";

    if (isTrainer) {
      setRole("trainer");
      setMyClientRecord(null);
      return;
    }

    // Funzione asincrona per determinare, auto-collegare o auto-creare il cliente
    (async () => {
      // 1. Cerca prima tramite auth_user_id
      let { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('auth_user_id', session.user.id)
        .maybeSingle();

      if (error) {
        console.error("Errore nel recupero del cliente tramite auth_user_id:", error);
      }

      // 2. Se non lo trova, prova a collegarlo automaticamente tramite l'EMAIL del cliente
      if (!data) {
        const userEmail = session.user.email;
        const { data: clientByEmail, error: emailError } = await supabase
          .from('clients')
          .select('*')
          .eq('email', userEmail)
          .maybeSingle();

        if (!emailError && clientByEmail) {
          const { data: updatedData, error: updateError } = await supabase
            .from('clients')
            .update({ auth_user_id: session.user.id })
            .eq('id', clientByEmail.id)
            .select()
            .single();

          if (!updateError && updatedData) {
            data = updatedData;
          }
        }
      }

      // 3. SE ANCORA NON ESISTE, LO CREA AUTOMATICAMENTE (Elimina il "pending")
      if (!data) {
        const userEmail = session.user.email;
        const defaultName = session.user.user_metadata?.name || userEmail.split('@')[0];

        const { data: newClient, error: insertError } = await supabase
          .from('clients')
          .insert([
            {
              auth_user_id: session.user.id,
              email: userEmail,
              name: defaultName,
              intake: {}
            }
          ])
          .select()
          .single();

        if (!insertError && newClient) {
          data = newClient;
        }
      }

      // 4. Accesso sempre sbloccato come cliente
      if (data) {
        setRole("client");
        setMyClientRecord(data);
      } else {
        // Fallback di sicurezza estrema per evitare qualsiasi blocco grafico
        setRole("client");
        setMyClientRecord({
          auth_user_id: session.user.id,
          email: session.user.email,
          name: session.user.email.split('@')[0],
          intake: {}
        });
      }
    })();
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (session === undefined) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f0f12", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ ...fontBody, color: C.textDim }}>Caricamento...</p>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen onLoggedIn={setSession} />;
  }

  if (role === null) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f0f12", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ ...fontBody, color: C.textDim }}>Caricamento profilo...</p>
      </div>
    );
  }

  if (role === "pending") {
    return (
      <div style={{ minHeight: "100vh", background: "#0f0f12", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, gap: 16, textAlign: "center" }}>
        <p style={{ ...fontBody, color: C.textDim, maxWidth: 400 }}>
          Il tuo account è stato creato, ma non è ancora associato a nessuna email cliente inserita dal trainer. Assicurati che il trainer abbia aggiunto il tuo indirizzo email esatto nella lista clienti.
        </p>
        <button onClick={handleLogout} style={secondaryBtn}>
          <LogOut size={15} /> Esci
        </button>
      </div>
    );
  }

  if (role === "trainer") {
    return <TrainerDashboard session={session} onLogout={handleLogout} />;
  }

  return (
    <ClientWorkspace
      client={myClientRecord}
      isTrainer={false}
      onBack={() => {}}
      onLogout={handleLogout}
    />
  );
}
