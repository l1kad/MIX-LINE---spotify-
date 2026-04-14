import { WaveEngine } from "../engine/WaveEngine";

let engine: WaveEngine;
export function setHooksEngine(e: WaveEngine) { engine = e; }

export function useEngineState() {
  const React = Spicetify.React;
  const [state, setState] = React.useState(engine.getState());
  React.useEffect(() => {
    const unsub = engine.subscribe(() => setState({ ...engine.getState() }));
    return () => { unsub(); };
  }, []);
  return state;
}

export function useTimeTick(active: boolean) {
  const React = Spicetify.React;
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, [active]);
}
