/* ============ Szczęśliwy Dzień — główna logika ============ */
const KEY = 'szczesliwy-dzien-v2';
const $ = id => document.getElementById(id);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const z = n => String(n).padStart(2, '0');
const dkey = (d = new Date()) => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const daysAgo = n => { const d = new Date(); d.setHours(12); d.setDate(d.getDate() - n); return d; };
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
const COLORS = ['#ff7a9c', '#ffb86b', '#ffd166', '#9b8cff', '#7fd1b9', '#8aa4ff', '#f78fb3'];

/* ---------- dane ---------- */
const DEFAULT_REM = [
  { id: 'woda1', time: '11:00', on: true, text: '💧 {pet} pije wodę — napijesz się ze mną?' },
  { id: 'oddech', time: '13:30', on: false, text: '🌬️ Minuta oddechu? Zrób sobie małą przerwę.' },
  { id: 'woda2', time: '15:00', on: true, text: '💧 Szklanka wody? {pet} już ma swoją miseczkę!' },
  { id: 'pupil', time: '18:00', on: true, text: '🐾 {pet} tęskni za Tobą!' },
  { id: 'nastroj', time: '20:30', on: true, text: '☀️ Jak minął dzień? Zapisz nastrój i jedną dobrą chwilę.' },
  { id: 'sen', time: '22:30', on: false, text: '🌙 Czas zwolnić. {pet} już ziewa… dobranoc!' }
];
function load() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KEY)); } catch {}
  d = d || {};
  d.days ||= {};
  d.jar ||= [];
  d.myAffirm ||= [];
  d.habits ||= [
    { id: 1, name: '💧 Pić wodę', done: {} },
    { id: 2, name: '🚶‍♀️ Spacer', done: {} },
    { id: 3, name: '📖 Czytanie', done: {} }
  ];
  d.rem ||= { on: false, items: DEFAULT_REM.map(r => ({ ...r })), fired: {} };
  // przenieś wpisy wdzięczności z pierwszej wersji programu
  if (!d.migrated) {
    try {
      const old = JSON.parse(localStorage.getItem('gratitude'));
      if (Array.isArray(old)) old.forEach(g => d.jar.push({ text: g.text, date: g.date, c: pick(COLORS) }));
    } catch {}
    d.migrated = true;
  }
  return d;
}
const data = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {} }
const today = () => (data.days[dkey()] ||= {});

/* ---------- drobiazgi ---------- */
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600);
}
function celebrate(n = 30) {
  const emojis = ['🎉', '💖', '🌸', '✨', '🌈', '☀️', '🦋'];
  for (let i = 0; i < n; i++) {
    const s = el('span', { className: 'confetti', textContent: pick(emojis) });
    s.style.left = Math.random() * 100 + 'vw';
    s.style.animationDelay = Math.random() * .8 + 's';
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 4200);
  }
}
function streakFrom(has) {
  let n = 0, i = has(dkey(daysAgo(0))) ? 0 : 1;
  while (has(dkey(daysAgo(i)))) { n++; i++; }
  return n;
}

/* ---------- nawigacja ---------- */
function go(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('hidden', v.dataset.view !== view));
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.go === view));
  if (view === 'postepy') renderStats();
  if (view === 'sloik') renderJar();
  if (view === 'pupil') renderPet();
  if (view === 'ustawienia') renderSettings();
  window.scrollTo({ top: 0 });
  try { sessionStorage.setItem('view', view); } catch {}
}
$('nav').onclick = e => { const b = e.target.closest('button'); if (b) go(b.dataset.go); };
$('avatar').onclick = () => go('pupil');
$('settingsBtn').onclick = () => go('ustawienia');
$('backBtn').onclick = () => go('dzis');

/* ---------- nagłówek ---------- */
function renderHeader() {
  const h = new Date().getHours();
  $('greeting').textContent = h < 5 ? 'Dobranoc 🌙' : h < 12 ? 'Dzień dobry ☀️' : h < 18 ? 'Miłego popołudnia 🌼' : 'Dobry wieczór ✨';
  $('today').textContent = new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
  $('streak').textContent = streakFrom(k => data.days[k]?.mood);
}

/* ---------- myśl dnia ---------- */
const AFFIRM = [
  'Jesteś wystarczająca dokładnie taka, jaka jesteś.',
  'Radzisz sobie lepiej, niż Ci się wydaje.',
  'Świat jest odrobinę lepszy, bo w nim jesteś.',
  'Odpoczynek to też postęp.',
  'Każdy mały krok się liczy. Twój też.',
  'Twoja wrażliwość to supermoc, nie słabość.',
  'Zasługujesz na te same dobre słowa, które dajesz innym.',
  'Nie musisz być idealna, żeby być wspaniała.',
  'Dzień nie musi być perfekcyjny, żeby był dobry.',
  'Masz prawo mówić „nie” i nadal być dobrym człowiekiem.',
  'To, co dziś czujesz, minie. Ty zostajesz — silniejsza.',
  'Jesteś bohaterką swojej historii — i to piękna historia.',
  'Możesz zacząć od nowa w każdej chwili dnia.',
  'Ktoś dziś pomyślał o Tobie ciepło — na pewno.',
  'Twój uśmiech naprawdę rozjaśnia pokój.',
  'Bądź dla siebie tak czuła, jak dla najlepszej przyjaciółki.',
  'Nie musisz wszystkiego dźwigać sama.',
  'Wolniej też jest do przodu.',
  'Dobre rzeczy już są w drodze do Ciebie.',
  'Jesteś ważna. Po prostu dlatego, że jesteś.'
];
const affPool = () => [...data.myAffirm.map(t => ({ t, mine: true })), ...AFFIRM.map(t => ({ t }))];
let affIdx = null;
function showAffirm() {
  const pool = affPool();
  if (affIdx === null || affIdx >= pool.length) affIdx = [...dkey()].reduce((a, c) => a * 31 + c.charCodeAt(0) >>> 0, 7) % pool.length;
  const a = pool[affIdx];
  $('affirm').replaceChildren(a.t, ...(a.mine ? [el('span', { className: 'tag', textContent: '✍️ Twoja' })] : []));
}
$('nextAffirm').onclick = () => {
  const n = affPool().length;
  affIdx = (affIdx + 1 + Math.floor(Math.random() * (n - 1))) % n; showAffirm();
};
$('addAffirmBtn').onclick = () => { $('affirmForm').classList.toggle('hidden'); $('affirmInput').focus(); };
function addAffirm(inputId) {
  const inp = $(inputId), t = inp.value.trim();
  if (!t) return inp.focus();
  data.myAffirm.unshift(t); save(); inp.value = '';
  affIdx = 0; showAffirm(); renderMyAffirm();
  $('affirmForm').classList.add('hidden');
  toast('Twoja myśl zapisana ✍️ Będzie się pojawiać wśród innych');
}
$('affirmSave').onclick = () => addAffirm('affirmInput');
$('affirmInput').addEventListener('keydown', e => { if (e.key === 'Enter') addAffirm('affirmInput'); });

/* ---------- nastrój ---------- */
const MOODS = [
  { e: '😢', l: 'źle', r: 'Smutek też ma prawo być. Napisz do kogoś bliskiego — nie musisz być z tym sama. 💛' },
  { e: '😔', l: 'słabo', r: 'Przytulam mocno 🤗 Bądź dziś dla siebie łagodna. Może minuta oddechu?' },
  { e: '😐', l: 'tak sobie', r: 'Takie dni też są w porządku. Jedna mała przyjemność może coś zmienić.' },
  { e: '🙂', l: 'dobrze', r: 'Dobrze jest! Wrzuć coś miłego do słoika szczęścia.' },
  { e: '😄', l: 'super', r: 'Cudownie! Zapamiętaj, co sprawiło, że tak się czujesz ✨' }
];
function renderMood() {
  const m = today().mood;
  $('moods').replaceChildren(...MOODS.map((x, i) => {
    const b = el('button', { className: 'tile' + (m === i + 1 ? ' on' : '') }, x.e, el('small', { textContent: x.l }));
    b.onclick = () => {
      const first = !today().mood;
      today().mood = i + 1; save(); renderMood(); renderHeader(); earn('mood', 3);
      if (first && i >= 3) celebrate(15);
    };
    return b;
  }));
  $('moodReply').textContent = m ? MOODS[m - 1].r : 'Wybierz buźkę — zapiszę, jak się czujesz.';
  $('moodNote').classList.toggle('hidden', !m);
  if (document.activeElement !== $('moodNote')) $('moodNote').value = today().note || '';
}
$('moodNote').oninput = e => { today().note = e.target.value; save(); };

/* ---------- małe zadania ---------- */
const IDEAS = [
  'Wypij szklankę wody 💧', 'Wyjdź na 10-minutowy spacer 🚶‍♀️', 'Potańcz do ulubionej piosenki 💃',
  'Napisz miłą wiadomość do kogoś bliskiego 📱', 'Przeciągnij się porządnie 🧘‍♀️', 'Zjedz coś pysznego, powoli 🍓',
  'Otwórz okno i weź 5 głębokich oddechów 🌬️', 'Zrób sobie ulubioną herbatę ☕', 'Posprzątaj jedną małą rzecz 🧺',
  'Obejrzyj zdjęcie z dobrym wspomnieniem 📷', 'Powiedz sobie w lustrze coś miłego 🪞', 'Przeczytaj kilka stron książki 📖',
  'Pogłaszcz zwierzaka 🐶', 'Idź dziś wcześniej spać 😴', 'Posłuchaj ptaków albo deszczu przez 2 minuty 🐦',
  'Pochwal kogoś szczerze 🌟', 'Zrób 10 przysiadów 💪', 'Wyłącz telefon na 30 minut 📵',
  'Narysuj coś — nawet krzywo 🎨', 'Zaplanuj coś miłego na weekend 🗓️', 'Wyjdź na słońce na 5 minut ☀️'
];
function ensureTasks(force) {
  const t = today();
  if (!t.tasks || force) {
    t.tasks = [...IDEAS].sort(() => Math.random() - .5).slice(0, 3).map(x => ({ t: x, done: false }));
    save();
  }
}
function renderTasks() {
  ensureTasks();
  const tasks = today().tasks;
  $('tasks').replaceChildren(...tasks.map(task => {
    const row = el('div', { className: 'task' + (task.done ? ' done' : '') },
      el('span', { className: 'check', textContent: task.done ? '✓' : '' }),
      el('span', { className: 't', textContent: task.t }));
    row.onclick = () => {
      task.done = !task.done; save(); renderTasks();
      if (task.done) earn('task:' + task.t, 2, 3);
      if (tasks.every(x => x.done)) { celebrate(); toast('Wszystkie trzy! Jesteś niesamowita 🎉'); }
    };
    return row;
  }));
  $('taskCount').textContent = `${tasks.filter(x => x.done).length}/3`;
}
$('reroll').onclick = () => { ensureTasks(true); renderTasks(); };

/* ---------- woda ---------- */
function renderWater() {
  const w = today().water || 0;
  $('glasses').replaceChildren(...Array.from({ length: 8 }, (_, i) => {
    const g = el('button', { className: 'glass' + (i < w ? ' full' : ''), ariaLabel: `Szklanka ${i + 1}` });
    g.onclick = () => {
      today().water = i < w ? i : i + 1; save(); renderWater();
      if (today().water > w) earn('water:' + today().water, 1);
      if (today().water === 8) toast('8 szklanek! Twoje ciało dziękuje 💧');
    };
    return g;
  }));
  $('waterCount').textContent = `${w} / 8`;
}

/* ---------- słoik ---------- */
function renderJar() {
  const n = data.jar.length;
  let balls = '';
  data.jar.slice(-42).forEach((m, i) => {
    const col = i % 6, row = Math.floor(i / 6);
    const x = 32 + col * 21 + (row % 2 ? 10 : 0) + ((i * 7) % 5) - 2;
    const y = 178 - row * 18 - ((i * 3) % 4);
    balls += `<circle cx="${Math.min(x, 140)}" cy="${y}" r="9" fill="${m.c || COLORS[i % COLORS.length]}" opacity=".92"/>`;
  });
  $('jar').innerHTML = `
    <rect x="50" y="6" width="70" height="16" rx="6" fill="#ffb86b"/>
    <path d="M44 24 h82 v8 q18 8 18 30 v112 q0 20 -20 20 h-78 q-20 0 -20 -20 v-112 q0 -22 18 -30 z"
      fill="var(--violet-soft)" stroke="var(--line)" stroke-width="3"/>
    ${balls}
    <path d="M40 60 q-6 40 0 100" stroke="#fff" stroke-opacity=".6" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  $('jarCount').textContent = n ? n : '';
  $('jarList').replaceChildren(...(n ? data.jar.slice().reverse().map((m, ri) => {
    const idx = n - 1 - ri;
    const x = el('button', { className: 'x', textContent: '×', title: 'Usuń' });
    x.onclick = () => { if (confirm('Usunąć tę chwilę ze słoika?')) { data.jar.splice(idx, 1); save(); renderJar(); } };
    return el('li', {}, el('span', { className: 'dot', style: `background:${m.c}` }),
      el('div', {}, m.text, el('small', { textContent: m.date })), x);
  }) : [el('li', { className: 'muted', textContent: 'Słoik jest jeszcze pusty — wrzuć pierwszą dobrą chwilę!' })]));
}
function addJar() {
  const text = $('jarInput').value.trim();
  if (!text) return $('jarInput').focus();
  data.jar.push({ text, date: new Date().toLocaleDateString('pl-PL'), c: pick(COLORS) });
  save(); $('jarInput').value = ''; renderJar(); celebrate(18); earn('jar:' + Date.now(), 3, 3);
  toast(pick(['Wrzucone! 💖', 'Piękna chwila ✨', 'Słoik rośnie 🫙']));
}
$('jarAdd').onclick = addJar;
$('jarInput').addEventListener('keydown', e => { if (e.key === 'Enter') addJar(); });
$('jarDraw').onclick = () => {
  const box = $('memory');
  if (!data.jar.length) return toast('Najpierw wrzuć coś do słoika 🙂');
  const m = pick(data.jar);
  box.classList.remove('hidden');
  box.replaceChildren(el('div', { textContent: '„' + m.text + '”' }), el('small', { className: 'muted', textContent: m.date }));
  box.style.animation = 'none'; void box.offsetWidth; box.style.animation = '';
};

/* ---------- nawyki ---------- */
const WD = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'];
function renderHabits() {
  const box = $('habits');
  if (!data.habits.length) { box.replaceChildren(el('p', { className: 'muted', textContent: 'Dodaj swój pierwszy nawyk poniżej 🌱' })); return; }
  box.replaceChildren(...data.habits.map(h => {
    const s = streakFrom(k => h.done[k]);
    const del = el('button', { className: 'x', textContent: '×', title: 'Usuń nawyk' });
    del.onclick = () => { if (confirm(`Usunąć „${h.name}”?`)) { data.habits = data.habits.filter(x => x !== h); save(); renderHabits(); } };
    const week = el('div', { className: 'week' });
    for (let i = 6; i >= 0; i--) {
      const d = daysAgo(i), k = dkey(d);
      const day = el('div', { className: 'day' + (h.done[k] ? ' on' : '') + (i === 0 ? ' today' : '') },
        i === 0 ? 'dziś' : WD[d.getDay()], el('i'));
      day.onclick = () => {
        if (h.done[k]) delete h.done[k]; else h.done[k] = true;
        save(); renderHabits();
        if (h.done[k] && i === 0) earn('habit:' + h.id, 2);
        const ns = streakFrom(x => h.done[x]);
        if (h.done[k] && [3, 7, 14, 21, 30, 50, 100].includes(ns)) { celebrate(); toast(`${ns} dni z rzędu! 🔥`); }
      };
      week.appendChild(day);
    }
    return el('div', { className: 'habit' },
      el('div', { className: 'row' }, el('span', { className: 'name', textContent: h.name }),
        el('span', { className: 'flame', textContent: s ? `🔥 ${s}` : '' }), del),
      week);
  }));
}
function addHabit() {
  const name = $('habitInput').value.trim();
  if (!name) return $('habitInput').focus();
  data.habits.push({ id: Date.now(), name, done: {} });
  save(); $('habitInput').value = ''; renderHabits(); toast('Nowy nawyk dodany 🌿');
}
$('habitAdd').onclick = addHabit;
$('habitInput').addEventListener('keydown', e => { if (e.key === 'Enter') addHabit(); });

/* ---------- oddech ---------- */
const BREATH = {
  spokoj: { name: 'Spokój', hint: '4 · 6', phases: [['Wdech', 4, 1], ['Wydech', 6, .45]] },
  kwadrat: { name: 'Kwadrat', hint: '4 · 4 · 4 · 4', phases: [['Wdech', 4, 1], ['Zatrzymaj', 4, 1], ['Wydech', 4, .45], ['Zatrzymaj', 4, .45]] },
  sen: { name: 'Na sen', hint: '4 · 7 · 8', phases: [['Wdech', 4, 1], ['Zatrzymaj', 7, 1], ['Wydech', 8, .45]] }
};
let bMode = 'spokoj', bMin = 1, bTimer = null;
function renderModes() {
  $('modes').replaceChildren(...Object.entries(BREATH).map(([k, m]) => {
    const b = el('button', { className: k === bMode ? 'on' : '' }, m.name, el('small', { textContent: m.hint }));
    b.onclick = () => { if (!bTimer) { bMode = k; renderModes(); } };
    return b;
  }));
  $('mins').replaceChildren(...[1, 3, 5].map(n => {
    const b = el('button', { className: n === bMin ? 'on' : '', textContent: `${n} min` });
    b.onclick = () => { if (!bTimer) { bMin = n; renderModes(); } };
    return b;
  }));
}
function stopBreath(done) {
  clearInterval(bTimer); bTimer = null;
  const orb = $('orb'); orb.style.transitionDuration = '1s'; orb.style.transform = 'scale(.45)';
  $('orbText').textContent = done ? 'brawo 💛' : 'gotowa?';
  $('breathBtn').textContent = 'Zaczynamy';
  if (done) { toast('Pięknie. Poczuj, jak jest teraz spokojniej 🌿'); earn('breath:' + Date.now(), 3, 2); }
}
$('breathBtn').onclick = () => {
  if (bTimer) return stopBreath(false);
  const m = BREATH[bMode], orb = $('orb');
  const end = Date.now() + bMin * 60000;
  let pi = -1, left = 0;
  $('breathBtn').textContent = 'Zatrzymaj';
  const step = () => {
    if (left <= 0) {
      if (pi === m.phases.length - 1 && Date.now() >= end) return stopBreath(true);
      pi = (pi + 1) % m.phases.length;
      const [, sec, scale] = m.phases[pi];
      left = sec;
      orb.style.transitionDuration = sec + 's';
      orb.style.transform = `scale(${scale})`;
    }
    $('orbText').replaceChildren(m.phases[pi][0], el('b', { textContent: left }));
    left--;
  };
  step();
  bTimer = setInterval(step, 1000);
};

/* ---------- postępy ---------- */
function renderStats() {
  const W = 330, n = 30, bw = W / n;
  const moodCol = ['var(--m1)', 'var(--m2)', 'var(--m3)', 'var(--m4)', 'var(--m5)'];
  let s = '';
  for (let i = 1; i <= 4; i++) s += `<line x1="0" x2="${W}" y1="${120 - i * 22}" y2="${120 - i * 22}" stroke="var(--line)" stroke-dasharray="3 4"/>`;
  for (let i = n - 1; i >= 0; i--) {
    const d = daysAgo(i), m = data.days[dkey(d)]?.mood, x = (n - 1 - i) * bw;
    if (m) s += `<rect x="${x + 2}" y="${120 - m * 22}" width="${bw - 4}" height="${m * 22}" rx="4" fill="${moodCol[m - 1]}"><title>${d.toLocaleDateString('pl-PL')}: ${MOODS[m - 1].l}</title></rect>`;
    else s += `<circle cx="${x + bw / 2}" cy="116" r="2" fill="var(--muted)" opacity=".3"/>`;
    if (i % 7 === 0) s += `<text x="${x + bw / 2}" y="136" font-size="9" text-anchor="middle" fill="var(--muted)">${d.getDate()}.${z(d.getMonth() + 1)}</text>`;
  }
  $('chart').innerHTML = s;
  $('legend').innerHTML = MOODS.map((m, i) => `<span><i class="dot" style="background:${moodCol[i]};margin:0"></i>${m.e} ${m.l}</span>`).join('');

  const days = Object.entries(data.days);
  const moods = days.map(([, v]) => v.mood).filter(Boolean);
  $('sDays').textContent = moods.length;
  $('sJar').textContent = data.jar.length;
  $('sTasks').textContent = days.reduce((a, [, v]) => a + (v.tasks || []).filter(t => t.done).length, 0);
  $('sWater').textContent = days.reduce((a, [, v]) => a + (v.water || 0), 0);
  $('sAvg').textContent = moods.length ? MOODS[Math.round(moods.reduce((a, b) => a + b, 0) / moods.length) - 1].e : '–';
  const keys = days.filter(([, v]) => v.mood).map(([k]) => k).sort();
  let best = 0, cur = 0, prev = null;
  keys.forEach(k => {
    const t = new Date(k + 'T12:00').getTime();
    cur = prev && Math.round((t - prev) / 864e5) === 1 ? cur + 1 : 1;
    best = Math.max(best, cur); prev = t;
  });
  $('sBest').textContent = best;

  const notes = days.filter(([, v]) => v.note && v.note.trim()).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 10);
  $('notes').replaceChildren(...(notes.length ? notes.map(([k, v]) =>
    el('li', {}, el('span', { textContent: v.mood ? MOODS[v.mood - 1].e : '📝' }),
      el('div', {}, v.note, el('small', { textContent: new Date(k + 'T12:00').toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' }) }))))
    : [el('li', { className: 'muted', textContent: 'Po wybraniu nastroju możesz dopisać notatkę — pojawi się tutaj.' })]));
}

/* ---------- ustawienia: przypomnienia ---------- */
const remText = r => r.text.replace('{pet}', data.pet?.name || 'Twój pupil');
const sw = (on, fn) => { const b = el('button', { className: 'switch' + (on ? ' on' : ''), ariaLabel: 'Włącz / wyłącz' }); b.onclick = fn; return b; };
function renderReminders() {
  const R = data.rem;
  $('remMaster').replaceChildren(sw(R.on, toggleReminders));
  $('remList').classList.toggle('hidden', !R.on);
  $('remList').replaceChildren(...R.items.map(r => {
    const t = el('input', { type: 'time', value: r.time });
    t.onchange = () => { r.time = t.value || r.time; save(); };
    return el('div', { className: 'rem' }, sw(r.on, () => { r.on = !r.on; save(); renderReminders(); }),
      el('span', { className: 'txt', textContent: remText(r) }), t);
  }));
  const perm = 'Notification' in window ? Notification.permission : 'brak';
  $('remStatus').textContent = !R.on ? 'Przypomnienia są wyłączone.'
    : perm === 'granted' ? '✅ Powiadomienia włączone. Przyjdą, gdy aplikacja jest otwarta lub niedawno używana.'
    : perm === 'denied' ? '⚠️ Telefon blokuje powiadomienia dla tej strony — przypomnienia pokażą się tylko w aplikacji. Możesz to zmienić w ustawieniach przeglądarki.'
    : perm === 'brak' ? 'ℹ️ Ta przeglądarka nie obsługuje powiadomień — przypomnienia pokażą się w aplikacji. Na iPhonie zainstaluj aplikację na ekranie początkowym.'
    : 'ℹ️ Pozwól na powiadomienia, gdy telefon zapyta.';
}
async function toggleReminders() {
  const R = data.rem;
  R.on = !R.on; save();
  if (R.on && 'Notification' in window && Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch {}
  }
  renderReminders();
  if (R.on) notify(`🐾 ${data.pet?.name || 'Szczęśliwy Dzień'}: będę Ci przypominać o dobrych rzeczach!`, 'test');
}
async function notify(body, tag) {
  if (document.visibilityState === 'visible') toast(body);
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const opts = { body, tag, icon: 'icon-192.png', badge: 'icon-192.png' };
  try {
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    if (reg) await reg.showNotification('Szczęśliwy Dzień', opts);
    else new Notification('Szczęśliwy Dzień', opts);
  } catch {}
}
function checkReminders() {
  const R = data.rem; if (!R.on) return;
  const now = new Date(), k = dkey(now), fired = (R.fired[k] ||= []);
  Object.keys(R.fired).forEach(d => { if (d !== k) delete R.fired[d]; });
  R.items.forEach(r => {
    if (!r.on || fired.includes(r.id)) return;
    const [h, m] = r.time.split(':').map(Number);
    const diff = (now - new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m)) / 60000;
    if (diff >= 0 && diff < 20) { fired.push(r.id); save(); notify(remText(r), r.id); }
  });
}
// Przypomnienia w kalendarzu telefonu przychodzą zawsze, nawet gdy aplikacja jest zamknięta.
$('icsBtn').onclick = () => {
  const on = data.rem.items.filter(r => r.on);
  if (!on.length) return toast('Włącz najpierw choć jedno przypomnienie 🙂');
  const esc = s => s.replace(/\\/g, '\\\\').replace(/[,;]/g, m => '\\' + m).replace(/\n/g, '\\n');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const d = dkey().replace(/-/g, '');
  const url = location.href.split('#')[0];
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Szczesliwy Dzien//PL', 'CALSCALE:GREGORIAN'];
  on.forEach(r => lines.push('BEGIN:VEVENT', `UID:${r.id}-${stamp}@szczesliwy-dzien`, `DTSTAMP:${stamp}`,
    `DTSTART:${d}T${r.time.replace(':', '')}00`, 'DURATION:PT5M', 'RRULE:FREQ=DAILY',
    `SUMMARY:${esc(remText(r))}`, `DESCRIPTION:${esc('Otwórz Szczęśliwy Dzień: ' + url)}`, `URL:${url}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(remText(r))}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT'));
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
  const a = el('a', { href: URL.createObjectURL(blob), download: 'przypomnienia-szczesliwy-dzien.ics' });
  document.body.appendChild(a); a.click(); a.remove();
  toast('Otwórz pobrany plik i wybierz „Dodaj” w kalendarzu 📅');
};

/* ---------- ustawienia: moje myśli, kopia ---------- */
function renderMyAffirm() {
  $('myAffirmList').replaceChildren(...(data.myAffirm.length ? data.myAffirm.map((t, i) => {
    const x = el('button', { className: 'x', textContent: '×', title: 'Usuń' });
    x.onclick = () => { data.myAffirm.splice(i, 1); save(); affIdx = null; showAffirm(); renderMyAffirm(); };
    return el('li', {}, el('span', { textContent: '✍️' }), el('div', { textContent: t }), x);
  }) : [el('li', { className: 'muted', textContent: 'Nie masz jeszcze własnych myśli. Dopisz pierwszą!' })]));
}
$('myAffirmAdd').onclick = () => addAffirm('myAffirmInput');
$('myAffirmInput').addEventListener('keydown', e => { if (e.key === 'Enter') addAffirm('myAffirmInput'); });
function renderSettings() { renderReminders(); renderMyAffirm(); }

$('exportBtn').onclick = () => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: `szczesliwy-dzien-${dkey()}.json` });
  document.body.appendChild(a); a.click(); a.remove();
  toast('Kopia zapisana 💾');
};
$('importBtn').onclick = () => $('importFile').click();
$('importFile').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!d.days || !Array.isArray(d.jar)) throw 0;
    if (!confirm('Zastąpić obecne dane danymi z kopii?')) return;
    Object.assign(data, d); save(); location.reload();
  } catch { toast('To nie wygląda na kopię z tej aplikacji 🤔'); }
  e.target.value = '';
};

/* ---------- start ---------- */
function renderAll() {
  renderHeader(); showAffirm(); renderMood(); renderTasks(); renderWater();
  renderJar(); renderHabits(); renderModes(); renderPet();
}
function start() {
  renderAll(); save();
  try { const v = sessionStorage.getItem('view'); if (v) go(v); } catch {}
  let lastDay = dkey();
  setInterval(() => {
    if (dkey() !== lastDay) { lastDay = dkey(); affIdx = null; renderAll(); }
    else if (!document.querySelector('[data-view=pupil]').classList.contains('hidden')) renderPet();
    checkReminders();
  }, 30000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { checkReminders(); renderAvatar(); } });
  checkReminders();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}
