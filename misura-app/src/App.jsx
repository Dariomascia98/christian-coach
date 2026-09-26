// ---------- Intake section ----------
const ACTIVITY_LEVELS = [
  { value: "sedentario", label: "Sedentario", mult: 1.2 },
  { value: "leggero", label: "Leggero (1-3 giorni/sett.)", mult: 1.375 },
  { value: "moderato", label: "Moderato (3-5 giorni/sett.)", mult: 1.55 },
  { value: "intenso", label: "Intenso (6-7 giorni/sett.)", mult: 1.725 },
  { value: "molto_intenso", label: "Molto intenso (atleta/lavoro fisico)", mult: 1.9 },
];

function calcBmrTdee({ sex, birthDate, heightCm, startingWeight, activityLevel }) {
  if (!birthDate || !heightCm || !startingWeight) return null;
  const age = Math.floor((new Date() - new Date(birthDate)) / 31557600000);
  const h = parseFloat(heightCm), w = parseFloat(startingWeight);
  if (!age || !h || !w) return null;
  const bmr = sex === "F" ? 10 * w + 6.25 * h - 5 * age - 161 : 10 * w + 6.25 * h - 5 * age + 5;
  const level = ACTIVITY_LEVELS.find((l) => l.value === activityLevel) || ACTIVITY_LEVELS[1];
  return { bmr: Math.round(bmr), tdee: Math.round(bmr * level.mult), age };
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

  const handleSave = () => {
    onSave(form);
    setEditing(false);
  };

  const calc = calcBmrTdee(form);

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ ...fontDisplay, fontSize: 22, color: C.text, margin: 0 }}>SCHEDA ANAMNESI</h3>
        {isTrainer && (
          <button
            onClick={() => {
              if (editing) handleSave();
              else setEditing(true);
            }}
            style={secondaryBtn}
          >
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
              <select
                value={form.sex}
                onChange={(e) => setForm({ ...form, sex: e.target.value })}
                style={{
                  display: "block", width: "100%", marginTop: 6, padding: "10px 12px",
                  background: C.panelHi, border: `1px solid ${C.border}`, borderRadius: 8,
                  color: C.text, ...fontBody, fontSize: 14, outline: "none"
                }}
              >
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
            <select
              value={form.activityLevel}
              onChange={(e) => setForm({ ...form, activityLevel: e.target.value })}
              style={{
                display: "block", width: "100%", marginTop: 6, padding: "10px 12px",
                background: C.panelHi, border: `1px solid ${C.border}`, borderRadius: 8,
                color: C.text, ...fontBody, fontSize: 14, outline: "none"
              }}
            >
              {ACTIVITY_LEVELS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
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
function ProgramSection({ program, isTrainer, clientId, clientName, trainerId, siblingClients = [], onSave }) {
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [activeVideoUrl, setActiveVideoUrl] = useState(null);
  const [activeLoadExercise, setActiveLoadExercise] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const days = program?.days || [];
  const currentDay = days[activeDayIdx] || null;

  const handleUpdateProgram = (newDays) => {
    onSave({ ...program, days: newDays });
  };

  const addDay = () => {
    const newDay = {
      id: uid(),
      label: `GIORNO ${days.length + 1}`,
      weekdays: [],
      blocks: []
    };
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
    const updated = [...days];
    const newBlock = {
      id: uid(),
      rounds: "3",
      restBetweenExercises: "",
      restAfterRound: "90''",
      exercises: [{ id: uid(), name: "", reps: "10-12", note: "", videoUrl: "" }]
    };
    updated[dayIdx].blocks = [...(updated[dayIdx].blocks || []), newBlock];
    handleUpdateProgram(updated);
  };

  const deleteBlock = (dayIdx, blockIdx) => {
    const updated = [...days];
    updated[dayIdx].blocks = updated[dayIdx].blocks.filter((_, i) => i !== blockIdx);
    handleUpdateProgram(updated);
  };

  const addExercise = (dayIdx, blockIdx) => {
    const updated = [...days];
    const newEx = { id: uid(), name: "", reps: "10", note: "", videoUrl: "" };
    updated[dayIdx].blocks[blockIdx].exercises.push(newEx);
    handleUpdateProgram(updated);
  };

  const deleteExercise = (dayIdx, blockIdx, exIdx) => {
    const updated = [...days];
    updated[dayIdx].blocks[blockIdx].exercises = updated[dayIdx].blocks[blockIdx].exercises.filter((_, i) => i !== exIdx);
    handleUpdateProgram(updated);
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
      {activeVideoUrl && <VideoModal url={activeVideoUrl} onClose={() => setActiveVideoUrl(null)} />}
      {activeLoadExercise && (
        <LoadModal exerciseName={activeLoadExercise} clientId={clientId} onClose={() => setActiveLoadExercise(null)} />
      )}

      {/* Control Header */}
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <h3 style={{ ...fontDisplay, fontSize: 22, color: C.text, margin: 0 }}>
          {isTrainer ? `PROGRAMMA DI ${clientName?.toUpperCase() || ""}` : "IL TUO PROGRAMMA"}
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

      {/* Copy tool */}
      {isTrainer && isEditing && siblingClients.length > 0 && (
        <div className="no-print" style={{ background: C.panelHi, padding: 12, borderRadius: 8, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <Copy size={16} color={C.accent} />
          <span style={{ ...fontBody, fontSize: 13, color: C.textDim }}>Copia programma da:</span>
          <select
            onChange={(e) => copyFromClient(e.target.value)}
            defaultValue=""
            style={{ background: C.panel, color: C.text, border: `1px solid ${C.border}`, padding: "6px 10px", borderRadius: 6, fontSize: 13 }}
          >
            <option value="" disabled>Seleziona cliente...</option>
            {siblingClients.filter((c) => c.id !== clientId).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Day Selector Tabs */}
      {days.length > 0 && (
        <div className="no-print" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 16 }}>
          {days.map((day, idx) => (
            <button
              key={day.id || idx}
              onClick={() => setActiveDayIdx(idx)}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                background: activeDayIdx === idx ? C.panelHi : C.panel,
                border: `1px solid ${activeDayIdx === idx ? C.accent : C.border}`,
                color: activeDayIdx === idx ? C.text : C.textDim,
                ...fontBody,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap"
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
        <EmptyState
          icon={<Dumbbell size={28} color={C.textDim} />}
          text={isTrainer ? "Nessun giorno di allenamento ancora creato. Clicca su Modifica per iniziare." : "Nessun programma ancora assegnato dal tuo trainer."}
        />
      ) : currentDay ? (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            {isEditing ? (
              <input
                value={currentDay.label}
                onChange={(e) => {
                  const updated = [...days];
                  updated[activeDayIdx].label = e.target.value;
                  handleUpdateProgram(updated);
                }}
                style={{ background: C.panelHi, border: `1px solid ${C.border}`, color: C.text, padding: "6px 10px", borderRadius: 6, ...fontDisplay, fontSize: 20 }}
              />
            ) : (
              <h2 style={{ ...fontDisplay, fontSize: 24, color: C.accent, margin: 0 }}>{currentDay.label}</h2>
            )}

            {isEditing && (
              <button onClick={() => deleteDay(activeDayIdx)} style={iconBtn} title="Elimina Giorno">
                <Trash2 size={18} color={C.accent} />
              </button>
            )}
          </div>

          {isEditing && (
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              {WEEKDAYS.map((w) => {
                const active = (currentDay.weekdays || []).includes(w.code);
                return (
                  <button
                    key={w.code}
                    onClick={() => {
                      const updated = [...days];
                      const curWd = updated[activeDayIdx].weekdays || [];
                      updated[activeDayIdx].weekdays = active ? curWd.filter((c) => c !== w.code) : [...curWd, w.code];
                      handleUpdateProgram(updated);
                    }}
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

          {/* Blocks */}
          {(currentDay.blocks || []).map((block, bIdx) => (
            <div key={block.id || bIdx} style={{ background: C.panelHi, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
                <span style={{ ...fontMono, fontSize: 12, color: C.textDim }}>BLOCCO #{bIdx + 1}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ ...fontMono, fontSize: 11, color: C.textDim }}>SERIE:</span>
                    {isEditing ? (
                      <input
                        value={block.rounds || ""}
                        onChange={(e) => {
                          const updated = [...days];
                          updated[activeDayIdx].blocks[bIdx].rounds = e.target.value;
                          handleUpdateProgram(updated);
                        }}
                        style={{ width: 50, background: C.panel, color: C.text, border: `1px solid ${C.border}`, borderRadius: 4, padding: "2px 6px", fontSize: 12 }}
                      />
                    ) : (
                      <span style={{ ...fontMono, fontSize: 12, color: C.accent, fontWeight: 700 }}>{block.rounds}</span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ ...fontMono, fontSize: 11, color: C.textDim }}>RECUPERO:</span>
                    {isEditing ? (
                      <input
                        value={block.restAfterRound || ""}
                        onChange={(e) => {
                          const updated = [...days];
                          updated[activeDayIdx].blocks[bIdx].restAfterRound = e.target.value;
                          handleUpdateProgram(updated);
                        }}
                        style={{ width: 60, background: C.panel, color: C.text, border: `1px solid ${C.border}`, borderRadius: 4, padding: "2px 6px", fontSize: 12 }}
                      />
                    ) : (
                      <span style={{ ...fontMono, fontSize: 12, color: C.text }}>{block.restAfterRound}</span>
                    )}
                  </div>
                  {isEditing && (
                    <button onClick={() => deleteBlock(activeDayIdx, bIdx)} style={iconBtn} title="Elimina blocco">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* Exercises inside block */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(block.exercises || []).map((ex, exIdx) => (
                  <div key={ex.id || exIdx} style={{ background: C.panel, borderRadius: 8, padding: 10, border: `1px solid ${C.border}` }}>
                    {isEditing ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            placeholder="Nome Esercizio"
                            value={ex.name || ""}
                            onChange={(e) => {
                              const updated = [...days];
                              updated[activeDayIdx].blocks[bIdx].exercises[exIdx].name = e.target.value;
                              handleUpdateProgram(updated);
                            }}
                            style={{ flex: 2, background: C.panelHi, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 13 }}
                          />
                          <input
                            placeholder="Ripetizioni"
                            value={ex.reps || ""}
                            onChange={(e) => {
                              const updated = [...days];
                              updated[activeDayIdx].blocks[bIdx].exercises[exIdx].reps = e.target.value;
                              handleUpdateProgram(updated);
                            }}
                            style={{ flex: 1, background: C.panelHi, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 13 }}
                          />
                          <button onClick={() => deleteExercise(activeDayIdx, bIdx, exIdx)} style={iconBtn}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            placeholder="Link Video YouTube (opzionale)"
                            value={ex.videoUrl || ""}
                            onChange={(e) => {
                              const updated = [...days];
                              updated[activeDayIdx].blocks[bIdx].exercises[exIdx].videoUrl = e.target.value;
                              handleUpdateProgram(updated);
                            }}
                            style={{ flex: 1, background: C.panelHi, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 12 }}
                          />
                          <input
                            placeholder="Note / Istruzioni"
                            value={ex.note || ""}
                            onChange={(e) => {
                              const updated = [...days];
                              updated[activeDayIdx].blocks[bIdx].exercises[exIdx].note = e.target.value;
                              handleUpdateProgram(updated);
                            }}
                            style={{ flex: 1, background: C.panelHi, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 12 }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ ...fontBody, fontWeight: 600, color: C.text, fontSize: 14 }}>{ex.name || "Esercizio"}</span>
                            {ex.videoUrl && (
                              <button onClick={() => setActiveVideoUrl(ex.videoUrl)} style={iconBtn} title="Guarda video demo">
                                <PlayCircle size={18} color={C.accent} />
                              </button>
                            )}
                          </div>
                          {ex.note && <p style={{ ...fontBody, fontSize: 12, color: C.textDim, margin: "2px 0 0" }}>{ex.note}</p>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ ...fontMono, fontSize: 13, color: C.positive, fontWeight: 600 }}>{ex.reps} rip</span>
                          <button onClick={() => setActiveLoadExercise(ex.name)} style={secondaryBtn} title="Registra/Visualizza carichi">
                            <Dumbbell size={14} /> Carichi
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {isEditing && (
                  <button onClick={() => addExercise(activeDayIdx, bIdx)} style={{ ...secondaryBtn, justifyContent: "center", borderStyle: "dashed" }}>
                    <Plus size={14} /> Aggiungi Esercizio
                  </button>
                )}
              </div>
            </div>
          ))}

          {isEditing && (
            <button onClick={() => addBlock(activeDayIdx)} style={{ ...primaryBtn, marginTop: 10 }}>
              <Plus size={16} /> Aggiungi Blocco
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ---------- Progress Section ----------
function ProgressSection({ entries, onAdd }) {
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
      const resized = await resizeImage(file, 600, 0.7);
      setPhoto(resized);
    } catch (err) {
      console.error(err);
    } finally {
      setPhotoProcessing(false);
    }
  };

  const submitEntry = () => {
    if (!weight) return;
    const newEntry = {
      id: uid(),
      date,
      weight: parseFloat(weight),
      waist: waist ? parseFloat(waist) : null,
      chest: chest ? parseFloat(chest) : null,
      hips: hips ? parseFloat(hips) : null,
      notes,
      photo
    };
    onAdd(newEntry);
    setShowAdd(false);
    setWeight("");
    setWaist("");
    setChest("");
    setHips("");
    setNotes("");
    setPhoto(null);
  };

  const chartData = entries
    .filter((e) => e.weight)
    .map((e) => ({
      date: fmtDate(e.date),
      peso: e.weight
    }));

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

      {/* Chart */}
      {chartData.length > 0 && (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
          <h4 style={{ ...fontDisplay, fontSize: 18, color: C.text, margin: "0 0 12px" }}>ANDAMENTO PESO (KG)</h4>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: C.textDim, fontSize: 10 }} />
                <YAxis tick={{ fill: C.textDim, fontSize: 10 }} domain={["auto", "auto"]} />
                <Tooltip contentStyle={{ background: C.panelHi, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text }} />
                <Line type="monotone" dataKey="peso" stroke={C.accent} strokeWidth={2} dot={{ r: 4 }} name="Peso (kg)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* History */}
      {entries.length === 0 ? (
        <EmptyState icon={<TrendingUp size={28} color={C.textDim} />} text="Nessun dato sul peso o misurazioni inserito finora." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[...entries].reverse().map((entry) => (
            <div key={entry.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, display: "flex", gap: 14, alignItems: "center" }}>
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
                {entry.notes && <p style={{ ...fontBody, fontSize: 12, color: C.text, margin: "4px 0 0" }}>{entry.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Main App Component ----------
export default function App() {
  const [screen, setScreen] = useState("welcome");
  const [userProfile, setUserProfile] = useState(null);
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [loading, setLoading] = useState(true);

  const initUser = async (userId) => {
    setLoading(true);
    const prof = await fetchProfile(userId);
    if (prof) {
      setUserProfile(prof);
      if (prof.role === "trainer") {
        const cls = await fetchClients(prof.id);
        setClients(cls);
        setScreen("dashboard");
      } else {
        setScreen("workspace");
      }
    } else {
      setScreen("welcome");
    }
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        initUser(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        initUser(session.user.id);
      } else {
        setUserProfile(null);
        setScreen("welcome");
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async ({ username, password }, cb) => {
    const email = username.includes("@") ? username : `${username.toLowerCase()}@chriscoach.app`;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      cb(mapAuthError(error));
    } else if (data.user) {
      await initUser(data.user.id);
      cb(null);
    }
  };

  const handleTrainerSetup = async ({ name, username, password }, cb) => {
    const email = username.includes("@") ? username : `${username.toLowerCase()}@chriscoach.app`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role: "trainer" } }
    });
    if (error) {
      cb(mapAuthError(error));
      return;
    }
    if (data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        name,
        username,
        role: "trainer"
      });
      await initUser(data.user.id);
      cb(null);
    }
  };

  const handleClientRegister = async ({ name, username, password }, cb) => {
    const email = username.includes("@") ? username : `${username.toLowerCase()}@chriscoach.app`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role: "client" } }
    });
    if (error) {
      cb(mapAuthError(error));
      return;
    }
    if (data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        name,
        username,
        role: "client"
      });
      cb(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUserProfile(null);
    setSelectedClientId(null);
    setScreen("welcome");
  };

  const handleDeleteClient = async (clientId) => {
    await supabase.from("profiles").delete().eq("id", clientId);
    if (userProfile) {
      const cls = await fetchClients(userProfile.id);
      setClients(cls);
    }
  };

  if (loading) {
    return (
      <div style={{ ...wrapStyle, flexDirection: "column", gap: 12 }}>
        <FontImport />
        <Logo />
        <p style={{ ...fontBody, color: C.textDim, fontSize: 14 }}>Caricamento in corso...</p>
      </div>
    );
  }

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  return (
    <>
      {screen === "welcome" && (
        <WelcomeScreen
          onGoLogin={() => setScreen("login")}
          onGoClientRegister={() => setScreen("client_register")}
          onGoSetup={() => setScreen("setup")}
        />
      )}

      {screen === "login" && (
        <LoginScreen
          onSubmit={handleLogin}
          onBack={() => setScreen("welcome")}
          onGoRegister={() => setScreen("client_register")}
        />
      )}

      {screen === "setup" && (
        <SetupScreen
          onSubmit={handleTrainerSetup}
          onBack={() => setScreen("welcome")}
        />
      )}

      {screen === "client_register" && (
        <ClientRegisterScreen
          onSubmit={handleClientRegister}
          onBack={() => setScreen("welcome")}
        />
      )}

      {screen === "dashboard" && userProfile?.role === "trainer" && !selectedClientId && (
        <TrainerDashboard
          trainer={userProfile}
          clients={clients}
          onSelectClient={(id) => {
            setSelectedClientId(id);
            setScreen("workspace");
          }}
          onDeleteClient={handleDeleteClient}
          onLogout={handleLogout}
        />
      )}

      {screen === "workspace" && userProfile?.role === "trainer" && selectedClient && (
        <ClientWorkspace
          client={selectedClient}
          isTrainer={true}
          viewerId={userProfile.id}
          siblingClients={clients}
          onBack={() => {
            setSelectedClientId(null);
            setScreen("dashboard");
          }}
          onLogout={handleLogout}
        />
      )}

      {screen === "workspace" && userProfile?.role === "client" && (
        <ClientWorkspace
          client={userProfile}
          isTrainer={false}
          viewerId={userProfile.id}
          siblingClients={[]}
          onBack={undefined}
          onLogout={handleLogout}
        />
      )}
    </>
  );
}
