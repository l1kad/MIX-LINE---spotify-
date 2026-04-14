// MyWave — Infinite music stream for Spotify

import { WaveEngine } from "./engine/WaveEngine";
import { setHooksEngine } from "./ui/hooks";
import { setEngine as setPanelEngine } from "./ui/panel";
import { setHomeBannerEngine, HomeBanner } from "./ui/HomeBanner";
import { setBottomBarEngine, BottomBarWidget } from "./ui/BottomBarWidget";
import { injectStyles } from "./styles";

// ============================================================
// Entry Point
// ============================================================

let React: typeof Spicetify.React;
let ReactDOM: typeof Spicetify.ReactDOM;
const engine = new WaveEngine();

const h = (...args: any[]) => Spicetify.React.createElement(...(args as [any, any, ...any[]]));

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

  setHooksEngine(engine);
  setPanelEngine(engine);
  setHomeBannerEngine(engine);
  setBottomBarEngine(engine);

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

(async () => { await main(); })();
