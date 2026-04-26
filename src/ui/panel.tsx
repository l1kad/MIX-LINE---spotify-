import { HistoryEntry, WaveState } from "../engine/types";
import { MOODS } from "../engine/constants";
import { WaveEngine } from "../engine/WaveEngine";
import { HeartIcon, PlayIcon, StopIcon, MixIcon, MoodIcon, HistoryIcon, StatsIcon, ThumbDownIcon, PinIcon, SaveIcon, CompassIcon, ShareIcon, SparkleIcon } from "./icons";
import { payloadFromState, buildShareUrl, copyToClipboard } from "../engine/share";
import { pushToast } from "../engine/toast";
import { AsciiWave, PanelMixLabel, triggerNewMix } from "./visualizers";
import { useTimeTick } from "./hooks";

const h = (...args: any[]) => Spicetify.React.createElement(...(args as [any, any, ...any[]]));

// Marquee scroll for long text
export function ScrollText({ className, children }: { className: string; children: string }) {
  const ref = Spicetify.React.useRef(null as HTMLDivElement | null);
  const [scrolling, setScrolling] = Spicetify.React.useState(false);
  const prevText = Spicetify.React.useRef(children);

  Spicetify.React.useEffect(() => {
    if (children !== prevText.current) { setScrolling(false); prevText.current = children; }
  }, [children]);

  Spicetify.React.useEffect(() => {
    if (scrolling) return;
    const el = ref.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      if (el.scrollWidth > el.clientWidth + 2) setScrolling(true);
    });
    return () => cancelAnimationFrame(id);
  }, [children, scrolling]);

  if (scrolling) {
    return h("div", { className: `${className} mw-scroll` },
      h("span", { className: "mw-scroll-track" },
        h("span", null, children),
        h("span", { className: "mw-scroll-gap" }, "\u00a0\u00a0\u00a0\u00b7\u00a0\u00a0\u00a0"),
        h("span", null, children)));
  }
  return h("div", { ref, className }, children);
}

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
        h(ScrollText, { className: "mw-np-name", children: state.currentTrackName }),
        h(ScrollText, { className: "mw-np-artist", children: state.currentArtistName }))),
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
        className: `mw-np-btn mw-np-discovery${state.discoveryOnly ? " mw-np-locked" : ""}`,
        onClick: () => engine.setDiscoveryOnly(!state.discoveryOnly),
        title: state.discoveryOnly ? "Discovery Only: on" : "Discovery Only: only unfamiliar artists",
      }, h(CompassIcon, { size: 14 })),
      h("button", {
        className: "mw-np-btn mw-np-save",
        onClick: () => engine.saveMixAsPlaylist(),
        title: "Save current mix as playlist",
      }, h(SaveIcon, { size: 14 })),
      h("button", {
        className: "mw-np-btn mw-np-share",
        onClick: async () => {
          const payload = payloadFromState(state);
          if (!payload) { pushToast("/nothing to share", { kind: "error" }); return; }
          const url = buildShareUrl(payload);
          const ok = await copyToClipboard(url);
          pushToast(ok ? "/link copied" : "/copy failed", { kind: ok ? "info" : "error" });
        },
        title: "Copy share link for this mix",
      }, h(ShareIcon, { size: 14 })),
      h("button", {
        className: "mw-np-btn mw-np-mixfrom",
        onClick: () => { triggerNewMix(); engine.reseedFromTrack(); },
        title: "Mix from this track",
      }, h(MixIcon, { size: 14 })),
      h("button", {
        className: "mw-np-btn mw-np-morelike",
        onClick: () => engine.moreLikeThis(),
        title: "More like this — queue similar tracks",
      }, h(SparkleIcon, { size: 14 }))));
}

// --- Main Tab ---
export function MainTab({ state }: { state: WaveState }) {
  if (state.isActive) {
    return h(Spicetify.React.Fragment, null,
      h(PinnedMoodRow, { state }),
      h(InlineStats, { state }));
  }

  const track = Spicetify.Player.data?.item;
  const trackName = track?.metadata?.title || null;
  const artistName = track?.metadata?.artist_name || null;
  const imageUrl = track?.metadata?.image_url || null;

  return h(Spicetify.React.Fragment, null,
    h("div", { className: "mw-hero" },
      h(AsciiWave, { active: false }),
      h("div", { className: "mw-hero-text" }, "Your infinite mix")),
    h("div", { className: "mw-start-section" },
      h("button", {
        className: `mw-start-btn${state.isLoading ? " mw-loading" : ""}`,
        onClick: () => engine.startFavorites(),
      }, h(PlayIcon, { size: 16 }), "Start"),
      trackName && h("button", {
        className: `mw-start-btn mw-start-alt${state.isLoading ? " mw-loading" : ""}`,
        onClick: () => engine.start(),
        title: `Mix from: ${trackName}`,
      }, h(MixIcon, { size: 14 }), "Mix from this track")),
    h(PinnedMoodRow, { state }));
}

// --- Pinned Row (main tab — only pinned items) ---
export function PinnedMoodRow({ state }: { state: WaveState }) {
  const pinned = state.pinnedMoods;
  const moodPins = pinned.filter(id => id !== "__favorites__")
    .map(id => MOODS.find(m => m.id === id)).filter(Boolean) as typeof MOODS[number][];

  if (pinned.length === 0 && state.pinnedArtists.length === 0 && state.pinnedPlaylists.length === 0) {
    return h("div", { className: "mw-moods" },
      h("div", { className: "mw-moods-empty" }, "Pin items in the Mood tab"));
  }

  return h("div", { className: "mw-moods" },
    h("div", { className: "mw-moods-row" },
      pinned.includes("__favorites__") && h("button", {
        key: "favorites",
        className: `mw-mood mw-mood-fav${state.isFavoritesMode ? " mw-mood-on" : ""}`,
        onClick: () => {
          if (state.isFavoritesMode && state.isActive) { engine.stop(); return; }
          if (state.isActive) engine.stop();
          setTimeout(() => engine.startFavorites(), 100);
        },
      }, h(HeartIcon, { size: 11, filled: true }), " Favorites"),
      state.pinnedArtists.map(name =>
        h("button", {
          key: `artist-${name}`,
          className: `mw-mood mw-mood-artist${state.lockedArtist === name && state.isActive ? " mw-mood-on" : ""}`,
          onClick: () => {
            if (state.lockedArtist === name && state.isActive) { engine.stop(); return; }
            if (state.isActive) engine.stop();
            setTimeout(() => engine.startFromArtistName(name), 100);
          },
        }, `\u2605 ${name}`)),
      state.pinnedPlaylists.map(pl =>
        h("button", {
          key: `pl-${pl.uri}`,
          className: `mw-mood mw-mood-playlist${state.seedTrackName === pl.name && state.isActive ? " mw-mood-on" : ""}`,
          onClick: () => {
            if (state.seedTrackName === pl.name && state.isActive) { engine.stop(); return; }
            if (state.isActive) engine.stop();
            setTimeout(() => engine.startFromPlaylist(pl.uri, pl.name), 100);
          },
        }, `\u266A ${pl.name}`)),
      moodPins.map(mood =>
        h("button", {
          key: mood.id,
          className: `mw-mood${state.activeMood === mood.id ? " mw-mood-on" : ""}`,
          onClick: () => {
            if (state.activeMood === mood.id) { engine.stop(); return; }
            if (state.isActive) engine.stop();
            setTimeout(() => engine.start(mood.id), 100);
          },
        }, mood.label))));
}

// --- User Playlists (shown in My Library section) ---
function UserPlaylists({ state }: { state: WaveState }) {
  const [playlists, setPlaylists] = Spicetify.React.useState([] as { name: string; uri: string; imageUrl: string }[]);
  const [loaded, setLoaded] = Spicetify.React.useState(false);

  Spicetify.React.useEffect(() => {
    if (loaded) return;
    engine.getUserPlaylists().then(r => { setPlaylists(r); setLoaded(true); });
  }, [loaded]);

  if (!loaded) return h("div", { className: "mw-mt-loading" }, "Loading...");
  if (playlists.length === 0) return null;

  const pinnedUris = state.pinnedPlaylists.map(p => p.uri);

  return h("div", { className: "mw-mt-list mw-mt-mypl" },
    playlists.map(pl => {
      const isPinned = pinnedUris.includes(pl.uri);
      return h("div", {
        key: pl.uri,
        className: `mw-mt-artist-btn${isPinned ? " mw-mt-artist-active" : ""}`,
      },
        pl.imageUrl && h("img", { className: "mw-mt-artist-img mw-mt-pl-cover", src: pl.imageUrl, alt: "" }),
        h("span", { className: "mw-mt-pl-name" }, pl.name),
        h("button", {
          className: `mw-mood-pin${isPinned ? " mw-mood-pin-on" : ""}`,
          onClick: () => engine.togglePinPlaylist(pl.name, pl.uri),
          title: isPinned ? "Unpin" : "Pin to main",
        }, h(PinIcon, { size: 12, filled: isPinned })));
    }));
}

// --- Mood Tab (artist picker + playlist picker + all moods with pin toggles) ---
export function MoodTab({ state }: { state: WaveState }) {
  const pinned = state.pinnedMoods;

  // Artist search
  const [artistResults, setArtistResults] = Spicetify.React.useState([] as { name: string; id: string; imageUrl: string }[]);
  const [artistSearching, setArtistSearching] = Spicetify.React.useState(false);
  const [artistQuery, setArtistQuery] = Spicetify.React.useState(false);
  const artistRef = Spicetify.React.useRef(null as HTMLInputElement | null);
  const artistTimer = Spicetify.React.useRef(null as any);

  // Playlist search
  const [plResults, setPlResults] = Spicetify.React.useState([] as { name: string; uri: string; imageUrl: string; owner: string }[]);
  const [plSearching, setPlSearching] = Spicetify.React.useState(false);
  const [plQuery, setPlQuery] = Spicetify.React.useState(false);
  const plRef = Spicetify.React.useRef(null as HTMLInputElement | null);
  const plTimer = Spicetify.React.useRef(null as any);

  const doArtistSearch = Spicetify.React.useCallback((val: string) => {
    if (artistTimer.current) clearTimeout(artistTimer.current);
    if (!val.trim()) { setArtistResults([]); setArtistQuery(false); return; }
    setArtistQuery(true);
    artistTimer.current = setTimeout(async () => {
      setArtistSearching(true);
      try { setArtistResults(await engine.searchArtists(val.trim())); } catch {}
      setArtistSearching(false);
    }, 600);
  }, []);

  const doPlSearch = Spicetify.React.useCallback((val: string) => {
    if (plTimer.current) clearTimeout(plTimer.current);
    if (!val.trim()) { setPlResults([]); setPlQuery(false); return; }
    setPlQuery(true);
    plTimer.current = setTimeout(async () => {
      setPlSearching(true);
      try { setPlResults(await engine.searchPlaylists(val.trim())); } catch {}
      setPlSearching(false);
    }, 600);
  }, []);

  Spicetify.React.useEffect(() => {
    const el = artistRef.current;
    if (!el) return;
    const handler = () => doArtistSearch(el.value);
    el.addEventListener("input", handler);
    return () => el.removeEventListener("input", handler);
  }, [doArtistSearch]);

  Spicetify.React.useEffect(() => {
    const el = plRef.current;
    if (!el) return;
    const handler = () => doPlSearch(el.value);
    el.addEventListener("input", handler);
    return () => el.removeEventListener("input", handler);
  }, [doPlSearch]);

  const pickArtist = (name: string) => {
    engine.togglePinArtist(name);
    if (artistRef.current) artistRef.current.value = "";
    setArtistResults([]); setArtistQuery(false);
  };

  const pickPlaylist = (name: string, uri: string) => {
    engine.togglePinPlaylist(name, uri);
    if (plRef.current) plRef.current.value = "";
    setPlResults([]); setPlQuery(false);
  };

  const pinnedUris = state.pinnedPlaylists.map(p => p.uri);

  return h("div", { className: "mw-mood-tab" },
    // Artist section
    h("div", { className: "mw-mt-section" },
      h("div", { className: "mw-moods-label" }, "ARTISTS"),
      state.pinnedArtists.length > 0 && h("div", { className: "mw-mt-list" },
        state.pinnedArtists.map(name =>
          h("button", {
            key: name,
            className: "mw-mt-artist-btn mw-mt-artist-active",
            onClick: () => engine.togglePinArtist(name),
          }, `\u2605 ${name}`,
            h(PinIcon, { size: 12, filled: true })))),
      h("input", {
        ref: artistRef,
        className: "mw-mt-search",
        type: "text",
        placeholder: "Search artists...",
      }),
      artistQuery && h("div", { className: "mw-mt-list" },
        artistSearching && h("div", { className: "mw-mt-loading" }, "Searching..."),
        artistResults.map(a =>
          h("button", {
            key: a.id,
            className: `mw-mt-artist-btn${state.pinnedArtists.includes(a.name) ? " mw-mt-artist-active" : ""}`,
            onClick: () => pickArtist(a.name),
          },
            a.imageUrl && h("img", { className: "mw-mt-artist-img", src: a.imageUrl, alt: "" }),
            a.name)))),

    // Playlist section
    h("div", { className: "mw-mt-section" },
      h("div", { className: "mw-moods-label" }, "PLAYLISTS"),
      state.pinnedPlaylists.length > 0 && h("div", { className: "mw-mt-list" },
        state.pinnedPlaylists.map(pl =>
          h("button", {
            key: pl.uri,
            className: "mw-mt-artist-btn mw-mt-artist-active",
            onClick: () => engine.togglePinPlaylist(pl.name, pl.uri),
          }, `\u266A ${pl.name}`,
            h(PinIcon, { size: 12, filled: true })))),
      h("input", {
        ref: plRef,
        className: "mw-mt-search",
        type: "text",
        placeholder: "Search playlists...",
      }),
      plQuery && h("div", { className: "mw-mt-list" },
        plSearching && h("div", { className: "mw-mt-loading" }, "Searching..."),
        plResults.map(p =>
          h("button", {
            key: p.uri,
            className: `mw-mt-artist-btn${pinnedUris.includes(p.uri) ? " mw-mt-artist-active" : ""}`,
            onClick: () => pickPlaylist(p.name, p.uri),
          },
            p.imageUrl && h("img", { className: "mw-mt-artist-img", src: p.imageUrl, alt: "" }),
            h("div", { className: "mw-mt-pl-info" },
              h("div", null, p.name),
              p.owner && h("div", { className: "mw-mt-pl-owner" }, p.owner)))))),

    // Favorites section — liked songs pin + user's own playlists
    h("div", { className: "mw-mt-section" },
      h("div", { className: "mw-mt-section-header" },
        h("div", { className: "mw-moods-label" }, "MY LIBRARY"),
        h("button", {
          className: `mw-mood-pin${pinned.includes("__favorites__") ? " mw-mood-pin-on" : ""}`,
          onClick: () => engine.togglePinFavorites(),
          title: pinned.includes("__favorites__") ? "Unpin Liked Songs" : "Pin Liked Songs",
        }, h(HeartIcon, { size: 12, filled: true }),
          h(PinIcon, { size: 12, filled: pinned.includes("__favorites__") }))),
      h(UserPlaylists, { state })),

    // Moods section
    h("div", { className: "mw-mt-section" },
      h("div", { className: "mw-moods-label" }, "MOODS"),
      h("div", { className: "mw-mood-grid" },
        MOODS.map(mood =>
          h("div", {
            key: mood.id,
            className: `mw-mood-item${state.activeMood === mood.id ? " mw-mood-item-on" : ""}`,
          },
            h("button", {
              className: "mw-mood-item-btn",
              onClick: () => {
                if (state.activeMood === mood.id) { engine.stop(); return; }
                if (state.isActive) engine.stop();
                setTimeout(() => engine.start(mood.id), 100);
              },
            }, mood.label),
            h("button", {
              className: `mw-mood-pin${pinned.includes(mood.id) ? " mw-mood-pin-on" : ""}`,
              onClick: () => engine.togglePinMood(mood.id),
              title: pinned.includes(mood.id) ? "Unpin" : "Pin to main",
            }, h(PinIcon, { size: 12, filled: pinned.includes(mood.id) })))))));
}

// --- Inline Source Info ---
export function InlineStats({ state }: { state: WaveState }) {
  const source = state.lockedArtist
    ? `Artist: ${state.lockedArtist}`
    : state.activeMood
      ? `Mood: ${state.activeMood}`
      : state.isFavoritesMode
        ? "Favorites"
        : state.seedTrackName || "Your library";

  return h("div", { className: "mw-isource" },
    h("span", { className: "mw-isource-lbl" }, "Mixing from"),
    h("span", { className: "mw-isource-val" }, source));
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
          h(ScrollText, { className: "mw-hist-name", children: entry.name }),
          h(ScrollText, { className: "mw-hist-artist", children: entry.artist })),
        h(LikeButton, { uri: entry.uri }))));
}

// --- Like Button (history rows) ---
export function LikeButton({ uri }: { uri: string }) {
  const [liked, setLiked] = Spicetify.React.useState(false);

  Spicetify.React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await (Spicetify as any).Platform.LibraryAPI.contains(uri);
        if (!cancelled) setLiked(Array.isArray(res) ? !!res[0] : !!res);
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
