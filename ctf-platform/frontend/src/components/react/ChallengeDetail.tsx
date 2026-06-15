import { useEffect, useState, useCallback } from "react";
import { useStore } from "@nanostores/react";
import { fetchChallenges, fetchActiveInstances, unlockHint, fetchCompetitionConfig } from "../../lib/api";
import { showToast } from "../../lib/toast";
import type { Challenge, CompetitionConfig, HintDetail } from "../../lib/schemas";
import { accessToken } from "../../lib/auth";
import InstancePanel from "./InstancePanel";
import FlagSubmit from "./FlagSubmit";
import CompetitionBanner from "./CompetitionBanner";
import { IconCheck, IconDroplet, IconLightbulb, IconLockClosed } from "./icons";

interface Props {
  slug: string;
}

type ActiveInstance = {
  id: number;
  host_port: number;
  expires_at: string;
  url?: string;
  challenge: { slug: string; name: string };
};

const SLUG_CATEGORY: Record<string, string> = {};
["sqli","cmdi","xss","lfi","path-traversal","ssti","idor","format-string","jwt","xxe"].forEach(s => { SLUG_CATEGORY[s] = "Web"; });
["crypto-rsa","crypto-vigenere"].forEach(s => { SLUG_CATEGORY[s] = "Crypto"; });
["forensics-pcap","stego"].forEach(s => { SLUG_CATEGORY[s] = "Forense"; });

const CAT_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  "Web":    { color: "#818cf8", bg: "rgba(129,140,248,0.1)", border: "rgba(129,140,248,0.25)" },
  "Crypto": { color: "#f472b6", bg: "rgba(244,114,182,0.1)", border: "rgba(244,114,182,0.25)" },
  "Forense":{ color: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.25)"  },
};

export default function ChallengeDetail({ slug }: Props) {
  const token = useStore(accessToken);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [instance, setInstance] = useState<ActiveInstance | null>(null);
  const [solved, setSolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hints, setHints] = useState<HintDetail[]>([]);
  const [unlocking, setUnlocking] = useState<number | null>(null);
  const [hintsOpen, setHintsOpen] = useState(false);
  const [competitionCfg, setCompetitionCfg] = useState<CompetitionConfig | null>(null);

  const refreshChallenge = useCallback(async () => {
    const all = await fetchChallenges();
    const c = all.find((x) => x.slug === slug) ?? null;
    setChallenge(c);
    setSolved(c?.is_solved ?? false);
  }, [slug]);

  const refreshInstance = useCallback(async () => {
    const active = await fetchActiveInstances();
    const mine = active.find((i) => i.challenge.slug === slug) ?? null;
    setInstance(mine);
  }, [slug]);

  useEffect(() => {
    if (token === null) {
      setLoading(true);
      return;
    }
    setLoading(true);
    Promise.all([
      refreshChallenge(),
      refreshInstance(),
      fetchCompetitionConfig().then(setCompetitionCfg).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [refreshChallenge, refreshInstance, token]);

  useEffect(() => {
    if (!slug) return;
    import("../../lib/api").then(({ api }) => {
      api.get(`/challenges/${slug}/`)
        .then((r) => {
          if (r.data.hints_detail) setHints(r.data.hints_detail);
        })
        .catch(() => {});
    });
  }, [slug]);

  async function handleUnlock(index: number, cost: number) {
    if (unlocking !== null) return;
    setUnlocking(index);
    try {
      const res = await unlockHint(slug, index);
      setHints((prev) =>
        prev.map((h) =>
          h.index === index ? { ...h, text: res.text, unlocked: true } : h
        )
      );
      if (!res.already_unlocked && res.points_deducted && res.points_deducted > 0) {
        showToast("success", `Pista desbloqueada (-${res.points_deducted} pts)`);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? "Error al desbloquear pista";
      showToast("error", msg);
    } finally {
      setUnlocking(null);
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-10 rounded-xl w-48" style={{ background: "var(--surface-alt)" }} />
          <div className="card space-y-3">
            <div className="h-4 rounded" style={{ background: "var(--surface-alt)" }} />
            <div className="h-4 rounded w-4/5" style={{ background: "var(--surface-alt)" }} />
            <div className="h-4 rounded w-3/5" style={{ background: "var(--surface-alt)" }} />
            <div className="h-4 rounded w-4/5" style={{ background: "var(--surface-alt)" }} />
          </div>
        </div>
        <div className="space-y-4">
          <div className="card h-44" style={{ background: "var(--surface-alt)" }} />
          <div className="card h-36" style={{ background: "var(--surface-alt)" }} />
        </div>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="text-center py-20">
        <p style={{ color: "var(--text-faint)" }}>Challenge no encontrado.</p>
        <a href="/challenges" className="hover:underline mt-4 inline-flex items-center gap-1" style={{ color: "var(--primary)" }}>
          Volver a retos
        </a>
      </div>
    );
  }

  const cat = SLUG_CATEGORY[slug];
  const catStyle = cat ? CAT_STYLE[cat] : null;

  const hintsToShow = hints.length > 0 ? hints : (challenge.hints ?? []).map((h, i) => ({
    index: i,
    cost: h.cost,
    text: null,
    unlocked: false,
  }));

  const currentPts = challenge.current_points ?? challenge.points;
  const pctValue = challenge.points > 0 ? Math.round((currentPts / challenge.points) * 100) : 100;

  return (
    <div className="animate-fade-in">
      <CompetitionBanner />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Aside (right) ─────────────────────────────────────────────── */}
        <aside className="space-y-4 lg:order-last">
          <InstancePanel slug={slug} instance={instance} onChange={refreshInstance} />
          <FlagSubmit
            slug={slug}
            disabled={solved}
            competitionCfg={competitionCfg}
            onSolved={() => { setSolved(true); refreshChallenge(); }}
          />
        </aside>

        {/* ── Main (left) ───────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Meta bar */}
          <div
            className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            {cat && catStyle && (
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: catStyle.bg, color: catStyle.color, border: `1px solid ${catStyle.border}` }}
              >
                {cat}
              </span>
            )}

            <div className="flex items-center gap-1.5">
              <span className="font-mono font-black text-xl" style={{ color: "var(--primary)" }}>
                {currentPts}
              </span>
              <span className="text-xs font-medium" style={{ color: "var(--text-faint)" }}>pts</span>
              {challenge.is_dynamic && currentPts !== challenge.points && (
                <span className="text-xs line-through font-mono ml-1" style={{ color: "var(--text-faint)" }}>
                  {challenge.points}
                </span>
              )}
            </div>

            {solved && (
              <span
                className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: "var(--success-bg)", color: "var(--success)", border: "1px solid var(--success-border)" }}
              >
                <IconCheck className="w-3.5 h-3.5" strokeWidth={2.5} />
                Resuelto
              </span>
            )}

            {challenge.is_dynamic && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                  {challenge.solve_count ?? 0} solve{(challenge.solve_count ?? 0) !== 1 ? "s" : ""}
                </span>
                <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pctValue}%`, background: pctValue > 60 ? "var(--primary)" : pctValue > 30 ? "#f59e0b" : "#ef4444" }}
                  />
                </div>
                <span className="text-xs font-mono font-semibold" style={{ color: "var(--text-muted)" }}>{pctValue}%</span>
              </div>
            )}
          </div>

          {/* First blood banner */}
          {challenge.first_blood_username && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
              style={{
                background: "linear-gradient(135deg, #1c0508 0%, #450a0a 100%)",
                border: "1px solid rgba(239,68,68,0.35)",
              }}
            >
              <IconDroplet className="w-4 h-4 shrink-0" style={{ color: "#f87171" }} />
              <span style={{ color: "rgba(255,255,255,0.7)" }}>
                <span style={{ color: "#f87171", fontWeight: 700 }}>First blood</span>
                {" "}— <span className="font-mono" style={{ color: "#fca5a5" }}>{challenge.first_blood_username}</span>
              </span>
            </div>
          )}

          {/* Description card */}
          <div className="card">
            <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "var(--text-faint)" }}>
              descripción
            </p>
            <p className="whitespace-pre-wrap leading-relaxed text-sm" style={{ color: "var(--text-muted)" }}>
              {challenge.description}
            </p>
          </div>

          {/* Hints */}
          {hintsToShow.length > 0 && (
            <div className="card">
              <button
                onClick={() => setHintsOpen(o => !o)}
                className="w-full flex items-center justify-between gap-2 select-none"
                aria-expanded={hintsOpen}
              >
                <div className="flex items-center gap-2">
                  <IconLightbulb className="w-4 h-4" style={{ color: "var(--primary)" }} />
                  <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                    Pistas
                  </span>
                  <span
                    className="text-xs font-mono px-1.5 py-0.5 rounded-md"
                    style={{ background: "var(--surface-alt)", color: "var(--text-faint)", border: "1px solid var(--border)" }}
                  >
                    {hintsToShow.length}
                  </span>
                </div>
                <svg
                  className="w-4 h-4 transition-transform duration-200"
                  style={{ transform: hintsOpen ? "rotate(180deg)" : "rotate(0deg)", color: "var(--text-faint)" }}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {hintsOpen && (
                <ul className="mt-4 space-y-2.5">
                  {hintsToShow.map((h) => (
                    <li
                      key={h.index}
                      className="rounded-lg border p-3.5"
                      style={{
                        borderColor: h.unlocked ? "var(--border)" : "var(--primary-border)",
                        background: h.unlocked ? "var(--surface-alt)" : "var(--primary-light)",
                      }}
                    >
                      {h.unlocked ? (
                        <div className="flex items-start gap-2.5 text-sm">
                          <IconLightbulb className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--primary)" }} />
                          <span style={{ color: "var(--text-muted)" }}>{h.text}</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-faint)" }}>
                            <IconLockClosed className="w-4 h-4 shrink-0" />
                            <span>Pista #{h.index + 1}</span>
                            <span
                              className="font-mono text-xs px-1.5 py-0.5 rounded"
                              style={{ background: "var(--surface)", color: "var(--text-faint)", border: "1px solid var(--border)" }}
                            >
                              -{h.cost}pt
                            </span>
                          </div>
                          <button
                            onClick={() => handleUnlock(h.index, h.cost)}
                            disabled={unlocking !== null}
                            className="text-xs px-3 py-1.5 rounded-lg border transition-all disabled:opacity-50 hover:opacity-80 shrink-0 font-medium"
                            style={{
                              borderColor: "var(--primary-border)",
                              color: "var(--primary)",
                              background: "var(--primary-light)",
                            }}
                          >
                            {unlocking === h.index ? "..." : "Desbloquear"}
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
