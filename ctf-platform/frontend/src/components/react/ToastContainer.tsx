import { useStore } from "@nanostores/react";
import { toast } from "../../lib/toast";
import { IconCheck, IconX } from "./icons";

export default function ToastContainer() {
  const t = useStore(toast);
  if (!t) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl border shadow-2xl animate-slide-down max-w-sm ${
        t.type === "success"
          ? "bg-emerald-950 border-emerald-700 text-emerald-300"
          : "bg-red-950 border-red-700 text-red-300"
      }`}
    >
      {t.type === "success"
        ? <IconCheck className="w-4 h-4 shrink-0" strokeWidth={2.5} />
        : <IconX className="w-4 h-4 shrink-0" strokeWidth={2.5} />
      }
      <span className="text-sm font-medium">{t.msg}</span>
    </div>
  );
}
