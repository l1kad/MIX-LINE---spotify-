import { HistoryEntry, WaveState } from "../engine/types";
import { MOODS } from "../engine/constants";
import { WaveEngine } from "../engine/WaveEngine";
import { HeartIcon, PlayIcon, StopIcon, MixIcon, MoodIcon, HistoryIcon, StatsIcon, LockIcon, ThumbDownIcon } from "./icons";
import { AsciiWave, PanelMixLabel, triggerNewMix } from "./visualizers";
import { useTimeTick } from "./hooks";

const React = Spicetify.React;
const h = (...args: any[]) => React.createElement(...(args as [any, any, ...any[]]));

let engine: WaveEngine;
export function setEngine(e: WaveEngine) { engine = e; }

// --- Now Playing Card ---
export function NowPlayingCard({ state }: { state: WaveState }) {
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
export function MainTab({ state }: { state: WaveState }) {
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
export function MoodChips({ activeMood, isActive, topLikedArtist, isFavoritesMode, pinnedMood }: {
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
export function InlineStats({ state }: { state: WaveState }) {
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
export function HistoryTab({ history }: { history: HistoryEntry[] }) {
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
export function LikeButton({ uri }: { uri: string }) {
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
export function StatsTab({ state }: { state: WaveState }) {
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
