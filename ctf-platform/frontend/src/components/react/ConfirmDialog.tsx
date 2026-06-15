import { useEffect, useRef } from "react";
import { IconExclamationTriangle, IconX } from "./icons";

interface Props {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export default function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = false,
  onConfirm,
  onClose,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleConfirm = async () => {
    await onConfirm();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-overlay-in"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        ref={dialogRef}
        className="card w-full max-w-sm animate-slide-up"
        style={danger ? { borderColor: "var(--error-border)" } : undefined}
      >
        <div className="flex items-start gap-3 mb-5">
          {danger && (
            <div
              className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center mt-0.5"
              style={{ background: "var(--error-bg)", color: "var(--error)" }}
            >
              <IconExclamationTriangle className="w-4 h-4" />
            </div>
          )}
          <div className="flex-1 min-w-0 pt-0.5">
            <h2
              id="confirm-dialog-title"
              className="text-base font-bold"
              style={{ color: danger ? "var(--error)" : "var(--text)" }}
            >
              {title}
            </h2>
            {description && (
              <p className="text-sm mt-1.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1 rounded transition-colors"
            style={{ color: "var(--text-faint)" }}
            aria-label="Cerrar"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-3 justify-end">
          <button ref={cancelRef} onClick={onClose} className="btn-ghost text-sm">
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            className={danger ? "btn-danger text-sm" : "btn-primary text-sm"}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
