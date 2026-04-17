// blocks.js — Block type definitions and HTML renderer.
const BlockDefs = {
  container: { label:'Kontener', icon:'⊞', hasChildren:true, defaultProps:{ columns:1, bg_color:'', bg_image:'', border_width:0, border_color:'#00CCCC', border_style:'solid', border_radius:8, padding:16, gap:16, min_height:0, width:'100%' } },
  text:      { label:'Tekst',    icon:'T', hasChildren:false, defaultProps:{ content:'Wpisz tekst...', color:'#dff4fc', font_size:1, font_weight:'normal', font_style:'normal', text_align:'left', font_family:'Crimson Pro, serif', line_height:1.6 } },
  heading:   { label:'Nagłówek', icon:'H', hasChildren:false, defaultProps:{ content:'Nagłówek', level:2, color:'#6BB8D4', text_align:'left', font_family:'Cinzel, serif', letter_spacing:'0.08em' } },
  image:     { label:'Obraz',    icon:'🖼', hasChildren:false, defaultProps:{ url:'', alt:'', width:'100%', border_radius:4, align:'center', max_height:'' } },
  divider:   { label:'Separator',icon:'─', hasChildren:false, defaultProps:{ color:'rgba(133,214,242,0.3)', style:'solid', thickness:1, margin:16 } },
  spacer:    { label:'Odstęp',   icon:'↕', hasChildren:false, defaultProps:{ height:32 } },
  slider:    { label:'Suwak',    icon:'◫', hasChildren:true,  defaultProps:{ height:'220px', gap:12 } },
  badge:     { label:'Etykieta', icon:'◈', hasChildren:false, defaultProps:{ content:'Etykieta', bg_color:'rgba(0,204,204,0.15)', color:'#00CCCC', border_color:'#00CCCC', border_radius:20, font_size:0.8 } },
};
 
function genId() { return 'b' + Math.random().toString(36).slice(2,9); }
function makeBlock(type) { const d=BlockDefs[type]; return { id:genId(), type, props:{...(d?.defaultProps||{})}, children:d?.hasChildren?[]:undefined }; }
 
function findBlock(blocks,id){ for(const b of blocks){ if(b.id===id)return b; if(b.children){const f=findBlock(b.children,id);if(f)return f;} } return null; }
function findParent(blocks,id,par=null){ for(const b of blocks){ if(b.id===id)return par; if(b.children){const p=findParent(b.children,id,b);if(p!==undefined)return p;} } return undefined; }
function removeBlock(blocks,id){ return blocks.filter(b=>b.id!==id).map(b=>{if(b.children)b.children=removeBlock(b.children,id);return b;}); }
function updateBlockProps(blocks,id,newProps){ return blocks.map(b=>{ if(b.id===id)return{...b,props:{...b.props,...newProps}}; if(b.children)b.children=updateBlockProps(b.children,id,newProps); return b; }); }
function moveBlock(blocks,id,dir){ const idx=blocks.findIndex(b=>b.id===id); if(idx!==-1){const arr=[...blocks],to=dir==='up'?idx-1:idx+1;if(to>=0&&to<arr.length)[arr[idx],arr[to]]=[arr[to],arr[idx]];return arr;} return blocks.map(b=>{if(b.children)b.children=moveBlock(b.children,id,dir);return b;}); }
function addBlockTo(blocks,parentId,nb){ if(!parentId)return[...blocks,nb]; return blocks.map(b=>{ if(b.id===parentId&&b.children!==undefined)return{...b,children:[...b.children,nb]}; if(b.children)b.children=addBlockTo(b.children,parentId,nb); return b; }); }
 
const Renderer = {
  render(blocks,em=false){ return(blocks||[]).map(b=>this.block(b,em)).join(''); },
 
  block(b,em){
    const inner=this._inner(b,em);
    if(!em)return inner;
    const sel=typeof Editor!=='undefined'&&Editor.selectedId===b.id;
    return `<div class="eb${sel?' eb-sel':''}" data-bid="${b.id}" onclick="event.stopPropagation();Editor.select('${b.id}')">
      <div class="eb-bar"><span class="eb-type">${BlockDefs[b.type]?.label||b.type}</span>
        <button class="eb-btn" onclick="event.stopPropagation();Editor.move('${b.id}','up')">↑</button>
        <button class="eb-btn" onclick="event.stopPropagation();Editor.move('${b.id}','down')">↓</button>
        <button class="eb-btn eb-del" onclick="event.stopPropagation();Editor.remove('${b.id}')">✕</button>
      </div>${inner}</div>`;
  },
 
  _inner(b,em){
    switch(b.type){
      case 'container':return this.container(b,em);
      case 'text':return this.text(b);
      case 'heading':return this.heading(b);
      case 'image':return this.image(b);
      case 'divider':return this.divider(b);
      case 'spacer':return this.spacer(b);
      case 'slider':return this.slider(b,em);
      case 'badge':return this.badge(b);
      default:return`<div style="padding:8px;color:#888">[${b.type}]</div>`;
    }
  },
 
  container(b,em){
    const p=b.props||{};
    const cols=Math.max(1,parseInt(p.columns)||1);
    const s=[
      p.bg_color?`background-color:${p.bg_color}`:'',
      p.bg_image?`background-image:url('${p.bg_image}');background-size:cover;background-position:center`:'',
      `border:${p.border_width||0}px ${p.border_style||'solid'} ${(p.border_width>0)?(p.border_color||'transparent'):'transparent'}`,
      `border-radius:${p.border_radius||0}px`,
      `padding:${p.padding!==undefined?p.padding:16}px`,
      p.min_height>0?`min-height:${p.min_height}px`:'',
      p.width?`width:${p.width}`:'',
      'box-sizing:border-box',
    ].filter(Boolean).join(';');
    const g=cols>1?`display:grid;grid-template-columns:repeat(${cols},1fr);gap:${p.gap||16}px;align-items:start`:'';
    const ch=this.render(b.children||[],em);
    const add=em?`<div class="eb-add-child" onclick="event.stopPropagation();Editor.addBlock('${b.id}')">+ Dodaj blok tutaj</div>`:'';
    return`<div style="${s}${g?';'+g:''}" class="profile-container">${ch}${add}</div>`;
  },
 
  text(b){
    const p=b.props||{};
    const s=[`color:${p.color||'#dff4fc'}`,`font-size:${p.font_size||1}rem`,`font-weight:${p.font_weight||'normal'}`,`font-style:${p.font_style||'normal'}`,`text-align:${p.text_align||'left'}`,`font-family:${p.font_family||'inherit'}`,`line-height:${p.line_height||1.6}`,'white-space:pre-wrap'].join(';');
    return`<p style="${s}">${(p.content||'').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>`;
  },
 
  heading(b){
    const p=b.props||{};
    const tag=`h${Math.min(6,Math.max(1,parseInt(p.level)||2))}`;
    const s=[`color:${p.color||'#6BB8D4'}`,`text-align:${p.text_align||'left'}`,`font-family:${p.font_family||'Cinzel,serif'}`,`letter-spacing:${p.letter_spacing||'0.08em'}`,'margin:0 0 0.5em'].join(';');
    return`<${tag} style="${s}">${(p.content||'').replace(/</g,'&lt;')}</${tag}>`;
  },
 
  image(b){
    const p=b.props||{};
    if(!p.url)return`<div style="padding:1rem;text-align:center;color:#3d6a80;font-style:italic;border:1px dashed #3d6a80;border-radius:4px">Brak URL obrazu</div>`;
    const ws=`text-align:${p.align||'center'}`;
    const is=[`max-width:${p.width||'100%'}`,`border-radius:${p.border_radius||0}px`,p.max_height?`max-height:${p.max_height}`:'','display:inline-block'].filter(Boolean).join(';');
    return`<div style="${ws}"><img src="${p.url}" alt="${p.alt||''}" style="${is}" loading="lazy"></div>`;
  },
 
  divider(b){
    const p=b.props||{};
    return`<hr style="border:none;border-top:${p.thickness||1}px ${p.style||'solid'} ${p.color||'rgba(133,214,242,0.3)'};margin:${p.margin||16}px 0">`;
  },
 
  spacer(b){ return`<div style="height:${(b.props||{}).height||32}px"></div>`; },
 
  slider(b,em){
    const p=b.props||{};
    const s=`display:flex;overflow-x:auto;gap:${p.gap||12}px;height:${p.height||'220px'};align-items:stretch;scrollbar-width:thin;padding-bottom:4px`;
    const items=(b.children||[]).map(c=>{
      const inner=this._inner(c,false);
      if(em){const sel=typeof Editor!=='undefined'&&Editor.selectedId===c.id;return`<div class="slider-item eb${sel?' eb-sel':''}" data-bid="${c.id}" onclick="event.stopPropagation();Editor.select('${c.id}')" style="flex:0 0 auto;min-width:180px;height:100%"><div class="eb-bar"><span class="eb-type">${BlockDefs[c.type]?.label||c.type}</span><button class="eb-btn" onclick="event.stopPropagation();Editor.move('${c.id}','up')">←</button><button class="eb-btn" onclick="event.stopPropagation();Editor.move('${c.id}','down')">→</button><button class="eb-btn eb-del" onclick="event.stopPropagation();Editor.remove('${c.id}')">✕</button></div>${inner}</div>`;}
      return`<div style="flex:0 0 auto;min-width:180px;height:100%">${inner}</div>`;
    }).join('');
    const add=em?`<div class="eb-add-child slider-add" onclick="event.stopPropagation();Editor.addBlock('${b.id}')" style="flex:0 0 auto;width:60px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;cursor:pointer;color:var(--gold,#00CCCC)">+</div>`:'';
    return`<div style="${s}">${items}${add}</div>`;
  },
 
  badge(b){
    const p=b.props||{};
    const s=`background:${p.bg_color||'rgba(0,204,204,0.15)'};color:${p.color||'#00CCCC'};border:1px solid ${p.border_color||'#00CCCC'};border-radius:${p.border_radius||20}px;font-size:${p.font_size||0.8}rem;display:inline-block;padding:3px 12px;font-family:Cinzel,serif;letter-spacing:0.06em;text-transform:uppercase`;
    return`<span style="${s}">${(p.content||'Etykieta').replace(/</g,'&lt;')}</span>`;
  },
};
