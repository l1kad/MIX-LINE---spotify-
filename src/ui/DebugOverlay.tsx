// Hidden debug overlay.
// Mounts only when the URL contains ?mywave-debug, so it never touches
// production UI. Shows engine diagnostics + prefs snapshot, with
// buttons to reset the learning model.

import type { WaveEngine } from "../engine/WaveEngine";
import { useAppVisible } from "./hooks";

const h = (...args: any[]) => Spicetify.React.createElement(...(args as [any, any, ...any[]]));

let engineRef: WaveEngine | null = null;
export function setDebugEngine(e: WaveEngine) { engineRef = e; }

export function isDebugEnabled(): boolean {
  try {
    const loc = window.location.href || "";
    if (loc.includes("mywave-debug")) return true;
    if (localStorage.getItem("mywave:debug") === "1") return true;
  } catch {}
  return false;
}

export function DebugOverlay() {
  const [tick, setTick] = Spicetify.React.useState(0);
  const [open, setOpen] = Spicetify.React.useState(true);

  const visible = useAppVisible();

  Spicetify.React.useEffect(() => {
    if (!engineRef || !visible) return;
    const unsub = engineRef.subscribe(() => setTick((t: number) => t + 1));
    const id = setInterval(() => setTick((t: number) => t + 1), 2000);
    return () => { unsub?.(); clearInterval(id); };
  }, [visible]);

  if (!engineRef) return null;

  const snap = engineRef.getDebugSnapshot();
  const fmtMs = (ms: number) => ms > 0 ? `${Math.round(ms / 1000)}s` : "-";

  const style = {
    root: {
      position: "fixed" as const,
      right: 12,
      top: 12,
      zIndex: 99999,
      width: 340,
      maxHeight: "calc(100vh - 24px)",
      overflow: "auto",
      background: "rgba(10,10,10,0.92)",
      border: "1px solid #1db954",
      borderRadius: 6,
      color: "#e8e8e8",
      fontFamily: "JetBrains Mono, Menlo, Consolas, monospace",
      fontSize: 11,
      lineHeight: 1.4,
      padding: open ? "10px 12px" : "4px 10px",
      backdropFilter: "blur(4px)",
    },
    head: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      cursor: "pointer",
      userSelect: "none" as const,
      color: "#1db954",
      letterSpacing: 1.5,
      fontWeight: 600,
      textTransform: "uppercase" as const,
      fontSize: 10,
    },
    row: { display: "flex", justifyContent: "space-between", gap: 8, padding: "1px 0" },
    key: { color: "#888" },
    val: { color: "#e8e8e8", textAlign: "right" as const, wordBreak: "break-all" as const },
    section: { marginTop: 8, paddingTop: 6, borderTop: "1px solid #222" },
    sectionTitle: { fontSize: 9, color: "#1db954", letterSpacing: 1.2, marginBottom: 4, textTransform: "uppercase" as const },
    btn: {
      marginTop: 8,
      width: "100%",
      background: "transparent",
      color: "#e8e8e8",
      border: "1px solid #333",
      padding: "4px 8px",
      borderRadius: 3,
      cursor: "pointer",
      fontFamily: "inherit",
      fontSize: 10,
      letterSpacing: 1,
    },
  };

  const row = (k: string, v: any) => h("div", { style: style.row, key: k },
    h("span", { style: style.key }, k),
    h("span", { style: style.val }, String(v)));

  return h("div", { style: style.root },
    h("div", {
      style: style.head,
      onClick: () => setOpen(!open),
    }, h("span", null, "mixline // debug"), h("span", null, open ? "\u25BC" : "\u25B2")),

    open && h("div", null,
      row("active", snap.isActive),
      row("loading", snap.isLoading),
      row("refilling", snap.isRefilling),
      row("played (session)", snap.playedUrisSize),
      row("played (persist)", snap.prefs.playedCount),
      row("artists tracked", snap.prefs.artistsTracked),
      row("backoff", fmtMs(snap.recsBackoffMs)),
      row("track elapsed", snap.trackStartMs ? fmtMs(Date.now() - snap.trackStartMs) : "-"),
      row("track duration", fmtMs(snap.lastTrackDurationMs)),
      row("discovery only", snap.prefs.discoveryOnly ? "on" : "off"),

      h("div", { style: style.section },
        h("div", { style: style.sectionTitle }, "refill seed pool"),
        snap.refillSeedPool.length === 0
          ? h("div", { style: style.key }, "(empty)")
          : snap.refillSeedPool.map((u: string, i: number) =>
              h("div", { key: i, style: { color: i === (snap.refillSeedIdx - 1 + snap.refillSeedPool.length) % snap.refillSeedPool.length ? "#1db954" : "#888", fontSize: 10 } }, u.split(":").pop())),
      ),

      h("div", { style: style.section },
        h("div", { style: style.sectionTitle }, "top artists"),
        snap.prefs.topArtists.length === 0
          ? h("div", { style: style.key }, "(none)")
          : snap.prefs.topArtists.map((a: { name: string; score: number }, i: number) =>
              h("div", { style: style.row, key: i },
                h("span", { style: style.key }, a.name),
                h("span", { style: { color: "#1db954" } }, "+" + a.score))),
      ),

      h("div", { style: style.section },
        h("div", { style: style.sectionTitle }, "bottom artists"),
        snap.prefs.bottomArtists.length === 0
          ? h("div", { style: style.key }, "(none)")
          : snap.prefs.bottomArtists.map((a: { name: string; score: number }, i: number) =>
              h("div", { style: style.row, key: i },
                h("span", { style: style.key }, a.name),
                h("span", { style: { color: "#e55" } }, a.score))),
      ),

      h("button", {
        style: style.btn,
        onClick: () => engineRef?.setDiscoveryOnly(!snap.prefs.discoveryOnly),
      }, snap.prefs.discoveryOnly ? "disable discovery only" : "enable discovery only"),

      h("button", {
        style: style.btn,
        onClick: () => engineRef?.saveMixAsPlaylist(),
      }, "save mix as playlist"),

      h("button", {
        style: { ...style.btn, borderColor: "#552", color: "#e55" },
        onClick: () => {
          if (confirm("Reset all learning (played tracks + artist scores)?")) {
            engineRef?.resetLearning();
          }
        },
      }, "reset learning"),
    ),
  );
}
