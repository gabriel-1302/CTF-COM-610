import { useEffect, useRef, useState } from "react";
import { fetchChallenges, setCompetitionConfig } from "../../lib/api";
import type { Challenge, CompetitionConfig } from "../../lib/schemas";
import {
  IconCheck, IconX, IconSnowflake, IconExclamationTriangle,
  IconUser, IconFlag, IconShuffle, IconArrowLeft, IconArrowRight,
} from "./icons";

// ── Types ──────────────────────────────────────────────────────────────────────

type Mode = "individual" | "teams" | "mixed";

interface WizardState {
  // Paso 1
  name: string;
  description: string;
  mode: Mode;
  // Paso 2
  start_time: string;
  end_time: string;
  freeze_time: string;
  // Paso 3
  max_teams: string;
  max_members: string;
  registration_open: boolean;
  // Paso 4
  challenge_slugs: string[];   // vacío = todos
  // Paso 5
  dynamic_scoring: boolean;
  first_blood_bonus_pct: string;
}

interface Props {
  initial: CompetitionConfig;
  onClose: () => void;
  onSaved: (cfg: CompetitionConfig) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toISO(local: string): string | null {
  return local ? new Date(local).toISOString() : null;
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-BO", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Step indicators ────────────────────────────────────────────────────────────

const STEPS = ["Modalidad", "Tiempo", "Equipos", "Retos", "Scoring"];

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                style={{
                  background: done ? "var(--success)" : active ? "var(--primary)" : "var(--surface-alt)",
                  color: done || active ? "#fff" : "var(--text-faint)",
                  border: `2px solid ${done ? "var(--success)" : active ? "var(--primary)" : "var(--border)"}`,
                }}
              >
                {done ? <IconCheck className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span
                className="text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap"
                style={{ color: active ? "var(--primary)" : done ? "var(--success)" : "var(--text-faint)" }}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="h-0.5 flex-1 mx-1 mb-4 transition-all"
                style={{ background: done ? "var(--success)" : "var(--border)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Field components ───────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>{label}</span>
      {hint && <span className="block text-xs mb-1.5" style={{ color: "var(--text-faint)" }}>{hint}</span>}
      {children}
    </label>
  );
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-sm rounded-lg px-3 py-2"
      style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", color: "var(--text)" }}
    />
  );
}

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="datetime-local"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full text-sm rounded-lg px-3 py-2"
      style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", color: "var(--text)" }}
    />
  );
}

function NumberInput({ value, onChange, min = 1, placeholder }: { value: string; onChange: (v: string) => void; min?: number; placeholder?: string }) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(e.target.value)}
      min={min}
      placeholder={placeholder}
      className="w-full text-sm rounded-lg px-3 py-2"
      style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", color: "var(--text)" }}
    />
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{label}</span>
        {hint && <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
        style={{ background: checked ? "var(--primary)" : "var(--border)" }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
          style={{ transform: checked ? "translateX(20px)" : "translateX(0)" }}
        />
      </button>
    </div>
  );
}

// ── Step 1: Modalidad ──────────────────────────────────────────────────────────

const MODE_OPTIONS: { value: Mode; icon: React.ReactNode; label: string; desc: string }[] = [
  { value: "individual", icon: <IconUser className="w-6 h-6" />, label: "Individual", desc: "Cada estudiante compite por su cuenta. No se crean equipos." },
  { value: "teams",      icon: <IconFlag className="w-6 h-6" />, label: "Equipos",    desc: "Los estudiantes se agrupan en equipos. Deduplicación de solves por equipo." },
  { value: "mixed",      icon: <IconShuffle className="w-6 h-6" />, label: "Mixto",      desc: "Ambos scoreboards activos: individual y equipos simultáneamente." },
];

function Step1({ state, set }: { state: WizardState; set: (p: Partial<WizardState>) => void }) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        {MODE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => set({ mode: opt.value })}
            className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-left transition-all"
            style={{
              background: state.mode === opt.value ? "var(--primary-light)" : "var(--surface-alt)",
              border: `2px solid ${state.mode === opt.value ? "var(--primary)" : "var(--border)"}`,
            }}
          >
            <span className="flex items-center justify-center w-8 h-8 shrink-0" style={{ color: state.mode === opt.value ? "var(--primary)" : "var(--text-muted)" }}>{opt.icon}</span>
            <div className="flex-1">
              <div className="font-semibold text-sm" style={{ color: state.mode === opt.value ? "var(--primary)" : "var(--text)" }}>
                {opt.label}
              </div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{opt.desc}</div>
            </div>
            <div
              className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
              style={{ borderColor: state.mode === opt.value ? "var(--primary)" : "var(--border)" }}
            >
              {state.mode === opt.value && (
                <div className="w-2 h-2 rounded-full" style={{ background: "var(--primary)" }} />
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="h-px" style={{ background: "var(--border)" }} />

      <div className="space-y-3">
        <Field label="Nombre de la competencia">
          <TextInput value={state.name} onChange={v => set({ name: v })} placeholder="CTF USFX 2026" />
        </Field>
        <Field label="Descripción (opcional)">
          <textarea
            value={state.description}
            onChange={e => set({ description: e.target.value })}
            rows={2}
            placeholder="Competencia de selección para representantes nacionales..."
            className="w-full text-sm rounded-lg px-3 py-2 resize-none"
            style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", color: "var(--text)" }}
          />
        </Field>
      </div>
    </div>
  );
}

// ── Step 2: Tiempo ─────────────────────────────────────────────────────────────

function Step2({ state, set }: { state: WizardState; set: (p: Partial<WizardState>) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Inicio de la competencia" hint="Los flags no se pueden submitir antes de esta hora.">
        <DateInput value={state.start_time} onChange={v => set({ start_time: v })} />
      </Field>
      <Field label="Fin de la competencia" hint="Los flags no se pueden submitir después de esta hora.">
        <DateInput value={state.end_time} onChange={v => set({ end_time: v })} />
      </Field>
      <div
        className="rounded-xl p-4 space-y-3"
        style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <IconSnowflake className="w-4 h-4" style={{ color: "var(--primary)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>Freeze del scoreboard</span>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: "var(--primary-light)", color: "var(--primary)" }}
          >
            Opcional
          </span>
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          A partir de este momento el scoreboard se congela: los participantes no ven los cambios de posición hasta el reveal final.
        </p>
        <DateInput value={state.freeze_time} onChange={v => set({ freeze_time: v })} />
      </div>

      {state.start_time && state.end_time && new Date(state.start_time) >= new Date(state.end_time) && (
        <p className="text-xs font-medium px-3 py-2 rounded-lg flex items-center gap-1" style={{ background: "var(--error-bg)", color: "var(--error)" }}>
          <IconExclamationTriangle className="w-4 h-4 inline shrink-0" /> El inicio debe ser anterior al fin.
        </p>
      )}
    </div>
  );
}

// ── Step 3: Equipos ────────────────────────────────────────────────────────────

function Step3({ state, set }: { state: WizardState; set: (p: Partial<WizardState>) => void }) {
  if (state.mode === "individual") {
    return (
      <div className="text-center py-12 space-y-3">
        <IconUser className="w-10 h-10 mx-auto" style={{ color: "var(--text-muted)" }} />
        <p className="font-semibold" style={{ color: "var(--text)" }}>Modalidad Individual</p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No se configura nada de equipos en esta modalidad. Continúa al siguiente paso.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Máximo de equipos" hint="Deja vacío para ilimitado.">
          <NumberInput value={state.max_teams} onChange={v => set({ max_teams: v })} placeholder="Ilimitado" />
        </Field>
        <Field label="Miembros por equipo" hint="Mínimo 1.">
          <NumberInput value={state.max_members} onChange={v => set({ max_members: v })} min={1} />
        </Field>
      </div>

      <div className="h-px" style={{ background: "var(--border)" }} />

      <Toggle
        checked={state.registration_open}
        onChange={v => set({ registration_open: v })}
        label="Registro de equipos siempre abierto"
        hint="Si está desactivado, solo se puede crear/unirse a equipos durante el período de competencia."
      />
    </div>
  );
}

// ── Step 4: Scoring + Resumen ──────────────────────────────────────────────────

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span
        className="text-xs font-semibold"
        style={{ color: highlight ? "var(--primary)" : "var(--text)" }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Step 4: Retos ──────────────────────────────────────────────────────────────

const CATEGORIES: { label: string; slugs: string[] }[] = [
  { label: "Web", slugs: ["sqli", "cmdi", "xss", "lfi", "path-traversal", "ssti", "idor", "format-string", "jwt", "xxe"] },
  { label: "Criptografía", slugs: ["crypto-rsa", "crypto-vigenere"] },
  { label: "Forense", slugs: ["forensics-pcap", "stego"] },
];

function Step4Challenges({ state, set, allChallenges }: {
  state: WizardState;
  set: (p: Partial<WizardState>) => void;
  allChallenges: Challenge[];
}) {
  const allSlugs = allChallenges.map(c => c.slug);
  const selected = state.challenge_slugs;
  const isAll = selected.length === 0;

  const toggle = (slug: string) => {
    if (isAll) {
      // venía de "todos" → excluir este
      set({ challenge_slugs: allSlugs.filter(s => s !== slug) });
    } else if (selected.includes(slug)) {
      const next = selected.filter(s => s !== slug);
      set({ challenge_slugs: next.length === allSlugs.length ? [] : next });
    } else {
      const next = [...selected, slug];
      set({ challenge_slugs: next.length === allSlugs.length ? [] : next });
    }
  };

  const toggleCategory = (slugs: string[]) => {
    const activeSlugs = slugs.filter(s => allSlugs.includes(s));
    const currentSelected = isAll ? allSlugs : selected;
    const allCatSelected = activeSlugs.every(s => currentSelected.includes(s));
    let next: string[];
    if (allCatSelected) {
      next = currentSelected.filter(s => !activeSlugs.includes(s));
    } else {
      next = [...new Set([...currentSelected, ...activeSlugs])];
    }
    set({ challenge_slugs: next.length === allSlugs.length ? [] : next });
  };

  const isChecked = (slug: string) => isAll || selected.includes(slug);
  const selectedCount = isAll ? allSlugs.length : selected.length;

  if (allChallenges.length === 0) {
    return (
      <div className="text-center py-12" style={{ color: "var(--text-faint)" }}>
        <p className="text-2xl mb-2">⏳</p>
        <p className="text-sm">Cargando retos…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header con contador y botones globales */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
          {selectedCount} de {allSlugs.length} retos seleccionados
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => set({ challenge_slugs: [] })}
            className="text-xs px-2.5 py-1 rounded-lg font-medium"
            style={{ background: "var(--primary-light)", color: "var(--primary)", border: "1px solid var(--primary-border)" }}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => set({ challenge_slugs: ["__none__"] })}
            className="text-xs px-2.5 py-1 rounded-lg font-medium"
            style={{ background: "var(--surface-alt)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
          >
            Ninguno
          </button>
        </div>
      </div>

      {/* Lista agrupada por categoría */}
      <div className="space-y-3">
        {CATEGORIES.map(cat => {
          const catChallenges = cat.slugs
            .map(slug => allChallenges.find(c => c.slug === slug))
            .filter(Boolean) as Challenge[];
          if (catChallenges.length === 0) return null;
          const currentSelected = isAll ? allSlugs : selected;
          const allCatChecked = catChallenges.every(c => currentSelected.includes(c.slug));
          const someCatChecked = catChallenges.some(c => currentSelected.includes(c.slug));

          return (
            <div key={cat.label} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              {/* Cabecera de categoría */}
              <button
                type="button"
                onClick={() => toggleCategory(cat.slugs)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-left"
                style={{ background: "var(--surface-alt)" }}
              >
                <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{cat.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                    {catChallenges.filter(c => isChecked(c.slug)).length}/{catChallenges.length}
                  </span>
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center text-xs"
                    style={{
                      background: allCatChecked ? "var(--primary)" : someCatChecked ? "var(--primary-light)" : "var(--surface)",
                      border: `1.5px solid ${allCatChecked || someCatChecked ? "var(--primary)" : "var(--border)"}`,
                      color: allCatChecked ? "#fff" : "var(--primary)",
                    }}
                  >
                    {allCatChecked ? <IconCheck className="w-3 h-3" /> : someCatChecked ? "−" : ""}
                  </div>
                </div>
              </button>

              {/* Retos */}
              <div className="divide-y" style={{ borderTop: "1px solid var(--border)" }}>
                {catChallenges.map(c => (
                  <label
                    key={c.slug}
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors"
                    style={{ background: isChecked(c.slug) ? "var(--primary-light)" : "var(--surface)" }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked(c.slug)}
                      onChange={() => toggle(c.slug)}
                      className="w-4 h-4 rounded accent-primary flex-shrink-0"
                      style={{ accentColor: "var(--primary)" }}
                    />
                    <span className="flex-1 text-sm" style={{ color: "var(--text)" }}>{c.name}</span>
                    <span className="font-mono text-xs font-bold" style={{ color: "var(--primary)" }}>
                      {c.points} pts
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selected.includes("__none__") && (
        <p className="text-xs font-medium px-3 py-2 rounded-lg flex items-center gap-1" style={{ background: "var(--error-bg)", color: "var(--error)" }}>
          <IconExclamationTriangle className="w-4 h-4 inline shrink-0" /> Debes seleccionar al menos un reto.
        </p>
      )}
    </div>
  );
}

// ── Step 5: Scoring + Resumen ──────────────────────────────────────────────────

function Step4({ state, set }: { state: WizardState; set: (p: Partial<WizardState>) => void }) {
  const modeLabel = { individual: "Individual", teams: "Equipos", mixed: "Mixto" }[state.mode];

  return (
    <div className="space-y-5">
      {/* Scoring options */}
      <div className="space-y-4">
        <Toggle
          checked={state.dynamic_scoring}
          onChange={v => set({ dynamic_scoring: v })}
          label="Scoring dinámico"
          hint="Los puntos por reto decaen conforme más equipos lo resuelven (fórmula cuadrática estilo CTFd)."
        />
        <Field label="Bonus First Blood (%)" hint="% extra de puntos al primer equipo/persona en resolver. 0 = sin bonus.">
          <NumberInput value={state.first_blood_bonus_pct} onChange={v => set({ first_blood_bonus_pct: v })} min={0} placeholder="0" />
        </Field>
      </div>

      {/* Resumen */}
      <div
        className="rounded-xl p-4"
        style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}
      >
        <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>
          Resumen de la competencia
        </p>
        <SummaryRow label="Nombre" value={state.name || "Sin nombre"} highlight />
        <SummaryRow label="Modalidad" value={modeLabel} />
        <SummaryRow label="Inicio" value={fmt(toISO(state.start_time))} />
        <SummaryRow label="Fin" value={fmt(toISO(state.end_time))} />
        <SummaryRow label="Freeze scoreboard" value={fmt(toISO(state.freeze_time))} />
        {state.mode !== "individual" && (
          <>
            <SummaryRow label="Máx. equipos" value={state.max_teams || "Ilimitado"} />
            <SummaryRow label="Máx. miembros/equipo" value={state.max_members || "5"} />
            <SummaryRow label="Registro siempre abierto" value={state.registration_open ? "Sí" : "No"} />
          </>
        )}
        <SummaryRow
          label="Retos"
          value={state.challenge_slugs.length === 0 || state.challenge_slugs.includes("__none__")
            ? (state.challenge_slugs.includes("__none__") ? "Sin selección" : "Todos (activos)")
            : `${state.challenge_slugs.length} seleccionados`}
        />
        <SummaryRow label="Scoring dinámico" value={state.dynamic_scoring ? "Activado" : "Estático"} />
        <SummaryRow label="Bonus First Blood" value={`${state.first_blood_bonus_pct || "0"}%`} />
        <div className="mt-4 p-3 rounded-lg" style={{ background: "var(--primary-light)", border: "1px solid var(--primary-border)" }}>
          <p className="text-xs font-semibold" style={{ color: "var(--primary)" }}>
            Al confirmar se guardará la configuración. Para activar la competencia usa el toggle "Modo competencia" en el panel principal.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main wizard ────────────────────────────────────────────────────────────────

export default function CompetitionWizard({ initial, onClose, onSaved }: Props) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allChallenges, setAllChallenges] = useState<Challenge[]>([]);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchChallenges().then(setAllChallenges).catch(() => {});
  }, []);

  const [state, setState] = useState<WizardState>({
    name: initial.name ?? "CTF USFX",
    description: initial.description ?? "",
    mode: (initial.mode as Mode) ?? "teams",
    start_time: toLocalInput(initial.start_time),
    end_time: toLocalInput(initial.end_time),
    freeze_time: toLocalInput(initial.freeze_time),
    max_teams: initial.max_teams != null ? String(initial.max_teams) : "",
    max_members: String(initial.max_members ?? 5),
    registration_open: initial.registration_open ?? true,
    challenge_slugs: initial.challenge_slugs ?? [],
    dynamic_scoring: initial.dynamic_scoring ?? false,
    first_blood_bonus_pct: String(initial.first_blood_bonus_pct ?? 0),
  });

  const set = (patch: Partial<WizardState>) => setState(prev => ({ ...prev, ...patch }));

  // Trap focus + ESC
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Validación por paso
  const canNext = (): boolean => {
    if (step === 0) return state.name.trim().length > 0;
    if (step === 1) {
      if (!state.start_time || !state.end_time) return false;
      if (new Date(state.start_time) >= new Date(state.end_time)) return false;
      return true;
    }
    if (step === 3) return !state.challenge_slugs.includes("__none__");
    return true;
  };

  const totalSteps = 5;
  const isLast = step === totalSteps - 1;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const slugs = state.challenge_slugs.includes("__none__")
        ? []
        : state.challenge_slugs;
      const updated = await setCompetitionConfig({
        name: state.name.trim(),
        description: state.description.trim(),
        mode: state.mode,
        start_time: toISO(state.start_time),
        end_time: toISO(state.end_time),
        freeze_time: toISO(state.freeze_time),
        max_teams: state.max_teams ? parseInt(state.max_teams) : null,
        max_members: parseInt(state.max_members) || 5,
        registration_open: state.registration_open,
        challenge_slugs: slugs,
        dynamic_scoring: state.dynamic_scoring,
        first_blood_bonus_pct: parseInt(state.first_blood_bonus_pct) || 0,
      });
      onSaved(updated);
    } catch {
      setError("Error al guardar la configuración. Verifica los datos e intenta de nuevo.");
      setSaving(false);
    }
  };

  const stepComponents = [
    <Step1 key={0} state={state} set={set} />,
    <Step2 key={1} state={state} set={set} />,
    <Step3 key={2} state={state} set={set} />,
    <Step4Challenges key={3} state={state} set={set} allChallenges={allChallenges} />,
    <Step4 key={4} state={state} set={set} />,
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wizard-title"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-slide-up"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-0 flex-shrink-0">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 id="wizard-title" className="text-base font-bold" style={{ color: "var(--text)" }}>
                Configurar Competencia
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>
                Paso {step + 1} de {totalSteps} — {STEPS[step]}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: "var(--text-faint)", background: "var(--surface-alt)" }}
              aria-label="Cerrar"
            >
              <IconX className="w-4 h-4" />
            </button>
          </div>
          <StepBar current={step} />
        </div>

        {/* Body */}
        <div className="px-6 pb-2 flex-1 overflow-y-auto">
          {stepComponents[step]}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0"
          style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}
        >
          <button
            onClick={() => step > 0 ? setStep(s => s - 1) : onClose()}
            className="btn-ghost text-sm px-4 py-2"
          >
            {step === 0 ? "Cancelar" : <><IconArrowLeft className="w-4 h-4 inline mr-1" />Anterior</>}
          </button>

          <div className="flex items-center gap-3">
            {error && (
              <p className="text-xs" style={{ color: "var(--error)" }}>{error}</p>
            )}
            {isLast ? (
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary text-sm px-6 py-2 disabled:opacity-60"
              >
                {saving ? "Guardando…" : <><IconCheck className="w-4 h-4 inline mr-1" />Guardar</>}
              </button>
            ) : (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canNext()}
                className="btn-primary text-sm px-6 py-2 disabled:opacity-40"
              >
                Siguiente <IconArrowRight className="w-4 h-4 inline ml-1" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
