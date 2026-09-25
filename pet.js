/* ============ Pupil: wygląd, opieka, sklepik i mini-gra ============ */
const PET_TYPES = { kot: 'Kotek', krolik: 'Króliczek', mis: 'Miś', piesek: 'Piesek' };
const PET_COLORS = ['#ffb3c7', '#ffd59e', '#b8e0d2', '#c9b8ff', '#f2c9a0', '#d6d6e0'];
const INK = '#3b2f35';
const PINK = '#ff9fb8';
let adoptType = 'kot', adoptColor = PET_COLORS[0], shopSlot = 'head';

const SHOP = [
  { id: 'kokardka', slot: 'head', name: 'Kokardka', lvl: 3 },
  { id: 'kwiatek', slot: 'head', name: 'Kwiatek', lvl: 6 },
  { id: 'korona', slot: 'head', name: 'Korona', lvl: 10 },
  { id: 'urodziny', slot: 'head', name: 'Czapeczka', price: 8 },
  { id: 'czapka', slot: 'head', name: 'Czapka zimowa', price: 10 },
  { id: 'kapelusz', slot: 'head', name: 'Kapelusz', price: 12 },
  { id: 'okulary', slot: 'eyes', name: 'Okularki', price: 6 },
  { id: 'slonce', slot: 'eyes', name: 'Przeciwsłoneczne', price: 9 },
  { id: 'serca', slot: 'eyes', name: 'Serduszka', price: 10 },
  { id: 'muszka', slot: 'neck', name: 'Muszka', price: 5 },
  { id: 'apaszka', slot: 'neck', name: 'Apaszka', price: 6 },
  { id: 'szalik', slot: 'neck', name: 'Szalik', price: 7 },
  { id: 'pokoj', slot: 'bg', name: 'Pokój', price: 12 },
  { id: 'ogrod', slot: 'bg', name: 'Ogród', price: 15 },
  { id: 'plaza', slot: 'bg', name: 'Plaża', price: 18 },
  { id: 'kosmos', slot: 'bg', name: 'Kosmos', price: 22 }
];
const SLOTS = { head: 'Głowa', eyes: 'Oczy', neck: 'Szyja', bg: 'Tła' };

/* ---------- rysowanie ---------- */
const WEAR = {
  kokardka: `<g transform="translate(140 72)"><path d="M0 0 L-18 -12 L-18 12 Z" fill="#ff5c8a"/><path d="M0 0 L18 -12 L18 12 Z" fill="#ff5c8a"/><circle r="6" fill="#ff85a7"/></g>`,
  kwiatek: `<g transform="translate(62 74)">${[0, 72, 144, 216, 288].map(a => `<circle cx="${(Math.cos(a * Math.PI / 180) * 9).toFixed(1)}" cy="${(Math.sin(a * Math.PI / 180) * 9).toFixed(1)}" r="7" fill="#fff" stroke="#ffc2d4" stroke-width="2"/>`).join('')}<circle r="6" fill="#ffd166"/></g>`,
  korona: `<path d="M74 68 L78 42 L90 56 L100 36 L110 56 L122 42 L126 68 Z" fill="#ffd166" stroke="#f0a500" stroke-width="3" stroke-linejoin="round"/><circle cx="100" cy="58" r="4" fill="#ff7a9c"/>`,
  urodziny: `<g transform="rotate(12 100 70)"><path d="M82 72 L100 20 L118 72 Z" fill="#9b8cff"/><path d="M88 54 L112 54 M93 40 L107 40" stroke="#ffd166" stroke-width="5"/><circle cx="100" cy="20" r="7" fill="#ff7a9c"/></g>`,
  czapka: `<path d="M58 82 Q58 34 100 32 Q142 34 142 82 Z" fill="#7fb3ff"/><path d="M78 40 L78 76 M100 32 L100 76 M122 40 L122 76" stroke="#a8ccff" stroke-width="5"/><rect x="54" y="72" width="92" height="18" rx="9" fill="#4b8cf0"/><circle cx="100" cy="28" r="11" fill="#fff"/>`,
  kapelusz: `<path d="M70 72 Q70 34 100 34 Q130 34 130 72 Z" fill="#f5d998"/><rect x="70" y="56" width="60" height="10" fill="#ff7a9c"/><ellipse cx="100" cy="72" rx="64" ry="12" fill="#f0cf86"/>`,
  okulary: `<g stroke="${INK}" stroke-width="3.5" fill="#fff" fill-opacity=".18"><circle cx="80" cy="110" r="14"/><circle cx="120" cy="110" r="14"/></g><path d="M94 109 q6 -5 12 0" stroke="${INK}" stroke-width="3.5" fill="none"/>`,
  slonce: `<rect x="63" y="100" width="34" height="21" rx="9" fill="${INK}"/><rect x="103" y="100" width="34" height="21" rx="9" fill="${INK}"/><path d="M97 106 h6" stroke="${INK}" stroke-width="4"/><path d="M69 105 l8 0 M109 105 l8 0" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/>`,
  serca: [80, 120].map(x => `<path transform="translate(${x} 108) scale(1.45)" d="M0 8 C-14 -2 -10 -14 0 -7 C10 -14 14 -2 0 8 Z" fill="#ff4d7e"/>`).join('') + `<path d="M95 107 h10" stroke="#ff4d7e" stroke-width="3"/>`,
  muszka: `<g transform="translate(100 148)"><path d="M0 0 L-18 -10 L-18 10 Z" fill="#7c6cff"/><path d="M0 0 L18 -10 L18 10 Z" fill="#7c6cff"/><circle r="5" fill="#a99dff"/></g>`,
  apaszka: `<path d="M60 140 Q100 154 140 140 L100 178 Z" fill="#2fbf94"/><circle cx="92" cy="152" r="3" fill="#fff"/><circle cx="108" cy="152" r="3" fill="#fff"/><circle cx="100" cy="164" r="3" fill="#fff"/>`,
  szalik: `<path d="M42 138 Q100 164 158 138 L160 154 Q100 180 40 154 Z" fill="#ff6b6b"/><path d="M60 146 L62 162 M140 146 L138 162" stroke="#ffb0b0" stroke-width="5"/><rect x="118" y="152" width="18" height="34" rx="6" fill="#ff6b6b" transform="rotate(-10 127 152)"/>`
};

function petSVG(t, c, mood, lvl, wear = {}) {
  const s = Math.min(.8 + (lvl - 1) * .025, 1);
  let ears = '', front = '';
  if (t === 'kot') ears = `<path d="M50 94 L58 30 L98 70 Z" fill="${c}"/><path d="M150 94 L142 30 L102 70 Z" fill="${c}"/>
    <path d="M62 78 L65 48 L84 68 Z" fill="${PINK}" opacity=".6"/><path d="M138 78 L135 48 L116 68 Z" fill="${PINK}" opacity=".6"/>`;
  if (t === 'krolik') ears = [[76, -10], [124, 10]].map(([x, r]) => `<g transform="rotate(${r} ${x} 70)">
    <ellipse cx="${x}" cy="38" rx="15" ry="40" fill="${c}"/><ellipse cx="${x}" cy="42" rx="7" ry="28" fill="${PINK}" opacity=".6"/></g>`).join('');
  if (t === 'mis') ears = [56, 144].map(x => `<circle cx="${x}" cy="72" r="22" fill="${c}"/><circle cx="${x}" cy="72" r="11" fill="${PINK}" opacity=".5"/>`).join('');
  if (t === 'piesek') front = [[44, 18], [156, -18]].map(([x, r]) => `<g transform="rotate(${r} ${x} 104)">
    <ellipse cx="${x}" cy="108" rx="17" ry="34" fill="${c}"/><ellipse cx="${x}" cy="108" rx="17" ry="34" fill="#000" opacity=".12"/></g>`).join('');

  const eye = x => ({
    happy: `<path d="M${x - 10} 112 q10 -12 20 0" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>`,
    sleep: `<path d="M${x - 10} 110 q10 9 20 0" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    normal: `<circle cx="${x}" cy="110" r="8" fill="${INK}"/><circle cx="${x + 3}" cy="107" r="3" fill="#fff"/>`,
    sad: `<circle cx="${x}" cy="111" r="8" fill="${INK}"/><circle cx="${x + 3}" cy="108" r="3" fill="#fff"/>`
  })[mood];
  const brows = mood === 'sad' ? `<path d="M70 97 L88 92 M112 92 L130 97" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>` : '';
  const mouth = {
    happy: `<path d="M89 127 q11 16 22 0 z" fill="${INK}"/><path d="M95 133 q5 4 10 0" fill="#ff7a9c"/>`,
    normal: `<path d="M93 128 q7 7 14 0" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
    sad: `<path d="M93 133 q7 -6 14 0" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
    sleep: `<ellipse cx="100" cy="130" rx="4" ry="3" fill="${INK}"/>`
  }[mood];
  const whisk = t === 'kot' ? `<path d="M52 118 l-22 -4 M52 124 l-22 4 M148 118 l22 -4 M148 124 l22 4" stroke="${INK}" stroke-width="2" opacity=".5" stroke-linecap="round"/>` : '';
  const zzz = mood === 'sleep' ? `<text x="150" y="58" font-size="22" font-weight="800" fill="${INK}" opacity=".45">z</text><text x="166" y="38" font-size="15" font-weight="800" fill="${INK}" opacity=".35">z</text>` : '';
  const w = k => (wear[k] && WEAR[wear[k]]) || '';
  return `<svg viewBox="0 0 200 200" width="200" height="200" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="100" cy="192" rx="${58 * s}" ry="7" fill="#000" opacity=".08"/>
    <g transform="translate(100 190) scale(${s}) translate(-100 -190)">
      ${ears}
      <ellipse cx="100" cy="122" rx="66" ry="60" fill="${c}"/>
      <ellipse cx="100" cy="150" rx="38" ry="28" fill="#fff" opacity=".45"/>
      ${front}
      <ellipse cx="72" cy="180" rx="17" ry="9" fill="${c}"/><ellipse cx="128" cy="180" rx="17" ry="9" fill="${c}"/>
      <ellipse cx="72" cy="180" rx="17" ry="9" fill="#000" opacity=".06"/><ellipse cx="128" cy="180" rx="17" ry="9" fill="#000" opacity=".06"/>
      ${w('neck')}
      <circle cx="64" cy="126" r="9" fill="#ff7a9c" opacity=".35"/><circle cx="136" cy="126" r="9" fill="#ff7a9c" opacity=".35"/>
      ${eye(80)}${eye(120)}${brows}
      <ellipse cx="100" cy="120" rx="5" ry="3.5" fill="${t === 'kot' ? '#ff7a9c' : INK}"/>
      ${mouth}${whisk}${w('eyes')}${w('head')}
    </g>${zzz}</svg>`;
}

function sceneSVG(bg) {
  const wrap = inner => `<svg class="scene" viewBox="0 0 360 270" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
  switch (bg) {
    case 'pokoj': return wrap(`<rect width="360" height="270" fill="#ffeede"/><rect y="200" width="360" height="70" fill="#e9c9a6"/>
      <path d="M0 200 H360" stroke="#d9b48c" stroke-width="4"/>
      <rect x="30" y="50" width="86" height="76" rx="8" fill="#bfe3ff" stroke="#fff" stroke-width="7"/><path d="M73 50 V126 M30 88 H116" stroke="#fff" stroke-width="5"/>
      <rect x="262" y="60" width="62" height="50" rx="6" fill="#fff"/><path transform="translate(293 88) scale(1.1)" d="M0 8 C-14 -2 -10 -14 0 -7 C10 -14 14 -2 0 8 Z" fill="#ff7a9c"/>
      <ellipse cx="180" cy="238" rx="120" ry="18" fill="#ffb3c7" opacity=".7"/><rect x="300" y="150" width="30" height="50" rx="6" fill="#9fd8b3"/><circle cx="315" cy="140" r="20" fill="#7cc996"/>`);
    case 'ogrod': return wrap(`<defs><linearGradient id="sky1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#aee0ff"/><stop offset="1" stop-color="#e9f7ff"/></linearGradient></defs>
      <rect width="360" height="270" fill="url(#sky1)"/><circle cx="300" cy="55" r="26" fill="#ffd166"/>
      <ellipse cx="80" cy="235" rx="170" ry="70" fill="#9be29b"/><ellipse cx="290" cy="240" rx="170" ry="65" fill="#86d68c"/>
      <rect y="225" width="360" height="45" fill="#7fcf86"/>
      ${[[30, 215, '#ff7a9c'], [60, 228, '#ffd166'], [300, 218, '#9b8cff'], [330, 232, '#ff7a9c'], [270, 236, '#fff']].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="7" fill="${c}"/><circle cx="${x}" cy="${y}" r="2.5" fill="#ffd166"/>`).join('')}
      <ellipse cx="70" cy="60" rx="30" ry="12" fill="#fff" opacity=".9"/><ellipse cx="95" cy="54" rx="22" ry="12" fill="#fff" opacity=".9"/>`);
    case 'plaza': return wrap(`<rect width="360" height="270" fill="#aee3ff"/><circle cx="70" cy="60" r="28" fill="#ffd166"/>
      <rect y="150" width="360" height="50" fill="#56bfee"/><path d="M0 160 q15 -6 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0" stroke="#fff" stroke-width="3" fill="none" opacity=".6"/>
      <path d="M0 196 Q180 176 360 196 V270 H0 Z" fill="#f7dca0"/>
      <path d="M300 130 L300 230" stroke="#b07a4a" stroke-width="5"/><path d="M250 132 Q300 88 350 132 Z" fill="#ff7a9c"/><path d="M283 132 Q300 96 317 132" fill="#fff"/>
      <circle cx="40" cy="238" r="7" fill="#ffb3c7"/><path d="M60 250 l6 -10 l6 10 z" fill="#ffc2a6"/>`);
    case 'kosmos': return wrap(`<rect width="360" height="270" fill="#1d1840"/>
      ${[[30, 30], [80, 70], [140, 20], [200, 60], [320, 110], [40, 140], [110, 120], [250, 30], [345, 40], [180, 110], [20, 90], [290, 150]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${1 + i % 3 * .7}" fill="#fff" opacity="${.5 + (i % 2) * .4}"/>`).join('')}
      <circle cx="290" cy="64" r="26" fill="#ff9fb8"/><ellipse cx="290" cy="64" rx="42" ry="9" fill="none" stroke="#ffd166" stroke-width="4" transform="rotate(-18 290 64)"/>
      <circle cx="60" cy="50" r="14" fill="#fff4c2"/><circle cx="54" cy="46" r="3" fill="#e9dc9c"/>
      <ellipse cx="180" cy="262" rx="210" ry="48" fill="#6c5ce7"/><ellipse cx="120" cy="250" rx="14" ry="5" fill="#8e80ff"/><ellipse cx="250" cy="256" rx="10" ry="4" fill="#8e80ff"/>`);
    default: return wrap(`<circle cx="180" cy="250" r="190" fill="var(--pink-soft)"/><circle cx="60" cy="40" r="4" fill="var(--pink)" opacity=".3"/><circle cx="310" cy="70" r="6" fill="var(--violet)" opacity=".25"/><circle cx="290" cy="30" r="3" fill="var(--peach)" opacity=".4"/>`);
  }
}

/* ---------- stan ---------- */
function petLevel(xp) {
  let lvl = 1, rest = xp;
  while (rest >= lvl * 10) { rest -= lvl * 10; lvl++; }
  return { lvl, rest, need: lvl * 10 };
}
const stageName = l => l < 3 ? 'maluszek' : l < 6 ? 'brzdąc' : l < 10 ? 'podrostek' : 'dorosły przyjaciel';
const isNight = () => { const h = new Date().getHours(); return h >= 22 || h < 7; };

function petFix() {
  const p = data.pet; if (!p) return;
  p.owned ||= []; p.wear ||= {}; p.best ||= 0; p.earned ||= {};
  // ozdoby za poziomy — dawniej zakładały się same
  const lvl = petLevel(p.xp).lvl;
  if (!p.wearInit) {
    p.wearInit = true;
    const best = lvl >= 10 ? 'korona' : lvl >= 6 ? 'kwiatek' : lvl >= 3 ? 'kokardka' : null;
    if (best && !p.wear.head) p.wear.head = best;
  }
}
const owns = (p, it) => it.lvl ? petLevel(p.xp).lvl >= it.lvl : p.owned.includes(it.id);

function petTick() {
  const p = data.pet; if (!p) return;
  const now = Date.now(), mins = (now - (p.last || now)) / 60000;
  const slow = isNight() ? .4 : 1;
  p.food = Math.max(10, p.food - mins / 36 * slow);
  p.fun = Math.max(10, p.fun - mins / 30 * slow);
  p.last = now;
  const keep = new Set([0, 1, 2].map(i => dkey(daysAgo(i))));
  Object.keys(p.earned).forEach(k => { if (!keep.has(k)) delete p.earned[k]; });
}
function petMood() {
  const p = data.pet;
  if (isNight()) return 'sleep';
  if (p.food < 30 || p.fun < 25) return 'sad';
  if (p.food > 60 && p.fun > 55) return 'happy';
  return 'normal';
}
const petNow = (mood, wear) => { const p = data.pet; return petSVG(p.type, p.color, mood || petMood(), petLevel(p.xp).lvl, wear || p.wear); };

function petSay(text) {
  const p = data.pet;
  if (!text) {
    const w = today().water || 0, h = new Date().getHours();
    text = isNight() ? 'Zzz… 💤 Śpię. Ty też odpocznij, dobranoc!'
      : p.food < 30 ? 'Burczy mi w brzuszku… Zadbasz dziś o siebie, żeby zdobyć serduszka? 🥺'
      : p.fun < 25 ? 'Trochę się nudzę… Pobawimy się? 🎈'
      : !today().mood ? 'Jak się dziś czujesz? Opowiesz mi w zakładce Dziś? ☀️'
      : w < 4 && h >= 11 ? 'Napijemy się wody? Ja już mam swoją miseczkę! 💧'
      : pick(['Cieszę się, że jesteś! 💗', 'Jesteś moją ulubioną osobą na świecie 🌍', 'Dziękuję, że dbasz o mnie — i o siebie też!',
        'Przytulas? 🤗', 'Dziś jest dobry dzień na coś miłego ✨', 'Duma mnie rozpiera, że Cię mam!', 'Pamiętaj: jesteś wspaniała 🌸',
        'Zagramy w truskawki? 🍓']);
  }
  $('petSay').textContent = text;
}
// Pokazuje zdanie przez chwilę, potem pupil wraca do zwykłych tekstów.
function sayFor(text, ms = 3500) {
  sayFor.last = text; petSay(text);
  clearTimeout(sayFor.t); sayFor.t = setTimeout(() => { sayFor.last = null; if (data.pet) petSay(); }, ms);
}
function floatAt(box, emoji, n = 1) {
  for (let i = 0; i < n; i++) {
    const s = el('span', { className: 'float', textContent: emoji });
    s.style.left = 30 + Math.random() * 40 + '%';
    s.style.top = 35 + Math.random() * 30 + '%';
    s.style.animationDelay = i * .12 + 's';
    box.appendChild(s);
    setTimeout(() => s.remove(), 1800);
  }
}
function heartPop(n) {
  const nb = document.querySelector('[data-go=pupil]').getBoundingClientRect();
  const s = el('span', { className: 'float', textContent: `+${n} 💗` });
  Object.assign(s.style, { position: 'fixed', left: nb.left + nb.width / 2 - 22 + 'px', top: nb.top - 12 + 'px', fontSize: '1rem', fontWeight: 800 });
  document.body.appendChild(s);
  setTimeout(() => s.remove(), 1600);
}
function gainXp(n) {
  const p = data.pet, before = petLevel(p.xp).lvl;
  p.xp += n;
  const after = petLevel(p.xp).lvl;
  if (after > before) {
    celebrate();
    const gift = { 3: ' Nowa ozdoba w sklepiku: kokardka 🎀', 6: ' Nowa ozdoba: kwiatek 🌼', 10: ' Nowa ozdoba: korona 👑' }[after] || '';
    toast(`${p.name} ma teraz poziom ${after}!${gift}`);
  }
}
// Serduszka za dbanie o siebie. Każda rzecz liczy się raz dziennie (cap = dzienny limit dla danego rodzaju).
function earn(key, n, cap) {
  const p = data.pet; if (!p || n <= 0) return false;
  const got = (p.earned[dkey()] ||= []);
  if (got.includes(key)) return false;
  const kind = key.split(':')[0];
  if (cap && got.filter(x => x.split(':')[0] === kind).length >= cap) return false;
  got.push(key); p.hearts += n; gainXp(n); save(); heartPop(n); renderAvatar();
  return true;
}

/* ---------- ekran pupila ---------- */
function renderAvatar() {
  const a = $('avatar');
  if (!data.pet) { a.innerHTML = '🐾'; return; }
  a.innerHTML = petNow();
}
function renderPet() {
  const p = data.pet;
  $('adopt').classList.toggle('hidden', !!p);
  $('petCard').classList.toggle('hidden', !p);
  renderAvatar();
  if (!p) return renderAdopt();
  petFix(); petTick(); save();
  const { lvl, rest, need } = petLevel(p.xp), mood = petMood();
  const box = $('petBox');
  box.className = 'petbox' + (mood === 'sleep' ? ' sleep' : '');
  box.innerHTML = sceneSVG(p.wear.bg) + petNow(mood).replace('<svg ', '<svg class="pet" ');
  box.prepend(el('div', { className: 'bubble', id: 'petSay' }));
  box.querySelector('.pet').onclick = stroke;
  $('petName').textContent = p.name;
  $('petLvl').textContent = `${PET_TYPES[p.type]} · poziom ${lvl} · ${stageName(lvl)}`;
  $('foodBar').style.width = p.food + '%'; $('foodTxt').textContent = Math.round(p.food) + '%';
  $('funBar').style.width = p.fun + '%'; $('funTxt').textContent = Math.round(p.fun) + '%';
  $('xpBar').style.width = rest / need * 100 + '%'; $('xpTxt').textContent = `${rest} / ${need}`;
  $('heartCount').textContent = p.hearts;
  $('bestScore').textContent = p.best ? `Twój rekord: ${p.best} 🍓` : 'Łap owoce i zdobywaj serduszka';
  petSay(sayFor.last || undefined);
  renderShop();
}
function jiggle() { const s = $('petBox').querySelector('.pet'); s.classList.remove('jiggle'); void s.getBoundingClientRect(); s.classList.add('jiggle'); }
function care(cost, stat, amount, emoji, line) {
  const p = data.pet;
  if (isNight()) return sayFor('Ćśś… śpię 😴 Wróć do mnie rano!');
  if (p[stat] >= 98) return sayFor(stat === 'food' ? 'Brzuszek pełny! 😋 Może później?' : 'Już mam mnóstwo radości! 🥰');
  if (p.hearts < cost) return sayFor('Brakuje serduszek 💗 Zadbaj o siebie w zakładce Dziś — wtedy je zdobędziesz!');
  p.hearts -= cost; p[stat] = Math.min(100, p[stat] + amount);
  gainXp(1); save(); renderPet(); jiggle();
  floatAt($('petBox'), pick(emoji), 3); sayFor(pick(line));
}
$('feedBtn').onclick = () => care(2, 'food', 30, ['🍓', '🥕', '🍪', '🐟', '🍎', '🧁'], ['Mniam! Dziękuję 😋', 'Pycha! Ty też coś zjedz 🍓', 'Mniam mniam mniam 💗']);
$('playBtn').onclick = () => care(1, 'fun', 25, ['🎈', '⚽', '🧶', '🪁', '🫧'], ['Hura! Jeszcze raz! 🎈', 'Ale zabawa! 🥳', 'Kocham się z Tobą bawić 💗']);
function stroke() {
  const p = data.pet;
  p.fun = Math.min(100, p.fun + 2); save(); renderPet(); jiggle();
  floatAt($('petBox'), '💗', 2);
  sayFor(isNight() ? 'Mrrr… 💤 (mruczy przez sen)' : pick(['Mrrr… jak miło 🥰', 'Hihi, łaskocze! 😆', 'Jeszcze, jeszcze! 💗', 'Kocham Cię! 💕']), 2500);
}
$('strokeBtn').onclick = stroke;

function renderAdopt() {
  $('pickType').replaceChildren(...Object.entries(PET_TYPES).map(([k, name]) => {
    const b = el('button', { className: k === adoptType ? 'on' : '' });
    b.innerHTML = petSVG(k, adoptColor, 'happy', 1) + name;
    b.onclick = () => { adoptType = k; renderAdopt(); };
    return b;
  }));
  $('pickColor').replaceChildren(...PET_COLORS.map(c => {
    const b = el('button', { className: c === adoptColor ? 'on' : '', ariaLabel: 'Kolor' });
    b.style.background = c;
    b.onclick = () => { adoptColor = c; renderAdopt(); };
    return b;
  }));
}
$('adoptBtn').onclick = () => {
  const name = $('petNameInput').value.trim();
  if (!name) { $('petNameInput').focus(); return toast('Nadaj mu imię 🙂'); }
  data.pet = { name, type: adoptType, color: adoptColor, born: dkey(), xp: 0, hearts: 5, food: 70, fun: 70, last: Date.now(), earned: {}, owned: [], wear: {}, best: 0, wearInit: true };
  save(); renderPet(); celebrate();
  sayFor(`Cześć! Mam na imię ${name}! Na start dostajesz 5 serduszek 💗`, 5000);
};

/* ---------- sklepik ---------- */
function renderShop() {
  const p = data.pet; if (!p) return;
  $('shopSeg').replaceChildren(...Object.entries(SLOTS).map(([k, name]) => {
    const b = el('button', { className: k === shopSlot ? 'on' : '', textContent: name });
    b.onclick = () => { shopSlot = k; renderShop(); };
    return b;
  }));
  const lvl = petLevel(p.xp).lvl;
  $('shop').replaceChildren(...SHOP.filter(it => it.slot === shopSlot).map(it => {
    const have = owns(p, it), wearing = p.wear[it.slot] === it.id;
    const prev = el('div', { className: 'prev' });
    prev.innerHTML = it.slot === 'bg' ? sceneSVG(it.id) + petNow('happy', { ...p.wear, bg: it.id })
      : petNow('happy', { ...p.wear, [it.slot]: it.id });
    const price = el('span', {
      className: 'price' + (wearing ? ' wear' : have ? ' own' : ''),
      textContent: wearing ? '✓ Założone' : have ? 'Załóż' : it.lvl ? `🔒 poziom ${it.lvl}` : `${it.price} 💗`
    });
    const tile = el('button', { className: 'item' + (it.lvl && lvl < it.lvl ? ' locked' : '') }, prev, it.name, el('br'), price);
    tile.onclick = () => {
      if (wearing) { delete p.wear[it.slot]; save(); renderPet(); return; }
      if (!have) {
        if (it.lvl) return toast(`Odblokujesz na poziomie ${it.lvl} ⭐`);
        if (p.hearts < it.price) return toast(`Brakuje ${it.price - p.hearts} 💗 — zadbaj o siebie, a uzbierasz!`);
        p.hearts -= it.price; p.owned.push(it.id); celebrate(14); toast(`Kupione: ${it.name}! 🛍️`);
      }
      p.wear[it.slot] = it.id; save(); renderPet(); jiggle();
      sayFor(pick(['Jak wyglądam? 😍', 'Ale piękne! Dziękuję! 💗', 'Czuję się wyjątkowo ✨']));
    };
    return tile;
  }));
}

/* ---------- mini-gra: łapanie truskawek ---------- */
const FRUITS = [['🍓', 1, 50], ['🍒', 1, 20], ['🫐', 1, 18], ['🍑', 2, 8], ['⭐', 3, 4]];
function startGame() {
  const p = data.pet;
  if (isNight()) return sayFor('Ćśś… śpię 😴 Zagramy rano!');
  const wrap = el('div', { className: 'game' });
  const cvs = el('canvas');
  const scoreChip = el('span', { className: 'chip', textContent: '🍓 0' });
  const timeChip = el('span', { className: 'chip', textContent: '⏱ 30' });
  const close = el('button', { className: 'chip', textContent: '✕' });
  wrap.append(el('div', { className: 'game-top' }, scoreChip, timeChip, close), cvs);
  document.body.appendChild(wrap);
  const ctx = cvs.getContext('2d');
  let W, H, dpr;
  const resize = () => {
    dpr = window.devicePixelRatio || 1; W = cvs.clientWidth; H = cvs.clientHeight;
    cvs.width = W * dpr; cvs.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize(); window.addEventListener('resize', resize);

  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(petNow('happy', { ...p.wear, bg: null }));
  const size = Math.min(110, W * .28);
  let px = W / 2, target = W / 2, items = [], score = 0, spawn = 0, t0 = performance.now(), last = t0, over = false, pops = [];
  const LEN = 30;
  const move = x => { target = Math.max(size / 2, Math.min(W - size / 2, x)); };
  const onPtr = e => move((e.touches ? e.touches[0].clientX : e.clientX) - cvs.getBoundingClientRect().left);
  cvs.addEventListener('pointerdown', onPtr); cvs.addEventListener('pointermove', onPtr);
  cvs.addEventListener('touchmove', e => { e.preventDefault(); onPtr(e); }, { passive: false });
  const onKey = e => { if (e.key === 'ArrowLeft') move(target - 40); if (e.key === 'ArrowRight') move(target + 40); };
  window.addEventListener('keydown', onKey);
  const cleanup = () => { over = true; window.removeEventListener('resize', resize); window.removeEventListener('keydown', onKey); wrap.remove(); renderPet(); };
  close.onclick = cleanup;

  const choose = () => { let r = Math.random() * 100; for (const f of FRUITS) { if ((r -= f[2]) < 0) return f; } return FRUITS[0]; };
  function frame(now) {
    if (over) return;
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const el_ = (now - t0) / 1000, left = Math.max(0, LEN - el_);
    const speed = 170 + el_ * 9;
    spawn -= dt;
    if (spawn <= 0) { const f = choose(); items.push({ x: 24 + Math.random() * (W - 48), y: -30, e: f[0], v: f[1], s: speed * (.85 + Math.random() * .3), r: Math.random() * 6 }); spawn = Math.max(.32, .8 - el_ * .015); }
    px += (target - px) * Math.min(1, dt * 14);
    const py = H - size - 24;
    ctx.clearRect(0, 0, W, H);
    // trawa
    ctx.fillStyle = '#9be29b'; ctx.beginPath(); ctx.ellipse(W / 2, H + 30, W * .8, 70, 0, 0, Math.PI * 2); ctx.fill();
    ctx.font = '34px system-ui, "Apple Color Emoji", "Segoe UI Emoji"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    items = items.filter(it => {
      it.y += it.s * dt;
      if (it.y > py + 10 && it.y < py + size * .6 && Math.abs(it.x - px) < size * .5) {
        score += it.v; pops.push({ x: it.x, y: it.y, t: 0, txt: '+' + it.v });
        scoreChip.textContent = '🍓 ' + score;
        return false;
      }
      if (it.y > H + 40) return false;
      ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(Math.sin(now / 300 + it.r) * .25); ctx.fillText(it.e, 0, 0); ctx.restore();
      return true;
    });
    ctx.font = '800 20px "Plus Jakarta Sans", system-ui'; ctx.fillStyle = '#ff5d8f';
    pops = pops.filter(pp => { pp.t += dt; ctx.globalAlpha = 1 - pp.t; ctx.fillText(pp.txt, pp.x, pp.y - pp.t * 60); ctx.globalAlpha = 1; return pp.t < 1; });
    if (img.complete) ctx.drawImage(img, px - size / 2, py, size, size);
    timeChip.textContent = '⏱ ' + Math.ceil(left);
    if (left <= 0) return finish();
    requestAnimationFrame(frame);
  }
  function finish() {
    over = true;
    const hearts = Math.min(8, Math.floor(score / 4));
    const record = score > p.best;
    if (record) p.best = score;
    p.fun = Math.min(100, p.fun + 25);
    const got = earn('game:' + Date.now(), hearts, 2);
    gainXp(1); save();
    const msg = hearts === 0 ? 'Zabawa się liczy! Spróbuj jeszcze raz 🎈'
      : got ? `Zdobywasz ${hearts} 💗` : 'Dziś już zdobyłaś serduszka z gry — ale radość pupila rośnie! 🎈';
    const box = el('div', { className: 'game-over' }, el('div', { className: 'card' },
      el('p', { className: 'eyebrow', textContent: record ? '🏆 Nowy rekord!' : 'Koniec gry' }),
      el('p', { className: 'score', textContent: score }),
      el('p', { className: 'muted', textContent: `złapanych punktów · ${msg}` }),
      el('div', { className: 'row', style: 'justify-content:center' },
        Object.assign(el('button', { className: 'btn', textContent: 'Jeszcze raz' }), { onclick: () => { cleanup(); startGame(); } }),
        Object.assign(el('button', { className: 'btn soft', textContent: 'Wróć' }), { onclick: cleanup }))));
    wrap.appendChild(box);
    if (record || hearts >= 5) celebrate(20);
  }
  requestAnimationFrame(frame);
}
$('gameBtn').onclick = startGame;
