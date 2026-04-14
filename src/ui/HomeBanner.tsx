import { MOODS } from "../engine/constants";
import { WaveEngine } from "../engine/WaveEngine";
import { WaveIcon, PlayIcon, StopIcon, HeartIcon, MixIcon } from "./icons";
import { SeaWaves, PanelMixLabel, triggerNewMix } from "./visualizers";
import { useEngineState } from "./hooks";

const React = Spicetify.React;
const h = (...args: any[]) => React.createElement(...(args as [any, any, ...any[]]));

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
