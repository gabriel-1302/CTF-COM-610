import { useEffect, useState } from "react";
import { fetchSolucionario } from "../../lib/api";
import { IconBookOpen, IconArrowLeft } from "./icons";

export default function SolucionarioView({ slug }: { slug: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSolucionario(slug)
      .then(({ html, found }) => {
        if (!found) setError(`No se encontró solucionario para "${slug}".`);
        else setHtml(html);
      })
      .catch(e => {
        if (e?.response?.status === 403) setError("Acceso denegado. Se requiere rol de administrador.");
        else setError("Error al cargar el solucionario.");
      })
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text)" }}>
            <IconBookOpen className="w-5 h-5" /> Solucionario
          </h1>
          <p className="text-sm font-mono mt-0.5" style={{ color: "var(--text-faint)" }}>{slug}</p>
        </div>
        <a href="/admin" className="btn-ghost text-sm py-1.5 px-3 inline-flex items-center gap-1">
          <IconArrowLeft className="w-4 h-4" /> Volver al panel
        </a>
      </div>

      {loading && (
        <div className="card space-y-3 animate-pulse">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-4 rounded" style={{ background: "var(--border)", width: i % 3 === 0 ? "55%" : "100%" }} />
          ))}
        </div>
      )}

      {error && (
        <div className="card text-center py-12">
          <p style={{ color: "var(--error)" }}>{error}</p>
          <a href="/admin" className="btn-primary inline-flex mt-4 text-sm">Volver al panel</a>
        </div>
      )}

      {html && (
        <>
          <div
            className="card solucionario-content"
            style={{ lineHeight: "1.75" }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
          <style>{`
            .solucionario-content h1,.solucionario-content h2,.solucionario-content h3 {
              font-weight: 700; margin: 1.2em 0 0.5em; color: var(--primary);
              border-bottom: 1px solid var(--border); padding-bottom: 4px;
            }
            .solucionario-content h1 { font-size: 1.4em; }
            .solucionario-content h2 { font-size: 1.15em; }
            .solucionario-content h3 { font-size: 1em; border: none; }
            .solucionario-content p { margin: 0.7em 0; }
            .solucionario-content code {
              background: var(--surface-alt); padding: 2px 6px; border-radius: 4px;
              font-family: monospace; font-size: 0.88em; color: var(--primary);
            }
            .solucionario-content pre {
              background: #1e1e2e; color: #cdd6f4; padding: 16px;
              border-radius: 8px; overflow-x: auto; margin: 1em 0;
            }
            .solucionario-content pre code { background: none; padding: 0; color: inherit; font-size: 0.85em; }
            .solucionario-content blockquote {
              border-left: 3px solid var(--primary); margin: 0.8em 0;
              padding: 8px 16px; background: var(--primary-light); border-radius: 0 6px 6px 0;
            }
            .solucionario-content table { border-collapse: collapse; width: 100%; margin: 1em 0; }
            .solucionario-content th,.solucionario-content td {
              border: 1px solid var(--border); padding: 8px 12px; text-align: left; font-size: 0.9em;
            }
            .solucionario-content th { background: var(--primary); color: #fff; font-weight: 600; }
            .solucionario-content ul,.solucionario-content ol { padding-left: 1.5em; margin: 0.6em 0; }
            .solucionario-content li { margin: 0.3em 0; }
            .solucionario-content a { color: var(--primary); text-decoration: underline; }
            .solucionario-content hr { border: none; border-top: 1px solid var(--border); margin: 1.5em 0; }
          `}</style>
        </>
      )}
    </div>
  );
}
