export const cssHome = `
    /* ===== KILL SPOTIFY PURPLE BG ===== */
    #mywave-home ~ *,
    [data-testid="home-page"] > [style*="background-color"],
    .main-home-homeHeader,
    .main-home-homeHeader[style] { background-color: transparent !important; }

    /* ===== SEA WAVES ===== */
    .mw-sea {
      position: absolute;
      inset: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      font-family: var(--mw-mono);
      color: var(--mw-g);
      font-size: 9px;
      line-height: 1.35;
      letter-spacing: 1.5px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 0;
    }
    .mw-sea-row {
      white-space: nowrap;
      animation: mw-sea-scroll linear infinite;
      will-change: transform;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
    }
    @keyframes mw-sea-scroll {
      from { transform: translate3d(0,0,0); }
      to { transform: translate3d(-50%,0,0); }
    }

    /* ===== HOME BANNER ===== */
    #mywave-home { padding: 0 32px; margin-bottom: 8px; }
    .mw-home {
      position: relative;
      border-radius: 14px;
      background: linear-gradient(180deg, #050a05 0%, #030503 100%);
      border: 1px solid rgba(29,185,84,.08);
      overflow: hidden;
      cursor: default;
      min-height: 130px;
      transition: border-color 400ms var(--mw-ease), box-shadow 400ms var(--mw-ease);
    }
    .mw-home:hover { border-color: rgba(29,185,84,.2); box-shadow:0 4px 30px rgba(29,185,84,.06); }
    .mw-home-glow {
      position: absolute;
      top: -30%; left: 25%;
      width: 50%; height: 160%;
      background: radial-gradient(ellipse, rgba(29,185,84,.06) 0%, transparent 65%);
      pointer-events: none;
      z-index: 1;
      animation:mw-home-glow-drift 8s ease-in-out infinite;
    }
    @keyframes mw-home-glow-drift {
      0%,100% { transform:translateX(0); opacity:1; }
      50% { transform:translateX(8px); opacity:.8; }
    }
    .mw-home-inner {
      position: relative;
      z-index: 2;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 16px 20px 14px;
    }
    /* Top: brand + typing tag */
    .mw-home-top-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .mw-home-brand {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 800;
      color: var(--mw-text);
      letter-spacing: -0.3px;
    }
    .mw-home-brand svg { color: var(--mw-g); }
    .mw-home-tag {
      flex-shrink: 0;
    }
    .mw-home-tag .mw-ascii-label {
      font-size: 10px;
      letter-spacing: 2px;
      min-width: 100px;
      color: var(--mw-g);
      text-shadow: 0 0 8px rgba(29,185,84,.4);
    }
    .mw-home-desc {
      font-size: 12px;
      color: var(--mw-sub);
      font-family: var(--mw-mono);
      letter-spacing: 0.5px;
    }
    .mw-home-np {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .mw-home-np-art {
      width: 32px; height: 32px;
      border-radius: 6px;
      object-fit: cover;
      box-shadow: 0 0 10px rgba(29,185,84,.15);
    }
    .mw-home-np-text { min-width: 0; }
    .mw-home-np-name {
      font-size: 13px; font-weight: 600; color: var(--mw-text);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .mw-home-np-artist {
      font-size: 11px; color: var(--mw-sub);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .mw-home-btns {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .mw-home-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 7px 16px;
      border: none;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: background 150ms, transform 200ms var(--mw-spring), box-shadow 150ms;
    }
    .mw-home-btn:active { transform: scale(.95); transition-duration: 80ms; }
    .mw-home-btn-play { background: var(--mw-g); color: black; box-shadow:0 2px 10px rgba(29,185,84,.2); }
    .mw-home-btn-play:hover { background: var(--mw-g2); box-shadow: 0 4px 20px rgba(29,185,84,.35); }
    .mw-home-btn-fav { background: rgba(255,255,255,.06); color: var(--mw-text); border: 1px solid rgba(255,255,255,.1); }
    .mw-home-btn-fav:hover { background: rgba(255,255,255,.1); }
    .mw-home-btn-fav svg { color: #E91E63; }
    .mw-home-btn-stop { background: rgba(255,255,255,.06); color: var(--mw-text); border: 1px solid rgba(255,255,255,.1); }
    .mw-home-btn-stop:hover { background: rgba(255,255,255,.1); }
    .mw-home-btn-mix { background: rgba(29,185,84,.15); color: var(--mw-g); border: 1px solid rgba(29,185,84,.2); }
    .mw-home-btn-mix:hover { background: rgba(29,185,84,.25); }
    .mw-home-live {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      color: var(--mw-g);
      font-family: var(--mw-mono);
    }
    .mw-home-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: var(--mw-g);
      box-shadow: 0 0 6px var(--mw-g), 0 0 12px rgba(29,185,84,.3);
      animation: mw-blink 2s ease-in-out infinite;
    }
    .mw-home-moods {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding-bottom: 2px;
      scrollbar-width: none;
    }
    .mw-home-moods::-webkit-scrollbar { display: none; }
    .mw-home-mood {
      flex-shrink: 0;
      padding: 5px 14px;
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.04);
      color: var(--mw-sub);
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: background 150ms var(--mw-ease), border-color 150ms, color 150ms, transform 200ms var(--mw-spring);
    }
    .mw-home-mood:hover { color: var(--mw-text); border-color: rgba(255,255,255,.15); background: rgba(255,255,255,.08); }
    .mw-home-mood:active { transform: scale(.95); transition-duration: 80ms; }
    .mw-home-mood-on { background: var(--mw-g); border-color: var(--mw-g); color: black; box-shadow:0 2px 10px rgba(29,185,84,.25); }
    .mw-home-mood-on:hover { background: var(--mw-g2); border-color: var(--mw-g2); box-shadow:0 2px 14px rgba(29,185,84,.35); }
    .mw-home-mood-artist { border-color: rgba(29,185,84,.3); color: var(--mw-g); }
    .mw-home-mood-artist.mw-home-mood-on { background:rgba(29,185,84,.15); border-color:var(--mw-g); color:var(--mw-g); box-shadow:0 2px 10px rgba(29,185,84,.25); }
    .mw-home-mood-artist.mw-home-mood-on:hover { background:rgba(29,185,84,.22); box-shadow:0 2px 14px rgba(29,185,84,.35); }
    .mw-home-mood-playlist { border-color:rgba(100,150,255,.3); color:rgba(100,150,255,.9); }
    .mw-home-mood-playlist.mw-home-mood-on { background:rgba(100,150,255,.15); border-color:rgba(100,150,255,.7); color:rgba(100,150,255,1); box-shadow:0 2px 10px rgba(100,150,255,.25); }
    .mw-home-mood-playlist.mw-home-mood-on:hover { background:rgba(100,150,255,.22); box-shadow:0 2px 14px rgba(100,150,255,.35); }
    .mw-home-mood-fav { border-color:rgba(233,30,99,.3); color:#E91E63; }
    .mw-home-mood-fav:hover { border-color:rgba(233,30,99,.5); background:rgba(233,30,99,.08); }
    .mw-home-mood-fav.mw-home-mood-on { background:rgba(233,30,99,.15); border-color:#E91E63; color:#E91E63; box-shadow:0 2px 10px rgba(233,30,99,.25); }
    .mw-home-mood-fav.mw-home-mood-on:hover { background:rgba(233,30,99,.22); border-color:#E91E63; box-shadow:0 2px 14px rgba(233,30,99,.35); }
`;
