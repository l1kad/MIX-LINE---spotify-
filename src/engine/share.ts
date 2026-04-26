// Shared Mix Link.
// Encodes the current mix seed into a short base64url token. When another
// user opens Spotify with the token on the URL (or paste+apply), the
// same mix starts for them. No server required.

import type { WaveState } from "./types";
import type { WaveEngine } from "./WaveEngine";

export type ShareKind = "track" | "mood" | "artist" | "playlist" | "favorites";

export interface SharePayload {
  v: 1;             // format version
  k: ShareKind;
  u: string;        // uri / mood id / artist name / playlist uri, or "" for favorites
  n?: string;       // optional display name
  s?: string[];     // seed pool (up to 5 recent listened track URIs)
  d?: boolean;      // discovery only mode
}

// ---------- base64url helpers (unicode safe) ----------
function toB64Url(s: string): string {
  const b64 = btoa(unescape(encodeURIComponent(s)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64Url(s: string): string {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return decodeURIComponent(escape(atob(b64)));
}

export function encodeShare(p: SharePayload): string {
  try { return toB64Url(JSON.stringify(p)); }
  catch { return ""; }
}
export function decodeShare(token: string): SharePayload | null {
  try {
    const raw = fromB64Url(token);
    const obj = JSON.parse(raw);
    if (obj && obj.v === 1 && typeof obj.k === "string" && typeof obj.u === "string") {
      return obj as SharePayload;
    }
  } catch {}
  return null;
}

// ---------- building a payload from current engine state ----------
// The current state doesn't expose every internal but the observable parts
// are enough to reconstruct "start this mix".
export function payloadFromState(state: WaveState): SharePayload | null {
  const seeds = (state.history || []).slice(0, 5).map(h => h.uri);
  const disc = state.discoveryOnly || undefined;

  if (state.lockedArtist) {
    return { v: 1, k: "artist", u: state.lockedArtist, n: state.lockedArtist, s: seeds, d: disc };
  }
  if (state.activeMood) {
    return { v: 1, k: "mood", u: state.activeMood, s: seeds, d: disc };
  }
  if (state.isFavoritesMode) {
    return { v: 1, k: "favorites", u: "", n: "Favorites", s: seeds, d: disc };
  }
  // playlist-seeded: engine stores playlist URI as currentUri base? no —
  // we check pinned playlists by seedTrackName match to get uri.
  const pl = state.pinnedPlaylists.find(p => p.name === state.seedTrackName);
  if (pl) {
    return { v: 1, k: "playlist", u: pl.uri, n: pl.name, s: seeds, d: disc };
  }
  if (state.currentUri) {
    return { v: 1, k: "track", u: state.currentUri, n: state.currentTrackName, s: seeds, d: disc };
  }
  return null;
}

// ---------- full URL helpers ----------
// We use a hash fragment (#mywave=...) because Spotify Desktop's embedded
// Chromium tends to preserve it across navigation, and it's not sent to
// any server.
const PARAM = "mywave";

export function buildShareUrl(p: SharePayload): string {
  const base = "https://open.spotify.com/";
  return `${base}#${PARAM}=${encodeShare(p)}`;
}

export function parseShareFromLocation(): SharePayload | null {
  try {
    // hash fragment
    const hash = window.location.hash || "";
    const hashMatch = hash.match(new RegExp(`${PARAM}=([A-Za-z0-9_-]+)`));
    if (hashMatch) return decodeShare(hashMatch[1]);
    // query string fallback
    const search = window.location.search || "";
    const qsMatch = search.match(new RegExp(`[?&]${PARAM}=([A-Za-z0-9_-]+)`));
    if (qsMatch) return decodeShare(qsMatch[1]);
  } catch {}
  return null;
}

// One-shot guard: once we've applied a share from the URL we clear the hash
// so it doesn't re-trigger on navigation.
export function clearShareFromLocation() {
  try {
    if (window.location.hash?.includes(PARAM)) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  } catch {}
}

export async function applyShare(engine: WaveEngine, p: SharePayload): Promise<boolean> {
  try {
    // Apply discovery mode if shared
    if (p.d) engine.setDiscoveryOnly(true);

    switch (p.k) {
      case "mood":
        await engine.start(p.u);
        break;
      case "favorites":
        await engine.startFavorites();
        break;
      case "artist":
        await (engine as any).startFromArtistName?.(p.u);
        break;
      case "playlist":
        await engine.startFromPlaylist(p.u, p.n);
        break;
      case "track": {
        // Start playback of the track, then start mix from it.
        try {
          await (Spicetify as any).Platform?.PlayerAPI?.play({ uri: p.u }, {}, {});
          // Small delay to let Player.data update
          await new Promise((r) => setTimeout(r, 600));
        } catch {}
        await engine.start();
        break;
      }
      default:
        return false;
    }

    // Queue seed pool tracks from the shared session for similar direction
    if (p.s && p.s.length > 0) {
      try {
        const seedIds = p.s.map(u => u.split(":").pop()).filter(Boolean).slice(0, 5);
        if (seedIds.length > 0) {
          const rec = await Spicetify.CosmosAsync.get(
            `https://api.spotify.com/v1/recommendations?seed_tracks=${seedIds.join(",")}&limit=10`
          );
          if (rec?.tracks?.length > 0) {
            const uris = rec.tracks.map((t: any) => ({ uri: t.uri }));
            await Spicetify.addToQueue(uris);
            console.log("[MyWave] Shared session: queued", uris.length, "tracks from shared seeds");
          }
        }
      } catch (e) {
        console.log("[MyWave] Shared seed queue failed:", e);
      }
    }

    return true;
  } catch (e) {
    console.error("[MyWave] applyShare failed:", e);
  }
  return false;
}

// Copy helper (tolerates environments without Clipboard API)
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  } catch {}
  return false;
}
