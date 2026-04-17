<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Kreator Profilu — Wandzi Windzi</title>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=Crimson+Pro:ital,wght@0,300;0,400;1,300&display=swap" rel="stylesheet">
<link rel="icon" type="image/png" href="https://i.ibb.co/cPNxs5v/logosfera.png">
<style>
:root{--bg:#0e1117;--bg2:#141920;--bg3:#1c2330;--bg4:#222d3a;--border:rgba(120,160,200,0.15);--border-h:rgba(120,160,200,0.35);--accent:#7ba7c4;--accent-l:#a8c8e0;--accent-d:rgba(120,160,200,0.08);--text:#d8e4ee;--text-d:#7a9bb5;--text-m:#3d5468;--ok-t:#5bbfa0;--err-t:#c97080;--err-bg:rgba(180,60,70,0.15);--sidebar:200px;--props:272px;}
*{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg);color:var(--text);font-family:'Crimson Pro',Georgia,serif;font-size:14px;height:100vh;display:flex;flex-direction:column;overflow:hidden;}
 
/* Top bar */
.topbar{display:flex;align-items:center;gap:8px;padding:0 12px;height:44px;border-bottom:1px solid var(--border);background:var(--bg2);flex-shrink:0;}
.topbar-back{color:var(--text-d);text-decoration:none;font-size:0.82rem;padding:4px 8px;border-radius:3px;border:1px solid transparent;transition:all 0.12s;}
.topbar-back:hover{border-color:var(--border-h);color:var(--text);}
.topbar-divider{width:1px;height:22px;background:var(--border);margin:0 4px;flex-shrink:0;}
.char-title{font-family:'Cinzel',serif;font-size:0.88rem;color:var(--accent-l);flex:1;padding:0 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.pub-toggle{display:flex;align-items:center;gap:5px;font-size:0.8rem;color:var(--text-d);cursor:pointer;white-space:nowrap;}
.pub-toggle input{cursor:pointer;accent-color:var(--accent);}
.tb-btn{font-family:'Cinzel',serif;font-size:0.65rem;letter-spacing:0.07em;text-transform:uppercase;padding:5px 12px;border-radius:3px;border:1px solid var(--border-h);background:transparent;color:var(--text-d);cursor:pointer;transition:all 0.12s;white-space:nowrap;text-decoration:none;display:inline-flex;align-items:center;gap:4px;}
.tb-btn:hover{background:var(--accent-d);border-color:var(--accent);color:var(--accent-l);}
.tb-btn:disabled{opacity:0.3;cursor:default;pointer-events:none;}
.tb-btn.primary{background:var(--accent-d);border-color:var(--accent);color:var(--accent-l);}
.tb-btn.primary:hover{background:rgba(120,160,200,0.2);}
.tb-btn.dirty::before{content:'● ';font-size:0.5rem;}
 
/* Layout */
.editor-layout{display:flex;flex:1;overflow:hidden;}
 
/* Sidebar */
.sidebar{width:var(--sidebar);flex-shrink:0;border-right:1px solid var(--border);background:var(--bg2);display:flex;flex-direction:column;overflow:hidden;}
.sidebar-top{padding:8px 10px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:6px;flex-shrink:0;}
.sidebar-title{font-family:'Cinzel',serif;font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-m);}
.add-root-btn{font-family:'Cinzel',serif;font-size:0.6rem;letter-spacing:0.06em;text-transform:uppercase;padding:4px 8px;border-radius:3px;border:1px solid var(--border-h);background:var(--accent-d);color:var(--accent-l);cursor:pointer;transition:all 0.12s;}
.add-root-btn:hover{background:rgba(120,160,200,0.18);border-color:var(--accent);}
.sidebar-scroll{flex:1;overflow-y:auto;padding:6px;}
 
/* Page settings accordion in sidebar */
.ps-toggle{display:flex;align-items:center;justify-content:space-between;padding:7px 8px;cursor:pointer;border:1px solid var(--border);border-radius:4px;margin-bottom:6px;transition:all 0.12s;}
.ps-toggle:hover{border-color:var(--border-h);}
.ps-toggle-label{font-family:'Cinzel',serif;font-size:0.6rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-d);}
.ps-toggle-arr{font-size:0.55rem;color:var(--text-m);}
#ps-body{display:none;padding:8px 4px;border-bottom:1px solid var(--border);margin-bottom:8px;}
#ps-body.open{display:block;}
.ps-row{margin-bottom:8px;}
.ps-row label{display:block;font-size:0.72rem;color:var(--text-d);margin-bottom:3px;}
.ps-row input[type=text],.ps-row select{width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:3px;color:var(--text);font-family:'Crimson Pro',serif;font-size:0.82rem;padding:4px 7px;outline:none;}
.ps-row input:focus,.ps-row select:focus{border-color:var(--accent);}
.color-row{display:flex;gap:5px;align-items:center;}
.color-row input[type=color]{width:30px;height:26px;padding:2px;cursor:pointer;flex-shrink:0;border:1px solid var(--border);border-radius:3px;background:var(--bg3);}
.color-row input[type=text]{flex:1;}
.theme-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:2px;}
.theme-btn{padding:4px 2px;border-radius:3px;cursor:pointer;font-family:'Cinzel',serif;font-size:0.55rem;letter-spacing:0.04em;text-transform:uppercase;display:flex;flex-direction:column;align-items:center;gap:2px;color:var(--text-d);transition:all 0.12s;}
.theme-btn:hover{opacity:0.85;transform:scale(1.05);}
 
/* Block group labels */
.block-group-label{font-family:'Cinzel',serif;font-size:0.58rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-m);padding:7px 4px 3px;border-bottom:1px solid var(--border);margin-bottom:4px;}
.pal-block{display:flex;align-items:center;gap:7px;padding:6px 7px;border:1px solid transparent;border-radius:4px;cursor:pointer;transition:all 0.12s;margin-bottom:2px;}
.pal-block:hover{background:var(--bg3);border-color:var(--border);}
.pal-block:active{background:var(--accent-d);border-color:var(--accent);}
.pal-icon{font-size:0.95rem;width:20px;text-align:center;flex-shrink:0;color:var(--text-d);}
.pal-info{flex:1;min-width:0;}
.pal-label{font-family:'Cinzel',serif;font-size:0.6rem;letter-spacing:0.05em;text-transform:uppercase;color:var(--text);}
.pal-desc{font-size:0.67rem;color:var(--text-m);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
 
/* Canvas */
.canvas-wrap{flex:1;overflow-y:auto;padding:24px;display:flex;justify-content:center;position:relative;transition:background 0.3s;}
.canvas-inner{width:100%;max-width:900px;}
#canvas{min-height:400px;}
.canvas-empty{padding:4rem 2rem;text-align:center;color:var(--text-m);border:2px dashed rgba(120,160,200,0.12);border-radius:8px;font-style:italic;}
.canvas-empty strong{color:var(--accent-l);font-style:normal;}
 
/* Editor block overlays */
.eb{position:relative;outline:1px dashed transparent;outline-offset:2px;transition:outline-color 0.1s;cursor:pointer;}
.eb:hover{outline-color:rgba(120,160,200,0.25);}
.eb-sel{outline:2px solid var(--accent)!important;outline-offset:2px;}
.eb-bar{display:none;position:absolute;top:0;right:0;z-index:20;background:var(--bg2);border:1px solid var(--border);border-radius:0 0 0 4px;padding:2px 4px;gap:1px;align-items:center;}
.eb:hover .eb-bar,.eb-sel .eb-bar{display:flex;}
.eb-type{font-family:'Cinzel',serif;font-size:0.56rem;letter-spacing:0.05em;text-transform:uppercase;color:var(--accent);padding:0 5px;}
.eb-btn{background:transparent;border:none;color:var(--text-d);cursor:pointer;font-size:0.7rem;padding:2px 4px;border-radius:2px;line-height:1;}
.eb-btn:hover{background:var(--accent-d);color:var(--accent-l);}
.eb-del:hover{background:var(--err-bg)!important;color:var(--err-t)!important;}
.eb-add-child{margin-top:6px;padding:6px;border:1px dashed rgba(120,160,200,0.18);border-radius:4px;text-align:center;cursor:pointer;font-size:0.76rem;color:var(--text-m);transition:all 0.12s;}
.eb-add-child:hover{border-color:var(--accent);color:var(--accent-l);background:var(--accent-d);}
 
/* Rich text */
.richtext-wrap{position:relative;}
.rt-toolbar{display:flex;align-items:center;gap:2px;background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:4px 6px;margin-bottom:4px;flex-wrap:wrap;}
.rt-btn{background:transparent;border:1px solid transparent;border-radius:3px;color:var(--text-d);cursor:pointer;font-size:0.82rem;padding:3px 7px;transition:all 0.1s;display:inline-flex;align-items:center;gap:3px;font-family:'Crimson Pro',serif;}
.rt-btn:hover{background:var(--bg3);border-color:var(--border);color:var(--text);}
.rt-btn input[type=color]{width:16px;height:16px;padding:0;border:none;background:transparent;cursor:pointer;vertical-align:middle;}
.rt-sep{width:1px;height:16px;background:var(--border);margin:0 3px;flex-shrink:0;}
.richtext-editable{outline:none;min-height:40px;padding:4px;}
.richtext-editable:focus{outline:1px solid rgba(120,160,200,0.3);border-radius:2px;}
.richtext-content p{margin:0 0 0.5em;}
 
/* Props panel */
.props-panel{width:var(--props);flex-shrink:0;border-left:1px solid var(--border);background:var(--bg2);overflow-y:auto;display:flex;flex-direction:column;}
.props-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--text-m);text-align:center;font-size:0.85rem;font-style:italic;padding:1.5rem;}
.props-title{font-family:'Cinzel',serif;font-size:0.7rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--accent-l);padding:11px 14px 8px;border-bottom:1px solid var(--border);flex-shrink:0;}
details{border-bottom:1px solid var(--border);}
.prop-section{font-family:'Cinzel',serif;font-size:0.6rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-m);padding:7px 14px;cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;user-select:none;transition:color 0.1s;}
.prop-section:hover{color:var(--text);}
details[open] .prop-section{color:var(--accent);}
.prop-section::after{content:'▸';font-size:0.52rem;opacity:0.5;}
details[open] .prop-section::after{content:'▾';}
.prop-section-body{padding:8px 14px 12px;}
.prop-row{margin-bottom:8px;}
.prop-row label{display:block;font-size:0.7rem;color:var(--text-d);margin-bottom:3px;}
.prop-row input[type=text],.prop-row input[type=number],.prop-row select,.prop-row textarea{width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:3px;color:var(--text);font-family:'Crimson Pro',serif;font-size:0.84rem;padding:5px 8px;outline:none;transition:border-color 0.12s;}
.prop-row input:focus,.prop-row select:focus,.prop-row textarea:focus{border-color:var(--accent);}
.prop-row select option{background:var(--bg2);}
.prop-row textarea{resize:vertical;min-height:80px;}
.prop-hint{font-size:0.68rem;color:var(--text-m);margin-top:2px;font-style:italic;}
.prop-actions{padding:10px 14px 14px;display:flex;flex-direction:column;gap:5px;}
.prop-btn-add,.prop-btn-dup,.prop-btn-del{font-family:'Cinzel',serif;font-size:0.6rem;letter-spacing:0.07em;text-transform:uppercase;padding:6px 10px;border-radius:3px;cursor:pointer;transition:all 0.12s;width:100%;}
.prop-btn-add{border:1px solid var(--accent);background:var(--accent-d);color:var(--accent-l);}
.prop-btn-add:hover{background:rgba(120,160,200,0.18);}
.prop-btn-dup{border:1px solid var(--border-h);background:transparent;color:var(--text-d);}
.prop-btn-dup:hover{background:var(--bg3);color:var(--text);}
.prop-btn-del{border:1px solid rgba(180,60,70,0.3);background:transparent;color:var(--err-t);}
.prop-btn-del:hover{background:var(--err-bg);}
 
/* Type picker */
.picker-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:200;align-items:center;justify-content:center;}
.picker-overlay.open{display:flex;}
.picker-box{background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:1.4rem;max-width:520px;width:90%;max-height:80vh;overflow-y:auto;}
.picker-title{font-family:'Cinzel',serif;font-size:0.88rem;color:var(--accent-l);margin-bottom:3px;letter-spacing:0.06em;}
.picker-sub{font-size:0.78rem;color:var(--text-m);margin-bottom:1rem;font-style:italic;}
.picker-group-label{font-family:'Cinzel',serif;font-size:0.58rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-m);padding:7px 0 5px;border-bottom:1px solid var(--border);margin-bottom:5px;}
.picker-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:5px;margin-bottom:10px;}
.picker-btn{display:flex;align-items:center;gap:9px;padding:9px 11px;border:1px solid var(--border);border-radius:4px;background:transparent;color:var(--text-d);cursor:pointer;text-align:left;transition:all 0.12s;}
.picker-btn:hover{border-color:var(--accent);color:var(--text);background:var(--accent-d);}
.picker-icon{font-size:1.2rem;flex-shrink:0;width:24px;text-align:center;}
.picker-label{font-family:'Cinzel',serif;font-size:0.62rem;letter-spacing:0.05em;text-transform:uppercase;}
.picker-desc{font-size:0.7rem;color:var(--text-m);margin-top:1px;}
.picker-cancel{width:100%;padding:7px;margin-top:3px;border:1px solid var(--border);border-radius:3px;background:transparent;color:var(--text-m);cursor:pointer;font-family:'Cinzel',serif;font-size:0.63rem;letter-spacing:0.06em;text-transform:uppercase;}
.picker-cancel:hover{color:var(--err-t);border-color:rgba(180,60,70,0.3);}
 
/* Toast */
.toast{position:fixed;bottom:18px;left:50%;transform:translateX(-50%) translateY(8px);background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:7px 16px;font-size:0.83rem;opacity:0;transition:all 0.2s;pointer-events:none;z-index:300;white-space:nowrap;}
.toast-show{opacity:1;transform:translateX(-50%) translateY(0);}
.toast-ok{border-color:rgba(60,160,120,0.4);color:var(--ok-t);}
.toast-err{border-color:rgba(180,60,70,0.4);color:var(--err-t);}
</style>
</head>
<body>
 
<!-- Top bar -->
<div class="topbar">
  <a href="index.html" class="topbar-back">← Powrót</a>
  <div class="topbar-divider"></div>
  <div class="char-title" id="char-name-display">Ładowanie…</div>
  <button id="undo-btn" class="tb-btn" title="Cofnij (Ctrl+Z)" onclick="Editor.undo()" disabled>↩</button>
  <button id="redo-btn" class="tb-btn" title="Ponów (Ctrl+Y)" onclick="Editor.redo()" disabled>↪</button>
  <div class="topbar-divider"></div>
  <label class="pub-toggle" title="Widoczny publicznie">
    <input type="checkbox" id="toggle-public"> Publiczny
  </label>
  <a id="profile-link" href="profile.html" target="_blank" class="tb-btn">👁 Podgląd</a>
  <button class="tb-btn primary" id="save-btn" onclick="Editor.save()">Zapisz</button>
</div>
 
<div class="editor-layout">
 
  <!-- Sidebar -->
  <div class="sidebar">
    <div class="sidebar-top">
      <span class="sidebar-title">Bloki</span>
      <button class="add-root-btn" onclick="Editor.addBlock(null)">＋ Dodaj</button>
    </div>
    <div class="sidebar-scroll" id="sidebar-scroll">
 
      <!-- Page settings -->
      <div class="ps-toggle" onclick="document.getElementById('ps-body').classList.toggle('open');this.querySelector('.ps-toggle-arr').textContent=document.getElementById('ps-body').classList.contains('open')?'▾':'▸'">
        <span class="ps-toggle-label">⚙ Ustawienia strony</span>
        <span class="ps-toggle-arr">▸</span>
      </div>
      <div id="ps-body">
        <div id="page-settings-form"></div>
      </div>
 
      <div id="palette-blocks"></div>
    </div>
  </div>
 
  <!-- Canvas -->
  <div class="canvas-wrap" onclick="Editor.deselect()">
    <div class="canvas-inner">
      <div id="canvas"></div>
    </div>
  </div>
 
  <!-- Props -->
  <div class="props-panel" id="props-panel">
    <div class="props-empty">
      <div style="font-size:1.6rem;margin-bottom:0.8rem;opacity:0.2">⚙</div>
      Kliknij blok aby edytować
    </div>
  </div>
 
</div>
 
<!-- Type picker -->
<div class="picker-overlay" id="type-picker" onclick="if(event.target===this)this.classList.remove('open')">
  <div class="picker-box">
    <div class="picker-title">Wybierz typ bloku</div>
    <div class="picker-sub" id="picker-sub"></div>
    <div id="picker-content"></div>
    <button class="picker-cancel" onclick="document.getElementById('type-picker').classList.remove('open')">Anuluj</button>
  </div>
</div>
 
<div class="toast" id="toast"></div>
 
<script>window.PROXY = 'https://windzia-production.up.railway.app';</script>
<script src="js/blocks.js"></script>
<script src="js/editor.js"></script>
<script>
(function(){
  const paletteBlocks = document.getElementById('palette-blocks');
  const pickerContent = document.getElementById('picker-content');
 
  BlockGroups.forEach(group => {
    const types = Object.entries(BlockDefs).filter(([,d]) => d.group === group);
    if (!types.length) return;
 
    // Palette
    const gl = document.createElement('div');
    gl.className = 'block-group-label'; gl.textContent = group;
    paletteBlocks.appendChild(gl);
    types.forEach(([type, def]) => {
      const btn = document.createElement('div');
      btn.className = 'pal-block'; btn.title = def.desc || '';
      btn.innerHTML = `<span class="pal-icon">${def.icon}</span><div class="pal-info"><div class="pal-label">${def.label}</div><div class="pal-desc">${def.desc||''}</div></div>`;
      btn.onclick = () => Editor.addBlockOfType(type);
      paletteBlocks.appendChild(btn);
    });
 
    // Picker
    const pg = document.createElement('div');
    pg.innerHTML = `<div class="picker-group-label">${group}</div><div class="picker-grid">${types.map(([t,d])=>`<button class="picker-btn" onclick="Editor.addBlockOfType('${t}')"><span class="picker-icon">${d.icon}</span><div><div class="picker-label">${d.label}</div><div class="picker-desc">${d.desc||''}</div></div></button>`).join('')}</div>`;
    pickerContent.appendChild(pg);
  });
})();
 
document.addEventListener('keydown', e => {
  if ((e.ctrlKey||e.metaKey) && e.key==='s') { e.preventDefault(); Editor.save(); }
  if ((e.ctrlKey||e.metaKey) && e.key==='z') { e.preventDefault(); Editor.undo(); }
  if ((e.ctrlKey||e.metaKey) && (e.key==='y'||(e.shiftKey&&e.key==='z'))) { e.preventDefault(); Editor.redo(); }
  if (e.key==='Escape') { Editor.deselect(); document.getElementById('type-picker').classList.remove('open'); }
  if ((e.key==='Delete'||e.key==='Backspace') && Editor.selectedId && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName) && !document.activeElement.contentEditable==='true') {
    e.preventDefault(); Editor.remove(Editor.selectedId);
  }
});
 
document.addEventListener('DOMContentLoaded', () => Editor.init());
</script>
</body>
</html>
