export const cssWeekly = `
    /* ============================================================
       WEEKLY REPORT — stylised digest modal with glitch decorations
       ============================================================ */
    .mw-wk-backdrop{
      position:fixed; inset:0; z-index:99998;
      background:rgba(0,0,0,.78); backdrop-filter:blur(6px);
      display:grid; place-items:center;
      animation:mw-wk-fadein 220ms var(--mw-ease);
    }
    @keyframes mw-wk-fadein{ from{opacity:0} to{opacity:1} }

    .mw-wk-card{
      position:relative; width:460px; max-width:calc(100vw - 32px);
      background:linear-gradient(180deg,#0e1a11 0%,#070a08 100%);
      border:1px solid rgba(29,185,84,.35); border-radius:12px;
      box-shadow:0 20px 60px rgba(0,0,0,.6), 0 0 55px rgba(29,185,84,.13),
                 inset 0 0 0 1px rgba(255,255,255,.02);
      font-family:var(--mw-mono);
      overflow:visible;
    }
    .mw-wk-card-body{
      padding:30px 30px 26px;
      max-height:calc(100vh - 40px);
      overflow-y:auto;
      scrollbar-width:none;
      -ms-overflow-style:none;
    }
    .mw-wk-card-body::-webkit-scrollbar{ width:0; height:0; display:none }

    /* Corner tick-marks (4 green L-brackets) */
    .mw-wk-corner{ position:absolute; width:16px; height:16px; border:1px solid var(--mw-g); opacity:.75; pointer-events:none }
    .mw-wk-corner-tl{ top:-1px; left:-1px;  border-right:none; border-bottom:none }
    .mw-wk-corner-tr{ top:-1px; right:-1px; border-left:none;  border-bottom:none }
    .mw-wk-corner-bl{ bottom:-1px; left:-1px;  border-right:none; border-top:none }
    .mw-wk-corner-br{ bottom:-1px; right:-1px; border-left:none;  border-top:none }

    /* Decorations: tag top-left, glitch bottom corners */
    .mw-wk-deco{ position:absolute; font-family:var(--mw-mono); white-space:pre; pointer-events:none; z-index:12; line-height:1 }
    .mw-wk-deco-tag{
      top:-12px; left:-12px; font-size:10px; letter-spacing:1px;
      color:var(--mw-g); opacity:.9;
      text-shadow:0 0 8px rgba(29,185,84,.6);
      background:#070a08; padding:2px 6px;
      border:1px solid rgba(29,185,84,.4); border-radius:3px;
    }
    .mw-wk-deco-glitch{
      font-size:13px; line-height:1; color:var(--mw-g); opacity:.75;
      text-shadow:0 0 6px rgba(29,185,84,.45);
    }
    .mw-wk-deco-bl{ bottom:-14px; left:-14px }
    .mw-wk-deco-br{ bottom:-14px; right:-14px; text-align:right }
    .mw-wk-deco-bl::before,.mw-wk-deco-br::before{
      content:""; display:block; font-family:var(--mw-mono); white-space:pre;
      animation:mw-wk-gc-a 2.4s steps(1) infinite;
    }
    .mw-wk-deco-br::before{ animation-name:mw-wk-gc-b; animation-duration:2.8s }
    @keyframes mw-wk-gc-a{
      0%  { content:"\u2593\u2591\u2573\u2592\u2591" }
      20% { content:"\u2591\u2593\u2592\u2573\u2593" }
      40% { content:"\u2573\u2592\u2593\u2591\u2573" }
      55% { content:"\u2592\u2591\u2573\u2593\u2592" }
      70% { content:"\u2593\u2573\u2591\u2592\u2591" }
      85% { content:"\u2591\u2591\u2593\u2573\u2592" }
      100%{ content:"\u2573\u2593\u2592\u2591\u2593" }
    }
    @keyframes mw-wk-gc-b{
      0%  { content:"\u2573\u2591\u2593\u2592\u2573" }
      18% { content:"\u2592\u2593\u2591\u2573\u2593" }
      36% { content:"\u2591\u2573\u2592\u2593\u2591" }
      52% { content:"\u2593\u2591\u2573\u2592\u2593" }
      68% { content:"\u2573\u2592\u2591\u2593\u2573" }
      84% { content:"\u2592\u2593\u2573\u2591\u2592" }
      100%{ content:"\u2593\u2591\u2592\u2573\u2591" }
    }
    .mw-wk-deco-bl::after,.mw-wk-deco-br::after{
      content:""; display:block; margin-top:2px;
      font-family:var(--mw-mono); white-space:pre; font-size:10px; opacity:.55;
      animation:mw-wk-gc2a 3.6s steps(1) infinite;
    }
    .mw-wk-deco-br::after{ animation-name:mw-wk-gc2b; text-align:right; animation-duration:4.2s }
    @keyframes mw-wk-gc2a{
      0%  { content:"> 0x1DB9" }
      25% { content:"> 0xF4C5" }
      50% { content:"> 0x0E1A" }
      75% { content:"> 0xAE37" }
      100%{ content:"> 0x1DB9" }
    }
    @keyframes mw-wk-gc2b{
      0%  { content:"ERR_01 ]" }
      20% { content:"SYS_LO ]" }
      45% { content:"OK_0xFF]" }
      70% { content:"LOG 1/7]" }
      100%{ content:"ERR_01 ]" }
    }

    /* Header */
    .mw-wk-tag{
      font-size:10px; letter-spacing:2.5px; text-transform:uppercase;
      color:var(--mw-g); font-weight:700; margin-bottom:6px;
      display:flex; align-items:center; gap:8px;
    }
    .mw-wk-tag-dot{
      width:6px; height:6px; border-radius:50%;
      background:var(--mw-g); box-shadow:0 0 8px var(--mw-g);
      animation:mw-wk-pulse 1.6s ease-in-out infinite;
    }
    @keyframes mw-wk-pulse{ 0%,100%{opacity:1} 50%{opacity:.25} }
    .mw-wk-tag-bar{
      flex:1; height:1px;
      background:linear-gradient(90deg,var(--mw-g),transparent); opacity:.4;
    }

    .mw-wk-title{
      font-size:24px; font-weight:700; color:#fff;
      margin-bottom:4px; letter-spacing:-.5px;
      text-shadow:
        -1.2px 0 0 rgba(255,77,126,.55),
        1.2px 0 0 rgba(29,185,84,.55);
    }

    .mw-wk-subtitle{
      font-size:10px; letter-spacing:1.2px; color:var(--mw-sub);
      margin-bottom:22px; text-transform:uppercase;
    }

    /* Pager tabs */
    .mw-wk-pager{
      display:flex; gap:2px; margin-bottom:14px;
      border:1px solid rgba(255,255,255,.06); border-radius:6px;
      padding:2px; background:rgba(0,0,0,.3);
    }
    .mw-wk-pager-tab{
      flex:1; padding:5px 10px; background:transparent; border:none; cursor:pointer;
      font-family:var(--mw-mono); font-size:9px; letter-spacing:1.5px; text-transform:uppercase;
      color:var(--mw-sub); border-radius:4px;
      transition:all 180ms var(--mw-ease); text-align:left;
    }
    .mw-wk-pager-tab .mw-wk-ix{ opacity:.5; margin-right:6px; font-weight:700 }
    .mw-wk-pager-tab:hover{ color:var(--mw-text); background:rgba(255,255,255,.03) }
    .mw-wk-pager-tab.on{
      background:rgba(29,185,84,.12); color:var(--mw-g);
      box-shadow:inset 0 0 0 1px rgba(29,185,84,.3);
    }
    .mw-wk-pager-tab.on .mw-wk-ix{ opacity:1 }

    /* Page container with crossfade */
    .mw-wk-page{ animation:mw-wk-page-in 280ms var(--mw-ease) both }
    @keyframes mw-wk-page-in{
      from{ opacity:0; transform:translateY(6px) }
      to  { opacity:1; transform:translateY(0) }
    }

    /* ---- Stat cards (page 1) ---- */
    .mw-wk-grid{ display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:18px }
    .mw-wk-stat{
      padding:12px 14px;
      background:rgba(255,255,255,.025); border:1px solid rgba(255,255,255,.06);
      border-radius:8px; position:relative; overflow:hidden; min-height:92px;
    }
    .mw-wk-stat::before{
      content:""; position:absolute; top:0; left:0; width:2px; height:100%;
      background:var(--mw-g); opacity:.5;
    }
    .mw-wk-stat-head{ display:flex; align-items:baseline; justify-content:space-between; margin-bottom:8px }
    .mw-wk-stat-label{ font-size:9px; letter-spacing:1.5px; color:var(--mw-sub); text-transform:uppercase }
    .mw-wk-stat-delta{ font-size:9px; color:var(--mw-g); letter-spacing:.5px; font-variant-numeric:tabular-nums }
    .mw-wk-stat-delta.neg{ color:#ff6b6b }
    .mw-wk-stat-unit{ font-size:12px; color:var(--mw-sub); font-weight:400; margin-left:3px }
    .mw-wk-big-num{ font-size:28px; font-weight:700; color:#fff; letter-spacing:-1px; line-height:1 }
    .mw-wk-big-num .mw-wk-stat-unit{ font-size:14px }

    /* Sparkline */
    .mw-wk-spark{ display:block; margin-top:8px; width:100%; height:28px; overflow:visible }
    .mw-wk-spark-area{ fill:url(#mwWkGrad); opacity:.5 }
    .mw-wk-spark-line{ fill:none; stroke:var(--mw-g); stroke-width:1.4;
      filter:drop-shadow(0 0 3px rgba(29,185,84,.8)) }
    .mw-wk-spark-dot{ fill:var(--mw-g); filter:drop-shadow(0 0 4px var(--mw-g)) }

    /* Mini bars */
    .mw-wk-mbars{ display:flex; align-items:flex-end; gap:3px; height:32px; margin-top:8px }
    .mw-wk-mbar{
      flex:1; min-height:2px; border-radius:1.5px; transform-origin:bottom;
      background:linear-gradient(to top,var(--mw-g),var(--mw-g2));
      box-shadow:0 0 4px rgba(29,185,84,.5);
      animation:mw-wk-bar-in .7s cubic-bezier(.2,.8,.2,1) both;
    }
    @keyframes mw-wk-bar-in{ from{transform:scaleY(0);opacity:0} to{transform:scaleY(1);opacity:1} }
    .mw-wk-mbar-label{
      display:flex; justify-content:space-between; margin-top:3px;
      font-size:7px; color:var(--mw-sub); letter-spacing:.5px; font-family:var(--mw-mono);
    }

    /* Circular ring (skip rate) */
    .mw-wk-ring-wrap{ display:flex; align-items:center; gap:12px; margin-top:2px }
    .mw-wk-ring{ width:56px; height:56px; flex-shrink:0 }
    .mw-wk-ring-track{ fill:none; stroke:rgba(255,255,255,.06); stroke-width:3 }
    .mw-wk-ring-fill{
      fill:none; stroke:var(--mw-g); stroke-width:3; stroke-linecap:round;
      opacity:.85; transform:rotate(-90deg); transform-origin:center;
    }
    .mw-wk-ring-text{
      font-family:var(--mw-mono); font-size:14px; font-weight:700; fill:#fff;
      text-anchor:middle; dominant-baseline:central;
    }
    .mw-wk-ring-meta{ flex:1; min-width:0 }
    .mw-wk-ring-big{ font-size:18px; font-weight:700; color:#fff; line-height:1 }
    .mw-wk-ring-small{ font-size:9px; color:var(--mw-sub); margin-top:4px;
      letter-spacing:.8px; text-transform:uppercase }

    /* ---- Top artists (page 1 bottom) ---- */
    .mw-wk-section{ margin-top:16px }
    .mw-wk-section-label{
      font-size:10px; letter-spacing:2px; color:var(--mw-sub); text-transform:uppercase;
      margin-bottom:10px; font-weight:600;
      display:flex; align-items:center; gap:8px;
    }
    .mw-wk-section-label::before{ content:"\u25C8"; color:var(--mw-g); opacity:.8 }
    .mw-wk-section-label .mw-wk-thin{
      flex:1; height:1px;
      background:linear-gradient(90deg,rgba(255,255,255,.1),transparent);
    }
    .mw-wk-artist{
      display:flex; align-items:center; gap:12px; padding:7px 0; font-size:13px;
      border-bottom:1px solid rgba(255,255,255,.04);
    }
    .mw-wk-artist:last-child{ border-bottom:none }
    .mw-wk-artist-rank{ color:var(--mw-g); font-weight:700; width:22px;
      font-size:11px; font-variant-numeric:tabular-nums }
    .mw-wk-artist-name{ flex:1; color:var(--mw-text);
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
    .mw-wk-artist-bar{ flex:0 0 60px; height:3px;
      background:rgba(255,255,255,.06); border-radius:2px; overflow:hidden }
    .mw-wk-artist-bar-fill{ height:100%; background:var(--mw-g);
      box-shadow:0 0 6px rgba(29,185,84,.7) }
    .mw-wk-artist-time{ color:var(--mw-sub); font-size:11px;
      font-variant-numeric:tabular-nums; width:50px; text-align:right }

    /* ---- Comparison cards (page 2) ---- */
    .mw-wk-cmp{
      display:flex; align-items:center; gap:14px;
      padding:12px 14px; background:rgba(255,255,255,.025);
      border:1px solid rgba(255,255,255,.06); border-radius:8px;
      margin-bottom:8px; position:relative; overflow:hidden;
    }
    .mw-wk-cmp::before{
      content:""; position:absolute; top:0; left:0; width:2px; height:100%;
      background:var(--mw-g); opacity:.5;
    }
    .mw-wk-cmp-icon{
      width:30px; height:30px; flex-shrink:0;
      display:grid; place-items:center;
      color:var(--mw-g); background:rgba(29,185,84,.08); border-radius:6px;
      font-family:var(--mw-mono); font-size:11px; font-weight:700; letter-spacing:.5px;
    }
    .mw-wk-cmp-body{ flex:1; min-width:0 }
    .mw-wk-cmp-label{ font-size:9px; letter-spacing:1.5px; color:var(--mw-sub);
      text-transform:uppercase; margin-bottom:4px }
    .mw-wk-cmp-row{ display:flex; align-items:baseline; gap:8px }
    .mw-wk-cmp-now{ font-size:22px; font-weight:700; color:#fff;
      font-variant-numeric:tabular-nums; letter-spacing:-.5px; line-height:1 }
    .mw-wk-cmp-now .mw-wk-stat-unit{ font-size:12px }
    .mw-wk-cmp-prev{ font-size:10px; color:var(--mw-sub); letter-spacing:.5px }
    .mw-wk-cmp-prev .mw-wk-v{ font-variant-numeric:tabular-nums }
    .mw-wk-cmp-delta{
      margin-left:auto; display:inline-flex; align-items:center; gap:4px;
      padding:3px 8px; border-radius:10px;
      font-size:10px; font-weight:700;
      font-variant-numeric:tabular-nums; letter-spacing:.5px;
    }
    .mw-wk-cmp-delta.up, .mw-wk-cmp-delta.good-down{
      background:rgba(29,185,84,.15); color:var(--mw-g2);
    }
    .mw-wk-cmp-delta.down{
      background:rgba(255,107,107,.15); color:#ff8a8a;
    }
    .mw-wk-cmp-delta.flat{
      background:rgba(255,255,255,.06); color:var(--mw-sub);
    }

    /* Dual-line chart (page 2) */
    .mw-wk-dual{
      margin-top:14px; padding:12px 14px;
      background:rgba(255,255,255,.025); border:1px solid rgba(255,255,255,.06);
      border-radius:8px; position:relative;
    }
    .mw-wk-dual::before{
      content:""; position:absolute; top:0; left:0; width:2px; height:100%;
      background:var(--mw-g); opacity:.5;
    }
    .mw-wk-dual-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:8px }
    .mw-wk-dual-title{ font-size:9px; letter-spacing:1.5px; color:var(--mw-sub); text-transform:uppercase }
    .mw-wk-dual-legend{ display:flex; gap:10px; font-size:9px; color:var(--mw-sub) }
    .mw-wk-dual-legend .k{ display:inline-block; width:10px; height:2px; margin-right:4px;
      vertical-align:middle; border-radius:1px }
    .mw-wk-dual-legend .k-now{ background:var(--mw-g); box-shadow:0 0 4px var(--mw-g) }
    .mw-wk-dual-legend .k-prev{ background:rgba(255,255,255,.3) }
    .mw-wk-dual-svg{ width:100%; height:70px; display:block }
    .mw-wk-dual-now-line{ fill:none; stroke:var(--mw-g); stroke-width:1.8;
      filter:drop-shadow(0 0 3px rgba(29,185,84,.7)) }
    .mw-wk-dual-now-area{ fill:url(#mwWkGrad); opacity:.35 }
    .mw-wk-dual-prev-line{ fill:none; stroke:rgba(255,255,255,.35); stroke-width:1.2;
      stroke-dasharray:3 3 }
    .mw-wk-dual-grid{ stroke:rgba(255,255,255,.05); stroke-width:1 }
    .mw-wk-dual-dot{ fill:var(--mw-g); filter:drop-shadow(0 0 4px var(--mw-g)) }
    .mw-wk-dual-axis{ font-family:var(--mw-mono); font-size:7px; fill:var(--mw-sub); letter-spacing:.5px }

    /* Movers (page 2 bottom) */
    .mw-wk-movers{ margin-top:12px; display:grid; grid-template-columns:1fr 1fr; gap:8px }
    .mw-wk-movers-col{ padding:10px 12px;
      background:rgba(255,255,255,.025); border:1px solid rgba(255,255,255,.06); border-radius:6px }
    .mw-wk-movers-head{
      font-size:9px; letter-spacing:1.5px; color:var(--mw-sub); text-transform:uppercase;
      margin-bottom:6px; display:flex; align-items:center; gap:6px;
    }
    .mw-wk-movers-head .sym{ color:var(--mw-g); font-size:10px }
    .mw-wk-movers-head.down .sym{ color:#ff8a8a }
    .mw-wk-movers-item{
      font-size:11px; color:var(--mw-text); padding:3px 0;
      border-bottom:1px solid rgba(255,255,255,.04);
      display:flex; align-items:center; gap:6px;
    }
    .mw-wk-movers-item:last-child{ border-bottom:none }
    .mw-wk-movers-item .mark{ font-size:8px; color:var(--mw-g); letter-spacing:.5px; font-weight:700; min-width:26px }
    .mw-wk-movers-item.down .mark{ color:#ff8a8a }
    .mw-wk-movers-name{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; min-width:0 }
    .mw-wk-movers-empty{ font-size:10px; color:var(--mw-sub); font-style:italic; padding:4px 0 }

    /* Actions footer */
    .mw-wk-actions{ margin-top:22px; display:flex; gap:8px; justify-content:flex-end; align-items:center }
    .mw-wk-actions-fill{ flex:1; font-size:9px; color:var(--mw-sub); letter-spacing:1px; opacity:.55 }
    .mw-wk-btn{
      padding:8px 16px; background:transparent; color:var(--mw-text);
      border:1px solid #333; border-radius:20px; cursor:pointer;
      font-family:inherit; font-size:11px; letter-spacing:1px; text-transform:uppercase;
      transition:all 180ms var(--mw-ease);
    }
    .mw-wk-btn:hover{ border-color:#666; background:rgba(255,255,255,.04) }
    .mw-wk-btn-primary{
      background:var(--mw-g); color:#000; border-color:var(--mw-g); font-weight:700;
    }
    .mw-wk-btn-primary:hover{
      background:var(--mw-g2); border-color:var(--mw-g2);
      box-shadow:0 0 18px rgba(29,185,84,.45);
    }
`;
