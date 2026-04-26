import { cssBase } from "./base";
import { cssHome } from "./home";
import { cssPanel } from "./panel";
import { cssOnboarding } from "./onboarding";
import { cssWeekly } from "./weekly";

const cssReducedMotion = `
    @media (prefers-reduced-motion:reduce) {
      .mw-panel,.mw-np,.mw-hist-row,.mw-moods,.mw-istats,.mw-stat-card,.mw-start-section,.mw-wbar,.mw-top-row,.mw-eq,.mw-np-art-glow,.mw-trigger-icon,.mw-home-glow,.mw-home-dot,.mw-tab-body,.mw-ob-backdrop,.mw-ob-modal,.mw-ob-content { animation:none !important; transition:none !important; }
      .mw-wk-backdrop,.mw-wk-page,.mw-wk-title::before,.mw-wk-title::after,.mw-wk-tag-dot,.mw-wk-mbar,.mw-wk-deco-bl::before,.mw-wk-deco-br::before,.mw-wk-deco-bl::after,.mw-wk-deco-br::after { animation:none !important; }
    }
`;

export function injectStyles() {
  if (document.getElementById("mywave-styles")) return;
  const s = document.createElement("style");
  s.id = "mywave-styles";
  s.textContent = cssBase + cssHome + cssPanel + cssOnboarding + cssWeekly + cssReducedMotion;
  document.head.appendChild(s);
}
