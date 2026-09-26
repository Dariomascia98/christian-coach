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
     auth_user_id (uuid, FK auth.users, nullable), name (text), intake (jsonb)
   - tabella "programs": id, client_id (FK clients), days (jsonb)
   - tabella "progress_entries": id, client_id, date, weight, waist,
     chest, hips, notes, photo (url o base64)
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
        <h1 style={{ ...fontDisplay, fontSize: 24, color: C.text, margin: "0 0 4px" }}>MISURA</h1>
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
// DASHBOARD TRAINER
// ============================================================
function TrainerDashboard({ session, onLogout }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
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
        body: JSON.stringify({ name: newClientName, email: newClientEmail })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Errore nella creazione del cliente.");
      setNewClientName("");
      setNewClientEmail("");
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
// WORKSPACE CLIENTE
// ============================================================
function ClientWorkspace({ client, isTrainer, siblingClients = [], onBack, onClientUpdated }) {
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
          {isTrainer && (
            <button onClick={onBack} style={secondaryBtn}>← Torna ai clienti</button>
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

// ---------- Program Section ----------
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
    const newBlock = { id: uid(), rounds: "3", restBetweenExercises: "", restAfterRound: "90''", exercises: [{ id: uid(), name: "", reps: "10-12", note: "", videoUrl: "" }] };
    patchDay(dayIdx, (day) => ({ ...day, blocks: [...(day.blocks || []), newBlock] }));
  };

  const deleteBlock = (dayIdx, blockIdx) => {
    patchDay(dayIdx, (day) => ({ ...day, blocks: day.blocks.filter((_, i) => i !== blockIdx) }));
  };

  const addExercise = (dayIdx, blockIdx) => {
    const newEx = { id: uid(), name: "", reps: "10", note: "", videoUrl: "" };
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
            {isTrainer ? "Nessun giorno di allenamento ancora creato. Clicca su Modifica per iniziare." : "Nessun programma ancora assegnato dal tuo trainer."}
          </p>
          {isTrainer && !isEditing && (
            <button onClick={() => setIsEditing(true)} style={{ ...primaryBtn, marginTop: 12 }}>
              <Plus size={16} /> Inizia a Creare Programma
            </button>
          )}
        </div>
      ) : currentDay ? (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            {isEditing ? (
              <input
                value={currentDay.label || ""}
                onChange={(e) => patchDay(activeDayIdx, (day) => ({ ...day, label: e.target.value }))}
                style={{ background: C.panelHi, border: `1px solid ${C.border}`, color: C.text, padding: "6px 10px", borderRadius: 6, ...fontDisplay, fontSize: 20 }}
              />
            ) : (
              <h2 style={{ ...fontDisplay, fontSize: 24, color: C.accent, margin: 0 }}>{currentDay.label}</h2>
            )}
            {isEditing && (
              <button onClick={() => deleteDay(activeDayIdx)} style={{ ...iconBtn, color: C.danger }}>
                <Trash2 size={16} />
              </button>
            )}
          </div>

          {(currentDay.blocks || []).length === 0 ? (
            <p style={{ color: C.textDim, fontSize: 13 }}>Nessun blocco di esercizi in questo giorno.</p>
          ) : (
            (currentDay.blocks || []).map((block, blockIdx) => (
              <div key={block.id || blockIdx} style={{ background: C.panelHi, borderRadius: 10, padding: 14, marginBottom: 14, border: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ ...fontMono, fontSize: 12, color: C.accent }}>BLOCCO {blockIdx + 1}</span>
                  {isEditing && (
                    <button onClick={() => deleteBlock(activeDayIdx, blockIdx)} style={{ ...iconBtn, color: C.danger }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                {(block.exercises || []).map((ex, exIdx) => (
                  <div key={ex.id || exIdx} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "center" }}>
                    {isEditing ? (
                      <>
                        <input
                          placeholder="Nome esercizio"
                          value={ex.name || ""}
                          onChange={(e) => patchExercise(activeDayIdx, blockIdx, exIdx, (item) => ({ ...item, name: e.target.value }))}
                          style={{ ...inputStyle, marginTop: 0, flex: 2 }}
                        />
                        <input
                          placeholder="Serie/Rip"
                          value={ex.reps || ""}
                          onChange={(e) => patchExercise(activeDayIdx, blockIdx, exIdx, (item) => ({ ...item, reps: e.target.value }))}
                          style={{ ...inputStyle, marginTop: 0, flex: 1 }}
                        />
                        <button onClick={() => deleteExercise(activeDayIdx, blockIdx, exIdx)} style={{ ...iconBtn, color: C.danger }}>
                          <Trash2 size={14} />
                        </button>
                      </>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                        <span style={{ color: C.text, fontSize: 14 }}>{ex.name || "Esercizio senza nome"}</span>
                        <span style={{ color: C.textDim, fontSize: 14, ...fontMono }}>{ex.reps}</span>
                      </div>
                    )}
                  </div>
                ))}
                {isEditing && (
                  <button onClick={() => addExercise(activeDayIdx, blockIdx)} style={{ ...secondaryBtn, fontSize: 12, padding: "4px 10px", marginTop: 4 }}>
                    <Plus size={13} /> Esercizio
                  </button>
                )}
              </div>
            ))
          )}

          {isEditing && (
            <button onClick={() => addBlock(activeDayIdx)} style={{ ...primaryBtn, marginTop: 10 }}>
              <Plus size={15} /> Aggiungi Blocco
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ---------- Progress Section (Placeholder) ----------
export function ProgressSection({ entries, onAdd }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
      <h3 style={{ ...fontDisplay, fontSize: 22, color: C.text, margin: "0 0 16px" }}>PROGRESSI</h3>
      {entries.length === 0 ? (
        <p style={{ color: C.textDim, fontSize: 14 }}>Nessuna misurazione registrata.</p>
      ) : (
        entries.map((en, idx) => (
          <div key={idx} style={{ padding: 10, background: C.panelHi, borderRadius: 8, marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
            <span>{fmtDate(en.date)}</span>
            <span>{en.weight ? `${en.weight} kg` : ""}</span>
          </div>
        ))
      )}
    </div>
  );
}

// ============================================================
// MAIN APP ROOT (Gestione Routing / Auth State)
// ============================================================
export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f0f12", display: "flex", alignItems: "center", justifyContent: "center", color: C.textDim }}>
        Caricamento in corso...
      </div>
    );
  }

  if (!session) {
    return <AuthScreen onLoggedIn={setSession} />;
  }

  return (
    <TrainerDashboard session={session} onLogout={() => supabase.auth.signOut()} />
  );
}
