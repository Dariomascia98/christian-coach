import React, { useState, useEffect, useCallback } from "react";
import {
  LogOut, Plus, Trash2, ChevronLeft, Dumbbell, TrendingUp, Camera,
  X, PlayCircle, Users as UsersIcon, Ruler, Check, ImageOff,
  ClipboardList, Copy, Printer
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { supabase } from "./supabaseClient";

// ---------- Design Tokens & Theme ----------
const C = {
  bg: "#121418",
  panel: "#1A1D24",
  panelHi: "#242832",
  border: "#2E333D",
  text: "#F3F4F6",
  textDim: "#9CA3AF",
  accent: "#FF5A1F",
  accentSoft: "rgba(255, 90, 31, 0.15)",
  positive: "#10B981",
  ruler: "#374151",
};

const fontDisplay = { fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.04em" };
const fontBody = { fontFamily: "'Inter', sans-serif" };
const fontMono = { fontFamily: "'JetBrains Mono', monospace" };

// ---------- Global CSS Injector ----------
function FontImport() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
      
      *, *::before, *::after {
        box-sizing: border-box !important;
      }

      body {
        margin: 0;
        padding: 0;
        background-color: ${C.bg};
        color: ${C.text};
        font-family: 'Inter', sans-serif;
        -webkit-font-smoothing: antialiased;
        overflow-x: hidden;
      }

      *:focus-visible { 
        outline: 2px solid ${C.accent}; 
        outline-offset: 2px; 
      }
      
      input::placeholder, textarea::placeholder { 
        color: ${C.textDim}; 
        opacity: 0.6;
      }

      select {
        appearance: none;
        background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%239CA3AF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E");
        background-repeat: no-repeat;
        background-position: right 12px top 50%;
        background-size: 10px auto;
        padding-right: 32px !important;
      }

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

// ---------- Data layer (Supabase) ----------
function toFakeEmail(username) {
  return `${username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "")}@misura.local`;
}

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
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
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

// ---------- Reusable UI Components ----------
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
          backgroundSize: "8px 6px, 40px 12px",
          backgroundPosition: "left top, left bottom",
          backgroundRepeat: "repeat-x",
          borderBottom: `1px solid ${C.border}`,
          opacity: 0.8,
        }}
      />
    </div>
  );
}

function Field({ label, value, onChange, type = "text", onEnter, placeholder }) {
  return (
    <div style={{ marginBottom: 12, width: "100%", textAlign: "left" }}>
      {label && (
        <label style={{ ...fontMono, display: "block", fontSize: 11, color: C.textDim, letterSpacing: "0.08em", marginBottom: 4 }}>
          {label.toUpperCase()}
        </label>
      )}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && onEnter) onEnter(); }}
        style={inputStyle}
      />
    </div>
  );
}

function TextArea({ label, value, onChange, placeholder }) {
  return (
    <div style={{ marginBottom: 12, width: "100%", textAlign: "left" }}>
      {label && (
        <label style={{ ...fontMono, display: "block", fontSize: 11, color: C.textDim, letterSpacing: "0.08em", marginBottom: 4 }}>
          {label.toUpperCase()}
        </label>
      )}
      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        style={{ ...inputStyle, resize: "vertical", minHeight: 70 }}
      />
    </div>
  );
}

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
      <Ruler size={26} color={C.accent} />
      <h1 style={{ ...fontDisplay, fontSize: 42, color: C.text, margin: 0, lineHeight: 1 }}>MISURA</h1>
    </div>
  );
}

function Header({ title, subtitle, onBack, onLogout }) {
  return (
    <div style={{ borderBottom: `1px solid ${C.border}`, padding: "14px 16px", background: C.panel }}>
      <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {onBack && (
            <button onClick={onBack} style={iconBtn} aria-label="Torna indietro">
              <ChevronLeft size={22} />
            </button>
          )}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Ruler size={16} color={C.accent} />
              <span style={{ ...fontDisplay, fontSize: 20, color: C.text, letterSpacing: "0.05em" }}>MISURA</span>
            </div>
            <p style={{ ...fontBody, fontSize: 12, color: C.textDim, margin: 0 }}>{subtitle}</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ ...fontBody, fontSize: 13, color: C.text, fontWeight: 500 }}>{title}</span>
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
    <div style={{ textAlign: "center", padding: "40px 16px", border: `1px dashed ${C.border}`, borderRadius: 12, margin: "16px 0" }}>
      <div style={{ marginBottom: 10, display: "flex", justifyContent: "center" }}>{icon}</div>
      <p style={{ ...fontBody, color: C.textDim, fontSize: 14, maxWidth: 360, margin: "0 auto", lineHeight: 1.4 }}>{text}</p>
    </div>
  );
}

// ---------- Shared Styles ----------
const inputStyle = {
  display: "block",
  width: "100%",
  padding: "10px 12px",
  background: C.panelHi,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  color: C.text,
  ...fontBody,
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const wrapStyle = {
  minHeight: "100vh",
  background: C.bg,
  display: "flex",
  alignItems: "center",
  justify: "center",
  padding: 16,
};

const centerCard = {
  width: "100%",
  maxWidth: 400,
  background: C.panel,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  padding: "28px 20px",
  textAlign: "center",
  boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
};

const primaryBtn = {
  width: "100%",
  padding: "11px 16px",
  background: C.accent,
  color: "#FFFFFF",
  border: "none",
  borderRadius: 8,
  ...fontBody,
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  transition: "opacity 0.2s",
};

const secondaryBtn = {
  padding: "8px 14px",
  background: C.panelHi,
  color: C.text,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  ...fontBody,
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
};

const iconBtn = {
  background: "none",
  border: "none",
  color: C.textDim,
  cursor: "pointer",
  padding: 6,
  borderRadius: 6,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

// ---------- Modals ----------
function VideoModal({ url, onClose }) {
  const embed = getYouTubeEmbed(url);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, borderRadius: 12, padding: 16, maxWidth: 600, width: "100%", border: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ ...fontDisplay, fontSize: 18, color: C.text }}>VIDEO ESECUZIONE</span>
          <button onClick={onClose} style={iconBtn}><X size={20} /></button>
        </div>
        {embed ? (
          <div style={{ position: "relative", paddingTop: "56.25%", width: "100%" }}>
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
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, borderRadius: 12, padding: 18, maxWidth: 480, width: "100%", border: `1px solid ${C.border}`, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ ...fontDisplay, fontSize: 22, color: C.text, margin: 0 }}>{exerciseName}</h3>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>

        {loading ? (
          <p style={{ ...fontBody, color: C.textDim, fontSize: 13 }}>Caricamento...</p>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 8, marginBottom: 10 }}>
              <Field label="Data" value={form.date} onChange={(v) => setForm({ ...form, date: v })} type="date" />
              <Field label="Kg" value={form.weight} onChange={(v) => setForm({ ...form, weight: v })} type="number" />
              <Field label="Rip." value={form.reps} onChange={(v) => setForm({ ...form, reps: v })} />
              <Field label="Serie" value={form.sets} onChange={(v) => setForm({ ...form, sets: v })} />
            </div>
            <button onClick={submit} style={{ ...primaryBtn, marginBottom: 18 }}>Registra carico</button>

            {entries.length === 0 ? (
              <p style={{ ...fontBody, color: C.textDim, fontSize: 13, textAlign: "center" }}>Nessun carico registrato ancora per questo esercizio.</p>
            ) : (
              <>
                <div style={{ height: 160, width: "100%", marginBottom: 16 }}>
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
                    <div key={e.id} style={{ display: "flex", justifyContent: "space-between", background: C.panelHi, borderRadius: 8, padding: "8px 12px" }}>
                      <span style={{ ...fontBody, fontSize: 12, color: C.textDim }}>{fmtDate(e.date)}</span>
                      <span style={{ ...fontMono, fontSize: 12, color: C.text, fontWeight: 500 }}>
                        {e.weight} kg {e.sets && `· ${e.sets}x`}{e.reps && `${e.reps}`}
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

// ---------- Auth / Landing Screens ----------
function WelcomeScreen({ onGoLogin, onGoSetup }) {
  return (
    <div style={wrapStyle}>
      <FontImport />
      <div style={centerCard}>
        <Logo />
        <TapeDivider label="Benvenuto" />
        <p style={{ ...fontBody, color: C.textDim, fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
          Gestisci i tuoi clienti, i loro programmi e i loro progressi in un unico posto.
        </p>
        <button onClick={onGoLogin} style={primaryBtn}>Accedi</button>
        <button onClick={onGoSetup} style={{ ...secondaryBtn, width: "100%", marginTop: 10 }}>
          Crea un account trainer
        </button>
      </div>
    </div>
  );
}

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
        <h2 style={{ ...fontDisplay, fontSize: 24, color: C.text, marginBottom: 4 }}>Crea account Trainer</h2>
        <p style={{ ...fontBody, color: C.textDim, fontSize: 13, marginBottom: 20 }}>
          Accesso principale per la gestione dei clienti.
        </p>
        <Field label="Nome e cognome" value={name} onChange={setName} />
        <Field label="Username" value={username} onChange={setUsername} />
        <Field label="Password" value={password} onChange={setPassword} type="password" />
        {error && <p style={{ color: C.accent, ...fontBody, fontSize: 13, marginTop: 4, marginBottom: 12 }}>{error}</p>}
        <button onClick={submit} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.7 : 1 }}>
          {busy ? "Attendere..." : <>Crea account <Check size={16} /></>}
        </button>
        <button onClick={onBack} style={{ ...secondaryBtn, width: "100%", marginTop: 10, border: "none" }}>
          ← Torna indietro
        </button>
      </div>
    </div>
  );
}

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
        <Field label="Username" value={username} onChange={setUsername} />
        <Field label="Password" value={password} onChange={setPassword} type="password" onEnter={submit} />
        {error && <p style={{ color: C.accent, ...fontBody, fontSize: 13, marginTop: 4, marginBottom: 12 }}>{error}</p>}
        <button onClick={submit} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.7 : 1 }}>
          {busy ? "Verifica..." : "Entra"}
        </button>
        <button onClick={onBack} style={{ ...secondaryBtn, width: "100%", marginTop: 10, border: "none" }}>
          ← Torna indietro
        </button>
      </div>
    </div>
  );
}

// ---------- Trainer Dashboard ----------
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
      <Header title={`Ciao, ${trainer.name}`} subtitle="Dashboard Trainer" onLogout={onLogout} />
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "16px 16px 60px" }}>
        <TapeDivider label={`${clients.length} clienti attivi`} />

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
          <button style={{ ...primaryBtn, width: "auto" }} onClick={() => setShowAdd((s) => !s)}>
            <Plus size={16} /> Nuovo cliente
          </button>
        </div>

        {showAdd && (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
            <h3 style={{ ...fontDisplay, fontSize: 20, color: C.text, marginTop: 0, marginBottom: 12 }}>Aggiungi Cliente</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              <Field label="Nome cliente" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <Field label="Username" value={form.username} onChange={(v) => setForm({ ...form, username: v })} />
              <Field label="Password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} type="password" />
            </div>
            {error && <p style={{ color: C.accent, fontSize: 13, ...fontBody, marginTop: 4 }}>{error}</p>}
            <button style={{ ...primaryBtn, marginTop: 8 }} onClick={submit}>Aggiungi cliente</button>
          </div>
        )}

        {clients.length === 0 ? (
          <EmptyState icon={<UsersIcon size={32} color={C.textDim} />} text="Nessun cliente inserito. Aggiungi il tuo primo cliente per iniziare." />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
            {clients.map((c) => (
              <div key={c.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, position: "relative" }}>
                <button
                  onClick={(e) => { e.stopPropagation(); if (window.confirm(`Eliminare ${c.name}? Questa azione è permanente.`)) onDeleteClient(c.id); }}
                  style={{ ...iconBtn, position: "absolute", top: 12, right: 12 }}
                  aria-label="Elimina cliente"
                >
                  <Trash2 size={16} />
                </button>
                <div onClick={() => onSelectClient(c.id)} style={{ cursor: "pointer" }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                    <span style={{ ...fontDisplay, color: C.accent, fontSize: 20 }}>{c.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <p style={{ ...fontBody, fontWeight: 600, color: C.text, margin: "0 0 2px 0", fontSize: 15 }}>{c.name}</p>
                  <p style={{ ...fontMono, fontSize: 12, color: C.textDim, margin: 0 }}>@{c.username}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Client Workspace ----------
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
          subtitle={isTrainer ? "Scheda Cliente" : "Il tuo percorso"}
          onBack={isTrainer ? onBack : undefined}
          onLogout={onLogout}
        />
      </div>
      <div style={{ maxWidth: 840, margin: "0 auto", padding: "16px 16px 60px" }}>
        <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 12, overflowX: "auto", paddingBottom: 4 }}>
          <TabBtn active={tab === "anamnesi"} onClick={() => setTab("anamnesi")} icon={<ClipboardList size={15} />} label="Anamnesi" />
          <TabBtn active={tab === "programma"} onClick={() => setTab("programma")} icon={<Dumbbell size={15} />} label="Programma" />
          <TabBtn active={tab === "progressi"} onClick={() => setTab("progressi")} icon={<TrendingUp size={15} />} label="Progressi" />
        </div>
        <div className="no-print"><TapeDivider /></div>

        {loading ? (
          <p style={{ ...fontBody, color: C.textDim, textAlign: "center", padding: "20px 0" }}>Caricamento...</p>
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
        border: `1px solid ${active ? C.accent : C.border}`, background: active ? C.accentSoft : C.panel,
        color: active ? C.accent : C.textDim, ...fontBody, fontSize: 13, fontWeight: 600, cursor: "pointer",
        whiteSpace: "nowrap", flexShrink: 0,
      }}
    >
      {icon} {label}
    </button>
  );
}

// ---------- Intake Section ----------
const ACTIVITY_LEVELS = [
  { value: "sedentario", label: "Sedentario", mult: 1.2 },
  { value: "leggero", label: "Leggero (1-3 giorni/sett.)", mult: 1.375 },
  { value: "moderato", label: "Moderato (3-5 giorni/sett.)", mult: 1.55 },
  { value: "intenso", label: "Intenso (6-7 giorni/sett.)", mult: 1.725 },
  { value: "molto_intenso", label: "Molto intenso (atleta)", mult: 1.9 },
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

  const age = form.birthDate ? Math.floor((Date.now() - new Date(form.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000)) : null;
  const metabolism = calcBmrTdee({ sex: form.sex, age, heightCm: form.heightCm, weightKg: form.startingWeight, activityLevel: form.activityLevel });

  const save = () => { onSave(form); setEditing(false); };

  if (isTrainer && editing) {
    return (
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
        <h3 style={{ ...fontDisplay, fontSize: 20, color: C.text, marginTop: 0, marginBottom: 14 }}>Dati Anamnesi</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <Field label="Data di nascita" value={form.birthDate} onChange={(v) => setForm({ ...form, birthDate: v })} type="date" />
          
          <div style={{ marginBottom: 12, textAlign: "left" }}>
            <label style={{ ...fontMono, display: "block", fontSize: 11, color: C.textDim, letterSpacing: "0.08em", marginBottom: 4 }}>SESSO</label>
            <select
              value={form.sex}
              onChange={(e) => setForm({ ...form, sex: e.target.value })}
              style={inputStyle}
            >
              <option value="M">M</option>
              <option value="F">F</option>
            </select>
          </div>

          <Field label="Altezza (cm)" value={form.heightCm} onChange={(v) => setForm({ ...form, heightCm: v })} type="number" placeholder="es. 175" />
          <Field label="Peso iniziale (kg)" value={form.startingWeight} onChange={(v) => setForm({ ...form, startingWeight: v })} type="number" placeholder="es. 70.5" />
        </div>

        <div style={{ marginBottom: 12, textAlign: "left" }}>
          <label style={{ ...fontMono, display: "block", fontSize: 11, color: C.textDim, letterSpacing: "0.08em", marginBottom: 4 }}>LIVELLO ATTIVITÀ</label>
          <select
            value={form.activityLevel}
            onChange={(e) => setForm({ ...form, activityLevel: e.target.value })}
            style={inputStyle}
          >
            {ACTIVITY_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>

        <TextArea label="Obiettivo principale" value={form.goal} onChange={(v) => setForm({ ...form, goal: v })} placeholder="Es. ipertrofia, dimagrimento, forza..." />
        <TextArea label="Infortuni / limitazioni" value={form.injuries} onChange={(v) => setForm({ ...form, injuries: v })} placeholder="Es. ernia L5, problemi alle ginocchia..." />
        <TextArea label="Note generali" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />

        <button onClick={save} style={primaryBtn}><Check size={16} /> Salva Anamnesi</button>
      </div>
    );
  }

  const hasData = intake && (intake.goal || intake.birthDate || intake.injuries);
  if (!hasData) {
    return (
      <div>
        {isTrainer && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button onClick={() => setEditing(true)} style={secondaryBtn}>Compila Anamnesi</button>
          </div>
        )}
        <EmptyState icon={<ClipboardList size={30} color={C.textDim} />} text={isTrainer ? "Nessuna anamnesi compilata per questo cliente." : "Il tuo trainer non ha ancora registrato i dati di anamnesi."} />
      </div>
    );
  }

  return (
    <div>
      {isTrainer && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button onClick={() => setEditing(true)} style={secondaryBtn}>Modifica Anamnesi</button>
        </div>
      )}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 12 }}>
          <InfoRow label="Età" value={age ? `${age} anni` : "—"} />
          <InfoRow label="Sesso" value={form.sex} />
          <InfoRow label="Altezza" value={form.heightCm ? `${form.heightCm} cm` : "—"} />
          <InfoRow label="Peso Iniziale" value={form.startingWeight ? `${form.startingWeight} kg` : "—"} />
        </div>
        {metabolism && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, paddingTop: 12, borderTop: `1px dashed ${C.border}` }}>
            <div>
              <p style={{ ...fontMono, fontSize: 10, color: C.textDim, margin: 0 }}>BMR (METABOLISMO BASALE)</p>
              <p style={{ ...fontDisplay, fontSize: 22, color: C.accent, margin: "2px 0 0 0" }}>{metabolism.bmr} kcal</p>
            </div>
            <div>
              <p style={{ ...fontMono, fontSize: 10, color: C.textDim, margin: 0 }}>TDEE STIMATO</p>
              <p style={{ ...fontDisplay, fontSize: 22, color: C.positive, margin: "2px 0 0 0" }}>{metabolism.tdee} kcal</p>
            </div>
          </div>
        )}
      </div>
      {form.goal && <InfoBlock label="Obiettivo Principale" text={form.goal} />}
      {form.injuries && <InfoBlock label="Infortuni e Limitazioni" text={form.injuries} accent />}
      {form.notes && <InfoBlock label="Note" text={form.notes} />}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <p style={{ ...fontMono, fontSize: 10, color: C.textDim, margin: 0 }}>{label.toUpperCase()}</p>
      <p style={{ ...fontBody, fontSize: 14, color: C.text, fontWeight: 600, margin: "2px 0 0 0" }}>{value}</p>
    </div>
  );
}

function InfoBlock({ label, text, accent }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${accent ? C.accent : C.border}`, borderRadius: 10, padding: 14, marginBottom: 10 }}>
      <p style={{ ...fontMono, fontSize: 10, color: accent ? C.accent : C.textDim, margin: "0 0 4px 0" }}>{label.toUpperCase()}</p>
      <p style={{ ...fontBody, fontSize: 14, color: C.text, margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.4 }}>{text}</p>
    </div>
  );
}

// ---------- Program Section ----------
function blockLabel(dayIndexIgnored, blockIndex) {
  return String.fromCharCode(65 + blockIndex);
}

function blockKind(block) {
  if (block.exercises.length <= 1) return "Singolo";
  if (block.exercises.length === 2) return "Superset";
  return "Circuito";
}

function WeekStrip({ days }) {
  const today = todayCode();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 16 }}>
      {WEEKDAYS.map((wd) => {
        const scheduled = days.some((d) => (d.weekdays || []).includes(wd.code));
        const isToday = wd.code === today;
        return (
          <div
            key={wd.code}
            style={{
              textAlign: "center", padding: "6px 2px", borderRadius: 6,
              background: scheduled ? C.accentSoft : C.panel,
              border: `1px solid ${isToday ? C.accent : C.border}`,
            }}
          >
            <div style={{ ...fontMono, fontSize: 11, fontWeight: isToday ? "bold" : "normal", color: scheduled ? C.accent : C.textDim }}>{wd.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function ProgramSection({ program, isTrainer, clientId, clientName, trainerId, siblingClients, onSave }) {
  const [editing, setEditing] = useState(isTrainer && program.days.length === 0);
  const [days, setDays] = useState(program.days);
  const [videoModal, setVideoModal] = useState(null);
  const [loadModalEx, setLoadModalEx] = useState(null);
  const [library, setLibrary] = useState([]);
  const [showAiForm, setShowAiForm] = useState(false);
  const [aiForm, setAiForm] = useState({ goal: "", daysPerWeek: "4", level: "intermedio", notes: "" });
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [showCloneForm, setShowCloneForm] = useState(false);
  const [cloneBusy, setCloneBusy] = useState(false);
  const [cloneError, setCloneError] = useState("");

  useEffect(() => { setDays(program.days); }, [program]);
  useEffect(() => { if (isTrainer && trainerId) loadLibrary(trainerId).then(setLibrary); }, [isTrainer, trainerId]);

  const newExercise = () => ({ id: uid(), name: "", reps: "", note: "", videoUrl: "" });
  const newBlock = () => ({ id: uid(), rounds: "3", restBetweenExercises: "", restAfterRound: "90s", exercises: [newExercise()] });

  const cloneDaysWithFreshIds = (sourceDays) => (sourceDays || []).map((d) => ({
    id: uid(),
    label: d.label || "Giorno",
    weekdays: d.weekdays || [],
    blocks: (d.blocks || []).map((b) => ({
      id: uid(),
      rounds: b.rounds || "3",
      restBetweenExercises: b.restBetweenExercises || "",
      restAfterRound: b.restAfterRound || "",
      exercises: (b.exercises || []).map((ex) => ({ id: uid(), name: ex.name || "", reps: ex.reps || "", note: ex.note || "", videoUrl: ex.videoUrl || "" })),
    })),
  }));

  const cloneFromClient = async (sourceClient) => {
    if (days.length > 0 && !window.confirm(`Copiare la scheda di ${sourceClient.name}? Sostituirà i giorni attuali.`)) return;
    setCloneBusy(true);
    setCloneError("");
    const sourceProgram = await fetchProgram(sourceClient.id);
    setCloneBusy(false);
    if (!sourceProgram || !sourceProgram.days || sourceProgram.days.length === 0) {
      setCloneError(`${sourceClient.name} non ha ancora una scheda salvata.`);
      return;
    }
    setDays(cloneDaysWithFreshIds(sourceProgram.days));
    setShowCloneForm(false);
  };

  const generateWithAi = async () => {
    if (!aiForm.goal.trim()) { setAiError("Descrivi l'obiettivo del cliente."); return; }
    if (days.length > 0 && !window.confirm("Sostituire la scheda attuale con quella generata?")) return;
    setAiBusy(true);
    setAiError("");
    const result = await callServerFunction("/api/generate-program", aiForm);
    setAiBusy(false);
    if (!result.ok) { setAiError(result.error); return; }
    const newDays = (result.data.days || []).map((d) => ({
      id: uid(),
      label: d.label || "Giorno",
      weekdays: Array.isArray(d.weekdays) ? d.weekdays.filter((c) => WEEKDAYS.some((w) => w.code === c)) : [],
      blocks: (d.blocks || []).map((b) => ({
        id: uid(),
        rounds: b.rounds || "3",
        restBetweenExercises: b.restBetweenExercises || "",
        restAfterRound: b.restAfterRound || "90s",
        exercises: (b.exercises || []).map((ex) => ({ id: uid(), name: ex.name || "", reps: ex.reps || "", note: ex.note || "", videoUrl: "" })),
      })),
    }));
    setDays(newDays);
    setShowAiForm(false);
  };

  const addDay = () => setDays([...days, { id: uid(), label: `Giorno ${String.fromCharCode(65 + days.length)}`, weekdays: [], blocks: [] }]);
  const removeDay = (dayId) => setDays(days.filter((d) => d.id !== dayId));
  const updateDayLabel = (dayId, label) => setDays(days.map((d) => (d.id === dayId ? { ...d, label } : d)));
  const toggleWeekday = (dayId, code) => setDays(days.map((d) => d.id === dayId
    ? { ...d, weekdays: d.weekdays.includes(code) ? d.weekdays.filter((c) => c !== code) : [...d.weekdays, code] }
    : d));

  const addBlock = (dayId) => setDays(days.map((d) => d.id === dayId ? { ...d, blocks: [...d.blocks, newBlock()] } : d));
  const removeBlock = (dayId, blockId) => setDays(days.map((d) => d.id === dayId
    ? { ...d, blocks: d.blocks.filter((b) => b.id !== blockId) } : d));
  const updateBlockField = (dayId, blockId, field, value) => setDays(days.map((d) => d.id === dayId
    ? { ...d, blocks: d.blocks.map((b) => b.id === blockId ? { ...b, [field]: value } : b) } : d));

  const addExerciseToBlock = (dayId, blockId) => setDays(days.map((d) => d.id === dayId
    ? { ...d, blocks: d.blocks.map((b) => b.id === blockId ? { ...b, exercises: [...b.exercises, newExercise()] } : b) }
    : d));
  const removeExerciseFromBlock = (dayId, blockId, exId) => setDays(days.map((d) => d.id === dayId
    ? {
        ...d,
        blocks: d.blocks
          .map((b) => b.id === blockId ? { ...b, exercises: b.exercises.filter((ex) => ex.id !== exId) } : b)
          .filter((b) => b.exercises.length > 0),
      }
    : d));
  const updateExerciseField = (dayId, blockId, exId, field, value) => setDays(days.map((d) => d.id === dayId
    ? {
        ...d,
        blocks: d.blocks.map((b) => b.id !== blockId ? b : {
          ...b,
          exercises: b.exercises.map((ex) => {
            if (ex.id !== exId) return ex;
            const updated = { ...ex, [field]: value };
            if (field === "name" && !ex.videoUrl) {
              const match = library.find((l) => l.name === exKey(value));
              if (match && match.videoUrl) updated.videoUrl = match.videoUrl;
            }
            return updated;
          }),
        }),
      }
    : d));

  const save = async () => {
    const libMap = new Map(library.map((l) => [l.name, l]));
    days.forEach((d) => d.blocks.forEach((b) => b.exercises.forEach((ex) => {
      const key = exKey(ex.name);
      if (!key) return;
      const existing = libMap.get(key);
      if (!existing) libMap.set(key, { name: key, displayName: ex.name.trim(), videoUrl: ex.videoUrl || "" });
      else if (ex.videoUrl && !existing.videoUrl) libMap.set(key, { ...existing, videoUrl: ex.videoUrl });
    })));
    const updatedLib = Array.from(libMap.values());
    setLibrary(updatedLib);
    await saveLibrary(trainerId, updatedLib);
    onSave({ days });
    setEditing(false);
  };

  if (isTrainer && editing) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {siblingClients && siblingClients.length > 0 && (
            <button onClick={() => setShowCloneForm((s) => !s)} style={secondaryBtn}>
              <Copy size={14} /> Copia scheda
            </button>
          )}
          <button onClick={() => setShowAiForm((s) => !s)} style={{ ...secondaryBtn, borderColor: C.accent, color: C.accent }}>
            ✨ Genera con AI
          </button>
        </div>

        {showCloneForm && (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <p style={{ ...fontBody, fontSize: 12, color: C.textDim, marginTop: 0, marginBottom: 10 }}>Seleziona il cliente da cui copiare la scheda:</p>
            {cloneError && <p style={{ color: C.accent, fontSize: 13, ...fontBody, marginBottom: 8 }}>{cloneError}</p>}
            {cloneBusy ? (
              <p style={{ ...fontBody, color: C.textDim, fontSize: 13 }}>Copia in corso...</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 6 }}>
                {siblingClients.map((c) => (
                  <button key={c.id} onClick={() => cloneFromClient(c)} style={{ ...secondaryBtn, justifyContent: "flex-start" }}>
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {showAiForm && (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <TextArea label="Obiettivo" value={aiForm.goal} onChange={(v) => setAiForm({ ...aiForm, goal: v })} placeholder="Es. ipertrofia, focus su gambe, 45 min a sessione..." />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Giorni a settimana" value={aiForm.daysPerWeek} onChange={(v) => setAiForm({ ...aiForm, daysPerWeek: v })} type="number" />
              <Field label="Livello" value={aiForm.level} onChange={(v) => setAiForm({ ...aiForm, level: v })} />
            </div>
            {aiError && <p style={{ color: C.accent, fontSize: 13, ...fontBody, marginBottom: 8 }}>{aiError}</p>}
            <button onClick={generateWithAi} disabled={aiBusy} style={{ ...primaryBtn, marginTop: 10, opacity: aiBusy ? 0.7 : 1 }}>
              {aiBusy ? "Generazione..." : "Genera Bozza Scheda"}
            </button>
          </div>
        )}

        <datalist id="misura-exercise-library">
          {library.map((l) => <option key={l.name} value={l.displayName || l.name} />)}
        </datalist>

        {days.map((day) => (
          <div key={day.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
              <input
                value={day.label}
                onChange={(e) => updateDayLabel(day.id, e.target.value)}
                style={{ ...fontDisplay, fontSize: 20, color: C.text, background: "transparent", border: "none", borderBottom: `1px solid ${C.border}`, flex: 1, outline: "none", padding: "2px 0" }}
              />
              <button onClick={() => removeDay(day.id)} style={iconBtn}><Trash2 size={16} /></button>
            </div>

            <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap" }}>
              {WEEKDAYS.map((wd) => {
                const active = day.weekdays.includes(wd.code);
                return (
                  <button
                    key={wd.code}
                    onClick={() => toggleWeekday(day.id, wd.code)}
                    style={{
                      padding: "4px 8px", borderRadius: 16, border: `1px solid ${active ? C.accent : C.border}`,
                      background: active ? C.accentSoft : "transparent", color: active ? C.accent : C.textDim,
                      ...fontMono, fontSize: 11, cursor: "pointer",
                    }}
                  >
                    {wd.label}
                  </button>
                );
              })}
            </div>

            {day.blocks.map((block, bi) => (
              <div key={block.id} style={{ background: C.panelHi, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ ...fontMono, fontSize: 11, color: C.accent, letterSpacing: "0.08em" }}>
                    BLOCCO {blockLabel(0, bi)} ({blockKind(block).toUpperCase()})
                  </span>
                  <button onClick={() => removeBlock(day.id, block.id)} style={iconBtn}><Trash2 size={14} /></button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, marginBottom: 10 }}>
                  <Field label="Serie/Giri" value={block.rounds} onChange={(v) => updateBlockField(day.id, block.id, "rounds", v)} placeholder="es. 3-4" />
                  {block.exercises.length > 1 && (
                    <Field label="Rec. tra es." value={block.restBetweenExercises} onChange={(v) => updateBlockField(day.id, block.id, "restBetweenExercises", v)} placeholder="es. 30s" />
                  )}
                  <Field label="Rec. fine giro" value={block.restAfterRound} onChange={(v) => updateBlockField(day.id, block.id, "restAfterRound", v)} placeholder="es. 90s" />
                </div>

                {block.exercises.map((ex, ei) => (
                  <div key={ex.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, background: C.panel, padding: 10, borderRadius: 8, marginBottom: 8, border: `1px solid ${C.border}` }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
                      <Field label={`Esercizio ${block.exercises.length > 1 ? ei + 1 : ""}`} value={ex.name} onChange={(v) => updateExerciseField(day.id, block.id, ex.id, "name", v)} placeholder="Nome esercizio" />
                      <Field label="Ripetizioni" value={ex.reps} onChange={(v) => updateExerciseField(day.id, block.id, ex.id, "reps", v)} placeholder="es. 10 / 8-10" />
                      <Field label="Link Video YouTube" value={ex.videoUrl} onChange={(v) => updateExerciseField(day.id, block.id, ex.id, "videoUrl", v)} placeholder="https://..." />
                    </div>
                    <button onClick={() => removeExerciseFromBlock(day.id, block.id, ex.id)} style={{ ...iconBtn, alignSelf: "flex-start", marginTop: 18 }}><X size={16} /></button>
                  </div>
                ))}
                <button onClick={() => addExerciseToBlock(day.id, block.id)} style={{ ...secondaryBtn, fontSize: 12, marginTop: 4 }}>
                  <Plus size={12} /> Aggiungi in Superset/Circuito
                </button>
              </div>
            ))}

            <button onClick={() => addBlock(day.id)} style={{ ...secondaryBtn, width: "100%", marginTop: 8 }}>
              <Plus size={14} /> Aggiungi Blocco Singolo
            </button>
          </div>
        ))}

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button onClick={addDay} style={{ ...secondaryBtn, flex: 1 }}><Plus size={14} /> Nuovo Giorno</button>
          <button onClick={save} style={{ ...primaryBtn, flex: 2 }}><Check size={16} /> Salva Programma</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {days.length > 0 && (
          <button onClick={() => window.print()} style={secondaryBtn} className="no-print">
            <Printer size={14} /> Esporta PDF
          </button>
        )}
        {isTrainer && (
          <button onClick={() => setEditing(true)} style={secondaryBtn} className="no-print">Modifica Scheda</button>
        )}
      </div>
      {days.length > 0 && clientName && (
        <p className="print-only" style={{ display: "none", ...fontDisplay, fontSize: 24, marginBottom: 16 }}>
          Programma di Allenamento - {clientName}
        </p>
      )}
      {days.length > 0 && <div className="no-print"><WeekStrip days={days} /></div>}
      {days.length === 0 ? (
        <EmptyState icon={<Dumbbell size={30} color={C.textDim} />} text={isTrainer ? "Nessuna scheda creata per questo cliente." : "Il tuo trainer non ha ancora caricato il tuo programma."} />
      ) : (
        days.map((day) => {
          const isToday = (day.weekdays || []).includes(todayCode());
          return (
            <div key={day.id} style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <h3 style={{ ...fontDisplay, fontSize: 22, color: C.text, margin: 0 }}>{day.label}</h3>
                {isToday && (
                  <span style={{ ...fontMono, fontSize: 10, color: C.accent, border: `1px solid ${C.accent}`, borderRadius: 10, padding: "2px 6px" }}>OGGI</span>
                )}
              </div>
              {day.weekdays && day.weekdays.length > 0 && (
                <p style={{ ...fontMono, fontSize: 11, color: C.textDim, margin: "0 0 10px 0" }}>
                  {day.weekdays.map((c) => WEEKDAYS.find((w) => w.code === c)?.label).join(" · ")}
                </p>
              )}
              {day.blocks.map((block, bi) => (
                <div key={block.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 4 }}>
                    <span style={{ ...fontMono, fontSize: 11, color: C.accent, letterSpacing: "0.08em", fontWeight: "bold" }}>
                      {blockKind(block).toUpperCase()} {blockLabel(0, bi)}
                    </span>
                    <span style={{ ...fontMono, fontSize: 11, color: C.textDim }}>
                      x{block.rounds || "–"} giri
                      {block.restBetweenExercises && ` · rec. es. ${block.restBetweenExercises}`}
                      {block.restAfterRound && ` · rec. giro ${block.restAfterRound}`}
                    </span>
                  </div>
                  {block.exercises.map((ex, ei) => (
                    <div key={ex.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: ei > 0 ? `1px dashed ${C.border}` : "none", flexWrap: "wrap", gap: 8 }}>
                      <div style={{ flex: "1 1 200px" }}>
                        <p style={{ ...fontBody, fontWeight: 600, color: C.text, margin: "0 0 2px 0", fontSize: 15 }}>
                          {block.exercises.length > 1 && <span style={{ ...fontMono, color: C.accent, marginRight: 6 }}>{blockLabel(0, bi)}{ei + 1}</span>}
                          {ex.name || "—"}
                        </p>
                        <p style={{ ...fontMono, fontSize: 12, color: C.textDim, margin: 0 }}>{ex.reps || "–"} rip.</p>
                      </div>
                      <div className="no-print" style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        {ex.videoUrl && (
                          <button onClick={() => setVideoModal(ex.videoUrl)} style={{ ...secondaryBtn, padding: "6px 10px", borderColor: C.accent, color: C.accent }}>
                            <PlayCircle size={15} /> Video
                          </button>
                        )}
                        {ex.name && (
                          <button onClick={() => setLoadModalEx(ex.name)} style={{ ...secondaryBtn, padding: "6px 10px" }}>
                            <TrendingUp size={15} /> Carichi
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          );
        })
      )}
      {videoModal && <VideoModal url={videoModal} onClose={() => setVideoModal(null)} />}
      {loadModalEx && <LoadModal exerciseName={loadModalEx} clientId={clientId} onClose={() => setLoadModalEx(null)} />}
    </div>
  );
}

// ---------- Progress Section ----------
function ProgressSection({ entries, onAdd }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10), weight: "", vita: "", petto: "", braccio: "", coscia: "", note: "", photo: null,
  });
  const [photoBusy, setPhotoBusy] = useState(false);

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoBusy(true);
    try {
      const dataUrl = await resizeImage(file);
      setForm((f) => ({ ...f, photo: dataUrl }));
    } catch (err) {
      /* ignore */
    }
    setPhotoBusy(false);
  };

  const submit = () => {
    if (!form.weight) return;
    onAdd({
      id: uid(),
      date: form.date,
      weight: parseFloat(form.weight),
      measurements: { vita: form.vita, petto: form.petto, braccio: form.braccio, coscia: form.coscia },
      note: form.note,
      photo: form.photo,
    });
    setForm({ date: new Date().toISOString().slice(0, 10), weight: "", vita: "", petto: "", braccio: "", coscia: "", note: "", photo: null });
    setShowForm(false);
  };

  const chartData = entries.filter((e) => e.weight).map((e) => ({ date: fmtDate(e.date), peso: e.weight }));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={() => setShowForm((s) => !s)} style={{ ...primaryBtn, width: "auto" }}><Plus size={16} /> Nuova rilevazione</button>
      </div>

      {showForm && (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <h3 style={{ ...fontDisplay, fontSize: 20, color: C.text, marginTop: 0, marginBottom: 12 }}>Aggiungi Misure</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
            <Field label="Data" value={form.date} onChange={(v) => setForm({ ...form, date: v })} type="date" />
            <Field label="Peso (kg)" value={form.weight} onChange={(v) => setForm({ ...form, weight: v })} type="number" />
            <Field label="Vita (cm)" value={form.vita} onChange={(v) => setForm({ ...form, vita: v })} />
            <Field label="Petto (cm)" value={form.petto} onChange={(v) => setForm({ ...form, petto: v })} />
            <Field label="Braccio (cm)" value={form.braccio} onChange={(v) => setForm({ ...form, braccio: v })} />
            <Field label="Coscia (cm)" value={form.coscia} onChange={(v) => setForm({ ...form, coscia: v })} />
          </div>
          <TextArea label="Nota / Sensazioni" value={form.note} onChange={(v) => setForm({ ...form, note: v })} />
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 14, cursor: "pointer", ...fontBody, fontSize: 13, color: C.textDim, background: C.panelHi, padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}` }}>
            <Camera size={16} /> {photoBusy ? "Elaborazione..." : form.photo ? "Foto salvata" : "Carica Foto Progresso"}
            <input type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />
          </label>
          <button onClick={submit} style={primaryBtn}>Salva Rilevazione</button>
        </div>
      )}

      {entries.length === 0 ? (
        <EmptyState icon={<TrendingUp size={30} color={C.textDim} />} text="Ancora nessuna rilevazione. Registra il peso per iniziare il tracciamento grafico." />
      ) : (
        <>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 8px 8px", marginBottom: 20, height: 220, width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 16, left: -10, bottom: 5 }}>
                <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: C.textDim, fontSize: 10 }} />
                <YAxis tick={{ fill: C.textDim, fontSize: 10 }} domain={["auto", "auto"]} />
                <Tooltip contentStyle={{ background: C.panelHi, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text }} />
                <Line type="monotone" dataKey="peso" stroke={C.accent} strokeWidth={2} dot={{ r: 3 }} name="Peso (kg)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[...entries].reverse().map((e) => (
              <div key={e.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, display: "flex", gap: 12, alignItems: "center" }}>
                {e.photo ? (
                  <img src={e.photo} alt="Progresso" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.border}`, flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 56, height: 56, borderRadius: 8, background: C.panelHi, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <ImageOff size={20} color={C.textDim} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ ...fontBody, fontWeight: 600, color: C.text, fontSize: 14 }}>{fmtDate(e.date)}</span>
                    <span style={{ ...fontMono, color: C.accent, fontSize: 14, fontWeight: "bold" }}>{e.weight} kg</span>
                  </div>
                  <p style={{ ...fontMono, fontSize: 11, color: C.textDim, margin: "4px 0 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.measurements?.vita && `vita ${e.measurements.vita}cm `}
                    {e.measurements?.petto && `· petto ${e.measurements.petto}cm `}
                    {e.measurements?.braccio && `· braccio ${e.measurements.braccio}cm `}
                    {e.measurements?.coscia && `· coscia ${e.measurements.coscia}cm`}
                  </p>
                  {e.note && <p style={{ ...fontBody, fontSize: 12, color: C.textDim, margin: "4px 0 0 0" }}>{e.note}</p>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Main App Root ----------
export default function App() {
  const [screen, setScreen] = useState("checking");
  const [profile, setProfile] = useState(null);
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data?.session?.user?.id;
      if (!userId) { setScreen("welcome"); return; }
      const prof = await fetchProfile(userId);
      if (!prof) { setScreen("welcome"); return; }
      setProfile(prof);
      if (prof.role === "trainer") {
        setClients(await fetchClients(prof.id));
        setScreen("trainer");
      } else {
        setScreen("client");
      }
    })();
  }, []);

  const handleSetup = async ({ name, username, password }, cb) => {
    const email = toFakeEmail(username);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { cb(mapAuthError(error)); return; }
    if (!data?.user) { cb("Registrazione non riuscita. Riprova."); return; }
    const { error: insertErr } = await supabase
      .from("profiles")
      .insert({ id: data.user.id, name, username: username.trim(), role: "trainer" });
    if (insertErr) {
      cb(insertErr.message.includes("duplicate") ? "Username già in uso." : insertErr.message);
      return;
    }
    if (!data.session) {
      cb("Account creato. Se richiesta, verifica l'email per accedere.");
      return;
    }
    setProfile({ id: data.user.id, name, username: username.trim(), role: "trainer" });
    cb(null);
    setScreen("trainer");
  };

  const handleLogin = async ({ username, password }, cb) => {
    const email = toFakeEmail(username);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { cb(mapAuthError(error)); return; }
    const prof = await fetchProfile(data.user.id);
    if (!prof) { cb("Profilo non trovato per questo account."); return; }
    setProfile(prof);
    if (prof.role === "trainer") {
      setClients(await fetchClients(prof.id));
      setScreen("trainer");
    } else {
      setScreen("client");
    }
    cb(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setClients([]);
    setSelectedClientId(null);
    setScreen("welcome");
  };

  const handleAddClient = async (form, cb) => {
    const result = await callServerFunction("/api/create-client", form);
    if (!result.ok) { cb(result.error); return; }
    setClients(await fetchClients(profile.id));
    cb(null);
  };

  const handleDeleteClient = async (clientId) => {
    const result = await callServerFunction("/api/delete-client", { clientId });
    if (result.ok) setClients(await fetchClients(profile.id));
  };

  if (screen === "checking") {
    return (
      <div style={wrapStyle}>
        <FontImport />
        <p style={{ ...fontBody, color: C.textDim }}>Caricamento...</p>
      </div>
    );
  }

  if (screen === "welcome") {
    return <WelcomeScreen onGoLogin={() => setScreen("login")} onGoSetup={() => setScreen("setup")} />;
  }

  if (screen === "setup") return <SetupScreen onSubmit={handleSetup} onBack={() => setScreen("welcome")} />;
  if (screen === "login") return <LoginScreen onSubmit={handleLogin} onBack={() => setScreen("welcome")} />;

  if (screen === "trainer") {
    return (
      <TrainerDashboard
        trainer={profile}
        clients={clients}
        onSelectClient={(id) => { setSelectedClientId(id); setScreen("trainerClient"); }}
        onAddClient={handleAddClient}
        onDeleteClient={handleDeleteClient}
        onLogout={handleLogout}
      />
    );
  }

  if (screen === "trainerClient") {
    const client = clients.find((u) => u.id === selectedClientId);
    if (!client) { setScreen("trainer"); return null; }
    return (
      <ClientWorkspace
        client={client}
        isTrainer={true}
        viewerId={profile.id}
        siblingClients={clients.filter((c) => c.id !== client.id)}
        onBack={() => setScreen("trainer")}
        onLogout={handleLogout}
      />
    );
  }

  if (screen === "client") {
    return (
      <ClientWorkspace
        client={profile}
        isTrainer={false}
        onLogout={handleLogout}
      />
    );
  }

  return null;
}
