import React, { useState, useEffect, useCallback } from "react";
import {
  LogOut, Plus, Trash2, ChevronLeft, Dumbbell, TrendingUp, Camera,
  X, PlayCircle, Users as UsersIcon, Ruler, Check, ImageOff
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { supabase } from "./supabaseClient";

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

// Supabase Auth requires an email; we derive a stable, fake one from the
// trainer/client's chosen username so people keep logging in with a plain
// username instead of an email address.
function toFakeEmail(username) {
  const clean = username.trim().toLowerCase();
  function exKey(val) {
  if (!val) return "";
  return val.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

  // Se l'utente ha scritto l'email completa (con la @), la usa direttamente
  if (clean.includes('@')) {
    return clean;
  }
  
  // Se inserisce solo lo username (es. dario_mascia), aggiunge @coach.com
  return `${clean.replace(/[^a-z0-9._-]/g, "")}@coach.com`;
}
function toFakeEmail(username) {
  const clean = username.trim().toLowerCase();

  // Se l'utente ha scritto l'email completa (con la @), la usa direttamente
  if (clean.includes('@')) {
    return clean;
  }

  // Se inserisce solo lo username (es. dario_mascia), aggiunge @coach.com
  return `${clean.replace(/[^a-z0-9._-]/g, "")}@coach.com`;
}

// Spostata QUI OUTSIDE, così è globale per tutta l'app:
function exKey(val) {
  if (!val) return "";
  return val.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
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
const WEEKDAYS = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
const migrateProgram = (data) => data || { days: [] };
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
    <div style={{ margin: "28px 0 18px" }}>
      {label && (
        <div style={{ ...fontMono, fontSize: 11, color: C.textDim, letterSpacing: "0.15em", marginBottom: 6 }}>
          {label.toUpperCase()}
        </div>
      )}
      <div
        style={{
          height: 14,
          backgroundImage: `repeating-linear-gradient(90deg, ${C.ruler} 0px, ${C.ruler} 1px, transparent 1px, transparent 8px),
                             repeating-linear-gradient(90deg, ${C.ruler} 0px, ${C.ruler} 1px, transparent 1px, transparent 40px)`,
          backgroundSize: "8px 6px, 40px 12px",
          backgroundPosition: "left top, left bottom",
          backgroundRepeat: "repeat-x",
          borderBottom: `1px solid ${C.border}`,
          opacity: 0.9,
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
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 50,
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
              Apri il video in un&apos;altra scheda
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Load tracker modal: weights/reps used per exercise over time ----------
function LoadModal({ exerciseName, clientId, onClose }) {
const key = exerciseName ? exerciseName.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "") : "";

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
    const all = await loadLoads(clientId); // fetch fresh to avoid clobbering other exercises
    const updatedForThis = [...(all[key] || []), newEntry].sort((a, b) => new Date(a.date) - new Date(b.date));
    const updatedAll = { ...all, [key]: updatedForThis };
    await saveLoads(clientId, updatedAll);
    setEntries(updatedForThis);
    setForm({ date: new Date().toISOString().slice(0, 10), weight: "", reps: "", sets: "" });
  };

  const chartData = entries.map((e) => ({ date: fmtDate(e.date), carico: e.weight }));

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
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
        <p style={{ ...fontBody, color: C.textDim, fontSize: 14, marginBottom: 24 }}>
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

// ---------- Setup screen (create a trainer account) ----------
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
        <Field label="Username" value={username} onChange={setUsername} />
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
          color: C.text, ...fontBody, fontSize: 14, outline: "none",
        }}
      />
    </div>
  );
}

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, justifyContent: "center" }}>
      <Ruler size={22} color={C.accent} />
      <h1 style={{ ...fontDisplay, fontSize: 40, color: C.text, margin: 0 }}>CHRIS_COACH</h1>
    </div>
  );
}

function FontImport() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
      *:focus-visible { outline: 2px solid ${C.accent}; outline-offset: 2px; }
      input::placeholder { color: ${C.textDim}; }
    `}</style>
  );
}

const wrapStyle = { minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };
const centerCard = { width: "100%", maxWidth: 380, textAlign: "center" };
const primaryBtn = {
  width: "100%", marginTop: 8, padding: "12px 16px", background: C.accent, color: "#1A0D06",
  border: "none", borderRadius: 8, ...fontBody, fontWeight: 700, fontSize: 14, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
};
const secondaryBtn = {
  padding: "9px 14px", background: "transparent", color: C.text, border: `1px solid ${C.border}`,
  borderRadius: 8, ...fontBody, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
};
const iconBtn = { background: "none", border: "none", color: C.textDim, cursor: "pointer", padding: 6 };

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
            <Field label="Username" value={form.username} onChange={(v) => setForm({ ...form, username: v })} />
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
    <div style={{ borderBottom: `1px solid ${C.border}`, padding: "18px 20px" }}>
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

// ---------- Client workspace (used by both trainer viewing a client, and the client themself) ----------
function ClientWorkspace({ client, isTrainer, viewerId, onBack, onLogout }) {
  const [tab, setTab] = useState("programma");
  const [program, setProgram] = useState(null);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const p = await fetchProgram(client.id);
    const pr = await fetchProgress(client.id);
    setProgram(p);
    setProgress(pr);
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

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <FontImport />
      <Header
        title={isTrainer ? client.name : `Ciao, ${client.name}`}
        subtitle={isTrainer ? "Scheda cliente" : "Il tuo percorso"}
        onBack={isTrainer ? onBack : undefined}
        onLogout={onLogout}
      />
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 20px 60px" }}>
        <div style={{ display: "flex", gap: 8, marginTop: 20, marginBottom: 6 }}>
          <TabBtn active={tab === "programma"} onClick={() => setTab("programma")} icon={<Dumbbell size={15} />} label="Programma" />
          <TabBtn active={tab === "progressi"} onClick={() => setTab("progressi")} icon={<TrendingUp size={15} />} label="Progressi" />
        </div>
        <TapeDivider />

        {loading ? (
          <p style={{ ...fontBody, color: C.textDim }}>Caricamento...</p>
        ) : tab === "programma" ? (
          <ProgramSection program={program} isTrainer={isTrainer} clientId={client.id} trainerId={viewerId} onSave={saveProgram} />
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

// ---------- Program section (weekly schedule + block-based days: singolo/superset/circuito) ----------
function blockLabel(dayIndexIgnored, blockIndex) {
  return String.fromCharCode(65 + blockIndex); // A, B, C...
}
function blockKind(block) {
  if (block.exercises.length <= 1) return "Singolo";
  if (block.exercises.length === 2) return "Superset";
  return "Circuito";
}

function WeekStrip({ days }) {
  const today = todayCode();
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
      {WEEKDAYS.map((wd) => {
        const scheduled = days.some((d) => (d.weekdays || []).includes(wd.code));
        const isToday = wd.code === today;
        return (
          <div
            key={wd.code}
            style={{
              flex: 1, textAlign: "center", padding: "8px 2px", borderRadius: 8,
              background: scheduled ? C.accentSoft : C.panel,
              border: `1px solid ${isToday ? C.accent : C.border}`,
            }}
          >
            <div style={{ ...fontMono, fontSize: 10, color: scheduled ? C.accent : C.textDim }}>{wd.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function ProgramSection({ program, isTrainer, clientId, trainerId, onSave }) {
  const [editing, setEditing] = useState(isTrainer && program.days.length === 0);
  const [days, setDays] = useState(program.days);
  const [videoModal, setVideoModal] = useState(null);
  const [loadModalEx, setLoadModalEx] = useState(null);
  const [library, setLibrary] = useState([]);

  useEffect(() => { setDays(program.days); }, [program]);
  useEffect(() => { if (isTrainer && trainerId) loadLibrary(trainerId).then(setLibrary); }, [isTrainer, trainerId]);

  const newExercise = () => ({ id: uid(), name: "", reps: "", note: "", videoUrl: "" });
  const newBlock = () => ({ id: uid(), rounds: "3", restBetweenExercises: "", restAfterRound: "90s", exercises: [newExercise()] });

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
          .filter((b) => b.exercises.length > 0), // drop a block left with no exercises
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
        <datalist id="misura-exercise-library">
          {library.map((l) => <option key={l.name} value={l.displayName || l.name} />)}
        </datalist>
        {library.length > 0 && (
          <p style={{ ...fontBody, fontSize: 12, color: C.textDim, marginBottom: 10 }}>
            Digitando il nome di un esercizio già usato, il link video si compila da solo.
          </p>
        )}
        {days.map((day) => (
          <div key={day.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
              <input
                value={day.label}
                onChange={(e) => updateDayLabel(day.id, e.target.value)}
                style={{ ...fontDisplay, fontSize: 18, color: C.text, background: "transparent", border: "none", borderBottom: `1px solid ${C.border}`, flex: 1, outline: "none", padding: "4px 0" }}
              />
              <button onClick={() => removeDay(day.id)} style={iconBtn}><Trash2 size={16} /></button>
            </div>

            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {WEEKDAYS.map((wd) => {
                const active = day.weekdays.includes(wd.code);
                return (
                  <button
                    key={wd.code}
                    onClick={() => toggleWeekday(day.id, wd.code)}
                    style={{
                      padding: "5px 10px", borderRadius: 20, border: `1px solid ${active ? C.accent : C.border}`,
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
              <div key={block.id} style={{ background: C.panelHi, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ ...fontMono, fontSize: 12, color: C.accent, letterSpacing: "0.08em" }}>
                    BLOCCO {blockLabel(0, bi)} · {blockKind(block).toUpperCase()}
                  </span>
                  <button onClick={() => removeBlock(day.id, block.id)} style={iconBtn}><Trash2 size={14} /></button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                  <input placeholder="Giri/serie" value={block.rounds} onChange={(e) => updateBlockField(day.id, block.id, "rounds", e.target.value)} style={miniInput} />
                  {block.exercises.length > 1 && (
                    <input placeholder="Rec. tra esercizi" value={block.restBetweenExercises} onChange={(e) => updateBlockField(day.id, block.id, "restBetweenExercises", e.target.value)} style={miniInput} />
                  )}
                  <input placeholder="Rec. dopo il giro" value={block.restAfterRound} onChange={(e) => updateBlockField(day.id, block.id, "restAfterRound", e.target.value)} style={miniInput} />
                </div>

                {block.exercises.map((ex, ei) => (
                  <div key={ex.id} style={{ display: "grid", gridTemplateColumns: "auto 1.4fr 0.6fr 1fr auto", gap: 8, marginBottom: 6, alignItems: "center" }}>
                    <span style={{ ...fontMono, fontSize: 11, color: C.textDim, width: 22 }}>
                      {blockLabel(0, bi)}{block.exercises.length > 1 ? ei + 1 : ""}
                    </span>
                    <input
                      placeholder="Esercizio"
                      value={ex.name}
                      list="misura-exercise-library"
                      onChange={(e) => updateExerciseField(day.id, block.id, ex.id, "name", e.target.value)}
                      style={miniInput}
                    />
                    <input placeholder="Rip." value={ex.reps} onChange={(e) => updateExerciseField(day.id, block.id, ex.id, "reps", e.target.value)} style={miniInput} />
                    <input placeholder="Link video" value={ex.videoUrl} onChange={(e) => updateExerciseField(day.id, block.id, ex.id, "videoUrl", e.target.value)} style={miniInput} />
                    <button onClick={() => removeExerciseFromBlock(day.id, block.id, ex.id)} style={iconBtn}><X size={14} /></button>
                  </div>
                ))}
                <button onClick={() => addExerciseToBlock(day.id, block.id)} style={{ ...secondaryBtn, marginTop: 4, fontSize: 12, padding: "6px 10px" }}>
                  <Plus size={12} /> Esercizio in superset/circuito
                </button>
              </div>
            ))}

            <button onClick={() => addBlock(day.id)} style={{ ...secondaryBtn, marginTop: 4 }}>
              <Plus size={14} /> Blocco (esercizio singolo)
            </button>
          </div>
        ))}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={addDay} style={secondaryBtn}><Plus size={14} /> Giorno</button>
          <button onClick={save} style={primaryBtn2}><Check size={16} /> Salva programma</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {isTrainer && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button onClick={() => setEditing(true)} style={secondaryBtn}>Modifica programma</button>
        </div>
      )}
      {days.length > 0 && <WeekStrip days={days} />}
      {days.length === 0 ? (
        <EmptyState icon={<Dumbbell size={26} color={C.textDim} />} text={isTrainer ? "Nessun programma caricato ancora." : "Il trainer non ha ancora caricato un programma."} />
      ) : (
        days.map((day) => {
          const isToday = (day.weekdays || []).includes(todayCode());
          return (
            <div key={day.id} style={{ marginBottom: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <h3 style={{ ...fontDisplay, fontSize: 20, color: C.text, margin: 0 }}>{day.label}</h3>
                {isToday && (
                  <span style={{ ...fontMono, fontSize: 10, color: C.accent, border: `1px solid ${C.accent}`, borderRadius: 12, padding: "2px 8px" }}>OGGI</span>
                )}
              </div>
              {day.weekdays && day.weekdays.length > 0 && (
                <p style={{ ...fontMono, fontSize: 11, color: C.textDim, marginBottom: 10 }}>
                  {day.weekdays.map((c) => WEEKDAYS.find((w) => w.code === c)?.label).join(" · ")}
                </p>
              )}
              {day.blocks.map((block, bi) => (
                <div key={block.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ ...fontMono, fontSize: 11, color: C.accent, letterSpacing: "0.08em" }}>
                      {blockKind(block).toUpperCase()} {blockLabel(0, bi)}
                    </span>
                    <span style={{ ...fontMono, fontSize: 11, color: C.textDim }}>
                      x{block.rounds || "–"} giri
                      {block.exercises.length > 1 && block.restBetweenExercises && ` · rec. tra es. ${block.restBetweenExercises}`}
                      {block.restAfterRound && ` · rec. giro ${block.restAfterRound}`}
                    </span>
                  </div>
                  {block.exercises.map((ex, ei) => (
                    <div key={ex.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderTop: ei > 0 ? `1px dashed ${C.border}` : "none" }}>
                      <div>
                        <p style={{ ...fontBody, fontWeight: 600, color: C.text, marginBottom: 2 }}>
                          {block.exercises.length > 1 && <span style={{ ...fontMono, color: C.accent, marginRight: 6 }}>{blockLabel(0, bi)}{ei + 1}</span>}
                          {ex.name || "—"}
                        </p>
                        <p style={{ ...fontMono, fontSize: 12, color: C.textDim }}>{ex.reps || "–"} rip.</p>
                        {ex.note && <p style={{ ...fontBody, fontSize: 12, color: C.textDim, marginTop: 2 }}>{ex.note}</p>}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        {ex.videoUrl ? (
                          <button onClick={() => setVideoModal(ex.videoUrl)} style={{ ...secondaryBtn, borderColor: C.accent, color: C.accent }}>
                            <PlayCircle size={16} /> Esecuzione
                          </button>
                        ) : (
                          <span style={{ color: C.textDim, opacity: 0.5, alignSelf: "center" }}><ImageOff size={16} /></span>
                        )}
                        {ex.name && (
                          <button onClick={() => setLoadModalEx(ex.name)} style={secondaryBtn}>
                            <TrendingUp size={16} /> Carichi
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

const miniInput = {
  padding: "8px 10px", background: C.panelHi, border: `1px solid ${C.border}`, borderRadius: 6,
  color: C.text, ...fontBody, fontSize: 13, outline: "none",
};

// ---------- Progress section ----------
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
        <button onClick={() => setShowForm((s) => !s)} style={primaryBtn2}><Plus size={16} /> Nuova rilevazione</button>
      </div>

      {showForm && (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Data" value={form.date} onChange={(v) => setForm({ ...form, date: v })} type="date" />
            <Field label="Peso (kg)" value={form.weight} onChange={(v) => setForm({ ...form, weight: v })} type="number" />
            <Field label="Vita (cm)" value={form.vita} onChange={(v) => setForm({ ...form, vita: v })} />
            <Field label="Petto (cm)" value={form.petto} onChange={(v) => setForm({ ...form, petto: v })} />
            <Field label="Braccio (cm)" value={form.braccio} onChange={(v) => setForm({ ...form, braccio: v })} />
            <Field label="Coscia (cm)" value={form.coscia} onChange={(v) => setForm({ ...form, coscia: v })} />
          </div>
          <Field label="Nota" value={form.note} onChange={(v) => setForm({ ...form, note: v })} />
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, cursor: "pointer", ...fontBody, fontSize: 13, color: C.textDim }}>
            <Camera size={16} /> {photoBusy ? "Elaborazione..." : form.photo ? "Foto pronta" : "Aggiungi foto"}
            <input type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />
          </label>
          <button onClick={submit} style={primaryBtn}>Salva rilevazione</button>
        </div>
      )}

      {entries.length === 0 ? (
        <EmptyState icon={<TrendingUp size={26} color={C.textDim} />} text="Ancora nessuna rilevazione. Aggiungi la prima per iniziare a vedere l'andamento." />
      ) : (
        <>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 8px 8px", marginBottom: 20, height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 16, left: -10, bottom: 5 }}>
                <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: C.textDim, fontSize: 11 }} />
                <YAxis tick={{ fill: C.textDim, fontSize: 11 }} domain={["auto", "auto"]} />
                <Tooltip contentStyle={{ background: C.panelHi, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text }} />
                <Line type="monotone" dataKey="peso" stroke={C.accent} strokeWidth={2} dot={{ r: 3 }} name="Peso (kg)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...entries].reverse().map((e) => (
              <div key={e.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, display: "flex", gap: 12, alignItems: "center" }}>
                {e.photo ? (
                  <img src={e.photo} alt="Progresso" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.border}` }} />
                ) : (
                  <div style={{ width: 52, height: 52, borderRadius: 8, background: C.panelHi, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ImageOff size={18} color={C.textDim} />
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ ...fontBody, fontWeight: 600, color: C.text, fontSize: 13 }}>{fmtDate(e.date)}</span>
                    <span style={{ ...fontMono, color: C.accent, fontSize: 13 }}>{e.weight} kg</span>
                  </div>
                  <p style={{ ...fontMono, fontSize: 11, color: C.textDim, marginTop: 2 }}>
                    {e.measurements?.vita && `vita ${e.measurements.vita}cm `}
                    {e.measurements?.petto && `· petto ${e.measurements.petto}cm `}
                    {e.measurements?.braccio && `· braccio ${e.measurements.braccio}cm `}
                    {e.measurements?.coscia && `· coscia ${e.measurements.coscia}cm`}
                  </p>
                  {e.note && <p style={{ ...fontBody, fontSize: 12, color: C.textDim, marginTop: 2 }}>{e.note}</p>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Root App ----------
export default function App() {
  const [screen, setScreen] = useState("checking");
  const [profile, setProfile] = useState(null);
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(null);

  // On load, resume an existing session if there is one
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
      // Email confirmation is still required in the Supabase project settings
      cb("Account creato, ma serve disabilitare la conferma email in Supabase (Authentication → Providers → Email) prima di poter accedere subito.");
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
