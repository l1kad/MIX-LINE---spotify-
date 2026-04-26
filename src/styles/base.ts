export const cssBase = `
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
    @keyframes mw-marquee {
      0%, 15% { transform: translateX(0); }
      85%, 100% { transform: translateX(calc(-50% - 0.5em)); }
    }
    .mw-scroll { text-overflow: clip !important; }
    .mw-scroll-track {
      display: inline-block;
      white-space: nowrap;
      animation: mw-marquee 16s linear infinite;
    }
    .mw-scroll-gap { opacity: 0.3; }
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
      margin: 0;
      user-select: none;
      letter-spacing: 2.5px;
      white-space: pre;
    }
    .mw-eq-mini { font-size: 7px; letter-spacing: 2px; padding: 4px 0; }
    .mw-eq-on { color: var(--mw-g); text-shadow: 0 0 6px rgba(29,185,84,.5), 0 0 14px rgba(29,185,84,.15); }

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
      text-shadow: 0 0 6px var(--mw-g), 0 0 14px rgba(29,185,84,.4), 0 0 28px rgba(29,185,84,.12);
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

    /* ===== PAUSE ALL ANIMATIONS WHEN HIDDEN ===== */
    .mw-paused .mw-scroll-track,
    .mw-paused .mw-sea-row,
    .mw-paused .mw-cursor,
    .mw-paused .mw-wbar,
    .mw-paused .mw-wk-mbar,
    .mw-paused .mw-wk-tag-dot {
      animation-play-state: paused !important;
    }
    .mw-paused .mw-eq-ch { transition: none !important; }
`;
