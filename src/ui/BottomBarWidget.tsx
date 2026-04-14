import { WaveEngine } from "../engine/WaveEngine";
import { WaveIcon, StopIcon, MoodIcon, HistoryIcon, StatsIcon, MixIcon } from "./icons";
import { AsciiWave, PanelMixLabel, triggerNewMix } from "./visualizers";
import { NowPlayingCard, MainTab, HistoryTab, StatsTab } from "./panel";
import { useEngineState } from "./hooks";

const React = Spicetify.React;
const h = (...args: any[]) => React.createElement(...(args as [any, any, ...any[]]));

let engine: WaveEngine;
export function setBottomBarEngine(e: WaveEngine) { engine = e; }

// ========== BOTTOM BAR WIDGET ==========
export function BottomBarWidget() {
  const state = useEngineState();
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [tab, setTab] = React.useState("main" as "main" | "history" | "stats");
  const panelRef = React.useRef(null as HTMLDivElement | null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    };
    if (panelOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [panelOpen]);

  React.useEffect(() => {
    if (panelOpen) setTab("main");
  }, [panelOpen]);

  return h("div", { className: "mw-bottombar", ref: panelRef },
    panelOpen && h("div", { className: "mw-panel" },
      h("div", { className: "mw-panel-inner" },
        // Header with ASCII glow
        h("div", { className: "mw-header" },
          h("div", { className: "mw-header-left" },
            h("div", { className: "mw-logo" }, h(WaveIcon, { size: 14 })),
            h("span", { className: "mw-header-title" }, "MIX LINE")),
          h("div", { className: "mw-header-tabs" },
            h("button", {
              className: `mw-htab${tab === "main" ? " mw-htab-on" : ""}`,
              onClick: () => setTab("main"),
            }, h(MoodIcon, { size: 15 })),
            h("button", {
              className: `mw-htab${tab === "history" ? " mw-htab-on" : ""}`,
              onClick: () => setTab("history"),
            }, h(HistoryIcon, { size: 15 })),
            h("button", {
              className: `mw-htab${tab === "stats" ? " mw-htab-on" : ""}`,
              onClick: () => setTab("stats"),
            }, h(StatsIcon, { size: 15 })))),

        // ASCII Equalizer Banner + Now Playing (main tab only when active)
        tab === "main" && state.isActive && h("div", { className: "mw-ascii-banner" },
          h(AsciiWave, { active: true }),
          h("div", { className: "mw-ascii-overlay" },
            h(PanelMixLabel))),

        tab === "main" && state.isActive && h(NowPlayingCard, { state }),

        // Tab content
        tab === "main" && h(MainTab, { state }),
        tab === "history" && h(HistoryTab, { history: state.history }),
        tab === "stats" && h(StatsTab, { state }),

        // Bottom actions
        state.isActive && h("div", { className: "mw-actions" },
          h("button", { className: "mw-act mw-act-stop", onClick: () => engine.stop() },
            h(StopIcon, { size: 14 }), "Stop"),
          h("button", { className: "mw-act mw-act-reseed", onClick: () => { triggerNewMix(); engine.reseed(); } },
            h(MixIcon, { size: 14 }), "New mix")))),

    // Trigger button
    h("button", {
      className: `mw-trigger${state.isActive ? " mw-trigger-on" : ""}`,
      onClick: () => setPanelOpen(!panelOpen),
    },
      h("div", { className: "mw-trigger-icon" }, h(WaveIcon, { size: 14 }))));
}
