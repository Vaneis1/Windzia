// editor.js — Profile editor logic
const Editor = {
  charId:null, charName:'',
  blocks:[], selectedId:null,
  dirty:false, addTarget:null,
  history:[], historyIndex:-1,
  copiedStyle:null,
  pageSettings:{ bg_color:'', bg_image:'', bg_size:'cover', bg_position:'center', max_width:'900px' },
 
  async init(){
    const params=new URLSearchParams(window.location.search);
    this.charId=params.get('id');
    if(!this.charId){window.location.href='index.html';return;}
    const token=localStorage.getItem('ww_token');
    if(!token){window.location.href='index.html';return;}
    try{
      const me=await this._api('GET','/auth/me');
      if(me.error)throw new Error(me.error);
      const data=await this._api('GET',`/characters/${this.charId}/profile`);
      if(data.error)throw new Error(data.error);
      this.charName=data.name;
      // Handle both old (array) and new (object with blocks+settings) format
      const pb=data.profile_blocks;
      if(pb&&!Array.isArray(pb)&&pb.blocks){
        this.blocks=pb.blocks||[];
        this.pageSettings={...this.pageSettings,...(pb.settings||{})};
      } else {
        this.blocks=pb||[];
      }
      document.getElementById('char-name-display').textContent=data.name;
      document.getElementById('toggle-public').checked=data.profile_public||false;
      document.getElementById('profile-link').href=`profile.html?id=${this.charId}`;
      this._applyPageSettingsToEditor();
      this._renderPageSettingsForm();
      this._pushHistory();
      this.render();
      this._renderProps();
    }catch(e){this._toast('Błąd: '+e.message,'err');}
  },
 
  async _api(method,path,body){
    const token=localStorage.getItem('ww_token')||'';
    const opts={method,headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}};
    if(body)opts.body=JSON.stringify(body);
    const res=await fetch((window.PROXY||'')+path,opts);
    return res.json();
  },
 
  // ── History ───────────────────────────────────────────────────────────────
  _pushHistory(){
    this.history=this.history.slice(0,this.historyIndex+1);
    this.history.push(JSON.stringify({blocks:this.blocks,settings:this.pageSettings}));
    if(this.history.length>50)this.history.shift();
    this.historyIndex=this.history.length-1;
    this._updateHistoryBtns();
  },
  undo(){
    if(this.historyIndex<=0)return;
    this.historyIndex--;
    const s=JSON.parse(this.history[this.historyIndex]);
    this.blocks=s.blocks||[];this.pageSettings=s.settings||this.pageSettings;
    this.selectedId=null;this._markDirty(false);this.render();this._renderProps();this._applyPageSettingsToEditor();
  },
  redo(){
    if(this.historyIndex>=this.history.length-1)return;
    this.historyIndex++;
    const s=JSON.parse(this.history[this.historyIndex]);
    this.blocks=s.blocks||[];this.pageSettings=s.settings||this.pageSettings;
    this.selectedId=null;this._markDirty(false);this.render();this._renderProps();this._applyPageSettingsToEditor();
  },
  _updateHistoryBtns(){
    const u=document.getElementById('undo-btn'),r=document.getElementById('redo-btn');
    if(u)u.disabled=this.historyIndex<=0;
    if(r)r.disabled=this.historyIndex>=this.history.length-1;
  },
 
  // ── Selection ─────────────────────────────────────────────────────────────
  select(id){
    if(this.selectedId===id)return;
    this.selectedId=id;this.addTarget=id;
    this._highlightSelected();this._renderProps();
    // For richtext: focus the contenteditable
    if(id){const block=findBlock(this.blocks,id);if(block?.type==='richtext'){setTimeout(()=>{const el=document.querySelector(`.richtext-editable[data-bid="${id}"]`);if(el)el.focus();},10);}
    }
    // Re-render richtext toolbar
    if(id){const block=findBlock(this.blocks,id);if(block?.type==='richtext'){this.render();}}
  },
  deselect(){
    this.selectedId=null;this.addTarget=null;
    this._highlightSelected();this._renderProps();
  },
  _highlightSelected(){
    document.querySelectorAll('.eb').forEach(el=>el.classList.toggle('eb-sel',el.dataset.bid===this.selectedId));
  },
 
  // ── Rich text ─────────────────────────────────────────────────────────────
  _savedRange: null,
  _saveSelection(){
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) this._savedRange = sel.getRangeAt(0).cloneRange();
  },
  _applyColor(cmd, value){
    const el = this.selectedId
      ? document.querySelector(`.richtext-editable[data-bid="${this.selectedId}"]`)
      : null;
    if (!el) return;
    el.focus();
    // Restore saved selection if current selection is empty
    const sel = window.getSelection();
    if (this._savedRange && (!sel || sel.isCollapsed)) {
      sel.removeAllRanges();
      sel.addRange(this._savedRange);
    }
    if (!sel || sel.isCollapsed) return; // nothing selected
    if (value === 'inherit' || value === 'transparent') {
      // Wrap in span and remove color via style
      document.execCommand('removeFormat');
    } else {
      document.execCommand(cmd, false, value);
    }
    const html = el.innerHTML;
    this._richtextBlur(this.selectedId, html);
  },
  _richtextInput(id,html){
    // Update state without re-rendering (preserves cursor)
    this.blocks=updateBlockProps(this.blocks,id,{content:html});
    this._markDirty(false); // mark dirty but don't push history on every keystroke
  },
  _richtextBlur(id,html){
    this.blocks=updateBlockProps(this.blocks,id,{content:html});
    this._markDirty();
  },
 
  // ── Add block ─────────────────────────────────────────────────────────────
  addBlock(parentId){
    this.addTarget=parentId??null;
    const sub=document.getElementById('picker-sub');
    if(sub)sub.textContent=parentId?'→ wewnątrz bloku':'→ do głównego obszaru';
    document.getElementById('type-picker').classList.add('open');
  },
  addBlockOfType(type){
    document.getElementById('type-picker').classList.remove('open');
    const nb=makeBlock(type);
    this.blocks=addBlockTo(this.blocks,this.addTarget,nb);
    this.selectedId=nb.id;
    this._markDirty();this.render();this._renderProps();
    setTimeout(()=>{const el=document.querySelector(`[data-bid="${nb.id}"]`);if(el)el.scrollIntoView({behavior:'smooth',block:'nearest'});},50);
  },
 
  // ── Mutations ─────────────────────────────────────────────────────────────
  remove(id){
    if(!confirm('Usunąć blok?'))return;
    this.blocks=removeBlock(this.blocks,id);
    if(this.selectedId===id)this.selectedId=null;
    this._markDirty();this.render();this._renderProps();
  },
  move(id,dir){
    this.blocks=moveBlock(this.blocks,id,dir);
    this._markDirty();this.render();
    setTimeout(()=>this._highlightSelected(),10);
  },
  duplicate(id){
    this.blocks=duplicateBlock(this.blocks,id);
    this._markDirty();this.render();
  },
  updateProp(key,value){
    if(!this.selectedId)return;
    this.blocks=updateBlockProps(this.blocks,this.selectedId,{[key]:value});
    const block=findBlock(this.blocks,this.selectedId);
    if(block?.type==='richtext'&&key==='content'){this._markDirty(false);return;}
    this._markDirty(false);
    // Re-render only this block
    const el=document.querySelector(`[data-bid="${this.selectedId}"]`);
    if(el&&block){
      const tmp=document.createElement('div');
      tmp.innerHTML=Renderer.block(block,true);
      el.replaceWith(tmp.firstChild);
      this._highlightSelected();
    }
  },
  _markDirty(push=true){
    this.dirty=true;
    if(push)this._pushHistory();
    const btn=document.getElementById('save-btn');
    if(btn)btn.classList.add('dirty');
  },
 
  // ── Copy / paste style ────────────────────────────────────────────────────
  copyStyle(id){
    const block=findBlock(this.blocks,id);
    if(!block)return;
    this.copiedStyle={type:block.type,props:{...block.props}};
    this._toast('Skopiowano styl bloku','ok');
  },
  pasteStyle(id){
    if(!this.copiedStyle){this._toast('Brak skopiowanego stylu','err');return;}
    const block=findBlock(this.blocks,id);
    if(!block)return;
    if(block.type!==this.copiedStyle.type){this._toast('Bloki muszą być tego samego typu','err');return;}
    // Don't copy content, only visual props
    const contentKeys=['content','children','id'];
    const stylePropsToPaste=Object.fromEntries(Object.entries(this.copiedStyle.props).filter(([k])=>!contentKeys.includes(k)));
    this.blocks=updateBlockProps(this.blocks,id,stylePropsToPaste);
    this._markDirty();this.render();this._renderProps();
    this._toast('Wklejono styl','ok');
  },
 
  // ── Page settings ─────────────────────────────────────────────────────────
  updatePageSetting(key,value){
    this.pageSettings={...this.pageSettings,[key]:value};
    this._applyPageSettingsToEditor();
    this._markDirty();
  },
  _applyPageSettingsToEditor(){
    const canvas=document.querySelector('.canvas-wrap');
    if(!canvas)return;
    const s=this.pageSettings;
    canvas.style.background=s.bg_color||'var(--bg)';
    if(s.bg_image)canvas.style.backgroundImage=`url('${s.bg_image}')`;
    else canvas.style.backgroundImage='none';
    canvas.style.backgroundSize=s.bg_size||'cover';
    canvas.style.backgroundPosition=s.bg_position||'center';
    const inner=document.querySelector('.canvas-inner');
    if(inner)inner.style.maxWidth=s.max_width||'900px';
  },
  _renderPageSettingsForm(){
    const el=document.getElementById('page-settings-form');
    if(!el)return;
    const s=this.pageSettings;
    el.innerHTML=`
      <div class="ps-row"><label>Kolor tła strony</label>
        <div class="color-row"><input type="color" value="${s.bg_color||'#0e1117'}" oninput="Editor.updatePageSetting('bg_color',this.value)"><input type="text" value="${s.bg_color||''}" placeholder="#0e1117" oninput="Editor.updatePageSetting('bg_color',this.value)"></div>
      </div>
      <div class="ps-row"><label>Obraz tła (URL)</label>
        <input type="text" value="${s.bg_image||''}" placeholder="https://..." oninput="Editor.updatePageSetting('bg_image',this.value)">
      </div>
      <div class="ps-row"><label>Rozmiar tła</label>
        <select onchange="Editor.updatePageSetting('bg_size',this.value)">
          ${[['cover','Cover'],['contain','Contain'],['auto','Auto'],['100% 100%','Rozciągnij']].map(([v,l])=>`<option value="${v}"${s.bg_size===v?' selected':''}>${l}</option>`).join('')}
        </select>
      </div>
      <div class="ps-row"><label>Max. szerokość profilu</label>
        <input type="text" value="${s.max_width||'900px'}" placeholder="900px" oninput="Editor.updatePageSetting('max_width',this.value)">
      </div>
      <div class="ps-row"><label>Motyw kolorów</label>
        <div class="theme-grid">${ColorThemes.map(t=>`<button class="theme-btn" title="${t.name}" onclick="Editor.applyTheme(${JSON.stringify(t).replace(/"/g,'&quot;')})" style="background:${t.bg};border:2px solid ${t.accent}">${t.icon}<span>${t.name}</span></button>`).join('')}</div>
      </div>`;
  },
  applyTheme(theme){
    this.updatePageSetting('bg_color',theme.bg);
    // Apply theme colors to all heading blocks
    this.blocks=this._applyThemeToBlocks(this.blocks,theme);
    this._markDirty();this.render();this._renderProps();
    this._toast('Zastosowano motyw: '+theme.name,'ok');
  },
  _applyThemeToBlocks(blocks,theme){
    return blocks.map(b=>{
      let nb={...b,props:{...b.props}};
      if(b.type==='heading')nb.props.color=theme.heading;
      if(b.type==='text')nb.props.color=theme.text;
      if(b.type==='richtext')nb.props.color=theme.text;
      if(b.type==='container'&&b.props.border_width>0)nb.props.border_color=theme.accent;
      if(b.type==='cards'){nb.props.card_border=theme.accent;nb.props.card_bg=theme.card_bg;}
      if(b.children)nb.children=this._applyThemeToBlocks(b.children,theme);
      return nb;
    });
  },
 
  // ── Render canvas ─────────────────────────────────────────────────────────
  render(){
    const canvas=document.getElementById('canvas');
    if(!canvas)return;
    canvas.innerHTML=Renderer.render(this.blocks,true)||`<div class="canvas-empty"><div style="font-size:2rem;margin-bottom:1rem;opacity:0.2">⊞</div><div>Kliknij <strong>＋ Dodaj</strong> aby rozpocząć</div></div>`;
  },
 
  // ── Properties panel ─────────────────────────────────────────────────────
  _renderProps(){
    const panel=document.getElementById('props-panel');
    if(!panel)return;
    if(!this.selectedId){panel.innerHTML=`<div class="props-empty"><div style="font-size:1.8rem;margin-bottom:0.8rem;opacity:0.2">⚙</div>Kliknij blok aby edytować właściwości</div>`;return;}
    const block=findBlock(this.blocks,this.selectedId);
    if(!block){panel.innerHTML='';return;}
    panel.innerHTML=this._buildPropsForm(block);
  },
 
  _buildPropsForm(block){
    const p=block.props||{};const def=BlockDefs[block.type];
    const section=(title,content)=>`<details open><summary class="prop-section">${title}</summary><div class="prop-section-body">${content}</div></details>`;
    const row=(label,input,hint='')=>`<div class="prop-row"><label>${label}</label>${input}${hint?`<div class="prop-hint">${hint}</div>`:''}</div>`;
    const txt=(key,ph='')=>`<input type="text" value="${(p[key]||'').toString().replace(/"/g,'&quot;')}" placeholder="${ph}" oninput="Editor.updateProp('${key}',this.value)">`;
    const num=(key,min=0,max=9999,step=1)=>`<input type="number" value="${p[key]!==undefined?p[key]:0}" min="${min}" max="${max}" step="${step}" oninput="Editor.updateProp('${key}',parseFloat(this.value)||0)">`;
    const clr=(key,def='#7ba7c4')=>`<div class="color-row"><input type="color" value="${p[key]||def}" oninput="Editor.updateProp('${key}',this.value)"><input type="text" value="${(p[key]||'').replace(/"/g,'&quot;')}" placeholder="${def}" oninput="Editor.updateProp('${key}',this.value)"></div>`;
    const sel=(key,opts)=>`<select onchange="Editor.updateProp('${key}',this.value)">${opts.map(([v,l])=>`<option value="${v}"${(p[key]||'')===(v)?' selected':''}>${l}</option>`).join('')}</select>`;
    const textarea=(key,rows=5)=>`<textarea rows="${rows}" oninput="Editor.updateProp('${key}',this.value)">${(p[key]||'').replace(/</g,'&lt;')}</textarea>`;
 
    let html=`<div class="props-title">${def?.icon||''} ${def?.label||block.type}</div>`;
 
    if(block.type==='container'){
      html+=section('Kolumny i układ',row('Liczba kolumn',num('columns',1,12,1))+row('Własny grid',txt('column_template','np. 1fr 2fr'),'Nadpisuje "Liczba kolumn"')+row('Wyrównanie',sel('align_items',[['start','Góra'],['center','Środek'],['end','Dół'],['stretch','Rozciągnij']]))+row('Odstęp (px)',num('gap',0,200,4))+row('Padding (px)',num('padding',0,200,4)));
      html+=section('Rozmiar',row('Szerokość',txt('width','100%'),'100%, 500px, auto…')+row('Wysokość',txt('height','auto'),'auto, 300px, 50vh…')+row('Min. wysokość (px)',num('min_height',0,2000,10))+row('Overflow',sel('overflow',[['visible','Widoczny'],['hidden','Ukryty'],['auto','Scroll auto'],['scroll','Zawsze scroll']])));
      html+=section('Tło',row('Kolor',clr('bg_color','transparent'))+row('URL obrazu',txt('bg_image','https://…'))+row('Rozmiar',sel('bg_size',[['cover','Cover'],['contain','Contain'],['auto','Auto'],['100% 100%','Rozciągnij']]))+row('Pozycja',sel('bg_position',[['center','Środek'],['top','Góra'],['bottom','Dół'],['left','Lewo'],['right','Prawo']])));
      html+=section('Obramowanie',row('Grubość (px)',num('border_width',0,20,1))+row('Kolor',clr('border_color','rgba(120,160,200,0.4)'))+row('Styl',sel('border_style',[['solid','Ciągłe'],['dashed','Kreskowane'],['dotted','Kropkowane'],['double','Podwójne'],['none','Brak']]))+row('Zaokrąglenie (px)',num('border_radius',0,200,2)));
    }
    if(block.type==='cards'){
      html+=section('Siatka',row('Kolumny',num('columns',1,8,1))+row('Odstęp (px)',num('gap',0,100,4))+row('Padding strony (px)',num('padding',0,100,4))+row('Szerokość',txt('width','100%')));
      html+=section('Styl kart',row('Tło karty',clr('card_bg','rgba(120,160,200,0.05)'))+row('Obramowanie',clr('card_border','rgba(120,160,200,0.18)'))+row('Zaokrąglenie (px)',num('card_radius',0,50,2))+row('Padding karty (px)',num('card_padding',0,100,4)));
    }
    if(block.type==='slider_v'){html+=section('Rozmiar',row('Szerokość',txt('width','100%'))+row('Wysokość',txt('height','400px'),'px, vh…')+row('Odstęp (px)',num('gap',0,100,4))+row('Padding (px)',num('padding',0,100,4))+row('Kolor tła',clr('bg_color','transparent')));}
    if(block.type==='slider_h'){html+=section('Rozmiar',row('Wysokość',txt('height','220px'))+row('Szer. elementu',txt('item_width','240px'))+row('Odstęp (px)',num('gap',0,100,4))+row('Padding (px)',num('padding',0,100,4))+row('Kolor tła',clr('bg_color','transparent')));}
 
    if(block.type==='richtext'){
      html+=section('Styl bazowy',row('Kolor',clr('color','#d8e4ee'))+row('Rozmiar (rem)',num('font_size',0.5,6,0.05))+row('Czcionka',sel('font_family',[['Crimson Pro, serif','Crimson Pro'],['Cinzel, serif','Cinzel'],['sans-serif','Sans-serif'],['monospace','Monospace']]))+row('Interlinia',num('line_height',1,5,0.05))+row('Padding (px)',num('padding',0,100,4)));
      html+=`<div class="prop-hint" style="margin:8px 14px;padding:8px;background:rgba(120,160,200,0.08);border-radius:3px;border:1px solid rgba(120,160,200,0.15);">💡 Zaznacz tekst w bloku i użyj paska narzędzi który pojawi się na górze</div>`;
    }
    if(block.type==='text'){
      html+=section('Treść',row('Tekst',textarea('content',6)));
      html+=section('Typografia',row('Kolor',clr('color','#d8e4ee'))+row('Rozmiar (rem)',num('font_size',0.5,6,0.05))+row('Grubość',sel('font_weight',[['300','Cienka'],['normal','Normalna'],['500','Medium'],['bold','Pogrubiona']]))+row('Styl',sel('font_style',[['normal','Normalna'],['italic','Kursywa']]))+row('Wyrównanie',sel('text_align',[['left','Lewo'],['center','Środek'],['right','Prawo'],['justify','Wyjust.']]))+row('Czcionka',sel('font_family',[['Crimson Pro, serif','Crimson Pro'],['Cinzel, serif','Cinzel'],['sans-serif','Sans-serif'],['monospace','Mono']]))+row('Interlinia',num('line_height',1,5,0.05)));
      html+=section('Odstępy',row('Margines górny (px)',num('margin_top',0,200,4))+row('Margines dolny (px)',num('margin_bottom',0,200,4)));
    }
    if(block.type==='heading'){
      html+=section('Treść',row('Tekst',txt('content'))+row('Poziom',sel('level',[['1','H1 — Największy'],['2','H2'],['3','H3'],['4','H4'],['5','H5'],['6','H6 — Najmniejszy']])));
      html+=section('Typografia',row('Kolor',clr('color','#a8c8e0'))+row('Wyrównanie',sel('text_align',[['left','Lewo'],['center','Środek'],['right','Prawo']]))+row('Czcionka',sel('font_family',[['Cinzel, serif','Cinzel'],['Crimson Pro, serif','Crimson Pro'],['sans-serif','Sans-serif']]))+row('Odstęp liter',txt('letter_spacing','0.08em')));
      html+=section('Odstępy',row('Margines górny (px)',num('margin_top',0,200,4))+row('Margines dolny (px)',num('margin_bottom',0,200,4)));
    }
    if(block.type==='quote'){
      html+=section('Treść',row('Cytat',textarea('content',4))+row('Autor',txt('author','np. Jan Kowalski')));
      html+=section('Wygląd',row('Kolor tekstu',clr('color','#a8c8e0'))+row('Kolor kreski',clr('border_color','#7ba7c4'))+row('Tło',clr('bg_color','rgba(120,160,200,0.06)'))+row('Rozmiar (rem)',num('font_size',0.5,4,0.05))+row('Styl',sel('font_style',[['italic','Kursywa'],['normal','Normalna']]))+row('Padding (px)',num('padding',0,100,4)));
    }
    if(block.type==='image'){
      html+=section('Źródło',row('URL obrazu',txt('url','https://i.ibb.co/…'))+row('Alt',txt('alt')));
      html+=section('Rozmiar',row('Szerokość',txt('width','100%'),'%, px, auto')+row('Max. szerokość',txt('max_width',''))+row('Wysokość',txt('height','auto'),'auto, 200px…')+row('Object-fit',sel('object_fit',[['cover','Cover'],['contain','Contain'],['fill','Fill'],['none','None']]))+row('Wyrównanie',sel('align',[['left','Lewo'],['center','Środek'],['right','Prawo']]))+row('Zaokrąglenie (px)',num('border_radius',0,500,4)));
    }
    if(block.type==='divider'){html+=section('Wygląd',row('Kolor',clr('color','rgba(120,160,200,0.25)'))+row('Styl',sel('style',[['solid','Ciągły'],['dashed','Kreskowany'],['dotted','Kropkowany'],['double','Podwójny']]))+row('Grubość (px)',num('thickness',1,20,1))+row('Margines (px)',num('margin',0,100,4)));}
    if(block.type==='spacer'){html+=section('Rozmiar',row('Wysokość (px)',num('height',4,1000,4)));}
    if(block.type==='badge'){
      html+=section('Treść',row('Tekst',txt('content')));
      html+=section('Wygląd',row('Kolor tekstu',clr('color','#a8c8e0'))+row('Tło',clr('bg_color','rgba(120,160,200,0.15)'))+row('Obramowanie',clr('border_color','rgba(120,160,200,0.4)'))+row('Zaokrąglenie (px)',num('border_radius',0,50,2))+row('Rozmiar (rem)',num('font_size',0.5,3,0.05))+row('Czcionka',sel('font_family',[['Cinzel, serif','Cinzel'],['Crimson Pro, serif','Crimson Pro'],['sans-serif','Sans-serif']])));
    }
 
    html+=`<div class="prop-actions">`;
    if(def?.hasChildren)html+=`<button class="prop-btn-add" onclick="Editor.addBlock('${block.id}')">＋ Dodaj blok wewnątrz</button>`;
    html+=`<button class="prop-btn-dup" onclick="Editor.duplicate('${block.id}')">⧉ Duplikuj blok</button>`;
    html+=`<button class="prop-btn-dup" onclick="Editor.copyStyle('${block.id}')">⎘ Kopiuj styl</button>`;
    if(this.copiedStyle?.type===block.type)html+=`<button class="prop-btn-dup" onclick="Editor.pasteStyle('${block.id}')">⎗ Wklej styl</button>`;
    html+=`<button class="prop-btn-del" onclick="Editor.remove('${block.id}')">✕ Usuń blok</button>`;
    html+=`</div>`;
    return html;
  },
 
  // ── Save ──────────────────────────────────────────────────────────────────
  async save(){
    const pub=document.getElementById('toggle-public')?.checked||false;
    const btn=document.getElementById('save-btn');
    try{
      if(btn){btn.textContent='Zapisywanie...';btn.disabled=true;}
      const data=await this._api('PUT',`/characters/${this.charId}/profile`,{
        profile_blocks:{blocks:this.blocks,settings:this.pageSettings},
        profile_public:pub,
      });
      if(data.error)throw new Error(data.error);
      this.dirty=false;
      if(btn){btn.classList.remove('dirty');btn.textContent='Zapisano ✓';btn.disabled=false;}
      setTimeout(()=>{if(btn&&!this.dirty)btn.textContent='Zapisz';},2500);
    }catch(e){
      if(btn){btn.textContent='Zapisz';btn.disabled=false;}
      this._toast('Błąd zapisu: '+e.message,'err');
    }
  },
 
  _toast(msg,type='ok'){
    const t=document.getElementById('toast');if(!t)return;
    t.textContent=msg;t.className='toast toast-'+type+' toast-show';
    setTimeout(()=>t.classList.remove('toast-show'),3000);
  },
};
