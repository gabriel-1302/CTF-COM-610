import { atom } from "nanostores";

export const toast = atom<{ type: "error" | "success"; msg: string } | null>(null);

export function showToast(type: "error" | "success", msg: string) {
  toast.set({ type, msg });
  setTimeout(() => toast.set(null), 4000);
}
