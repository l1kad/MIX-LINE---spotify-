export function injectStyles() {
  if (document.getElementById("mywave-styles")) return;
  const s = document.createElement("style");
  s.id = "mywave-styles";
  s.textContent = `
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
      user-select: none;
      letter-spacing: 2.5px;
    }
    .mw-eq-mini { font-size: 7px; letter-spacing: 2px; padding: 4px 0; }
    .mw-eq-on { color: var(--mw-g); }
    .mw-eq-row { white-space: pre; height: 1.1em; }
    .mw-eq-ch {
      transition: opacity 0.12s;
    }
    .mw-eq-on .mw-eq-ch {
      text-shadow: 0 0 6px rgba(29,185,84,.5), 0 0 14px rgba(29,185,84,.15);
    }
    .mw-eq:not(.mw-eq-on) .mw-eq-ch { opacity: 0.35; }
    .mw-eq-sp { opacity: 0; }

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
      text-shadow: 0 0 6px var(--mw-g), 0 0 16px rgba(29,185,84,.5);
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
      font-size: 11px;
      line-height: 1.5;
      white-space: nowrap;
      pointer-events: none;
      z-index: 0;
    }
    .mw-sea-row {
      white-space: nowrap;
      animation: mw-sea-scroll linear infinite;
    }
    @keyframes mw-sea-scroll {
      from { transform: translateX(0); }
      to { transform: translateX(-50%); }
    }

    /* ===== HOME BANNER ===== */
    #mywave-home { padding: 0 32px; margin-bottom: 8px; }
    .mw-home {
      position: relative;
      border-radius: 14px;
      background: linear-gradient(180deg, #040804 0%, #030603 100%);
      border: 1px solid rgba(29,185,84,.1);
      overflow: hidden;
      cursor: default;
      min-height: 130px;
      transition: border-color 300ms var(--mw-ease);
    }
    .mw-home:hover { border-color: rgba(29,185,84,.25); }
    .mw-home-glow {
      position: absolute;
      top: -30%; left: 30%;
      width: 40%; height: 160%;
      background: radial-gradient(ellipse, rgba(29,185,84,.08) 0%, transparent 70%);
      pointer-events: none;
      z-index: 1;
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
    .mw-home-btn-play { background: var(--mw-g); color: black; }
    .mw-home-btn-play:hover { background: var(--mw-g2); box-shadow: 0 2px 16px rgba(29,185,84,.3); }
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
      box-shadow: 0 0 6px var(--mw-g);
      animation: mw-blink 1.5s ease-in-out infinite;
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
    .mw-home-mood-on { background: var(--mw-g); border-color: var(--mw-g); color: black; }
    .mw-home-mood-on:hover { background: var(--mw-g2); border-color: var(--mw-g2); }
    .mw-home-mood-artist { border-color: rgba(29,185,84,.3); color: var(--mw-g); }

    /* ===== TRIGGER ===== */
    #mywave-bb { display:flex; align-items:center; margin:0 4px; }
    .mw-bottombar { position:relative; display:flex; align-items:center; }
    .mw-trigger {
      display:flex; align-items:center; gap:8px;
      border:none; border-radius:6px; padding:4px 8px;
      background:transparent; color:var(--mw-sub); cursor:pointer;
      transition:color 150ms var(--mw-ease), background 150ms var(--mw-ease), transform 200ms var(--mw-spring);
    }
    .mw-trigger:hover { color:var(--mw-text); background:rgba(255,255,255,.05); }
    .mw-trigger:active { transform:scale(.97); transition-duration:80ms; }
    .mw-trigger-on { color:var(--mw-g); }
    .mw-trigger-icon { display:flex; align-items:center; justify-content:center; width:28px; height:28px; flex-shrink:0; }

    /* ===== PANEL ===== */
    .mw-panel {
      position:absolute; bottom:44px; right:-8px; width:360px;
      border-radius:16px; background:var(--mw-bg);
      border:1px solid var(--mw-border);
      box-shadow: 0 24px 80px rgba(0,0,0,.8), 0 0 1px rgba(29,185,84,.15);
      overflow:hidden; z-index:10000;
      transform-origin:bottom right;
      animation:mw-pop 250ms var(--mw-ease) forwards;
    }
    @keyframes mw-pop { from{opacity:0;transform:scale(.96) translateY(4px)} to{opacity:1;transform:none} }
    .mw-panel-inner { padding:16px; display:flex; flex-direction:column; gap:14px; max-height:520px; overflow-y:auto; }
    .mw-panel-inner::-webkit-scrollbar { width:3px; }
    .mw-panel-inner::-webkit-scrollbar-thumb { background:rgba(255,255,255,.06); border-radius:2px; }

    /* ===== HEADER ===== */
    .mw-header { display:flex; align-items:center; justify-content:space-between; }
    .mw-header-left { display:flex; align-items:center; gap:10px; }
    .mw-header-title { font-size:16px; font-weight:800; color:var(--mw-text); letter-spacing:-0.3px; }
    .mw-logo {
      display:flex; align-items:center; justify-content:center;
      width:32px; height:32px; border-radius:8px;
      background:var(--mw-g); color:black;
      box-shadow: 0 0 12px rgba(29,185,84,.3);
    }
    .mw-header-tabs { display:flex; gap:2px; }
    .mw-htab {
      display:flex; align-items:center; justify-content:center;
      width:30px; height:30px; border:none; border-radius:8px;
      background:transparent; color:var(--mw-sub); cursor:pointer;
      transition:background 150ms var(--mw-ease), color 150ms var(--mw-ease), transform 200ms var(--mw-spring);
    }
    .mw-htab:hover { background:rgba(255,255,255,.05); color:var(--mw-text); }
    .mw-htab:active { transform:scale(.9); transition-duration:80ms; }
    .mw-htab-on { background:var(--mw-glow); color:var(--mw-g); }

    /* ===== HERO (inactive state) ===== */
    .mw-hero {
      text-align: center;
      padding: 4px 0 8px;
      animation: mw-in 250ms var(--mw-ease) both;
    }
    .mw-hero-text {
      font-family: var(--mw-mono);
      font-size: 10px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--mw-sub);
      margin-top: 4px;
    }

    /* ===== NOW PLAYING ===== */
    .mw-np {
      display:flex; flex-direction:column; gap:8px;
      padding:12px; border-radius:12px;
      background:var(--mw-card);
      border:1px solid var(--mw-border);
      animation:mw-in 250ms var(--mw-ease) both;
    }
    .mw-np-top { display:flex; align-items:center; gap:12px; }
    .mw-np-art-wrap { position:relative; width:44px; height:44px; flex-shrink:0; }
    .mw-np-art-glow {
      position:absolute; inset:-6px; width:calc(100% + 12px); height:calc(100% + 12px);
      border-radius:12px; object-fit:cover;
      filter:blur(10px) saturate(1.8) brightness(0.7);
      opacity:0.55; z-index:0; pointer-events:none;
    }
    .mw-np-art {
      position:relative; z-index:1;
      width:44px; height:44px; border-radius:8px; object-fit:cover; flex-shrink:0;
      background:linear-gradient(135deg,#0d1a0d,#080808);
      box-shadow: 0 0 12px rgba(29,185,84,.08);
    }
    .mw-np-ph { background:linear-gradient(135deg,rgba(29,185,84,.15),#080808); }
    .mw-np-info { flex:1; min-width:0; }
    .mw-np-name { font-size:14px; font-weight:600; color:var(--mw-text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .mw-np-artist { font-size:12px; color:var(--mw-sub); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

    .mw-np-controls { display:flex; align-items:center; gap:4px; padding-top:4px; border-top:1px solid var(--mw-border); }
    .mw-np-btn {
      display:flex; align-items:center; gap:5px;
      border:none; border-radius:6px; padding:5px 10px;
      background:transparent; color:var(--mw-sub); cursor:pointer;
      font-size:11px; font-weight:600;
      transition:background 150ms var(--mw-ease), color 150ms var(--mw-ease), transform 200ms var(--mw-spring);
    }
    .mw-np-btn:hover { background:rgba(255,255,255,.05); color:var(--mw-text); }
    .mw-np-btn:active { transform:scale(.93); transition-duration:80ms; }
    .mw-np-like:hover { color:#E91E63; }
    .mw-np-dislike:hover { color:#ff5252; }
    .mw-np-locked { color:var(--mw-g) !important; background:var(--mw-glow) !important; }
    .mw-np-lock { margin-left:auto; }
    .mw-np-mixfrom { color:var(--mw-g); }
    .mw-np-mixfrom:hover { background:rgba(29,185,84,.1); color:var(--mw-g2); }

    /* ===== MOOD CHIPS ===== */
    .mw-moods { display:flex; flex-direction:column; gap:8px; animation:mw-in 250ms var(--mw-ease) 50ms both; }
    .mw-moods-header { display:flex; align-items:center; justify-content:space-between; }
    .mw-moods-label {
      font-family: var(--mw-mono);
      font-size:9px; font-weight:700; letter-spacing:2px; color:var(--mw-sub); text-transform:uppercase;
    }
    .mw-moods-collapse {
      border:none; background:none; color:var(--mw-sub); cursor:pointer; font-size:12px; padding:2px 6px; border-radius:4px;
      transition: color 150ms, background 150ms;
    }
    .mw-moods-collapse:hover { color:var(--mw-text); background:rgba(255,255,255,.05); }
    .mw-moods-row { display:flex; gap:6px; flex-wrap:wrap; overflow:hidden; }
    .mw-moods-expanded .mw-mood { animation: mw-in 150ms var(--mw-ease) both; }
    .mw-mood {
      padding:6px 16px; border-radius:20px; border:1px solid var(--mw-border);
      background:transparent; color:var(--mw-text); font-size:13px; font-weight:600; cursor:pointer;
      transition:background 150ms var(--mw-ease), border-color 150ms var(--mw-ease), color 150ms var(--mw-ease), transform 200ms var(--mw-spring);
    }
    .mw-mood:hover { background:rgba(255,255,255,.04); border-color:#333; }
    .mw-mood:active { transform:scale(.95); transition-duration:80ms; }
    .mw-mood-on { background:var(--mw-g); border-color:var(--mw-g); color:black; }
    .mw-mood-on:hover { background:var(--mw-g2); border-color:var(--mw-g2); }
    .mw-mood-artist { border-color:rgba(29,185,84,.3); color:var(--mw-g); }
    .mw-mood-artist:hover { border-color:rgba(29,185,84,.5); background:rgba(29,185,84,.08); }
    .mw-mood-fav { border-color:rgba(233,30,99,.3); color:#E91E63; display:flex; align-items:center; gap:2px; }
    .mw-mood-fav:hover { border-color:rgba(233,30,99,.5); background:rgba(233,30,99,.08); }
    .mw-mood-fav.mw-mood-on { background:#E91E63; border-color:#E91E63; color:white; }
    .mw-mood-pinned { box-shadow:0 0 0 1.5px var(--mw-g) inset; border-color:var(--mw-g); }
    .mw-mood-more { border-style:dashed; color:var(--mw-sub); }
    .mw-mood-more:hover { border-style:solid; }

    /* ===== INLINE STATS ===== */
    .mw-istats { display:flex; gap:8px; animation:mw-in 250ms var(--mw-ease) 100ms both; }
    .mw-istat { flex:1; padding:10px 12px; border-radius:10px; background:var(--mw-card); border:1px solid var(--mw-border); }
    .mw-istat-val { font-size:18px; font-weight:800; color:var(--mw-text); line-height:1.2; font-family:var(--mw-mono); }
    .mw-istat-lbl { font-size:10px; color:var(--mw-sub); font-weight:500; margin-top:2px; }

    /* ===== START ===== */
    .mw-start-section { display:flex; flex-direction:column; gap:8px; animation:mw-in 250ms var(--mw-ease) both; }
    .mw-start-btn {
      display:flex; align-items:center; justify-content:center; gap:8px;
      width:100%; padding:12px; border:none; border-radius:12px;
      font-size:14px; font-weight:700; cursor:pointer;
      transition:background 150ms var(--mw-ease), transform 200ms var(--mw-spring), box-shadow 150ms var(--mw-ease);
      background:var(--mw-g); color:black;
    }
    .mw-start-btn:hover { background:var(--mw-g2); box-shadow:0 4px 24px rgba(29,185,84,.25); }
    .mw-start-btn:active { transform:scale(.97); transition-duration:80ms; }
    .mw-start-fav { background:var(--mw-card); color:var(--mw-text); border:1px solid var(--mw-border); }
    .mw-start-fav:hover { background:#1a1a1a; box-shadow:none; }
    .mw-start-fav svg { color:#E91E63; }
    .mw-loading { opacity:.5; pointer-events:none; }

    /* ===== HISTORY ===== */
    .mw-hist { display:flex; flex-direction:column; gap:2px; max-height:280px; overflow-y:auto; }
    .mw-hist::-webkit-scrollbar { width:3px; }
    .mw-hist::-webkit-scrollbar-thumb { background:rgba(255,255,255,.06); border-radius:2px; }
    .mw-hist-row { display:flex; align-items:center; gap:10px; padding:6px 4px; border-radius:8px; animation:mw-in 200ms var(--mw-ease) both; transition:background 150ms var(--mw-ease); }
    .mw-hist-row:hover { background:rgba(255,255,255,.03); }
    .mw-hist-num { font-family:var(--mw-mono); font-size:10px; color:rgba(255,255,255,.15); width:16px; text-align:center; flex-shrink:0; font-weight:600; }
    .mw-hist-art { width:36px; height:36px; border-radius:6px; object-fit:cover; flex-shrink:0; cursor:pointer; background:linear-gradient(135deg,#1a1a1a,#0a0a0a); transition:transform 200ms var(--mw-spring); }
    .mw-hist-art:hover { transform:scale(1.08); }
    .mw-hist-ph { background:linear-gradient(135deg,#222,#111); }
    .mw-hist-info { flex:1; min-width:0; cursor:pointer; }
    .mw-hist-name { font-size:13px; font-weight:500; color:var(--mw-text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .mw-hist-artist { font-size:11px; color:var(--mw-sub); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

    .mw-like {
      display:flex; align-items:center; justify-content:center;
      width:28px; height:28px; border:none; border-radius:50%;
      background:transparent; color:rgba(255,255,255,.15); cursor:pointer; flex-shrink:0;
      transition:color 150ms var(--mw-ease), transform 200ms var(--mw-spring);
    }
    .mw-like:hover { color:rgba(255,255,255,.4); transform:scale(1.15); }
    .mw-like:active { transform:scale(.9); transition-duration:80ms; }
    .mw-liked { color:#E91E63 !important; }

    /* ===== STATS TAB ===== */
    .mw-stats-tab { display:flex; flex-direction:column; gap:12px; animation:mw-in 250ms var(--mw-ease) both; }
    .mw-stats-grid { display:flex; gap:8px; }
    .mw-stat-card { flex:1; padding:10px 12px; border-radius:10px; background:var(--mw-card); border:1px solid var(--mw-border); }
    .mw-stat-val { font-size:18px; font-weight:800; color:var(--mw-text); line-height:1.2; font-family:var(--mw-mono); }
    .mw-stat-lbl { font-size:10px; color:var(--mw-sub); font-weight:500; margin-top:2px; }

    .mw-top-artists { display:flex; flex-direction:column; gap:4px; }
    .mw-top-label { font-family:var(--mw-mono); font-size:9px; font-weight:700; letter-spacing:2px; color:var(--mw-sub); text-transform:uppercase; margin-bottom:4px; }
    .mw-top-row { display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:8px; background:var(--mw-card); border:1px solid var(--mw-border); animation:mw-in 200ms var(--mw-ease) both; }
    .mw-top-rank { font-family:var(--mw-mono); font-size:14px; font-weight:800; color:var(--mw-g); width:18px; }
    .mw-top-name { flex:1; font-size:13px; font-weight:600; color:var(--mw-text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .mw-top-count { font-family:var(--mw-mono); font-size:11px; color:var(--mw-sub); flex-shrink:0; }

    .mw-stat-seed { display:flex; align-items:center; gap:8px; font-size:12px; color:var(--mw-sub); padding:8px 10px; border-radius:8px; background:var(--mw-card); border:1px solid var(--mw-border); }
    .mw-stat-seed-lbl { font-family:var(--mw-mono); font-weight:700; color:var(--mw-g); text-transform:uppercase; font-size:9px; letter-spacing:1px; }

    /* ===== BOTTOM ACTIONS ===== */
    .mw-actions { display:flex; gap:8px; padding-top:2px; }
    .mw-act {
      display:flex; align-items:center; justify-content:center; gap:6px;
      flex:1; padding:10px; border-radius:10px; border:none;
      font-size:13px; font-weight:700; cursor:pointer;
      transition:background 150ms var(--mw-ease), transform 200ms var(--mw-spring), box-shadow 150ms var(--mw-ease);
    }
    .mw-act:active { transform:scale(.96); transition-duration:80ms; }
    .mw-act-stop { background:var(--mw-card); color:var(--mw-text); border:1px solid var(--mw-border); }
    .mw-act-stop:hover { background:#1a1a1a; }
    .mw-act-reseed { background:var(--mw-g); color:black; }
    .mw-act-reseed:hover { background:var(--mw-g2); box-shadow:0 2px 16px rgba(29,185,84,.2); }

    .mw-empty { font-size:13px; color:var(--mw-sub); text-align:center; padding:24px 0; }

    @keyframes mw-blink { 0%,100%{opacity:1} 50%{opacity:.3} }

    @media (prefers-reduced-motion:reduce) {
      .mw-panel,.mw-np,.mw-hist-row,.mw-moods,.mw-istats,.mw-stat-card,.mw-start-section,.mw-wbar,.mw-top-row,.mw-eq-row,.mw-eq-ch { animation:none !important; transition:none !important; }
    }
  `;
  document.head.appendChild(s);
}
