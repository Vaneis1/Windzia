// blocks.js — Block definitions and renderer (shared: editor + profile view)
 
const BlockDefs = {
  // ── Layout ────────────────────────────────────────────────────────────────
  container: {
    label:'Kontener', icon:'⊞', group:'Układ',
    desc:'Blok z tłem, obramowaniem i kolumnami',
    hasChildren:true,
    defaultProps:{
      columns:1, column_template:'', // custom e.g. "1fr 2fr"
      width:'100%', height:'auto', min_height:0,
      bg_color:'', bg_image:'', bg_size:'cover', bg_position:'center',
      border_width:0, border_color:'rgba(120,160,200,0.4)',
      border_style:'solid', border_radius:8,
      padding:16, gap:16, align_items:'start',
      overflow:'visible',
    },
  },
  slider_v: {
    label:'Suwak pionowy', icon:'↕', group:'Układ',
    desc:'Przewijany kontener w pionie',
    hasChildren:true,
    defaultProps:{ width:'100%', height:'400px', gap:12, bg_color:'', padding:12 },
  },
  slider_h: {
    label:'Suwak poziomy', icon:'↔', group:'Układ',
    desc:'Przewijany kontener w poziomie',
    hasChildren:true,
    defaultProps:{ height:'220px', item_width:'240px', gap:12, bg_color:'', padding:8 },
  },
  // ── Content ───────────────────────────────────────────────────────────────
  text: {
    label:'Tekst', icon:'¶', group:'Treść',
    desc:'Akapit z pełną kontrolą typografii',
    hasChildren:false,
    defaultProps:{
      content:'Wpisz tekst tutaj...',
      color:'#d8e4ee', font_size:1, font_weight:'normal',
      font_style:'normal', text_align:'left',
      font_family:'Crimson Pro, serif', line_height:1.6,
      letter_spacing:'normal', margin_top:0, margin_bottom:8,
    },
  },
  heading: {
    label:'Nagłówek', icon:'H', group:'Treść',
    desc:'Tytuł sekcji (H1–H6)',
    hasChildren:false,
    defaultProps:{
      content:'Nagłówek', level:2,
      color:'#a8c8e0', text_align:'left',
      font_family:'Cinzel, serif', letter_spacing:'0.08em',
      margin_top:0, margin_bottom:8,
    },
  },
  badge: {
    label:'Etykieta', icon:'◈', group:'Treść',
    desc:'Mała dekoracyjna etykieta',
    hasChildren:false,
    defaultProps:{
      content:'Etykieta',
      bg_color:'rgba(120,160,200,0.15)', color:'#a8c8e0',
      border_color:'rgba(120,160,200,0.4)',
      border_radius:20, font_size:0.75,
      font_family:'Cinzel, serif',
    },
  },
  // ── Media ─────────────────────────────────────────────────────────────────
  image: {
    label:'Obraz', icon:'🖼', group:'Media',
    desc:'Obraz z URL (imgbb, imgur…)',
    hasChildren:false,
    defaultProps:{
      url:'', alt:'', width:'100%', max_width:'',
      height:'auto', border_radius:4,
      align:'center', object_fit:'cover',
    },
  },
  // ── Decorative ────────────────────────────────────────────────────────────
  divider: {
    label:'Separator', icon:'─', group:'Dekoracje',
    desc:'Pozioma linia',
    hasChildren:false,
    defaultProps:{ color:'rgba(120,160,200,0.25)', style:'solid', thickness:1, margin:16 },
  },
  spacer: {
    label:'Odstęp', icon:'↕', group:'Dekoracje',
    desc:'Pusty blok dystansujący',
    hasChildren:false,
    defaultProps:{ height:32 },
  },
};
 
const BlockGroups = ['Układ','Treść','Media','Dekoracje'];
 
// ── Utilities ─────────────────────────────────────────────────────────────────
function genId() { return 'b' + Math.random().toString(36).slice(2,9); }
function makeBlock(type) {
  const d = BlockDefs[type];
  return { id:genId(), type, props:{...(d?.defaultProps||{})}, children:d?.hasChildren?[]:undefined };
}
 
function findBlock(blocks,id) {
  for(const b of blocks){ if(b.id===id)return b; if(b.children){const f=findBlock(b.children,id);if(f)return f;} }
  return null;
}
function removeBlock(blocks,id) {
  return blocks.filter(b=>b.id!==id).map(b=>{if(b.children)b.children=removeBlock(b.children,id);return b;});
}
function updateBlockProps(blocks,id,newProps) {
  return blocks.map(b=>{
    if(b.id===id)return{...b,props:{...b.props,...newProps}};
    if(b.children)b.children=updateBlockProps(b.children,id,newProps);
    return b;
  });
}
function moveBlock(blocks,id,dir) {
  const idx=blocks.findIndex(b=>b.id===id);
  if(idx!==-1){
    const arr=[...blocks],to=dir==='up'?idx-1:idx+1;
    if(to>=0&&to<arr.length)[arr[idx],arr[to]]=[arr[to],arr[idx]];
    return arr;
  }
  return blocks.map(b=>{if(b.children)b.children=moveBlock(b.children,id,dir);return b;});
}
function addBlockTo(blocks,parentId,nb) {
  if(!parentId)return[...blocks,nb];
  return blocks.map(b=>{
    if(b.id===parentId&&b.children!==undefined)return{...b,children:[...b.children,nb]};
    if(b.children)b.children=addBlockTo(b.children,parentId,nb);
    return b;
  });
}
function duplicateBlock(blocks,id) {
  function deepClone(b){
    const nb={...b,id:genId(),props:{...b.props}};
    if(b.children)nb.children=b.children.map(deepClone);
    return nb;
  }
  function dup(arr){
    const result=[];
    for(const b of arr){
      result.push({...b,children:b.children?dup(b.children):b.children});
      if(b.id===id)result.push(deepClone(b));
    }
    return result;
  }
  return dup(blocks);
}
 
// ── Renderer ──────────────────────────────────────────────────────────────────
const Renderer = {
  render(blocks,em=false){ return(blocks||[]).map(b=>this.block(b,em)).join(''); },
 
  block(b,em){
    const inner=this._inner(b,em);
    if(!em)return inner;
    const sel=typeof Editor!=='undefined'&&Editor.selectedId===b.id;
    return `<div class="eb${sel?' eb-sel':''}" data-bid="${b.id}"
      onclick="event.stopPropagation();Editor.select('${b.id}')">
      <div class="eb-bar">
        <span class="eb-type">${BlockDefs[b.type]?.icon||''} ${BlockDefs[b.type]?.label||b.type}</span>
        <button class="eb-btn" title="W górę" onclick="event.stopPropagation();Editor.move('${b.id}','up')">↑</button>
        <button class="eb-btn" title="W dół" onclick="event.stopPropagation();Editor.move('${b.id}','down')">↓</button>
        <button class="eb-btn" title="Duplikuj" onclick="event.stopPropagation();Editor.duplicate('${b.id}')">⧉</button>
        <button class="eb-btn eb-del" title="Usuń" onclick="event.stopPropagation();Editor.remove('${b.id}')">✕</button>
      </div>${inner}</div>`;
  },
 
  _inner(b,em){
    switch(b.type){
      case 'container': return this.container(b,em);
      case 'slider_v':  return this.slider_v(b,em);
      case 'slider_h':  return this.slider_h(b,em);
      case 'text':      return this.text(b);
      case 'heading':   return this.heading(b);
      case 'image':     return this.image(b);
      case 'divider':   return this.divider(b);
      case 'spacer':    return this.spacer(b);
      case 'badge':     return this.badge(b);
      default: return `<div style="padding:8px;color:#666">[${b.type}]</div>`;
    }
  },
 
  container(b,em){
    const p=b.props||{};
    const cols=Math.max(1,parseInt(p.columns)||1);
    const gridCols = p.column_template || `repeat(${cols},1fr)`;
    const styles=[
      p.bg_color?`background-color:${p.bg_color}`:'',
      p.bg_image?`background-image:url('${p.bg_image}');background-size:${p.bg_size||'cover'};background-position:${p.bg_position||'center'}`:'',
      `border:${p.border_width||0}px ${p.border_style||'solid'} ${(p.border_width>0)?(p.border_color||'transparent'):'transparent'}`,
      `border-radius:${p.border_radius||0}px`,
      `padding:${p.padding!==undefined?p.padding:16}px`,
      p.width&&p.width!=='100%'?`width:${p.width}`:'width:100%',
      p.height&&p.height!=='auto'?`height:${p.height}`:'',
      p.min_height>0?`min-height:${p.min_height}px`:'',
      p.overflow&&p.overflow!=='visible'?`overflow:${p.overflow}`:'',
      'box-sizing:border-box',
    ].filter(Boolean).join(';');
    const gridStyle=cols>1||p.column_template
      ?`display:grid;grid-template-columns:${gridCols};gap:${p.gap||16}px;align-items:${p.align_items||'start'}`
      :'';
    const ch=this.render(b.children||[],em);
    const add=em?`<div class="eb-add-child" onclick="event.stopPropagation();Editor.addBlock('${b.id}')">＋ Dodaj blok tutaj</div>`:'';
    return`<div style="${styles}${gridStyle?';'+gridStyle:''}" class="profile-container">${ch}${add}</div>`;
  },
 
  slider_v(b,em){
    const p=b.props||{};
    const style=`width:${p.width||'100%'};height:${p.height||'400px'};overflow-y:auto;display:flex;flex-direction:column;gap:${p.gap||12}px;${p.bg_color?'background:'+p.bg_color+';':''}padding:${p.padding||0}px;box-sizing:border-box;scrollbar-width:thin`;
    const ch=this.render(b.children||[],em);
    const add=em?`<div class="eb-add-child" onclick="event.stopPropagation();Editor.addBlock('${b.id}')">＋ Dodaj blok</div>`:'';
    return`<div style="${style}">${ch}${add}</div>`;
  },
 
  slider_h(b,em){
    const p=b.props||{};
    const style=`display:flex;overflow-x:auto;height:${p.height||'220px'};gap:${p.gap||12}px;${p.bg_color?'background:'+p.bg_color+';':''}padding:${p.padding||0}px;box-sizing:border-box;scrollbar-width:thin;align-items:stretch`;
    const items=(b.children||[]).map(c=>{
      const inner=this._inner(c,false);
      if(em){const sel=typeof Editor!=='undefined'&&Editor.selectedId===c.id;
        return`<div class="eb${sel?' eb-sel':''}" data-bid="${c.id}" style="flex:0 0 ${p.item_width||'240px'};height:100%;box-sizing:border-box;" onclick="event.stopPropagation();Editor.select('${c.id}')"><div class="eb-bar"><span class="eb-type">${BlockDefs[c.type]?.icon||''} ${BlockDefs[c.type]?.label||c.type}</span><button class="eb-btn" onclick="event.stopPropagation();Editor.move('${c.id}','up')">←</button><button class="eb-btn" onclick="event.stopPropagation();Editor.move('${c.id}','down')">→</button><button class="eb-btn eb-del" onclick="event.stopPropagation();Editor.remove('${c.id}')">✕</button></div>${inner}</div>`;}
      return`<div style="flex:0 0 ${p.item_width||'240px'};height:100%;box-sizing:border-box;">${inner}</div>`;
    }).join('');
    const add=em?`<div class="eb-add-child" style="flex:0 0 auto;width:56px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;cursor:pointer;color:var(--gold,#7ba7c4);border:1px dashed rgba(120,160,200,0.3);border-radius:4px;" onclick="event.stopPropagation();Editor.addBlock('${b.id}')">＋</div>`:'';
    return`<div style="${style}">${items}${add}</div>`;
  },
 
  text(b){
    const p=b.props||{};
    const s=`color:${p.color||'#d8e4ee'};font-size:${p.font_size||1}rem;font-weight:${p.font_weight||'normal'};font-style:${p.font_style||'normal'};text-align:${p.text_align||'left'};font-family:${p.font_family||'inherit'};line-height:${p.line_height||1.6};letter-spacing:${p.letter_spacing||'normal'};margin:${p.margin_top||0}px 0 ${p.margin_bottom||8}px;white-space:pre-wrap`;
    return`<p style="${s}">${(p.content||'').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>`;
  },
 
  heading(b){
    const p=b.props||{};
    const tag=`h${Math.min(6,Math.max(1,parseInt(p.level)||2))}`;
    const s=`color:${p.color||'#a8c8e0'};text-align:${p.text_align||'left'};font-family:${p.font_family||'Cinzel,serif'};letter-spacing:${p.letter_spacing||'0.08em'};margin:${p.margin_top||0}px 0 ${p.margin_bottom||8}px`;
    return`<${tag} style="${s}">${(p.content||'').replace(/</g,'&lt;')}</${tag}>`;
  },
 
  image(b){
    const p=b.props||{};
    if(!p.url)return`<div style="padding:1.5rem;text-align:center;color:#3d5468;font-style:italic;border:1px dashed rgba(120,160,200,0.2);border-radius:4px;">🖼 Brak URL obrazu</div>`;
    const ws=`text-align:${p.align||'center'}`;
    const is=[`width:${p.width||'100%'}`,p.max_width?`max-width:${p.max_width}`:'',p.height&&p.height!=='auto'?`height:${p.height}`:''  ,`border-radius:${p.border_radius||0}px`,p.height&&p.height!=='auto'?`object-fit:${p.object_fit||'cover'}`:'','display:inline-block'].filter(Boolean).join(';');
    return`<div style="${ws}"><img src="${p.url}" alt="${p.alt||''}" style="${is}" loading="lazy"></div>`;
  },
 
  divider(b){
    const p=b.props||{};
    return`<hr style="border:none;border-top:${p.thickness||1}px ${p.style||'solid'} ${p.color||'rgba(120,160,200,0.25)'};margin:${p.margin||16}px 0">`;
  },
 
  spacer(b){ return`<div style="height:${(b.props||{}).height||32}px"></div>`; },
 
  badge(b){
    const p=b.props||{};
    const s=`background:${p.bg_color||'rgba(120,160,200,0.15)'};color:${p.color||'#a8c8e0'};border:1px solid ${p.border_color||'rgba(120,160,200,0.4)'};border-radius:${p.border_radius||20}px;font-size:${p.font_size||0.75}rem;display:inline-block;padding:3px 14px;font-family:${p.font_family||'Cinzel,serif'};letter-spacing:0.06em;text-transform:uppercase`;
    return`<span style="${s}">${(p.content||'').replace(/</g,'&lt;')}</span>`;
  },
};
