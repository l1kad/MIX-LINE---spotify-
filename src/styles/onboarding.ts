export const cssOnboarding = `
    /* ===== ONBOARDING MODAL ===== */
    .mw-ob-backdrop {
      position:fixed; inset:0; z-index:99999;
      background:rgba(0,0,0,.75); backdrop-filter:blur(8px);
      display:flex; align-items:center; justify-content:center;
      animation:mw-ob-fade-in 300ms ease both;
    }
    @keyframes mw-ob-fade-in { from { opacity:0; } to { opacity:1; } }

    .mw-ob-modal {
      width:380px; max-width:90vw; max-height:80vh;
      background:rgba(18,18,18,.98); border:1px solid rgba(255,255,255,.08);
      border-radius:16px; overflow:hidden;
      box-shadow:0 24px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.04);
      display:flex; flex-direction:column;
      animation:mw-ob-slide-in 400ms cubic-bezier(.23,1,.32,1) both;
    }
    @keyframes mw-ob-slide-in { from { opacity:0; transform:translateY(20px) scale(.97); } to { opacity:1; transform:none; } }

    .mw-ob-content {
      padding:28px 24px 16px;
      flex:1; overflow-y:auto;
      animation:mw-tab-fade 200ms ease both;
    }

    .mw-ob-hero {
      display:flex; flex-direction:column; align-items:center; gap:12px;
      padding:16px 0 8px; color:var(--mw-g);
    }
    .mw-ob-title {
      font-size:24px; font-weight:900; letter-spacing:-0.5px; color:var(--mw-text);
      font-family:var(--mw-mono);
    }

    .mw-ob-heading {
      font-size:16px; font-weight:800; color:var(--mw-text); margin-bottom:14px;
      letter-spacing:-0.3px;
    }

    .mw-ob-desc {
      font-size:13px; color:var(--mw-sub); line-height:1.55; margin-bottom:12px;
    }
    .mw-ob-hint {
      font-size:11px; color:rgba(255,255,255,.3); font-style:italic; margin-top:8px;
    }

    .mw-ob-row {
      display:flex; align-items:center; gap:12px;
      padding:8px 10px; margin-bottom:6px;
      border-radius:10px; background:rgba(255,255,255,.03);
      border:1px solid rgba(255,255,255,.04);
    }
    .mw-ob-icon {
      flex-shrink:0; width:28px; height:28px;
      display:flex; align-items:center; justify-content:center;
      border-radius:8px; background:rgba(29,185,84,.1); color:var(--mw-g);
    }
    .mw-ob-text { font-size:12.5px; color:var(--mw-sub); line-height:1.4; }

    .mw-ob-footer {
      padding:12px 24px 20px;
      display:flex; flex-direction:column; align-items:center; gap:12px;
      border-top:1px solid rgba(255,255,255,.04);
      flex-shrink:0;
    }
    .mw-ob-dots {
      display:flex; gap:6px;
    }
    .mw-ob-dot {
      width:6px; height:6px; border-radius:50%;
      background:rgba(255,255,255,.15); transition:background 200ms, transform 200ms;
    }
    .mw-ob-dot-on { background:var(--mw-g); transform:scale(1.3); }

    .mw-ob-lang-row { display:flex; gap:10px; justify-content:center; margin-top:8px; }
    .mw-ob-lang {
      display:flex; align-items:center; gap:10px;
      padding:14px 24px; border-radius:12px;
      background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.06);
      color:var(--mw-sub); font-size:15px; font-weight:600; cursor:pointer;
      transition:background 150ms, border-color 150ms, color 150ms, transform 150ms;
    }
    .mw-ob-lang:hover { background:rgba(255,255,255,.08); border-color:rgba(255,255,255,.12); color:var(--mw-text); }
    .mw-ob-lang:active { transform:scale(.97); }
    .mw-ob-lang-on { border-color:var(--mw-g); background:rgba(29,185,84,.08); color:var(--mw-text); }
    .mw-ob-flag { font-size:20px; line-height:1; }

    .mw-ob-btns { display:flex; gap:8px; width:100%; flex-shrink:0; }
    .mw-ob-btn {
      padding:9px 16px; border-radius:8px; border:none;
      font-size:13px; font-weight:700; cursor:pointer;
      transition:background 150ms, transform 150ms;
      white-space:nowrap; line-height:1.2;
    }
    .mw-ob-btn:active { transform:scale(.96); }
    .mw-ob-btn-next {
      flex:1; background:var(--mw-g) !important; color:black !important;
      -webkit-mask-image:none !important; mask-image:none !important;
      -webkit-text-fill-color:black !important;
      -webkit-background-clip:padding-box !important; background-clip:padding-box !important;
      overflow:visible;
    }
    .mw-ob-btn-next:hover { background:var(--mw-g2) !important; }
    .mw-ob-btn-back {
      background:rgba(255,255,255,.06); color:var(--mw-sub);
    }
    .mw-ob-btn-back:hover { background:rgba(255,255,255,.1); color:var(--mw-text); }
    .mw-ob-btn-skip {
      background:transparent; color:rgba(255,255,255,.25);
      padding:9px 12px;
    }
    .mw-ob-btn-skip:hover { color:rgba(255,255,255,.5); }
`;
