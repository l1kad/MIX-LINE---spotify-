// MyWave — Infinite music stream for Spotify

import { HistoryEntry } from "./engine/types";
import { MOODS } from "./engine/constants";
import { WaveEngine } from "./engine/WaveEngine";
import { WaveIcon, PlayIcon, StopIcon, RefreshIcon, HeartIcon, ThumbDownIcon, LockIcon, HistoryIcon, StatsIcon, MoodIcon, MixIcon } from "./ui/icons";
import { AsciiWave, MixLabel, PanelMixLabel, SeaWaves, triggerNewMix, useNewMixSignal } from "./ui/visualizers";

// ============================================================
// UI
// ============================================================

let React: typeof Spicetify.React;
let ReactDOM: typeof Spicetify.ReactDOM;
const engine = new WaveEngine();

function useEngineState() {
  const [state, setState] = React.useState(engine.getState());
  React.useEffect(() => {
    const unsub = engine.subscribe(() => setState({ ...engine.getState() }));
    return () => { unsub(); };
  }, []);
  return state;
}

function useTimeTick(active: boolean) {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, [active]);
}

const h = (...args: any[]) => React.createElement(...(args as [any, any, ...any[]]));

// ========== HOME PAGE BANNER ==========
function HomeBanner() {
  const state = useEngineState();

  const handleMood = (moodId: string) => {
    if (state.activeMood === moodId) { engine.stop(); return; }
    if (state.isActive) engine.stop();
    setTimeout(() => engine.start(moodId), 100);
  };

  return h("div", { className: "mw-home" },
    h(SeaWaves),
    h("div", { className: "mw-home-glow" }),
    h("div", { className: "mw-home-inner" },
      // Brand + label
      h("div", { className: "mw-home-top-row" },
        h("div", { className: "mw-home-brand" },
          h(WaveIcon, { size: 16 }),
          h("span", null, "MIX LINE")),
        h("div", { className: "mw-home-tag" },
          h(PanelMixLabel))),
      // Now playing or description
      state.isActive
        ? h("div", { className: "mw-home-np" },
            state.currentImageUrl && h("img", { className: "mw-home-np-art", src: state.currentImageUrl, alt: "" }),
            h("div", { className: "mw-home-np-text" },
              h("div", { className: "mw-home-np-name" }, state.currentTrackName),
              h("div", { className: "mw-home-np-artist" }, state.currentArtistName)))
        : h("div", { className: "mw-home-desc" }, "Endless mix from your taste"),
      // Buttons
      h("div", { className: "mw-home-btns" },
        state.isActive
          ? h(React.Fragment, null,
              h("button", { className: "mw-home-btn mw-home-btn-stop", onClick: () => engine.stop() },
                h(StopIcon, { size: 12 }), "Stop"),
              h("button", { className: "mw-home-btn mw-home-btn-mix", onClick: () => { triggerNewMix(); engine.reseed(); } },
                h(MixIcon, { size: 12 }), "New mix"),
              h("div", { className: "mw-home-live" },
                h("span", { className: "mw-home-dot" }),
                `${state.playedCount} tracks`))
          : h(React.Fragment, null,
              h("button", { className: "mw-home-btn mw-home-btn-play", onClick: () => engine.start() },
                h(PlayIcon, { size: 14 }), "Start"),
              h("button", { className: "mw-home-btn mw-home-btn-fav", onClick: () => engine.startFavorites() },
                h(HeartIcon, { size: 12, filled: true }), "Favorites"))),
      // Mood chips
      h("div", { className: "mw-home-moods" },
        state.topLikedArtist && h("button", {
          key: "artist",
          className: "mw-home-mood mw-home-mood-artist",
          onClick: () => {
            if (state.isActive) engine.stop();
            setTimeout(() => engine.startFromArtistName(state.topLikedArtist!), 100);
          },
        }, `\u2605 ${state.topLikedArtist}`),
        MOODS.slice(0, 4).map(mood =>
          h("button", {
            key: mood.id,
            className: `mw-home-mood${state.activeMood === mood.id ? " mw-home-mood-on" : ""}`,
            onClick: () => handleMood(mood.id),
          }, mood.label)))));
}

// ========== BOTTOM BAR WIDGET ==========
function BottomBarWidget() {
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

// --- Now Playing Card ---
function NowPlayingCard({ state }: { state: ReturnType<WaveEngine["getState"]> }) {
  return h("div", { className: "mw-np" },
    h("div", { className: "mw-np-top" },
      h("div", { className: "mw-np-art-wrap" },
        state.currentImageUrl && h("img", { className: "mw-np-art-glow", src: state.currentImageUrl, alt: "" }),
        state.currentImageUrl
          ? h("img", { className: "mw-np-art", src: state.currentImageUrl, alt: "" })
          : h("div", { className: "mw-np-art mw-np-ph" })),
      h("div", { className: "mw-np-info" },
        h("div", { className: "mw-np-name" }, state.currentTrackName),
        h("div", { className: "mw-np-artist" }, state.currentArtistName))),
    h("div", { className: "mw-np-controls" },
      h("button", {
        className: "mw-np-btn mw-np-like",
        onClick: () => engine.likeCurrentTrack(),
        title: "Like",
      }, h(HeartIcon, { size: 14 })),
      h("button", {
        className: "mw-np-btn mw-np-dislike",
        onClick: () => engine.dislikeCurrentTrack(),
        title: "Dislike & skip",
      }, h(ThumbDownIcon, { size: 14 })),
      h("button", {
        className: `mw-np-btn mw-np-lock${state.lockedArtist ? " mw-np-locked" : ""}`,
        onClick: () => engine.toggleLockArtist(),
        title: state.lockedArtist ? `Unlock ${state.lockedArtist}` : "Lock to this artist",
      }, h(LockIcon, { size: 14, locked: !!state.lockedArtist }),
        state.lockedArtist ? state.lockedArtist : "Lock artist"),
      h("button", {
        className: "mw-np-btn mw-np-mixfrom",
        onClick: () => { triggerNewMix(); engine.reseedFromTrack(); },
        title: "Mix from this track",
      }, h(MixIcon, { size: 14 }), "Mix from track")));
}

// --- Main Tab ---
function MainTab({ state }: { state: ReturnType<WaveEngine["getState"]> }) {
  if (state.isActive) {
    return h(React.Fragment, null,
      h(MoodChips, { activeMood: state.activeMood, isActive: true, topLikedArtist: state.topLikedArtist, isFavoritesMode: state.isFavoritesMode, pinnedMood: state.pinnedMood }),
      h(InlineStats, { state }));
  }

  return h(React.Fragment, null,
    // ASCII wave hero when not active
    h("div", { className: "mw-hero" },
      h(AsciiWave, { active: false }),
      h("div", { className: "mw-hero-text" }, "Your infinite mix")),
    h("div", { className: "mw-start-section" },
      h("button", {
        className: `mw-start-btn${state.isLoading ? " mw-loading" : ""}`,
        onClick: () => engine.start(),
      }, h(PlayIcon, { size: 18 }), "Start"),
      h("button", {
        className: `mw-start-btn mw-start-fav${state.isLoading ? " mw-loading" : ""}`,
        onClick: () => engine.startFavorites(),
      }, h(HeartIcon, { size: 16, filled: true }), "My Favorites")),
    h(MoodChips, { activeMood: null, isActive: false, topLikedArtist: state.topLikedArtist, isFavoritesMode: false, pinnedMood: state.pinnedMood }));
}

// --- Mood Chips ---
function MoodChips({ activeMood, isActive, topLikedArtist, isFavoritesMode, pinnedMood }: {
  activeMood: string | null; isActive: boolean; topLikedArtist: string | null;
  isFavoritesMode: boolean; pinnedMood: string | null;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const visible = expanded ? MOODS : MOODS.slice(0, 4);

  return h("div", { className: "mw-moods" },
    h("div", { className: "mw-moods-header" },
      h("div", { className: "mw-moods-label" }, "MOOD"),
      expanded && h("button", {
        className: "mw-moods-collapse",
        onClick: () => setExpanded(false),
      }, "\u2715")),
    h("div", { className: `mw-moods-row${expanded ? " mw-moods-expanded" : ""}` },
      // Favorites chip
      h("button", {
        key: "favorites",
        className: `mw-mood mw-mood-fav${isFavoritesMode ? " mw-mood-on" : ""}${pinnedMood === "__favorites__" ? " mw-mood-pinned" : ""}`,
        onClick: () => {
          if (isFavoritesMode && isActive) { engine.stop(); return; }
          if (isActive) engine.stop();
          setTimeout(() => engine.startFavorites(), 100);
        },
        onContextMenu: (e: Event) => { e.preventDefault(); engine.togglePinFavorites(); },
      }, h(HeartIcon, { size: 11, filled: true }),
        pinnedMood === "__favorites__" ? " Favorites \u{1F4CC}" : " Favorites"),
      // Top artist chip
      topLikedArtist && h("button", {
        key: "top-artist",
        className: "mw-mood mw-mood-artist",
        onClick: () => {
          if (isActive) engine.stop();
          setTimeout(() => engine.startFromArtistName(topLikedArtist), 100);
        },
      }, `\u2605 ${topLikedArtist}`),
      // Mood chips
      visible.map(mood =>
        h("button", {
          key: mood.id,
          className: `mw-mood${activeMood === mood.id ? " mw-mood-on" : ""}${pinnedMood === mood.id ? " mw-mood-pinned" : ""}`,
          onClick: () => {
            if (activeMood === mood.id) { engine.stop(); return; }
            if (isActive) engine.stop();
            setTimeout(() => engine.start(mood.id), 100);
          },
          onContextMenu: (e: Event) => { e.preventDefault(); engine.togglePinMood(mood.id); },
        }, pinnedMood === mood.id ? `${mood.label} \u{1F4CC}` : mood.label)),
      !expanded && h("button", {
        key: "more",
        className: "mw-mood mw-mood-more",
        onClick: () => setExpanded(true),
      }, `+${MOODS.length - 4}`)));
}

// --- Inline Stats ---
function InlineStats({ state }: { state: ReturnType<WaveEngine["getState"]> }) {
  useTimeTick(state.isActive);
  const mins = state.sessionMinutes;
  const timeStr = mins < 1 ? "<1m" : `${mins}m`;
  return h("div", { className: "mw-istats" },
    h("div", { className: "mw-istat" },
      h("div", { className: "mw-istat-val" }, `${state.playedCount}`),
      h("div", { className: "mw-istat-lbl" }, "tracks")),
    h("div", { className: "mw-istat" },
      h("div", { className: "mw-istat-val" }, timeStr),
      h("div", { className: "mw-istat-lbl" }, "listened")),
    h("div", { className: "mw-istat" },
      h("div", { className: "mw-istat-val" }, `${state.uniqueArtistsCount}`),
      h("div", { className: "mw-istat-lbl" }, "artists")));
}

// --- History Tab ---
function HistoryTab({ history }: { history: HistoryEntry[] }) {
  if (history.length === 0) {
    return h("div", { className: "mw-empty" }, "No tracks played yet");
  }
  return h("div", { className: "mw-hist" },
    history.slice(0, 20).map((entry, i) =>
      h("div", {
        key: entry.uri + entry.timestamp,
        className: "mw-hist-row",
        style: { animationDelay: `${i * 30}ms` },
      },
        h("div", { className: "mw-hist-num" }, `${i + 1}`),
        entry.imageUrl
          ? h("img", { className: "mw-hist-art", src: entry.imageUrl, alt: "", onClick: () => engine.playFromHistory(entry.uri) })
          : h("div", { className: "mw-hist-art mw-hist-ph", onClick: () => engine.playFromHistory(entry.uri) }),
        h("div", { className: "mw-hist-info", onClick: () => engine.playFromHistory(entry.uri) },
          h("div", { className: "mw-hist-name" }, entry.name),
          h("div", { className: "mw-hist-artist" }, entry.artist)),
        h(LikeButton, { uri: entry.uri }))));
}

// --- Like Button (history rows) ---
function LikeButton({ uri }: { uri: string }) {
  const [liked, setLiked] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await (Spicetify as any).Platform.LibraryAPI.contains(uri);
        if (!cancelled) setLiked(!!res);
      } catch {
        // Some Spicetify versions use a different API shape
        try {
          const res = await Spicetify.CosmosAsync.get(
            `https://api.spotify.com/v1/me/tracks/contains?ids=${uri.split(":").pop()}`
          );
          if (!cancelled && Array.isArray(res)) setLiked(res[0]);
        } catch {}
      }
    })();
    return () => { cancelled = true; };
  }, [uri]);

  const toggle = async (e: Event) => {
    e.stopPropagation();
    try {
      if (liked) {
        await (Spicetify as any).Platform.LibraryAPI.remove({ uris: [uri] });
      } else {
        await (Spicetify as any).Platform.LibraryAPI.add({ uris: [uri] });
      }
      setLiked(!liked);
    } catch {}
  };
  return h("button", {
    className: `mw-like${liked ? " mw-liked" : ""}`,
    onClick: toggle,
  }, h(HeartIcon, { size: 14, filled: liked }));
}

// --- Stats Tab ---
function StatsTab({ state }: { state: ReturnType<WaveEngine["getState"]> }) {
  useTimeTick(state.isActive);

  if (!state.isActive && state.history.length === 0) {
    return h("div", { className: "mw-empty" }, "Start a mix to see stats");
  }

  const mins = state.sessionMinutes;
  const timeStr = mins < 1 ? "<1m" : `${mins}m`;

  return h("div", { className: "mw-stats-tab" },
    h("div", { className: "mw-stats-grid" },
      h("div", { className: "mw-stat-card" },
        h("div", { className: "mw-stat-val" }, `${state.playedCount}`),
        h("div", { className: "mw-stat-lbl" }, "tracks")),
      h("div", { className: "mw-stat-card" },
        h("div", { className: "mw-stat-val" }, timeStr),
        h("div", { className: "mw-stat-lbl" }, "listened")),
      h("div", { className: "mw-stat-card" },
        h("div", { className: "mw-stat-val" }, `${state.uniqueArtistsCount}`),
        h("div", { className: "mw-stat-lbl" }, "artists"))),

    state.topArtists.length > 0 && h("div", { className: "mw-top-artists" },
      h("div", { className: "mw-top-label" }, "TOP ARTISTS"),
      state.topArtists.map((a, i) =>
        h("div", { key: a.name, className: "mw-top-row", style: { animationDelay: `${i * 40}ms` } },
          h("div", { className: "mw-top-rank" }, `${i + 1}`),
          h("div", { className: "mw-top-name" }, a.name),
          h("div", { className: "mw-top-count" }, `${a.count} plays`)))),

    state.seedTrackName && h("div", { className: "mw-stat-seed" },
      h("span", { className: "mw-stat-seed-lbl" },
        state.activeMood ? "Mood" : state.isFavoritesMode ? "Mode" : "Seed"),
      h("span", null, state.seedTrackName)));
}

// ============================================================
// Entry Point
// ============================================================

function cleanupPreviousInstance() {
  // Stop engine if it was running
  if (engine.getState().isActive) {
    engine.stop();
  }

  // Remove old DOM elements
  const oldBb = document.getElementById("mywave-bb");
  if (oldBb) {
    ReactDOM.unmountComponentAtNode(oldBb);
    oldBb.remove();
  }
  const oldHome = document.getElementById("mywave-home");
  if (oldHome) {
    ReactDOM.unmountComponentAtNode(oldHome);
    oldHome.remove();
  }
  const oldStyles = document.getElementById("mywave-styles");
  if (oldStyles) oldStyles.remove();

  // Disconnect previous observer
  if ((window as any).__mywaveObserver) {
    (window as any).__mywaveObserver.disconnect();
    (window as any).__mywaveObserver = null;
  }

  // Deregister previous context menu
  if ((window as any).__mywaveCtxMenu) {
    try { (window as any).__mywaveCtxMenu.deregister(); } catch {}
    (window as any).__mywaveCtxMenu = null;
  }

  console.log("[MyWave] Cleaned up previous instance");
}

async function main() {
  while (!Spicetify?.React || !Spicetify?.ReactDOM) {
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));

  React = Spicetify.React;
  ReactDOM = Spicetify.ReactDOM;
  console.log("[MyWave] Initializing...");

  cleanupPreviousInstance();
  injectStyles();
  registerContextMenu();
  engine.loadTopLikedArtist();
  injectHomeBanner();

  const bbContainer = document.createElement("div");
  bbContainer.id = "mywave-bb";

  const repeatBtn =
    document.querySelector("[data-testid='control-button-repeat']") ||
    document.querySelector("button[aria-label='Repeat']") ||
    document.querySelector("button[aria-label*='repeat' i]");

  let bbMounted = false;
  if (repeatBtn?.parentElement) {
    repeatBtn.parentElement.insertBefore(bbContainer, repeatBtn.nextSibling);
    bbMounted = true;
  }
  if (!bbMounted) {
    const ctrl = document.querySelector(".player-controls__buttons") ||
      document.querySelector("[data-testid='player-controls']") ||
      document.querySelector(".player-controls");
    if (ctrl) { ctrl.appendChild(bbContainer); bbMounted = true; }
  }
  if (!bbMounted) {
    bbContainer.style.cssText = "position:fixed;bottom:80px;right:16px;z-index:9999";
    document.body.appendChild(bbContainer);
  }
  ReactDOM.render(h(BottomBarWidget), bbContainer);
}

// --- Context Menu ---
function registerContextMenu() {
  try {
    const CtxMenu = (Spicetify as any).ContextMenu;
    if (!CtxMenu) { console.log("[MyWave] ContextMenu API not available"); return; }

    const menuItem = new CtxMenu.Item(
      "Start Mix from this",
      (uris: string[]) => {
        const uri = uris[0];
        if (uri?.includes("playlist")) {
          engine.startFromPlaylist(uri);
        }
      },
      (uris: string[]) => {
        return uris.length === 1 && uris[0]?.includes("playlist");
      },
    );
    menuItem.register();
    (window as any).__mywaveCtxMenu = menuItem;
    console.log("[MyWave] Context menu registered");
  } catch (e) {
    console.log("[MyWave] Failed to register context menu:", e);
  }
}

// --- Home Page Banner ---
function injectHomeBanner() {
  let mounted = false;

  function tryInject() {
    if (mounted && document.getElementById("mywave-home")) return;
    const old = document.getElementById("mywave-home");
    if (old) { old.remove(); mounted = false; }

    const homeContent =
      document.querySelector('[data-testid="home-page"]') ||
      document.querySelector('.main-home-content');
    if (!homeContent) return;

    const container = document.createElement("div");
    container.id = "mywave-home";

    // Find a valid direct child to insert before
    const children = homeContent.children;
    if (children.length > 0) {
      try {
        homeContent.insertBefore(container, children[0]);
      } catch {
        // If insertBefore fails, try prepend or append
        try { homeContent.prepend(container); } catch { homeContent.appendChild(container); }
      }
    } else {
      homeContent.appendChild(container);
    }

    ReactDOM.render(h(HomeBanner), container);
    mounted = true;
    console.log("[MyWave] Home banner injected");
  }

  setTimeout(tryInject, 2000);
  setTimeout(tryInject, 5000);

  let debounceTimer: any = null;
  const obs = new MutationObserver(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(tryInject, 300);
  });
  const mainView = document.querySelector('.Root__main-view') || document.body;
  obs.observe(mainView, { childList: true, subtree: true });

  // Store reference for cleanup
  (window as any).__mywaveObserver = obs;
}

// ============================================================
// Styles
// ============================================================

function injectStyles() {
  if (document.getElementById("mywave-styles")) return;
  const s = document.createElement("style");
  s.id = "mywave-styles";
  s.textContent = `
    :root {
      --mw-ease: cubic-bezier(0.23, 1, 0.32, 1);
      --mw-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
      --mw-g: #1DB954;
      --mw-g2: #1ed760;
      --mw-bg: #0a0a0a;
      --mw-card: #141414;
      --mw-border: #1e1e1e;
      --mw-text: #e8e8e8;
      --mw-sub: #6a6a6a;
      --mw-glow: rgba(29,185,84,.12);
      --mw-mono: 'Courier New', 'Consolas', 'Monaco', monospace;
    }

    .mw-wave-icon { display:flex; flex-shrink:0; }
    .mw-wbar { fill:currentColor; transform-origin:bottom center; }
    .mw-trigger-on .mw-wbar-1 { animation:mw-b .45s ease-in-out infinite alternate; }
    .mw-trigger-on .mw-wbar-2 { animation:mw-b .45s ease-in-out .07s infinite alternate; }
    .mw-trigger-on .mw-wbar-3 { animation:mw-b .45s ease-in-out .14s infinite alternate; }
    .mw-trigger-on .mw-wbar-4 { animation:mw-b .45s ease-in-out .21s infinite alternate; }
    @keyframes mw-b { 0%{transform:scaleY(.25)} 100%{transform:scaleY(1)} }
    @keyframes mw-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }

    /* ===== EQUALIZER VISUALIZER ===== */
    .mw-eq {
      font-family: var(--mw-mono);
      font-size: 9px;
      line-height: 1.1;
      text-align: center;
      color: rgba(29,185,84,.18);
      padding: 8px 0;
      user-select: none;
      letter-spacing: 2.5px;
    }
    .mw-eq-mini { font-size: 7px; letter-spacing: 2px; padding: 4px 0; }
    .mw-eq-on { color: var(--mw-g); }
    .mw-eq-row { white-space: pre; height: 1.1em; }
    .mw-eq-ch {
      transition: opacity 0.12s;
    }
    .mw-eq-on .mw-eq-ch {
      text-shadow: 0 0 6px rgba(29,185,84,.5), 0 0 14px rgba(29,185,84,.15);
    }
    .mw-eq:not(.mw-eq-on) .mw-eq-ch { opacity: 0.35; }
    .mw-eq-sp { opacity: 0; }

    /* ===== ASCII BANNER IN PANEL ===== */
    .mw-ascii-banner {
      position: relative;
      border-radius: 12px;
      background: radial-gradient(ellipse at center, rgba(29,185,84,.06) 0%, transparent 70%);
      overflow: hidden;
      padding: 4px 0;
      animation: mw-in 300ms var(--mw-ease) both;
    }
    .mw-ascii-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }
    .mw-ascii-label {
      font-family: var(--mw-mono);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 3px;
      color: #fff;
      text-shadow: 0 0 6px var(--mw-g), 0 0 16px rgba(29,185,84,.5);
      display: flex;
      align-items: center;
    }

    /* ===== CONSOLE CURSOR ===== */
    .mw-cursor {
      animation: mw-cursor-blink 1s step-end infinite;
      opacity: 1;
      font-size: 0.9em;
    }
    @keyframes mw-cursor-blink { 0%,100%{opacity:1} 50%{opacity:0} }

    /* ===== KILL SPOTIFY PURPLE BG ===== */
    #mywave-home ~ *,
    [data-testid="home-page"] > [style*="background-color"],
    .main-home-homeHeader,
    .main-home-homeHeader[style] { background-color: transparent !important; }

    /* ===== SEA WAVES ===== */
    .mw-sea {
      position: absolute;
      inset: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      font-family: var(--mw-mono);
      color: var(--mw-g);
      font-size: 11px;
      line-height: 1.5;
      white-space: nowrap;
      pointer-events: none;
      z-index: 0;
    }
    .mw-sea-row {
      white-space: nowrap;
      animation: mw-sea-scroll linear infinite;
    }
    @keyframes mw-sea-scroll {
      from { transform: translateX(0); }
      to { transform: translateX(-50%); }
    }

    /* ===== HOME BANNER ===== */
    #mywave-home { padding: 0 32px; margin-bottom: 8px; }
    .mw-home {
      position: relative;
      border-radius: 14px;
      background: linear-gradient(180deg, #040804 0%, #030603 100%);
      border: 1px solid rgba(29,185,84,.1);
      overflow: hidden;
      cursor: default;
      min-height: 130px;
      transition: border-color 300ms var(--mw-ease);
    }
    .mw-home:hover { border-color: rgba(29,185,84,.25); }
    .mw-home-glow {
      position: absolute;
      top: -30%; left: 30%;
      width: 40%; height: 160%;
      background: radial-gradient(ellipse, rgba(29,185,84,.08) 0%, transparent 70%);
      pointer-events: none;
      z-index: 1;
    }
    .mw-home-inner {
      position: relative;
      z-index: 2;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 16px 20px 14px;
    }
    /* Top: brand + typing tag */
    .mw-home-top-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .mw-home-brand {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 800;
      color: var(--mw-text);
      letter-spacing: -0.3px;
    }
    .mw-home-brand svg { color: var(--mw-g); }
    .mw-home-tag {
      flex-shrink: 0;
    }
    .mw-home-tag .mw-ascii-label {
      font-size: 10px;
      letter-spacing: 2px;
      min-width: 100px;
      color: var(--mw-g);
      text-shadow: 0 0 8px rgba(29,185,84,.4);
    }
    .mw-home-desc {
      font-size: 12px;
      color: var(--mw-sub);
      font-family: var(--mw-mono);
      letter-spacing: 0.5px;
    }
    .mw-home-np {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .mw-home-np-art {
      width: 32px; height: 32px;
      border-radius: 6px;
      object-fit: cover;
      box-shadow: 0 0 10px rgba(29,185,84,.15);
    }
    .mw-home-np-text { min-width: 0; }
    .mw-home-np-name {
      font-size: 13px; font-weight: 600; color: var(--mw-text);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .mw-home-np-artist {
      font-size: 11px; color: var(--mw-sub);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .mw-home-btns {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .mw-home-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 7px 16px;
      border: none;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: background 150ms, transform 200ms var(--mw-spring), box-shadow 150ms;
    }
    .mw-home-btn:active { transform: scale(.95); transition-duration: 80ms; }
    .mw-home-btn-play { background: var(--mw-g); color: black; }
    .mw-home-btn-play:hover { background: var(--mw-g2); box-shadow: 0 2px 16px rgba(29,185,84,.3); }
    .mw-home-btn-fav { background: rgba(255,255,255,.06); color: var(--mw-text); border: 1px solid rgba(255,255,255,.1); }
    .mw-home-btn-fav:hover { background: rgba(255,255,255,.1); }
    .mw-home-btn-fav svg { color: #E91E63; }
    .mw-home-btn-stop { background: rgba(255,255,255,.06); color: var(--mw-text); border: 1px solid rgba(255,255,255,.1); }
    .mw-home-btn-stop:hover { background: rgba(255,255,255,.1); }
    .mw-home-btn-mix { background: rgba(29,185,84,.15); color: var(--mw-g); border: 1px solid rgba(29,185,84,.2); }
    .mw-home-btn-mix:hover { background: rgba(29,185,84,.25); }
    .mw-home-live {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      color: var(--mw-g);
      font-family: var(--mw-mono);
    }
    .mw-home-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: var(--mw-g);
      box-shadow: 0 0 6px var(--mw-g);
      animation: mw-blink 1.5s ease-in-out infinite;
    }
    .mw-home-moods {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding-bottom: 2px;
      scrollbar-width: none;
    }
    .mw-home-moods::-webkit-scrollbar { display: none; }
    .mw-home-mood {
      flex-shrink: 0;
      padding: 5px 14px;
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.04);
      color: var(--mw-sub);
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: background 150ms var(--mw-ease), border-color 150ms, color 150ms, transform 200ms var(--mw-spring);
    }
    .mw-home-mood:hover { color: var(--mw-text); border-color: rgba(255,255,255,.15); background: rgba(255,255,255,.08); }
    .mw-home-mood:active { transform: scale(.95); transition-duration: 80ms; }
    .mw-home-mood-on { background: var(--mw-g); border-color: var(--mw-g); color: black; }
    .mw-home-mood-on:hover { background: var(--mw-g2); border-color: var(--mw-g2); }
    .mw-home-mood-artist { border-color: rgba(29,185,84,.3); color: var(--mw-g); }

    /* ===== TRIGGER ===== */
    #mywave-bb { display:flex; align-items:center; margin:0 4px; }
    .mw-bottombar { position:relative; display:flex; align-items:center; }
    .mw-trigger {
      display:flex; align-items:center; gap:8px;
      border:none; border-radius:6px; padding:4px 8px;
      background:transparent; color:var(--mw-sub); cursor:pointer;
      transition:color 150ms var(--mw-ease), background 150ms var(--mw-ease), transform 200ms var(--mw-spring);
    }
    .mw-trigger:hover { color:var(--mw-text); background:rgba(255,255,255,.05); }
    .mw-trigger:active { transform:scale(.97); transition-duration:80ms; }
    .mw-trigger-on { color:var(--mw-g); }
    .mw-trigger-icon { display:flex; align-items:center; justify-content:center; width:28px; height:28px; flex-shrink:0; }

    /* ===== PANEL ===== */
    .mw-panel {
      position:absolute; bottom:44px; right:-8px; width:360px;
      border-radius:16px; background:var(--mw-bg);
      border:1px solid var(--mw-border);
      box-shadow: 0 24px 80px rgba(0,0,0,.8), 0 0 1px rgba(29,185,84,.15);
      overflow:hidden; z-index:10000;
      transform-origin:bottom right;
      animation:mw-pop 250ms var(--mw-ease) forwards;
    }
    @keyframes mw-pop { from{opacity:0;transform:scale(.96) translateY(4px)} to{opacity:1;transform:none} }
    .mw-panel-inner { padding:16px; display:flex; flex-direction:column; gap:14px; max-height:520px; overflow-y:auto; }
    .mw-panel-inner::-webkit-scrollbar { width:3px; }
    .mw-panel-inner::-webkit-scrollbar-thumb { background:rgba(255,255,255,.06); border-radius:2px; }

    /* ===== HEADER ===== */
    .mw-header { display:flex; align-items:center; justify-content:space-between; }
    .mw-header-left { display:flex; align-items:center; gap:10px; }
    .mw-header-title { font-size:16px; font-weight:800; color:var(--mw-text); letter-spacing:-0.3px; }
    .mw-logo {
      display:flex; align-items:center; justify-content:center;
      width:32px; height:32px; border-radius:8px;
      background:var(--mw-g); color:black;
      box-shadow: 0 0 12px rgba(29,185,84,.3);
    }
    .mw-header-tabs { display:flex; gap:2px; }
    .mw-htab {
      display:flex; align-items:center; justify-content:center;
      width:30px; height:30px; border:none; border-radius:8px;
      background:transparent; color:var(--mw-sub); cursor:pointer;
      transition:background 150ms var(--mw-ease), color 150ms var(--mw-ease), transform 200ms var(--mw-spring);
    }
    .mw-htab:hover { background:rgba(255,255,255,.05); color:var(--mw-text); }
    .mw-htab:active { transform:scale(.9); transition-duration:80ms; }
    .mw-htab-on { background:var(--mw-glow); color:var(--mw-g); }

    /* ===== HERO (inactive state) ===== */
    .mw-hero {
      text-align: center;
      padding: 4px 0 8px;
      animation: mw-in 250ms var(--mw-ease) both;
    }
    .mw-hero-text {
      font-family: var(--mw-mono);
      font-size: 10px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--mw-sub);
      margin-top: 4px;
    }

    /* ===== NOW PLAYING ===== */
    .mw-np {
      display:flex; flex-direction:column; gap:8px;
      padding:12px; border-radius:12px;
      background:var(--mw-card);
      border:1px solid var(--mw-border);
      animation:mw-in 250ms var(--mw-ease) both;
    }
    .mw-np-top { display:flex; align-items:center; gap:12px; }
    .mw-np-art-wrap { position:relative; width:44px; height:44px; flex-shrink:0; }
    .mw-np-art-glow {
      position:absolute; inset:-6px; width:calc(100% + 12px); height:calc(100% + 12px);
      border-radius:12px; object-fit:cover;
      filter:blur(10px) saturate(1.8) brightness(0.7);
      opacity:0.55; z-index:0; pointer-events:none;
    }
    .mw-np-art {
      position:relative; z-index:1;
      width:44px; height:44px; border-radius:8px; object-fit:cover; flex-shrink:0;
      background:linear-gradient(135deg,#0d1a0d,#080808);
      box-shadow: 0 0 12px rgba(29,185,84,.08);
    }
    .mw-np-ph { background:linear-gradient(135deg,rgba(29,185,84,.15),#080808); }
    .mw-np-info { flex:1; min-width:0; }
    .mw-np-name { font-size:14px; font-weight:600; color:var(--mw-text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .mw-np-artist { font-size:12px; color:var(--mw-sub); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

    .mw-np-controls { display:flex; align-items:center; gap:4px; padding-top:4px; border-top:1px solid var(--mw-border); }
    .mw-np-btn {
      display:flex; align-items:center; gap:5px;
      border:none; border-radius:6px; padding:5px 10px;
      background:transparent; color:var(--mw-sub); cursor:pointer;
      font-size:11px; font-weight:600;
      transition:background 150ms var(--mw-ease), color 150ms var(--mw-ease), transform 200ms var(--mw-spring);
    }
    .mw-np-btn:hover { background:rgba(255,255,255,.05); color:var(--mw-text); }
    .mw-np-btn:active { transform:scale(.93); transition-duration:80ms; }
    .mw-np-like:hover { color:#E91E63; }
    .mw-np-dislike:hover { color:#ff5252; }
    .mw-np-locked { color:var(--mw-g) !important; background:var(--mw-glow) !important; }
    .mw-np-lock { margin-left:auto; }
    .mw-np-mixfrom { color:var(--mw-g); }
    .mw-np-mixfrom:hover { background:rgba(29,185,84,.1); color:var(--mw-g2); }

    /* ===== MOOD CHIPS ===== */
    .mw-moods { display:flex; flex-direction:column; gap:8px; animation:mw-in 250ms var(--mw-ease) 50ms both; }
    .mw-moods-header { display:flex; align-items:center; justify-content:space-between; }
    .mw-moods-label {
      font-family: var(--mw-mono);
      font-size:9px; font-weight:700; letter-spacing:2px; color:var(--mw-sub); text-transform:uppercase;
    }
    .mw-moods-collapse {
      border:none; background:none; color:var(--mw-sub); cursor:pointer; font-size:12px; padding:2px 6px; border-radius:4px;
      transition: color 150ms, background 150ms;
    }
    .mw-moods-collapse:hover { color:var(--mw-text); background:rgba(255,255,255,.05); }
    .mw-moods-row { display:flex; gap:6px; flex-wrap:wrap; overflow:hidden; }
    .mw-moods-expanded .mw-mood { animation: mw-in 150ms var(--mw-ease) both; }
    .mw-mood {
      padding:6px 16px; border-radius:20px; border:1px solid var(--mw-border);
      background:transparent; color:var(--mw-text); font-size:13px; font-weight:600; cursor:pointer;
      transition:background 150ms var(--mw-ease), border-color 150ms var(--mw-ease), color 150ms var(--mw-ease), transform 200ms var(--mw-spring);
    }
    .mw-mood:hover { background:rgba(255,255,255,.04); border-color:#333; }
    .mw-mood:active { transform:scale(.95); transition-duration:80ms; }
    .mw-mood-on { background:var(--mw-g); border-color:var(--mw-g); color:black; }
    .mw-mood-on:hover { background:var(--mw-g2); border-color:var(--mw-g2); }
    .mw-mood-artist { border-color:rgba(29,185,84,.3); color:var(--mw-g); }
    .mw-mood-artist:hover { border-color:rgba(29,185,84,.5); background:rgba(29,185,84,.08); }
    .mw-mood-fav { border-color:rgba(233,30,99,.3); color:#E91E63; display:flex; align-items:center; gap:2px; }
    .mw-mood-fav:hover { border-color:rgba(233,30,99,.5); background:rgba(233,30,99,.08); }
    .mw-mood-fav.mw-mood-on { background:#E91E63; border-color:#E91E63; color:white; }
    .mw-mood-pinned { box-shadow:0 0 0 1.5px var(--mw-g) inset; border-color:var(--mw-g); }
    .mw-mood-more { border-style:dashed; color:var(--mw-sub); }
    .mw-mood-more:hover { border-style:solid; }

    /* ===== INLINE STATS ===== */
    .mw-istats { display:flex; gap:8px; animation:mw-in 250ms var(--mw-ease) 100ms both; }
    .mw-istat { flex:1; padding:10px 12px; border-radius:10px; background:var(--mw-card); border:1px solid var(--mw-border); }
    .mw-istat-val { font-size:18px; font-weight:800; color:var(--mw-text); line-height:1.2; font-family:var(--mw-mono); }
    .mw-istat-lbl { font-size:10px; color:var(--mw-sub); font-weight:500; margin-top:2px; }

    /* ===== START ===== */
    .mw-start-section { display:flex; flex-direction:column; gap:8px; animation:mw-in 250ms var(--mw-ease) both; }
    .mw-start-btn {
      display:flex; align-items:center; justify-content:center; gap:8px;
      width:100%; padding:12px; border:none; border-radius:12px;
      font-size:14px; font-weight:700; cursor:pointer;
      transition:background 150ms var(--mw-ease), transform 200ms var(--mw-spring), box-shadow 150ms var(--mw-ease);
      background:var(--mw-g); color:black;
    }
    .mw-start-btn:hover { background:var(--mw-g2); box-shadow:0 4px 24px rgba(29,185,84,.25); }
    .mw-start-btn:active { transform:scale(.97); transition-duration:80ms; }
    .mw-start-fav { background:var(--mw-card); color:var(--mw-text); border:1px solid var(--mw-border); }
    .mw-start-fav:hover { background:#1a1a1a; box-shadow:none; }
    .mw-start-fav svg { color:#E91E63; }
    .mw-loading { opacity:.5; pointer-events:none; }

    /* ===== HISTORY ===== */
    .mw-hist { display:flex; flex-direction:column; gap:2px; max-height:280px; overflow-y:auto; }
    .mw-hist::-webkit-scrollbar { width:3px; }
    .mw-hist::-webkit-scrollbar-thumb { background:rgba(255,255,255,.06); border-radius:2px; }
    .mw-hist-row { display:flex; align-items:center; gap:10px; padding:6px 4px; border-radius:8px; animation:mw-in 200ms var(--mw-ease) both; transition:background 150ms var(--mw-ease); }
    .mw-hist-row:hover { background:rgba(255,255,255,.03); }
    .mw-hist-num { font-family:var(--mw-mono); font-size:10px; color:rgba(255,255,255,.15); width:16px; text-align:center; flex-shrink:0; font-weight:600; }
    .mw-hist-art { width:36px; height:36px; border-radius:6px; object-fit:cover; flex-shrink:0; cursor:pointer; background:linear-gradient(135deg,#1a1a1a,#0a0a0a); transition:transform 200ms var(--mw-spring); }
    .mw-hist-art:hover { transform:scale(1.08); }
    .mw-hist-ph { background:linear-gradient(135deg,#222,#111); }
    .mw-hist-info { flex:1; min-width:0; cursor:pointer; }
    .mw-hist-name { font-size:13px; font-weight:500; color:var(--mw-text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .mw-hist-artist { font-size:11px; color:var(--mw-sub); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

    .mw-like {
      display:flex; align-items:center; justify-content:center;
      width:28px; height:28px; border:none; border-radius:50%;
      background:transparent; color:rgba(255,255,255,.15); cursor:pointer; flex-shrink:0;
      transition:color 150ms var(--mw-ease), transform 200ms var(--mw-spring);
    }
    .mw-like:hover { color:rgba(255,255,255,.4); transform:scale(1.15); }
    .mw-like:active { transform:scale(.9); transition-duration:80ms; }
    .mw-liked { color:#E91E63 !important; }

    /* ===== STATS TAB ===== */
    .mw-stats-tab { display:flex; flex-direction:column; gap:12px; animation:mw-in 250ms var(--mw-ease) both; }
    .mw-stats-grid { display:flex; gap:8px; }
    .mw-stat-card { flex:1; padding:10px 12px; border-radius:10px; background:var(--mw-card); border:1px solid var(--mw-border); }
    .mw-stat-val { font-size:18px; font-weight:800; color:var(--mw-text); line-height:1.2; font-family:var(--mw-mono); }
    .mw-stat-lbl { font-size:10px; color:var(--mw-sub); font-weight:500; margin-top:2px; }

    .mw-top-artists { display:flex; flex-direction:column; gap:4px; }
    .mw-top-label { font-family:var(--mw-mono); font-size:9px; font-weight:700; letter-spacing:2px; color:var(--mw-sub); text-transform:uppercase; margin-bottom:4px; }
    .mw-top-row { display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:8px; background:var(--mw-card); border:1px solid var(--mw-border); animation:mw-in 200ms var(--mw-ease) both; }
    .mw-top-rank { font-family:var(--mw-mono); font-size:14px; font-weight:800; color:var(--mw-g); width:18px; }
    .mw-top-name { flex:1; font-size:13px; font-weight:600; color:var(--mw-text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .mw-top-count { font-family:var(--mw-mono); font-size:11px; color:var(--mw-sub); flex-shrink:0; }

    .mw-stat-seed { display:flex; align-items:center; gap:8px; font-size:12px; color:var(--mw-sub); padding:8px 10px; border-radius:8px; background:var(--mw-card); border:1px solid var(--mw-border); }
    .mw-stat-seed-lbl { font-family:var(--mw-mono); font-weight:700; color:var(--mw-g); text-transform:uppercase; font-size:9px; letter-spacing:1px; }

    /* ===== BOTTOM ACTIONS ===== */
    .mw-actions { display:flex; gap:8px; padding-top:2px; }
    .mw-act {
      display:flex; align-items:center; justify-content:center; gap:6px;
      flex:1; padding:10px; border-radius:10px; border:none;
      font-size:13px; font-weight:700; cursor:pointer;
      transition:background 150ms var(--mw-ease), transform 200ms var(--mw-spring), box-shadow 150ms var(--mw-ease);
    }
    .mw-act:active { transform:scale(.96); transition-duration:80ms; }
    .mw-act-stop { background:var(--mw-card); color:var(--mw-text); border:1px solid var(--mw-border); }
    .mw-act-stop:hover { background:#1a1a1a; }
    .mw-act-reseed { background:var(--mw-g); color:black; }
    .mw-act-reseed:hover { background:var(--mw-g2); box-shadow:0 2px 16px rgba(29,185,84,.2); }

    .mw-empty { font-size:13px; color:var(--mw-sub); text-align:center; padding:24px 0; }

    @keyframes mw-blink { 0%,100%{opacity:1} 50%{opacity:.3} }

    @media (prefers-reduced-motion:reduce) {
      .mw-panel,.mw-np,.mw-hist-row,.mw-moods,.mw-istats,.mw-stat-card,.mw-start-section,.mw-wbar,.mw-top-row,.mw-eq-row,.mw-eq-ch { animation:none !important; transition:none !important; }
    }
  `;
  document.head.appendChild(s);
}

(async () => { await main(); })();
