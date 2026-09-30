import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import {
  Save, Edit2, Check, Printer, Copy, Plus, Trash2,
  Dumbbell, PlayCircle, Camera, X, ImageOff, TrendingUp, LogOut, UserPlus, Search, WifiOff
} from 'lucide-react';

/* ============================================================
   NOTE IMPORTANTE SULLO SCHEMA DATABASE
   ============================================================
   - tabella "clients": id (uuid), trainer_id (uuid, FK auth.users),
     auth_user_id (uuid, FK auth.users, nullable finché il cliente
     non si registra), name (text), email (text), intake (jsonb)
   - tabella "programs": id, client_id (FK clients, UNIQUE), days (jsonb)
   - tabella "exercises": id, name, category, image_url, trainer_id
   - tabella "progress_entries": id, client_id, date, weight, waist,
     chest, hips, notes, photo (url o base64)
   - tabella "loads": id, client_id, exercise_name, weight, reps, date, notes
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
  padding: "10px 14px", ...fontBody, fontSize: 13, fontWeight: 600, cursor: "pointer",
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6
};

const secondaryBtn = {
  background: C.panelHi, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8,
  padding: "10px 14px", ...fontBody, fontSize: 13, fontWeight: 600, cursor: "pointer",
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6
};

const iconBtn = {
  background: "transparent", border: "none", cursor: "pointer", padding: 6, display: "flex", alignItems: "center", justifyContent: "center"
};

const inputStyle = {
  display: "block", width: "100%", marginTop: 4, padding: "12px 14px",
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
    <div style={{ marginBottom: 10 }}>
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
      .maybeSingle();
    if (error) throw error;
    if (data) {
      localStorage.setItem(`cache_program_${clientId}`, JSON.stringify(data));
    }
    return data;
  } catch (err) {
    console.warn("Modalità offline: recupero programma dalla cache locale", err);
    const cached = localStorage.getItem(`cache_program_${clientId}`);
    return cached ? JSON.parse(cached) : null;
  }
}

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
      setErrorMsg(err.message || "Errore durante l'autenticazione. Verifica la connessione a internet.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f12", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <form onSubmit={handleSubmit} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, width: "100%", maxWidth: 360, boxSizing: "border-box" }}>
        <h1 style={{ ...fontDisplay, fontSize: 24, color: C.text, margin: "0 0 4px", textAlign: "center" }}>CHRIS COACH</h1>
        <p style={{ ...fontBody, fontSize: 13, color: C.textDim, margin: "0 0 20px", textAlign: "center" }}>
          {mode === "login" ? "Accedi al tuo account" : "Crea un nuovo account"}
        </p>

        <Field label="Email" type="email" value={email} onChange={setEmail} />
        <Field label="Password" type="password" value={password} onChange={setPassword} />

        {errorMsg && (
          <p style={{ ...fontBody, fontSize: 13, color: C.danger, margin: "8px 0 12px", textAlign: "center" }}>{errorMsg}</p>
        )}

        <div style={{ marginTop: 16 }}>
          <button type="submit" disabled={loading} style={{ ...primaryBtn, width: "100%", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Attendere..." : mode === "login" ? "Accedi" : "Registrati"}
          </button>
        </div>

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
// DASHBOARD TRAINER
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
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('trainer_id', session.user.id)
        .order('name', { ascending: true });
      if (error) throw error;
      if (data) {
        localStorage.setItem(`cache_clients_${session.user.id}`, JSON.stringify(data));
        setClients(data);
      }
    } catch (err) {
      console.warn("Modalità offline: caricamento clienti dalla cache locale", err);
      const cached = localStorage.getItem(`cache_clients_${session.user.id}`);
      setClients(cached ? JSON.parse(cached) : []);
    } finally {
      setLoading(false);
    }
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
    <div style={{ minHeight: "100vh", background: "#0f0f12", padding: 16, boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, maxWidth: 900, margin: "0 auto 20px" }}>
        <h1 style={{ ...fontDisplay, fontSize: 22, color: C.text, margin: 0 }}>I TUOI CLIENTI</h1>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setShowNewClient(!showNewClient)} style={{ ...primaryBtn, padding: "8px 12px", fontSize: 12 }}>
            <UserPlus size={15} /> Nuovo
          </button>
          <button onClick={onLogout} style={{ ...secondaryBtn, padding: "8px 12px", fontSize: 12 }}>
            <LogOut size={15} /> Esci
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {showNewClient && (
          <form onSubmit={handleCreateClient} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <h3 style={{ ...fontDisplay, fontSize: 16, color: C.text, margin: "0 0 12px" }}>Aggiungi Nuovo Cliente</h3>
            <Field label="Nome completo" value={newClientName} onChange={setNewClientName} />
            <Field label="Email cliente" type="email" value={newClientEmail} onChange={setNewClientEmail} />
            <Field label="Password temporanea (opzionale)" type="text" value={newClientPassword} onChange={setNewClientPassword} />
            <span style={{ fontSize: 11, color: C.textDim, margin: "-6px 0 12px", display: "block" }}>Se vuota, sarà generata in automatico.</span>
            
            {createError && <p style={{ ...fontBody, fontSize: 13, color: C.danger, marginBottom: 12 }}>{createError}</p>}
            
            <button type="submit" disabled={creating} style={{ ...primaryBtn, width: "100%", opacity: creating ? 0.7 : 1 }}>
              {creating ? "Creazione..." : "Crea Cliente"}
            </button>
          </form>
        )}

        {loading ? (
          <p style={{ ...fontBody, color: C.textDim, textAlign: "center" }}>Caricamento clienti...</p>
        ) : clients.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: C.textDim, background: C.panel, borderRadius: 12, border: `1px solid ${C.border}` }}>
            <p style={{ ...fontBody, margin: 0 }}>Nessun cliente trovato o connessione assente.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
            {clients.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedClientId(c.id)}
                style={{
                  ...secondaryBtn, justifyContent: "space-between", padding: 14, textAlign: "left",
                  width: "100%", alignItems: "center", background: C.panel
                }}
              >
                <div>
                  <span style={{ ...fontDisplay, fontSize: 15, color: C.text, display: "block" }}>{c.name}</span>
                  <span style={{ ...fontMono, fontSize: 11, color: C.textDim, display: "block", marginTop: 2 }}>
                    {c.intake?.goal || "Obiettivo non impostato"}
                  </span>
                </div>
                <span style={{ color: C.accent, fontSize: 16 }}>→</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// WORKSPACE CLIENTE
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
      let p = null;
      let entries = [];
      try {
        const [progRes, entriesRes] = await Promise.all([
          supabase.from('programs').select('*').eq('client_id', client.id).maybeSingle(),
          supabase.from('progress_entries').select('*').eq('client_id', client.id).order('date', { ascending: true })
        ]);
        if (progRes.error) throw progRes.error;
        if (entriesRes.error) throw entriesRes.error;

        p = progRes.data;
        entries = entriesRes.data || [];

        if (p) localStorage.setItem(`cache_program_${client.id}`, JSON.stringify(p));
        localStorage.setItem(`cache_progress_${client.id}`, JSON.stringify(entries));
      } catch (err) {
        console.warn("Modalità offline: caricamento dati workspace dalla cache locale", err);
        const cachedProg = localStorage.getItem(`cache_program_${client.id}`);
        const cachedEntries = localStorage.getItem(`cache_progress_${client.id}`);
        p = cachedProg ? JSON.parse(cachedProg) : null;
        entries = cachedEntries ? JSON.parse(cachedEntries) : [];
      }

      if (active) {
        setProgram(p || { days: [] });
        setProgressEntries(entries);
        setLoadingData(false);
      }
    }
    load();
    return () => { active = false; };
  }, [client.id]);

  const handleSaveIntake = async (form) => {
    try {
      const { error } = await supabase.from('clients').update({ intake: form }).eq('id', client.id);
      if (error) throw error;
      if (onClientUpdated) onClientUpdated();
    } catch (err) {
      console.warn("Impossibile salvare l'anamnesi offline su Supabase", err);
      alert("Sei offline: le modifiche all'anamnesi potrebbero non essere sincronizzate sul server.");
    }
  };

  const handleSaveProgram = (newProgram) => {
    setProgram(newProgram);
  };

  const handleAddProgressEntry = async (entry) => {
    try {
      const { error } = await supabase.from('progress_entries').insert({ ...entry, client_id: client.id });
      if (error) throw error;
    } catch (err) {
      console.warn("Impossibile salvare la misurazione online, salvata in locale", err);
    }
    const updatedEntries = [...progressEntries, entry];
    setProgressEntries(updatedEntries);
    localStorage.setItem(`cache_progress_${client.id}`, JSON.stringify(updatedEntries));
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f12", padding: 12, boxSizing: "border-box" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 8 }}>
          {isTrainer ? (
            <button onClick={onBack} style={{ ...secondaryBtn, padding: "8px 10px", fontSize: 12 }}>← Clienti</button>
          ) : (
            <button onClick={onLogout} style={{ ...secondaryBtn, padding: "8px 10px", fontSize: 12 }}>
              <LogOut size={14} /> Esci
            </button>
          )}
          <div className="no-print" style={{ display: "flex", gap: 4 }}>
            {["intake", "program", "progress"].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  ...secondaryBtn,
                  padding: "8px 10px",
                  fontSize: 12,
                  borderColor: tab === t ? C.accent : C.border,
                  color: tab === t ? C.accent : C.text,
                  background: tab === t ? C.panelHi : C.panel
                }}
              >
                {t === "intake" ? "Scheda" : t === "program" ? "Programma" : "Progressi"}
              </button>
            ))}
          </div>
        </div>

        {loadingData ? (
          <p style={{ ...fontBody, color: C.textDim, textAlign: "center", marginTop: 40 }}>Caricamento...</p>
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
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h3 style={{ ...fontDisplay, fontSize: 18, color: C.text, margin: 0 }}>ANAMNESI & PARAMETRI</h3>
        {isTrainer && (
          <button onClick={() => { if (editing) handleSave(); else setEditing(true); }} style={{ ...secondaryBtn, padding: "6px 10px", fontSize: 12 }}>
            {editing ? <><Save size={13} /> Salva</> : <><Edit2 size={13} /> Modifica</>}
          </button>
        )}
      </div>

      {editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Data di nascita" type="date" value={form.birthDate} onChange={(v) => setForm({ ...form, birthDate: v })} />
            <div>
              <label style={{ ...fontMono, fontSize: 11, color: C.textDim, letterSpacing: "0.1em" }}>SESSO</label>
              <select value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })} style={inputStyle}>
                <option value="M">Uomo (M)</option>
                <option value="F">Donna (F)</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
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

          <button onClick={handleSave} style={{ ...primaryBtn, marginTop: 6, width: "100%" }}>
            <Save size={15} /> Salva Anamnesi
          </button>
        </div>
      ) : (
        <div>
          {calc && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, background: C.panelHi, padding: 10, borderRadius: 10, marginBottom: 16, textAlign: "center" }}>
              <div>
                <p style={{ ...fontMono, fontSize: 9, color: C.textDim, margin: 0 }}>ETÀ</p>
                <p style={{ ...fontDisplay, fontSize: 16, color: C.text, margin: "2px 0 0" }}>{calc.age}</p>
              </div>
              <div>
                <p style={{ ...fontMono, fontSize: 9, color: C.textDim, margin: 0 }}>BMR</p>
                <p style={{ ...fontDisplay, fontSize: 16, color: C.accent, margin: "2px 0 0" }}>{calc.bmr}</p>
              </div>
              <div>
                <p style={{ ...fontMono, fontSize: 9, color: C.textDim, margin: 0 }}>TDEE</p>
                <p style={{ ...fontDisplay, fontSize: 16, color: C.positive, margin: "2px 0 0" }}>{calc.tdee}</p>
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div>
              <p style={{ ...fontMono, fontSize: 10, color: C.textDim, margin: 0 }}>ALTEZZA / PESO</p>
              <p style={{ ...fontBody, fontSize: 13, color: C.text, margin: "2px 0 0" }}>
                {form.heightCm ? `${form.heightCm} cm` : "—"} / {form.startingWeight ? `${form.startingWeight} kg` : "—"}
              </p>
            </div>
            <div>
              <p style={{ ...fontMono, fontSize: 10, color: C.textDim, margin: 0 }}>ATTIVITÀ</p>
              <p style={{ ...fontBody, fontSize: 13, color: C.text, margin: "2px 0 0" }}>
                {ACTIVITY_LEVELS.find((a) => a.value === form.activityLevel)?.label || form.activityLevel || "—"}
              </p>
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <p style={{ ...fontMono, fontSize: 10, color: C.textDim, margin: 0 }}>OBIETTIVO</p>
            <p style={{ ...fontBody, fontSize: 13, color: C.text, margin: "2px 0 0" }}>{form.goal || "Non specificato"}</p>
          </div>

          <div style={{ marginBottom: 10 }}>
            <p style={{ ...fontMono, fontSize: 10, color: C.textDim, margin: 0 }}>INFORTUNI / LIMITAZIONI</p>
            <p style={{ ...fontBody, fontSize: 13, color: C.text, margin: "2px 0 0" }}>{form.injuries || "Nessuno segnalato"}</p>
          </div>

          <div>
            <p style={{ ...fontMono, fontSize: 10, color: C.textDim, margin: 0 }}>NOTE</p>
            <p style={{ ...fontBody, fontSize: 13, color: C.text, margin: "2px 0 0" }}>{form.notes || "—"}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Modale Carichi ----------
function LoadTrackerModal({ clientId, exerciseName, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('loads')
        .select('*')
        .eq('client_id', clientId)
        .eq('exercise_name', exerciseName)
        .order('date', { ascending: false });
      if (error) throw error;
      if (data) {
        localStorage.setItem(`cache_loads_${clientId}_${exerciseName}`, JSON.stringify(data));
        setLogs(data);
      }
    } catch (err) {
      console.warn("Modalità offline: recupero carichi dalla cache locale", err);
      const cached = localStorage.getItem(`cache_loads_${clientId}_${exerciseName}`);
      setLogs(cached ? JSON.parse(cached) : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clientId && exerciseName) fetchLogs();
  }, [clientId, exerciseName]);

  const handleAddLog = async (e) => {
    e.preventDefault();
    if (!weight) return;
    setSubmitting(true);
    const newLog = {
      id: uid(),
      client_id: clientId,
      exercise_name: exerciseName,
      weight,
      reps,
      date,
      notes
    };

    try {
      const { error } = await supabase.from('loads').insert([newLog]);
      if (error) throw error;
    } catch (err) {
      console.warn("Offline: carico salvato localmente", err);
    }

    const updatedLogs = [newLog, ...logs];
    setLogs(updatedLogs);
    localStorage.setItem(`cache_loads_${clientId}_${exerciseName}`, JSON.stringify(updatedLogs));

    setWeight("");
    setReps("");
    setNotes("");
    setSubmitting(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 12 }}>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, width: "100%", maxWidth: 420, maxHeight: "90vh", display: "flex", flexDirection: "column", padding: 16, boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ ...fontDisplay, color: C.text, fontSize: 16 }}>Carichi — {exerciseName}</span>
          <button onClick={onClose} style={iconBtn}><X size={20} color={C.text} /></button>
        </div>

        <form onSubmit={handleAddLog} style={{ background: C.panelHi, padding: 10, borderRadius: 8, marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ ...fontMono, fontSize: 11, color: C.accent, fontWeight: 700 }}>REGISTRA PERFORMANCE</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <Field label="Peso (kg)*" type="text" value={weight} onChange={setWeight} />
            <Field label="Ripetizioni" type="text" value={reps} onChange={setReps} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6 }}>
            <Field label="Data" type="date" value={date} onChange={setDate} />
            <Field label="Note (es. RPE, sensazioni)" type="text" value={notes} onChange={setNotes} />
          </div>
          <button type="submit" disabled={submitting} style={{ ...primaryBtn, width: "100%", marginTop: 4, opacity: submitting ? 0.7 : 1 }}>
            <Plus size={14} /> {submitting ? "Salvataggio..." : "Aggiungi Carico"}
          </button>
        </form>

        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, WebkitOverflowScrolling: "touch" }}>
          <span style={{ ...fontMono, fontSize: 11, color: C.textDim, marginBottom: 2 }}>STORICO PRECEDENTE</span>
          {loading ? (
            <p style={{ ...fontBody, fontSize: 12, color: C.textDim, textAlign: "center" }}>Caricamento storico...</p>
          ) : logs.length === 0 ? (
            <p style={{ ...fontBody, fontSize: 12, color: C.textDim, textAlign: "center", padding: 10 }}>Nessuna performance registrata per questo esercizio.</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} style={{ background: C.panelHi, padding: 10, borderRadius: 8, border: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                    <span style={{ ...fontDisplay, fontSize: 16, color: C.positive }}>{log.weight} kg</span>
                    {log.reps && <span style={{ ...fontBody, fontSize: 13, color: C.text }}>× {log.reps} rip</span>}
                  </div>
                  {log.notes && <span style={{ ...fontBody, fontSize: 11, color: C.textDim, display: "block", marginTop: 2 }}>{log.notes}</span>}
                </div>
                <span style={{ ...fontMono, fontSize: 10, color: C.textDim }}>{fmtDate(log.date)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Program Section ----------
export function ProgramSection({ program, isTrainer, clientId, clientName, siblingClients = [], onSave }) {
  const safeProgram = program || {};
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [activeVideoUrl, setActiveVideoUrl] = useState(null);
  const [activeLoadExercise, setActiveLoadExercise] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState(""); 
  
  const saveTimeoutRef = useRef(null);

  const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);
  const [exerciseList, setExerciseList] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [targetExForModal, setTargetExForModal] = useState(null);

  const days = safeProgram.days || [];
  const currentDay = days[activeDayIdx] || null;

  const handleUpdateProgram = (newDays) => {
    if (!clientId) {
      setSaveStatus("error");
      return;
    }

    const updatedProgram = { ...safeProgram, days: newDays };
    if (onSave) onSave(updatedProgram);

    localStorage.setItem(`cache_program_${clientId}`, JSON.stringify(updatedProgram));

    setSaveStatus("saving");

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      const payload = { client_id: clientId, days: newDays };
      if (safeProgram.id) {
        payload.id = safeProgram.id;
      }

      try {
        const { error } = await supabase
          .from("programs")
          .upsert(payload, { onConflict: 'client_id' });
        if (error) throw error;
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus(""), 2000);
      } catch (err) {
        console.warn("Errore Supabase (offline mode attiva):", err);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus(""), 2000);
      }
    }, 1000);
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
    if (!window.confirm("Eliminare questa giornata di allenamento?")) return;
    const updated = days.filter((_, i) => i !== idx);
    handleUpdateProgram(updated);
    if (activeDayIdx >= updated.length) setActiveDayIdx(Math.max(0, updated.length - 1));
  };

  const addBlock = (dayIdx) => {
    const newBlock = { 
      id: uid(), 
      exercises: [{ id: uid(), name: "", sets: "3", reps: "10-12", rest: "90''", note: "", videoUrl: "", imageUrl: "" }] 
    };
    patchDay(dayIdx, (day) => ({ ...day, blocks: [...(day.blocks || []), newBlock] }));
  };

  const deleteBlock = (dayIdx, blockIdx) => {
    patchDay(dayIdx, (day) => ({ ...day, blocks: day.blocks.filter((_, i) => i !== blockIdx) }));
  };

  const addExercise = (dayIdx, blockIdx) => {
    const newEx = { id: uid(), name: "", sets: "3", reps: "10", rest: "90''", note: "", videoUrl: "", imageUrl: "" };
    patchBlock(dayIdx, blockIdx, (block) => ({ ...block, exercises: [...block.exercises, newEx] }));
  };

  const deleteExercise = (dayIdx, blockIdx, exIdx) => {
    patchBlock(dayIdx, blockIdx, (block) => ({ ...block, exercises: block.exercises.filter((_, i) => i !== exIdx) }));
  };

  const openExerciseLibrary = async (bIdx, exIdx) => {
    setTargetExForModal({ bIdx, exIdx });
    try {
      const { data, error } = await supabase.from('exercises').select('*').order('name', { ascending: true });
      if (error) throw error;
      if (data) {
        localStorage.setItem('cache_exercises_lib', JSON.stringify(data));
        setExerciseList(data);
      }
    } catch (err) {
      const cached = localStorage.getItem('cache_exercises_lib');
      setExerciseList(cached ? JSON.parse(cached) : []);
    }
    setIsExerciseModalOpen(true);
  };

  const selectExerciseFromLibrary = (exercise) => {
    if (!targetExForModal) return;
    const { bIdx, exIdx } = targetExForModal;
    patchExercise(activeDayIdx, bIdx, exIdx, (item) => ({
      ...item,
      name: exercise.name,
      imageUrl: exercise.image_url || item.imageUrl
    }));
    setIsExerciseModalOpen(false);
    setTargetExForModal(null);
  };

  const copyFromClient = async (sourceClientId) => {
    if (!sourceClientId) return;
    const p = await fetchProgram(sourceClientId);
    if (p && p.days && window.confirm("Sostituire il programma con quello selezionato?")) {
      handleUpdateProgram(p.days);
    }
  };

  return (
    <div>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ ...fontDisplay, fontSize: 18, color: C.text, margin: 0 }}>
          {isTrainer ? `PROGRAMMA` : "IL TUO PROGRAMMA"}
        </h3>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {saveStatus === "saving" && <span style={{ fontSize: 11, color: C.textDim }}>Salvataggio...</span>}
          {saveStatus === "saved" && <span style={{ fontSize: 11, color: C.positive, fontWeight: 600 }}>✓ Salvato</span>}
          {saveStatus === "error" && <span style={{ fontSize: 11, color: C.danger, fontWeight: 600 }}>✕ Errore</span>}

          <button onClick={() => window.print()} style={{ ...secondaryBtn, padding: "6px 10px", fontSize: 12 }} title="Stampa">
            <Printer size={14} /> Stampa
          </button>
          {isTrainer && (
            <button onClick={() => setIsEditing(!isEditing)} style={{ ...secondaryBtn, padding: "6px 10px", fontSize: 12, borderColor: isEditing ? C.accent : C.border, color: isEditing ? C.accent : C.text }}>
              {isEditing ? <Check size={14} /> : <Edit2 size={14} />} {isEditing ? "Fine" : "Modifica"}
            </button>
          )}
        </div>
      </div>

      {isTrainer && isEditing && (siblingClients || []).length > 0 && (
        <div className="no-print" style={{ background: C.panelHi, padding: 10, borderRadius: 8, marginBottom: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Copy size={14} color={C.accent} />
          <span style={{ fontSize: 12, color: C.textDim }}>Copia da:</span>
          <select onChange={(e) => copyFromClient(e.target.value)} defaultValue="" style={{ background: C.panel, color: C.text, border: `1px solid ${C.border}`, padding: "6px 8px", borderRadius: 6, fontSize: 12, flex: 1 }}>
            <option value="" disabled>Seleziona cliente...</option>
            {siblingClients.filter((c) => c.id !== clientId).map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        </div>
      )}

      {days.length > 0 && (
        <div className="no-print" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 12, WebkitOverflowScrolling: "touch" }}>
          {days.map((day, idx) => (
            <button
              key={day.id || idx}
              onClick={() => setActiveDayIdx(idx)}
              style={{
                padding: "8px 12px", borderRadius: 8,
                background: activeDayIdx === idx ? C.panelHi : C.panel,
                border: `1px solid ${activeDayIdx === idx ? C.accent : C.border}`,
                color: activeDayIdx === idx ? C.text : C.textDim,
                ...fontBody, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0
              }}
            >
              {day.label || `Giorno ${idx + 1}`}
            </button>
          ))}
          {isTrainer && isEditing && (
            <button onClick={addDay} style={{ ...secondaryBtn, padding: "8px 10px", fontSize: 12, flexShrink: 0 }}>
              <Plus size={14} /> Giorno
            </button>
          )}
        </div>
      )}

      {days.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: C.textDim, background: C.panel, borderRadius: 12, border: `1px solid ${C.border}` }}>
          <Dumbbell size={26} color={C.textDim} style={{ marginBottom: 6 }} />
          <p style={{ ...fontBody, fontSize: 13, margin: 0 }}>Nessun giorno di allenamento trovato.</p>
          {isTrainer && (
            <button onClick={() => { if (!isEditing) setIsEditing(true); addDay(); }} style={{ ...primaryBtn, marginTop: 10, fontSize: 12 }}>
              <Plus size={15} /> Aggiungi Giorno
            </button>
          )}
        </div>
      ) : currentDay ? (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, borderBottom: `2px solid ${C.accent}`, paddingBottom: 8 }}>
            {isEditing ? (
              <input
                value={currentDay.label || ""}
                onChange={(e) => patchDay(activeDayIdx, (day) => ({ ...day, label: e.target.value }))}
                style={{ background: C.panelHi, border: `1px solid ${C.border}`, color: C.text, padding: "4px 8px", borderRadius: 6, ...fontDisplay, fontSize: 16, width: "75%" }}
              />
            ) : (
              <h2 style={{ ...fontDisplay, fontSize: 17, color: C.accent, margin: 0 }}>{currentDay.label}</h2>
            )}
            {isEditing && (
              <button onClick={() => deleteDay(activeDayIdx)} style={iconBtn} title="Elimina Giorno">
                <Trash2 size={16} color={C.danger} />
              </button>
            )}
          </div>

          {isEditing && (
            <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
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
                      padding: "4px 6px", borderRadius: 6, fontSize: 10, ...fontMono, cursor: "pointer",
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
            <div key={block.id || bIdx} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.panelHi, padding: "6px 10px", borderRadius: 6, marginBottom: 6 }}>
                <span style={{ ...fontMono, fontSize: 10, color: C.textDim, fontWeight: 700 }}>BLOCCO #{bIdx + 1}</span>
                {isEditing && (
                  <button onClick={() => deleteBlock(activeDayIdx, bIdx)} style={iconBtn} title="Elimina blocco">
                    <Trash2 size={14} color={C.danger} />
                  </button>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(block.exercises || []).map((ex, exIdx) => (
                  <div key={ex.id || exIdx} style={{ padding: 10, background: isEditing ? C.panelHi : "transparent", borderBottom: `1px solid ${C.border}`, borderRadius: 8 }}>
                    {isEditing ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input 
                            placeholder="Nome Esercizio" 
                            value={ex.name || ""} 
                            onChange={(e) => patchExercise(activeDayIdx, bIdx, exIdx, (item) => ({ ...item, name: e.target.value }))} 
                            style={{ flex: 1, background: C.panel, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 10px", fontSize: 13 }} 
                          />
                          <button 
                            type="button"
                            onClick={() => openExerciseLibrary(bIdx, exIdx)} 
                            style={{ ...secondaryBtn, padding: "8px 10px", fontSize: 11, flexShrink: 0 }}
                            title="Libreria"
                          >
                            <Search size={13} />
                          </button>
                          <button onClick={() => deleteExercise(activeDayIdx, bIdx, exIdx)} style={iconBtn}><Trash2 size={15} color={C.danger} /></button>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                          <div style={{ background: C.panel, padding: "6px 8px", borderRadius: 6, border: `1px solid ${C.border}` }}>
                            <span style={{ fontSize: 9, color: C.textDim, display: "block", ...fontMono }}>SERIE</span>
                            <input value={ex.sets || ""} onChange={(e) => patchExercise(activeDayIdx, bIdx, exIdx, (item) => ({ ...item, sets: e.target.value }))} style={{ width: "100%", background: "transparent", border: "none", color: C.text, fontSize: 13, textAlign: "center", fontWeight: "bold", outline: "none" }} />
                          </div>
                          <div style={{ background: C.panel, padding: "6px 8px", borderRadius: 6, border: `1px solid ${C.border}` }}>
                            <span style={{ fontSize: 9, color: C.textDim, display: "block", ...fontMono }}>RIP</span>
                            <input value={ex.reps || ""} onChange={(e) => patchExercise(activeDayIdx, bIdx, exIdx, (item) => ({ ...item, reps: e.target.value }))} style={{ width: "100%", background: "transparent", border: "none", color: C.positive, fontSize: 13, textAlign: "center", fontWeight: "bold", outline: "none" }} />
                          </div>
                          <div style={{ background: C.panel, padding: "6px 8px", borderRadius: 6, border: `1px solid ${C.border}` }}>
                            <span style={{ fontSize: 9, color: C.textDim, display: "block", ...fontMono }}>REC</span>
                            <input value={ex.rest || ""} onChange={(e) => patchExercise(activeDayIdx, bIdx, exIdx, (item) => ({ ...item, rest: e.target.value }))} style={{ width: "100%", background: "transparent", border: "none", color: C.text, fontSize: 13, textAlign: "center", fontWeight: "bold", outline: "none" }} />
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 6 }}>
                          <input placeholder="Link YouTube (opzionale)" value={ex.videoUrl || ""} onChange={(e) => patchExercise(activeDayIdx, bIdx, exIdx, (item) => ({ ...item, videoUrl: e.target.value }))} style={{ flex: 1, background: C.panel, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 11 }} />
                          <input placeholder="Note" value={ex.note || ""} onChange={(e) => patchExercise(activeDayIdx, bIdx, exIdx, (item) => ({ ...item, note: e.target.value }))} style={{ flex: 1, background: C.panel, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 11 }} />
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                            {ex.imageUrl && <img src={ex.imageUrl} alt="" style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />}
                            <span style={{ ...fontBody, fontWeight: 600, color: C.text, fontSize: 13, wordBreak: "break-word" }}>{ex.name || "Esercizio"}</span>
                            {ex.videoUrl && (
                              <button onClick={() => setActiveVideoUrl(ex.videoUrl)} style={iconBtn} title="Video">
                                <PlayCircle size={16} color={C.accent} />
                              </button>
                            )}
                          </div>
                          <button onClick={() => setActiveLoadExercise(ex.name)} style={{ ...secondaryBtn, padding: "6px 10px", fontSize: 11, flexShrink: 0 }}>
                            <Dumbbell size={12} /> Carichi
                          </button>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.panelHi, padding: "6px 10px", borderRadius: 6, ...fontMono, fontSize: 11 }}>
                          <span style={{ color: C.textDim }}>Serie: <strong style={{ color: C.text }}>{ex.sets || "3"}</strong></span>
                          <span style={{ color: C.positive, fontWeight: 600 }}>{ex.reps || "10"} rip</span>
                          <span style={{ color: C.textDim }}>Rec: <strong style={{ color: C.text }}>{ex.rest || "90''"}</strong></span>
                        </div>
                        {ex.note && <span style={{ ...fontBody, fontSize: 11, color: C.textDim, fontStyle: "italic" }}>Note: {ex.note}</span>}
                      </div>
                    )}
                  </div>
                ))}

                {isEditing && (
                  <button onClick={() => addExercise(activeDayIdx, bIdx)} style={{ ...secondaryBtn, justifyContent: "center", fontSize: 12, padding: "8px", borderStyle: "dashed", width: "100%", marginTop: 4 }}>
                    <Plus size={14} /> Aggiungi Esercizio
                  </button>
                )}
              </div>
            </div>
          ))}

          {isEditing && (
            <button onClick={() => addBlock(activeDayIdx)} style={{ ...primaryBtn, width: "100%", marginTop: 6, fontSize: 12, padding: "8px" }}>
              <Plus size={15} /> Aggiungi Blocco
            </button>
          )}
        </div>
      ) : null}

      {/* Modale Ricerca Libreria Esercizi */}
      {isExerciseModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 12 }}>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, width: "100%", maxWidth: 420, maxHeight: "85vh", display: "flex", flexDirection: "column", padding: 14, boxSizing: "border-box" }}>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ ...fontDisplay, color: C.text, fontSize: 16 }}>Seleziona Esercizio</span>
              <button onClick={() => setIsExerciseModalOpen(false)} style={iconBtn}><X size={20} color={C.text} /></button>
            </div>

            <input
              placeholder="Cerca esercizio..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ background: C.panelHi, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 13, marginBottom: 10, width: "100%", boxSizing: "border-box" }}
            />

            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, WebkitOverflowScrolling: "touch" }}>
              {exerciseList
                .filter(ex => ex.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((ex) => (
                  <div
                    key={ex.id}
                    onClick={() => selectExerciseFromLibrary(ex)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px", background: C.panelHi, borderRadius: 8, cursor: "pointer",
                      border: `1px solid ${C.border}`
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                      {ex.image_url ? (
                        <img src={ex.image_url} alt="" style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 36, height: 36, background: C.border, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Dumbbell size={16} color={C.textDim} />
                        </div>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ ...fontBody, fontSize: 13, fontWeight: 600, color: C.text, wordBreak: "break-word" }}>{ex.name}</div>
                        <div style={{ ...fontMono, fontSize: 10, color: C.textDim }}>{ex.category || "Generale"}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 12, color: C.accent, fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>Seleziona</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {activeVideoUrl && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 12 }}>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, width: "100%", maxWidth: 500, padding: 14, boxSizing: "border-box" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ ...fontDisplay, color: C.text, fontSize: 15 }}>Video Dimostrativo</span>
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
        <LoadTrackerModal
          clientId={clientId}
          exerciseName={activeLoadExercise}
          onClose={() => setActiveLoadExercise(null)}
        />
      )}
    </div>
  );
}

// ---------- Sezione Progressi (Layout Mobile a colonna fissa, Zero Sovrapposizioni) ----------
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
        <h3 style={{ ...fontDisplay, fontSize: 18, color: C.text, margin: 0 }}>PROGRESSI</h3>
        <button onClick={() => setShowAdd(!showAdd)} style={{ ...primaryBtn, padding: "8px 12px", fontSize: 12 }}>
          <Plus size={15} /> Misurazione
        </button>
      </div>

      {showAdd && (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 18, boxSizing: "border-box" }}>
          <h4 style={{ ...fontDisplay, fontSize: 16, color: C.accent, margin: "0 0 12px" }}>Nuovo Aggiornamento</h4>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 4 }}>
            <Field label="Data" type="date" value={date} onChange={setDate} />
            <Field label="Peso (kg)*" type="number" value={weight} onChange={setWeight} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 4 }}>
            <Field label="Vita (cm)" type="number" value={waist} onChange={setWaist} />
            <Field label="Petto (cm)" type="number" value={chest} onChange={setChest} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginBottom: 4 }}>
            <Field label="Fianchi (cm)" type="number" value={hips} onChange={setHips} />
          </div>

          <Field label="Note" value={notes} onChange={setNotes} />

          <div style={{ margin: "12px 0 16px" }}>
            <label style={{ ...fontMono, fontSize: 11, color: C.textDim, display: "block", marginBottom: 6 }}>FOTO</label>
            <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: "none" }} id="photo-upload" />
            <label htmlFor="photo-upload" style={{ ...secondaryBtn, display: "inline-flex", cursor: "pointer", fontSize: 12, padding: "10px 14px", width: "100%", justifyContent: "center" }}>
              <Camera size={16} /> {photoProcessing ? "Elaborazione..." : photo ? "Cambia Foto" : "Carica Foto"}
            </label>
            {photo && (
              <div style={{ marginTop: 10, position: "relative", width: 90, height: 90, margin: "10px auto 0" }}>
                <img src={photo} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10, border: `1px solid ${C.border}` }} />
                <button onClick={() => setPhoto(null)} style={{ position: "absolute", top: -8, right: -8, background: C.danger, border: "none", borderRadius: "50%", color: "#fff", width: 22, height: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X size={12} />
                </button>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={submitEntry} style={{ ...primaryBtn, flex: 1, fontSize: 13, padding: "12px" }}>Salva</button>
            <button onClick={() => setShowAdd(false)} style={{ ...secondaryBtn, flex: 1, fontSize: 13, padding: "12px", justifyContent: "center" }}>Annulla</button>
          </div>
        </div>
      )}

      {safeEntries.length === 0 ? (
        <div style={{ padding: 30, textAlign: "center", color: C.textDim, background: C.panel, borderRadius: 14, border: `1px solid ${C.border}` }}>
          <TrendingUp size={32} color={C.textDim} style={{ marginBottom: 8 }} />
          <p style={{ ...fontBody, fontSize: 13, margin: 0 }}>Nessuna misurazione registrata finora.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[...safeEntries].reverse().map((entry) => (
            <div key={entry.id || Math.random()} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              
              {/* Header card strutturato rigorosamente in colonna verticale per dispositivi mobili stretti */}
              <div style={{ display: "flex", flexDirection: "column", gap: 2, borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
                <span style={{ ...fontMono, fontSize: 11, color: C.textDim, fontWeight: 600, textTransform: "uppercase" }}>Data misurazione</span>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ ...fontBody, fontSize: 14, color: C.text, fontWeight: 600 }}>{fmtDate(entry.date)}</span>
                  <span style={{ ...fontDisplay, fontSize: 20, color: C.positive }}>
                    {entry.weight} <span style={{ fontSize: 13, fontWeight: "normal", color: C.textDim }}>kg</span>
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                {entry.photo && (
                  <img src={entry.photo} alt="Progress" style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 8, flexShrink: 0, border: `1px solid ${C.border}` }} />
                )}
                
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {entry.waist && (
                      <span style={{ background: C.panelHi, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 8px", fontSize: 11, ...fontMono, color: C.text }}>
                        Vita: <strong>{entry.waist}</strong> cm
                      </span>
                    )}
                    {entry.chest && (
                      <span style={{ background: C.panelHi, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 8px", fontSize: 11, ...fontMono, color: C.text }}>
                        Petto: <strong>{entry.chest}</strong> cm
                      </span>
                    )}
                    {entry.hips && (
                      <span style={{ background: C.panelHi, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 8px", fontSize: 11, ...fontMono, color: C.text }}>
                        Fianchi: <strong>{entry.hips}</strong> cm
                      </span>
                    )}
                  </div>

                  {entry.notes && (
                    <p style={{ ...fontBody, fontSize: 13, color: C.text, margin: 0, wordBreak: "break-word", background: C.panelHi, padding: 8, borderRadius: 6 }}>
                      {entry.notes}
                    </p>
                  )}
                </div>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// COMPONENTE APP PRINCIPALE
// ============================================================
export default function App() {
  const [session, setSession] = useState(undefined);
  const [role, setRole] = useState(null); 
  const [myClientRecord, setMyClientRecord] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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

    (async () => {
      let data = null;
      try {
        const res = await supabase
          .from('clients')
          .select('*')
          .eq('auth_user_id', session.user.id)
          .maybeSingle();
        data = res.data;

        if (!data) {
          const userEmail = session.user.email;
          const { data: clientByEmail } = await supabase
            .from('clients')
            .select('*')
            .eq('email', userEmail)
            .maybeSingle();

          if (clientByEmail) {
            const { data: updatedData } = await supabase
              .from('clients')
              .update({ auth_user_id: session.user.id })
              .eq('id', clientByEmail.id)
              .select()
              .single();

            if (updatedData) data = updatedData;
          }
        }

        if (data) {
          localStorage.setItem(`cache_client_profile_${session.user.id}`, JSON.stringify(data));
        }
      } catch (err) {
        console.warn("Offline mode: recupero profilo cliente dalla cache locale", err);
        const cached = localStorage.getItem(`cache_client_profile_${session.user.id}`);
        if (cached) data = JSON.parse(cached);
      }

      if (!data) {
        data = {
          auth_user_id: session.user.id,
          email: session.user.email,
          name: session.user.email.split('@')[0],
          intake: {}
        };
      }

      setRole("client");
      setMyClientRecord(data);
    })();
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <>
      {!isOnline && (
        <div style={{ background: C.danger, color: "#fff", textAlign: "center", padding: "6px", fontSize: 12, ...fontMono, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, position: "sticky", top: 0, zIndex: 9999 }}>
          <WifiOff size={14} /> SEI OFFLINE: Visualizzazione dei dati salvati in memoria locale.
        </div>
      )}

      {session === undefined ? (
        <div style={{ minHeight: "100vh", background: "#0f0f12", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ ...fontBody, color: C.textDim }}>Caricamento...</p>
        </div>
      ) : !session ? (
        <AuthScreen onLoggedIn={setSession} />
      ) : role === null ? (
        <div style={{ minHeight: "100vh", background: "#0f0f12", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ ...fontBody, color: C.textDim }}>Caricamento profilo...</p>
        </div>
      ) : role === "trainer" ? (
        <TrainerDashboard session={session} onLogout={handleLogout} />
      ) : (
        <ClientWorkspace
          client={myClientRecord}
          isTrainer={false}
          onBack={() => {}}
          onLogout={handleLogout}
        />
      )}
    </>
  );
}
