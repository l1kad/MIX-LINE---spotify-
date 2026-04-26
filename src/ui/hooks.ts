import { WaveEngine } from "../engine/WaveEngine";

let engine: WaveEngine;
export function setHooksEngine(e: WaveEngine) { engine = e; }

export function useEngineState() {
  const React = Spicetify.React;
  const [state, setState] = React.useState(engine.getState());
  const pending = React.useRef(false);
  React.useEffect(() => {
    const unsub = engine.subscribe(() => {
      // Throttle: batch rapid notify() calls into one RAF
      if (pending.current) return;
      pending.current = true;
      requestAnimationFrame(() => {
        pending.current = false;
        setState({ ...engine.getState() });
      });
    });
    return () => { unsub(); };
  }, []);
  return state;
}

export function useIsPlaying(): boolean {
  const React = Spicetify.React;
  const [playing, setPlaying] = React.useState(!!Spicetify.Player?.isPlaying?.());
  React.useEffect(() => {
    const update = () => setPlaying(!!Spicetify.Player?.isPlaying?.());
    Spicetify.Player.addEventListener?.("onplaypause", update);
    // also catch song changes
    Spicetify.Player.addEventListener?.("songchange", update);
    return () => {
      Spicetify.Player.removeEventListener?.("onplaypause", update);
      Spicetify.Player.removeEventListener?.("songchange", update);
    };
  }, []);
  return playing;
}

export function useTimeTick(active: boolean) {
  const React = Spicetify.React;
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      engine.notify?.();
      setTick(t => t + 1);
    }, 30000);
    return () => clearInterval(id);
  }, [active]);
}

// --- Global visibility state ---
// Pauses all animations when Spotify window is hidden/minimized
const visListeners = new Set<(v: boolean) => void>();
let _visible = !document.hidden;

function _onVisChange() {
  _visible = !document.hidden;
  // Toggle CSS class to pause all CSS animations
  if (_visible) document.body.classList.remove("mw-paused");
  else document.body.classList.add("mw-paused");
  visListeners.forEach(cb => cb(_visible));
}
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", _onVisChange);
  // Set initial state
  if (document.hidden) document.body.classList.add("mw-paused");
}

export function isAppVisible(): boolean { return _visible; }

export function useAppVisible(): boolean {
  const React = Spicetify.React;
  const [vis, setVis] = React.useState(_visible);
  React.useEffect(() => {
    visListeners.add(setVis);
    return () => { visListeners.delete(setVis); };
  }, []);
  return vis;
}
