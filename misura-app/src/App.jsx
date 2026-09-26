import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import {
  Save, Edit2, Check, Printer, Copy, Plus, Trash2,
  Dumbbell, PlayCircle, Camera, X, ImageOff, TrendingUp
} from 'lucide-react';

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
// APP PRINCIPALE (Senza schermate di login bloccanti)
// ============================================================
export default function App() {
  const [tab, setTab] = useState("intake");
  const [intake, setIntake] = useState({
    birthDate: "1995-05-15",
    sex: "M",
    heightCm: "180",
    startingWeight: "78",
    activityLevel: "moderato",
    goal: "Ipertrofia e ricomposizione corporea",
    injuries: "Nessuna",
    notes: "Primo test applicazione"
  });

  const [program, setProgram] = useState({
    days: [
      {
        id: uid(),
        label: "GIORNO 1 - PETTO / TRICIPITI",
        weekdays: ["1"],
        blocks: [
          {
            id: uid(),
            rounds: "4",
            restAfterRound: "120''",
            exercises: [
              { id: uid(), name: "Panca Piana Bilanciere", reps: "8-10", note: "Controlled eccentric", videoUrl: "" },
              { id: uid(), name: "Spinte Manubri su Inclinata", reps: "10-12", note: "30° tilt", videoUrl: "" }
            ]
          }
        ]
      }
    ]
  });

  const [entries, setEntries] = useState([
    { id: uid(), date: "2026-06-01", weight: 78.5, waist: 82, chest: 104, hips: 98, notes: "Inizio percorso", photo: null }
  ]);

  const handleSaveIntake = (newForm) => {
    setIntake(newForm);
  };

  const handleSaveProgram = (newProg) => {
    setProgram(newProg);
  };

  const handleAddProgress = (newEntry) => {
    setEntries((prev) => [...prev, newEntry]);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f12", padding: 24, color: C.text, ...fontBody }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        
        {/* Header di navigazione pulito */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ ...fontDisplay, fontSize: 24, color: C.text, margin: 0 }}>CHRIS COACH</h1>
            <p style={{ fontSize: 13, color: C.textDim, margin: "2px 0 0" }}>Gestionale Coaching & Atleti</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {["intake", "program", "progress"].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  ...secondaryBtn,
                  borderColor: tab === t ? C.accent : C.border,
                  color: tab === t ? C.accent : C.text,
                  background: tab === t ? C.panelHi : C.panel
                }}
              >
                {t === "intake" ? "Anamnesi" : t === "program" ? "Programma" : "Progressi"}
              </button>
            ))}
          </div>
        </div>

        {/* Contenuto dinamico delle sezioni */}
        {tab === "intake" && (
          <IntakeSection intake={intake} isTrainer={true} onSave={handleSaveIntake} />
        )}

        {tab === "program" && (
          <ProgramSection
            program={program}
            isTrainer={true}
            clientId="local-demo"
            clientName="Atleta Test"
            siblingClients={[]}
            onSave={handleSaveProgram}
          />
        )}

        {tab === "progress" && (
          <ProgressSection entries={entries} onAdd={handleAddProgress} />
        )}

      </div>
    </div>
  );
}

// ---------- Intake Section ----------
function IntakeSection({ intake = {}, isTrainer, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(intake);

  useEffect(() => { setForm(intake); }, [intake]);

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
function ProgramSection({ program, isTrainer, onSave }) {
  const safeProgram = program || { days: [] };
  const [activeDayIdx, setActiveDayIdx] = useState(0);
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
    if (!window.confirm("Eliminare questa giornata?")) return;
    const updated = days.filter((_, i) => i !== idx);
    handleUpdateProgram(updated);
    if (activeDayIdx >= updated.length) setActiveDayIdx(Math.max(0, updated.length - 1));
  };

  const addBlock = (dayIdx) => {
    const newBlock = { id: uid(), rounds: "3", restAfterRound: "90''", exercises: [{ id: uid(), name: "", reps: "10-12", note: "", videoUrl: "" }] };
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

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ ...fontDisplay, fontSize: 22, color: C.text, margin: 0 }}>PROGRAMMA DI ALLENAMENTO</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => window.print()} style={secondaryBtn}><Printer size={15} /> Stampa</button>
          {isTrainer && (
            <button onClick={() => setIsEditing(!isEditing)} style={{ ...secondaryBtn, color: isEditing ? C.accent : C.text }}>
              {isEditing ? <Check size={15} /> : <Edit2 size={15} />} {isEditing ? "Fine" : "Modifica"}
            </button>
          )}
        </div>
      </div>

      {days.length > 0 && (
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 16 }}>
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
            <button onClick={addDay} style={{ ...secondaryBtn, padding: "8px 12px" }}><Plus size={15} /> Giorno</button>
          )}
        </div>
      )}

      {currentDay ? (
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
              <button onClick={() => deleteDay(activeDayIdx)} style={{ ...iconBtn, color: C.danger }}><Trash2 size={16} /></button>
            )}
          </div>

          {(currentDay.blocks || []).map((block, blockIdx) => (
            <div key={block.id || blockIdx} style={{ background: C.panelHi, borderRadius: 10, padding: 14, marginBottom: 14, border: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ ...fontMono, fontSize: 12, color: C.accent }}>BLOCCO {blockIdx + 1}</span>
                {isEditing && (
                  <button onClick={() => deleteBlock(activeDayIdx, blockIdx)} style={{ ...iconBtn, color: C.danger }}><Trash2 size={14} /></button>
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
                      <button onClick={() => deleteExercise(activeDayIdx, blockIdx, exIdx)} style={{ ...iconBtn, color: C.danger }}><Trash2 size={14} /></button>
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
          ))}

          {isEditing && (
            <button onClick={() => addBlock(activeDayIdx)} style={{ ...primaryBtn, marginTop: 10 }}><Plus size={15} /> Aggiungi Blocco</button>
          )}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: 30, background: C.panel, borderRadius: 12, border: `1px solid ${C.border}` }}>
          <p style={{ color: C.textDim }}>Nessun programma presente.</p>
          {isTrainer && <button onClick={addDay} style={primaryBtn}><Plus size={15} /> Crea Giorno</button>}
        </div>
      )}
    </div>
  );
}

// ---------- Progress Section ----------
function ProgressSection({ entries, onAdd }) {
  const [showAdd, setShowAdd] = useState(false);
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = () => {
    if (!weight) return;
    onAdd({ id: uid(), date: new Date().toISOString().slice(0, 10), weight: parseFloat(weight), notes });
    setWeight(""); setNotes(""); setShowAdd(false);
  };

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ ...fontDisplay, fontSize: 22, color: C.text, margin: 0 }}>PROGRESSI</h3>
        <button onClick={() => setShowAdd(!showAdd)} style={primaryBtn}><Plus size={15} /> Nuova Misurazione</button>
      </div>

      {showAdd && (
        <div style={{ background: C.panelHi, padding: 14, borderRadius: 8, marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <Field label="Peso (kg)" type="number" value={weight} onChange={setWeight} />
          <Field label="Note" value={notes} onChange={setNotes} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSubmit} style={primaryBtn}>Salva</button>
            <button onClick={() => setShowAdd(false)} style={secondaryBtn}>Annulla</button>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <p style={{ color: C.textDim, fontSize: 14 }}>Nessuna misurazione registrata.</p>
      ) : (
        entries.map((en, idx) => (
          <div key={idx} style={{ padding: 12, background: C.panelHi, borderRadius: 8, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ ...fontMono, color: C.textDim, fontSize: 12 }}>{fmtDate(en.date)}</span>
            <span style={{ ...fontDisplay, color: C.positive, fontSize: 18 }}>{en.weight} kg</span>
          </div>
        ))
      )}
    </div>
  );
}
