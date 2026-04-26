export const cssPanel = `
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
    .mw-trigger-on .mw-trigger-icon {
      animation:mw-tpulse 2.5s ease-in-out infinite;
    }
    @keyframes mw-tpulse {
      0%,100% { filter:drop-shadow(0 0 3px rgba(29,185,84,.3)); }
      50% { filter:drop-shadow(0 0 8px rgba(29,185,84,.6)); }
    }
    .mw-trigger-icon { display:flex; align-items:center; justify-content:center; width:28px; height:28px; flex-shrink:0; }

    /* ===== PANEL ===== */
    .mw-panel {
      position:absolute; bottom:44px; right:-8px; width:360px;
      border-radius:16px; background:rgba(10,10,10,.96);
      backdrop-filter:blur(20px) saturate(1.3);
      -webkit-backdrop-filter:blur(20px) saturate(1.3);
      border:1px solid rgba(255,255,255,.06);
      box-shadow: 0 24px 80px rgba(0,0,0,.7), 0 0 0 1px rgba(29,185,84,.06), 0 0 40px rgba(29,185,84,.04);
      overflow:hidden; z-index:10000;
      transform-origin:bottom right;
      animation:mw-pop 300ms var(--mw-ease) forwards;
    }
    @keyframes mw-pop { from{opacity:0;transform:scale(.94) translateY(6px)} to{opacity:1;transform:none} }
    .mw-panel-inner { padding:16px; display:flex; flex-direction:column; gap:14px; max-height:calc(100vh - 120px); overflow-y:auto; }
    .mw-panel-inner::-webkit-scrollbar { width:3px; }
    .mw-panel-inner::-webkit-scrollbar-thumb { background:rgba(255,255,255,.06); border-radius:2px; }

    /* Tab body — fade transition + fixed min height */
    .mw-tab-body {
      min-height:280px;
      display:flex; flex-direction:column; gap:14px;
      animation:mw-tab-fade 220ms var(--mw-ease) both;
    }
    @keyframes mw-tab-fade {
      from { opacity:0; transform:translateY(6px); }
      to { opacity:1; transform:translateY(0); }
    }

    /* ===== HEADER ===== */
    .mw-header { display:flex; align-items:center; justify-content:space-between; }
    .mw-header-left { display:flex; align-items:center; gap:10px; }
    .mw-header-title { font-size:16px; font-weight:800; color:var(--mw-text); letter-spacing:-0.3px; }
    .mw-logo {
      display:flex; align-items:center; justify-content:center;
      width:32px; height:32px; border-radius:8px;
      background:linear-gradient(135deg, var(--mw-g) 0%, #17a34a 100%);
      color:black;
      box-shadow: 0 2px 12px rgba(29,185,84,.35), 0 0 0 1px rgba(29,185,84,.1);
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

    /* ===== CLI-style transient status line ===== */
    .mw-toast {
      font-family: var(--mw-mono);
      font-size: 10px;
      letter-spacing: 1px;
      color: var(--mw-g);
      padding: 4px 12px 0 12px;
      margin-top: -2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      animation: mw-toast-in 220ms var(--mw-ease);
    }
    .mw-toast-err { color: #ff6b6b; }
    @keyframes mw-toast-in {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ===== IDLE START CARD ===== */
    .mw-idle-np {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 8px;
      background: rgba(255,255,255,.04);
      border: 1px solid var(--mw-border);
      margin-bottom: 8px;
      animation: mw-in 250ms var(--mw-ease) both;
    }
    .mw-idle-art {
      width: 42px;
      height: 42px;
      border-radius: 4px;
      object-fit: cover;
      flex-shrink: 0;
    }
    .mw-idle-info {
      flex: 1;
      min-width: 0;
      overflow: hidden;
    }
    .mw-idle-name {
      font-family: var(--mw-mono);
      font-size: 11px;
      font-weight: 700;
      color: var(--mw-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .mw-idle-artist {
      font-family: var(--mw-mono);
      font-size: 9px;
      color: var(--mw-sub);
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .mw-idle-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-family: var(--mw-mono);
      font-size: 10px;
      letter-spacing: 0.5px;
      border: 1px solid var(--mw-border);
      border-radius: 6px;
      padding: 5px 10px;
      background: transparent;
      color: var(--mw-sub);
      cursor: pointer;
      transition: all 150ms var(--mw-ease);
      white-space: nowrap;
    }
    .mw-idle-btn:hover {
      color: var(--mw-text);
      border-color: var(--mw-sub);
      background: rgba(255,255,255,.04);
    }
    .mw-idle-btn-primary {
      color: var(--mw-g);
      border-color: var(--mw-g);
      background: rgba(29,185,84,.08);
    }
    .mw-idle-btn-primary:hover {
      background: rgba(29,185,84,.18);
      color: var(--mw-g2);
      border-color: var(--mw-g2);
    }

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
      background:linear-gradient(135deg, rgba(20,20,20,.9) 0%, rgba(14,14,14,.95) 100%);
      border:1px solid rgba(255,255,255,.05);
      animation:mw-in 280ms var(--mw-ease) both;
      transition:border-color 300ms var(--mw-ease);
    }
    .mw-np:hover { border-color:rgba(255,255,255,.08); }
    .mw-np-top { display:flex; align-items:center; gap:12px; }
    .mw-np-art-wrap { position:relative; width:44px; height:44px; flex-shrink:0; }
    .mw-np-art-glow {
      position:absolute; inset:-8px; width:calc(100% + 16px); height:calc(100% + 16px);
      border-radius:14px; object-fit:cover;
      filter:blur(12px) saturate(2) brightness(0.6);
      opacity:0.6; z-index:0; pointer-events:none;
      animation:mw-glow-breathe 3s ease-in-out infinite;
    }
    @keyframes mw-glow-breathe {
      0%,100% { opacity:0.5; filter:blur(12px) saturate(2) brightness(0.6); }
      50% { opacity:0.65; filter:blur(14px) saturate(2.2) brightness(0.65); }
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

    .mw-np-controls { display:flex; flex-wrap:wrap; align-items:center; gap:4px; row-gap:4px; padding-top:4px; border-top:1px solid var(--mw-border); }
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
    .mw-np-discovery:hover { background:rgba(29,185,84,.1); color:var(--mw-g2); }
    .mw-np-save:hover { background:rgba(29,185,84,.1); color:var(--mw-g2); }
    .mw-np-share:hover { background:rgba(29,185,84,.1); color:var(--mw-g2); }

    /* ===== MOOD CHIPS (main tab — pinned only) ===== */
    .mw-moods { display:flex; flex-direction:column; gap:8px; animation:mw-in 250ms var(--mw-ease) 50ms both; }
    .mw-moods-label {
      font-family: var(--mw-mono);
      font-size:9px; font-weight:700; letter-spacing:2px; color:var(--mw-sub); text-transform:uppercase;
    }
    .mw-moods-empty { font-size:12px; color:var(--mw-sub); font-style:italic; }
    .mw-moods-row { display:flex; gap:6px; flex-wrap:wrap; }
    .mw-mood {
      padding:6px 16px; border-radius:20px; border:1px solid var(--mw-border);
      background:transparent; color:var(--mw-text); font-size:13px; font-weight:600; cursor:pointer;
      transition:background 150ms var(--mw-ease), border-color 150ms var(--mw-ease), color 150ms var(--mw-ease), transform 200ms var(--mw-spring);
    }
    .mw-mood:hover { background:rgba(255,255,255,.04); border-color:#333; }
    .mw-mood:active { transform:scale(.95); transition-duration:80ms; }
    .mw-mood-on { background:var(--mw-g); border-color:var(--mw-g); color:black; box-shadow:0 2px 12px rgba(29,185,84,.3), 0 0 0 1px rgba(29,185,84,.15); }
    .mw-mood-on:hover { background:var(--mw-g2); border-color:var(--mw-g2); box-shadow:0 2px 16px rgba(29,185,84,.4); }
    .mw-mood-artist { border-color:rgba(29,185,84,.3); color:var(--mw-g); }
    .mw-mood-artist:hover { border-color:rgba(29,185,84,.5); background:rgba(29,185,84,.08); }
    .mw-mood-artist.mw-mood-on { background:rgba(29,185,84,.15); border-color:var(--mw-g); color:var(--mw-g); box-shadow:0 2px 12px rgba(29,185,84,.25); }
    .mw-mood-artist.mw-mood-on:hover { background:rgba(29,185,84,.22); box-shadow:0 2px 16px rgba(29,185,84,.35); }
    .mw-mood-playlist { border-color:rgba(100,150,255,.3); color:rgba(100,150,255,.9); }
    .mw-mood-playlist:hover { border-color:rgba(100,150,255,.5); background:rgba(100,150,255,.08); }
    .mw-mood-playlist.mw-mood-on { background:rgba(100,150,255,.15); border-color:rgba(100,150,255,.7); color:rgba(100,150,255,1); box-shadow:0 2px 12px rgba(100,150,255,.25); }
    .mw-mood-playlist.mw-mood-on:hover { background:rgba(100,150,255,.22); box-shadow:0 2px 16px rgba(100,150,255,.35); }
    .mw-mood-fav { border-color:rgba(233,30,99,.3); color:#E91E63; display:flex; align-items:center; gap:2px; }
    .mw-mood-fav:hover { border-color:rgba(233,30,99,.5); background:rgba(233,30,99,.08); }
    .mw-mood-fav.mw-mood-on { background:rgba(233,30,99,.15); border-color:#E91E63; color:#E91E63; box-shadow:0 2px 12px rgba(233,30,99,.25); }
    .mw-mood-fav.mw-mood-on:hover { background:rgba(233,30,99,.22); box-shadow:0 2px 16px rgba(233,30,99,.35); }

    /* ===== MOOD TAB (all moods with pin toggles) ===== */
    .mw-mood-tab { display:flex; flex-direction:column; gap:10px; animation:mw-in 250ms var(--mw-ease) both; }
    .mw-mood-grid { display:flex; flex-direction:column; gap:4px; }
    .mw-mood-item {
      display:flex; align-items:center; gap:4px;
      padding:4px; border-radius:10px;
      transition:background 150ms var(--mw-ease);
    }
    .mw-mood-item:hover { background:rgba(255,255,255,.03); }
    .mw-mood-item-on .mw-mood-item-btn { color:var(--mw-g); }
    .mw-mood-item-btn {
      flex:1; display:flex; align-items:center; gap:8px;
      border:none; background:none; color:var(--mw-text);
      font-size:13px; font-weight:600; cursor:pointer; padding:8px 10px; border-radius:8px;
      transition:background 150ms var(--mw-ease), color 150ms;
    }
    .mw-mood-item-btn:hover { background:rgba(255,255,255,.05); }
    .mw-mood-item-btn:active { transform:scale(.97); }
    .mw-mood-pin {
      display:flex; align-items:center; justify-content:center;
      width:32px; height:32px; border:none; border-radius:8px;
      background:transparent; color:var(--mw-sub); cursor:pointer; flex-shrink:0;
      transition:color 150ms var(--mw-ease), background 150ms var(--mw-ease), transform 200ms var(--mw-spring);
    }
    .mw-mood-pin:hover { color:var(--mw-text); background:rgba(255,255,255,.05); }
    .mw-mood-pin:active { transform:scale(.85); transition-duration:80ms; }
    .mw-mood-pin-on { color:var(--mw-g); }
    .mw-mood-pin-on:hover { color:var(--mw-g2); background:rgba(29,185,84,.1); }

    /* ===== MOOD TAB SECTIONS ===== */
    .mw-mt-section { display:flex; flex-direction:column; gap:6px; }
    .mw-mt-section + .mw-mt-section { margin-top:6px; padding-top:10px; border-top:1px solid var(--mw-border); }
    .mw-mt-section-header { display:flex; align-items:center; justify-content:space-between; }
    .mw-mt-current {
      font-size:13px; font-weight:600; color:var(--mw-g); padding:6px 0;
    }
    .mw-mt-search {
      width:100%; padding:8px 12px; border-radius:8px;
      border:1px solid var(--mw-border); background:rgba(255,255,255,.04);
      color:var(--mw-text); font-size:13px; font-family:inherit;
      outline:none; transition:border-color 200ms var(--mw-ease);
    }
    .mw-mt-search::placeholder { color:var(--mw-sub); }
    .mw-mt-search:focus { border-color:rgba(29,185,84,.4); }
    .mw-mt-list { display:flex; flex-direction:column; gap:2px; max-height:160px; overflow-y:auto; }
    .mw-mt-list::-webkit-scrollbar { width:3px; }
    .mw-mt-list::-webkit-scrollbar-thumb { background:rgba(255,255,255,.06); border-radius:2px; }
    .mw-mt-artist-btn {
      display:flex; align-items:center; gap:8px;
      width:100%; border:none; background:none; color:var(--mw-text);
      font-size:13px; font-weight:500; cursor:pointer; padding:8px 10px; border-radius:8px;
      text-align:left; transition:background 150ms var(--mw-ease);
    }
    .mw-mt-artist-btn:hover { background:rgba(255,255,255,.05); }
    .mw-mt-artist-active { color:var(--mw-g); font-weight:600; }
    .mw-mt-artist-img { width:24px; height:24px; border-radius:50%; object-fit:cover; flex-shrink:0; }
    .mw-mt-pl-info { display:flex; flex-direction:column; min-width:0; }
    .mw-mt-pl-owner { font-size:10px; color:rgba(255,255,255,.3); font-weight:400; }
    .mw-mt-pl-cover { border-radius:4px !important; }
    .mw-mt-pl-name { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .mw-mt-mypl { max-height:200px; overflow-y:auto; }
    .mw-mt-plays { margin-left:auto; font-size:11px; color:var(--mw-sub); font-family:var(--mw-mono); }
    .mw-mt-loading { font-size:12px; color:var(--mw-sub); padding:8px 10px; }

    /* ===== INLINE STATS ===== */
    .mw-isource {
      display:flex; align-items:center; gap:8px;
      padding:8px 12px; border-radius:10px;
      background:var(--mw-card); border:1px solid var(--mw-border);
      animation:mw-in 250ms var(--mw-ease) 100ms both;
    }
    .mw-isource-lbl { font-size:10px; color:var(--mw-sub); font-weight:600; font-family:var(--mw-mono); text-transform:uppercase; letter-spacing:1px; flex-shrink:0; }
    .mw-isource-val { font-size:13px; color:var(--mw-text); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

    /* ===== START ===== */
    .mw-start-section { display:flex; flex-direction:column; gap:8px; animation:mw-in 250ms var(--mw-ease) both; }
    .mw-start-btn {
      display:flex; align-items:center; justify-content:center; gap:8px;
      width:100%; padding:12px; border:none; border-radius:12px;
      font-size:14px; font-weight:700; cursor:pointer;
      transition:background 150ms var(--mw-ease), transform 200ms var(--mw-spring), box-shadow 150ms var(--mw-ease);
      background:var(--mw-g); color:black;
    }
    .mw-start-btn:hover { background:var(--mw-g2); box-shadow:0 4px 24px rgba(29,185,84,.3); }
    .mw-start-btn:active { transform:scale(.97); transition-duration:80ms; }
    .mw-start-fav { background:var(--mw-card); color:var(--mw-text); border:1px solid var(--mw-border); }
    .mw-start-fav:hover { background:#1a1a1a; box-shadow:none; }
    .mw-start-fav svg { color:#E91E63; }
    .mw-start-alt {
      background:transparent; color:var(--mw-sub); border:1px solid var(--mw-border);
      font-size:11px; padding:9px 12px; font-weight:600;
    }
    .mw-start-alt:hover { color:var(--mw-g); border-color:var(--mw-g); background:rgba(29,185,84,.06); box-shadow:none; }
    .mw-loading { opacity:.5; pointer-events:none; }

    /* ===== HISTORY ===== */
    .mw-hist { display:flex; flex-direction:column; gap:2px; max-height:280px; overflow-y:auto; }
    .mw-hist::-webkit-scrollbar { width:3px; }
    .mw-hist::-webkit-scrollbar-thumb { background:rgba(255,255,255,.06); border-radius:2px; }
    .mw-hist-row { display:flex; align-items:center; gap:10px; padding:6px 6px; border-radius:8px; animation:mw-in 200ms var(--mw-ease) both; transition:background 200ms var(--mw-ease); }
    .mw-hist-row:hover { background:rgba(255,255,255,.04); }
    .mw-hist-num { font-family:var(--mw-mono); font-size:10px; color:rgba(255,255,255,.15); width:16px; text-align:center; flex-shrink:0; font-weight:600; }
    .mw-hist-art { width:36px; height:36px; border-radius:6px; object-fit:cover; flex-shrink:0; cursor:pointer; background:linear-gradient(135deg,#1a1a1a,#0a0a0a); transition:transform 200ms var(--mw-spring), box-shadow 200ms var(--mw-ease); }
    .mw-hist-art:hover { transform:scale(1.06); box-shadow:0 2px 10px rgba(0,0,0,.4); }
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
    .mw-liked { color:#E91E63 !important; filter:drop-shadow(0 0 4px rgba(233,30,99,.35)); }

    /* ===== STATS TAB ===== */
    .mw-stats-tab { display:flex; flex-direction:column; gap:12px; animation:mw-in 250ms var(--mw-ease) both; }
    .mw-stats-grid { display:flex; gap:8px; }
    .mw-stat-card { flex:1; padding:10px 12px; border-radius:10px; background:var(--mw-card); border:1px solid var(--mw-border); transition:border-color 200ms var(--mw-ease), background 200ms var(--mw-ease); }
    .mw-stat-card:hover { border-color:rgba(255,255,255,.08); background:rgba(22,22,22,.9); }
    .mw-stat-val { font-size:18px; font-weight:800; color:var(--mw-text); line-height:1.2; font-family:var(--mw-mono); }
    .mw-stat-lbl { font-size:10px; color:var(--mw-sub); font-weight:500; margin-top:2px; }

    .mw-top-artists { display:flex; flex-direction:column; gap:4px; }
    .mw-top-label { font-family:var(--mw-mono); font-size:9px; font-weight:700; letter-spacing:2px; color:var(--mw-sub); text-transform:uppercase; margin-bottom:4px; }
    .mw-top-row { display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:8px; background:var(--mw-card); border:1px solid var(--mw-border); animation:mw-in 200ms var(--mw-ease) both; transition:border-color 200ms var(--mw-ease), background 200ms var(--mw-ease); }
    .mw-top-row:hover { border-color:rgba(29,185,84,.15); background:rgba(22,22,22,.9); }
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
    .mw-act-reseed { background:var(--mw-g); color:black; box-shadow:0 2px 8px rgba(29,185,84,.15); }
    .mw-act-reseed:hover { background:var(--mw-g2); box-shadow:0 2px 16px rgba(29,185,84,.3); }

    .mw-empty { font-size:13px; color:var(--mw-sub); text-align:center; padding:24px 0; }

    @keyframes mw-blink { 0%,100%{opacity:1} 50%{opacity:.3} }

    /* ===== GUIDE BUTTON ===== */
    .mw-guide-btn {
      width:20px; height:20px; border-radius:50%; border:1px solid var(--mw-border);
      background:transparent; color:var(--mw-sub); font-size:11px; font-weight:700;
      cursor:pointer; display:flex; align-items:center; justify-content:center;
      transition:color 150ms, border-color 150ms, background 150ms;
      font-family:var(--mw-mono);
    }
    .mw-guide-btn:hover { color:var(--mw-text); border-color:rgba(255,255,255,.2); background:rgba(255,255,255,.05); }
`;
