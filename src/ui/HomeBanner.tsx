import { MOODS } from "../engine/constants";
import { WaveEngine } from "../engine/WaveEngine";
import { moodOfTheDay } from "../engine/prefs";
import { WaveIcon, PlayIcon, StopIcon, HeartIcon, MixIcon } from "./icons";
import { SeaWaves, PanelMixLabel, triggerNewMix } from "./visualizers";
import { useEngineState } from "./hooks";
import { ScrollText } from "./panel";

const h = (...args: any[]) => Spicetify.React.createElement(...(args as [any, any, ...any[]]));

let engine: WaveEngine;
export function setHomeBannerEngine(e: WaveEngine) { engine = e; }

// ========== HOME PAGE BANNER ==========
export function HomeBanner() {
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
              h(ScrollText, { className: "mw-home-np-name", children: state.currentTrackName }),
              h(ScrollText, { className: "mw-home-np-artist", children: state.currentArtistName })))
        : (() => {
            const todayId = moodOfTheDay(MOODS.map(m => m.id));
            const todayMood = todayId ? MOODS.find(m => m.id === todayId) : null;
            return h("div", { className: "mw-home-desc" },
              "Endless mix from your taste",
              todayMood && h("button", {
                className: "mw-home-today",
                onClick: () => { if (state.isActive) engine.stop(); setTimeout(() => engine.start(todayMood.id), 100); },
                title: "Today's suggestion — click to start",
                style: {
                  marginLeft: 10,
                  padding: "2px 8px",
                  fontSize: 10,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  background: "transparent",
                  border: "1px solid currentColor",
                  borderRadius: 10,
                  opacity: 0.7,
                  cursor: "pointer",
                  color: "inherit",
                } as any,
              }, `today · ${todayMood.label}`));
          })(),
      // Buttons
      h("div", { className: "mw-home-btns" },
        state.isActive
          ? h(Spicetify.React.Fragment, null,
              h("button", { className: "mw-home-btn mw-home-btn-stop", onClick: () => engine.stop() },
                h(StopIcon, { size: 12 }), "Stop"),
              h("button", { className: "mw-home-btn mw-home-btn-mix", onClick: () => { triggerNewMix(); engine.reseed(); } },
                h(MixIcon, { size: 12 }), "New mix"),
              h("div", { className: "mw-home-live" },
                h("span", { className: "mw-home-dot" }),
                `${state.playedCount} tracks`))
          : h("button", { className: "mw-home-btn mw-home-btn-play", onClick: () => engine.startFavorites() },
                h(PlayIcon, { size: 14 }), "Start")),
      // Pinned items — synced with mini-menu
      h("div", { className: "mw-home-moods" },
        state.pinnedMoods.includes("__favorites__") && h("button", {
          key: "favorites",
          className: `mw-home-mood mw-home-mood-fav${state.isFavoritesMode ? " mw-home-mood-on" : ""}`,
          onClick: () => {
            if (state.isFavoritesMode && state.isActive) { engine.stop(); return; }
            if (state.isActive) engine.stop();
            setTimeout(() => engine.startFavorites(), 100);
          },
        }, "\u2665 Favorites"),
        state.pinnedArtists.map(name =>
          h("button", {
            key: `artist-${name}`,
            className: `mw-home-mood mw-home-mood-artist${state.lockedArtist === name && state.isActive ? " mw-home-mood-on" : ""}`,
            onClick: () => {
              if (state.lockedArtist === name && state.isActive) { engine.stop(); return; }
              if (state.isActive) engine.stop();
              setTimeout(() => engine.startFromArtistName(name), 100);
            },
          }, `\u2605 ${name}`)),
        state.pinnedPlaylists.map(pl =>
          h("button", {
            key: `pl-${pl.uri}`,
            className: `mw-home-mood mw-home-mood-playlist${state.seedTrackName === pl.name && state.isActive ? " mw-home-mood-on" : ""}`,
            onClick: () => {
              if (state.seedTrackName === pl.name && state.isActive) { engine.stop(); return; }
              if (state.isActive) engine.stop();
              setTimeout(() => engine.startFromPlaylist(pl.uri, pl.name), 100);
            },
          }, `\u266A ${pl.name}`)),
        state.pinnedMoods.filter(id => id !== "__favorites__").map(id => {
          const mood = MOODS.find(m => m.id === id);
          if (!mood) return null;
          return h("button", {
            key: id,
            className: `mw-home-mood${state.activeMood === id ? " mw-home-mood-on" : ""}`,
            onClick: () => handleMood(id),
          }, mood.label);
        }).filter(Boolean))));
}
