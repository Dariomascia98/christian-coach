import React, { useState, useEffect, useCallback } from "react";
import {
  LogOut, Plus, Trash2, ChevronLeft, Dumbbell, TrendingUp, Camera,
  X, PlayCircle, Users as UsersIcon, Ruler, Check, ImageOff,
  ClipboardList, Copy, Printer, Edit2, Save
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { supabase, supabaseTemp } from "./supabaseClient";

// ---------- Design tokens ----------
const C = {
  bg: "#16181C",
  panel: "#1F2227",
  panelHi: "#262A31",
  border: "#33373E",
  text: "#F0EDE6",
  textDim: "#8B9099",
  accent: "#FF5A1F",
  accentSoft: "#4A2A1C",
  positive: "#34C793",
  ruler: "#4A4F58",
};

const fontDisplay = { fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.03em" };
const fontBody = { fontFamily: "'Inter', sans-serif" };
const fontMono = { fontFamily: "'JetBrains Mono', monospace" };

// ---------- Data layer (Supabase) ----------

function mapAuthError(error) {
  if (!error) return null;
  const msg = error.message || String(error);
  if (msg.includes("Invalid login credentials")) return "Username o password non corretti.";
  if (msg.includes("already registered") || msg.includes("already been registered")) return "Username già in uso.";
  return msg;
}

async function fetchProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) return null;
  return data;
}

async function fetchClients(trainerId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("created_by", trainerId)
    .eq("role", "client")
    .order("name");
  if (error) return [];
  return data;
}

async function fetchProgram(clientId) {
  const { data, error } = await supabase.from("programs").select("data").eq("client_id", clientId).maybeSingle();
  if (error || !data) return migrateProgram(null);
  return migrateProgram(data.data);
}

async function saveProgramRemote(clientId, program) {
  const { error } = await supabase
    .from("programs")
    .upsert({ client_id: clientId, data: program, updated_at: new Date().toISOString() });
  return !error;
}

async function fetchProgress(clientId) {
  const { data, error } = await supabase.from("progress").select("entries").eq("client_id", clientId).maybeSingle();
  if (error || !data) return [];
  return data.entries || [];
}

async function saveProgressRemote(clientId, entries) {
  const { error } = await supabase
    .from("progress")
    .upsert({ client_id: clientId, entries, updated_at: new Date().toISOString() });
  return !error;
}

async function loadLibrary(trainerId) {
  const { data, error } = await supabase.from("exercise_library").select("items").eq("trainer_id", trainerId).maybeSingle();
  if (error || !data) return [];
  return data.items || [];
}

async function saveLibrary(trainerId, items) {
  const { error } = await supabase
    .from("exercise_library")
    .upsert({ trainer_id: trainerId, items, updated_at: new Date().toISOString() });
  return !error;
}

async function loadLoads(clientId) {
  const { data, error } = await supabase.from("loads").select("data").eq("client_id", clientId).maybeSingle();
  if (error || !data) return {};
  return data.data || {};
}

async function saveLoads(clientId, loadsObj) {
  const { error } = await supabase
    .from("loads")
    .upsert({ client_id: clientId, data: loadsObj, updated_at: new Date().toISOString() });
  return !error;
}

async function fetchIntake(clientId) {
  const { data, error } = await supabase.from("intake").select("data").eq("client_id", clientId).maybeSingle();
  if (error || !data) return {};
  return data.data || {};
}

async function saveIntakeRemote(clientId, intake) {
  const { error } = await supabase
    .from("intake")
    .upsert({ client_id: clientId, data: intake, updated_at: new Date().toISOString() });
  return !error;
}

async function getAccessToken() {
  // Tenta prima di ottenere la sessione attuale
  const { data: { session }, error } = await supabase.auth.getSession();
  
  // Se non c'è sessione o c'è un errore, tenta il refresh del token
  if (error || !session) {
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshData?.session) {
      return null;
    }
    return refreshData.session.access_token;
  }
  
  return session.access_token;
}


async function callServerFunction(path, body) {
  const token = await getAccessToken();
  if (!token) return { ok: false, error: "Sessione scaduta, rientra e riprova." };
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json.error || "Errore del server." };
    return { ok: true, data: json };
  } catch (e) {
    return { ok: false, error: e?.message || "Errore di rete." };
  }
}

function exKey(name) {
  return (name || "").trim().toLowerCase();
}

const WEEKDAYS = [
  { code: "LU", label: "Lun" },
  { code: "MA", label: "Mar" },
  { code: "ME", label: "Mer" },
  { code: "GI", label: "Gio" },
  { code: "VE", label: "Ven" },
  { code: "SA", label: "Sab" },
  { code: "DO", label: "Dom" },
];

function todayCode() {
  const map = ["DO", "LU", "MA", "ME", "GI", "VE", "SA"];
  return map[new Date().getDay()];
}

function migrateProgram(raw) {
  if (!raw) return { days: [], updatedAt: null };
  const days = (raw.days || []).map((day) => {
    if (day.blocks) return { ...day, weekdays: day.weekdays || [] };
    const blocks = (day.exercises || []).map((ex) => ({
      id: ex.id || uid(),
      rounds: ex.sets || "",
      restBetweenExercises: "",
      restAfterRound: ex.rest || "",
      exercises: [{ id: uid(), name: ex.name || "", reps: ex.reps || "", note: ex.note || "", videoUrl: ex.videoUrl || "" }],
    }));
    return { id: day.id, label: day.label, weekdays: day.weekdays || [], blocks };
  });
  return { ...raw, days };
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function resizeImage(file, maxWidth = 480, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getYouTubeEmbed(url) {
  if (!url) return null;
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return `https://www.youtube.com/embed/${m[1]}`;
  }
  return null;
}

function fmtDate(d) {
  try {
    return new Date(d).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
  } catch (e) {
    return d;
  }
}

// ---------- Signature element: tape-measure divider ----------
function TapeDivider({ label }) {
  return (
    <div style={{ margin: "24px 0 16px" }}>
      {label && (
        <div style={{ ...fontMono, fontSize: 11, color: C.textDim, letterSpacing: "0.15em", marginBottom: 6 }}>
          {label.toUpperCase()}
        </div>
      )}
      <div
        style={{
          height: 12,
          backgroundImage: `repeating-linear-gradient(90deg, ${C.ruler} 0px, ${C.ruler} 1px, transparent 1px, transparent 8px),
                            repeating-linear-gradient(90deg, ${C.ruler} 0px, ${C.ruler} 1px, transparent 1px, transparent 40px)`,
          backgroundSize: "8px 5px, 40px 10px",
          backgroundPosition: "left top, left bottom",
          backgroundRepeat: "repeat-x",
          borderBottom: `1px solid ${C.border}`,
          opacity: 0.8,
        }}
      />
    </div>
  );
}

// ---------- Video modal ----------
function VideoModal({ url, onClose }) {
  const embed = getYouTubeEmbed(url);
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, borderRadius: 12, padding: 16, maxWidth: 640, width: "100%", border: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <button onClick={onClose} style={{ color: C.textDim, background: "none", border: "none", cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>
        {embed ? (
          <div style={{ position: "relative", paddingTop: "56.25%" }}>
            <iframe
              src={embed}
              title="Esecuzione esercizio"
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", borderRadius: 8, border: "none" }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: 24 }}>
            <p style={{ ...fontBody, color: C.text, marginBottom: 12 }}>Video non incorporabile direttamente.</p>
            <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: C.accent, ...fontBody, textDecoration: "underline" }}>
              Apri il video in un'altra scheda
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Load tracker modal ----------
function LoadModal({ exerciseName, clientId, onClose }) {
  const key = exKey(exerciseName);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), weight: "", reps: "", sets: "" });

  useEffect(() => {
    (async () => {
      const all = await loadLoads(clientId);
      setEntries(all[key] || []);
      setLoading(false);
    })();
  }, [clientId, key]);

  const submit = async () => {
    if (!form.weight) return;
    const newEntry = { id: uid(), date: form.date, weight: parseFloat(form.weight), reps: form.reps, sets: form.sets };
    const all = await loadLoads(clientId);
    const updatedForThis = [...(all[key] || []), newEntry].sort((a, b) => new Date(a.date) - new Date(b.date));
    const updatedAll = { ...all, [key]: updatedForThis };
    await saveLoads(clientId, updatedAll);
    setEntries(updatedForThis);
    setForm({ date: new Date().toISOString().slice(0, 10), weight: "", reps: "", sets: "" });
  };

  const chartData = entries.map((e) => ({ date: fmtDate(e.date), carico: e.weight }));

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, borderRadius: 12, padding: 18, maxWidth: 480, width: "100%", border: `1px solid ${C.border}`, maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ ...fontDisplay, fontSize: 20, color: C.text, margin: 0 }}>{exerciseName}</h3>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>

        {loading ? (
          <p style={{ ...fontBody, color: C.textDim, fontSize: 13 }}>Caricamento...</p>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
              <Field label="Data" value={form.date} onChange={(v) => setForm({ ...form, date: v })} type="date" />
              <Field label="Kg" value={form.weight} onChange={(v) => setForm({ ...form, weight: v })} type="number" />
              <Field label="Rip." value={form.reps} onChange={(v) => setForm({ ...form, reps: v })} />
              <Field label="Serie" value={form.sets} onChange={(v) => setForm({ ...form, sets: v })} />
            </div>
            <button onClick={submit} style={{ ...primaryBtn, marginBottom: 18 }}>Registra carico</button>

            {entries.length === 0 ? (
              <p style={{ ...fontBody, color: C.textDim, fontSize: 13 }}>Nessun carico registrato ancora per questo esercizio.</p>
            ) : (
              <>
                <div style={{ height: 160, marginBottom: 14 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fill: C.textDim, fontSize: 10 }} />
                      <YAxis tick={{ fill: C.textDim, fontSize: 10 }} domain={["auto", "auto"]} />
                      <Tooltip contentStyle={{ background: C.panelHi, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text }} />
                      <Line type="monotone" dataKey="carico" stroke={C.positive} strokeWidth={2} dot={{ r: 3 }} name="Carico (kg)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[...entries].reverse().map((e) => (
                    <div key={e.id} style={{ display: "flex", justifyContent: "space-between", background: C.panelHi, borderRadius: 8, padding: "8px 10px" }}>
                      <span style={{ ...fontBody, fontSize: 12, color: C.textDim }}>{fmtDate(e.date)}</span>
                      <span style={{ ...fontMono, fontSize: 12, color: C.text }}>
                        {e.weight}kg {e.sets && `· ${e.sets}x`}{e.reps && `${e.reps}`}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------- Welcome / landing screen ----------
function WelcomeScreen({ onGoLogin, onGoSetup }) {
  return (
    <div style={wrapStyle}>
      <FontImport />
      <div style={centerCard}>
        <Logo />
        <TapeDivider label="Benvenuto" />
        <p style={{ ...fontBody, color: C.textDim, fontSize: 14, marginBottom: 24, lineHeight: "1.5" }}>
          Gestisci i tuoi clienti, i loro programmi e i loro progressi in un unico posto.
        </p>
        <button onClick={onGoLogin} style={primaryBtn}>Accedi</button>
        <button onClick={onGoSetup} style={{ ...secondaryBtn, width: "100%", justifyContent: "center", marginTop: 10 }}>
          Crea un account trainer
        </button>
      </div>
    </div>
  );
}

// ---------- Setup screen ----------
function SetupScreen({ onSubmit, onBack }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim() || !username.trim() || !password.trim()) {
      setError("Compila tutti i campi.");
      return;
    }
    setBusy(true);
    setError("");
    onSubmit({ name: name.trim(), username: username.trim(), password }, (err) => {
      setBusy(false);
      if (err) setError(err);
    });
  };

  return (
    <div style={wrapStyle}>
      <FontImport />
      <div style={centerCard}>
        <Logo />
        <TapeDivider label="Nuovo account" />
        <h2 style={{ ...fontDisplay, fontSize: 26, color: C.text, marginBottom: 4 }}>Crea il tuo account trainer</h2>
        <p style={{ ...fontBody, color: C.textDim, fontSize: 14, marginBottom: 20 }}>
          Questo sarà il tuo accesso principale per gestire i clienti.
        </p>
        <Field label="Nome e cognome" value={name} onChange={setName} />
        <Field label="Username" value={username} onChange={setUsername} />
        <Field label="Password" value={password} onChange={setPassword} type="password" />
        {error && <p style={{ color: C.accent, ...fontBody, fontSize: 13, marginTop: 4 }}>{error}</p>}
        <button onClick={submit} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.7 : 1 }}>
          {busy ? "Attendere..." : <>Crea account <Check size={16} /></>}
        </button>
        <button onClick={onBack} style={{ ...secondaryBtn, width: "100%", justifyContent: "center", marginTop: 10, border: "none" }}>
          ← Torna indietro
        </button>
      </div>
    </div>
  );
}

// ---------- Login screen ----------
function LoginScreen({ onSubmit, onBack }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = () => {
    if (!username.trim() || !password.trim()) {
      setError("Inserisci username e password.");
      return;
    }
    setBusy(true);
    setError("");
    onSubmit({ username: username.trim(), password }, (err) => {
      setBusy(false);
      if (err) setError(err);
    });
  };

  return (
    <div style={wrapStyle}>
      <FontImport />
      <div style={centerCard}>
        <Logo />
        <TapeDivider label="Accedi" />
        <Field label="Username / Email" value={username} onChange={setUsername} />
        <Field label="Password" value={password} onChange={setPassword} type="password" onEnter={submit} />
        {error && <p style={{ color: C.accent, ...fontBody, fontSize: 13, marginTop: 4 }}>{error}</p>}
        <button onClick={submit} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.7 : 1 }}>
          {busy ? "Verifica in corso..." : "Entra"}
        </button>
        <button onClick={onBack} style={{ ...secondaryBtn, width: "100%", justifyContent: "center", marginTop: 10, border: "none" }}>
          ← Torna indietro
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", onEnter }) {
  return (
    <div style={{ marginBottom: 14, textAlign: "left" }}>
      <label style={{ ...fontMono, fontSize: 11, color: C.textDim, letterSpacing: "0.1em" }}>{label.toUpperCase()}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && onEnter) onEnter(); }}
        style={{
          display: "block", width: "100%", marginTop: 6, padding: "10px 12px",
          background: C.panelHi, border: `1px solid ${C.border}`, borderRadius: 8,
          color: C.text, ...fontBody, fontSize: 14, outline: "none", boxSizing: "border-box"
        }}
      />
    </div>
  );
}

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
      <Ruler size={24} color={C.accent} />
      <h1 style={{ ...fontDisplay, fontSize: 40, color: C.text, margin: 0, lineHeight: 1 }}>CHRIS_COACH</h1>
    </div>
  );
}

function FontImport() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
      *:focus-visible { outline: 2px solid ${C.accent}; outline-offset: 2px; }
      input::placeholder { color: ${C.textDim}; }

      @media print {
        .no-print { display: none !important; }
        .print-only { display: block !important; }
        body, #root, #root * {
          background: #ffffff !important;
          color: #111111 !important;
          border-color: #cccccc !important;
          box-shadow: none !important;
        }
        #root { padding: 0 !important; }
      }
    `}</style>
  );
}

const wrapStyle = { minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, boxSizing: "border-box" };
const centerCard = { width: "100%", maxWidth: 380, textAlign: "center" };
const primaryBtn = {
  width: "100%", marginTop: 8, padding: "12px 16px", background: C.accent, color: "#1A0D06",
  border: "none", borderRadius: 8, ...fontBody, fontWeight: 700, fontSize: 14, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxSizing: "border-box"
};
const secondaryBtn = {
  padding: "9px 14px", background: "transparent", color: C.text, border: `1px solid ${C.border}`,
  borderRadius: 8, ...fontBody, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, boxSizing: "border-box"
};
const iconBtn = { background: "none", border: "none", color: C.textDim, cursor: "pointer", padding: 6, display: "inline-flex", alignItems: "center", justifyContent: "center" };

// ---------- Trainer dashboard ----------
function TrainerDashboard({ trainer, clients, onSelectClient, onAddClient, onDeleteClient, onLogout }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", username: "", password: "" });
  const [error, setError] = useState("");

  const submit = () => {
    if (!form.name.trim() || !form.username.trim() || !form.password.trim()) {
      setError("Compila tutti i campi.");
      return;
    }
    onAddClient(form, (err) => {
      if (err) setError(err);
      else {
        setForm({ name: "", username: "", password: "" });
        setShowAdd(false);
        setError("");
      }
    });
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <FontImport />
      <Header title={`Ciao, ${trainer.name}`} subtitle="Dashboard trainer" onLogout={onLogout} />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 20px 60px" }}>
        <TapeDivider label={`${clients.length} clienti`} />

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
          <button style={primaryBtn2} onClick={() => setShowAdd((s) => !s)}>
            <Plus size={16} /> Nuovo cliente
          </button>
        </div>

        {showAdd && (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
            <Field label="Nome cliente" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field label="Username / Email" value={form.username} onChange={(v) => setForm({ ...form, username: v })} />
            <Field label="Password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} type="password" />
            {error && <p style={{ color: C.accent, fontSize: 13, ...fontBody }}>{error}</p>}
            <button style={primaryBtn} onClick={submit}>Aggiungi cliente</button>
          </div>
        )}

        {clients.length === 0 ? (
          <EmptyState icon={<UsersIcon size={28} color={C.textDim} />} text="Nessun cliente ancora. Aggiungine uno per iniziare a monitorare i suoi allenamenti." />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
            {clients.map((c) => (
              <div key={c.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, position: "relative" }}>
                <button
                  onClick={(e) => { e.stopPropagation(); if (window.confirm(`Eliminare ${c.name}? Questa azione è permanente.`)) onDeleteClient(c.id); }}
                  style={{ ...iconBtn, position: "absolute", top: 10, right: 10 }}
                  aria-label="Elimina cliente"
                >
                  <Trash2 size={16} />
                </button>
                <div onClick={() => onSelectClient(c.id)} style={{ cursor: "pointer" }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: C.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                    <span style={{ ...fontDisplay, color: C.accent, fontSize: 18 }}>{c.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <p style={{ ...fontBody, fontWeight: 600, color: C.text, marginBottom: 2 }}>{c.name}</p>
                  <p style={{ ...fontMono, fontSize: 12, color: C.textDim }}>@{c.username}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const primaryBtn2 = { ...primaryBtn, width: "auto", marginTop: 0 };

function Header({ title, subtitle, onBack, onLogout }) {
  return (
    <div style={{ borderBottom: `1px solid ${C.border}`, padding: "16px 20px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {onBack && (
            <button onClick={onBack} style={iconBtn} aria-label="Torna indietro">
              <ChevronLeft size={22} />
            </button>
          )}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Ruler size={16} color={C.accent} />
              <span style={{ ...fontDisplay, fontSize: 18, color: C.text, letterSpacing: "0.05em" }}>CHRIS_COACH</span>
            </div>
            <p style={{ ...fontBody, fontSize: 13, color: C.textDim, margin: 0 }}>{subtitle}</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ ...fontBody, fontSize: 13, color: C.text }}>{title}</span>
          <button onClick={onLogout} style={iconBtn} aria-label="Esci">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div style={{ textAlign: "center", padding: "50px 20px", border: `1px dashed ${C.border}`, borderRadius: 12 }}>
      <div style={{ marginBottom: 10, display: "flex", justifyContent: "center" }}>{icon}</div>
      <p style={{ ...fontBody, color: C.textDim, fontSize: 14, maxWidth: 320, margin: "0 auto" }}>{text}</p>
    </div>
  );
}

// ---------- Client workspace ----------
function ClientWorkspace({ client, isTrainer, viewerId, siblingClients, onBack, onLogout }) {
  const [tab, setTab] = useState("anamnesi");
  const [program, setProgram] = useState(null);
  const [progress, setProgress] = useState([]);
  const [intake, setIntake] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const p = await fetchProgram(client.id);
    const pr = await fetchProgress(client.id);
    const ik = await fetchIntake(client.id);
    setProgram(p);
    setProgress(pr);
    setIntake(ik);
    setLoading(false);
  }, [client.id]);

  useEffect(() => { load(); }, [load]);

  const saveProgram = async (newProgram) => {
    const withMeta = { ...newProgram, updatedAt: new Date().toISOString() };
    setProgram(withMeta);
    await saveProgramRemote(client.id, withMeta);
  };

  const addProgressEntry = async (entry) => {
    const updated = [...progress, entry].sort((a, b) => new Date(a.date) - new Date(b.date));
    setProgress(updated);
    await saveProgressRemote(client.id, updated);
  };

  const saveIntake = async (newIntake) => {
    setIntake(newIntake);
    await saveIntakeRemote(client.id, newIntake);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <FontImport />
      <div className="no-print">
        <Header
          title={isTrainer ? client.name : `Ciao, ${client.name}`}
          subtitle={isTrainer ? "Scheda cliente" : "Il tuo percorso"}
          onBack={isTrainer ? onBack : undefined}
          onLogout={onLogout}
        />
      </div>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 20px 60px" }}>
        <div className="no-print" style={{ display: "flex", gap: 8, marginTop: 20, marginBottom: 6, flexWrap: "wrap" }}>
          <TabBtn active={tab === "anamnesi"} onClick={() => setTab("anamnesi")} icon={<ClipboardList size={15} />} label="Anamnesi" />
          <TabBtn active={tab === "programma"} onClick={() => setTab("programma")} icon={<Dumbbell size={15} />} label="Programma" />
          <TabBtn active={tab === "progressi"} onClick={() => setTab("progressi")} icon={<TrendingUp size={15} />} label="Progressi" />
        </div>
        <div className="no-print"><TapeDivider /></div>

        {loading ? (
          <p style={{ ...fontBody, color: C.textDim }}>Caricamento...</p>
        ) : tab === "anamnesi" ? (
          <IntakeSection intake={intake} isTrainer={isTrainer} onSave={saveIntake} />
        ) : tab === "programma" ? (
          <ProgramSection
            program={program}
            isTrainer={isTrainer}
            clientId={client.id}
            clientName={client.name}
            trainerId={viewerId}
            siblingClients={siblingClients}
            onSave={saveProgram}
          />
        ) : (
          <ProgressSection entries={progress} onAdd={addProgressEntry} />
        )}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8,
        border: `1px solid ${active ? C.accent : C.border}`, background: active ? C.accentSoft : "transparent",
        color: active ? C.accent : C.textDim, ...fontBody, fontSize: 13, fontWeight: 600, cursor: "pointer",
      }}
    >
      {icon} {label}
    </button>
  );
}

// ---------- Intake section ----------
const ACTIVITY_LEVELS = [
  { value: "sedentario", label: "Sedentario", mult: 1.2 },
  { value: "leggero", label: "Leggero (1-3 giorni/sett.)", mult: 1.375 },
  { value: "moderato", label: "Moderato (3-5 giorni/sett.)", mult: 1.55 },
  { value: "intenso", label: "Intenso (6-7 giorni/sett.)", mult: 1.725 },
  { value: "molto_intenso", label: "Molto intenso (atleta/lavoro fisico)", mult: 1.9 },
];

function calcBmrTdee({ sex, age, heightCm, weightKg, activityLevel }) {
  const a = parseFloat(age), h = parseFloat(heightCm), w = parseFloat(weightKg);
  if (!a || !h || !w) return null;
  const bmr = sex === "F" ? 10 * w + 6.25 * h - 5 * a - 161 : 10 * w + 6.25 * h - 5 * a + 5;
  const level = ACTIVITY_LEVELS.find((l) => l.value === activityLevel) || ACTIVITY_LEVELS[1];
  return { bmr: Math.round(bmr), tdee: Math.round(bmr * level.mult) };
}

function IntakeSection({ intake, isTrainer, onSave }) {
  const [editing, setEditing] = useState(isTrainer && !intake?.goal);
  const [form, setForm] = useState({
    birthDate: intake.birthDate || "",
    sex: intake.sex || "M",
    heightCm: intake.heightCm || "",
    startingWeight: intake.startingWeight || "",
    activityLevel: intake.activityLevel || "moderato",
    goal: intake.goal || "",
    injuries: intake.injuries || "",
    notes: intake.notes || "",
  });

  useEffect(() => {
    setForm({
      birthDate: intake.birthDate || "",
      sex: intake.sex || "M",
      heightCm: intake.heightCm || "",
      startingWeight: intake.startingWeight || "",
      activityLevel: intake.activityLevel || "moderato",
      goal: intake.goal || "",
      injuries: intake.injuries || "",
      notes: intake.notes || "",
    });
  }, [intake]);

  const calcAge = (dob) => {
    if (!dob) return "";
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
  };

  const age = calcAge(form.birthDate);
  const metrics = calcBmrTdee({ ...form, age });

  const submit = async () => {
    await onSave(form);
    setEditing(false);
  };

  if (!editing && (intake.goal || intake.startingWeight || intake.birthDate)) {
    return (
      <div>
        {isTrainer && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button onClick={() => setEditing(true)} style={secondaryBtn}>
              <Edit2 size={15} /> Modifica Anamnesi
            </button>
          </div>
        )}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16, marginBottom: 16 }}>
            <div><p style={{ ...fontMono, fontSize: 11, color: C.textDim }}>ETÀ</p><p style={{ ...fontBody, color: C.text, fontWeight: 600 }}>{age ? `${age} anni` : "-"}</p></div>
            <div><p style={{ ...fontMono, fontSize: 11, color: C.textDim }}>SESSO</p><p style={{ ...fontBody, color: C.text, fontWeight: 600 }}>{intake.sex === "F" ? "Femmina" : "Maschio"}</p></div>
            <div><p style={{ ...fontMono, fontSize: 11, color: C.textDim }}>ALTEZZA</p><p style={{ ...fontBody, color: C.text, fontWeight: 600 }}>{intake.heightCm ? `${intake.heightCm} cm` : "-"}</p></div>
            <div><p style={{ ...fontMono, fontSize: 11, color: C.textDim }}>PESO INIZIALE</p><p style={{ ...fontBody, color: C.text, fontWeight: 600 }}>{intake.startingWeight ? `${intake.startingWeight} kg` : "-"}</p></div>
          </div>

          {metrics && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, background: C.panelHi, padding: 12, borderRadius: 8, marginBottom: 16 }}>
              <div><p style={{ ...fontMono, fontSize: 11, color: C.textDim }}>BMR ESTIMATO</p><p style={{ ...fontDisplay, fontSize: 20, color: C.accent }}>{metrics.bmr} kcal</p></div>
              <div><p style={{ ...fontMono, fontSize: 11, color: C.textDim }}>TDEE ESTIMATO</p><p style={{ ...fontDisplay, fontSize: 20, color: C.positive }}>{metrics.tdee} kcal</p></div>
            </div>
          )}

          {intake.goal && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ ...fontMono, fontSize: 11, color: C.textDim }}>OBIETTIVO</p>
              <p style={{ ...fontBody, color: C.text }}>{intake.goal}</p>
            </div>
          )}
          {intake.injuries && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ ...fontMono, fontSize: 11, color: C.textDim }}>INFORTUNI / LIMITAZIONI</p>
              <p style={{ ...fontBody, color: C.text }}>{intake.injuries}</p>
            </div>
          )}
          {intake.notes && (
            <div>
              <p style={{ ...fontMono, fontSize: 11, color: C.textDim }}>NOTE EXTRA</p>
              <p style={{ ...fontBody, color: C.text }}>{intake.notes}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!isTrainer) {
    return <EmptyState icon={<ClipboardList size={28} color={C.textDim} />} text="Anamnesi non ancora compilata dal tuo trainer." />;
  }

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
      <h3 style={{ ...fontDisplay, fontSize: 22, color: C.text, marginBottom: 16 }}>Compila Anamnesi</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Data di nascita" type="date" value={form.birthDate} onChange={(v) => setForm({ ...form, birthDate: v })} />
        <div style={{ marginBottom: 14 }}>
          <label style={{ ...fontMono, fontSize: 11, color: C.textDim, letterSpacing: "0.1em" }}>SESSO</label>
          <select
            value={form.sex}
            onChange={(e) => setForm({ ...form, sex: e.target.value })}
            style={{ display: "block", width: "100%", marginTop: 6, padding: "10px 12px", background: C.panelHi, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, ...fontBody, fontSize: 14 }}
          >
            <option value="M">Maschio</option>
            <option value="F">Femmina</option>
          </select>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Altezza (cm)" type="number" value={form.heightCm} onChange={(v) => setForm({ ...form, heightCm: v })} />
        <Field label="Peso Iniziale (kg)" type="number" value={form.startingWeight} onChange={(v) => setForm({ ...form, startingWeight: v })} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ ...fontMono, fontSize: 11, color: C.textDim, letterSpacing: "0.1em" }}>LIVELLO ATTIVITÀ</label>
        <select
          value={form.activityLevel}
          onChange={(e) => setForm({ ...form, activityLevel: e.target.value })}
          style={{ display: "block", width: "100%", marginTop: 6, padding: "10px 12px", background: C.panelHi, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, ...fontBody, fontSize: 14 }}
        >
          {ACTIVITY_LEVELS.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>
      </div>

      <Field label="Obiettivo Principale" value={form.goal} onChange={(v) => setForm({ ...form, goal: v })} />
      <Field label="Infortuni / Limitazioni Fisiche" value={form.injuries} onChange={(v) => setForm({ ...form, injuries: v })} />
      <Field label="Note aggiuntive" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />

      <button onClick={submit} style={primaryBtn}><Save size={16} /> Salva Anamnesi</button>
    </div>
  );
}

// ---------- Main Program Section Component ----------
function ProgramSection({ program, isTrainer, clientId, clientName, trainerId, siblingClients, onSave }) {
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [videoModalUrl, setVideoModalUrl] = useState(null);
  const [loadModalEx, setLoadModalEx] = useState(null);

  const days = program?.days || [];

  const handleUpdateDays = (newDays) => {
    onSave({ ...program, days: newDays });
  };

  const addDay = () => {
    const newDay = { id: uid(), label: `Giorno ${days.length + 1}`, weekdays: [], blocks: [] };
    handleUpdateDays([...days, newDay]);
    setActiveDayIdx(days.length);
  };

  const removeDay = (idx) => {
    const updated = days.filter((_, i) => i !== idx);
    handleUpdateDays(updated);
    if (activeDayIdx >= updated.length) setActiveDayIdx(Math.max(0, updated.length - 1));
  };

  const currentDay = days[activeDayIdx];

  return (
    <div>
      {/* Visualizzazione / Gestione Giorni */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 16 }}>
        {days.map((d, idx) => (
          <button
            key={d.id}
            onClick={() => setActiveDayIdx(idx)}
            style={{
              padding: "8px 14px", borderRadius: 8,
              border: `1px solid ${activeDayIdx === idx ? C.accent : C.border}`,
              background: activeDayIdx === idx ? C.accentSoft : C.panel,
              color: activeDayIdx === idx ? C.accent : C.text,
              ...fontBody, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap"
            }}
          >
            {d.label}
          </button>
        ))}
        {isTrainer && (
          <button onClick={addDay} style={{ ...secondaryBtn, whiteSpace: "nowrap" }}>
            <Plus size={14} /> Giorno
          </button>
        )}
      </div>

      {days.length === 0 ? (
        <EmptyState icon={<Dumbbell size={28} color={C.textDim} />} text="Nessun giorno di allenamento creato." />
      ) : currentDay ? (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ ...fontDisplay, fontSize: 24, color: C.text, margin: 0 }}>{currentDay.label}</h3>
            {isTrainer && (
              <button onClick={() => removeDay(activeDayIdx)} style={{ ...iconBtn, color: C.accent }}>
                <Trash2 size={18} />
              </button>
            )}
          </div>

          {/* Render Blocchi Esercizio */}
          {(currentDay.blocks || []).map((block, bIdx) => (
            <div key={block.id} style={{ background: C.panelHi, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ ...fontMono, fontSize: 12, color: C.accent, fontWeight: 600 }}>BLOCCO #{bIdx + 1}</span>
                <span style={{ ...fontMono, fontSize: 12, color: C.textDim }}>Giri/Serie: {block.rounds || "-"}</span>
              </div>
              {(block.exercises || []).map((ex) => (
                <div key={ex.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderTop: `1px dashed ${C.border}` }}>
                  <div>
                    <span style={{ ...fontBody, color: C.text, fontWeight: 500 }}>{ex.name}</span>
                    {ex.reps && <span style={{ ...fontMono, fontSize: 12, color: C.textDim, marginLeft: 8 }}>({ex.reps})</span>}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {ex.videoUrl && (
                      <button onClick={() => setVideoModalUrl(ex.videoUrl)} style={iconBtn}>
                        <PlayCircle size={16} color={C.accent} />
                      </button>
                    )}
                    <button onClick={() => setLoadModalEx(ex.name)} style={iconBtn}>
                      <TrendingUp size={16} color={C.positive} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      {videoModalUrl && <VideoModal url={videoModalUrl} onClose={() => setVideoModalUrl(null)} />}
      {loadModalEx && <LoadModal exerciseName={loadModalEx} clientId={clientId} onClose={() => setLoadModalEx(null)} />}
    </div>
  );
}

// ---------- Progress Section Component ----------
function ProgressSection({ entries, onAdd }) {
  const [weight, setWeight] = useState("");
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const resized = await resizeImage(file);
      setPhoto(resized);
    } catch (err) {
      console.error(err);
    }
  };

  const submit = async () => {
    if (!weight && !photo) return;
    setBusy(true);
    await onAdd({
      id: uid(),
      date: new Date().toISOString().slice(0, 10),
      weight: weight ? parseFloat(weight) : null,
      photo,
    });
    setWeight("");
    setPhoto(null);
    setBusy(false);
  };

  const chartData = entries.filter((e) => e.weight).map((e) => ({ date: fmtDate(e.date), peso: e.weight }));

  return (
    <div>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
        <h3 style={{ ...fontDisplay, fontSize: 20, color: C.text, marginBottom: 12 }}>Registra un nuovo progresso</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <Field label="Peso corporeo (kg)" type="number" value={weight} onChange={setWeight} />
          <div>
            <label style={{ ...fontMono, fontSize: 11, color: C.textDim, letterSpacing: "0.1em" }}>FOTO PROGRESSO</label>
            <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: "block", marginTop: 6, color: C.textDim, fontSize: 12 }} />
          </div>
        </div>
        <button onClick={submit} disabled={busy} style={primaryBtn}>
          {busy ? "Salvataggio..." : "Salva progresso"}
        </button>
      </div>

      {chartData.length > 0 && (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
          <h4 style={{ ...fontDisplay, fontSize: 18, color: C.text, marginBottom: 12 }}>Andamento Peso</h4>
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: C.textDim, fontSize: 11 }} />
                <YAxis tick={{ fill: C.textDim, fontSize: 11 }} domain={["auto", "auto"]} />
                <Tooltip contentStyle={{ background: C.panelHi, border: `1px solid ${C.border}`, color: C.text }} />
                <Line type="monotone" dataKey="peso" stroke={C.accent} strokeWidth={2} dot={{ r: 4 }} name="Peso (kg)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Lista Progressi */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
        {[...entries].reverse().map((e) => (
          <div key={e.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
            <p style={{ ...fontMono, fontSize: 11, color: C.textDim }}>{fmtDate(e.date)}</p>
            {e.weight && <p style={{ ...fontDisplay, fontSize: 22, color: C.text, margin: "4px 0" }}>{e.weight} kg</p>}
            {e.photo ? (
              <img src={e.photo} alt="Progresso" style={{ width: "100%", borderRadius: 6, marginTop: 6, objectFit: "cover" }} />
            ) : (
              <div style={{ height: 60, background: C.panelHi, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 6 }}>
                <ImageOff size={18} color={C.textDim} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Main App Root ----------
export default function App() {
  const [screen, setScreen] = useState("welcome"); // welcome | setup | login | main
  const [currentUser, setCurrentUser] = useState(null);
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Auto-restore session
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        const prof = await fetchProfile(data.session.user.id);
        if (prof) {
          setCurrentUser(prof);
          setScreen("main");
        }
      }
      setLoadingSession(false);
    })();
  }, []);

  // Sync clients when user is trainer
  const refreshClients = useCallback(async () => {
    if (currentUser?.role === "trainer") {
      const list = await fetchClients(currentUser.id);
      setClients(list);
    }
  }, [currentUser]);

  useEffect(() => {
    refreshClients();
  }, [refreshClients]);

  const handleSetup = async ({ name, username, password }, callback) => {
    // Registrazione senza dominio fittizio
    const { data: authData, error: authErr } = await supabase.auth.signUp({
  email: username.trim(),
  password,
});

    if (authErr) {
      callback(mapAuthError(authErr));
      return;
    }

    if (!authData?.user) {
      callback("Errore durante la creazione del profilo.");
      return;
    }

    const { error: profErr } = await supabase.from("profiles").insert({
      id: authData.user.id,
      name,
      username: username.trim(),
      role: "trainer",
    });

    if (profErr) {
      callback("Errore durante il salvataggio del profilo.");
      return;
    }

    const prof = await fetchProfile(authData.user.id);
    setCurrentUser(prof);
    setScreen("main");
    callback(null);
  };

  const handleLogin = async ({ username, password }, callback) => {
    // Login diretto senza aggiungere @misura.local
    const { data, error } = await supabase.auth.signInWithPassword({
      email: username.trim(),
      password,
    });

    if (error) {
      callback(mapAuthError(error));
      return;
    }

    const prof = await fetchProfile(data.user.id);
    if (!prof) {
      callback("Profilo utente non trovato.");
      return;
    }

    setCurrentUser(prof);
    setScreen("main");
    callback(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setSelectedClientId(null);
    setScreen("welcome");
  };

  const handleAddClient = async ({ name, username, password }, callback) => {
    const res = await callServerFunction("/api/create-client", {
      name,
      username: username.trim(),
      password,
    });

    if (!res.ok) {
      callback(res.error);
      return;
    }

    await refreshClients();
    callback(null);
  };

  const handleDeleteClient = async (clientId) => {
    const { error } = await supabase.from("profiles").delete().eq("id", clientId);
    if (!error) {
      setClients((prev) => prev.filter((c) => c.id !== clientId));
      if (selectedClientId === clientId) setSelectedClientId(null);
    }
  };

  if (loadingSession) {
    return (
      <div style={wrapStyle}>
        <FontImport />
        <p style={{ ...fontBody, color: C.textDim }}>Caricamento in corso...</p>
      </div>
    );
  }

  if (screen === "welcome") return <WelcomeScreen onGoLogin={() => setScreen("login")} onGoSetup={() => setScreen("setup")} />;
  if (screen === "setup") return <SetupScreen onSubmit={handleSetup} onBack={() => setScreen("welcome")} />;
  if (screen === "login") return <LoginScreen onSubmit={handleLogin} onBack={() => setScreen("welcome")} />;

  if (screen === "main" && currentUser) {
    if (currentUser.role === "trainer") {
      if (selectedClientId) {
        const activeClient = clients.find((c) => c.id === selectedClientId);
        if (!activeClient) return null;
        return (
          <ClientWorkspace
            client={activeClient}
            isTrainer={true}
            viewerId={currentUser.id}
            siblingClients={clients}
            onBack={() => setSelectedClientId(null)}
            onLogout={handleLogout}
          />
        );
      }
      return (
        <TrainerDashboard
          trainer={currentUser}
          clients={clients}
          onSelectClient={setSelectedClientId}
          onAddClient={handleAddClient}
          onDeleteClient={handleDeleteClient}
          onLogout={handleLogout}
        />
      );
    } else {
      return (
        <ClientWorkspace
          client={currentUser}
          isTrainer={false}
          viewerId={currentUser.id}
          siblingClients={[]}
          onBack={undefined}
          onLogout={handleLogout}
        />
      );
    }
  }

  return null;
}
