// In-app ephemeral status bus.
// Used by actions that want to show transient feedback inside the mini-menu
// (e.g. "/link copied") rather than relying on Spicetify.showNotification.

export interface Toast {
  id: number;
  msg: string;
  kind: "info" | "error";
  at: number;
}

type Listener = (t: Toast | null) => void;

const listeners = new Set<Listener>();
let current: Toast | null = null;
let seq = 0;
let clearTimer: any = null;

function emit() {
  listeners.forEach((cb) => {
    try { cb(current); } catch {}
  });
}

export function pushToast(msg: string, opts: { kind?: "info" | "error"; durationMs?: number } = {}) {
  if (clearTimer) { clearTimeout(clearTimer); clearTimer = null; }
  current = {
    id: ++seq,
    msg,
    kind: opts.kind || "info",
    at: Date.now(),
  };
  emit();
  clearTimer = setTimeout(() => {
    current = null;
    clearTimer = null;
    emit();
  }, opts.durationMs ?? 2400);
}

export function subscribeToast(cb: Listener): () => void {
  listeners.add(cb);
  // fire once with current so freshly mounted subscribers pick up in-flight toasts
  cb(current);
  return () => listeners.delete(cb);
}

export function currentToast(): Toast | null { return current; }
