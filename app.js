'use strict';
(() => {
// ================================================================
//  Stałe
// ================================================================
const KEY = 'listo-data-v2';
var seeded = false; // true, gdy na tym urządzeniu nie było jeszcze danych (świeży start)
const PL_DAYS = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
const PL_DAYS_SHORT = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];
const PL_MON = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
const PL_MON_SHORT = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
const PRIO = { 1: '#d1453b', 2: '#eb8909', 3: '#246fe0' };
const COLORS = [
  ['Czerwony', '#db4035'], ['Pomarańczowy', '#ff9933'], ['Żółty', '#fad000'], ['Oliwkowy', '#afb83b'],
  ['Limonkowy', '#7ecc49'], ['Zielony', '#299438'], ['Miętowy', '#6accbc'], ['Turkusowy', '#158fad'],
  ['Błękitny', '#14aaf5'], ['Jasnoniebieski', '#96c3eb'], ['Niebieski', '#4073ff'], ['Winogronowy', '#884dff'],
  ['Fioletowy', '#af38eb'], ['Lawendowy', '#eb96eb'], ['Malinowy', '#e05194'], ['Łososiowy', '#ff8d85'],
  ['Szary', '#808080'], ['Taupe', '#ccac93'],
];
// ustawienia – obecny wygląd i zachowanie to wartości domyślne
const PREF_DEFAULTS = {
  startView: 'home', density: 'normal', scale: 100, anim: 'full', splash: true, confetti: true, navColors: true, showDesc: true,
  pomo: [25, 5, 15], hiddenNav: [], hiddenCards: [], voiceAuto: false, hoverFx: true,
  navOrder: [], cardOrder: [], tileEdit: false, karma: false, navCounts: true, gcalCal: true, gcalUp: true, gcalToday: true, gcalClientId: '', calWeekNums: false,
};
const PREF_FALSE = ['voiceAuto', 'karma', 'tileEdit', 'calWeekNums'];   // przełączniki domyślnie wyłączone
const PREF_REDRAW = ['karma', 'tileEdit', 'gcalCal', 'gcalUp', 'gcalToday', 'calWeekNums'];
const REC_OPTS =[['', 'Nie powtarzaj'], ['daily', 'Codziennie'], ['weekdays', 'W dni robocze'], ['weekly', 'Co tydzień'], ['monthly', 'Co miesiąc'], ['yearly', 'Co rok']];
const REC_LABEL = Object.fromEntries(REC_OPTS);
const BUILTIN_FILTERS = [
  { id: 'b-p1', name: 'Priorytet 1', query: 'p1', color: '#db4035', builtin: true },
  { id: 'b-overdue', name: 'Po terminie', query: 'overdue', color: '#ff8d85', builtin: true },
  { id: 'b-week', name: 'Najbliższe 7 dni', query: 'overdue | 7 days', color: '#884dff', builtin: true },
  { id: 'b-nodate', name: 'Bez terminu', query: 'no date', color: '#808080', builtin: true },
  { id: 'b-recurring', name: 'Cykliczne', query: 'recurring', color: '#158fad', builtin: true },
];

// ================================================================
//  Narzędzia
// ================================================================
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s).toLowerCase().replace(/\s+/g, '');
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const pad = n => String(n).padStart(2, '0');
const fmtDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const todayStr = () => fmtDate(new Date());
const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return fmtDate(d); };
const diffDays = (a, b) => Math.round((parseDate(a) - parseDate(b)) / 86400000);
const dow = s => parseDate(s).getDay();
const weekStart = s => addDays(s, -((dow(s) + 6) % 7));
const nextWeekday = (from, wd, allowToday) => { let d = allowToday ? from : addDays(from, 1); while (dow(d) !== wd) d = addDays(d, 1); return d; };
const nowHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const isNarrow = () => innerWidth <= 900;
const byOrder = (a, b) => a.order - b.order;
const byDue = (a, b) => (a.due || '9999').localeCompare(b.due || '9999') || (a.time || '99').localeCompare(b.time || '99') || a.priority - b.priority || a.order - b.order;
const plural = (n, one, few, many) => n === 1 ? one : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? few : many;

function shortDate(s) {
  const d = parseDate(s);
  let r = d.getDate() + ' ' + PL_MON_SHORT[d.getMonth()];
  if (d.getFullYear() !== new Date().getFullYear()) r += ' ' + d.getFullYear();
  return r;
}
function dueInfo(due, time) {
  if (!due) return null;
  const td = todayStr(), n = diffDays(due, td);
  let label, cls;
  if (n < 0) { label = n === -1 ? 'Wczoraj' : shortDate(due); cls = 'overdue'; }
  else if (n === 0) { label = 'Dziś'; cls = (time && time < nowHM()) ? 'overdue' : 'today'; }
  else if (n === 1) { label = 'Jutro'; cls = 'tomorrow'; }
  else if (n <= 7) { label = cap(PL_DAYS[dow(due)]); cls = 'week'; }
  else { label = shortDate(due); cls = 'later'; }
  if (time) label += ' ' + time;
  return { label, cls };
}
const describe = r => (r.due ? dueInfo(r.due, r.time).label : '') + (r.recurring ? ' · ' + REC_LABEL[r.recurring].toLowerCase() : '');

function fmtText(s) {
  let h = esc(s);
  h = h.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  h = h.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
  return h;
}
function autoGrow(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }

// ================================================================
//  Ikony
// ================================================================
const sz = (svg, s) => svg.replace(/width="\d+" height="\d+"/, `width="${s}" height="${s}"`);
const sv = (p, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const I = {
  plus: sv('<path d="M12 5v14M5 12h14"/>'),
  check: '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  checkSmall: sv('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 16),
  cal: sv('<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>', 14),
  calBig: sv('<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>', 18),
  inbox: sv('<path d="M3.5 13.5l2.6-7.2A2 2 0 0 1 8 5h8a2 2 0 0 1 1.9 1.3l2.6 7.2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M3.5 13.5H8l1.5 2.5h5l1.5-2.5h4.5"/>', 20),
  upcoming: sv('<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4M8 14h3M8 17h6"/>', 20),
  filters: sv('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>', 20),
  done: sv('<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>', 20),
  search: sv('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>', 20),
  dots: sv('<circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/>', 20),
  viewDoc: sv('<rect x="4.5" y="3.5" width="15" height="17" rx="2.5"/><path d="M8 8.5h8M8 12h8M8 15.5h5"/>', 20),
  commentBig: sv('<path d="M4.5 5.5h15v11h-8.5l-4.5 3.5v-3.5h-2z"/>', 20),
  cloud: sv('<path d="M7 18.5h10.5a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.5 9.5 4.5 4.5 0 0 0 7 18.5z"/>', 18),
  calMonth: sv('<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4M7.5 13.5h2M11 13.5h2M14.5 13.5h2M7.5 16.5h2M11 16.5h2"/>', 20),
  timer: sv('<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 1.5M10 2.5h4M18.5 6l1.5-1.5"/>', 20),
  menu: sv('<path d="M4 7h16M4 12h16M4 17h16"/>', 22),
  edit: sv('<path d="M15 5l4 4L9 19H5v-4z"/><path d="M13 7l4 4"/>'),
  tag: sv('<path d="M3.5 12.3V5a1.5 1.5 0 0 1 1.5-1.5h7.3l8.2 8.2a1.5 1.5 0 0 1 0 2.1l-6.2 6.2a1.5 1.5 0 0 1-2.1 0z"/><circle cx="8" cy="8" r="1.3"/>', 14),
  tagBig: sv('<path d="M3.5 12.3V5a1.5 1.5 0 0 1 1.5-1.5h7.3l8.2 8.2a1.5 1.5 0 0 1 0 2.1l-6.2 6.2a1.5 1.5 0 0 1-2.1 0z"/><circle cx="8" cy="8" r="1.3"/>', 18),
  subtask: sv('<path d="M6 4v10a3 3 0 0 0 3 3h9"/><path d="M15 14l3 3-3 3"/>', 14),
  comment: sv('<path d="M4 5h16v11H9l-5 4z"/>', 14),
  repeat: sv('<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h16"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>', 12),
  chevron: sv('<path d="M9 6l6 6-6 6"/>', 14),
  chevronDown: sv('<path d="M6 9l6 6 6-6"/>', 14),
  left: sv('<path d="M15 6l-6 6 6 6"/>', 16),
  right: sv('<path d="M9 6l6 6-6 6"/>', 16),
  x: sv('<path d="M6 6l12 12M18 6L6 18"/>', 18),
  trash: sv('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', 16),
  sidebar: sv('<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M9.5 4.5v15"/>', 20),
  sun: sv('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  sofa: sv('<path d="M5 11V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3"/><path d="M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3z"/><path d="M6 18v2M18 18v2"/>'),
  next: sv('<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M8 12h7.5M12.5 8.8L15.8 12l-3.3 3.2"/>'),
  ban: sv('<circle cx="12" cy="12" r="8"/><path d="M8.6 15.4l6.8-6.8"/>'),
  home: sv('<path d="M4.5 10.5L12 4.5l7.5 6"/><path d="M6.5 9v9.5a1 1 0 0 0 1 1h3v-5h3v5h3a1 1 0 0 0 1-1V9"/>', 20),
  matrix: sv('<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M12 3.5v17M3.5 12h17"/><circle cx="7.8" cy="7.8" r="1.3" fill="currentColor" stroke="none"/>', 20),
  bolt: sv('<path d="M13.5 3.5L6 13.2h5.4l-1 7.3 7.6-9.9h-5.5z"/>', 20),
  play: sv('<path d="M8 5.5v13l10.5-6.5z"/>', 18),
  stop: sv('<rect x="6.5" y="6.5" width="11" height="11" rx="2"/>', 18),
  gear: sv('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>', 20),
  book: sv('<path d="M4.5 5.5A2 2 0 0 1 6.5 3.5H19v14H6.5a2 2 0 0 0-2 2z"/><path d="M4.5 19.5a2 2 0 0 0 2 1H19v-3M9 8h6"/>', 20),
  mic: sv('<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/>', 18),
  habit: sv('<path d="M12 21c-4 0-7-2.8-7-6.6 0-3.3 2.4-5.4 3.8-7.9.5 1.6 1.4 2.7 2.6 3.3.2-2.7 1.5-5.1 3.6-6.8-.3 2.6.8 4.4 2.2 6.2 1.2 1.6 1.8 3 1.8 5.1C19 18.2 16 21 12 21z"/>', 20),
  history: sv('<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4 4.5v3.2h3.2M12 8v4.3l2.8 1.7"/>', 18),
  list2: sv('<path d="M9 7h11M9 12h11M9 17h11"/><circle cx="5" cy="7" r=".9"/><circle cx="5" cy="12" r=".9"/><circle cx="5" cy="17" r=".9"/>', 18),
  clock: sv('<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>', 15),
  move: sv('<path d="M5 12h14M13 6l6 6-6 6"/>', 16),
  copy: sv('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>', 16),
  moon: sv('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>', 18),
  auto: sv('<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17" /><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/>', 18),
  star: sv('<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>', 16),
  board: sv('<rect x="3.5" y="4.5" width="5" height="15" rx="1.5"/><rect x="10" y="4.5" width="5" height="10" rx="1.5"/><rect x="16.5" y="4.5" width="4" height="12" rx="1.5"/>', 20),
  list: sv('<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>', 20),
  sliders: sv('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>', 18),
  keyboard: sv('<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>', 18),
  filterDrop: sv('<path d="M12 3.5c3 4 6 7 6 10.5a6 6 0 0 1-12 0C6 10.5 9 7.5 12 3.5z"/>', 18),
  bell: sv('<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>', 22),
  pulse: sv('<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M6 13h2.5l1.5-3.5 2.5 6 1.5-3.5H18"/>', 20),
  help: sv('<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4"/><path d="M12 16.8h.01"/>', 22),
  share: sv('<circle cx="10" cy="8" r="3.5"/><path d="M3.5 19.5a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6"/>', 20),
  party: sv('<path d="M4 20l4.5-12 7.5 7.5z"/><path d="M14 4v2M19 9h2M17.5 5.5l1.5-1.5M12.5 9.5c1.5-1.5 3.5-1.5 5 0"/>', 56),
};
function todayIcon() {
  const d = new Date().getDate();
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M3.5 9h17"/><text x="12" y="17.8" text-anchor="middle" font-size="8.5" font-weight="700" fill="currentColor" stroke="none" font-family="system-ui,sans-serif">${d}</text></svg>`;
}
function flagIcon(p, s = 16) {
  const st = p < 4 ? `style="fill:var(--p${p});stroke:var(--p${p})"` : 'fill="none" stroke="currentColor"';
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" ${st} stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="M5 21V4.5h12l-2.5 4 2.5 4H5"/></svg>`;
}

// ================================================================
//  Dane
// ================================================================
let state = load();

function newTask(o) {
  return Object.assign({
    id: uid(), title: '', description: '', projectId: 'inbox', sectionId: null, parentId: null,
    priority: 4, due: null, time: null, recurring: null, labels: [], completed: false,
    completedAt: null, createdAt: Date.now(), order: 0, comments: [],
  }, o);
}

function seed() {
  // Nowe konto – czysta aplikacja z krótkim wprowadzeniem (bez czyichkolwiek danych)
  seeded = true;
  let ord = 1;
  const td = todayStr();
  const inbox = { id: 'inbox', name: 'Skrzynka', color: '#808080', isInbox: true, view: 'list', order: 0, sections: [] };
  const intro = { id: uid(), name: 'Witaj w Listo', color: '#db4035', favorite: false, view: 'list', order: 1, description: 'Krótki przewodnik – odhacz zadania, gdy je wypróbujesz, a potem usuń ten projekt.', sections: [] };
  const tasks = [];
  const T = (title, o = {}) => tasks.push(newTask(Object.assign({ title, projectId: intro.id, order: ord++ }, o)));
  T('Odhacz to zadanie, klikając kółko po lewej', { due: td, priority: 1 });
  T('Dodaj swoje pierwsze zadanie – naciśnij Q i wpisz np. „Zakupy jutro 18:00 p2”', { due: td, priority: 2 });
  T('Podyktuj zadanie głosem – naciśnij V', { due: addDays(td, 1), priority: 3 });
  T('Zajrzyj do Poradnika (klawisz ?), aby poznać wszystkie skróty', { due: addDays(td, 1) });
  T('Przeciągnij zadanie w Matrycy, by zmienić jego priorytet i termin', { due: addDays(td, 2) });
  T('Dostosuj wygląd w Ustawieniach (klawisz ,)', { due: addDays(td, 3) });
  return {
    projects: [inbox, intro], labels: [], tasks, history: [], filters: [],
    settings: { theme: 'dark', dailyGoal: 5, userName: '', completedGroup: 'project' },
  };
}

function load() {
  try {
    const s = localStorage.getItem(KEY);
    if (s) return normalizeState(JSON.parse(s));
  } catch (e) { /* uszkodzone dane – zaczynamy od nowa */ }
  return normalizeState(seed());
}
function normalizeState(d) {
  d.settings = Object.assign({ theme: 'dark', dailyGoal: 5, userName: '', completedGroup: 'project', sound: true }, d.settings || {});
  d.filters = d.filters || []; d.labels = d.labels || []; d.history = d.history || [];
  d.projects = d.projects || []; d.tasks = d.tasks || [];
  if (!d.projects.some(p => p.id === 'inbox')) d.projects.unshift({ id: 'inbox', name: 'Skrzynka', color: '#808080', isInbox: true, view: 'list', order: 0, sections: [] });
  d.projects.forEach(p => { p.sections = p.sections || []; });
  d.focus = d.focus || { sessions: [], taskId: null }; d.focus.sessions = d.focus.sessions || [];
  d.focus.sessions.forEach(s => { if (!s.id) s.id = uid(); });
  const ap = d.autoPrio = d.autoPrio || {};
  if (ap.enabled === undefined) ap.enabled = false;
  ap.due = Object.assign({ overdue: { on: true, p: 1 }, today: { on: true, p: 1 }, tomorrow: { on: true, p: 2 }, d3: { on: true, p: 2 }, d7: { on: false, p: 3 } }, ap.due || {});
  ap.rules = ap.rules || []; ap.log = ap.log || [];
  if (!d.settings.mxDays && d.settings.mxDays !== 0) d.settings.mxDays = 2;
  d.settings = Object.assign({}, PREF_DEFAULTS, d.settings);
  d.habits = d.habits || [];
  d.karma = d.karma || { points: 0, log: [], day: null };
  d.tasks.forEach(t => { t.labels = t.labels || []; t.comments = t.comments || []; });
  return d;
}
let saveTimer;
function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* brak miejsca / tryb prywatny */ } }
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(persist, 120); scheduleRemote(); }
addEventListener('beforeunload', persist);
const snapshot = () => JSON.stringify(state);

// ---- zapytania ----
const proj = id => state.projects.find(p => p.id === id);
const label = id => state.labels.find(l => l.id === id);
const task = id => state.tasks.find(t => t.id === id);
const active = () => state.tasks.filter(t => !t.completed);
const sectionOf = t => { const p = proj(t.projectId); return p && t.sectionId ? p.sections.find(s => s.id === t.sectionId) : null; };
const kids = (id, all) => state.tasks.filter(t => t.parentId === id && (all || !t.completed)).sort(byOrder);
const userProjects = () => state.projects.filter(p => !p.isInbox).sort(byOrder);
const allFilters = () => [...BUILTIN_FILTERS, ...state.filters];
const nextOrder = () => state.tasks.reduce((m, t) => Math.max(m, t.order || 0), 0) + 1;
function descendants(id) {
  const out = [];
  const walk = i => state.tasks.forEach(t => { if (t.parentId === i) { out.push(t); walk(t.id); } });
  walk(id);
  return out;
}
const projName = p => p ? p.name : 'Skrzynka';

// ================================================================
//  Parser szybkiego dodawania („jutro o 15:00 p1 #Studia @pilne”)
// ================================================================
const WD = {
  'niedziela': 0, 'niedzielę': 0, 'niedziele': 0, 'niedz': 0,
  'poniedziałek': 1, 'poniedzialek': 1, 'pon': 1,
  'wtorek': 2, 'wt': 2,
  'środa': 3, 'środę': 3, 'sroda': 3, 'srode': 3, 'śr': 3,
  'czwartek': 4, 'czw': 4,
  'piątek': 5, 'piatek': 5, 'pt': 5,
  'sobota': 6, 'sobotę': 6, 'sobote': 6, 'sob': 6,
  'sunday': 0, 'sun': 0, 'monday': 1, 'mon': 1, 'tuesday': 2, 'tue': 2, 'wednesday': 3, 'wed': 3,
  'thursday': 4, 'thu': 4, 'friday': 5, 'fri': 5, 'saturday': 6, 'sat': 6,
};
const WD_RE = Object.keys(WD).sort((a, b) => b.length - a.length).join('|');
const MONTHS = {};
[
  'sty stycznia styczeń styczen jan january', 'lut lutego luty feb february', 'mar marca marzec march',
  'kwi kwietnia kwiecień kwiecien apr april', 'maj maja may', 'cze czerwca czerwiec jun june',
  'lip lipca lipiec jul july', 'sie sierpnia sierpień sierpien aug august',
  'wrz września wrzesnia wrzesień wrzesien sep sept september', 'paź paz października pazdziernika październik pazdziernik oct october',
  'lis listopada listopad nov november', 'gru grudnia grudzień grudzien dec december',
].forEach((words, i) => words.split(' ').forEach(w => { MONTHS[w] = i; }));

function mkDate(y, m, d) {
  const dt = new Date(y, m, d);
  return (dt.getMonth() === m && dt.getDate() === d) ? fmtDate(dt) : null;
}
function futureDate(m, d, y) {
  const td = todayStr();
  if (y) return mkDate(y < 100 ? 2000 + y : y, m, d);
  const cy = new Date().getFullYear();
  const r = mkDate(cy, m, d);
  return r && r < td ? mkDate(cy + 1, m, d) : r;
}

function parseQuick(text, opts = {}) {
  let t = ' ' + text + ' ';
  const r = { title: '', priority: null, labels: [], projectId: null, sectionId: null, due: null, time: null, recurring: null };
  const td = todayStr();
  const take = (re, fn) => { t = t.replace(re, (...a) => fn(...a) === false ? a[0] : ' '); };
  const setDue = d => { if (r.due || !d) return false; r.due = d; };

  take(/\s(p[1-4])(?=\s)/i, (m, p) => { r.priority = +p[1]; });
  take(/\s@([^\s@#]+)(?=\s)/gu, (m, l) => { r.labels.push(l); });
  take(/\s#([^\s@#/]+)(?=\s)/u, (m, p) => {
    const n = norm(p);
    const pr = state.projects.find(x => norm(x.name) === n) || state.projects.find(x => norm(x.name).startsWith(n));
    if (!pr) return false;
    r.projectId = pr.id;
  });
  take(/\s\/([^\s/]+)(?=\s)/u, (m, s) => {
    const p = proj(r.projectId || opts.projectId || 'inbox');
    const n = norm(s);
    const se = p && (p.sections.find(x => norm(x.name) === n) || p.sections.find(x => norm(x.name).startsWith(n)));
    if (!se) return false;
    r.sectionId = se.id;
  });

  // powtarzanie
  take(/\s(?:codziennie|każdego dnia|kazdego dnia|every\s?day|daily)(?=\s)/i, () => { r.recurring = 'daily'; });
  if (!r.recurring) take(/\s(?:w dni robocze|w dni powszednie|every weekday|weekdays)(?=\s)/i, () => { r.recurring = 'weekdays'; });
  if (!r.recurring) take(new RegExp(`\\s(?:co|every|każd[yąa]|kazd[yaą])\\s(${WD_RE})(?=\\s)`, 'iu'), (m, w) => { r.recurring = 'weekly'; r.due = nextWeekday(td, WD[w.toLowerCase()], true); });
  if (!r.recurring) take(/\s(?:co tydzień|co tydzien|every week|weekly|tygodniowo)(?=\s)/i, () => { r.recurring = 'weekly'; });
  if (!r.recurring) take(/\s(?:co miesiąc|co miesiac|every month|monthly|miesięcznie)(?=\s)/i, () => { r.recurring = 'monthly'; });
  if (!r.recurring) take(/\s(?:co rok|corocznie|every year|yearly)(?=\s)/i, () => { r.recurring = 'yearly'; });

  // godzina
  take(/\s(?:o\s|at\s|godz\.?\s?)?(\d{1,2}):(\d{2})(?=\s)/i, (m, h, mi) => { if (+h > 23 || +mi > 59) return false; r.time = `${pad(+h)}:${mi}`; });
  if (!r.time) take(/\s(?:at\s)?(\d{1,2})\s?(am|pm)(?=\s)/i, (m, h, ap) => { let H = +h % 12; if (ap.toLowerCase() === 'pm') H += 12; if (+h > 12) return false; r.time = `${pad(H)}:00`; });
  if (!r.time) take(/\s(?:o|at)\s(\d{1,2})(?=\s*$)/i, (m, h) => { if (+h > 23) return false; r.time = `${pad(+h)}:00`; });

  // data
  take(/\s(?:dziś|dzis|dzisiaj|today|tod)(?=\s)/i, () => setDue(td));
  take(/\s(?:pojutrze)(?=\s)/i, () => setDue(addDays(td, 2)));
  take(/\s(?:jutro|tomorrow|tmr)(?=\s)/i, () => setDue(addDays(td, 1)));
  take(/\s(?:za|in)\s(\d{1,3})\s(?:dni|dzień|dzien|dnia|days?)(?=\s)/i, (m, n) => setDue(addDays(td, +n)));
  take(/\s(?:za|in)\s(\d{1,2})\s(?:tygodnie|tygodni|tydzień|tydzien|weeks?)(?=\s)/i, (m, n) => setDue(addDays(td, 7 * n)));
  take(/\s(?:za tydzień|za tydzien|w przyszłym tygodniu|w przyszlym tygodniu|przyszły tydzień|przyszly tydzien|next week)(?=\s)/i, () => setDue(nextWeekday(td, 1, false)));
  take(/\s(?:w ten weekend|ten weekend|w weekend|weekend|this weekend)(?=\s)/i, () => setDue(nextWeekday(td, 6, true)));
  take(/\s(\d{4})-(\d{1,2})-(\d{1,2})(?=\s)/, (m, y, mo, d) => setDue(mkDate(+y, mo - 1, +d)));
  take(/\s(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?=\s)/, (m, d, mo, y) => setDue(futureDate(mo - 1, +d, y ? +y : 0)));
  take(/\s(\d{1,2})\s(\p{L}{3,})(?:\s(\d{4}))?(?=\s)/u, (m, d, mo, y) => {
    const k = mo.toLowerCase();
    if (!(k in MONTHS)) return false;
    return setDue(futureDate(MONTHS[k], +d, y ? +y : 0));
  });
  take(new RegExp(`\\s(?:(?:w|we|on|next)\\s)?(${WD_RE})(?=\\s)`, 'iu'), (m, w) => setDue(nextWeekday(td, WD[w.toLowerCase()], false)));

  if ((r.time || r.recurring) && !r.due) r.due = td;
  r.title = t.replace(/\s+/g, ' ').trim();
  return r;
}

// ================================================================
//  Filtry (prosty język zapytań)
// ================================================================
function evalQuery(q, t) {
  q = q.trim();
  if (!q) return true;
  // nawiasy – rekurencyjnie
  let depth = 0, start = -1;
  for (let i = 0; i < q.length; i++) {
    if (q[i] === '(') { if (depth++ === 0) start = i; }
    else if (q[i] === ')' && --depth === 0) {
      const inner = evalQuery(q.slice(start + 1, i), t);
      return evalQuery(q.slice(0, start) + (inner ? ' __true__ ' : ' __false__ ') + q.slice(i + 1), t);
    }
  }
  return q.split('|').some(or => or.split('&').every(term => evalTerm(term.trim(), t)));
}
function evalTerm(term, t) {
  if (!term) return true;
  if (term === '__true__') return true;
  if (term === '__false__') return false;
  if (term.startsWith('!')) return !evalTerm(term.slice(1).trim(), t);
  const s = term.toLowerCase(), td = todayStr();
  if (['today', 'dziś', 'dzis', 'dzisiaj'].includes(s)) return t.due === td;
  if (['tomorrow', 'jutro'].includes(s)) return t.due === addDays(td, 1);
  if (['overdue', 'po terminie', 'zaległe', 'zalegle'].includes(s)) return !!t.due && t.due < td;
  if (['no date', 'bez terminu', 'bez daty'].includes(s)) return !t.due;
  if (['recurring', 'cykliczne'].includes(s)) return !!t.recurring;
  if (['subtask', 'podzadanie'].includes(s)) return !!t.parentId;
  if (['no labels', 'bez etykiet'].includes(s)) return !t.labels.length;
  let m = s.match(/^(?:next\s|najbliższe\s|najblizsze\s)?(\d+)\s*(?:days|dni)$/);
  if (m) return !!t.due && t.due >= td && t.due <= addDays(td, +m[1]);
  m = s.match(/^p([1-4])$/);
  if (m) return t.priority === +m[1];
  if (s.startsWith('@')) { const n = norm(s.slice(1)); return t.labels.some(id => label(id) && norm(label(id).name) === n); }
  if (s.startsWith('##') || s.startsWith('#')) { const n = norm(s.replace(/^#+/, '')); const p = proj(t.projectId); return !!p && norm(p.name) === n; }
  if (s.startsWith('/')) { const se = sectionOf(t); return !!se && norm(se.name) === norm(s.slice(1)); }
  if (s.startsWith('search:')) return (t.title + ' ' + t.description).toLowerCase().includes(s.slice(7).trim());
  return (t.title + ' ' + t.description).toLowerCase().includes(s.replace(/^"|"$/g, ''));
}

// ================================================================
//  Stan interfejsu
// ================================================================
const ui = {
  view: hashView(), addForm: null, addSection: null, collapsed: {}, modal: null, dialog: null,
  sidebar: !isNarrow(), upStart: weekStart(todayStr()), ctxDefaults: {}, showCompleted: {},
  focusSel: null, lastViewKey: null, gPending: false, popOnClose: null, enter: new Set(), bar: {}, stagger: true, rowIdx: 0, calMonth: null, calSel: null,
  selected: new Set(), selAnchor: null, hoverId: null, lastSnap: null,
};

// adres w formie #today, #project-abc123 (prosty #nazwa – działa też w osadzonej stronie)
function viewHash(v) { return v.id ? `${v.type}-${v.id}` : v.type; }
function hashView() {
  const h = decodeURIComponent(location.hash.slice(1));
  const i = h.search(/[-/]/);
  const type = i < 0 ? h : h.slice(0, i), id = i < 0 ? '' : h.slice(i + 1);
  if (['home', 'today', 'upcoming', 'inbox', 'filters', 'completed', 'search', 'reports', 'calendar', 'focus', 'matrix', 'autoprio', 'prefs', 'guide', 'habits'].includes(type)) return { type };
  if (type === 'project' && proj(id)) return id === 'inbox' ? { type: 'inbox' } : { type, id };
  if (type === 'label' && label(id)) return { type, id };
  if (type === 'filter' && allFilters().some(f => f.id === id)) return { type, id };
  return { type: 'home' };
}
function setView(v, fromHistory) {
  if (v.type === 'project' && v.id === 'inbox') v = { type: 'inbox' };
  ui.view = v; ui.addForm = null; ui.addSection = null; ui.stagger = true; ui.selected.clear();
  try { localStorage.setItem('listo-last-view', viewHash(v)); } catch (e) { /* */ }
  if (v.type === 'search') { v.q = v.q || ''; ui.focusSel = '.search-input'; }
  const h = '#' + viewHash(v);
  try { if (!fromHistory && location.hash !== h) history.pushState(null, '', h); } catch (e) { /* ramka bez historii */ }
  if (isNarrow()) ui.sidebar = false;
  ui.upStrip = null; ui.upCur = null;
  // na telefonie bez przejść widoku (ciężkie dla słabszych procesorów) – zamiast tego lekki wjazd treści
  if (document.startViewTransition && !REDUCED && document.visibilityState === 'visible' && !isNarrow()) {
    const vt = document.startViewTransition(() => render());
    [vt.ready, vt.finished, vt.updateCallbackDone].forEach(p => p && p.catch(() => {}));
  }
  else render();
}
addEventListener('popstate', () => { const v = hashView(); if (viewHash(v) !== viewHash(ui.view)) { ui.modal = null; setView(v, true); } });

// ================================================================
//  Render
// ================================================================
function commit() { save(); render(); }

function applyTheme() {
  const t = state.settings.theme;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const m = document.querySelector('meta[name=theme-color]');
  if (m) m.content = dark ? '#1e1e1e' : '#ffffff';
  // motyw kolorystyczny (akcent) – jak „Motywy” w Todoist
  const acc = ACCENTS.find(a => a.id === state.settings.accent);
  const st = document.documentElement.style;
  const vars = ['--accent', '--accent-hover', '--accent-text', '--nav-active', '--nav-active-text'];
  if (!acc || acc.id === 'todoist') { vars.forEach(v => st.removeProperty(v)); return; }
  const c = acc.color;
  st.setProperty('--accent', c);
  st.setProperty('--accent-hover', `color-mix(in srgb, ${c} 85%, #fff)`);
  st.setProperty('--accent-text', dark ? `color-mix(in srgb, ${c} 72%, #fff)` : c);
  st.setProperty('--nav-active', dark ? `color-mix(in srgb, ${c} 24%, #262626)` : `color-mix(in srgb, ${c} 12%, #fff)`);
  st.setProperty('--nav-active-text', dark ? `color-mix(in srgb, ${c} 55%, #fff)` : `color-mix(in srgb, ${c} 82%, #000)`);
}
const ACCENTS = [
  { id: 'todoist', name: 'Todoist', color: '#dc4c3e' }, { id: 'tangerine', name: 'Mandarynka', color: '#e8862a' },
  { id: 'kale', name: 'Jarmuż', color: '#3f9a4b' }, { id: 'blueberry', name: 'Borówka', color: '#4a7cdb' },
  { id: 'lavender', name: 'Lawenda', color: '#9b6bd6' }, { id: 'raspberry', name: 'Malina', color: '#d6336c' },
  { id: 'moonstone', name: 'Kamień księżycowy', color: '#8f9aa6' },
];
function themePicker(anchor) {
  openPopover(anchor, (pop, close) => {
    const draw = () => {
      const curA = state.settings.accent || 'todoist';
      pop.innerHTML = `<div class="menu theme-pick"><div class="menu-label">Motyw kolorystyczny</div><div class="tp-grid">${ACCENTS.map(a => `<button class="tp-item${a.id === curA ? ' on' : ''}" data-acc="${a.id}" style="--c:${a.color}"><span class="tp-sw"><i></i></span><span>${a.name}</span></button>`).join('')}</div>
        <div class="menu-sep"></div><div class="menu-label">Tryb</div><div class="tp-modes">${[['dark', 'Ciemny'], ['light', 'Jasny'], ['auto', 'Systemowy']].map(([v, l]) => `<button class="${state.settings.theme === v ? 'on' : ''}" data-mode="${v}">${l}</button>`).join('')}</div></div>`;
    };
    pop.onclick = e => {
      const b = e.target.closest('[data-acc],[data-mode]');
      if (!b) return;
      document.documentElement.classList.add('theme-fade');
      clearTimeout(themePicker.t); themePicker.t = setTimeout(() => document.documentElement.classList.remove('theme-fade'), 600);
      if (b.dataset.acc) state.settings.accent = b.dataset.acc; else state.settings.theme = b.dataset.mode;
      save(); render(); draw();
    };
    draw();
  });
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

function render() {
  const ae = document.activeElement;
  const keep = ['tf-title', 'tf-desc', 'sf-input', 'cm-input', 'search-input'].find(c => ae?.classList?.contains(c));
  if (!ui.focusSel && keep) ui.focusSel = '.' + keep;
  ui.ctxDefaults = {};
  if (applyAutoPrio()) save();
  applyTheme();
  applyPrefs();
  renderSidebar();
  renderMain();
  renderModal();
  $$('.task-form .tf-title').forEach(updatePreview);
  ui.enter.clear();
  if (ui.focusSel) {
    const el = $(ui.focusSel);
    ui.focusSel = null;
    if (el) {
      el.focus();
      if (typeof el.value === 'string') { const n = el.value.length; try { el.setSelectionRange(n, n); } catch (e) { /* */ } }
    }
  }
}

// ---------- pasek boczny ----------
const navAnim = { key: null, top: null, at: -1e9, from: 0, counts: {}, bump: {} };
function renderSidebar() {
  $('#app').classList.toggle('sb-closed', !ui.sidebar);
  const td = todayStr(), act = active(), v = ui.view;
  const overdue = act.some(t => t.due && t.due < td);
  const cnt = { inbox: act.filter(t => t.projectId === 'inbox').length, today: act.filter(t => t.due && t.due <= td).length };
  const nav = (type, icon, text, count, alert) => (state.settings.hiddenNav || []).includes(type) && v.type !== type ? '' : `<button class="nav-item ${v.type === type ? 'active' : ''}" data-act="nav" data-view="${type}" style="--nc:${NAV_HUE[type] || 'var(--accent)'}">${icon}<span class="name">${text}</span>${count ? `<span class="count ${alert ? 'alert' : ''}">${count}</span>` : ''}</button>`;
  const projItem = p => {
    const c = act.filter(t => t.projectId === p.id).length;
    const on = v.type === 'project' && v.id === p.id;
    const hashColor = p.color && p.color !== '#808080' ? `style="color:${p.color}"` : '';
    const exp = sbExpanded(p.id) && p.sections.length;
    return `<div class="nav-item proj ${on ? 'active' : ''} ${p.sections.length ? 'has-secs' : ''}" data-act="nav" data-view="project" data-id="${p.id}" data-drop="project" data-pid="${p.id}" role="button" tabindex="0">
      ${p.sections.length ? `<button class="sb-caret ${exp ? 'open' : ''}" data-act="sb-exp" data-id="${p.id}" title="${exp ? 'Ukryj' : 'Pokaż'} sekcje" aria-label="Pokaż sekcje">${I.chevron}</button>` : ''}
      <span class="hash" ${hashColor}>#</span><span class="name">${esc(p.name)}</span><span class="count">${c || ''}</span>
      <button class="icon-btn more" data-act="proj-menu" data-id="${p.id}" title="Więcej" aria-label="Opcje projektu">${I.dots}</button></div>
      ${exp ? `<div class="sb-secs">${p.sections.map((s, i) => { const sc = act.filter(t => t.projectId === p.id && t.sectionId === s.id).length; return `<button class="nav-item sb-sec" data-act="sb-sec" data-pid="${p.id}" data-sid="${s.id}" style="--d:${i}" data-drop="section" data-sid2="${s.id}"><span class="sb-sec-dot" ${hashColor}></span><span class="name">${esc(s.name)}</span><span class="count">${sc || ''}</span></button>`; }).join('')}</div>` : ''}`;
  };
  const favs = userProjects().filter(p => p.favorite);
  const name = state.settings.userName || 'Ja';
  const sbEl = $('#sidebar');
  // animacje menu przetrwają kolejne przerysowania (np. po przejściu widoku)
  const animateNav = () => {
    if (REDUCED) return;
    const now = performance.now(), na = $('.nav-item.active', sbEl);
    if (na) {
      const key = na.dataset.view + (na.dataset.id || '');
      if (navAnim.key && key !== navAnim.key && navAnim.top != null) { navAnim.from = navAnim.top - na.offsetTop; navAnim.at = now; }
      const el = now - navAnim.at;
      if (el < 420 && navAnim.from) {
        na.style.setProperty('--from', navAnim.from + 'px');
        na.style.animationDelay = (-el) + 'ms';
        na.classList.add('slide');
      }
      navAnim.key = key; navAnim.top = na.offsetTop;
    }
    $$('.nav-item[data-view]', sbEl).forEach(n => {
      const k = n.dataset.view + (n.dataset.id || ''), c = $('.count', n), txt = c ? c.textContent : '';
      if (k in navAnim.counts && navAnim.counts[k] !== txt && txt) navAnim.bump[k] = now;
      navAnim.counts[k] = txt;
      const e = now - (navAnim.bump[k] || -1e9);
      if (c && e < 450) { c.style.animationDelay = (-e) + 'ms'; c.classList.add('bump'); }
    });
  };
  sbEl.innerHTML = `
    <div class="sb-top">
      <button class="user" data-act="user-menu" title="Konto i ustawienia"><span class="avatar">${esc(name[0].toUpperCase())}</span><span>${esc(name)}</span>${I.chevronDown}</button>
      <div class="sb-tools">
        <span class="sync-badge" data-s="${sync.status}" title="${SYNC_LABEL[sync.status]}" ${sync.status === 'local' ? 'hidden' : ''}>${I.cloud}</span>
        <button class="icon-btn" data-act="notifications" title="Powiadomienia">${I.bell}</button>
        <button class="icon-btn" data-act="toggle-sidebar" title="Zwiń menu (M)">${I.sidebar}</button>
      </div>
    </div>
    <button class="nav-item add-btn" data-act="quick-add" title="Szybkie dodawanie (Q)"><span class="add-circle">${I.plus}</span><span>Dodaj zadanie</span></button>
    ${navOrder().map(k => { const d = NAV_DEF[k]; if (!d) return ''; const h = nav(k, d.icon(), d.label, d.count ? d.count(act, cnt) : '', k === 'today' && overdue); return k === 'inbox' ? `<div data-drop="project" data-pid="inbox">${h}</div>` : h; }).join('')}
    <div class="sb-group"><div class="sb-head"><span class="sb-title">Ulubione</span></div>${favs.map(projItem).join('')}</div>
    <div class="sb-group">
      <div class="sb-head">
        <button class="sb-title" data-act="collapse" data-key="projects">Moje projekty</button>
        <button class="icon-btn" data-act="add-project" title="Dodaj projekt">${I.plus}</button>
        <button class="icon-btn caret ${ui.collapsed.projects ? 'closed' : ''}" data-act="collapse" data-key="projects" title="Zwiń">${I.chevron}</button>
      </div>
      ${ui.collapsed.projects ? '' : userProjects().map(projItem).join('')}
    </div>
    <div class="sb-foot">
      ${nav('prefs', I.gear, 'Ustawienia')}
      <button class="nav-item ${v.type === 'guide' ? 'active' : ''}" data-act="nav" data-view="guide" style="--nc:${NAV_HUE.guide}">${I.help}<span class="name">Pomoc i poradnik</span></button>
    </div>`;
  animateNav();
}

// ---------- główny widok ----------
// Nagłówek w treści + dane dla górnego paska (tytuł pokazuje się po przewinięciu)
// zwijany kontener z płynną animacją wysokości
function cbox(key, inner) {
  return `<div class="cbox ${ui.collapsed[key] ? 'is-collapsed' : ''}" data-cbox="${key}"><div class="cbox-inner">${inner}</div></div>`;
}
function header(title, o = {}) {
  ui.bar = { title: o.barTitle || title, icon: o.icon || '', crumb: o.crumb || '', right: o.barRight || '' };
  return `<header class="view-header"><div><h1>${o.icon ? `<span class="h1-icon ${o.iconCls || ''}">${o.icon}</span>` : ''}<span>${title}</span></h1>${o.sub ? `<div class="vh-sub">${o.sub}</div>` : ''}</div><div class="vh-right">${o.right || ''}</div></header>`;
}

function renderMain() {
  const main = $('#main');
  const key = viewHash(ui.view);
  const prevScroll = $('.content', main)?.scrollTop || 0;
  let body = '', wide = false;
  const v = ui.view;
  ui.bar = { title: '', icon: '', crumb: '', right: '' };
  ui.rowIdx = 0;
  ui.fzTotals = focusTotals();
  switch (v.type) {
    case 'home': body = renderHome(); wide = true; break;
    case 'matrix': body = renderMatrix(); wide = true; break;
    case 'autoprio': body = renderAutoPrio(); break;
    case 'prefs': body = renderPrefs(); break;
    case 'guide': body = renderGuide(); wide = true; break;
    case 'habits': body = renderHabits(); break;
    case 'inbox': body = renderProjectView(proj('inbox')); wide = proj('inbox').view === 'board'; break;
    case 'project': { const p = proj(v.id); if (!p) { ui.view = { type: 'inbox' }; return renderMain(); } body = renderProjectView(p); wide = p.view === 'board'; break; }
    case 'today': body = renderToday(); break;
    case 'upcoming': body = renderUpcoming(); break;
    case 'filters': body = renderFiltersLabels(); break;
    case 'label': body = renderLabelView(); break;
    case 'filter': body = renderFilterView(); break;
    case 'completed': body = renderCompleted(); break;
    case 'reports': body = renderReports(); break;
    case 'calendar': body = renderCalendar(); wide = true; break;
    case 'focus': body = renderFocus(); break;
    case 'search': body = renderSearch(); break;
    default: body = renderToday();
  }
  if (['project', 'inbox', 'label', 'filter'].includes(v.type)) { const ib = insightBar(v); body = body.includes('class="proj-desc"') ? body.replace('</textarea>', '</textarea>' + ib) : body.replace('</header>', '</header>' + ib); }
  if (v.type === 'completed') body = body.replace('</header>', '</header>' + completedStats());
  if (v.type === 'reports') body = body.replace('<div class="group" style="margin-top:28px">', reportsExtra() + '<div class="group" style="margin-top:28px">');
  main.dataset.view = v.type;
  const ph = v.type === 'project' && proj(v.id)?.color;
  main.style.setProperty('--vh', NAV_HUE[v.type] || (ph && ph !== '#808080' ? ph : 'var(--accent)'));
  const b = ui.bar;
  const tmp = document.createElement('div'); tmp.innerHTML = b.title || '';
  document.title = (tmp.textContent || 'Listo').trim();
  main.innerHTML = `
    <div class="topbar">
      <div class="tb-left">
        ${ui.sidebar ? '' : `<button class="icon-btn" data-act="toggle-sidebar" title="Otwórz menu (M)">${I.sidebar}</button>`}
        <button class="icon-btn" data-act="hist-back" title="Wstecz">${I.left}</button>
        <button class="icon-btn" data-act="hist-fwd" title="Dalej">${I.right}</button>
        ${b.crumb}
      </div>
      <div class="tb-title">${b.icon ? `<span class="tb-icon">${b.icon}</span>` : ''}<span>${b.title}</span></div>
      <div class="tb-right">${b.right}</div>
    </div>
    <div class="content"><div class="content-inner ${wide ? 'wide' : ''} ${ui.stagger ? 'stagger' : ''} ${ui.quiet || (!ui.stagger && ui.lastViewKey === key) ? 'quiet' : ''}">${body}</div></div>
    <button class="fab" data-act="quick-add" aria-label="Dodaj zadanie">${I.plus}</button>`;
  ui.stagger = false; ui.quiet = false;
  const content = $('.content', main), bar = $('.topbar', main);
  if (ui.lastViewKey === key) content.scrollTop = prevScroll;
  ui.lastViewKey = key;
  const onScroll = () => bar.classList.toggle('scrolled', content.scrollTop > 48);
  content.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  $$('.proj-desc', main).forEach(autoGrow);
  if (v.type === 'search') updateSearchResults();
}

// ---------- wiersz zadania ----------
function taskRow(t, o = {}) {
  const p = proj(t.projectId), sec = sectionOf(t);
  const subs = state.tasks.filter(x => x.parentId === t.id);
  const subsDone = subs.filter(x => x.completed).length;
  const di = dueInfo(t.due, t.time);
  const meta = [];
  if (subs.length) meta.push(`<span class="meta-item">${I.subtask} ${subsDone}/${subs.length}</span>`);
  if (di && !(o.hideToday && di.cls === 'today' && !t.time && !t.recurring)) meta.push(`<span class="meta-item due ${t.completed && !o.asActive ? '' : di.cls}"${t.completed ? '' : ` data-act="task-date" data-id="${t.id}" title="Zmień termin"`}>${I.cal} ${di.label}${t.recurring ? ' ' + I.repeat : ''}</span>`);
  if (t.comments.length) meta.push(`<span class="meta-item">${I.comment} ${t.comments.length}</span>`);
  const fzSec = ui.fzTotals?.[t.id];
  if (fzSec) meta.push(`<span class="meta-item fz-meta" data-act="focus-report" data-id="${t.id}" title="Czas skupienia – kliknij, by zobaczyć szczegóły">${sz(I.timer, 13)} ${fmtDur(fzSec)}</span>`);
  if (t.autoSet != null && !t.completed) meta.push(`<span class="meta-item ap-meta" data-act="nav" data-view="autoprio" title="Priorytet podniesiony automatycznie: ${esc(t.autoWhy || '')} (Twój: P${t.prio0})">${sz(I.bolt, 12)} auto</span>`);
  t.labels.forEach(id => { const l = label(id); if (l) meta.push(`<span class="meta-item" style="color:${l.color}">${I.tag} ${esc(l.name)}</span>`); });
  if ((o.showProject || o.asActive) && t.parentId && task(t.parentId) && !(o.asActive && task(t.parentId).completed)) meta.push(`<span class="meta-item">${I.subtask} ${esc(task(t.parentId).title)}</span>`);
  const projHtml = o.showProject && p ? `<span class="meta-proj" data-act="nav" data-view="${p.isInbox ? 'inbox' : 'project'}" ${p.isInbox ? '' : `data-id="${p.id}"`} title="Przejdź do projektu">${esc(projName(p))}${sec ? ' / ' + esc(sec.name) : ''} <span class="hash" ${p.color !== '#808080' ? `style="color:${p.color}"` : ''}>#</span></span>` : '';
  const childList = o.asActive ? state.tasks.filter(x => x.parentId === t.id && x.completed).sort(byOrder) : o.nested ? kids(t.id, o.showDone) : [];
  const collapsed = ui.collapsed['t' + t.id];
  const idx = Math.min(ui.rowIdx++, 16);
  return `<div class="task-wrap" style="--i:${idx}">
    <div class="task ${t.completed && !o.asActive ? 'done' : ''}${ui.enter.has(t.id) ? ' enter' : ''}${ui.selected.has(t.id) ? ' sel' : ''}" data-id="${t.id}" draggable="${!t.completed && !o.noDrag}" data-drop="task"${o.asActive && t.completedAt ? ` title="Ukończono: ${fmtDateTime(t.completedAt)}"` : ''}>
      ${childList.length ? `<button class="caret ${collapsed ? 'closed' : ''}" data-act="collapse" data-key="t${t.id}" aria-label="Zwiń">${I.chevron}</button>` : ''}
      <button class="check p${t.priority}" data-act="toggle" data-id="${t.id}" aria-label="${t.completed ? 'Przywróć' : 'Ukończ'} zadanie" title="${t.completed ? 'Przywróć' : 'Ukończ'}">${I.check}</button>
      <div class="task-main" data-act="open" data-id="${t.id}">
        <div class="task-title">${fmtText(t.title)}</div>
        ${t.description ? `<div class="task-desc">${esc(t.description.split('\n')[0])}</div>` : ''}
        ${meta.length || projHtml ? `<div class="task-meta"><div class="meta-l">${meta.join('')}</div>${projHtml}</div>` : ''}
      </div>
      ${o.asActive ? `<div class="task-actions">
        <button class="restore-btn" data-act="toggle" data-id="${t.id}" title="Przywróć do listy zadań">${sz(I.repeat, 14)} Przywróć</button>
        <button class="icon-btn" data-act="task-del" data-id="${t.id}" title="Usuń na stałe">${I.trash}</button>
      </div>` : `<div class="task-actions">
        <button class="icon-btn" data-act="task-edit" data-id="${t.id}" title="Edytuj">${I.edit}</button>
        <button class="icon-btn" data-act="task-date" data-id="${t.id}" title="Ustaw termin">${I.calBig}</button>
        <button class="icon-btn" data-act="task-more" data-id="${t.id}" title="Więcej akcji">${I.dots}</button>
      </div>`}
    </div>
    ${childList.length ? cbox('t' + t.id, `<div class="subtasks">${childList.map(k => taskRow(k, o)).join('')}</div>`) : ''}
  </div>`;
}

// ---------- formularz dodawania ----------
function addTaskButton(ctx, defaults) {
  ui.ctxDefaults[ctx] = defaults;
  if (ui.addForm && ui.addForm.ctx === ctx) return taskForm();
  return `<button class="add-task" data-act="add-open" data-ctx="${esc(ctx)}"><span class="plus">${I.plus}</span>${ctx.startsWith('sub:') ? 'Dodaj zadanie podrzędne' : 'Dodaj zadanie'}</button>`;
}
function freshDraft(d) {
  return { title: '', description: '', projectId: d.projectId || 'inbox', sectionId: d.sectionId || null, parentId: d.parentId || null,
    priority: d.priority || 4, due: d.due || null, time: null, recurring: null, labels: [...(d.labels || [])] };
}
function openForm(ctx, defaults) {
  defaults = defaults || ui.ctxDefaults[ctx] || {};
  ui.addForm = { ctx, defaults, draft: freshDraft(defaults) };
  ui.addSection = null;
  ui.focusSel = '.task-form .tf-title';
  closePopover();
  render();
}
function cancelForm() {
  if (!ui.addForm) return;
  if (ui.addForm.ctx === 'quick') {
    animateOut($('#modal-root .overlay'), () => { ui.modal = null; ui.addForm = null; render(); });
    return;
  }
  ui.addForm = null;
  render();
}
function taskForm() {
  const f = ui.addForm, d = f.draft;
  const p = proj(d.projectId) || proj('inbox');
  const sec = p.sections.find(s => s.id === d.sectionId);
  const di = dueInfo(d.due, d.time);
  const labelNames = d.labels.map(id => label(id)?.name).filter(Boolean);
  const isSub = f.ctx.startsWith('sub:');
  return `<div class="task-form" data-ctx="${esc(f.ctx)}">
    <div class="tf-inputs">
      <input class="tf-title" placeholder="${isSub ? 'Nazwa zadania podrzędnego' : 'np. Oddać raport jutro o 15:00 p1 #Studia @pilne'}" value="${esc(d.title)}" autocomplete="off" aria-label="Nazwa zadania">
      <textarea class="tf-desc" rows="1" placeholder="Opis" aria-label="Opis">${esc(d.description)}</textarea>
      <div class="tf-preview"></div>
      <div class="tf-chips">
        <button type="button" class="chip ${di ? 'set ' + di.cls : ''}" data-act="tf-date">${I.cal}<span>${di ? di.label : 'Termin'}</span>${d.recurring ? I.repeat : ''}${di ? `<span class="chip-x" data-act="tf-clear-date" title="Usuń termin">${I.x}</span>` : ''}</button>
        <button type="button" class="chip" data-act="tf-prio">${flagIcon(d.priority, 14)}<span>${d.priority < 4 ? 'P' + d.priority : 'Priorytet'}</span></button>
        <button type="button" class="chip" data-act="tf-labels">${I.tag}<span>${labelNames.length ? labelNames.map(esc).join(', ') : 'Etykiety'}</span></button>
        <button type="button" class="chip mic-chip" data-act="voice" title="Podyktuj zadanie (V)">${I.mic}<span>Głos</span></button>
      </div>
    </div>
    <div class="tf-footer">
      ${isSub ? '<span></span>' : `<button type="button" class="chip" data-act="tf-project">${p.isInbox ? sz(I.inbox, 16) : `<span class="hash" style="color:${p.color}">#</span>`}<span>${esc(projName(p))}${sec ? ' / ' + esc(sec.name) : ''}</span>${I.chevronDown}</button>`}
      <div class="tf-btns">
        <button type="button" class="btn" data-act="tf-cancel">Anuluj</button>
        <button type="button" class="btn primary" data-act="tf-submit" ${d.title.trim() ? '' : 'disabled'}>Dodaj zadanie</button>
      </div>
    </div>
  </div>`;
}
function updatePreview(inp) {
  const form = inp.closest('.task-form');
  if (!form || !ui.addForm) return;
  const box = $('.tf-preview', form), d = ui.addForm.draft;
  const before = inp.value.slice(0, inp.selectionStart ?? inp.value.length);
  const m = before.match(/(^|\s)([#@/])([^\s#@/]*)$/u);
  let html = '';
  if (m && document.activeElement === inp) {
    const q = norm(m[3]);
    let items = [];
    if (m[2] === '#') items = state.projects.filter(p => norm(p.name).includes(q)).slice(0, 6)
      .map(p => ({ text: '#' + p.name.replace(/\s+/g, ''), html: `<span class="hash" style="color:${p.color}">#</span> ${esc(p.name)}` }));
    else if (m[2] === '@') {
      items = state.labels.filter(l => norm(l.name).includes(q)).slice(0, 6).map(l => ({ text: '@' + l.name, html: `<span style="color:${l.color}">${I.tag}</span> ${esc(l.name)}` }));
      if (q && !state.labels.some(l => norm(l.name) === q)) items.push({ text: '@' + m[3], html: `${I.plus} Utwórz etykietę „${esc(m[3])}”` });
    } else {
      const pr = parseQuick(inp.value);
      const p = proj(pr.projectId || d.projectId);
      if (p) items = p.sections.filter(s => norm(s.name).includes(q)).slice(0, 6).map(s => ({ text: '/' + s.name.replace(/\s+/g, ''), html: `/ ${esc(s.name)}` }));
    }
    if (items.length) html = `<div class="suggest">${items.map(it => `<button type="button" class="suggest-item" data-act="tf-suggest" data-text="${esc(it.text)}" data-len="${m[3].length + 1}">${it.html}</button>`).join('')}</div>`;
  }
  const r = parseQuick(inp.value, { projectId: d.projectId });
  const chips = [];
  if (r.due) chips.push(`<span class="pchip due ${dueInfo(r.due, r.time).cls}">${I.cal} ${esc(describe(r))}</span>`);
  if (r.priority) chips.push(`<span class="pchip">${flagIcon(r.priority, 12)} P${r.priority}</span>`);
  if (r.projectId) { const p = proj(r.projectId); chips.push(`<span class="pchip"><span class="hash" style="color:${p.color}">#</span> ${esc(p.name)}</span>`); }
  if (r.sectionId) { const p = proj(r.projectId || d.projectId); const s = p?.sections.find(x => x.id === r.sectionId); if (s) chips.push(`<span class="pchip">/ ${esc(s.name)}</span>`); }
  r.labels.forEach(l => chips.push(`<span class="pchip">${I.tag} ${esc(l)}</span>`));
  if (chips.length) html += `<div class="pchips">${chips.join('')}</div>`;
  box.innerHTML = html;
  const btn = $('[data-act="tf-submit"]', form);
  if (btn) btn.disabled = !inp.value.trim();
}
function applySuggest(btn) {
  const inp = $('.tf-title', btn.closest('.task-form'));
  const pos = inp.selectionStart ?? inp.value.length;
  const before = inp.value.slice(0, pos), after = inp.value.slice(pos);
  const start = before.length - +btn.dataset.len;
  const ins = btn.dataset.text + ' ';
  inp.value = before.slice(0, start) + ins + after.replace(/^\s+/, '');
  const caret = start + ins.length;
  inp.setSelectionRange(caret, caret);
  ui.addForm.draft.title = inp.value;
  updatePreview(inp);
}
function submitForm() {
  const f = ui.addForm;
  if (!f) return;
  const d = f.draft;
  const r = parseQuick(d.title, { projectId: d.projectId });
  if (!r.title) return;
  const labelIds = [...d.labels];
  r.labels.forEach(n => {
    let l = state.labels.find(x => x.name.toLowerCase() === n.toLowerCase());
    if (!l) { l = { id: uid(), name: n, color: '#808080' }; state.labels.push(l); }
    if (!labelIds.includes(l.id)) labelIds.push(l.id);
  });
  let projectId = r.projectId || d.projectId || 'inbox';
  let sectionId = r.projectId && r.projectId !== d.projectId ? r.sectionId : (r.sectionId || d.sectionId);
  let parentId = d.parentId || null;
  if (parentId) { const par = task(parentId); if (par) { projectId = par.projectId; sectionId = par.sectionId; } }
  const t = newTask({
    title: r.title, description: d.description.trim(), projectId, sectionId: sectionId || null, parentId,
    priority: r.priority || d.priority || 4, due: r.due || d.due || null, time: r.time || (r.due ? null : d.time) || null,
    recurring: r.recurring || d.recurring || null, labels: labelIds, order: nextOrder(),
  });
  state.tasks.push(t);
  markEnter(t.id);
  if (f.ctx === 'quick') {
    ui.addForm = null; ui.modal = null;
    commit();
    toast(`Dodano zadanie do: ${projName(proj(projectId))}`, null, () => openTask(t.id), 'Otwórz');
  } else {
    f.draft = freshDraft(f.defaults);
    ui.focusSel = '.task-form .tf-title';
    commit();
  }
}

// ---------- widok projektu ----------
function renderProjectView(p) {
  const showDone = !!ui.showCompleted[p.id];
  const all = state.tasks.filter(t => t.projectId === p.id);
  const top = sid => all.filter(t => !t.parentId && (t.sectionId || null) === sid && (showDone || !t.completed)).sort((a, b) => (a.completed - b.completed) || a.order - b.order);
  const o = { nested: true, showDone };
  const nComments = (p.comments || []).length;
  const barRight = (p.isInbox ? '' : `<button class="tb-btn" data-act="proj-share" data-id="${p.id}" title="Udostępnij – skopiuj listę zadań">${I.share}<span>Udostępnij</span></button>`) +
    `<button class="icon-btn" data-act="view-menu" data-id="${p.id}" title="Widok">${I.viewDoc}</button>` +
    `<button class="icon-btn" data-act="proj-comments" data-id="${p.id}" title="Komentarze${nComments ? ' (' + nComments + ')' : ''}">${I.commentBig}</button>` +
    `<button class="icon-btn" data-act="proj-menu" data-id="${p.id}" title="Więcej">${I.dots}</button>`;
  let html = p.isInbox
    ? header('Skrzynka', { icon: sz(I.inbox, 22), iconCls: 'red', barRight })
    : header(esc(p.name), { icon: '#', iconCls: 'box', barRight, crumb: `<button class="crumb" data-act="collapse-none">Moje projekty /</button>` })
      + `<textarea class="proj-desc" rows="1" data-pid="${p.id}" placeholder="Dodaj opis" aria-label="Opis projektu">${esc(p.description || '')}</textarea>`;

  if (p.view === 'board') {
    const cols = [];
    if (top(null).length || !p.sections.length) cols.push({ id: null, name: '(Bez sekcji)' });
    cols.push(...p.sections);
    html += `<div class="board">` + cols.map(c => {
      const ts = top(c.id);
      return `<div class="board-col" data-drop="section" data-pid="${p.id}" data-sid="${c.id || ''}">
        <div class="section-head"><h3>${esc(c.name)}</h3><span class="count">${ts.filter(t => !t.completed).length}</span>
        ${c.id ? `<button class="icon-btn" data-act="section-menu" data-pid="${p.id}" data-sid="${c.id}" title="Opcje sekcji">${I.dots}</button>` : ''}</div>
        <div class="col-body">${ts.map(t => taskRow(t, { showDone })).join('')}${addTaskButton(`p:${p.id}:${c.id || ''}`, { projectId: p.id, sectionId: c.id })}</div>
      </div>`;
    }).join('') + `<div class="board-col add-col">${sectionSlot(p, p.sections.length, true)}</div></div>`;
    return html;
  }

  html += `<div class="list" data-drop="section" data-pid="${p.id}" data-sid="">`;
  html += top(null).map(t => taskRow(t, o)).join('') + addTaskButton(`p:${p.id}:`, { projectId: p.id, sectionId: null });
  html += `</div>`;
  html += sectionSlot(p, 0, !p.sections.length);
  p.sections.forEach((s, i) => {
    const ts = top(s.id), col = ui.collapsed['s' + s.id];
    html += `<section class="section" data-drop="section" data-pid="${p.id}" data-sid="${s.id}">
      <div class="section-head">
        <button class="caret ${col ? 'closed' : ''}" data-act="collapse" data-key="s${s.id}" aria-label="Zwiń sekcję">${I.chevron}</button>
        <h3>${esc(s.name)}</h3><span class="count">${ts.filter(t => !t.completed).length}</span>
        <button class="icon-btn" data-act="section-menu" data-pid="${p.id}" data-sid="${s.id}" title="Opcje sekcji">${I.dots}</button>
      </div>
      ${cbox('s' + s.id, `<div class="section-body">${ts.map(t => taskRow(t, o)).join('')}${addTaskButton(`p:${p.id}:${s.id}`, { projectId: p.id, sectionId: s.id })}</div>`)}
    </section>` + sectionSlot(p, i + 1, i === p.sections.length - 1);
  });
  return html;
}
function sectionSlot(p, idx, always) {
  if (ui.addSection && ui.addSection.pid === p.id && ui.addSection.idx === idx) {
    return `<div class="section-form"><input class="sf-input" placeholder="Nazwa sekcji" value="${esc(ui.addSection.name || '')}" maxlength="80">
      <div><button class="btn primary" data-act="sf-submit">Dodaj sekcję</button><button class="btn" data-act="sf-cancel">Anuluj</button></div></div>`;
  }
  return `<button class="add-section ${always ? 'always' : ''}" data-act="add-section" data-pid="${p.id}" data-idx="${idx}">Dodaj sekcję</button>`;
}
function submitSection() {
  const s = ui.addSection;
  const name = ($('.sf-input')?.value || '').trim();
  if (!s || !name) return;
  const p = proj(s.pid);
  p.sections.splice(s.idx, 0, { id: uid(), name });
  ui.addSection = null;
  commit();
}

// ---------- Dziś ----------
function emptyState(title, text) {
  return `<div class="empty">${I.party}<h3>${title}</h3><div>${text}</div></div>`;
}
function renderToday() {
  const td = todayStr(), act = active();
  const overdue = act.filter(t => t.due && t.due < td).sort(byDue);
  const today = act.filter(t => t.due === td).sort(byDue);
  const n = overdue.length + today.length;
  const d = new Date();
  const doneToday = state.history.filter(h => fmtDate(new Date(h.at)) === td).length;
  const goal = state.settings.dailyGoal || 5, pct = Math.min(100, Math.round(doneToday / goal * 100));
  const C = 2 * Math.PI * 8;
  const ring = `<button class="icon-btn prog-btn" data-act="productivity" title="Dzisiaj ukończono ${doneToday} z ${goal}"><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="none" stroke="var(--line-2)" stroke-width="2.4"/><circle class="prog-arc" cx="10" cy="10" r="8" fill="none" stroke="var(--accent-text)" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="${(C * pct / 100).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 10 10)"/></svg></button>`;
  let html = header('Dziś', {
    icon: todayIcon(), iconCls: 'soft-red',
    sub: (n ? `${sz(I.done, 14)} ${n} ${plural(n, 'zadanie', 'zadania', 'zadań')}` : '') +
      `<span class="day-progress" data-act="productivity" title="Dzienny cel – kliknij, by zobaczyć statystyki"><span class="dp-bar"><i style="--w:${pct}%"></i></span>${doneToday}/${goal} dziś${pct >= 100 ? ' 🎉' : ''}</span>`,
    barRight: ring,
  });
  if (overdue.length) {
    html += `<div class="group"><div class="group-head"><button class="caret ${ui.collapsed.overdue ? 'closed' : ''}" data-act="collapse" data-key="overdue">${I.chevron}</button><h3>Zaległe</h3><button class="btn ghost accent" data-act="reschedule-overdue" title="Przełóż wszystkie zaległe na dziś">Zmień termin</button></div>
      ${cbox('overdue', overdue.map(t => taskRow(t, { showProject: true })).join(''))}</div>`;
  }
  const wd = PL_DAYS[d.getDay()];
  html += `<div class="group" data-drop="day" data-date="${td}"><div class="group-head"><h3>${d.getDate()} ${PL_MON_SHORT[d.getMonth()]} · Dziś · ${wd[0].toUpperCase() + wd.slice(1)}</h3></div>
    ${today.map(t => taskRow(t, { showProject: true, hideToday: true })).join('')}
    ${addTaskButton('today', { due: td })}</div>`;
  if (!n && !(ui.addForm && ui.addForm.ctx === 'today')) html += emptyState('Wszystko na dziś zrobione!', 'Ciesz się wolnym czasem albo zaplanuj coś na jutro.');
  return html;
}

// ---------- Nadchodzące ----------
function renderUpcoming() {
  const td = todayStr(), act = active(), ws = ui.upStart;
  const sws = ui.upStrip || ws;
  const md = parseDate(addDays(sws, 3));
  const days = upStripDays(sws);
  let html = `<div class="up-head">${header(`<span class="up-title">${PL_MON[md.getMonth()]} ${md.getFullYear()}</span>`, {
    right: `<div class="up-nav"><button class="icon-btn" data-act="up-nav" data-n="-7" ${ws <= weekStart(td) ? 'disabled' : ''} title="Poprzedni tydzień">${I.left}</button>
      <button class="btn" data-act="up-nav" data-n="0">Dziś</button>
      <button class="icon-btn" data-act="up-nav" data-n="7" title="Następny tydzień">${I.right}</button></div>`,
  })}<div class="week-strip">${days}</div></div>`;
  if (ws <= td) {
    const overdue = act.filter(t => t.due && t.due < td).sort(byDue);
    if (overdue.length) html += `<div class="group"><div class="group-head"><h3>Zaległe</h3><button class="btn ghost" data-act="reschedule-overdue">Przełóż na dziś</button></div>${overdue.map(t => taskRow(t, { showProject: true })).join('')}</div>`;
  }
  const start = ws < td ? td : ws;
  const end = addDays(ws, 27);
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const ts = act.filter(t => t.due === d).sort(byDue);
    const n = diffDays(d, td);
    const rel = n === 0 ? ' · Dziś' : n === 1 ? ' · Jutro' : '';
    html += `<div class="group" id="day-${d}" data-drop="day" data-date="${d}">
      <div class="group-head"><h3>${parseDate(d).getDate()} ${PL_MON_SHORT[parseDate(d).getMonth()]}${rel} · ${PL_DAYS[dow(d)]}</h3></div>
      ${ts.map(t => taskRow(t, { showProject: true })).join('')}
      ${addTaskButton('day:' + d, { due: d })}
    </div>`;
  }
  return html;
}

// ---------- Filtry i etykiety ----------
function renderFiltersLabels() {
  const act = active();
  let html = header('Filtry i etykiety');
  html += `<div class="fl-group"><div class="fl-head"><h3>Moje filtry</h3><button class="icon-btn" data-act="filter-add" title="Dodaj filtr">${I.plus}</button></div>
    ${allFilters().map(f => `<div class="fl-item" data-act="nav" data-view="filter" data-id="${f.id}" role="button" tabindex="0">
      <span style="color:${f.color}">${I.filterDrop}</span><span class="grow">${esc(f.name)} <span class="q">${esc(f.query)}</span></span>
      <span class="count">${act.filter(t => evalQuery(f.query, t)).length || ''}</span>
      ${f.builtin ? '<span style="width:28px;flex:none"></span>' : `<button class="icon-btn more" data-act="filter-menu" data-id="${f.id}">${I.dots}</button>`}</div>`).join('')}</div>`;
  html += `<div class="fl-group"><div class="fl-head"><h3>Etykiety</h3><button class="icon-btn" data-act="label-add" title="Dodaj etykietę">${I.plus}</button></div>
    ${state.labels.length ? state.labels.map(l => `<div class="fl-item" data-act="nav" data-view="label" data-id="${l.id}" role="button" tabindex="0">
      <span style="color:${l.color}">${I.tagBig}</span><span class="grow">${esc(l.name)}</span>
      <span class="count">${act.filter(t => t.labels.includes(l.id)).length || ''}</span>
      <button class="icon-btn more" data-act="label-menu" data-id="${l.id}">${I.dots}</button></div>`).join('')
      : '<div class="empty" style="padding:24px">Brak etykiet. Dodaj je przyciskiem + albo wpisując @nazwa przy zadaniu.</div>'}</div>`;
  return html;
}
function renderLabelView() {
  const l = label(ui.view.id);
  if (!l) return renderFiltersLabels();
  const ts = active().filter(t => t.labels.includes(l.id)).sort(byDue);
  return header(`<span style="color:${l.color}">@</span>${esc(l.name)}`, { right: `<button class="icon-btn" data-act="label-menu" data-id="${l.id}">${I.dots}</button>` }) +
    ts.map(t => taskRow(t, { showProject: true })).join('') + addTaskButton('label:' + l.id, { labels: [l.id] }) +
    (ts.length ? '' : emptyState('Brak zadań z tą etykietą', 'Dodaj etykietę do zadania, wpisując @' + esc(l.name) + '.'));
}
function renderFilterView() {
  const f = allFilters().find(x => x.id === ui.view.id);
  if (!f) return renderFiltersLabels();
  const ts = active().filter(t => evalQuery(f.query, t)).sort(byDue);
  return header(esc(f.name), { sub: `<span class="q">${esc(f.query)}</span>`, right: f.builtin ? '' : `<button class="icon-btn" data-act="filter-menu" data-id="${f.id}">${I.dots}</button>` }) +
    ts.map(t => taskRow(t, { showProject: true })).join('') + addTaskButton('filter:' + f.id, {}) +
    (ts.length ? '' : emptyState('Nic tu nie ma', 'Żadne zadanie nie pasuje do tego filtra.'));
}

// ---------- Ukończone ----------
function renderCompleted() {
  const done = state.tasks.filter(t => t.completed);
  const mode = state.settings.completedGroup === 'date' ? 'date' : 'project';
  const right = `<div class="seg-inline" role="group" aria-label="Grupowanie">
      <button class="${mode === 'project' ? 'sel' : ''}" data-act="completed-group" data-v="project">Projekty</button>
      <button class="${mode === 'date' ? 'sel' : ''}" data-act="completed-group" data-v="date">Data ukończenia</button></div>` +
    (done.length ? `<button class="btn ghost" data-act="clear-completed">Usuń wszystkie</button>` : '');
  let html = header('Ukończone', { icon: sz(I.done, 24), sub: `${done.length} ${plural(done.length, 'ukończone zadanie', 'ukończone zadania', 'ukończonych zadań')}`, right });
  if (!done.length) return html + emptyState('Jeszcze nic nie ukończono', 'Odhaczone zadania pojawią się tutaj – z zachowanym priorytetem, terminem, projektem i sekcją.');
  // zadanie pokazujemy na najwyższym poziomie, jeśli jego rodzic nie jest ukończony (wtedy byłoby zagnieżdżone)
  const isTop = t => !t.parentId || !task(t.parentId)?.completed;
  const row = (t, extra) => taskRow(t, Object.assign({ asActive: true, noDrag: true }, extra));
  if (mode === 'date') {
    const td = todayStr();
    let last = null;
    done.filter(isTop).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)).forEach(t => {
      const ds = fmtDate(new Date(t.completedAt || Date.now()));
      if (ds !== last) {
        last = ds;
        const n = diffDays(td, ds);
        html += `<div class="group"><div class="group-head"><h3>${shortDate(ds)}${n === 0 ? ' · Dziś' : n === 1 ? ' · Wczoraj' : ''} · ${PL_DAYS[dow(ds)]}</h3></div></div>`;
      }
      html += row(t, { showProject: true });
    });
    return html;
  }
  [proj('inbox'), ...userProjects()].forEach(p => {
    const mine = done.filter(t => t.projectId === p.id && isTop(t));
    if (!mine.length) return;
    const bySec = sid => mine.filter(t => (t.sectionId || null) === sid).sort(byOrder);
    const pk = 'cp' + p.id, pc = ui.collapsed[pk];
    const icon = p.isInbox ? `<span class="h1-icon red" style="width:24px;height:24px">${sz(I.inbox, 18)}</span>` : `<span class="hash">#</span>`;
    html += `<div class="proj-block"><div class="group-head" style="border:0">
        <button class="caret ${pc ? 'closed' : ''}" data-act="collapse" data-key="${pk}">${I.chevron}</button>
        <div class="proj-block-head">${icon}<span>${esc(projName(p))}</span><span class="count">${done.filter(t => t.projectId === p.id).length}</span></div></div>`;
    if (!pc) {
      html += bySec(null).map(t => row(t)).join('');
      p.sections.forEach(s => {
        const ts = bySec(s.id);
        if (!ts.length) return;
        const k = 'cs' + s.id, col = ui.collapsed[k];
        html += `<section class="section"><div class="section-head">
            <button class="caret ${col ? 'closed' : ''}" data-act="collapse" data-key="${k}">${I.chevron}</button>
            <h3>${esc(s.name)}</h3><span class="count">${ts.length}</span></div>
          ${cbox(k, ts.map(t => row(t)).join(''))}</section>`;
      });
    }
    html += `</div>`;
  });
  return html;
}

// ---------- Raportowanie ----------
function renderReports() {
  const td = todayStr(), goal = state.settings.dailyGoal;
  const byDay = {};
  state.history.forEach(h => { const d = fmtDate(new Date(h.at)); byDay[d] = (byDay[d] || 0) + 1; });
  const days = [...Array(7)].map((_, i) => addDays(td, i - 6));
  const counts = days.map(d => byDay[d] || 0);
  const week = counts.reduce((a, b) => a + b, 0);
  let streak = 0;
  for (let d = (byDay[td] || 0) >= goal ? td : addDays(td, -1); (byDay[d] || 0) >= goal; d = addDays(d, -1)) streak++;
  const act = active();
  const max = Math.max(goal, ...counts, 1);
  let html = header('Raportowanie', { icon: sz(I.pulse, 24) });
  html += `<div class="rep-cards">
    <div class="rep-card"><div class="v">${byDay[td] || 0}<span class="muted" style="font-size:15px">/${goal}</span></div><div class="l">Ukończone dziś</div></div>
    <div class="rep-card"><div class="v">${week}</div><div class="l">Ostatnie 7 dni</div></div>
    <div class="rep-card"><div class="v">${streak}</div><div class="l">Seria dni z celem</div></div>
    <div class="rep-card"><div class="v">${act.length}</div><div class="l">Aktywne zadania</div></div>
    <div class="rep-card"><div class="v">${state.focus.sessions.filter(s => s.at > Date.now() - 7 * 864e5).reduce((a, s) => a + s.min, 0)}</div><div class="l">Minuty skupienia (7 dni)</div></div>
    <div class="rep-card"><div class="v" style="color:var(--due-overdue)">${act.filter(t => t.due && t.due < td).length}</div><div class="l">Po terminie</div></div>
  </div>
  <div class="rep-box"><h3>Ukończone w ostatnim tygodniu</h3>
    <div class="bars"><div class="goal-line" style="bottom:${goal / max * 100}%"></div>${counts.map(c => `<div class="bar-col"><span class="bar-v">${c || ''}</span><div class="bar ${c < goal ? 'low' : ''}" style="height:${c / max * 78}%"></div></div>`).join('')}</div>
    <div class="bar-l">${days.map(d => `<span>${PL_DAYS_SHORT[dow(d)]} ${parseDate(d).getDate()}</span>`).join('')}</div>
    <div class="prod-goal"><span>Dzienny cel</span><input type="number" class="goal-input" min="1" max="50" value="${goal}" aria-label="Dzienny cel"></div>
  </div>
  <div class="group" style="margin-top:28px"><div class="group-head"><h3>Ostatnia aktywność</h3></div>`;
  const hist = [...state.history].sort((a, b) => b.at - a.at).slice(0, 40);
  html += hist.length ? hist.map(h => {
    const p = proj(h.projectId);
    return `<div class="act-row"><span class="check checked p${h.priority || 4}">${I.check}</span><span class="grow">Ukończono: <b>${esc(h.title)}</b>${p ? ` <span class="muted">· ${esc(projName(p))}</span>` : ''}</span><span class="muted small">${fmtDateTime(h.at)}</span></div>`;
  }).join('') : '<div class="muted" style="padding:14px 0">Brak aktywności – odhacz pierwsze zadanie.</div>';
  return html + '</div>';
}

// ---------- Kalendarz (widok miesiąca) ----------
function renderCalendar() {
  const td = todayStr();
  const base = ui.calMonth || td.slice(0, 8) + '01';
  const first = parseDate(base), y = first.getFullYear(), m = first.getMonth();
  const start = weekStart(base);
  const end = addDays(weekStart(fmtDate(new Date(y, m + 1, 0))), 6);
  const byDay = {};
  active().forEach(t => { if (t.due) (byDay[t.due] = byDay[t.due] || []).push(t); });
  Object.values(byDay).forEach(a => a.sort(byDue));
  const sel = ui.calSel || td;
  let cells = '', i = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const ts = byDay[d] || [];
    const cls = [parseDate(d).getMonth() === m ? '' : 'other', d === td ? 'today' : '', d === sel ? 'sel' : ''].join(' ');
    const chips = ts.slice(0, 3).map(t => `<div class="cal-chip" draggable="true" data-act="open" data-id="${t.id}" style="--c:var(--p${t.priority})" title="${esc(t.title)}"><i class="dot"></i><span>${esc(t.title)}</span></div>`).join('');
    cells += `<div class="cal-cell ${cls}" data-act="cal-day" data-date="${d}" data-drop="day" style="--i:${Math.min(i++, 24)}" title="Kliknij dwukrotnie, aby dodać zadanie">
      <span class="cal-num">${parseDate(d).getDate()}</span>${chips}${ts.length > 3 ? `<div class="cal-more">+${ts.length - 3} więcej</div>` : ''}
      <div class="cal-dots">${ts.slice(0, 6).map(t => `<i style="--c:var(--p${t.priority})"></i>`).join('')}</div></div>`;
  }
  let html = header(`${PL_MON[m]} ${y}`, {
    icon: sz(I.calMonth, 24), barTitle: 'Kalendarz',
    right: `<div class="up-nav"><button class="icon-btn" data-act="cal-nav" data-n="-1" title="Poprzedni miesiąc">${I.left}</button>
      <button class="btn" data-act="cal-nav" data-n="0">Dziś</button>
      <button class="icon-btn" data-act="cal-nav" data-n="1" title="Następny miesiąc">${I.right}</button></div>`,
  });
  html += `<div class="cal-wd">${['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'].map(x => `<span>${x}</span>`).join('')}</div><div class="cal-month">${cells}</div>`;
  const n = diffDays(sel, td), rel = n === 0 ? ' · Dziś' : n === 1 ? ' · Jutro' : n === -1 ? ' · Wczoraj' : '';
  const dayTasks = byDay[sel] || [];
  html += `<div class="group cal-day-panel" data-drop="day" data-date="${sel}">
    <div class="group-head"><h3>${parseDate(sel).getDate()} ${PL_MON_SHORT[parseDate(sel).getMonth()]}${rel} · ${PL_DAYS[dow(sel)]}</h3><span class="count" style="margin-left:2px">${dayTasks.length || ''}</span></div>
    ${dayTasks.map(t => taskRow(t, { showProject: true })).join('')}${addTaskButton('day:' + sel, { due: sel })}</div>`;
  return html;
}

// ---------- Skupienie (Pomodoro + stoper, dokładne śledzenie czasu każdej czynności) ----------
const FOCUS_MODES = { work: ['Pomodoro', 25], short: ['Krótka przerwa', 5], long: ['Długa przerwa', 15], watch: ['Stoper', 0] };
const FZ_KEY = 'listo-fz';
const fz = Object.assign({ mode: 'work', remaining: 25 * 60, endAt: 0, running: false, count: 0, sess: null },
  (() => { try { return JSON.parse(localStorage.getItem(FZ_KEY)) || {}; } catch (e) { return {}; } })());
if (!FOCUS_MODES[fz.mode]) fz.mode = 'work';
const fzPersist = () => { try { localStorage.setItem(FZ_KEY, JSON.stringify(fz)); } catch (e) { /* */ } };
const fzTotal = () => FOCUS_MODES[fz.mode][1] * 60;
const fzLeft = () => fz.running ? Math.max(0, Math.ceil((fz.endAt - Date.now()) / 1000)) : fz.remaining;
const fzActiveMs = () => !fz.sess ? 0 : fz.sess.active + (fz.running && fz.sess.resumedAt ? Date.now() - fz.sess.resumedAt : 0);
const fzTracks = () => fz.mode === 'work' || fz.mode === 'watch';
const fmtMS = s => s >= 3600 ? `${Math.floor(s / 3600)}:${pad(Math.floor(s % 3600 / 60))}:${pad(s % 60)}` : `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
const fzShown = () => fz.mode === 'watch' ? Math.floor(fzActiveMs() / 1000) : fzLeft();
const fzRing = () => fz.mode === 'watch' ? (fzShown() % 3600) / 3600 : fzLeft() / (fzTotal() || 1);
const focusBadge = () => fz.running ? fmtMS(fzShown()) : '';
const fmtClock = ts => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
function fmtDur(sec) {
  sec = Math.round(sec || 0);
  if (!sec) return '0 min';
  if (sec < 60) return sec + ' s';
  const h = Math.floor(sec / 3600), m = Math.round(sec % 3600 / 60);
  return h ? `${h} h${m ? ' ' + m + ' min' : ''}` : `${Math.round(sec / 60)} min`;
}
const sessSec = s => s.sec ?? (s.min || 0) * 60;
const sessStart = s => s.start ?? (s.at - sessSec(s) * 1000);
function focusTotals() { const m = {}; state.focus.sessions.forEach(s => { if (s.taskId) m[s.taskId] = (m[s.taskId] || 0) + sessSec(s); }); return m; }

function fzStart() {
  const now = Date.now();
  if (fzTracks()) {
    if (!fz.sess) fz.sess = { start: now, active: 0, resumedAt: now, pauses: 0, pausedMs: 0, pausedAt: null, taskId: state.focus.taskId || null, kind: fz.mode === 'watch' ? 'stoper' : 'pomodoro', planned: fz.mode === 'work' ? fzTotal() : 0, note: '' };
    else { if (fz.sess.pausedAt) fz.sess.pausedMs += now - fz.sess.pausedAt; fz.sess.pausedAt = null; fz.sess.resumedAt = now; }
  }
  if (fz.mode !== 'watch') fz.endAt = now + fz.remaining * 1000;
  fz.running = true; fzPersist();
}
function fzPause() {
  const now = Date.now();
  if (fz.mode !== 'watch') fz.remaining = fzLeft();
  if (fz.sess && fz.running) { fz.sess.active += now - (fz.sess.resumedAt || now); fz.sess.resumedAt = null; fz.sess.pauses++; fz.sess.pausedAt = now; }
  fz.running = false; fzPersist();
}
// zamyka bieżącą sesję i zapisuje ją w historii (result: complete | stopped | skipped | task-done | switch)
function fzFinish(result) {
  const s = fz.sess;
  if (!s) return null;
  const now = Date.now();
  const end = result === 'complete' && fz.endAt && fz.endAt < now ? fz.endAt : now;
  let ms = s.active + (fz.running && s.resumedAt ? end - s.resumedAt : 0);
  if (s.planned) ms = Math.min(ms, s.planned * 1000);
  if (s.pausedAt) s.pausedMs += now - s.pausedAt;
  fz.sess = null; fzPersist();
  const sec = Math.round(ms / 1000);
  if (sec < 15) return null;
  const t = s.taskId && task(s.taskId);
  const rec = { id: uid(), start: s.start, end, at: end, sec, min: Math.round(sec / 60), taskId: s.taskId || null, title: t ? t.title : '', projectId: t ? t.projectId : null,
    kind: s.kind, planned: s.planned || 0, pauses: s.pauses, pausedSec: Math.round(s.pausedMs / 1000), result, note: (s.note || '').trim() };
  state.focus.sessions.push(rec);
  if (state.focus.sessions.length > 3000) state.focus.sessions.splice(0, state.focus.sessions.length - 3000);
  save();
  return rec;
}
// ciągłe śledzenie: zmiana zadania w trakcie zamyka sesję poprzedniego i od razu zaczyna nową
function fzRestart() { const run = fz.running; if (run) { if (fz.mode !== 'watch') fz.remaining = fzLeft(); fz.running = false; fzStart(); } }
function fzPick(id) {
  if (state.focus.taskId === id) return;
  let rec = null;
  if (fz.sess) {
    if (fzActiveMs() < 15000) fz.sess.taskId = id;
    else { rec = fzFinish('switch'); fzRestart(); }
  }
  state.focus.taskId = id; fzPersist(); commit();
  if (rec) toast(`Zapisano ${fmtDur(rec.sec)} dla „${rec.title || 'bez zadania'}”`);
}
function fzTaskDone(id) {
  if (fz.sess && fz.sess.taskId === id) {
    const rec = fzFinish('task-done');
    if (fz.mode === 'watch') fz.running = false; else fzRestart();
    if (rec) setTimeout(() => toast(`⏱ ${fmtDur(rec.sec)} skupienia zapisane przy ukończonym zadaniu`, null, () => focusReport(id), 'Szczegóły'), 900);
  }
  if (state.focus.taskId === id) state.focus.taskId = null;
  if (fz.sess && fz.sess.taskId === id) fz.sess.taskId = null;
  fzPersist();
}
function fzNext(finished) {
  if (fz.mode === 'watch') return;
  let rec = null;
  if (fz.mode === 'work') { rec = fzFinish(finished ? 'complete' : 'skipped'); fz.count++; fz.mode = fz.count % 4 === 0 ? 'long' : 'short'; }
  else fz.mode = 'work';
  fz.running = false; fz.remaining = fzTotal(); fzPersist();
  if (finished) { playSound('done'); setTimeout(() => playSound('done'), 260); }
  commit();
  if (finished) toast(fz.mode === 'work' ? 'Przerwa skończona – wracamy do pracy' : `Sesja zapisana${rec ? ` (${fmtDur(rec.sec)})` : ''} – czas na przerwę`);
}
function fzSetMode(m) {
  if (m === fz.mode) return;
  const rec = fzFinish('stopped');
  fz.running = false; fz.mode = m; fz.remaining = fzTotal(); fzPersist(); render();
  if (rec) toast(`Zapisano sesję: ${fmtDur(rec.sec)}`);
}

function renderFocus() {
  const tab = ui.fzTab || 'timer';
  let html = header('Skupienie', { icon: sz(I.timer, 24), sub: 'Mierz dokładny czas pracy nad zadaniami – minutnikiem Pomodoro albo stoperem. Każda sesja trafia do historii.' });
  html += `<div class="fz-tabs" role="tablist">${[['timer', 'Minutnik', I.timer], ['history', 'Historia sesji', I.history], ['tasks', 'Czas zadań', I.list2]].map(([k, l, ic]) =>
    `<button role="tab" class="${tab === k ? 'sel' : ''}" data-act="fz-tab" data-t="${k}">${sz(ic, 16)}<span>${l}</span></button>`).join('')}</div>`;
  return html + (tab === 'history' ? focusHistory() : tab === 'tasks' ? focusTasks() : focusTimer());
}
function focusTimeline(sessions, withLive) {
  const items = sessions.map(s => ({ a: sessStart(s), b: s.end || s.at, c: (proj(s.projectId)?.color && proj(s.projectId).color !== '#808080') ? proj(s.projectId).color : 'var(--accent)', t: `${fmtClock(sessStart(s))}–${fmtClock(s.end || s.at)} · ${fmtDur(sessSec(s))}${s.title ? ' · ' + s.title : ''}` }));
  if (withLive && fz.sess) items.push({ a: fz.sess.start, b: Date.now(), c: 'var(--due-today)', t: 'Bieżąca sesja', live: true });
  let h0 = 6;
  items.forEach(i => { h0 = Math.min(h0, new Date(i.a).getHours()); });
  const span = (24 - h0) * 60;
  const pos = ts => { const d = new Date(ts); return Math.max(0, Math.min(100, ((d.getHours() - h0) * 60 + d.getMinutes()) / span * 100)); };
  const ticks = []; for (let h = h0; h <= 24; h += 3) ticks.push(`<span style="left:${(h - h0) * 60 / span * 100}%">${h}</span>`);
  const nowP = pos(Date.now());
  return `<div class="fz-tl"><div class="fz-tl-bar">${items.map(i => `<i class="${i.live ? 'live' : ''}" style="left:${pos(i.a)}%;width:${Math.max(.8, pos(i.b) - pos(i.a))}%;--c:${i.c}" title="${esc(i.t)}"></i>`).join('')}<b class="fz-tl-now" style="left:${nowP}%"></b></div><div class="fz-tl-ticks">${ticks.join('')}</div></div>`;
}
function focusTimer() {
  const C = 2 * Math.PI * 46, s = fz.sess;
  const ft = state.focus.taskId && task(state.focus.taskId);
  const ftActive = ft && !ft.completed ? ft : null;
  const td = todayStr(), S = state.focus.sessions;
  const todaySess = S.filter(x => fmtDate(new Date(sessStart(x))) === td);
  const todaySec = todaySess.reduce((a, x) => a + sessSec(x), 0);
  const weekSec = S.filter(x => x.at > Date.now() - 7 * 864e5).reduce((a, x) => a + sessSec(x), 0);
  const cands = active().filter(t => !t.parentId).sort(byDue).slice(0, 40);
  const tot = ui.fzTotals || {};
  const paused = s ? Math.round((s.pausedMs + (s.pausedAt ? Date.now() - s.pausedAt : 0)) / 1000) : 0;
  const started = s || (fz.mode !== 'watch' && fz.remaining < fzTotal());
  const days = [...Array(7)].map((_, i) => addDays(td, i - 6));
  const perDay = days.map(d => S.filter(x => fmtDate(new Date(sessStart(x))) === d).reduce((a, x) => a + sessSec(x), 0));
  const maxD = Math.max(1, ...perDay);
  return `<div class="focus-wrap ${fz.running ? 'focus-running' : ''}">
    <div class="focus-main">
      <div class="focus-modes" role="group" aria-label="Tryb">${Object.entries(FOCUS_MODES).map(([k, [l]]) => `<button data-act="fz-mode" data-m="${k}" class="${fz.mode === k ? 'sel' : ''}">${l}</button>`).join('')}</div>
      <div class="focus-ring ${fz.mode === 'short' || fz.mode === 'long' ? 'brk' : ''} ${fz.mode === 'watch' ? 'watch' : ''}">
        <svg viewBox="0 0 100 100" aria-hidden="true"><circle class="track" cx="50" cy="50" r="46" fill="none" stroke-width="3"/>
          <circle class="prog" id="fz-ring" cx="50" cy="50" r="46" fill="none" stroke-width="3.2" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - fzRing())}"/></svg>
        <div class="focus-time"><strong id="fz-time">${fmtMS(fzShown())}</strong><span>${fz.mode === 'watch' ? 'Stoper · liczy, aż go zatrzymasz' : `${FOCUS_MODES[fz.mode][0]} · sesja ${fz.count % 4 + 1} z 4`}</span></div>
      </div>
      <div class="focus-ctrl">
        <button class="icon-btn" data-act="fz-reset" title="Zacznij od nowa (bieżąca sesja zostanie zapisana)">${sz(I.repeat, 20)}</button>
        <button class="btn primary fz-main-btn" data-act="fz-toggle">${fz.running ? 'Pauza' : started ? 'Wznów' : 'Start'}</button>
        ${fz.mode === 'watch' ? `<button class="icon-btn" data-act="fz-stop" title="Zatrzymaj i zapisz" ${s ? '' : 'disabled'}>${sz(I.stop, 20)}</button>` : `<button class="icon-btn" data-act="fz-skip" title="Pomiń do następnego etapu">${I.right}</button>`}
      </div>
      ${s ? `<div class="fz-live">
        <div class="fz-live-row"><div><span>Początek</span><b>${fmtClock(s.start)}</b></div><div><span>Czas pracy</span><b id="fz-live-active">${fmtMS(Math.floor(fzActiveMs() / 1000))}</b></div><div><span>Pauzy</span><b>${s.pauses}${paused ? ` · ${fmtDur(paused)}` : ''}</b></div>
        <button class="btn ghost sm" data-act="fz-stop">${sz(I.stop, 14)} Zakończ i zapisz</button></div>
        <input class="fz-note" placeholder="Notatka do tej sesji – co udało się zrobić?" value="${esc(s.note || '')}" maxlength="300" aria-label="Notatka do sesji"></div>` : ''}
      <div class="focus-task">${ftActive ? taskRow(ftActive, { showProject: true, noDrag: true }) : '<div class="focus-task-empty">Wybierz po prawej zadanie, nad którym pracujesz – czas będzie liczony właśnie dla niego. Odhaczysz je tutaj, gdy skończysz.</div>'}</div>
    </div>
    <aside class="focus-side">
      <h3>Dzisiaj</h3>
      <div class="focus-stats"><div><b>${todaySess.length}</b><span>sesji dziś</span></div><div><b>${fmtDur(todaySec)}</b><span>skupienia dziś</span></div>
        <div><b>${fmtDur(weekSec)}</b><span>w 7 dni</span></div><div><b>${fz.count}</b><span>pomodoro teraz</span></div></div>
      ${focusTimeline(todaySess, true)}
      <div class="fz-week">${perDay.map((v, i) => `<div class="${days[i] === td ? 'today' : ''}" title="${fmtDur(v)}"><i style="--h:${(v / maxD * 100).toFixed(1)}%"></i><span>${PL_DAYS_SHORT[dow(days[i])]}</span></div>`).join('')}</div>
      <h3>Pracuję nad…</h3>
      <div class="focus-pick">${cands.map(t => { const di = dueInfo(t.due, t.time); return `<button data-act="fz-pick" data-id="${t.id}" class="${t.id === state.focus.taskId ? 'sel' : ''}"><span class="check p${t.priority}"></span><span class="grow">${esc(t.title)}</span>${tot[t.id] ? `<span class="fz-pick-t">${fmtDur(tot[t.id])}</span>` : ''}${di ? `<span class="meta-item due ${di.cls}" style="font-size:11px">${di.label}</span>` : ''}</button>`; }).join('')}</div>
    </aside>
  </div>`;
}
const FZ_RESULT = { complete: ['Pełna sesja', 'ok'], stopped: ['Zatrzymana', ''], skipped: ['Przerwana', 'warn'], 'task-done': ['Zadanie ukończone', 'ok'], switch: ['Zmiana zadania', ''] };
function sessRow(s, i) {
  const t = s.taskId && task(s.taskId), title = t ? t.title : s.title, p = proj(s.projectId);
  const [rl, rc] = FZ_RESULT[s.result || 'complete'] || ['', ''];
  return `<div class="fh-row" style="--i:${Math.min(i, 16)}">
    <span class="fh-time">${fmtClock(sessStart(s))}–${fmtClock(s.end || s.at)}</span>
    <span class="fh-dur">${fmtDur(sessSec(s))}</span>
    <div class="grow fh-main">
      ${s.taskId ? `<button class="fh-title" data-act="focus-report" data-id="${s.taskId}">${esc(title || 'Zadanie')}${t?.completed ? ` <span class="fh-done">${sz(I.done, 13)}</span>` : ''}</button>` : '<span class="fh-title muted">Bez przypisanego zadania</span>'}
      <div class="fh-meta"><span class="fh-chip">${s.kind === 'stoper' ? 'Stoper' : 'Pomodoro'}</span>${rl ? `<span class="fh-chip ${rc}">${rl}</span>` : ''}${s.pauses ? `<span>${s.pauses} ${plural(s.pauses, 'pauza', 'pauzy', 'pauz')}${s.pausedSec ? ' · ' + fmtDur(s.pausedSec) : ''}</span>` : ''}${p ? `<span>#${esc(projName(p))}</span>` : ''}</div>
      ${s.note ? `<div class="fh-note">${esc(s.note)}</div>` : ''}
    </div>
    <button class="icon-btn" data-act="fz-sess-note" data-sid="${s.id}" title="${s.note ? 'Edytuj notatkę' : 'Dodaj notatkę'}">${I.edit}</button>
    <button class="icon-btn" data-act="fz-sess-del" data-sid="${s.id}" title="Usuń sesję">${I.trash}</button>
  </div>`;
}
function focusHistory() {
  const range = ui.fzRange || '7';
  const from = range === 'all' ? 0 : Date.now() - (+range) * 864e5;
  const ss = state.focus.sessions.filter(s => sessStart(s) >= from).sort((a, b) => sessStart(b) - sessStart(a));
  const total = ss.reduce((a, s) => a + sessSec(s), 0);
  const longest = ss.reduce((m, s) => Math.max(m, sessSec(s)), 0);
  const per = {}; ss.forEach(s => { if (s.taskId) per[s.taskId] = (per[s.taskId] || 0) + sessSec(s); });
  const topId = Object.keys(per).sort((a, b) => per[b] - per[a])[0];
  const topTitle = topId ? (task(topId)?.title || ss.find(s => s.taskId === topId)?.title || '') : '';
  let html = `<div class="fh-bar"><div class="seg-inline" role="group" aria-label="Zakres">${[['7', '7 dni'], ['30', '30 dni'], ['all', 'Wszystko']].map(([v, l]) => `<button class="${range === v ? 'sel' : ''}" data-act="fz-range" data-v="${v}">${l}</button>`).join('')}</div></div>
    <div class="rep-cards fh-cards">
      <div class="rep-card"><div class="v">${fmtDur(total)}</div><div class="l">Łączny czas</div></div>
      <div class="rep-card"><div class="v">${ss.length}</div><div class="l">Sesje</div></div>
      <div class="rep-card"><div class="v">${fmtDur(ss.length ? total / ss.length : 0)}</div><div class="l">Średnia sesja</div></div>
      <div class="rep-card"><div class="v">${fmtDur(longest)}</div><div class="l">Najdłuższa</div></div>
    </div>
    ${topId ? `<button class="fh-top" data-act="focus-report" data-id="${topId}">${sz(I.timer, 16)}<span>Najwięcej czasu: <b>${esc(topTitle)}</b></span><span class="muted">${fmtDur(per[topId])}</span></button>` : ''}`;
  if (!ss.length) return html + emptyState('Brak sesji w tym okresie', 'Uruchom minutnik lub stoper w zakładce „Minutnik” – każda sesja zapisze się tutaj.');
  let last = null, i = 0;
  const td = todayStr();
  ss.forEach(s => {
    const d = fmtDate(new Date(sessStart(s)));
    if (d !== last) {
      last = d;
      const dayS = ss.filter(x => fmtDate(new Date(sessStart(x))) === d);
      const n = diffDays(td, d);
      html += `<div class="group-head fh-day"><h3>${shortDate(d)}${n === 0 ? ' · Dziś' : n === 1 ? ' · Wczoraj' : ''} · ${PL_DAYS[dow(d)]}</h3><span class="muted small">${fmtDur(dayS.reduce((a, x) => a + sessSec(x), 0))} · ${dayS.length} ${plural(dayS.length, 'sesja', 'sesje', 'sesji')}</span></div>`;
    }
    html += sessRow(s, i++);
  });
  return html;
}
function focusTasks() {
  const agg = {};
  state.focus.sessions.forEach(s => {
    if (!s.taskId) return;
    const a = agg[s.taskId] = agg[s.taskId] || { id: s.taskId, sec: 0, n: 0, last: 0, title: s.title };
    a.sec += sessSec(s); a.n++; a.last = Math.max(a.last, s.end || s.at); if (s.title) a.title = s.title;
  });
  const list = Object.values(agg).sort((a, b) => b.last - a.last);
  if (!list.length) return emptyState('Jeszcze nie mierzono czasu', 'Wybierz zadanie w „Minutniku” i uruchom sesję – tutaj zobaczysz łączny czas każdego zadania, także po jego ukończeniu.');
  const max = Math.max(...list.map(a => a.sec));
  return `<div class="ft-list">${list.map((a, i) => {
    const t = task(a.id);
    const st = !t ? '<span class="fh-chip">Usunięte</span>' : t.completed ? `<span class="fh-chip ok">${sz(I.done, 12)} Ukończone ${t.completedAt ? shortDate(fmtDate(new Date(t.completedAt))) : ''}</span>` : '<span class="fh-chip">W toku</span>';
    return `<button class="ft-row" data-act="focus-report" data-id="${a.id}" style="--i:${Math.min(i, 16)}">
      <span class="check p${t ? t.priority : 4} ${t?.completed ? 'checked' : ''}" style="pointer-events:none">${t?.completed ? I.check : ''}</span>
      <span class="grow"><span class="ft-title">${esc(t ? t.title : a.title || 'Zadanie')}</span><span class="ft-meta">${st}<span>${a.n} ${plural(a.n, 'sesja', 'sesje', 'sesji')}</span><span>ostatnio ${fmtDateTime(a.last)}</span></span>
        <span class="ft-bar"><i style="--w:${(a.sec / max * 100).toFixed(1)}%"></i></span></span>
      <b class="ft-sum">${fmtDur(a.sec)}</b></button>`;
  }).join('')}</div>`;
}
function focusReport(id) {
  const ss = state.focus.sessions.filter(s => s.taskId === id).sort((a, b) => sessStart(a) - sessStart(b));
  const t = task(id);
  const title = t ? t.title : (ss[ss.length - 1]?.title || 'Zadanie');
  const total = ss.reduce((a, s) => a + sessSec(s), 0);
  const longest = ss.reduce((m, s) => Math.max(m, sessSec(s)), 0);
  const pauses = ss.reduce((a, s) => a + (s.pauses || 0), 0), pausedSec = ss.reduce((a, s) => a + (s.pausedSec || 0), 0);
  const byDay = {}; ss.forEach(s => { const d = fmtDate(new Date(sessStart(s))); byDay[d] = (byDay[d] || 0) + sessSec(s); });
  const dayKeys = Object.keys(byDay).sort().slice(-14), maxD = Math.max(1, ...dayKeys.map(d => byDay[d]));
  const p = t && proj(t.projectId);
  const status = !t ? 'Zadanie zostało usunięte' : t.completed ? `Ukończone ${fmtDateTime(t.completedAt)}` : 'W toku';
  const html = `<div class="fr">
    <div class="fr-head"><span class="fh-chip ${t?.completed ? 'ok' : ''}">${status}</span>${p ? `<span class="muted small"># ${esc(projName(p))}</span>` : ''}</div>
    ${ss.length ? `<div class="fr-cards">
      <div><b>${fmtDur(total)}</b><span>łączny czas</span></div><div><b>${ss.length}</b><span>${plural(ss.length, 'sesja', 'sesje', 'sesji')}</span></div>
      <div><b>${fmtDur(total / ss.length)}</b><span>średnio</span></div><div><b>${fmtDur(longest)}</b><span>najdłuższa</span></div>
      <div><b>${pauses}</b><span>pauzy${pausedSec ? ' · ' + fmtDur(pausedSec) : ''}</span></div><div><b>${dayKeys.length}</b><span>${plural(Object.keys(byDay).length, 'dzień pracy', 'dni pracy', 'dni pracy')}</span></div>
    </div>
    <div class="fr-span muted small">Pierwsza sesja: <b>${fmtDateTime(sessStart(ss[0]))}</b> · ostatnia: <b>${fmtDateTime(ss[ss.length - 1].end || ss[ss.length - 1].at)}</b></div>
    <div class="fr-days">${dayKeys.map(d => `<div title="${shortDate(d)}: ${fmtDur(byDay[d])}"><i style="--h:${(byDay[d] / maxD * 100).toFixed(1)}%"></i><span>${parseDate(d).getDate()}.${pad(parseDate(d).getMonth() + 1)}</span></div>`).join('')}</div>
    <div class="fr-list">${[...ss].reverse().map(s => `<div class="fr-row"><span>${shortDate(fmtDate(new Date(sessStart(s))))}</span><span>${fmtClock(sessStart(s))}–${fmtClock(s.end || s.at)}</span><b>${fmtDur(sessSec(s))}</b><span class="muted">${s.kind === 'stoper' ? 'Stoper' : 'Pomodoro'}${s.pauses ? ` · ${s.pauses} ${plural(s.pauses, 'pauza', 'pauzy', 'pauz')}` : ''}${(FZ_RESULT[s.result] || [''])[0] && s.result !== 'complete' ? ' · ' + FZ_RESULT[s.result][0].toLowerCase() : ''}</span>${s.note ? `<div class="fr-note">${esc(s.note)}</div>` : ''}</div>`).join('')}</div>`
    : '<p class="muted">Dla tego zadania nie zapisano jeszcze żadnej sesji skupienia.</p>'}
    ${t && !t.completed ? `<button type="button" class="btn primary fr-go" data-fr="go">${sz(I.play, 14)} ${fz.sess && fz.sess.taskId === id ? 'Przejdź do sesji' : 'Skup się na tym zadaniu'}</button>` : ''}
  </div>`;
  openDialog({ title, html, cls: 'fr-dialog' });
  $('#dialog-root [data-fr="go"]')?.addEventListener('click', () => { closeDialog(); focusOn(id); });
}
// rozpocznij skupienie na zadaniu jednym kliknięciem (z dowolnego miejsca)
function focusOn(id) {
  ui.modal = null;
  if (!fzTracks()) { fz.mode = 'work'; fz.remaining = fzTotal(); }
  fzPick(id);
  if (!fz.running) { fzStart(); playSound('restore'); }
  ui.fzTab = 'timer';
  setView({ type: 'focus' });
}
setInterval(() => {
  if (!fz.running) return;
  const shown = fzShown();
  const tEl = $('#fz-time');
  if (tEl) {
    tEl.textContent = fmtMS(shown);
    $('#fz-ring')?.setAttribute('stroke-dashoffset', 2 * Math.PI * 46 * (1 - fzRing()));
    document.title = `${fmtMS(shown)} – ${FOCUS_MODES[fz.mode][0]}`;
  }
  const la = $('#fz-live-active');
  if (la) la.textContent = fmtMS(Math.floor(fzActiveMs() / 1000));
  $$('.fz-tick').forEach(el => { el.textContent = fmtMS(shown); });
  const badge = $('.nav-item[data-view="focus"] .count');
  if (badge) badge.textContent = fmtMS(shown);
  if (fz.mode !== 'watch' && fzLeft() <= 0) fzNext(true);
}, 500);
document.addEventListener('input', e => { if (e.target.classList?.contains('fz-note') && fz.sess) { fz.sess.note = e.target.value; fzPersist(); } });

// ---------- Wyszukiwanie ----------
function renderSearch() {
  return `${header('Szukaj')}<div class="search-box">${I.search}<input class="search-input" placeholder="Szukaj zadań, projektów, etykiet…" value="${esc(ui.view.q || '')}" aria-label="Szukaj"></div><div id="search-results"></div>`;
}
function updateSearchResults() {
  const box = $('#search-results');
  if (!box) return;
  const q = (ui.view.q || '').trim().toLowerCase();
  if (!q) { box.innerHTML = searchHelp(); return; }
  try { const rs = JSON.parse(localStorage.getItem('listo-recent-q') || '[]').filter(x => x !== q); rs.unshift(q); clearTimeout(updateSearchResults.t); updateSearchResults.t = setTimeout(() => { try { localStorage.setItem('listo-recent-q', JSON.stringify(rs.slice(0, 6))); } catch (e) { /* */ } }, 1200); } catch (e) { /* */ }
  const isQuery = /[&|!@#]|^p[1-4]$|^(today|overdue|no date|\d+ days)$/.test(q);
  const tasks = state.tasks.filter(t => isQuery ? (!t.completed && evalQuery(q, t)) : (t.title + ' ' + t.description).toLowerCase().includes(q)).sort((a, b) => a.completed - b.completed || byDue(a, b));
  const projects = state.projects.filter(p => p.name.toLowerCase().includes(q));
  const labels = state.labels.filter(l => l.name.toLowerCase().includes(q));
  let html = '';
  if (projects.length) html += `<div class="search-section">Projekty</div>` + projects.map(p => `<div class="fl-item" data-act="nav" data-view="project" data-id="${p.id}"><span class="hash" style="color:${p.color};width:18px;text-align:center">#</span><span class="grow">${esc(p.name)}</span></div>`).join('');
  if (labels.length) html += `<div class="search-section">Etykiety</div>` + labels.map(l => `<div class="fl-item" data-act="nav" data-view="label" data-id="${l.id}"><span style="color:${l.color}">${I.tag}</span><span class="grow">${esc(l.name)}</span></div>`).join('');
  html += `<div class="search-section">Zadania (${tasks.length})</div>` + (tasks.length ? tasks.slice(0, 100).map(t => taskRow(t, { showProject: true, noDrag: true })).join('') : '<div class="muted" style="padding:12px 0">Brak wyników.</div>');
  box.innerHTML = html;
}

// ---------- modal zadania ----------
function renderModal() {
  const root = $('#modal-root'), m = ui.modal;
  if (!m) { root.innerHTML = ''; root.dataset.key = ''; return; }
  if (m.type === 'quick') {
    if (root.dataset.key === 'quick' && $('.quick-modal', root)) {
      $('.quick-modal', root).innerHTML = addTaskButton('quick', ui.addForm?.defaults || {});
      if (ui.addForm?.ctx === 'quick') return;
    }
    root.dataset.key = 'quick';
    if (!ui.addForm || ui.addForm.ctx !== 'quick') { ui.modal = null; root.innerHTML = ''; return; }
    root.innerHTML = `<div class="overlay top" data-act="modal-bg"><div class="modal quick-modal" role="dialog" aria-label="Szybkie dodawanie">${addTaskButton('quick', ui.addForm.defaults)}</div></div>`;
    return;
  }
  const t = task(m.id);
  if (!t) { ui.modal = null; root.innerHTML = ''; return; }
  const sc = $('.tm-main', root)?.scrollTop || 0;
  const fresh = root.dataset.key !== t.id;
  root.innerHTML = renderTaskModal(t);
  root.dataset.key = t.id;
  if (!fresh) $('.modal', root).style.animation = 'none';
  else if (lastPointer.at && Date.now() - lastPointer.at < 800) {
    // okno zadania „wyrasta” z miejsca kliknięcia
    const md = $('.modal', root), r = md.getBoundingClientRect();
    md.style.transformOrigin = `${Math.round(lastPointer.x - r.left)}px ${Math.round(lastPointer.y - r.top)}px`;
  }
  $$('.tm-title, .tm-desc', root).forEach(autoGrow);
  const main = $('.tm-main', root);
  if (main) main.scrollTop = sc;
}
function renderTaskModal(t) {
  const p = proj(t.projectId), sec = sectionOf(t), parent = t.parentId ? task(t.parentId) : null;
  const di = dueInfo(t.due, t.time);
  const subs = kids(t.id, true);
  const subsDone = subs.filter(s => s.completed).length;
  const siblings = currentTaskList();
  const idx = siblings.indexOf(t.id);
  return `<div class="overlay" data-act="modal-bg"><div class="modal task-modal" role="dialog" aria-label="Szczegóły zadania">
    <div class="tm-head">
      <div class="crumbs"><span class="hash" style="color:${p?.color}">#</span><a data-act="nav" data-view="project" data-id="${p?.id}">${esc(projName(p))}</a>${sec ? ` / <span>${esc(sec.name)}</span>` : ''}${parent ? ` / <a data-act="open" data-id="${parent.id}">${esc(parent.title)}</a>` : ''}</div>
      <div style="display:flex;gap:2px">
        <button class="icon-btn" data-act="open" data-id="${siblings[idx - 1] || ''}" ${idx > 0 ? '' : 'disabled'} title="Poprzednie zadanie" aria-label="Poprzednie">${I.left.replace('M15 6l-6 6 6 6', 'M6 15l6-6 6 6')}</button>
        <button class="icon-btn" data-act="open" data-id="${siblings[idx + 1] || ''}" ${idx >= 0 && idx < siblings.length - 1 ? '' : 'disabled'} title="Następne zadanie" aria-label="Następne">${I.chevronDown}</button>
        <button class="icon-btn" data-act="task-more" data-id="${t.id}" title="Więcej">${I.dots}</button>
        <button class="icon-btn" data-act="modal-close" title="Zamknij (Esc)">${I.x}</button>
      </div>
    </div>
    <div class="tm-body">
      <div class="tm-main">
        <div class="tm-title-row">
          <button class="check p${t.priority} ${t.completed ? 'checked' : ''}" data-act="toggle" data-id="${t.id}" title="${t.completed ? 'Przywróć' : 'Ukończ'}">${I.check}</button>
          <textarea class="tm-title" rows="1" data-field="title" aria-label="Nazwa zadania">${esc(t.title)}</textarea>
        </div>
        <textarea class="tm-desc" rows="1" data-field="description" placeholder="Opis" aria-label="Opis">${esc(t.description)}</textarea>
        <div class="tm-block">
          <h4>Zadania podrzędne ${subs.length ? `<span class="muted">${subsDone}/${subs.length}</span>` : ''}</h4>
          <div class="subtasks">${subs.map(k => taskRow(k, { nested: true, showDone: true })).join('')}</div>
          ${addTaskButton('sub:' + t.id, { parentId: t.id, projectId: t.projectId, sectionId: t.sectionId })}
        </div>
        <div class="tm-block">
          <h4>Komentarze ${t.comments.length ? `<span class="muted">${t.comments.length}</span>` : ''}</h4>
          ${t.comments.map(c => `<div class="comment"><span class="avatar">L</span><div class="cbody">
            <div class="chead"><strong>Ty</strong><span class="muted small">${fmtDateTime(c.at)}</span>
            <button class="icon-btn" data-act="comment-del" data-id="${t.id}" data-cid="${c.id}" title="Usuń komentarz">${I.trash}</button></div>
            <div class="ctext">${fmtText(c.text)}</div></div></div>`).join('')}
          <div class="comment-form"><textarea class="cm-input" rows="1" placeholder="Napisz komentarz… (Ctrl+Enter)" aria-label="Komentarz"></textarea><button class="btn primary" data-act="comment-add" data-id="${t.id}">Skomentuj</button></div>
        </div>
      </div>
      <aside class="tm-side">
        <div class="side-field"><label>Projekt</label><button class="side-btn" data-act="tm-project" data-id="${t.id}"><span class="hash" style="color:${p?.color}">#</span> ${esc(projName(p))}${sec ? ' / ' + esc(sec.name) : ''}</button></div>
        <div class="side-field"><label>Termin</label><button class="side-btn ${di ? di.cls : ''}" data-act="task-date" data-id="${t.id}">${I.cal} ${di ? di.label : 'Bez terminu'} ${t.recurring ? I.repeat + ' ' + REC_LABEL[t.recurring].toLowerCase() : ''}</button></div>
        <div class="side-field"><label>Priorytet</label><button class="side-btn" data-act="tm-prio" data-id="${t.id}">${flagIcon(t.priority)} P${t.priority}${t.autoSet != null && !t.completed ? ` <span class="ap-tag">${sz(I.bolt, 11)} auto</span>` : ''}</button>
          ${t.autoSet != null && !t.completed ? `<div class="small muted ap-why">${esc(t.autoWhy || '')} · Twój: P${t.prio0} · <button class="link-btn" data-act="ap-exclude" data-id="${t.id}">Nie zmieniaj automatycznie</button></div>` : ''}</div>
        <div class="side-field"><label>Czas skupienia</label>${ui.fzTotals?.[t.id] ? `<button class="side-btn" data-act="focus-report" data-id="${t.id}">${sz(I.timer, 16)} ${fmtDur(ui.fzTotals[t.id])} · ${state.focus.sessions.filter(s => s.taskId === t.id).length} sesji</button>` : '<div class="small muted" style="padding:4px 0">Nie mierzono jeszcze</div>'}
          ${t.completed ? '' : `<button class="side-btn fz-go" data-act="focus-on" data-id="${t.id}">${sz(I.play, 14)} ${fz.sess && fz.sess.taskId === t.id ? 'Trwa sesja – przejdź' : 'Skup się na tym zadaniu'}</button>`}</div>
        <div class="side-field"><label>Etykiety</label><button class="side-btn" data-act="tm-labels" data-id="${t.id}">${I.tag} ${t.labels.length ? 'Zmień' : 'Dodaj etykiety'}</button>
          ${t.labels.length ? `<div class="label-chips">${t.labels.map(id => label(id)).filter(Boolean).map(l => `<span class="label-chip" style="color:${l.color}">${I.tag} ${esc(l.name)}</span>`).join('')}</div>` : ''}</div>
        <div class="side-field" style="border:0"><label>Utworzono</label><div class="small muted">${fmtDateTime(t.createdAt)}</div></div>
      </aside>
    </div>
  </div></div>`;
}
function fmtDateTime(ts) {
  const d = new Date(ts);
  return `${d.getDate()} ${PL_MON_SHORT[d.getMonth()]} ${d.getFullYear() !== new Date().getFullYear() ? d.getFullYear() + ' ' : ''}${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function currentTaskList() { return $$('#main .task[data-id]').map(el => el.dataset.id); }
function openTask(id, focusTitle) {
  if (!task(id)) return;
  ui.modal = { type: 'task', id };
  if (ui.addForm && !ui.addForm.ctx.startsWith('sub:' + id)) ui.addForm = null;
  if (focusTitle) ui.focusSel = '.tm-title';
  closePopover();
  render();
}
function closeModal() {
  animateOut($('#modal-root .overlay'), () => {
    if (ui.addForm && (ui.addForm.ctx === 'quick' || ui.addForm.ctx.startsWith('sub:'))) ui.addForm = null;
    ui.modal = null;
    render();
  });
}
// krótka animacja zamykania nakładki, potem właściwa zmiana stanu
function animateOut(overlay, done) {
  if (!overlay || REDUCED || overlay.classList.contains('closing')) { if (!overlay?.classList.contains('closing')) done(); return; }
  overlay.classList.add('closing');
  setTimeout(done, 150);
}
function openQuick() {
  const v = ui.view, d = { projectId: 'inbox' };
  if (v.type === 'project') d.projectId = v.id;
  if (v.type === 'today') d.due = todayStr();
  if (v.type === 'label') d.labels = [v.id];
  if (v.type === 'calendar') d.due = ui.calSel || todayStr();
  ui.modal = { type: 'quick' };
  openForm('quick', d);
}

// ================================================================
//  Akcje na zadaniach
// ================================================================
function nextDue(t) {
  const td = todayStr();
  const step = x => {
    const p = parseDate(x);
    switch (t.recurring) {
      case 'weekdays': { let n = addDays(x, 1); while (dow(n) === 0 || dow(n) === 6) n = addDays(n, 1); return n; }
      case 'weekly': return addDays(x, 7);
      case 'monthly': {
        const day = parseDate(t.due || x).getDate();
        const n = new Date(p.getFullYear(), p.getMonth() + 1, 1);
        n.setDate(Math.min(day, new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate()));
        return fmtDate(n);
      }
      case 'yearly': return fmtDate(new Date(p.getFullYear() + 1, p.getMonth(), p.getDate()));
      default: return addDays(x, 1);
    }
  };
  let d = step(t.due || td), guard = 0;
  while (d <= td && guard++ < 2000) d = step(d);
  return d;
}

function toggleTask(id) {
  const t = task(id);
  if (!t) return;
  const snap = snapshot();
  if (t.completed) {
    const rows = $$(`.task[data-id="${id}"]`);
    rows.forEach(r => r.classList.add('restoring'));
    playSound('restore');
    if (ui.view.type === 'completed') rows.forEach(r => collapseRow(r.closest('.task-wrap')));
    setTimeout(() => {
      // cofnij wpis ukończenia (statystyki, pasek dnia, karma) – inaczej wielokrotne odhaczanie liczyłoby się kilka razy
      const at0 = (t.completedAt || Date.now()) - 120000;
      for (let i = state.history.length - 1; i >= 0; i--) {
        const h = state.history[i];
        if (h.id ? h.id === t.id : (h.title === t.title && h.projectId === t.projectId && h.at >= at0)) { state.history.splice(i, 1); break; }
      }
      karmaOnUndo(t);
      t.completed = false; t.completedAt = null;
      let par = t.parentId && task(t.parentId);
      while (par) { if (par.completed) { par.completed = false; par.completedAt = null; } par = par.parentId && task(par.parentId); }
      markEnter(id);
      commit();
      toast('Zadanie przywrócone', snap);
    }, REDUCED ? 0 : 260);
    return;
  }
  const rows = $$(`.task[data-id="${id}"]`);
  rows.forEach(r => r.classList.add('completing'));
  $$(`.check[data-id="${id}"]`).forEach(c => { c.classList.add('pop'); burst(c, t.priority); });
  playSound('done');
  const keep = t.recurring || !!ui.showCompleted[t.projectId];
  setTimeout(() => {
    if (!keep) rows.forEach(r => collapseRow(r.closest('.task-wrap')));
    setTimeout(() => {
      state.history.push({ id: t.id, title: t.title, at: Date.now(), projectId: t.projectId, priority: t.priority }); karmaOnDone(t);
      if (state.history.length > 1000) state.history.splice(0, state.history.length - 1000);
      fzTaskDone(t.id);
      if (t.recurring) {
        t.due = nextDue(t);
        commit();
        toast(`Następny termin: ${dueInfo(t.due, t.time).label}`, snap);
      } else {
        t.completed = true; t.completedAt = Date.now();
        descendants(t.id).forEach(d => { if (!d.completed) { d.completed = true; d.completedAt = Date.now(); } });
        commit();
        toast('Ukończono 1 zadanie', snap);
      }
      const td = todayStr();
      const doneToday = state.history.filter(h => fmtDate(new Date(h.at)) === td).length;
      const leftToday = active().some(x => x.due && x.due <= td);
      if (doneToday === (state.settings.dailyGoal || 5)) { celebrate(); toast(`🎉 Dzienny cel osiągnięty: ${doneToday} zadań!`, snap); }
      else if (ui.view.type === 'today' && !leftToday) celebrate();
    }, keep ? 60 : 240);
  }, REDUCED ? 0 : 230);
}

// ---------- animacje i dźwięk ----------
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
function collapseRow(wrap) {
  if (!wrap || REDUCED) return;
  wrap.style.height = wrap.offsetHeight + 'px';
  wrap.style.overflow = 'hidden';
  void wrap.offsetHeight;
  wrap.classList.add('row-out');
  wrap.style.height = '0px';
}
function celebrate() {
  if (REDUCED || state.settings.confetti === false || state.settings.anim === 'off') return;
  const cols = ['#ff8a80', '#ffd180', '#a5d6a7', '#90caf9', '#ce93d8', '#ffab91', '#80deea'];
  const box = document.createElement('div');
  box.className = 'confetti';
  for (let i = 0; i < 70; i++) {
    const p = document.createElement('i');
    p.style.cssText = `left:${Math.random() * 100}%;background:${cols[i % cols.length]};--dx:${(Math.random() - .5) * 220}px;--r:${(Math.random() - .5) * 1080}deg;animation-delay:${Math.random() * .35}s;animation-duration:${1.6 + Math.random() * 1.1}s;width:${6 + Math.random() * 5}px;height:${8 + Math.random() * 8}px`;
    box.appendChild(p);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3400);
}
let audioCtx;
function playSound(kind) {
  if (state.settings.sound === false) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = kind === 'done' ? [[784, 0], [1175, 0.07]] : [[660, 0], [523, 0.06]];
    notes.forEach(([f, at]) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain(), t0 = audioCtx.currentTime + at;
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.07, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
      o.connect(g).connect(audioCtx.destination);
      o.start(t0); o.stop(t0 + 0.3);
    });
  } catch (e) { /* brak dźwięku */ }
}
// drobne „iskierki” w kolorze priorytetu wokół odhaczonego kółka
function burst(el, prio) {
  if (REDUCED) return;
  const r = el.getBoundingClientRect();
  if (!r.width) return;
  const b = document.createElement('div');
  b.className = 'burst';
  b.style.left = r.left + r.width / 2 + 'px';
  b.style.top = r.top + r.height / 2 + 'px';
  b.style.setProperty('--c', prio < 4 ? `var(--p${prio})` : 'var(--accent)');
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.random() * .4, d = 16 + Math.random() * 14;
    const p = document.createElement('i');
    p.style.setProperty('--dx', Math.cos(a) * d + 'px');
    p.style.setProperty('--dy', Math.sin(a) * d + 'px');
    p.style.animationDelay = Math.random() * 40 + 'ms';
    b.appendChild(p);
  }
  document.body.appendChild(b);
  setTimeout(() => b.remove(), 800);
}
// zadanie przywracane / dodane – wjeżdża z animacją przy następnym renderze
function markEnter(id) { ui.enter.add(id); }

function moveTask(t, projectId, sectionId) {
  t.projectId = projectId; t.sectionId = sectionId || null;
  if (t.parentId) { const par = task(t.parentId); if (!par || par.projectId !== projectId || (par.sectionId || null) !== t.sectionId) t.parentId = null; }
  t.order = nextOrder();
  descendants(t.id).forEach(d => { d.projectId = projectId; d.sectionId = t.sectionId; });
  commit();
  toast(`Przeniesiono do: ${projName(proj(projectId))}`);
}
function duplicateTask(t) {
  const map = {};
  const copy = (src, parentId, order) => {
    const n = JSON.parse(JSON.stringify(src));
    n.id = uid(); n.parentId = parentId; n.order = order; n.createdAt = Date.now(); n.comments = n.comments.map(c => ({ ...c, id: uid() }));
    map[src.id] = n.id;
    state.tasks.push(n);
    kids(src.id, true).forEach((k, i) => copy(k, n.id, k.order));
    return n;
  };
  const n = copy(t, t.parentId, t.order + 0.5);
  if (!t.title.endsWith(' (kopia)')) n.title = t.title + ' (kopia)';
  commit();
  toast('Zduplikowano zadanie');
}
function deleteTask(t) {
  const n = descendants(t.id).length;
  confirmDlg('Usunąć zadanie?', `Zadanie <b>${esc(t.title)}</b>${n ? ` oraz ${n} ${plural(n, 'zadanie podrzędne', 'zadania podrzędne', 'zadań podrzędnych')}` : ''} zostanie usunięte.`, 'Usuń', () => {
    const snap = snapshot();
    const ids = new Set([t.id, ...descendants(t.id).map(d => d.id)]);
    state.tasks = state.tasks.filter(x => !ids.has(x.id));
    if (ui.modal?.type === 'task' && ids.has(ui.modal.id)) ui.modal = null;
    commit();
    toast('Usunięto zadanie', snap);
  });
}
function rescheduleOverdue() {
  const snap = snapshot(), td = todayStr();
  const ts = active().filter(t => t.due && t.due < td);
  ts.forEach(t => { t.due = td; });
  commit();
  toast(`Przełożono ${ts.length} ${plural(ts.length, 'zadanie', 'zadania', 'zadań')} na dziś`, snap);
}

// ================================================================
//  Toast z „Cofnij”
// ================================================================
let toastTimer;
function toast(msg, snap, action, actionLabel) {
  const root = $('#toast-root');
  clearTimeout(toastTimer);
  if (snap) ui.lastSnap = snap;
  root.innerHTML = `<div class="toast" role="status"><span>${esc(msg)}</span>${snap ? '<button class="toast-undo" data-t="undo">Cofnij</button>' : ''}${action ? `<button class="toast-undo" data-t="act">${esc(actionLabel)}</button>` : ''}<button class="toast-x" data-t="x" aria-label="Zamknij">${sz(I.x, 14)}</button></div>`;
  root.onclick = e => {
    const b = e.target.closest('[data-t]');
    if (!b) return;
    if (b.dataset.t === 'undo') { state = JSON.parse(snap); commit(); }
    if (b.dataset.t === 'act') action();
    hideToast();
  };
  // pasek odliczania; najechanie wstrzymuje znikanie
  root.onmouseenter = () => clearTimeout(toastTimer);
  root.onmouseleave = () => { clearTimeout(toastTimer); toastTimer = setTimeout(hideToast, 2500); };
  toastTimer = setTimeout(hideToast, 6000);
}
function hideToast() {
  const el = $('#toast-root .toast');
  if (!el) return;
  el.classList.add('out');
  setTimeout(() => { if (el.parentNode) el.remove(); }, 180);
}

// ================================================================
//  Popover (menu kontekstowe, wybór daty itp.)
// ================================================================
const pop = $('#popover');
function openPopover(anchor, build) {
  closePopover(true);
  pop.onclick = pop.onchange = pop.oninput = pop.onkeydown = null;
  pop.hidden = false;
  build(pop, () => closePopover());
  $$('.menu-item, .dp2-q, .tp-item', pop).forEach((el, i) => el.style.setProperty('--k', Math.min(i, 12)));
  positionPopover(anchor);
  pop.classList.remove('pop-in'); void pop.offsetWidth; pop.classList.add('pop-in');
}
function positionPopover(anchor) {
  // na telefonie okienka wysuwają się od dołu jak arkusz
  const sheet = innerWidth <= 640;
  pop.classList.toggle('sheet', sheet);
  document.body.classList.toggle('pop-sheet', sheet);
  if (sheet) { pop.style.left = ''; pop.style.top = ''; return; }
  const r = anchor.getBoundingClientRect();
  pop.style.left = '0px'; pop.style.top = '0px';
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  let x = r.left, y = r.bottom + 4;
  if (x + pw > innerWidth - 8) x = innerWidth - pw - 8;
  if (x < 8) x = 8;
  if (y + ph > innerHeight - 8) y = Math.max(8, r.top - ph - 4);
  pop.style.left = x + 'px'; pop.style.top = y + 'px';
}
function closePopover(silent) {
  if (pop.hidden) return;
  pop.hidden = true; pop.innerHTML = '';
  document.body.classList.remove('pop-sheet');
  const f = ui.popOnClose; ui.popOnClose = null;
  if (f && !silent) f();
}
document.addEventListener('mousedown', e => { if (!pop.hidden && !pop.contains(e.target)) closePopover(); });
// zamykaj tylko przy zmianie szerokości – wysunięcie klawiatury na telefonie zmienia wysokość i nie może zamykać okienka
let lastW = innerWidth;
addEventListener('resize', () => { if (Math.abs(innerWidth - lastW) > 40) { lastW = innerWidth; closePopover(); } });

// Wybór terminu – układ 1:1 z Todoist: pole z obecnym terminem, szybkie opcje,
// przewijane miesiące z kropkami zadań, podgląd obciążenia dnia, przyciski Czas / Powtarzanie.
const DOW_DOT = ['Niedz.', 'Pon.', 'Wt.', 'Śr.', 'Czw.', 'Pt.', 'Sob.'];
const DOW_LOW = ['niedz.', 'pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.'];
const capF = s => s.charAt(0).toUpperCase() + s.slice(1);
function datePicker(anchor, cur, cb) {
  const td = todayStr();
  const val = { due: cur.due || null, time: cur.time || null, recurring: cur.recurring || null };
  const counts = {};
  active().forEach(t => { if (t.due) counts[t.due] = (counts[t.due] || 0) + 1; });
  const start = parseDate(val.due && val.due < td ? val.due : td); start.setDate(1);
  const months = [...Array(13)].map((_, i) => new Date(start.getFullYear(), start.getMonth() + i, 1));
  let mode = null, calScroll = null;
  openPopover(anchor, (pop, close) => {
    const set = (patch, closeIt) => {
      Object.assign(val, patch);
      if (!val.due) { val.time = null; val.recurring = null; }
      cb({ ...val });
      if (closeIt) close(); else draw();
    };
    const right = (d, full) => { const p = parseDate(d); return DOW_DOT[p.getDay()] + (full || diffDays(d, td) > 6 ? ` ${p.getDate()} ${capF(PL_MON_SHORT[p.getMonth()])}` : ''); };
    const quick = (icon, text, date, cls, full) => `<button class="dp2-q" data-date="${date}"><span class="qi ${cls}">${icon}</span><span class="grow">${text}</span>${date ? `<span class="dp2-r">${right(date, full)}</span>` : ''}</button>`;
    const monthHtml = (dt, i) => {
      const y = dt.getFullYear(), m = dt.getMonth();
      const off = (new Date(y, m, 1).getDay() + 6) % 7, dim = new Date(y, m + 1, 0).getDate();
      let cells = '<span></span>'.repeat(off);
      for (let d = 1; d <= dim; d++) {
        const ds = fmtDate(new Date(y, m, d)), n = counts[ds] || 0;
        const wdN = new Date(y, m, d).getDay();
        cells += `<button class="dp2-day${wdN === 0 || wdN === 6 ? ' we' : ''}${ds === td ? ' today' : ''}${ds === val.due ? ' sel' : ''}${ds < td ? ' past' : ''}" data-date="${ds}" data-n="${n}">${d}${n ? '<i></i>' : ''}</button>`;
      }
      return `<div class="dp2-month" data-i="${i}">${i ? `<div class="dp2-mlabel">${capF(PL_MON_SHORT[m])}${y !== months[0].getFullYear() ? ' ' + y : ''}</div>` : ''}<div class="dp2-grid">${cells}</div></div>`;
    };
    const label = dt => `${capF(PL_MON_SHORT[dt.getMonth()])} ${dt.getFullYear()}`;
    const draw = () => {
      const oldCal = $('.dp2-cal', pop);
      if (oldCal) calScroll = oldCal.scrollTop;
      const curText = val.due ? describe(val) : '';
      pop.innerHTML = `<div class="dp2">
        <div class="dp2-top"><input class="dp2-input" value="${esc(curText)}" placeholder="Wpisz termin, np. pt 15:00" spellcheck="false"><div class="dp2-hint"></div></div>
        <div class="dp2-quick">
          ${quick(I.today || todayIcon(), 'Dziś', td, 'g')}
          ${quick(I.sun, 'Jutro', addDays(td, 1), 'o')}
          ${quick(I.sofa, 'Ten weekend', nextWeekday(td, 6, true), 'b')}
          ${quick(I.next, 'Następny tydzień', nextWeekday(td, 1, false), 'p', true)}
          ${val.due ? quick(I.ban, 'Brak terminu', '', 'n') : ''}
        </div>
        <div class="dp2-head"><strong class="dp2-title">${label(months[0])}</strong><div class="dp2-nav">
          <button data-nav="-1" title="Poprzedni miesiąc">${I.left}</button>
          <button data-nav="0" title="Dzisiaj"><span class="dp2-dot"></span></button>
          <button data-nav="1" title="Następny miesiąc">${I.right}</button></div></div>
        <div class="dp2-sub"><div class="dp2-wd">${['pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.', 'niedz.'].map(x => `<span>${x}</span>`).join('')}</div><div class="dp2-info"></div></div>
        <div class="dp2-cal">${months.map(monthHtml).join('')}</div>
        <div class="dp2-foot">
          ${mode === 'time'
            ? `<div class="dp2-timebox"><input type="time" class="dp2-time" value="${val.time || ''}"><button class="dp2-btn sm primary" data-a="time-ok">Zapisz</button>${val.time ? '<button class="dp2-btn sm" data-a="time-clear" title="Usuń godzinę">Usuń</button>' : ''}</div>`
            : `<button class="dp2-btn${val.time ? ' on' : ''}" data-a="time">${I.clock}<span>${val.time ? 'Czas: ' + val.time : 'Czas'}</span></button>`}
          ${mode === 'rec'
            ? `<div class="dp2-reclist">${REC_OPTS.map(([v, l]) => `<button class="dp2-q${v === (val.recurring || '') ? ' on' : ''}" data-rec="${v}"><span class="grow">${l}</span>${v === (val.recurring || '') ? I.checkSmall : ''}</button>`).join('')}</div>`
            : `<button class="dp2-btn${val.recurring ? ' on' : ''}" data-a="rec">${sz(I.repeat, 15)}<span>${val.recurring ? REC_LABEL[val.recurring] : 'Powtarzanie'}</span></button>`}
        </div></div>`;
      const inp = $('.dp2-input', pop), hint = $('.dp2-hint', pop), cal = $('.dp2-cal', pop), title = $('.dp2-title', pop), sub = $('.dp2-sub', pop), info = $('.dp2-info', pop);
      inp.oninput = () => {
        const q = inp.value.trim(), r = parseQuick(inp.value);
        hint.textContent = q && q !== curText ? (r.due ? '→ ' + describe(r) : 'Nie rozpoznano terminu') : '';
        hint.classList.toggle('show', !!hint.textContent);
      };
      inp.onkeydown = e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (inp.value.trim() === curText) { close(); return; }
        const r = parseQuick(inp.value);
        if (r.due) set({ due: r.due, time: r.time || val.time, recurring: r.recurring || val.recurring }, true);
      };
      const tin = $('.dp2-time', pop);
      if (tin) { tin.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('[data-a="time-ok"]', pop).click(); } }; setTimeout(() => tin.focus(), 0); }
      // nagłówek miesiąca podąża za przewijaniem
      const curIdx = () => { const ms = $$('.dp2-month', cal); let k = 0; ms.forEach((m, i) => { if (m.offsetTop - cal.offsetTop <= cal.scrollTop + 24) k = i; }); return k; };
      cal.onscroll = () => { const t = label(months[curIdx()]); if (title.textContent !== t) { title.textContent = t; title.classList.remove('flip'); void title.offsetWidth; title.classList.add('flip'); } };
      cal.onmouseover = e => {
        const d = e.target.closest('.dp2-day');
        if (!d) return;
        const p = parseDate(d.dataset.date), n = +d.dataset.n;
        info.innerHTML = `${DOW_LOW[p.getDay()]} ${p.getDate()} ${PL_MON_SHORT[p.getMonth()]} • <b>${n ? n + ' ' + plural(n, 'zadanie', 'zadania', 'zadań') : 'Brak zadań'}</b>`;
        sub.classList.add('hov');
      };
      cal.onmouseleave = () => sub.classList.remove('hov');
      if (calScroll != null) cal.scrollTop = calScroll;
      else { const target = val.due ? months.findIndex(m => fmtDate(m).slice(0, 7) === val.due.slice(0, 7)) : 0; const el = $(`.dp2-month[data-i="${Math.max(0, target)}"] .dp2-grid`, cal); if (el) cal.scrollTop = el.offsetTop - cal.offsetTop - 4; cal.onscroll(); }
    };
    pop.onclick = e => {
      const b = e.target.closest('[data-date],[data-nav],[data-a],[data-rec]');
      if (!b) return;
      const cal = $('.dp2-cal', pop);
      if (b.dataset.nav !== undefined) {
        const ms = $$('.dp2-month', cal);
        let k = 0; ms.forEach((m, i) => { if (m.offsetTop - cal.offsetTop <= cal.scrollTop + 24) k = i; });
        const n = +b.dataset.nav, to = n === 0 ? months.findIndex(m => fmtDate(m).slice(0, 7) === td.slice(0, 7)) : Math.max(0, Math.min(ms.length - 1, k + n));
        const g = $('.dp2-grid', ms[Math.max(0, to)]);
        cal.scrollTo({ top: g.offsetTop - cal.offsetTop - 4, behavior: REDUCED ? 'auto' : 'smooth' });
        return;
      }
      const a = b.dataset.a;
      if (a === 'time' || a === 'rec') { mode = a; draw(); positionPopover(anchor); return; }
      if (a === 'time-ok') { const v = $('.dp2-time', pop).value; mode = null; set({ time: v || null, due: val.due || td }); return; }
      if (a === 'time-clear') { mode = null; set({ time: null }); return; }
      if (b.dataset.rec !== undefined) { mode = null; set({ recurring: b.dataset.rec || null, due: val.due || td }); return; }
      b.classList.add('picked');
      set({ due: b.dataset.date || null }, true);
    };
    draw();
    setTimeout(() => { const i = $('.dp2-input', pop); if (i) { i.focus(); i.select(); } }, 0);
  });
}
// ikona „Dziś” jak w Todoist: kwadrat z numerem dnia
Object.defineProperty(I, 'today', { get: () => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2.5"/><text x="12" y="16.1" text-anchor="middle" font-size="8.6" font-weight="700" fill="currentColor" stroke="none" font-family="system-ui,sans-serif">${new Date().getDate()}</text></svg>` });

function prioPicker(anchor, cur, cb) {
  openPopover(anchor, (pop, close) => {
    pop.innerHTML = `<div class="menu">${[1, 2, 3, 4].map(p => `<button class="menu-item ${p === cur ? 'sel' : ''}" data-p="${p}">${flagIcon(p)}<span class="grow">Priorytet ${p}</span>${p === cur ? I.checkSmall : ''}</button>`).join('')}</div>`;
    pop.onclick = e => { const b = e.target.closest('[data-p]'); if (b) { cb(+b.dataset.p); close(); } };
  });
}

function labelPicker(anchor, cur, cb) {
  let sel = [...cur], q = '';
  openPopover(anchor, (pop) => {
    pop.innerHTML = `<div class="menu"><input class="menu-search" placeholder="Wpisz etykietę" aria-label="Szukaj etykiety"><div class="lp-list"></div></div>`;
    const list = $('.lp-list', pop), inp = $('.menu-search', pop);
    const draw = () => {
      const ls = state.labels.filter(l => l.name.toLowerCase().includes(q.toLowerCase()));
      let h = ls.map(l => `<label class="menu-item"><span style="color:${l.color}">${I.tag}</span><span class="grow">${esc(l.name)}</span><input type="checkbox" data-id="${l.id}" ${sel.includes(l.id) ? 'checked' : ''}></label>`).join('');
      if (q && !state.labels.some(l => l.name.toLowerCase() === q.toLowerCase())) h += `<button class="menu-item" data-create>${I.plus}<span>Utwórz etykietę „${esc(q)}”</span></button>`;
      list.innerHTML = h || '<div class="menu-empty">Brak etykiet</div>';
    };
    draw();
    setTimeout(() => inp.focus(), 0);
    inp.oninput = () => { q = inp.value.trim(); draw(); };
    const create = () => {
      const l = { id: uid(), name: q.replace(/\s+/g, '_'), color: COLORS[Math.floor(Math.random() * COLORS.length)][1] };
      state.labels.push(l); sel.push(l.id); q = ''; inp.value = '';
      cb([...sel]); draw();
    };
    inp.onkeydown = e => { if (e.key === 'Enter' && q) { e.preventDefault(); const ex = state.labels.find(l => l.name.toLowerCase() === q.toLowerCase()); if (ex) { if (!sel.includes(ex.id)) sel.push(ex.id); cb([...sel]); q = ''; inp.value = ''; draw(); } else create(); } };
    pop.onchange = e => {
      const c = e.target.closest('input[type=checkbox]');
      if (!c) return;
      sel = c.checked ? [...sel, c.dataset.id] : sel.filter(x => x !== c.dataset.id);
      cb([...sel]);
    };
    pop.onclick = e => { if (e.target.closest('[data-create]')) create(); };
  });
}

function projectPicker(anchor, cur, cb) {
  let q = '';
  openPopover(anchor, (pop, close) => {
    pop.innerHTML = `<div class="menu"><input class="menu-search" placeholder="Wpisz nazwę projektu" aria-label="Szukaj projektu"><div class="pp-list"></div></div>`;
    const list = $('.pp-list', pop), inp = $('.menu-search', pop);
    const draw = () => {
      let h = '';
      [proj('inbox'), ...userProjects()].forEach(p => {
        const match = !q || norm(p.name).includes(norm(q));
        const secs = p.sections.filter(s => !q || match || norm(s.name).includes(norm(q)));
        if (!match && !secs.length) return;
        const on = cur.projectId === p.id && !cur.sectionId;
        h += `<button class="menu-item ${on ? 'sel' : ''}" data-p="${p.id}" data-s="">${p.isInbox ? sz(I.inbox, 16) : `<span class="hash" style="color:${p.color};width:16px;text-align:center">#</span>`}<span class="grow">${esc(projName(p))}</span>${on ? I.checkSmall : ''}</button>`;
        secs.forEach(s => {
          const on2 = cur.projectId === p.id && cur.sectionId === s.id;
          h += `<button class="menu-item indent ${on2 ? 'sel' : ''}" data-p="${p.id}" data-s="${s.id}"><span class="muted">/</span><span class="grow">${esc(s.name)}</span>${on2 ? I.checkSmall : ''}</button>`;
        });
      });
      list.innerHTML = h || '<div class="menu-empty">Nie znaleziono projektu</div>';
    };
    draw();
    setTimeout(() => inp.focus(), 0);
    inp.oninput = () => { q = inp.value.trim(); draw(); };
    inp.onkeydown = e => { if (e.key === 'Enter') { const b = $('[data-p]', list); if (b) b.click(); } };
    pop.onclick = e => {
      const b = e.target.closest('[data-p]');
      if (b) { cb({ projectId: b.dataset.p, sectionId: b.dataset.s || null }); close(); }
    };
  });
}

function menu(anchor, items) {
  openPopover(anchor, (pop, close) => {
    pop.innerHTML = `<div class="menu">${items.map((it, i) => it === '-' ? '<div class="menu-sep"></div>' :
      `<button class="menu-item ${it.danger ? 'danger' : ''}" data-i="${i}">${it.icon || ''}<span class="grow">${it.label}</span></button>`).join('')}</div>`;
    pop.onclick = e => { const b = e.target.closest('[data-i]'); if (b) { close(); items[+b.dataset.i].fn(); } };
  });
}

function taskMenu(anchor, t) {
  const td = todayStr();
  openPopover(anchor, (pop, close) => {
    pop.innerHTML = `<div class="menu">
      <button class="menu-item" data-a="edit">${I.edit}<span class="grow">Edytuj zadanie</span></button>
      <div class="menu-sep"></div>
      <div class="menu-label">Termin</div>
      <div class="menu-row">
        <button class="icon-btn" data-due="${td}" title="Dziś" style="color:var(--green)">${I.today}</button>
        <button class="icon-btn" data-due="${addDays(td, 1)}" title="Jutro" style="color:var(--orange)">${I.sun}</button>
        <button class="icon-btn" data-due="${nextWeekday(td, 6, true)}" title="Ten weekend" style="color:var(--blue)">${I.sofa}</button>
        <button class="icon-btn" data-due="${nextWeekday(td, 1, false)}" title="Przyszły tydzień" style="color:var(--purple)">${I.next}</button>
        <button class="icon-btn" data-due="" title="Bez terminu">${I.ban}</button>
        <button class="icon-btn" data-a="date" title="Więcej opcji">${I.dots}</button>
      </div>
      <div class="menu-label">Priorytet</div>
      <div class="menu-row">${[1, 2, 3, 4].map(p => `<button class="icon-btn ${t.priority === p ? 'sel' : ''}" data-p="${p}" title="Priorytet ${p}">${flagIcon(p)}</button>`).join('')}</div>
      <div class="menu-sep"></div>
      <button class="menu-item" data-a="sub">${sz(I.subtask, 16)}<span class="grow">Dodaj zadanie podrzędne</span></button>
      <button class="menu-item" data-a="move">${I.move}<span class="grow">Przenieś do…</span></button>
      <button class="menu-item" data-a="labels">${sz(I.tag, 16)}<span class="grow">Etykiety…</span></button>
      <button class="menu-item" data-a="dup">${I.copy}<span class="grow">Duplikuj</span></button>
      <div class="menu-sep"></div>
      <button class="menu-item danger" data-a="del">${I.trash}<span class="grow">Usuń zadanie</span></button>
    </div>`;
    pop.onclick = e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.due !== undefined) { t.due = b.dataset.due || null; if (!t.due) { t.time = null; t.recurring = null; } close(); commit(); return; }
      if (b.dataset.p) { t.priority = +b.dataset.p; close(); commit(); return; }
      const a = b.dataset.a;
      close();
      const anc = (anchor instanceof Node ? document.body.contains(anchor) : true) ? anchor : $(`.task[data-id="${t.id}"]`) || document.body;
      if (a === 'edit') openTask(t.id, true);
      else if (a === 'date') datePicker(anc, t, v => { Object.assign(t, v); commit(); });
      else if (a === 'move') projectPicker(anc, t, v => moveTask(t, v.projectId, v.sectionId));
      else if (a === 'labels') labelPicker(anc, t.labels, ids => { t.labels = ids; commit(); });
      else if (a === 'sub') { ui.modal = { type: 'task', id: t.id }; openForm('sub:' + t.id, { parentId: t.id, projectId: t.projectId, sectionId: t.sectionId }); }
      else if (a === 'dup') duplicateTask(t);
      else if (a === 'del') deleteTask(t);
    };
  });
}

// ---------- projekty, sekcje, etykiety, filtry ----------
function projectDialog(p) {
  openDialog({
    title: p ? 'Edytuj projekt' : 'Dodaj projekt', submit: p ? 'Zapisz' : 'Dodaj',
    fields: [
      { key: 'name', label: 'Nazwa', value: p?.name || '', required: true },
      { key: 'color', label: 'Kolor', type: 'color', value: p?.color || '#808080' },
      { key: 'view', label: 'Układ', type: 'select', value: p?.view || 'list', options: [['list', 'Lista'], ['board', 'Tablica']] },
      { key: 'favorite', label: 'Dodaj do ulubionych', type: 'checkbox', value: !!p?.favorite },
    ],
    onSubmit: v => {
      if (p) { Object.assign(p, v); commit(); }
      else {
        const np = { id: uid(), ...v, sections: [], order: Math.max(0, ...state.projects.map(x => x.order || 0)) + 1 };
        state.projects.push(np); save(); setView({ type: 'project', id: np.id });
      }
    },
  });
}
function projectMenu(anchor, p) {
  menu(anchor, [
    { icon: I.edit, label: 'Edytuj projekt', fn: () => projectDialog(p) },
    { icon: I.star, label: p.favorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych', fn: () => { p.favorite = !p.favorite; commit(); } },
    { icon: sz(I.plus, 16), label: 'Dodaj sekcję', fn: () => { if (ui.view.id !== p.id) setView({ type: 'project', id: p.id }); ui.addSection = { pid: p.id, idx: p.sections.length }; ui.focusSel = '.sf-input'; render(); } },
    { icon: p.view === 'board' ? sz(I.list, 16) : sz(I.board, 16), label: p.view === 'board' ? 'Pokaż jako listę' : 'Pokaż jako tablicę', fn: () => { p.view = p.view === 'board' ? 'list' : 'board'; commit(); } },
    '-',
    { icon: I.trash, label: 'Usuń projekt', danger: true, fn: () => {
      const n = state.tasks.filter(t => t.projectId === p.id).length;
      confirmDlg('Usunąć projekt?', `Projekt <b>${esc(p.name)}</b> i wszystkie jego zadania (${n}) zostaną usunięte.`, 'Usuń', () => {
        const snap = snapshot();
        state.projects = state.projects.filter(x => x.id !== p.id);
        state.tasks = state.tasks.filter(t => t.projectId !== p.id);
        if (ui.view.id === p.id) ui.view = { type: 'inbox' };
        setView(ui.view);
        save();
        toast('Usunięto projekt', snap);
      });
    } },
  ]);
}
function sectionMenu(anchor, pid, sid) {
  const p = proj(pid), s = p?.sections.find(x => x.id === sid);
  if (!s) return;
  menu(anchor, [
    { icon: I.edit, label: 'Zmień nazwę', fn: () => openDialog({ title: 'Zmień nazwę sekcji', submit: 'Zapisz', fields: [{ key: 'name', label: 'Nazwa', value: s.name, required: true }], onSubmit: v => { s.name = v.name; commit(); } }) },
    { icon: sz(I.plus, 16), label: 'Dodaj zadanie', fn: () => { ui.collapsed['s' + s.id] = false; openForm(`p:${p.id}:${s.id}`, { projectId: p.id, sectionId: s.id }); } },
    '-',
    { icon: I.trash, label: 'Usuń sekcję', danger: true, fn: () => {
      const n = state.tasks.filter(t => t.sectionId === s.id).length;
      confirmDlg('Usunąć sekcję?', `Sekcja <b>${esc(s.name)}</b> i jej zadania (${n}) zostaną usunięte.`, 'Usuń', () => {
        const snap = snapshot();
        p.sections = p.sections.filter(x => x.id !== s.id);
        state.tasks = state.tasks.filter(t => t.sectionId !== s.id);
        commit();
        toast('Usunięto sekcję', snap);
      });
    } },
  ]);
}
function labelDialog(l) {
  openDialog({
    title: l ? 'Edytuj etykietę' : 'Dodaj etykietę', submit: l ? 'Zapisz' : 'Dodaj',
    fields: [{ key: 'name', label: 'Nazwa', value: l?.name || '', required: true }, { key: 'color', label: 'Kolor', type: 'color', value: l?.color || '#808080' }],
    onSubmit: v => {
      v.name = v.name.replace(/\s+/g, '_').replace(/^@/, '');
      if (state.labels.some(x => x !== l && x.name.toLowerCase() === v.name.toLowerCase())) { alertField('name', 'Etykieta o tej nazwie już istnieje'); return false; }
      if (l) Object.assign(l, v); else state.labels.push({ id: uid(), ...v });
      commit();
    },
  });
}
function labelMenu(anchor, l) {
  menu(anchor, [
    { icon: I.edit, label: 'Edytuj etykietę', fn: () => labelDialog(l) },
    '-',
    { icon: I.trash, label: 'Usuń etykietę', danger: true, fn: () => confirmDlg('Usunąć etykietę?', `Etykieta <b>${esc(l.name)}</b> zostanie usunięta ze wszystkich zadań.`, 'Usuń', () => {
      const snap = snapshot();
      state.labels = state.labels.filter(x => x.id !== l.id);
      state.tasks.forEach(t => { t.labels = t.labels.filter(x => x !== l.id); });
      if (ui.view.type === 'label' && ui.view.id === l.id) setView({ type: 'filters' }); else commit();
      save();
      toast('Usunięto etykietę', snap);
    }) },
  ]);
}
function filterDialog(f) {
  openDialog({
    title: f ? 'Edytuj filtr' : 'Dodaj filtr', submit: f ? 'Zapisz' : 'Dodaj',
    fields: [
      { key: 'name', label: 'Nazwa', value: f?.name || '', required: true },
      { key: 'query', label: 'Zapytanie', value: f?.query || '', required: true, placeholder: 'np. today | overdue',
        hint: 'Łącz warunki: <b>&amp;</b> (i), <b>|</b> (lub), <b>!</b> (nie), nawiasy. Warunki: <code>today</code>, <code>tomorrow</code>, <code>overdue</code>, <code>7 days</code>, <code>no date</code>, <code>p1</code>–<code>p4</code>, <code>@etykieta</code>, <code>#Projekt</code>, <code>/Sekcja</code>, <code>recurring</code>, <code>subtask</code> lub dowolny tekst.' },
      { key: 'color', label: 'Kolor', type: 'color', value: f?.color || '#884dff' },
    ],
    onSubmit: v => {
      if (f) { Object.assign(f, v); commit(); }
      else { const nf = { id: uid(), ...v }; state.filters.push(nf); save(); setView({ type: 'filter', id: nf.id }); }
    },
  });
}
function filterMenu(anchor, f) {
  menu(anchor, [
    { icon: I.edit, label: 'Edytuj filtr', fn: () => filterDialog(f) },
    '-',
    { icon: I.trash, label: 'Usuń filtr', danger: true, fn: () => confirmDlg('Usunąć filtr?', `Filtr <b>${esc(f.name)}</b> zostanie usunięty. Zadania pozostaną bez zmian.`, 'Usuń', () => {
      state.filters = state.filters.filter(x => x.id !== f.id);
      if (ui.view.type === 'filter' && ui.view.id === f.id) setView({ type: 'filters' }); else commit();
      save();
    }) },
  ]);
}
function viewMenu(anchor, p) {
  openPopover(anchor, (pop, close) => {
    pop.innerHTML = `<div class="menu">
      <div class="menu-label">Układ</div>
      <div class="seg"><button data-v="list" class="${p.view !== 'board' ? 'sel' : ''}">${I.list}Lista</button><button data-v="board" class="${p.view === 'board' ? 'sel' : ''}">${I.board}Tablica</button></div>
      <div class="menu-sep"></div>
      <label class="menu-item"><span class="grow">Pokaż ukończone zadania</span><input type="checkbox" data-sc ${ui.showCompleted[p.id] ? 'checked' : ''}></label>
    </div>`;
    pop.onclick = e => { const b = e.target.closest('[data-v]'); if (b) { p.view = b.dataset.v; close(); commit(); } };
    pop.onchange = e => { if (e.target.matches('[data-sc]')) { ui.showCompleted[p.id] = e.target.checked; render(); } };
  });
}
// ---------- udostępnianie, komentarze projektu, eksport/import ----------
async function copyText(text, okMsg) {
  try { await navigator.clipboard.writeText(text); toast(okMsg); }
  catch (e) { openDialog({ title: 'Skopiuj ręcznie', html: `<textarea class="copy-area" readonly rows="10">${esc(text)}</textarea>` }); setTimeout(() => $('.copy-area')?.select(), 50); }
}
function shareProject(p) {
  const lines = [`# ${p.name}`];
  const line = t => { const di = dueInfo(t.due, t.time); return `- [ ] ${t.title}${t.priority < 4 ? ' (P' + t.priority + ')' : ''}${di ? ' — ' + di.label : ''}${t.description ? '\n    ' + t.description : ''}`; };
  const act = state.tasks.filter(t => t.projectId === p.id && !t.completed && !t.parentId).sort(byOrder);
  act.filter(t => !t.sectionId).forEach(t => lines.push(line(t)));
  p.sections.forEach(s => { const ts = act.filter(t => t.sectionId === s.id); if (ts.length) { lines.push('', `## ${s.name}`); ts.forEach(t => lines.push(line(t))); } });
  copyText(lines.join('\n'), 'Skopiowano listę zadań – możesz ją wkleić np. na Teams');
}
function projectComments(p) {
  p.comments = p.comments || [];
  const list = p.comments.length ? p.comments.map(c => `<div class="comment"><span class="avatar">${esc((state.settings.userName || 'J')[0])}</span><div class="cbody"><div class="chead"><strong>${esc(state.settings.userName || 'Ty')}</strong><span class="muted small">${fmtDateTime(c.at)}</span></div><div class="ctext">${fmtText(c.text)}</div></div></div>`).join('') : '<p class="muted">Brak komentarzy do projektu.</p>';
  openDialog({
    title: `Komentarze – ${p.isInbox ? 'Skrzynka' : p.name}`, html: `<div style="max-height:40vh;overflow:auto;margin-bottom:10px">${list}</div>`, submit: 'Skomentuj',
    fields: [{ key: 'text', label: 'Nowy komentarz', type: 'textarea', value: '', required: true }],
    onSubmit: v => { p.comments.push({ id: uid(), text: v.text, at: Date.now() }); commit(); },
  });
}
function exportData() {
  copyText(JSON.stringify(state), 'Skopiowano dane – wklej je w „Importuj dane” na innym urządzeniu');
}
function importData() {
  openDialog({
    title: 'Importuj dane', submit: 'Zastąp moje dane', danger: true,
    html: '<p>Wklej dane skopiowane przyciskiem „Eksportuj dane”. Obecne zadania zostaną zastąpione (możesz to cofnąć).</p>',
    fields: [{ key: 'json', label: 'Dane', type: 'textarea', value: '', required: true }],
    onSubmit: v => {
      let d;
      try { d = JSON.parse(v.json); } catch (e) { alertField('json', 'To nie wygląda na dane z Listo'); return false; }
      if (!d || !Array.isArray(d.tasks) || !Array.isArray(d.projects)) { alertField('json', 'To nie wygląda na dane z Listo'); return false; }
      const snap = snapshot();
      state = normalizeState(d);
      ui.view = { type: 'today' };
      commit();
      toast('Zaimportowano dane', snap);
    },
  });
}

// ================================================================
//  Synchronizacja między urządzeniami (gdy aplikacja działa na claude.ai)
// ================================================================
const SYNC_LABEL = { local: 'Dane tylko na tym urządzeniu', connecting: 'Łączenie z synchronizacją…', synced: 'Zsynchronizowano z kontem', offline: 'Brak połączenia – zapisano lokalnie' };
const sync = { ref: null, status: 'local', writing: false, pending: false, again: false, clientId: uid(), rev: 0, timer: null };
function renderSyncBadge() {
  const b = $('.sync-badge');
  if (!b) return;
  b.dataset.s = sync.status;
  b.title = SYNC_LABEL[sync.status];
  b.hidden = sync.status === 'local';
}
async function initSync() {
  // 1) własny serwer (Supabase) – gdy uzupełniono config.js; 2) claude.ai – gdy otwarte jako artefakt; 3) tylko lokalnie
  if (CFG.supabaseUrl && CFG.supabaseKey) return initSupabase();
  if (!window.claude?.use) return;
  try {
    const [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
    if (!db || !user) return;
    const id = await user.id();
    if (!id) return;
    attachRef(db.doc(`data/users/${id}/listo`));
  } catch (e) { sync.status = sync.ref ? 'offline' : 'local'; renderSyncBadge(); }
}
function attachRef(ref) {
  try {
    sync.ref = ref;
    sync.status = 'connecting'; renderSyncBadge();
    const slow = setTimeout(() => { if (sync.status === 'connecting') { sync.status = 'offline'; renderSyncBadge(); } }, 10000);
    sync.ref.onSnapshot(snap => {
      if (!snap.metadata.fromCache) { clearTimeout(slow); if (!sync.writing) sync.status = 'synced'; }
      if (snap.metadata.hasPendingWrites) return renderSyncBadge();
      // pierwsza odpowiedź serwera: dopiero teraz wolno cokolwiek wysłać
      const first = !sync.ready && !snap.metadata.fromCache;
      if (first) sync.ready = true;
      if (!snap.exists) {
        // pierwsze uruchomienie na koncie: wyślij obecne zadania
        if (first) pushRemote();
        return renderSyncBadge();
      }
      const d = snap.data();
      if (!d.state || !Array.isArray(d.state.tasks)) { if (first) pushRemote(); return renderSyncBadge(); }
      if (first && sync.dirty && !seeded) { pushRemote(); return renderSyncBadge(); } // zmiany offline z tego urządzenia wygrywają
      if (!first) {
        if (d.client === sync.clientId) return renderSyncBadge();     // własny zapis
        if (sync.writing || sync.pending) return renderSyncBadge();   // lokalne zmiany wygrywają
      }
      seeded = false;
      // te same dane co lokalnie → nic nie przerysowujemy (brak „przeładowania” strony po starcie)
      if (JSON.stringify(normalizeState(JSON.parse(JSON.stringify(d.state)))) === JSON.stringify(state)) return renderSyncBadge();
      state = normalizeState(JSON.parse(JSON.stringify(d.state)));
      persist();
      render();
      renderSyncBadge();
    }, () => { clearTimeout(slow); sync.status = 'offline'; renderSyncBadge(); });
  } catch (e) { sync.status = sync.ref ? 'offline' : 'local'; renderSyncBadge(); }
}
['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { sync.userAt = Date.now(); }, true));
function scheduleRemote() {
  if (!sync.ref) return;
  // czekamy na dane z chmury – nie nadpisujemy ich lokalnym stanem; „brudne” są tylko zmiany zrobione ręcznie
  if (!sync.ready) { if (Date.now() - (sync.userAt || 0) < 3000) sync.dirty = true; return; }
  sync.pending = true;
  clearTimeout(sync.timer);
  sync.timer = setTimeout(() => { sync.pending = false; pushRemote(); }, 700);
}
async function pushRemote() {
  if (!sync.ref || !sync.ready) return;
  if (sync.writing) { sync.again = true; return; }
  sync.writing = true; sync.again = false;
  sync.rev++;
  try {
    await sync.ref.set({ state: JSON.parse(JSON.stringify(state)), client: sync.clientId, rev: sync.rev, savedAt: Date.now() });
    sync.status = 'synced';
  } catch (e) {
    sync.status = 'offline';
    if (e?.code === 'unavailable') setTimeout(() => { sync.again = true; if (!sync.writing) pushRemote(); }, 1500 + Math.random() * 1000);
  }
  sync.writing = false;
  renderSyncBadge();
  if (sync.again) pushRemote();
}

function userMenu(anchor) {
  const th = state.settings.theme;
  menu(anchor, [
    { icon: sz(I.gear, 16), label: 'Ustawienia', fn: () => setView({ type: 'prefs' }) },
    { icon: sz(I.book, 16), label: 'Poradnik i skróty', fn: () => setView({ type: 'guide' }) },
    { icon: sz(I.pulse, 16), label: 'Raportowanie i produktywność', fn: () => setView({ type: 'reports' }) },
    { icon: I.edit, label: 'Zmień nazwę użytkownika', fn: () => openDialog({ title: 'Nazwa użytkownika', submit: 'Zapisz', fields: [{ key: 'name', label: 'Nazwa', value: state.settings.userName || '', required: true }], onSubmit: v => { state.settings.userName = v.name; commit(); } }) },
    '-',
    { icon: `<span class="tp-mini" style="--c:${(ACCENTS.find(a => a.id === state.settings.accent) || ACCENTS[0]).color}"></span>`, label: 'Motyw kolorystyczny…', fn: () => themePicker(anchor) },
    { icon: th === 'dark' ? I.checkSmall : '<span style="width:16px"></span>', label: 'Motyw: ciemny', fn: () => { state.settings.theme = 'dark'; commit(); } },
    { icon: th === 'light' ? I.checkSmall : '<span style="width:16px"></span>', label: 'Motyw: jasny', fn: () => { state.settings.theme = 'light'; commit(); } },
    { icon: th === 'auto' ? I.checkSmall : '<span style="width:16px"></span>', label: 'Motyw: jak w systemie', fn: () => { state.settings.theme = 'auto'; commit(); } },
    '-',
    { icon: state.settings.sound !== false ? I.checkSmall : '<span style="width:16px"></span>', label: 'Dźwięk przy odhaczaniu', fn: () => { state.settings.sound = state.settings.sound === false; commit(); if (state.settings.sound) playSound('done'); } },
    { icon: sz(I.keyboard, 16), label: 'Skróty klawiszowe', fn: shortcutsDialog },
    '-',
    { icon: sz(I.copy, 16), label: 'Eksportuj dane (kopia do schowka)', fn: exportData },
    { icon: sz(I.move, 16), label: 'Importuj dane…', fn: importData },
    { icon: sz(I.cloud, 16), label: SYNC_LABEL[sync.status], fn: () => {} },
  ]);
}
function notifications(anchor) {
  const td = todayStr();
  const ts = active().filter(t => t.due && t.due <= td).sort(byDue);
  openPopover(anchor, (pop, close) => {
    pop.innerHTML = `<div class="menu" style="width:320px"><div class="menu-label">Na dziś i zaległe (${ts.length})</div>
      ${ts.length ? ts.map(t => { const di = dueInfo(t.due, t.time); return `<button class="menu-item" data-id="${t.id}"><span class="check p${t.priority}" style="pointer-events:none"></span><span class="grow">${esc(t.title)}<br><span class="meta-item due ${di.cls}" style="font-size:12px">${I.cal} ${di.label}</span></span></button>`; }).join('') : '<div class="menu-empty">Brak powiadomień 🎉</div>'}</div>`;
    pop.onclick = e => { const b = e.target.closest('[data-id]'); if (b) { close(); openTask(b.dataset.id); } };
  });
}
function productivity(anchor) {
  openPopover(anchor, (pop) => {
    const draw = () => {
      const td = todayStr(), goal = state.settings.dailyGoal;
      const days = [...Array(7)].map((_, i) => addDays(td, i - 6));
      const byDay = {};
      state.history.forEach(h => { const d = fmtDate(new Date(h.at)); byDay[d] = (byDay[d] || 0) + 1; });
      const counts = days.map(d => byDay[d] || 0);
      const todayC = counts[6], pct = Math.min(1, todayC / goal);
      let streak = 0;
      for (let d = (byDay[td] || 0) >= goal ? td : addDays(td, -1); (byDay[d] || 0) >= goal; d = addDays(d, -1)) streak++;
      const max = Math.max(goal, ...counts, 1);
      const C = 2 * Math.PI * 26;
      pop.innerHTML = `<div class="prod">
        <h3>Twoja produktywność</h3>
        <div class="prod-ring">
          <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26" fill="none" stroke="var(--line-2)" stroke-width="7"/>
            <circle cx="32" cy="32" r="26" fill="none" stroke="var(--accent)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${C * pct} ${C}" transform="rotate(-90 32 32)"/></svg>
          <div><div class="big">${todayC}/${goal}</div><div class="muted small">ukończonych dziś</div><div class="small" style="margin-top:4px">🔥 Seria: <b>${streak}</b> ${plural(streak, 'dzień', 'dni', 'dni')}</div></div>
        </div>
        <div class="bars"><div class="goal-line" style="bottom:${goal / max * 100}%"></div>${counts.map(c => `<div class="bar-col"><span class="bar-v">${c || ''}</span><div class="bar ${c < goal ? 'low' : ''}" style="height:${c / max * 78}%"></div></div>`).join('')}</div>
        <div class="bar-l">${days.map(d => `<span>${PL_DAYS_SHORT[dow(d)]}</span>`).join('')}</div>
        <div class="prod-goal"><span>Dzienny cel</span><input type="number" min="1" max="50" value="${goal}" aria-label="Dzienny cel"></div>
      </div>`;
      $('input', pop).onchange = e => { state.settings.dailyGoal = Math.max(1, Math.min(50, +e.target.value || 5)); commit(); draw(); };
    };
    draw();
  });
}

// ================================================================
//  Okna dialogowe
// ================================================================
function openDialog(cfg) {
  closePopover(true);
  ui.dialog = cfg;
  renderDialog();
  setTimeout(() => { const el = $('#dialog-root input:not([type=radio]):not([type=checkbox]), #dialog-root textarea, #dialog-root button[type=submit]'); el?.focus(); el?.select?.(); }, 0);
}
function closeDialog() { ui.dialog = null; renderDialog(); }
function confirmDlg(title, html, btn, fn) { openDialog({ title, html: `<p>${html}</p>`, submit: btn, danger: true, onSubmit: fn }); }
function alertField(key, msg) {
  const f = $(`#dialog-root [name="${key}"]`)?.closest('.field');
  if (!f) return;
  f.classList.add('invalid');
  let s = $('small.err', f);
  if (!s) { s = document.createElement('small'); s.className = 'err'; s.style.color = 'var(--danger)'; f.appendChild(s); }
  s.textContent = msg;
}
function fieldHtml(f) {
  if (f.type === 'checkbox') return `<label class="field-check"><input type="checkbox" name="${f.key}" ${f.value ? 'checked' : ''}> ${esc(f.label)}</label>`;
  if (f.type === 'color') return `<div class="field"><span class="field-label">${esc(f.label)}</span><div class="swatches">${COLORS.map(([n, hex]) => `<label class="swatch" title="${n}"><input type="radio" name="${f.key}" value="${hex}" ${hex === f.value ? 'checked' : ''}><span style="background:${hex}"></span></label>`).join('')}</div></div>`;
  if (f.type === 'textarea') return `<label class="field"><span class="field-label">${esc(f.label)}</span><textarea name="${f.key}" rows="4">${esc(f.value || '')}</textarea></label>`;
  if (f.type === 'select') return `<label class="field"><span class="field-label">${esc(f.label)}</span><select name="${f.key}">${f.options.map(([v, l]) => `<option value="${v}" ${v === f.value ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
  return `<label class="field"><span class="field-label">${esc(f.label)}</span><input name="${f.key}" value="${esc(f.value || '')}" placeholder="${esc(f.placeholder || '')}" maxlength="200" autocomplete="off">${f.hint ? `<small>${f.hint}</small>` : ''}</label>`;
}
function renderDialog() {
  const root = $('#dialog-root'), c = ui.dialog;
  if (!c) { root.innerHTML = ''; return; }
  root.innerHTML = `<div class="overlay" data-dlg="bg"><form class="modal dialog ${c.cls || ''}" novalidate role="dialog" aria-label="${esc(c.title)}">
    <h2>${esc(c.title)}</h2>${c.html || ''}${(c.fields || []).map(fieldHtml).join('')}
    <div class="dlg-foot"><button type="button" class="btn" data-dlg="cancel">${c.submit ? 'Anuluj' : 'Zamknij'}</button>${c.submit ? `<button type="submit" class="btn ${c.danger ? 'danger' : 'primary'}">${esc(c.submit)}</button>` : ''}</div>
  </form></div>`;
  const form = $('form', root);
  form.onsubmit = e => {
    e.preventDefault();
    const vals = {};
    let bad = false;
    (c.fields || []).forEach(f => {
      if (f.type === 'checkbox') vals[f.key] = form.querySelector(`[name="${f.key}"]`).checked;
      else if (f.type === 'color') vals[f.key] = form.querySelector(`[name="${f.key}"]:checked`)?.value || f.value;
      else vals[f.key] = form.querySelector(`[name="${f.key}"]`).value.trim();
      if (f.required && !vals[f.key]) { alertField(f.key, 'To pole jest wymagane'); bad = true; }
    });
    if (bad) return;
    const cfg = ui.dialog;
    const r = cfg.onSubmit?.(vals);
    if (r !== false && ui.dialog === cfg) closeDialog();
  };
  root.onclick = e => {
    const d = e.target.closest('[data-dlg]');
    if (!d) return;
    if (d.dataset.dlg === 'cancel' || (d.dataset.dlg === 'bg' && e.target === d)) closeDialog();
  };
}
function shortcutsDialog() {
  const rows = [
    ['Q', 'Szybkie dodawanie zadania'], ['/', 'Szukaj'], ['M', 'Pokaż / ukryj menu'],
    ['G potem H', 'Start (widok główny)'], ['G potem M', 'Matryca'], ['G potem A', 'Auto-priorytety'], ['G potem S', 'Skupienie'],
    ['G potem I', 'Skrzynka'], ['G potem T', 'Dziś'], ['G potem U', 'Nadchodzące'], ['G potem F', 'Filtry i etykiety'], ['G potem C', 'Ukończone'],
    ['Ctrl + K', 'Paleta poleceń – szukaj i uruchamiaj wszystko'], ['Ctrl + Z', 'Cofnij ostatnią zmianę'],
    ['Ctrl + klik', 'Zaznacz kilka zadań (Shift + klik – zakres)'], ['Ctrl + A', 'Zaznacz wszystkie widoczne zadania'],
    ['D', 'Ukończ zadanie pod kursorem'], ['T', 'Termin dziś (zadanie pod kursorem)'], ['J', 'Termin jutro (zadanie pod kursorem)'],
    ['1 … 4', 'Priorytet zadania pod kursorem'], ['E', 'Edytuj zadanie pod kursorem'], ['Delete', 'Usuń zadanie pod kursorem'],
    ['Prawy klik', 'Szybkie menu zadania'], ['Ctrl + V', 'Wklej listę (kilka linii) – każda linia to osobne zadanie'],
    ['Enter', 'Zapisz zadanie w formularzu'], ['Tab', 'Zatwierdź podpowiedź #projekt / @etykieta'], ['Esc', 'Zamknij / anuluj'], ['Ctrl + Enter', 'Wyślij komentarz'],
  ];
  const syntax = [
    ['jutro, pojutrze, pt, w sobotę, 24.12, 5 maj', 'termin'], ['o 15:00, 9am', 'godzina'], ['codziennie, co tydzień, co pon', 'powtarzanie'],
    ['p1 … p4', 'priorytet'], ['#Projekt  /Sekcja', 'projekt i sekcja'], ['@etykieta', 'etykieta'],
  ];
  openDialog({
    title: 'Skróty i składnia',
    html: `<table class="kbd-table">${rows.map(([k, d]) => `<tr><td>${k.split(' ').map(x => ['potem', '+'].includes(x) ? ` ${x} ` : `<kbd>${x}</kbd>`).join('')}</td><td>${d}</td></tr>`).join('')}</table>
      <h3 style="font-size:14px;margin:18px 0 6px">Szybkie dodawanie – składnia</h3>
      <table class="kbd-table">${syntax.map(([k, d]) => `<tr><td><code>${esc(k)}</code></td><td>${d}</td></tr>`).join('')}</table>`,
  });
}

// ================================================================
//  Przeciągnij i upuść
// ================================================================
let dragId = null;
const clearDrop = () => $$('.drop-before, .drop-into').forEach(x => x.classList.remove('drop-before', 'drop-into'));
document.addEventListener('dragstart', e => {
  const row = e.target.closest?.('.task[draggable="true"], .cal-chip[draggable="true"]');
  if (!row) return;
  dragId = row.dataset.id;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragId);
  requestAnimationFrame(() => row.classList.add('dragging'));
});
document.addEventListener('dragend', () => { dragId = null; clearDrop(); $$('.dragging').forEach(x => x.classList.remove('dragging')); });
document.addEventListener('dragover', e => {
  if (!dragId) return;
  const tgt = e.target.closest('[data-drop]');
  if (!tgt || (tgt.dataset.drop === 'task' && tgt.dataset.id === dragId)) return;
  e.preventDefault();
  clearDrop();
  tgt.classList.add(tgt.dataset.drop === 'task' ? 'drop-before' : 'drop-into');
});
document.addEventListener('drop', e => {
  if (!dragId) return;
  const tgt = e.target.closest('[data-drop]');
  if (!tgt) return;
  e.preventDefault();
  const id = dragId;
  dragId = null; clearDrop();
  handleDrop(id, tgt);
});
function handleDrop(id, el) {
  const t = task(id);
  if (!t) return;
  const kind = el.dataset.drop;
  const dateView = ['today', 'upcoming', 'calendar'].includes(ui.view.type);
  const relink = () => descendants(t.id).forEach(d => { d.projectId = t.projectId; d.sectionId = t.sectionId; });
  if (kind === 'task') {
    const target = task(el.dataset.id);
    if (!target || target.id === id || descendants(id).some(d => d.id === target.id)) return;
    if (dateView || ['label', 'filter', 'search'].includes(ui.view.type)) {
      if (dateView && target.due) t.due = target.due;
    } else {
      t.projectId = target.projectId; t.sectionId = target.sectionId; t.parentId = target.parentId;
      relink();
    }
    const sibs = state.tasks.filter(x => x !== t && x.projectId === target.projectId && (x.sectionId || null) === (target.sectionId || null) && (x.parentId || null) === (target.parentId || null)).sort(byOrder);
    if (!dateView) {
      const base = Math.min(t.order, ...sibs.map(x => x.order));
      sibs.splice(sibs.indexOf(target), 0, t);
      sibs.forEach((x, k) => { x.order = base + k; });
    }
  } else if (kind === 'section') {
    t.projectId = el.dataset.pid; t.sectionId = el.dataset.sid || null; t.parentId = null; t.order = nextOrder(); relink();
  } else if (kind === 'project') {
    t.projectId = el.dataset.pid; t.sectionId = null; t.parentId = null; t.order = nextOrder(); relink();
    toast(`Przeniesiono do: ${projName(proj(t.projectId))}`);
  } else if (kind === 'day') {
    t.due = el.dataset.date;
  }
  commit();
}

// ================================================================
//  Zdarzenia
// ================================================================
document.addEventListener('mousedown', e => {
  // nie trać fokusu pola tytułu przy klikaniu podpowiedzi
  if (e.target.closest('.suggest-item')) e.preventDefault();
});

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.closest('#popover') || el.closest('#dialog-root')) return;
  const a = el.dataset.act, id = el.dataset.id;
  const f = ui.addForm;
  const formFocus = () => { ui.popOnClose = () => { const i = $('.task-form .tf-title'); if (i) { i.focus(); } }; };
  switch (a) {
    case 'nav':
      if (e.target.closest('.more')) return;
      ui.modal = null;
      setView({ type: el.dataset.view, id: el.dataset.id });
      break;
    case 'toggle-sidebar': ui.sidebar = !ui.sidebar; render(); break;
    case 'toggle': e.stopPropagation(); toggleTask(id); break;
    case 'open': if (e.target.closest('a[href]') || !id) return; openTask(id); break;
    case 'task-edit': openTask(id, true); break;
    case 'task-date': { const t = task(id); datePicker(el, t, v => { Object.assign(t, v); commit(); }); break; }
    case 'task-more': taskMenu(el, task(id)); break;
    case 'tm-prio': { const t = task(id); prioPicker(el, t.priority, p => { t.priority = p; commit(); }); break; }
    case 'tm-labels': { const t = task(id); labelPicker(el, t.labels, ids => { t.labels = ids; commit(); }); break; }
    case 'tm-project': { const t = task(id); projectPicker(el, t, v => moveTask(t, v.projectId, v.sectionId)); break; }
    case 'collapse': {
      const k = el.dataset.key, v = ui.collapsed[k] = !ui.collapsed[k];
      const box = $(`[data-cbox="${k}"]`);
      if (box) { box.classList.toggle('is-collapsed', v); $$(`.caret[data-key="${k}"]`).forEach(c => c.classList.toggle('closed', v)); }
      else render();
      break;
    }
    case 'add-open': openForm(el.dataset.ctx); break;
    case 'tf-cancel': cancelForm(); break;
    case 'tf-submit': submitForm(); break;
    case 'tf-suggest': applySuggest(el); break;
    case 'tf-clear-date': e.stopPropagation(); Object.assign(f.draft, { due: null, time: null, recurring: null }); ui.focusSel = '.task-form .tf-title'; render(); break;
    case 'tf-date': datePicker(el, f.draft, v => { Object.assign(f.draft, v); render(); }); formFocus(); break;
    case 'tf-prio': prioPicker(el, f.draft.priority, p => { f.draft.priority = p; render(); }); formFocus(); break;
    case 'tf-labels': labelPicker(el, f.draft.labels, ids => { f.draft.labels = ids; render(); }); formFocus(); break;
    case 'tf-project': projectPicker(el, f.draft, v => { f.draft.projectId = v.projectId; f.draft.sectionId = v.sectionId; render(); }); formFocus(); break;
    case 'quick-add': openQuick(); break;
    case 'modal-close': closeModal(); break;
    case 'modal-bg': if (e.target === el) { if (ui.modal?.type === 'quick') cancelForm(); else closeModal(); } break;
    case 'proj-menu': e.stopPropagation(); projectMenu(el, proj(id)); break;
    case 'add-project': projectDialog(); break;
    case 'view-menu': viewMenu(el, proj(id)); break;
    case 'section-menu': sectionMenu(el, el.dataset.pid, el.dataset.sid); break;
    case 'add-section': ui.addForm = null; ui.addSection = { pid: el.dataset.pid, idx: +el.dataset.idx, name: '' }; ui.focusSel = '.sf-input'; render(); break;
    case 'sf-submit': submitSection(); break;
    case 'sf-cancel': ui.addSection = null; render(); break;
    case 'up-nav': {
      const n = +el.dataset.n, td = todayStr();
      ui.upStart = n === 0 ? weekStart(td) : addDays(ui.upStrip || ui.upStart, n);
      if (ui.upStart < weekStart(td)) ui.upStart = weekStart(td);
      ui.upStrip = null; ui.upCur = null;
      ui.lastViewKey = null; render();
      const c0 = $('.content'); if (c0) c0.scrollTop = 0;
      break;
    }
    case 'up-day': {
      const g = $('#day-' + el.dataset.date), c = $('.content');
      if (g) c.scrollTo({ top: g.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop - $('.up-head').offsetHeight - 8, behavior: 'smooth' });
      break;
    }
    case 'reschedule-overdue': rescheduleOverdue(); break;
    case 'label-add': labelDialog(); break;
    case 'label-menu': e.stopPropagation(); labelMenu(el, label(id)); break;
    case 'filter-add': filterDialog(); break;
    case 'filter-menu': e.stopPropagation(); filterMenu(el, state.filters.find(x => x.id === id)); break;
    case 'comment-add': addComment(id); break;
    case 'comment-del': { const t = task(id); t.comments = t.comments.filter(c => c.id !== el.dataset.cid); commit(); break; }
    case 'theme': { const order = ['auto', 'light', 'dark']; state.settings.theme = order[(order.indexOf(state.settings.theme) + 1) % 3]; commit(); break; }
    case 'productivity': productivity(el); break;
    case 'hist-back': history.back(); break;
    case 'hist-fwd': history.forward(); break;
    case 'user-menu': userMenu(el); break;
    case 'notifications': notifications(el); break;
    case 'completed-group': state.settings.completedGroup = el.dataset.v; commit(); break;
    case 'task-del': deleteTask(task(id)); break;
    case 'cal-day': ui.calSel = el.dataset.date; render(); break;
    case 'cal-nav': {
      const n = +el.dataset.n;
      if (!n) { ui.calMonth = null; ui.calSel = todayStr(); }
      else { const d = parseDate(ui.calMonth || todayStr().slice(0, 8) + '01'); d.setMonth(d.getMonth() + n); ui.calMonth = fmtDate(d); }
      ui.stagger = true; render(); break;
    }
    case 'fz-mode': fzSetMode(el.dataset.m); break;
    case 'fz-toggle':
      if (fz.running) fzPause(); else { fzStart(); playSound('restore'); }
      render(); break;
    case 'fz-reset': { const rec = fzFinish('stopped'); fz.running = false; fz.remaining = fzTotal(); fzPersist(); render(); if (rec) toast(`Zapisano sesję: ${fmtDur(rec.sec)}`); break; }
    case 'fz-stop': { const rec = fzFinish('stopped'); fz.running = false; fz.remaining = fzTotal(); fzPersist(); commit(); if (rec) toast(`Zapisano sesję: ${fmtDur(rec.sec)}${rec.title ? ` – „${rec.title}”` : ''}`, null, rec.taskId ? () => focusReport(rec.taskId) : null, rec.taskId ? 'Szczegóły' : undefined); break; }
    case 'fz-skip': fzNext(false); break;
    case 'fz-pick': fzPick(id); break;
    case 'fz-tab': ui.fzTab = el.dataset.t; ui.stagger = true; render(); break;
    case 'fz-range': ui.fzRange = el.dataset.v; ui.stagger = true; render(); break;
    case 'fz-sess-del': {
      const snap = snapshot();
      state.focus.sessions = state.focus.sessions.filter(s => s.id !== el.dataset.sid);
      collapseRow(el.closest('.fh-row'));
      setTimeout(() => { commit(); toast('Usunięto sesję', snap); }, REDUCED ? 0 : 240);
      break;
    }
    case 'fz-sess-note': {
      const s = state.focus.sessions.find(x => x.id === el.dataset.sid);
      if (s) openDialog({ title: 'Notatka do sesji', fields: [{ key: 'note', label: `${fmtClock(sessStart(s))}–${fmtClock(s.end || s.at)} · ${fmtDur(sessSec(s))}`, type: 'textarea', value: s.note || '' }], submit: 'Zapisz', onSubmit: v => { s.note = v.note; commit(); } });
      break;
    }
    case 'focus-report': e.stopPropagation(); focusReport(id); break;
    case 'focus-on': focusOn(id); break;
    case 'ap-toggle': apToggle(); break;
    case 'ap-due': { const r = state.autoPrio.due[el.dataset.k]; r.on = !r.on; commit(); break; }
    case 'ap-due-p': state.autoPrio.due[el.dataset.k].p = +el.dataset.p; commit(); break;
    case 'ap-rule': { const r = state.autoPrio.rules.find(x => x.id === el.dataset.rid); if (r) { r.on = !r.on; commit(); } break; }
    case 'ap-rule-p': { const r = state.autoPrio.rules.find(x => x.id === el.dataset.rid); if (r) { r.p = +el.dataset.p; commit(); } break; }
    case 'ap-rule-del': state.autoPrio.rules = state.autoPrio.rules.filter(x => x.id !== el.dataset.rid); commit(); break;
    case 'ap-new-p': ui.apNewP = +el.dataset.p; render(); break;
    case 'ap-add': apAddRule(); break;
    case 'ap-exclude': { const t = task(id); if (t) { t.noAuto = !t.noAuto; commit(); toast(t.noAuto ? 'Auto-priorytety nie zmienią już tego zadania' : 'Zadanie znów objęte auto-priorytetami'); } break; }
    case 'ap-log-clear': state.autoPrio.log = []; commit(); break;
    case 'mx-days': state.settings.mxDays = +el.dataset.n; ui.stagger = true; commit(); break;
    case 'mx-proj': ui.mxProj = el.dataset.v || ''; ui.stagger = true; render(); break;
    case 'mx-move': e.stopPropagation(); mxMenu(el, task(id)); break;
    case 'home-focus': focusOn(id); break;
    case 'home-tomorrow': { const t = task(id); if (t) { const snap = snapshot(); t.due = addDays(todayStr(), 1); commit(); toast('Przełożono na jutro', snap); } break; }
    case 'home-skip': (ui.homeSkip = ui.homeSkip || new Set()).add(id); ui.homeAnim = true; render(); break;
    case 'home-day': ui.calSel = el.dataset.date; ui.calMonth = el.dataset.date.slice(0, 8) + '01'; setView({ type: 'calendar' }); break;
    case 'proj-share': shareProject(proj(id)); break;
    case 'proj-comments': projectComments(proj(id)); break;
    case 'shortcuts': shortcutsDialog(); break;
    case 'clear-completed': confirmDlg('Usunąć ukończone zadania?', 'Wszystkie ukończone zadania zostaną trwale usunięte.', 'Usuń', () => {
      const snap = snapshot();
      const ids = new Set(state.tasks.filter(t => t.completed).map(t => t.id));
      state.tasks = state.tasks.filter(t => !ids.has(t.id) && !(t.parentId && ids.has(t.parentId)));
      commit(); toast('Usunięto ukończone zadania', snap);
    }); break;
  }
});
function addComment(id) {
  const inp = $('.cm-input');
  const text = inp?.value.trim();
  if (!text) return;
  task(id).comments.push({ id: uid(), text, at: Date.now() });
  ui.focusSel = '.cm-input';
  commit();
  const main = $('.tm-main'); if (main) main.scrollTop = main.scrollHeight;
}

document.addEventListener('input', e => {
  const t = e.target;
  if (t.matches('.tf-title') && ui.addForm) { ui.addForm.draft.title = t.value; updatePreview(t); }
  else if (t.matches('.tf-desc') && ui.addForm) { ui.addForm.draft.description = t.value; autoGrow(t); }
  else if (t.matches('.tm-title, .tm-desc') && ui.modal?.type === 'task') {
    const tk = task(ui.modal.id);
    if (tk) { tk[t.dataset.field] = t.dataset.field === 'title' ? t.value.replace(/\n/g, ' ') : t.value; save(); }
    autoGrow(t);
  }
  else if (t.matches('.cm-input')) autoGrow(t);
  else if (t.matches('.search-input')) { ui.view.q = t.value; updateSearchResults(); }
  else if (t.matches('.sf-input') && ui.addSection) ui.addSection.name = t.value;
  else if (t.matches('.proj-desc')) { const p = proj(t.dataset.pid); if (p) { p.description = t.value; save(); } autoGrow(t); }
});
document.addEventListener('dblclick', e => {
  const cell = e.target.closest('.cal-cell');
  if (cell && !e.target.closest('.cal-chip')) { ui.calSel = cell.dataset.date; openQuick(); }
});
document.addEventListener('change', e => {
  if (e.target.matches?.('.goal-input')) { state.settings.dailyGoal = Math.max(1, Math.min(50, +e.target.value || 5)); commit(); }
});
document.addEventListener('focusout', e => {
  // po edycji w modalu odśwież listę w tle (bez ruszania modala)
  if (e.target.matches?.('.tm-title, .tm-desc')) {
    const tk = ui.modal && task(ui.modal.id);
    if (tk && e.target.matches('.tm-title') && !tk.title.trim()) { tk.title = 'Bez nazwy'; e.target.value = tk.title; }
    renderSidebar(); renderMain();
  }
});
document.addEventListener('keyup', e => {
  if (e.target.matches?.('.tf-title') && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) updatePreview(e.target);
});

const isTyping = el => el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
document.addEventListener('keydown', e => {
  const t = e.target;
  if (t.matches?.('.tf-title')) {
    const sug = $('.suggest-item', t.closest('.task-form'));
    if (sug && !e.isComposing && (e.key === 'Tab' || (e.key === 'Enter' && +sug.dataset.len > 1))) { e.preventDefault(); applySuggest(sug); return; }
    if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); submitForm(); return; }
    if (e.key === 'Escape') { e.preventDefault(); cancelForm(); return; }
  }
  if (t.matches?.('.tf-desc')) {
    if (e.key === 'Escape') { e.preventDefault(); cancelForm(); return; }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submitForm(); return; }
  }
  if (t.matches?.('.tm-title') && e.key === 'Enter') { e.preventDefault(); t.blur(); return; }
  if (t.matches?.('.sf-input')) {
    if (e.key === 'Enter') { e.preventDefault(); submitSection(); return; }
    if (e.key === 'Escape') { ui.addSection = null; render(); return; }
  }
  if (t.matches?.('.cm-input') && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addComment(ui.modal.id); return; }
  if (e.key === 'Escape') {
    if (!pop.hidden) { closePopover(); return; }
    if (ui.dialog) { closeDialog(); return; }
    if (isTyping(t)) { t.blur(); if (!ui.modal) return; }
    if (ui.modal) { if (ui.modal.type === 'quick') cancelForm(); else closeModal(); return; }
    if (ui.addForm) { cancelForm(); return; }
    return;
  }
  if ((e.key === 'Enter' || e.key === ' ') && t.matches?.('[role=button][data-act]')) { e.preventDefault(); t.click(); return; }
  if (isTyping(t) || ui.dialog || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (ui.gPending) {
    ui.gPending = false;
    const map = { h: 'home', i: 'inbox', t: 'today', u: 'upcoming', f: 'filters', c: 'completed', r: 'reports', k: 'calendar', s: 'focus', m: 'matrix', a: 'autoprio' };
    if (map[k]) { e.preventDefault(); ui.modal = null; setView({ type: map[k] }); }
    return;
  }
  if (k === 'q' || k === 'a') { e.preventDefault(); openQuick(); }
  else if (k === '/') { e.preventDefault(); ui.modal = null; setView({ type: 'search' }); }
  else if (k === 'm') { ui.sidebar = !ui.sidebar; render(); }
  else if (k === 'g') { ui.gPending = true; setTimeout(() => { ui.gPending = false; }, 1200); }
  else if (e.key === '?') { ui.modal = null; setView({ type: 'guide' }); }
  else if (k === 'v') { e.preventDefault(); openVoice(); }
  else if (k === ',') { ui.modal = null; setView({ type: 'prefs' }); }
});

// odświeżenie o północy / po powrocie do karty (zmiana „dziś”)
let lastDay = todayStr();
setInterval(() => { if (todayStr() !== lastDay) { lastDay = todayStr(); ui.upStart = weekStart(lastDay); render(); } }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && todayStr() !== lastDay) { lastDay = todayStr(); render(); } });

// ================================================================
//  Start
// ================================================================
// każde nowe uruchomienie (nie odświeżenie) startuje od widoku startowego – domyślnie „Start”
let freshLaunch = true;
try { freshLaunch = !sessionStorage.getItem('listo-ses'); sessionStorage.setItem('listo-ses', '1'); } catch (e) { /* */ }
if (freshLaunch || !location.hash) {
  const sv0 = state.settings.startView || 'home';
  try { history.replaceState(null, '', '#' + sv0); } catch (e) { /* */ }
  ui.view = hashView();
}
// ================================================================
//  Gesty dotykowe: przesuń w prawo = ukończ, w lewo = termin
// ================================================================
let sw = null, swipeBlockClick = false;
document.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch') return;
  const row = e.target.closest('.content .task');
  if (!row || e.target.closest('.check, .caret, button')) return;
  sw = { row, wrap: row.closest('.task-wrap'), x: e.clientX, y: e.clientY, dx: 0, on: false };
}, { passive: true });
document.addEventListener('pointermove', e => {
  if (!sw) return;
  const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
  if (!sw.on) {
    if (Math.abs(dy) > 10) { sw = null; return; }
    if (Math.abs(dx) < 14) return;
    sw.on = true; sw.row.classList.add('swiping');
  }
  sw.dx = Math.max(-140, Math.min(140, dx));
  sw.row.style.transform = `translateX(${sw.dx}px)`;
  sw.wrap.classList.toggle('swipe-right', sw.dx > 0);
  sw.wrap.classList.toggle('swipe-left', sw.dx < 0);
  sw.wrap.classList.toggle('swipe-armed', Math.abs(sw.dx) > 90);
}, { passive: true });
function endSwipe() {
  if (!sw) return;
  const s = sw; sw = null;
  if (!s.on) return;
  swipeBlockClick = true; setTimeout(() => { swipeBlockClick = false; }, 350);
  s.row.classList.remove('swiping');
  s.row.style.transform = '';
  setTimeout(() => s.wrap.classList.remove('swipe-right', 'swipe-left', 'swipe-armed'), 200);
  const id = s.row.dataset.id, t = task(id);
  if (!t) return;
  if (s.dx > 90) toggleTask(id);
  else if (s.dx < -90) datePicker(s.row, t, v => { Object.assign(t, v); commit(); });
}
document.addEventListener('pointerup', endSwipe);
document.addEventListener('pointercancel', () => { if (sw) { sw.row.classList.remove('swiping'); sw.row.style.transform = ''; sw.wrap.classList.remove('swipe-right', 'swipe-left', 'swipe-armed'); sw = null; } });
document.addEventListener('click', e => { if (swipeBlockClick) { e.stopPropagation(); e.preventDefault(); } }, true);

// ================================================================
//  Wygoda: menu pod prawym przyciskiem, skróty na najechanym zadaniu, Ctrl+Z
// ================================================================
const pointAnchor = (x, y) => ({ getBoundingClientRect: () => ({ left: x, right: x, top: y, bottom: y, width: 0, height: 0 }) });
document.addEventListener('contextmenu', e => {
  const row = e.target.closest('.content .task[data-id], .cal-chip[data-id]');
  if (!row || e.target.closest('a[href], input, textarea')) return;
  const t = task(row.dataset.id);
  if (!t || t.completed) return;
  e.preventDefault();
  if (ui.selected.size > 1 && ui.selected.has(t.id)) { bulkMenu(pointAnchor(e.clientX, e.clientY)); return; }
  taskMenu(pointAnchor(e.clientX, e.clientY), t);
});
document.addEventListener('mouseover', e => {
  const row = e.target.closest?.('.content .task[data-id]');
  ui.hoverId = row ? row.dataset.id : null;
});
function undoLast() {
  if (!ui.lastSnap) { toast('Nie ma czego cofnąć'); return; }
  state = JSON.parse(ui.lastSnap); ui.lastSnap = null;
  commit(); toast('Cofnięto ostatnią zmianę');
}
// skróty działające na zadaniu pod kursorem: D ukończ, T dziś, J jutro, 1–4 priorytet, E edytuj, Delete usuń
function hoverKeys(e) {
  const t = ui.hoverId && task(ui.hoverId);
  if (!t || t.completed || !$(`.content .task[data-id="${t.id}"]`)) return false;
  const k = e.key.toLowerCase(), td = todayStr(), snap = snapshot();
  const done = msg => { commit(); toast(msg, snap); return true; };
  if (k === 'd') { toggleTask(t.id); return true; }
  if (k === 't') { t.due = td; return done('Termin: dziś'); }
  if (k === 'j') { t.due = addDays(td, 1); return done('Termin: jutro'); }
  if (['1', '2', '3', '4'].includes(k)) { t.priority = +k; return done(`Priorytet ${k}`); }
  if (k === 'e') { openTask(t.id, true); return true; }
  if (e.key === 'Delete') { deleteTask(t); return true; }
  return false;
}

// ================================================================
//  Zaznaczanie wielu zadań (Ctrl/Shift + klik) i akcje zbiorcze
// ================================================================
const visibleRowIds = () => [...new Set($$('.content .task[data-id]').filter(r => r.offsetParent).map(r => r.dataset.id))];
function setSelected(ids) {
  ui.selected = new Set(ids.filter(id => { const t = task(id); return t && !t.completed; }));
  $$('.content .task[data-id]').forEach(r => r.classList.toggle('sel', ui.selected.has(r.dataset.id)));
  renderBulkBar();
}
document.addEventListener('click', e => {
  if (!(e.ctrlKey || e.metaKey || e.shiftKey)) return;
  const row = e.target.closest('.content .task[data-id]');
  if (!row || e.target.closest('.check, .caret, a[href]')) return;
  e.preventDefault(); e.stopPropagation();
  const id = row.dataset.id;
  if (e.shiftKey && ui.selAnchor) {
    const ids = visibleRowIds(), a = ids.indexOf(ui.selAnchor), b = ids.indexOf(id);
    if (a >= 0 && b >= 0) { setSelected([...ui.selected, ...ids.slice(Math.min(a, b), Math.max(a, b) + 1)]); return; }
  }
  const s = new Set(ui.selected);
  s.has(id) ? s.delete(id) : s.add(id);
  ui.selAnchor = id;
  setSelected([...s]);
}, true);
function renderBulkBar() {
  let bar = $('#bulk-bar');
  const n = ui.selected.size;
  if (!n) { if (bar) { bar.classList.add('out'); setTimeout(() => { if (!ui.selected.size) bar.remove(); }, 200); } return; }
  if (!bar || bar.classList.contains('out')) { bar?.remove(); bar = document.createElement('div'); bar.id = 'bulk-bar'; document.body.appendChild(bar); }
  bar.innerHTML = `<span class="bb-count"><b>${n}</b> ${plural(n, 'zaznaczone', 'zaznaczone', 'zaznaczonych')}</span>
    <button data-b="done" title="Ukończ zaznaczone">${sz(I.done, 18)}<span>Ukończ</span></button>
    <button data-b="today" title="Ustaw termin na dziś">${sz(I.today || I.calBig, 18)}<span>Dziś</span></button>
    <button data-b="date" title="Wybierz termin">${I.calBig}<span>Termin</span></button>
    <button data-b="prio" title="Priorytet">${flagIcon(1)}<span>Priorytet</span></button>
    <button data-b="move" title="Przenieś">${sz(I.move, 18)}<span>Przenieś</span></button>
    <button data-b="del" class="danger" title="Usuń">${sz(I.trash, 18)}</button>
    <button data-b="x" class="bb-x" title="Wyczyść zaznaczenie (Esc)">${sz(I.x, 16)}</button>`;
  bar.onclick = e => { const b = e.target.closest('[data-b]'); if (b) bulkAction(b.dataset.b, b); };
}
function bulkMenu(anchor) {
  openPopover(anchor, (pop, close) => {
    pop.innerHTML = `<div class="menu"><div class="menu-label">${ui.selected.size} zaznaczonych</div>
      ${[['done', 'Ukończ'], ['today', 'Termin: dziś'], ['tomorrow', 'Termin: jutro'], ['date', 'Wybierz termin…'], ['prio', 'Priorytet…'], ['move', 'Przenieś do…'], ['del', 'Usuń']]
        .map(([a, l]) => `<button class="menu-item ${a === 'del' ? 'danger' : ''}" data-b="${a}"><span class="grow">${l}</span></button>`).join('')}</div>`;
    pop.onclick = e => { const b = e.target.closest('[data-b]'); if (!b) return; close(); bulkAction(b.dataset.b, $('#bulk-bar') || document.body); };
  });
}
function bulkAction(a, anchor) {
  const ts = [...ui.selected].map(task).filter(Boolean);
  if (a === 'x') { setSelected([]); return; }
  if (!ts.length) return;
  const snap = snapshot(), td = todayStr();
  const finish = msg => { ui.selected.clear(); renderBulkBar(); commit(); toast(msg, snap); };
  const n = ts.length, word = plural(n, 'zadanie', 'zadania', 'zadań');
  if (a === 'done') {
    ts.forEach(t => { const c = $(`.check[data-id="${t.id}"]`); if (c) { c.closest('.task')?.classList.add('completing'); c.classList.add('pop'); burst(c, t.priority); } });
    playSound('done');
    setTimeout(() => {
      ts.forEach(t => {
        state.history.push({ id: t.id, title: t.title, at: Date.now(), projectId: t.projectId, priority: t.priority }); karmaOnDone(t);
        if (t.recurring) t.due = nextDue(t);
        else { t.completed = true; t.completedAt = Date.now(); descendants(t.id).forEach(d => { if (!d.completed) { d.completed = true; d.completedAt = Date.now(); } }); }
      });
      finish(`Ukończono ${n} ${word}`);
      if (n >= 3) celebrate();
    }, REDUCED ? 0 : 380);
  } else if (a === 'today' || a === 'tomorrow') {
    ts.forEach(t => { t.due = a === 'today' ? td : addDays(td, 1); });
    finish(`Przełożono ${n} ${word} na ${a === 'today' ? 'dziś' : 'jutro'}`);
  } else if (a === 'date') {
    datePicker(anchor, {}, v => { ts.forEach(t => Object.assign(t, v)); save(); render(); renderBulkBar(); ui.lastSnap = snap; });
    ui.popOnClose = () => { ui.selected.clear(); renderBulkBar(); render(); toast(`Zmieniono termin: ${n} ${word}`, snap); };
  } else if (a === 'prio') {
    prioPicker(anchor, 4, p => { ts.forEach(t => { t.priority = p; }); finish(`Priorytet ${p}: ${n} ${word}`); });
  } else if (a === 'move') {
    projectPicker(anchor, { projectId: null, sectionId: null }, v => {
      ts.forEach(t => { t.projectId = v.projectId; t.sectionId = v.sectionId || null; if (t.parentId && !ui.selected.has(t.parentId)) t.parentId = null; t.order = nextOrder(); descendants(t.id).forEach(d => { d.projectId = v.projectId; d.sectionId = t.sectionId; }); });
      finish(`Przeniesiono ${n} ${word} do: ${projName(proj(v.projectId))}`);
    });
  } else if (a === 'del') {
    confirmDlg(`Usunąć ${n} ${word}?`, 'Zaznaczone zadania wraz z podzadaniami zostaną usunięte.', 'Usuń', () => {
      const ids = new Set(ts.flatMap(t => [t.id, ...descendants(t.id).map(d => d.id)]));
      state.tasks = state.tasks.filter(x => !ids.has(x.id));
      finish(`Usunięto ${n} ${word}`);
    });
  }
}

// ================================================================
//  Paleta poleceń (Ctrl + K): skacz do widoków, projektów, zadań, uruchamiaj akcje
// ================================================================
const fold = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
function paletteItems(q) {
  const f = fold(q.trim());
  const go = (type, id) => () => { ui.modal = null; setView({ type, id }); };
  const views = [
    ['Start', 'home', I.home], ['Dziś', 'today', todayIcon()], ['Skrzynka', 'inbox', I.inbox], ['Nadchodzące', 'upcoming', I.upcoming], ['Kalendarz', 'calendar', I.calMonth],
    ['Matryca Eisenhowera', 'matrix', I.matrix], ['Filtry i etykiety', 'filters', I.filters], ['Raportowanie', 'reports', I.pulse], ['Skupienie', 'focus', I.timer],
    ['Auto-priorytety', 'autoprio', I.bolt], ['Ukończone', 'completed', I.done], ['Szukaj', 'search', I.search],
  ].map(([l, t, ic]) => ({ group: 'Przejdź', label: l, icon: ic, run: go(t) }));
  const projects = userProjects().map(p => ({ group: 'Projekty', label: p.name, icon: `<span class="pal-hash" style="color:${p.color && p.color !== '#808080' ? p.color : 'var(--muted)'}">#</span>`, run: go('project', p.id) }));
  const td = todayStr();
  const cmds = [
    { label: 'Dodaj zadanie', hint: 'Q', icon: I.plus, run: () => openQuick() },
    { label: 'Przełóż zaległe na dziś', icon: I.calBig, run: () => rescheduleOverdue() },
    { label: fz.running ? 'Wstrzymaj minutnik skupienia' : 'Rozpocznij sesję skupienia', icon: I.timer, run: () => { if (fz.running) fzPause(); else fzStart(); setView({ type: 'focus' }); } },
    { label: state.autoPrio.enabled ? 'Wyłącz auto-priorytety' : 'Włącz auto-priorytety', icon: I.bolt, run: () => apToggle() },
    { label: 'Historia sesji skupienia', icon: I.history, run: () => { ui.fzTab = 'history'; setView({ type: 'focus' }); } },
    { label: 'Motyw kolorystyczny…', icon: I.moon, run: () => themePicker($('#sidebar .user') || document.body) },
    { label: 'Cofnij ostatnią zmianę', hint: 'Ctrl Z', icon: I.repeat, run: undoLast },
    { label: 'Dodaj projekt', icon: I.plus, run: () => projectDialog() },
    { label: 'Statystyki produktywności', icon: I.pulse, run: () => setView({ type: 'reports' }) },
    { label: 'Skróty klawiszowe', hint: '?', icon: I.keyboard, run: shortcutsDialog },
  ].map(c => ({ group: 'Polecenia', ...c }));
  const tasks = active().filter(t => !f || fold(t.title).includes(f)).sort((a, b) => (a.due || '9') < (b.due || '9') ? -1 : 1).slice(0, f ? 8 : 5)
    .map(t => { const di = dueInfo(t.due, t.time); return { group: 'Zadania', label: t.title, icon: `<span class="check p${t.priority}" style="width:15px;height:15px;margin:0"></span>`, hint: di ? `<span class="meta-item due ${di.cls}">${di.label}</span>` : esc(projName(proj(t.projectId))), run: () => openTask(t.id) }; });
  let items = [...views, ...projects, ...cmds].filter(i => !f || fold(i.label).includes(f));
  items = f ? [...items, ...tasks] : [...cmds.slice(0, 3), ...views.slice(0, 4), ...tasks];
  if (f) items.push({ group: 'Nowe', label: `Dodaj zadanie: „${q.trim()}”`, icon: I.plus, hint: 'Enter', run: () => quickCreate(q.trim()), create: true });
  return items;
}
function quickCreate(text) {
  const r = parseQuick(text, {});
  if (!r.title) return;
  const labels = r.labels.map(n => { let l = state.labels.find(x => x.name.toLowerCase() === n.toLowerCase()); if (!l) { l = { id: uid(), name: n, color: '#808080' }; state.labels.push(l); } return l.id; });
  const t = newTask({ title: r.title, description: '', projectId: r.projectId || 'inbox', sectionId: r.sectionId || null, parentId: null, priority: r.priority || 4, due: r.due || null, time: r.time || null, recurring: r.recurring || null, labels, order: nextOrder() });
  state.tasks.push(t); markEnter(t.id); commit();
  toast(`Dodano zadanie do: ${projName(proj(t.projectId))}`, null, () => openTask(t.id), 'Otwórz');
}
function openPalette() {
  if ($('#palette')) return;
  closePopover(true);
  const root = document.createElement('div');
  root.id = 'palette';
  root.innerHTML = `<div class="pal-box" role="dialog" aria-label="Paleta poleceń">
    <div class="pal-in">${I.search}<input class="pal-input" placeholder="Szukaj zadań, projektów, poleceń… lub wpisz nowe zadanie" autocomplete="off" spellcheck="false"><kbd>Esc</kbd></div>
    <div class="pal-list" role="listbox"></div>
    <div class="pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd> wybierz</span><span><kbd>Enter</kbd> otwórz</span><span><kbd>Ctrl</kbd><kbd>K</kbd> zamknij</span></div></div>`;
  document.body.appendChild(root);
  const inp = $('.pal-input', root), list = $('.pal-list', root);
  let items = [], idx = 0;
  const draw = () => {
    items = paletteItems(inp.value);
    idx = Math.min(idx, items.length - 1); if (idx < 0) idx = 0;
    let g = '';
    list.innerHTML = items.map((it, i) => {
      const head = it.group !== g ? `<div class="pal-group">${(g = it.group)}</div>` : '';
      return `${head}<button class="pal-item ${i === idx ? 'on' : ''}" data-i="${i}" role="option"><span class="pal-ic">${it.icon || ''}</span><span class="grow">${esc(it.label)}</span>${it.hint ? `<span class="pal-hint">${it.hint}</span>` : ''}</button>`;
    }).join('') || '<div class="pal-empty">Brak wyników</div>';
  };
  const mark = () => { $$('.pal-item', list).forEach(b => b.classList.toggle('on', +b.dataset.i === idx)); $(`.pal-item[data-i="${idx}"]`, list)?.scrollIntoView({ block: 'nearest' }); };
  const run = i => { const it = items[i]; closePalette(); if (it) it.run(); };
  inp.addEventListener('input', () => { idx = 0; draw(); });
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); idx = (idx + 1) % items.length; mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); idx = (idx - 1 + items.length) % items.length; mark(); }
    else if (e.key === 'Enter') { e.preventDefault(); run(idx); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePalette(); }
  });
  list.addEventListener('mousemove', e => { const b = e.target.closest('.pal-item'); if (b && +b.dataset.i !== idx) { idx = +b.dataset.i; mark(); } });
  list.addEventListener('click', e => { const b = e.target.closest('.pal-item'); if (b) run(+b.dataset.i); });
  root.addEventListener('mousedown', e => { if (e.target === root) closePalette(); });
  draw();
  inp.focus();
}
function closePalette() {
  const root = $('#palette');
  if (!root) return;
  root.classList.add('closing');
  setTimeout(() => root.remove(), REDUCED ? 0 : 150);
}

// ================================================================
//  Wklejenie listy (kilka linii) w pole zadania = kilka zadań naraz
// ================================================================
document.addEventListener('paste', e => {
  const inp = e.target;
  if (!inp.matches?.('.tf-title') || !ui.addForm) return;
  const text = (e.clipboardData || window.clipboardData)?.getData('text') || '';
  const lines = text.split(/\r?\n/).map(l => l.replace(/^\s*(?:[-*•–]|\[[ xX]?\]|\d+[.)])\s*/, '').trim()).filter(Boolean);
  if (lines.length < 2) return;
  e.preventDefault();
  const f = ui.addForm, d = f.draft, snap = snapshot();
  lines.slice(0, 100).forEach((line, i) => {
    const r = parseQuick(line, { projectId: d.projectId });
    if (!r.title) return;
    const labelIds = [...d.labels];
    r.labels.forEach(n => { let l = state.labels.find(x => x.name.toLowerCase() === n.toLowerCase()); if (!l) { l = { id: uid(), name: n, color: '#808080' }; state.labels.push(l); } if (!labelIds.includes(l.id)) labelIds.push(l.id); });
    let projectId = r.projectId || d.projectId || 'inbox', sectionId = r.projectId && r.projectId !== d.projectId ? r.sectionId : (r.sectionId || d.sectionId);
    const parentId = d.parentId || null;
    if (parentId) { const par = task(parentId); if (par) { projectId = par.projectId; sectionId = par.sectionId; } }
    const t = newTask({ title: r.title, description: '', projectId, sectionId: sectionId || null, parentId, priority: r.priority || d.priority || 4,
      due: r.due || d.due || null, time: r.time || null, recurring: r.recurring || d.recurring || null, labels: labelIds, order: nextOrder() + i * 0.001 });
    state.tasks.push(t); markEnter(t.id);
  });
  const n = Math.min(lines.length, 100);
  if (f.ctx === 'quick') { ui.addForm = null; ui.modal = null; } else { f.draft = freshDraft(f.defaults); ui.focusSel = '.task-form .tf-title'; }
  commit();
  toast(`Dodano ${n} ${plural(n, 'zadanie', 'zadania', 'zadań')} z wklejonej listy`, snap);
});

// ================================================================
//  Responsywność: fala po kliknięciu, ostatnia pozycja kursora (dla okien)
// ================================================================
const lastPointer = { x: 0, y: 0, at: 0 };
document.addEventListener('pointerdown', e => {
  lastPointer.x = e.clientX; lastPointer.y = e.clientY; lastPointer.at = Date.now();
  if (REDUCED) return;
  const el = e.target.closest('.nav-item, .btn, .menu-item, .dp2-q, .dp2-btn, .tb-btn, .pal-item, #bulk-bar button, .tp-item, .add-task');
  if (!el || e.button !== 0) return;
  const r = el.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2.2;
  const w = document.createElement('span');
  w.className = 'ripple';
  w.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
  el.appendChild(w);
  setTimeout(() => w.remove(), 600);
}, true);

document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 'k') { e.preventDefault(); $('#palette') ? closePalette() : openPalette(); return; }
  if ($('#palette')) return;
  if (e.key === 'Escape' && ui.selected.size && pop.hidden && !ui.dialog) { e.preventDefault(); e.stopImmediatePropagation(); setSelected([]); return; }
  if (isTyping(e.target) || ui.dialog || ui.modal) return;
  if ((e.ctrlKey || e.metaKey) && k === 'z' && !e.shiftKey) { e.preventDefault(); undoLast(); return; }
  if ((e.ctrlKey || e.metaKey) && k === 'a' && $('.content .task[data-id]')) { e.preventDefault(); setSelected(visibleRowIds()); return; }
  if (e.ctrlKey || e.metaKey || e.altKey || !pop.hidden || ui.gPending) return;
  if (hoverKeys(e)) { e.preventDefault(); e.stopImmediatePropagation(); }
}, true);

// ================================================================
//  Auto-priorytety: domyślnie ręczne, opcjonalnie reguły (termin, projekt, sekcja, etykieta)
//  Reguły tylko PODNOSZĄ priorytet – Twój własny jest zapamiętany i wraca, gdy reguła przestanie działać.
// ================================================================
const AP_DUE = [['overdue', 'Po terminie', 'termin już minął'], ['today', 'Termin dziś', 'zadania na dzisiaj'], ['tomorrow', 'Termin jutro', 'zadania na jutro'], ['d3', 'W ciągu 3 dni', 'termin za 2–3 dni'], ['d7', 'W ciągu tygodnia', 'termin za 4–7 dni']];
function apDueKey(t, td) {
  if (!t.due) return null;
  const n = diffDays(t.due, td);
  return n < 0 ? 'overdue' : n === 0 ? 'today' : n === 1 ? 'tomorrow' : n <= 3 ? 'd3' : n <= 7 ? 'd7' : null;
}
function apTarget(r) {
  if (r.kind === 'project') { const p = proj(r.ref); return p ? { name: projName(p), icon: '#', color: p.color } : null; }
  if (r.kind === 'section') { for (const p of state.projects) { const s = p.sections.find(x => x.id === r.ref); if (s) return { name: `${projName(p)} / ${s.name}`, icon: '§', color: p.color }; } return null; }
  const l = label(r.ref); return l ? { name: l.name, icon: '@', color: l.color } : null;
}
function apMatch(t, td) {
  const a = state.autoPrio;
  let best = null;
  const k = apDueKey(t, td);
  if (k && a.due[k].on) best = { p: a.due[k].p, why: AP_DUE.find(x => x[0] === k)[1] };
  a.rules.forEach(r => {
    if (!r.on) return;
    const hit = r.kind === 'project' ? t.projectId === r.ref : r.kind === 'section' ? t.sectionId === r.ref : t.labels.includes(r.ref);
    const tg = hit && apTarget(r);
    if (tg && (!best || r.p < best.p)) best = { p: r.p, why: (r.kind === 'label' ? '@' : '#') + tg.name };
  });
  return best;
}
function apLog(t, from, to, why) {
  const a = state.autoPrio;
  a.log.unshift({ at: Date.now(), id: t.id, title: t.title, from, to, why });
  if (a.log.length > 40) a.log.length = 40;
}
function applyAutoPrio() {
  const a = state.autoPrio;
  if (!a) return false;
  const td = todayStr();
  let ch = false;
  state.tasks.forEach(t => {
    if (t.completed) return;
    // użytkownik zmienił priorytet ręcznie → to jest teraz jego priorytet bazowy
    if (t.autoSet != null && t.priority !== t.autoSet) { delete t.autoSet; delete t.prio0; delete t.autoWhy; ch = true; }
    const base = t.autoSet != null ? t.prio0 : t.priority;
    const r = a.enabled && !t.noAuto ? apMatch(t, td) : null;
    if (r && r.p < base) {
      if (t.autoSet !== r.p) { apLog(t, t.priority, r.p, r.why); t.prio0 = base; t.autoSet = r.p; t.priority = r.p; ch = true; }
      if (t.autoWhy !== r.why) { t.autoWhy = r.why; ch = true; }
    } else if (t.autoSet != null) {
      if (a.enabled) apLog(t, t.priority, base, 'powrót do Twojego priorytetu');
      t.priority = base; delete t.autoSet; delete t.prio0; delete t.autoWhy; ch = true;
    }
  });
  return ch;
}
function apToggle() {
  const a = state.autoPrio;
  a.enabled = !a.enabled;
  document.documentElement.classList.add('theme-fade');
  setTimeout(() => document.documentElement.classList.remove('theme-fade'), 600);
  commit();
  const n = active().filter(t => t.autoSet != null).length;
  toast(a.enabled ? `⚡ Auto-priorytety włączone – podniesiono ${n} ${plural(n, 'zadanie', 'zadania', 'zadań')}` : 'Auto-priorytety wyłączone – przywrócono Twoje priorytety');
}
function apAddRule() {
  const v = $('.ap-sel')?.value;
  if (!v) { toast('Wybierz projekt, sekcję albo etykietę'); return; }
  const i = v.indexOf(':');
  state.autoPrio.rules.push({ id: uid(), kind: v.slice(0, i), ref: v.slice(i + 1), p: ui.apNewP || 1, on: true });
  ui.apFlash = state.autoPrio.rules[state.autoPrio.rules.length - 1].id;
  commit();
}
const apSwitch = (on, act, extra = '', label = '') => `<button class="switch ${on ? 'on' : ''}" data-act="${act}" ${extra} role="switch" aria-checked="${on}" aria-label="${esc(label)}"><i></i></button>`;
const apPrios = (cur, act, extra) => `<div class="ap-prio">${[1, 2, 3].map(p => `<button class="ap-p ${cur === p ? 'sel p' + p : ''}" data-act="${act}" data-p="${p}" ${extra} title="Priorytet ${p}">${flagIcon(p, 13)}P${p}</button>`).join('')}</div>`;
function renderAutoPrio() {
  const a = state.autoPrio, td = todayStr(), act = active();
  const on = a.enabled;
  let html = header('Auto-priorytety', { icon: sz(I.bolt, 24), iconCls: 'soft-amber', sub: 'Domyślnie priorytety ustawiasz sam. Tutaj możesz pozwolić Listo podnosić je automatycznie – nigdy nie obniży Twojego wyboru.' });
  const raised = act.filter(t => t.autoSet != null).length;
  html += `<div class="ap-hero ${on ? 'on' : ''}">
    <span class="ap-hero-ic">${sz(I.bolt, 22)}</span>
    <div class="grow"><b>Automatyczne priorytety</b><div class="small">${on ? `Włączone · teraz podniesione: <b>${raised}</b> ${plural(raised, 'zadanie', 'zadania', 'zadań')}` : 'Wyłączone – wszystkie priorytety ustawiasz ręcznie'}</div></div>
    ${apSwitch(on, 'ap-toggle', '', 'Automatyczne priorytety')}
  </div>`;
  const dueCount = k => act.filter(t => apDueKey(t, td) === k).length;
  html += `<div class="ap-grid ${on ? '' : 'is-off'}">
    <section class="ap-card" style="--i:1"><h3>${sz(I.cal, 16)} Bliskość terminu</h3><p class="muted small">Im bliżej terminu, tym wyższy priorytet.</p>
      ${AP_DUE.map(([k, l, d]) => { const r = a.due[k]; return `<div class="ap-row ${r.on ? '' : 'off'}">${apSwitch(r.on, 'ap-due', `data-k="${k}"`, l)}
        <div class="grow"><b>${l}</b><span class="muted small">${d} · ${dueCount(k)} ${plural(dueCount(k), 'zadanie', 'zadania', 'zadań')}</span></div>${apPrios(r.p, 'ap-due-p', `data-k="${k}"`)}</div>`; }).join('')}
    </section>
    <section class="ap-card" style="--i:2"><h3><span class="hash">#</span> Projekty, sekcje i etykiety</h3><p class="muted small">Zadania w wybranym miejscu dostają co najmniej wskazany priorytet.</p>
      ${a.rules.map(r => { const tg = apTarget(r); if (!tg) return ''; const n = act.filter(t => r.kind === 'project' ? t.projectId === r.ref : r.kind === 'section' ? t.sectionId === r.ref : t.labels.includes(r.ref)).length;
        return `<div class="ap-row ${r.on ? '' : 'off'} ${ui.apFlash === r.id ? 'flash' : ''}">${apSwitch(r.on, 'ap-rule', `data-rid="${r.id}"`, tg.name)}
          <div class="grow"><b><span style="color:${tg.color && tg.color !== '#808080' ? tg.color : 'var(--muted)'}">${tg.icon}</span> ${esc(tg.name)}</b><span class="muted small">${n} ${plural(n, 'aktywne zadanie', 'aktywne zadania', 'aktywnych zadań')}</span></div>
          ${apPrios(r.p, 'ap-rule-p', `data-rid="${r.id}"`)}<button class="icon-btn" data-act="ap-rule-del" data-rid="${r.id}" title="Usuń regułę">${I.trash}</button></div>`; }).join('') || '<div class="ap-empty muted small">Brak reguł – dodaj pierwszą poniżej, np. „Studia / Kolosy → P1”.</div>'}
      <div class="ap-add">
        <select class="ap-sel" aria-label="Projekt, sekcja lub etykieta"><option value="">Wybierz…</option>
          <optgroup label="Projekty">${[proj('inbox'), ...userProjects()].map(p => `<option value="project:${p.id}">#${esc(projName(p))}</option>`).join('')}</optgroup>
          <optgroup label="Sekcje">${userProjects().flatMap(p => p.sections.map(s => `<option value="section:${s.id}">${esc(p.name)} / ${esc(s.name)}</option>`)).join('')}</optgroup>
          ${state.labels.length ? `<optgroup label="Etykiety">${state.labels.map(l => `<option value="label:${l.id}">@${esc(l.name)}</option>`).join('')}</optgroup>` : ''}
        </select>
        ${apPrios(ui.apNewP || 1, 'ap-new-p', '')}
        <button class="btn primary" data-act="ap-add">Dodaj regułę</button>
      </div>
    </section>
  </div>`;
  ui.apFlash = null;
  // podgląd na żywo
  const prev = act.filter(t => !t.noAuto).map(t => ({ t, r: apMatch(t, td), base: t.autoSet != null ? t.prio0 : t.priority })).filter(x => x.r && x.r.p < x.base)
    .sort((x, y) => x.r.p - y.r.p || byDue(x.t, y.t));
  html += `<section class="ap-card ap-prev" style="--i:3"><h3>${on ? 'Podniesione teraz' : 'Podgląd'} <span class="count">${prev.length}</span></h3>
    <p class="muted small">${on ? 'Te zadania mają teraz priorytet ustawiony przez reguły. Zmień priorytet ręcznie albo wyklucz zadanie, jeśli się nie zgadzasz.' : 'Tak zmieniłyby się priorytety po włączeniu – nic jeszcze nie zostało zmienione.'}</p>
    ${prev.length ? prev.slice(0, 60).map((x, i) => { const p = proj(x.t.projectId), di = dueInfo(x.t.due, x.t.time);
      return `<div class="ap-task" style="--i:${Math.min(i, 14)}"><span class="check p${x.r.p}" style="pointer-events:none"></span>
        <button class="grow ap-task-main" data-act="open" data-id="${x.t.id}"><span class="ap-task-t">${esc(x.t.title)}</span><span class="muted small">${di ? `<span class="due-txt ${di.cls}">${di.label}</span> · ` : ''}${esc(x.r.why)} · ${esc(projName(p))}</span></button>
        <span class="ap-change">${flagIcon(x.base, 13)}<span class="muted">P${x.base}</span><span class="ap-arrow">→</span>${flagIcon(x.r.p, 13)}<b class="pc${x.r.p}">P${x.r.p}</b></span>
        <button class="btn ghost sm" data-act="ap-exclude" data-id="${x.t.id}">Wyklucz</button></div>`; }).join('') : '<div class="ap-empty muted small">Żadne zadanie nie spełnia teraz reguł.</div>'}
  </section>`;
  const ex = act.filter(t => t.noAuto);
  if (ex.length) html += `<section class="ap-card" style="--i:4"><h3>Wykluczone zadania <span class="count">${ex.length}</span></h3>${ex.map(t => `<div class="ap-task"><span class="check p${t.priority}" style="pointer-events:none"></span><button class="grow ap-task-main" data-act="open" data-id="${t.id}"><span class="ap-task-t">${esc(t.title)}</span></button><button class="btn ghost sm" data-act="ap-exclude" data-id="${t.id}">Przywróć</button></div>`).join('')}</section>`;
  if (a.log.length) html += `<section class="ap-card" style="--i:5"><h3>Ostatnie automatyczne zmiany <button class="btn ghost sm" data-act="ap-log-clear" style="margin-left:auto">Wyczyść</button></h3>
    ${a.log.slice(0, 15).map(l => `<div class="ap-log"><span class="muted small">${fmtDateTime(l.at)}</span><span class="grow">${esc(l.title)}</span><span class="ap-change"><span class="muted">P${l.from}</span><span class="ap-arrow">→</span><b class="pc${l.to}">P${l.to}</b></span><span class="muted small ap-log-why">${esc(l.why)}</span></div>`).join('')}</section>`;
  return html;
}
setInterval(() => { if (applyAutoPrio()) { save(); if (!ui.addForm && !ui.modal && !ui.dialog && pop.hidden) render(); } }, 60000);

// ================================================================
//  Matryca Eisenhowera – przeciągnij zadanie, a priorytet i termin zmienią się same
// ================================================================
const MXQ = { q1: ['Zrób teraz', 'Pilne i ważne', 'P1 · termin dziś'], q2: ['Zaplanuj', 'Ważne, ale nie pilne', 'P2 · termin później'], q3: ['Zrób szybko', 'Pilne, mniej ważne', 'P3 · termin dziś'], q4: ['Odłóż', 'Ani pilne, ani ważne', 'P4 · bez pośpiechu'] };
function mxQuad(t, td, days) {
  const imp = t.priority <= 2, urg = !!t.due && diffDays(t.due, td) <= days;
  return imp ? (urg ? 'q1' : 'q2') : (urg ? 'q3' : 'q4');
}
function mxMoveTo(t, q) {
  if (!t) return;
  const td = todayStr(), days = state.settings.mxDays ?? 2;
  if (mxQuad(t, td, days) === q) return;
  const snap = snapshot();
  const wantImp = q === 'q1' || q === 'q2', wantUrg = q === 'q1' || q === 'q3';
  const imp = t.priority <= 2, urg = !!t.due && diffDays(t.due, td) <= days;
  const ch = [];
  if (wantImp && !imp) t.priority = q === 'q1' ? 1 : 2;
  if (!wantImp && imp) t.priority = q === 'q3' ? 3 : 4;
  if (wantImp !== imp) ch.push('P' + t.priority);
  if (wantUrg && !urg) { t.due = td; ch.push('termin dziś'); }
  if (!wantUrg && urg) { let d = nextWeekday(td, 1, false); if (diffDays(d, td) <= days) d = addDays(td, days + 1); t.due = d; ch.push('termin ' + dueInfo(d).label.toLowerCase()); }
  ui.mxFlash = t.id;
  playSound('restore');
  commit();
  toast(`„${t.title}” → ${MXQ[q][0]}${ch.length ? ': ' + ch.join(', ') : ''}`, snap);
}
function mxMenu(anchor, t) {
  if (!t) return;
  const cur = mxQuad(t, todayStr(), state.settings.mxDays ?? 2);
  openPopover(anchor, (pop, close) => {
    pop.innerHTML = `<div class="menu"><div class="menu-label">Przenieś do ćwiartki</div>${Object.entries(MXQ).map(([k, [n, d]]) => `<button class="menu-item ${k === cur ? 'sel' : ''}" data-q="${k}"><span class="mx-dot ${k}"></span><span class="grow">${n}<br><span class="muted small">${d}</span></span>${k === cur ? I.checkSmall : ''}</button>`).join('')}</div>`;
    pop.onclick = e => { const b = e.target.closest('[data-q]'); if (!b) return; close(); mxMoveTo(t, b.dataset.q); };
  });
}
function renderMatrix() {
  const td = todayStr(), days = state.settings.mxDays ?? 2, pf = ui.mxProj || '';
  const qs = { q1: [], q2: [], q3: [], q4: [] };
  active().filter(t => !pf || t.projectId === pf).forEach(t => qs[mxQuad(t, td, days)].push(t));
  Object.values(qs).forEach(a => a.sort((x, y) => x.priority - y.priority || byDue(x, y)));
  let html = header('Matryca Eisenhowera', { icon: sz(I.matrix, 24), barTitle: 'Matryca', sub: 'Przeciągnij zadanie do innej ćwiartki – priorytet i termin zmienią się same. Na telefonie użyj przycisku ⋯.' });
  html += `<div class="mx-bar">
    <span class="mx-bar-l">Pilne, gdy termin</span><div class="seg-inline">${[[0, 'dziś'], [1, 'do jutra'], [2, 'w 2 dni'], [3, 'w 3 dni'], [7, 'w tydzień']].map(([n, l]) => `<button class="${days === n ? 'sel' : ''}" data-act="mx-days" data-n="${n}">${l}</button>`).join('')}</div>
    <span class="mx-bar-l">Projekt</span><div class="seg-inline">${[['', 'Wszystkie'], ...[proj('inbox'), ...userProjects()].map(p => [p.id, projName(p)])].map(([v, l]) => `<button class="${pf === v ? 'sel' : ''}" data-act="mx-proj" data-v="${v}">${esc(l)}</button>`).join('')}</div>
  </div>`;
  let k = 0;
  const card = t => {
    const di = dueInfo(t.due, t.time), p = proj(t.projectId);
    return `<div class="mx-card ${ui.mxFlash === t.id ? 'flash' : ''}" draggable="true" data-mx="${t.id}" style="--i:${Math.min(k++, 24)}">
      <button class="check p${t.priority}" data-act="toggle" data-id="${t.id}" aria-label="Ukończ zadanie">${I.check}</button>
      <div class="mx-c-main" data-act="open" data-id="${t.id}"><span class="mx-c-t">${fmtText(t.title)}</span>
        <span class="mx-c-m">${di ? `<span class="due-txt ${di.cls}">${I.cal} ${di.label}</span>` : ''}<span>${esc(projName(p))}</span>${t.autoSet != null ? `<span class="ap-mini">${sz(I.bolt, 11)}</span>` : ''}</span></div>
      <button class="icon-btn mx-c-more" data-act="mx-move" data-id="${t.id}" title="Przenieś do ćwiartki" aria-label="Przenieś do ćwiartki">${I.dots}</button></div>`;
  };
  const quad = q => `<section class="mx-q ${q}" data-q="${q}">
    <header><span class="mx-n">${q.slice(1)}</span><div class="grow"><h3>${MXQ[q][0]}</h3><span>${MXQ[q][1]}</span></div><span class="mx-count">${qs[q].length}</span></header>
    <div class="mx-list">${qs[q].slice(0, 40).map(card).join('') || `<div class="mx-empty">Pusto – przeciągnij tu zadanie</div>`}${qs[q].length > 40 ? `<div class="mx-more">+${qs[q].length - 40} więcej</div>` : ''}</div>
    <div class="mx-drop-hint">Upuść: ${MXQ[q][2]}</div></section>`;
  html += `<div class="mx"><div class="mx-ax-top"><span>Pilne</span><span>Niepilne</span></div><div class="mx-ax-left"><span>Ważne</span><span>Mniej ważne</span></div>
    <div class="mx-grid">${quad('q1')}${quad('q2')}${quad('q3')}${quad('q4')}</div></div>`;
  ui.mxFlash = null;
  return html;
}
let mxDrag = null;
document.addEventListener('dragstart', e => {
  const c = e.target.closest?.('.mx-card');
  if (!c) return;
  mxDrag = c.dataset.mx;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', mxDrag);
  requestAnimationFrame(() => { c.classList.add('dragging'); $('.mx')?.classList.add('dragging'); });
});
document.addEventListener('dragover', e => {
  if (!mxDrag) return;
  const q = e.target.closest('.mx-q');
  $$('.mx-q.over').forEach(x => { if (x !== q) x.classList.remove('over'); });
  if (q) { e.preventDefault(); q.classList.add('over'); }
});
document.addEventListener('drop', e => {
  if (!mxDrag) return;
  const q = e.target.closest('.mx-q'), id = mxDrag;
  mxDrag = null;
  if (!q) return;
  e.preventDefault();
  mxMoveTo(task(id), q.dataset.q);
});
document.addEventListener('dragend', () => { mxDrag = null; $$('.mx-q.over, .mx-card.dragging, .mx.dragging').forEach(x => x.classList.remove('over', 'dragging')); });

// ================================================================
//  Start – widok główny: wszystko, co ważne, w jednym miejscu
// ================================================================
function homeScore(t, td) {
  let s = (5 - t.priority) * 90;
  if (t.due) { const n = diffDays(t.due, td); s += n < 0 ? 1000 - n * 4 : n === 0 ? 620 : n === 1 ? 320 : n <= 7 ? 170 - n * 12 : 0; }
  if (t.time && t.due === td) s += 40 - parseInt(t.time, 10);
  return s;
}
function homeAdd(text) {
  const r = parseQuick(text, {});
  if (!r.title) return;
  const labels = r.labels.map(n => { let l = state.labels.find(x => x.name.toLowerCase() === n.toLowerCase()); if (!l) { l = { id: uid(), name: n, color: '#808080' }; state.labels.push(l); } return l.id; });
  const t = newTask({ title: r.title, description: '', projectId: r.projectId || 'inbox', sectionId: r.sectionId || null, parentId: null, priority: r.priority || 4, due: r.due || todayStr(), time: r.time || null, recurring: r.recurring || null, labels, order: nextOrder() });
  state.tasks.push(t); markEnter(t.id);
  ui.focusSel = '.home-add';
  commit();
  toast(`Dodano: ${dueInfo(t.due, t.time).label} · ${projName(proj(t.projectId))}`, null, () => openTask(t.id), 'Otwórz');
}
function countUp() {
  if (REDUCED) return;
  $$('.cnt-up').forEach(el => {
    const to = +el.dataset.to, t0 = performance.now(), d = 700;
    if (!to) return;
    const step = now => { const p = Math.min(1, (now - t0) / d), e = 1 - Math.pow(1 - p, 3); el.textContent = Math.round(to * e); if (p < 1) requestAnimationFrame(step); };
    el.textContent = '0'; requestAnimationFrame(step);
  });
}
document.addEventListener('click', e => { if (e.target.closest('[data-act="home-reset-skip"]')) { ui.homeSkip = new Set(); ui.homeAnim = true; render(); } });
document.addEventListener('keydown', e => {
  const inp = e.target.closest?.('.home-add');
  if (!inp || e.key !== 'Enter' || e.isComposing) return;
  e.preventDefault();
  const v = inp.value.trim();
  if (v) { inp.value = ''; homeAdd(v); }
});
document.addEventListener('input', e => {
  const inp = e.target.closest?.('.home-add');
  if (!inp) return;
  const box = $('.hm-qa-prev'), v = inp.value.trim();
  if (!box) return;
  if (!v) { box.innerHTML = ''; return; }
  const r = parseQuick(v, {});
  const due = r.due || todayStr(), di = dueInfo(due, r.time);
  box.innerHTML = `<span class="pchip due ${di.cls}">${I.cal} ${di.label}</span>${r.priority ? `<span class="pchip">${flagIcon(r.priority, 12)} P${r.priority}</span>` : ''}<span class="pchip"># ${esc(projName(proj(r.projectId || 'inbox')))}</span>${r.labels.map(l => `<span class="pchip">@${esc(l)}</span>`).join('')}`;
});
setInterval(() => { const c = $('#home-clock'); if (c) c.textContent = nowHM(); }, 15000);
// ================================================================
//  v9 – kolory zakładek, ustawienia, poradnik, nawyki, głos, ekran startowy
// ================================================================
const NAV_HUE = {
  home: 'var(--accent)', search: '#8f9aa6', inbox: '#4f8ff7', today: '#3ec26a', upcoming: '#9466f0', calendar: '#f5a531', matrix: '#ff6f61',
  filters: '#e05194', label: '#e05194', filter: '#e05194', reports: '#14aaf5', focus: '#2bb5a3', autoprio: '#f5a531', habits: '#7ecc49',
  completed: '#3ec26a', prefs: '#8f9aa6', guide: '#4f8ff7',
};
function applyPrefs() {
  const s = state.settings, root = document.documentElement;
  root.classList.toggle('dens-compact', s.density === 'compact');
  root.classList.toggle('dens-roomy', s.density === 'roomy');
  root.classList.toggle('no-anim', s.anim === 'off');
  root.classList.toggle('plain-nav', s.navColors === false);
  root.classList.toggle('hide-desc', s.showDesc === false);
  root.classList.toggle('no-hover-fx', s.hoverFx === false);
  const z = (+s.scale || 100) / 100;
  root.style.zoom = z === 1 ? '' : String(z);
  const p = s.pomo || PREF_DEFAULTS.pomo;
  FOCUS_MODES.work[1] = p[0]; FOCUS_MODES.short[1] = p[1]; FOCUS_MODES.long[1] = p[2];
}
function setPref(k, v, el) {
  if (k === 'theme' || k === 'accent') { document.documentElement.classList.add('theme-fade'); setTimeout(() => document.documentElement.classList.remove('theme-fade'), 600); }
  state.settings[k] = v;
  if (k === 'pomo' && !fz.running && !fz.sess) { applyPrefs(); fz.remaining = fzTotal(); fzPersist(); }
  // w Ustawieniach zmieniamy tylko klikniętą kontrolkę – bez przerysowania strony (koniec z migotaniem)
  if (el && ui.view.type === 'prefs' && el.isConnected) { save(); applyTheme(); applyPrefs(); renderSidebar(); prefSync(el, k, v); return; }
  commit();
}
function prefSync(el, k, v) {
  const grp = el.closest('.seg-inline, .pf-sw');
  if (grp) { const cls = grp.classList.contains('pf-sw') ? 'on' : 'sel'; $$('button', grp).forEach(b => b.classList.toggle(cls, b === el)); }
  if (el.classList.contains('switch')) { el.classList.toggle('on', !!v); el.setAttribute('aria-checked', String(!!v)); }
  if (el.classList.contains('pf-chk')) el.classList.toggle('on');
  if (el.dataset.act === 'pref-step') { const b = $('b', el.parentElement); if (b) b.textContent = k === 'pomo' ? v[+el.dataset.i] + ' min' : v; b?.classList.remove('bump'); void b?.offsetWidth; b?.classList.add('bump'); }
  if (k === 'accent') { const d = $('.grow span', el.closest('.pf-row')); if (d) d.textContent = ACCENTS.find(a => a.id === v)?.name || ''; }
}

// ---------- wspólne kawałki interfejsu ----------
const segBtns = (k, cur, opts, act = 'pref') => `<div class="seg-inline">${opts.map(([v, l]) => `<button class="${String(cur) === String(v) ? 'sel' : ''}" data-act="${act}" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</div>`;
const swBtn = (on, k, act = 'pref-tg', extra = '') => `<button class="switch ${on ? 'on' : ''}" data-act="${act}" data-k="${k}" ${extra} role="switch" aria-checked="${!!on}"><i></i></button>`;
const prefRow = (title, desc, ctrl) => `<div class="pf-row"><div class="grow"><b>${title}</b>${desc ? `<span>${desc}</span>` : ''}</div><div class="pf-ctrl">${ctrl}</div></div>`;
const stepper = (k, val, d, extra = '', unit = '') => `<div class="stepper"><button data-act="pref-step" data-k="${k}" data-d="-${d}" ${extra} aria-label="Mniej">−</button><b>${val}${unit}</b><button data-act="pref-step" data-k="${k}" data-d="${d}" ${extra} aria-label="Więcej">+</button></div>`;

// ---------- pasek statystyk pod nagłówkiem (projekt, skrzynka, etykieta, filtr) ----------
function insightBar(v) {
  const td = todayStr();
  let list, done;
  if (v.type === 'project' || v.type === 'inbox') { const pid = v.type === 'inbox' ? 'inbox' : v.id; list = active().filter(t => t.projectId === pid); done = state.tasks.filter(t => t.projectId === pid && t.completed); }
  else if (v.type === 'label') { list = active().filter(t => t.labels.includes(v.id)); done = state.tasks.filter(t => t.completed && t.labels.includes(v.id)); }
  else { const f = allFilters().find(x => x.id === v.id); if (!f) return ''; list = active().filter(t => evalQuery(f.query, t)); done = []; }
  const od = list.filter(t => t.due && t.due < td).length, tdn = list.filter(t => t.due === td).length;
  const wk = list.filter(t => t.due && t.due > td && t.due <= addDays(td, 7)).length, nod = list.filter(t => !t.due).length;
  const dw = done.filter(t => (t.completedAt || 0) > Date.now() - 7 * 864e5).length;
  const pct = list.length + done.length ? Math.round(done.length / (list.length + done.length) * 100) : 0;
  const fzs = [...list, ...done].reduce((a, t) => a + (ui.fzTotals?.[t.id] || 0), 0);
  return `<div class="insight">
    <div class="ins-chips">
      <span class="ins"><b>${list.length}</b> ${plural(list.length, 'otwarte', 'otwarte', 'otwartych')}</span>
      ${od ? `<span class="ins red"><b>${od}</b> po terminie</span>` : ''}
      ${tdn ? `<span class="ins green"><b>${tdn}</b> na dziś</span>` : ''}
      ${wk ? `<span class="ins purple"><b>${wk}</b> w 7 dni</span>` : ''}
      ${nod ? `<span class="ins"><b>${nod}</b> bez terminu</span>` : ''}
      ${dw ? `<span class="ins green">${sz(I.done, 13)} <b>${dw}</b> w tym tyg.</span>` : ''}
      ${fzs ? `<span class="ins blue">${sz(I.timer, 13)} <b>${fmtDur(fzs)}</b></span>` : ''}
    </div>
    ${v.type !== 'filter' ? `<div class="ins-prog" title="${pct}% ukończone"><i style="--w:${pct}%"></i></div><span class="ins-pct">${pct}%</span>` : ''}
  </div>`;
}
function completedStats() {
  const done = state.tasks.filter(t => t.completed && t.completedAt), now = Date.now(), td = todayStr();
  const cnt = ms => done.filter(t => t.completedAt > now - ms).length;
  const today = done.filter(t => fmtDate(new Date(t.completedAt)) === td).length;
  const days = [...Array(14)].map((_, i) => addDays(td, i - 13));
  const per = days.map(d => state.history.filter(h => fmtDate(new Date(h.at)) === d).length);
  const max = Math.max(1, ...per);
  return `<div class="cs">
    <div class="cs-cards"><div><b>${today}</b><span>dziś</span></div><div><b>${cnt(7 * 864e5)}</b><span>7 dni</span></div><div><b>${cnt(30 * 864e5)}</b><span>30 dni</span></div><div><b>${state.history.length}</b><span>łącznie</span></div></div>
    <div class="cs-bars" title="Ukończone w ostatnich 14 dniach">${per.map((c, i) => `<i class="${days[i] === td ? 'today' : ''}" style="--h:${Math.max(6, c / max * 100).toFixed(0)}%;--d:${i}" title="${shortDate(days[i])}: ${c}"></i>`).join('')}</div>
  </div>`;
}
function searchHelp() {
  let recent = [];
  try { recent = JSON.parse(localStorage.getItem('listo-recent-q') || '[]'); } catch (e) { /* */ }
  const quick = [['today', 'Na dziś', 'green'], ['overdue', 'Po terminie', 'red'], ['p1', 'Priorytet 1', 'red'], ['7 days', 'Najbliższe 7 dni', 'purple'], ['no date', 'Bez terminu', ''], ['p1 & today', 'P1 na dziś', 'red']];
  return `<div class="sh">
    <div class="sh-sec"><h3>Szybkie wyszukiwania</h3><div class="sh-chips">${quick.map(([q, l, c]) => `<button class="sh-chip ${c}" data-act="search-q" data-q="${esc(q)}">${l}<code>${esc(q)}</code></button>`).join('')}</div></div>
    ${recent.length ? `<div class="sh-sec"><h3>Ostatnio szukane</h3><div class="sh-chips">${recent.map(q => `<button class="sh-chip" data-act="search-q" data-q="${esc(q)}">${sz(I.history, 14)} ${esc(q)}</button>`).join('')}</div></div>` : ''}
    <div class="sh-sec"><h3>Projekty i etykiety</h3><div class="sh-chips">${[proj('inbox'), ...userProjects()].map(p => `<button class="sh-chip" data-act="nav" data-view="${p.isInbox ? 'inbox' : 'project'}" ${p.isInbox ? '' : `data-id="${p.id}"`}><span style="color:${p.color && p.color !== '#808080' ? p.color : 'var(--muted)'}">#</span> ${esc(projName(p))}</button>`).join('')}${state.labels.map(l => `<button class="sh-chip" data-act="nav" data-view="label" data-id="${l.id}"><span style="color:${l.color}">@</span>${esc(l.name)}</button>`).join('')}</div></div>
    <div class="sh-tip">${sz(I.bolt, 15)}<span>Łącz zapytania: <code>&amp;</code> (i), <code>|</code> (lub), <code>!</code> (nie), np. <code>p1 &amp; !today</code>, <code>#Studia &amp; 7 days</code>.</span></div>
  </div>`;
}
function reportsExtra() {
  const td = todayStr(), act = active();
  // mapa aktywności – 12 tygodni
  const byDay = {}; state.history.forEach(h => { const d = fmtDate(new Date(h.at)); byDay[d] = (byDay[d] || 0) + 1; });
  const start = addDays(weekStart(td), -77);
  let cells = '';
  for (let d = start; d <= td; d = addDays(d, 1)) { const c = byDay[d] || 0; cells += `<i class="l${c === 0 ? 0 : c < 2 ? 1 : c < 4 ? 2 : c < 6 ? 3 : 4}" title="${shortDate(d)}: ${c}"></i>`; }
  // priorytety
  const pr = [1, 2, 3, 4].map(p => act.filter(t => t.priority === p).length), prT = Math.max(1, act.length);
  // wg projektu (30 dni)
  const pc = {}; state.history.filter(h => h.at > Date.now() - 30 * 864e5).forEach(h => { pc[h.projectId || 'inbox'] = (pc[h.projectId || 'inbox'] || 0) + 1; });
  const pk = Object.keys(pc).sort((a, b) => pc[b] - pc[a]).slice(0, 6), pmax = Math.max(1, ...pk.map(k => pc[k]));
  // godziny
  const hrs = Array(24).fill(0); state.history.forEach(h => { hrs[new Date(h.at).getHours()]++; });
  const hmax = Math.max(1, ...hrs), best = hrs.indexOf(Math.max(...hrs));
  return `<div class="rx-grid">
    <section class="rep-box rx"><h3>Mapa aktywności · 12 tygodni</h3><div class="rx-heat">${cells}</div>
      <div class="rx-leg"><span>mniej</span><i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i><span>więcej</span></div></section>
    <section class="rep-box rx"><h3>Aktywne zadania wg priorytetu</h3><div class="rx-stack">${pr.map((n, i) => n ? `<i style="--w:${n / prT * 100}%;--c:var(--p${i + 1})" title="P${i + 1}: ${n}"></i>` : '').join('')}</div>
      <div class="rx-pl">${pr.map((n, i) => `<span><i style="--c:var(--p${i + 1})"></i>P${i + 1} <b>${n}</b></span>`).join('')}</div></section>
    <section class="rep-box rx"><h3>Ukończone wg projektu · 30 dni</h3>${pk.length ? pk.map(k => { const p = proj(k); const col = p?.color && p.color !== '#808080' ? p.color : 'var(--accent)'; return `<div class="rx-row"><span class="grow">${esc(projName(p))}</span><span class="rx-bar"><i style="--w:${pc[k] / pmax * 100}%;--c:${col}"></i></span><b>${pc[k]}</b></div>`; }).join('') : '<div class="muted small">Brak ukończonych zadań w ostatnich 30 dniach.</div>'}</section>
    <section class="rep-box rx"><h3>Kiedy kończysz zadania</h3><div class="rx-hours">${hrs.map((c, h) => `<i class="${h === best && c ? 'best' : ''}" style="--h:${Math.max(4, c / hmax * 100).toFixed(0)}%" title="${h}:00 – ${c}"></i>`).join('')}</div>
      <div class="rx-hl"><span>0</span><span>6</span><span>12</span><span>18</span><span>23</span></div>${hrs[best] ? `<div class="muted small" style="margin-top:6px">Najczęściej o <b>${best}:00</b></div>` : ''}</section>
  </div>`;
}

// ---------- Start (widok główny) – układ bez pustych miejsc ----------
function renderHome() {
  const td = todayStr(), act = active(), now = new Date(), hr = now.getHours();
  const name = state.settings.userName || '', hidden = state.settings.hiddenCards || [];
  const greet = hr < 5 ? 'Dobrej nocy' : hr < 12 ? 'Dzień dobry' : hr < 18 ? 'Miłego popołudnia' : 'Dobry wieczór';
  const tod = hr < 5 ? 'night' : hr < 12 ? 'morning' : hr < 18 ? 'day' : 'evening';
  ui.bar = { title: 'Start', icon: '', crumb: '', right: '' };
  const overdue = act.filter(t => t.due && t.due < td).sort(byDue), today = act.filter(t => t.due === td).sort(byDue);
  const week = act.filter(t => t.due && t.due > td && t.due <= addDays(td, 7));
  const doneToday = state.history.filter(h => fmtDate(new Date(h.at)) === td).length, goal = state.settings.dailyGoal || 5;
  const fzToday = state.focus.sessions.filter(s => fmtDate(new Date(sessStart(s))) === td).reduce((a, s) => a + sessSec(s), 0) + (fz.sess ? fzActiveMs() / 1000 : 0);
  const nearest = act.filter(t => t.due && t.due > td).sort(byDue)[0];
  const parts = [today.length ? `Na dziś masz <b>${today.length}</b> ${plural(today.length, 'zadanie', 'zadania', 'zadań')}` : 'Na dziś nie masz już nic zaplanowanego'];
  if (overdue.length) parts.push(`<b class="hm-red">${overdue.length}</b> ${plural(overdue.length, 'czeka', 'czekają', 'czeka')} po terminie`);
  const summary = parts.join(', ') + '.' + (nearest ? ` Najbliższy termin: <b>${esc(nearest.title)}</b> – ${dueInfo(nearest.due, nearest.time).label.toLowerCase()}.` : '');
  const dateStr = `${cap(PL_DAYS[now.getDay()])}, ${now.getDate()} ${['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'][now.getMonth()]}`;
  const dayPct = Math.min(100, Math.round(doneToday / Math.max(1, doneToday + today.length + overdue.length) * 100));
  const CR = 2 * Math.PI * 38;
  let ci = 0;
  const cards = {};
  const card = (key, cls, title, body, extra = '') => { if (!hidden.includes(key)) cards[key] = (i, edit) => `<section class="hm-card ${cls}" data-card="${key}" style="--i:${i}" ${edit ? 'draggable="true"' : ''}><div class="hm-card-h">${edit ? `<span class="hm-grip" title="Przeciągnij">${I.grip}</span>` : ''}<h2>${title}</h2>${edit ? `<span class="hm-mv"><button class="icon-btn" data-act="card-mv" data-k="${key}" data-d="-1" title="Wyżej">${I.up}</button><button class="icon-btn" data-act="card-mv" data-k="${key}" data-d="1" title="Niżej">${I.down}</button></span>` : extra}</div>${body}</section>`; return ''; };
  let html = `<div class="home ${tod} ${ui.homeEdit ? 'editing' : ''}">
  <section class="hm-hero">
    <div class="hm-hero-grid">
      <div class="hm-greet"><h1>${greet}${name ? `, <span>${esc(name)}</span>` : ''}</h1>
        <p class="hm-date">${dateStr} · <span id="home-clock">${nowHM()}</span></p>
        <p class="hm-sum">${summary}</p>
        <div class="hm-chips">
          <button class="hm-chip red" data-act="nav" data-view="today"><b class="cnt-up" data-to="${overdue.length}">${overdue.length}</b><span>po terminie</span></button>
          <button class="hm-chip green" data-act="nav" data-view="today"><b class="cnt-up" data-to="${today.length}">${today.length}</b><span>na dziś</span></button>
          <button class="hm-chip purple" data-act="nav" data-view="upcoming"><b class="cnt-up" data-to="${week.length}">${week.length}</b><span>w 7 dni</span></button>
          <button class="hm-chip blue" data-act="nav" data-view="focus"><b>${fmtDur(fzToday)}</b><span>skupienia dziś</span></button>
          ${state.habits.length ? `<button class="hm-chip lime" data-act="nav" data-view="habits"><b>${state.habits.length - habitsLeftToday()}/${state.habits.length}</b><span>nawyków</span></button>` : ''}
        </div></div>
      <button class="hm-day-ring" data-act="productivity" title="Postęp dnia – kliknij, by zobaczyć statystyki">
        <svg viewBox="0 0 92 92" aria-hidden="true"><circle cx="46" cy="46" r="38" fill="none" stroke="var(--line-2)" stroke-width="8"/>
          <circle class="hm-ring" cx="46" cy="46" r="38" fill="none" stroke="url(#hmg)" stroke-width="8" stroke-linecap="round" stroke-dasharray="${(CR * dayPct / 100).toFixed(1)} ${CR.toFixed(1)}" transform="rotate(-90 46 46)"/>
          <defs><linearGradient id="hmg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--due-today)"/><stop offset="1" stop-color="var(--accent)"/></linearGradient></defs></svg>
        <span class="hm-dr-v"><b>${dayPct}%</b><span>dnia za Tobą</span></span>
        <span class="hm-dr-l">${doneToday} / ${goal} celu</span></button>
    </div>
    <div class="hm-qa-row"><label class="hm-qa">${I.plus}<input class="home-add" placeholder="Dodaj zadanie na dziś…  np. „Raport jutro 15:00 p1 #Studia”" autocomplete="off" spellcheck="false" aria-label="Dodaj zadanie"><kbd>Enter</kbd></label>
      <button class="hm-mic" data-act="voice" title="Podyktuj zadanie (V)" aria-label="Podyktuj zadanie">${sz(I.mic, 20)}</button></div>
    <div class="hm-qa-prev"></div>
  </section>`;
  // Na teraz – pełna szerokość, dwie kolumny
  const skip = ui.homeSkip || new Set();
  const queue = act.filter(t => !t.parentId && !skip.has(t.id)).map(t => ({ t, s: homeScore(t, td) })).sort((a, b) => b.s - a.s).map(x => x.t);
  const nx = queue[0];
  if (!hidden.includes('next')) {
    if (nx) {
      const di = dueInfo(nx.due, nx.time), p = proj(nx.projectId), tot = ui.fzTotals?.[nx.id];
      html += `<section class="hm-card hm-next" style="--i:${ci++}"><div class="hm-next-l">
        <div class="hm-card-h"><h2>${sz(I.bolt, 16)} Na teraz</h2>${skip.size ? `<button class="btn ghost sm" data-act="home-reset-skip">Od początku</button>` : ''}</div>
        <div class="hm-next-main ${ui.homeAnim ? 'swap' : ''}">
          <div class="task hm-hero-task" data-id="${nx.id}"><button class="check p${nx.priority}" data-act="toggle" data-id="${nx.id}" aria-label="Ukończ">${I.check}</button>
            <div class="grow" data-act="open" data-id="${nx.id}"><div class="hm-next-t">${fmtText(nx.title)}</div>
              <div class="hm-next-m">${flagIcon(nx.priority, 13)} P${nx.priority}${di ? ` · <span class="due-txt ${di.cls}">${di.label}</span>` : ''} · ${esc(projName(p))}${sectionOf(nx) ? ' / ' + esc(sectionOf(nx).name) : ''}${tot ? ` · ${sz(I.timer, 12)} ${fmtDur(tot)}` : ''}</div>
              ${nx.description ? `<div class="hm-next-d">${esc(nx.description.split('\n')[0])}</div>` : ''}</div></div>
          <div class="hm-next-btns">
            <button class="btn primary" data-act="toggle" data-id="${nx.id}">${sz(I.check, 15)} Zrobione</button>
            <button class="btn" data-act="home-focus" data-id="${nx.id}">${sz(I.play, 14)} Skup się</button>
            ${nx.due === addDays(td, 1) ? '' : `<button class="btn" data-act="home-tomorrow" data-id="${nx.id}">${sz(I.sun, 15)} Jutro</button>`}
            <button class="btn ghost" data-act="home-skip" data-id="${nx.id}" title="Pokaż następne zadanie">Pomiń ${sz(I.right, 14)}</button>
          </div></div></div>
        <div class="hm-next-r"><span class="hm-sub">W kolejce</span>${queue.slice(1, 6).map((t, i) => { const d2 = dueInfo(t.due, t.time); return `<button class="hm-q" data-act="open" data-id="${t.id}" style="--d:${i}"><span class="check p${t.priority}" style="pointer-events:none"></span><span class="grow">${esc(t.title)}</span>${d2 ? `<span class="due-txt ${d2.cls}">${d2.label}</span>` : ''}</button>`; }).join('') || '<div class="muted small" style="padding:8px 4px">Nic więcej w kolejce.</div>'}</div>
      </section>`;
    } else html += `<section class="hm-card hm-next" style="--i:${ci++}"><div class="hm-empty">${I.party}<b>Wszystko zrobione!</b><span>Nie masz żadnych aktywnych zadań.</span></div></section>`;
  }
  ui.homeAnim = false;
  html += '<div class="hm-masonry">';
  // Dziś
  const list = [...overdue, ...today];
  html += card('today', 'hm-today', `${sz(todayIcon(), 16)} Dziś <span class="hm-cnt">${list.length}</span>`, `
    ${overdue.length ? `<button class="hm-od" data-act="reschedule-overdue">${sz(I.calBig, 15)} ${overdue.length} po terminie – przełóż na dziś</button>` : ''}
    <div class="hm-list">${list.slice(0, 7).map(t => { const di = dueInfo(t.due, t.time), p = proj(t.projectId); return `<div class="task-wrap"><div class="task hm-row" data-id="${t.id}">
      <button class="check p${t.priority}" data-act="toggle" data-id="${t.id}" aria-label="Ukończ">${I.check}</button>
      <div class="grow hm-row-main" data-act="open" data-id="${t.id}"><span class="hm-row-t">${fmtText(t.title)}</span><span class="hm-row-m">${di && (di.cls === 'overdue' || t.time) ? `<span class="due-txt ${di.cls}">${di.label}</span> · ` : ''}${esc(projName(p))}</span></div>
      <button class="icon-btn hm-row-f" data-act="home-focus" data-id="${t.id}" title="Skup się na tym zadaniu">${sz(I.play, 14)}</button></div></div>`; }).join('') || `<div class="hm-empty sm">${sz(I.done, 22)}<span>Dzień czysty – brawo!</span></div>`}
      ${list.length > 7 ? `<button class="hm-more" data-act="nav" data-view="today">Pokaż wszystkie (${list.length}) ${sz(I.right, 14)}</button>` : ''}</div>`,
    `<button class="icon-btn" data-act="nav" data-view="today" title="Otwórz Dziś">${I.right}</button>`);
  // Nawyki
  html += card('habits', 'hm-habits', `${sz(I.habit, 16)} Nawyki dziś`, state.habits.length ? `<div class="hm-hb">${state.habits.map(h => { const on = !!h.days[td]; return `<button class="hm-hb-i ${on ? 'on' : ''}" data-act="hb-day" data-id="${h.id}" data-date="${td}" style="--hc:${h.color}"><span class="hm-hb-e">${esc(h.emoji || '✓')}</span><span class="grow">${esc(h.name)}</span><span class="hm-hb-s">🔥 ${hbStreak(h)}</span><span class="hm-hb-c">${I.check}</span></button>`; }).join('')}</div>`
    : `<div class="hm-empty sm">${sz(I.habit, 22)}<span>Zacznij budować nawyki – codziennie po jednym kliknięciu.</span><button class="btn sm" data-act="nav" data-view="habits">Dodaj nawyk</button></div>`,
    `<button class="icon-btn" data-act="nav" data-view="habits" title="Nawyki">${I.right}</button>`);
  // 7 dni
  const days7 = [...Array(7)].map((_, i) => addDays(td, i)), cnt = days7.map(d => act.filter(t => t.due === d)), maxC = Math.max(1, ...cnt.map(a => a.length));
  html += card('week', 'hm-week', `${sz(I.upcoming, 16)} Najbliższe 7 dni`, `
    <div class="hm-days">${days7.map((d, i) => `<button class="hm-day ${i === 0 ? 'today' : ''} ${dow(d) === 0 || dow(d) === 6 ? 'we' : ''}" data-act="home-day" data-date="${d}" title="${shortDate(d)}: ${cnt[i].length}" style="--d:${i}">
      <span class="hm-day-n">${cnt[i].length || ''}</span><span class="hm-day-bar"><i style="--h:${(cnt[i].length / maxC * 100).toFixed(0)}%">${cnt[i].slice(0, 4).map(t => `<em style="--c:var(--p${t.priority})"></em>`).join('')}</i></span>
      <span class="hm-day-l">${i === 0 ? 'Dziś' : PL_DAYS_SHORT[dow(d)]}</span><span class="hm-day-d">${parseDate(d).getDate()}</span></button>`).join('')}</div>
    <div class="hm-sub">Najbliższe terminy</div>
    ${act.filter(t => t.due && t.due > td).sort(byDue).slice(0, 4).map(t => { const n = diffDays(t.due, td), di = dueInfo(t.due, t.time); return `<button class="hm-dl" data-act="open" data-id="${t.id}"><span class="hm-dl-n ${di.cls}">${n === 1 ? 'jutro' : 'za ' + n + ' dni'}</span><span class="grow">${esc(t.title)}</span><span class="muted small">${shortDate(t.due)}</span></button>`; }).join('') || '<div class="muted small" style="padding:6px 2px">Brak zaplanowanych terminów.</div>'}`,
    `<button class="icon-btn" data-act="nav" data-view="upcoming" title="Nadchodzące">${I.right}</button>`);
  // Skupienie
  const ft = fz.sess?.taskId && task(fz.sess.taskId);
  const wk = state.focus.sessions.filter(s => s.at > Date.now() - 7 * 864e5).reduce((a, s) => a + sessSec(s), 0);
  html += card('focus', 'hm-focus ' + (fz.running ? 'live' : ''), `${sz(I.timer, 16)} Skupienie`, fz.sess || fz.running ? `
    <div class="hm-fz-live"><span class="hm-pulse"></span><b class="fz-tick">${fmtMS(fzShown())}</b><span class="muted small">${FOCUS_MODES[fz.mode][0]}${ft ? ' · ' + esc(ft.title) : ''}</span></div>
    <div class="hm-fz-btns"><button class="btn primary" data-act="fz-toggle">${fz.running ? 'Pauza' : 'Wznów'}</button><button class="btn" data-act="nav" data-view="focus">Otwórz</button></div>` : `
    <div class="hm-fz-stats"><div><b>${fmtDur(fzToday)}</b><span>dziś</span></div><div><b>${fmtDur(wk)}</b><span>w 7 dni</span></div></div>
    ${nx ? `<button class="btn primary hm-fz-go" data-act="home-focus" data-id="${nx.id}">${sz(I.play, 14)} Skup się: ${esc(nx.title.length > 26 ? nx.title.slice(0, 25) + '…' : nx.title)}</button>` : ''}`,
    `<button class="icon-btn" data-act="nav" data-view="focus" title="Skupienie">${I.right}</button>`);
  // Rytm
  const byDay = {}; state.history.forEach(h => { const d = fmtDate(new Date(h.at)); byDay[d] = (byDay[d] || 0) + 1; });
  let streak = 0; for (let d = (byDay[td] || 0) >= goal ? td : addDays(td, -1); (byDay[d] || 0) >= goal; d = addDays(d, -1)) streak++;
  const last7 = [...Array(7)].map((_, i) => byDay[addDays(td, i - 6)] || 0), max7 = Math.max(goal, ...last7, 1), sum7 = last7.reduce((a, b) => a + b, 0);
  html += card('stats', 'hm-stats', `${sz(I.pulse, 16)} Twój rytm`, `
    <div class="hm-st"><div><b class="cnt-up" data-to="${doneToday}">${doneToday}</b><span>dziś / ${goal}</span></div><div><b>🔥 ${streak}</b><span>${plural(streak, 'dzień', 'dni', 'dni')} serii</span></div><div><b class="cnt-up" data-to="${sum7}">${sum7}</b><span>w 7 dni</span></div></div>
    <div class="hm-spark">${last7.map((c, i) => `<i class="${c >= goal ? 'hit' : ''}" style="--h:${Math.max(4, c / max7 * 100).toFixed(0)}%;--d:${i}" title="${c}"></i>`).join('')}</div>`,
    `<button class="icon-btn" data-act="nav" data-view="reports" title="Raportowanie">${I.right}</button>`);
  // Projekty
  html += card('proj', 'hm-proj', `<span class="hash">#</span> Projekty`, [proj('inbox'), ...userProjects()].map(p => {
    const open = act.filter(t => t.projectId === p.id).length, done = state.tasks.filter(t => t.projectId === p.id && t.completed).length;
    const od = act.filter(t => t.projectId === p.id && t.due && t.due < td).length, pc = open + done ? Math.round(done / (open + done) * 100) : 0;
    const col = p.color && p.color !== '#808080' ? p.color : 'var(--muted)';
    return `<button class="hm-p" data-act="nav" data-view="${p.isInbox ? 'inbox' : 'project'}" ${p.isInbox ? '' : `data-id="${p.id}"`}>
      <span class="hm-p-h"><span class="hash" style="color:${col}">#</span><span class="grow">${esc(projName(p))}</span>${od ? `<span class="hm-p-od">${od} po terminie</span>` : ''}<span class="muted small">${open} otw.</span></span>
      <span class="hm-p-bar"><i style="--w:${pc}%;--c:${col}"></i></span><span class="hm-p-pc muted small">${pc}% ukończone</span></button>`;
  }).join(''));
  // Matryca + auto-priorytety
  const days = state.settings.mxDays ?? 2, mq = { q1: 0, q2: 0, q3: 0, q4: 0 };
  act.forEach(t => mq[mxQuad(t, td, days)]++);
  html += card('mx', 'hm-mx-c', `${sz(I.matrix, 16)} Matryca`, `<div class="hm-mx">${Object.entries(MXQ).map(([q, [n]]) => `<button class="hm-mxq ${q}" data-act="nav" data-view="matrix"><b>${mq[q]}</b><span>${n}</span></button>`).join('')}</div>
    <button class="hm-ap ${state.autoPrio.enabled ? 'on' : ''}" data-act="nav" data-view="autoprio">${sz(I.bolt, 15)}<span class="grow">Auto-priorytety</span><span class="hm-ap-s">${state.autoPrio.enabled ? 'włączone' : 'wyłączone'}</span></button>`);
  // Ostatnio ukończone
  const recent = state.tasks.filter(t => t.completed && t.completedAt).sort((a, b) => b.completedAt - a.completedAt).slice(0, 4);
  html += card('done', 'hm-done', `${sz(I.done, 16)} Ostatnio ukończone`, recent.map(t => `<div class="task-wrap"><div class="task hm-row done-row" data-id="${t.id}">
      <span class="check checked p${t.priority}" style="pointer-events:none">${I.check}</span>
      <div class="grow hm-row-main" data-act="open" data-id="${t.id}"><span class="hm-row-t">${esc(t.title)}</span><span class="hm-row-m">${fmtDateTime(t.completedAt)}${ui.fzTotals?.[t.id] ? ` · ${sz(I.timer, 11)} ${fmtDur(ui.fzTotals[t.id])}` : ''}</span></div>
      <button class="btn ghost sm" data-act="toggle" data-id="${t.id}" title="Przywróć zadanie">Przywróć</button></div></div>`).join('') || '<div class="muted small">Jeszcze nic nie ukończono.</div>',
    `<button class="icon-btn" data-act="nav" data-view="completed" title="Ukończone">${I.right}</button>`);
  if (state.settings.karma) card('karma', 'hm-karma', `${sz(I.star, 16)} Karma`, karmaCardBody(), `<button class="icon-btn" data-act="pref-open" data-t="productivity" title="Szczegóły">${I.right}</button>`);
  const evToday = gcalEventsOn(td);
  if (evToday.length) card('events', 'hm-events', `${sz(I.calMonth, 16)} Wydarzenia dziś`, evToday.map(e => `<div class="hm-ev" style="--c:${e.color || 'var(--qi-b)'}"><span class="hm-ev-t">${e.time || 'cały dzień'}</span><span class="grow">${esc(e.title)}</span></div>`).join(''), `<button class="icon-btn" data-act="nav" data-view="calendar" title="Kalendarz">${I.right}</button>`);
  const edit = !!ui.homeEdit;
  html += cardOrder(Object.keys(cards)).map((k, i) => cards[k](ci + i, edit)).join('');
  html += `</div>
    <div class="hm-foot">${state.settings.tileEdit ? `<button data-act="home-edit" class="${edit ? 'on' : ''}">${sz(I.grip, 14)} ${edit ? 'Gotowe – zapisz układ' : 'Ułóż kafelki'}</button>` : ''}<button data-act="nav" data-view="prefs">${sz(I.gear, 14)} Dostosuj kafelki Startu</button><button data-act="nav" data-view="guide">${sz(I.book, 14)} Poradnik i skróty</button><button data-act="voice">${sz(I.mic, 14)} Dodaj głosem (V)</button></div></div>`;
  if (ui.stagger) setTimeout(countUp, 0);
  return html;
}

// ---------- Nawyki ----------
const HB_COLORS = ['#3ec26a', '#4f8ff7', '#f5a531', '#9466f0', '#ff6f61', '#14aaf5', '#e05194', '#7ecc49'];
const HB_SUG = ['💧 Pić 2 litry wody', '📚 Czytać 20 minut', '🏃 Ruch 30 minut', '📝 Powtórka materiału', '🧘 5 minut medytacji', '😴 Sen przed 24:00'];
function habitsLeftToday() { const td = todayStr(); return (state.habits || []).filter(h => !h.days[td]).length; }
function hbStreak(h) { let n = 0, d = todayStr(); if (!h.days[d]) d = addDays(d, -1); while (h.days[d]) { n++; d = addDays(d, -1); } return n; }
function hbBest(h) { const ks = Object.keys(h.days).sort(); let best = 0, run = 0, prev = null; ks.forEach(k => { run = prev && addDays(prev, 1) === k ? run + 1 : 1; best = Math.max(best, run); prev = k; }); return best; }
function hbRate(h, n = 30) { const td = todayStr(); let c = 0; for (let i = 0; i < n; i++) if (h.days[addDays(td, -i)]) c++; return Math.round(c / n * 100); }
function hbAdd(text) {
  text = (text || '').trim();
  if (!text) return;
  const m = text.match(/^(\p{Extended_Pictographic}(?:️)?)\s*(.*)$/u);
  const h = { id: uid(), name: (m ? m[2] : text).trim() || text, emoji: m ? m[1] : '✨', color: HB_COLORS[state.habits.length % HB_COLORS.length], days: {}, created: Date.now() };
  state.habits.push(h); ui.hbFlash = h.id; commit();
  toast(`Dodano nawyk: ${h.emoji} ${h.name}`);
}
function hbToggle(id, d) {
  const h = state.habits.find(x => x.id === id);
  if (!h) return;
  if (h.days[d]) delete h.days[d]; else { h.days[d] = 1; playSound('done'); }
  ui.hbPop = id + d;
  commit();
  if (h.days[d] && d === todayStr() && !habitsLeftToday()) { celebrate(); toast('🎉 Wszystkie nawyki na dziś odhaczone!'); }
}
function renderHabits() {
  const td = todayStr(), hs = state.habits;
  let html = header('Nawyki', { icon: sz(I.habit, 24), iconCls: 'tile', sub: 'Buduj codzienne nawyki – odhaczaj je każdego dnia i pilnuj serii 🔥' });
  const doneT = hs.filter(h => h.days[td]).length, bestNow = hs.reduce((m, h) => Math.max(m, hbStreak(h)), 0), avg = hs.length ? Math.round(hs.reduce((a, h) => a + hbRate(h), 0) / hs.length) : 0;
  html += `<div class="hb-sum">
    <div class="hb-sum-ring"><svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="19" fill="none" stroke="var(--line-2)" stroke-width="5"/><circle class="hm-ring" cx="24" cy="24" r="19" fill="none" stroke="var(--vh)" stroke-width="5" stroke-linecap="round" stroke-dasharray="${(2 * Math.PI * 19 * (hs.length ? doneT / hs.length : 0)).toFixed(1)} 200" transform="rotate(-90 24 24)"/></svg><div><b>${doneT}/${hs.length}</b><span>dziś</span></div></div>
    <div><b>🔥 ${bestNow}</b><span>najdłuższa obecna seria</span></div><div><b>${avg}%</b><span>skuteczność · 30 dni</span></div><div><b>${hs.reduce((a, h) => a + Object.keys(h.days).length, 0)}</b><span>wszystkich odhaczeń</span></div>
  </div>
  <div class="hb-add"><span class="hb-add-ic">${I.plus}</span><input class="hb-in" placeholder="Nowy nawyk – możesz zacząć od emoji, np. „📚 Czytać 20 minut”" maxlength="80" aria-label="Nowy nawyk"><button class="btn primary" data-act="hb-add">Dodaj</button></div>
  ${hs.length < 3 ? `<div class="hb-sug">${HB_SUG.map(s => `<button class="sh-chip" data-act="hb-sug" data-t="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : ''}`;
  if (!hs.length) return html + emptyState('Brak nawyków', 'Dodaj pierwszy nawyk powyżej albo kliknij jedną z propozycji.');
  const days7 = [...Array(7)].map((_, i) => addDays(td, i - 6));
  html += `<div class="hb-list">${hs.map((h, i) => {
    const st = hbStreak(h), start = addDays(weekStart(td), -77);
    let heat = ''; for (let d = start; d <= td; d = addDays(d, 1)) heat += `<i class="${h.days[d] ? 'on' : ''}" title="${shortDate(d)}"></i>`;
    return `<section class="hb-card ${ui.hbFlash === h.id ? 'flash' : ''}" style="--hc:${h.color};--i:${i}">
      <div class="hb-top"><span class="hb-emoji">${esc(h.emoji)}</span>
        <div class="grow"><b>${esc(h.name)}</b><span class="hb-meta"><span class="hb-streak ${st ? 'hot' : ''}">🔥 ${st} ${plural(st, 'dzień', 'dni', 'dni')}</span> · najlepsza ${hbBest(h)} · 30 dni: ${hbRate(h)}%</span></div>
        <button class="hb-today ${h.days[td] ? 'on' : ''} ${ui.hbPop === h.id + td ? 'pop' : ''}" data-act="hb-day" data-id="${h.id}" data-date="${td}">${I.check}<span>${h.days[td] ? 'Zrobione' : 'Dziś'}</span></button>
        <button class="icon-btn" data-act="hb-menu" data-id="${h.id}" title="Więcej">${I.dots}</button></div>
      <div class="hb-week">${days7.map(d => `<button class="hb-d ${h.days[d] ? 'on' : ''} ${d === td ? 'td' : ''} ${ui.hbPop === h.id + d ? 'pop' : ''}" data-act="hb-day" data-id="${h.id}" data-date="${d}" title="${shortDate(d)}"><span>${PL_DAYS_SHORT[dow(d)]}</span><i>${I.check}</i></button>`).join('')}</div>
      <div class="hb-heat" title="Ostatnie 12 tygodni">${heat}</div>
    </section>`;
  }).join('')}</div>`;
  ui.hbFlash = null; ui.hbPop = null;
  return html;
}
function hbMenu(anchor, h) {
  if (!h) return;
  menu(anchor, [
    { icon: I.edit, label: 'Zmień nazwę', fn: () => openDialog({ title: 'Zmień nazwę nawyku', submit: 'Zapisz', fields: [{ key: 'name', label: 'Nazwa', value: h.name, required: true }, { key: 'emoji', label: 'Emoji', value: h.emoji }], onSubmit: v => { h.name = v.name; h.emoji = v.emoji || h.emoji; commit(); } }) },
    { icon: `<span class="tp-mini" style="--c:${h.color}"></span>`, label: 'Zmień kolor', fn: () => { h.color = HB_COLORS[(HB_COLORS.indexOf(h.color) + 1) % HB_COLORS.length]; commit(); } },
    '-',
    { icon: I.trash, label: 'Usuń nawyk', fn: () => confirmDlg('Usunąć nawyk?', `„${esc(h.name)}” i cała jego historia zostaną usunięte.`, 'Usuń', () => { const snap = snapshot(); state.habits = state.habits.filter(x => x.id !== h.id); commit(); toast('Usunięto nawyk', snap); }) },
  ]);
}

// ---------- Ustawienia ----------
function renderPrefs() {
  const s = state.settings, hn = s.hiddenNav || [], hc = s.hiddenCards || [];
  let html = header('Ustawienia', { icon: sz(I.gear, 24), iconCls: 'tile', sub: 'Dostosuj Listo do siebie. Domyślne wartości to obecny wygląd aplikacji – w każdej chwili możesz do nich wrócić.' });
  const sec = (i, icon, title, body) => `<section class="pf-card" style="--i:${i}"><h3>${icon}${title}</h3>${body}</section>`;
  const navOpts = [['home', 'Start', I.home], ['upcoming', 'Nadchodzące', I.upcoming], ['calendar', 'Kalendarz', I.calMonth], ['matrix', 'Matryca', I.matrix], ['filters', 'Filtry i etykiety', I.filters], ['reports', 'Raportowanie', I.pulse], ['focus', 'Skupienie', I.timer], ['autoprio', 'Auto-priorytety', I.bolt], ['habits', 'Nawyki', I.habit], ['completed', 'Ukończone', I.done]];
  const cardOpts = [['next', 'Na teraz'], ['today', 'Dziś'], ['habits', 'Nawyki dziś'], ['week', 'Najbliższe 7 dni'], ['focus', 'Skupienie'], ['stats', 'Twój rytm'], ['proj', 'Projekty'], ['mx', 'Matryca'], ['done', 'Ostatnio ukończone']];
  const voiceOk = !!(dictNS || SpeechRec);
  html += `<div class="pf-grid">
  ${sec(0, sz(I.moon, 17), 'Wygląd', `
    ${prefRow('Tryb', 'Ciemny, jasny albo zgodny z systemem', segBtns('theme', s.theme, [['dark', 'Ciemny'], ['light', 'Jasny'], ['auto', 'System']]))}
    ${prefRow('Kolor akcentu', ACCENTS.find(a => a.id === (s.accent || 'todoist'))?.name, `<div class="pf-sw">${ACCENTS.map(a => `<button class="${(s.accent || 'todoist') === a.id ? 'on' : ''}" data-act="pref" data-k="accent" data-v="${a.id}" style="--c:${a.color}" title="${a.name}"></button>`).join('')}</div>`)}
    ${prefRow('Skala interfejsu', 'Powiększ lub pomniejsz całą aplikację', segBtns('scale', s.scale, [[90, '90%'], [100, '100%'], [110, '110%'], [120, '120%']]))}
    ${prefRow('Gęstość listy', 'Odstępy między zadaniami', segBtns('density', s.density, [['compact', 'Zwarta'], ['normal', 'Normalna'], ['roomy', 'Przestronna']]))}
    ${prefRow('Kolorowe ikony menu', 'Każda zakładka ma własny kolor', swBtn(s.navColors !== false, 'navColors'))}
    ${prefRow('Efekty po najechaniu', 'Podświetlenia i poświata pod kursorem', swBtn(s.hoverFx !== false, 'hoverFx'))}
    ${prefRow('Animacje', 'Przejścia, wjazdy list, konfetti', segBtns('anim', s.anim, [['full', 'Pełne'], ['off', 'Wyłączone']]))}
    ${prefRow('Animacja przy uruchomieniu', '<button class="link-btn" data-act="splash-preview">Pokaż podgląd</button>', swBtn(s.splash !== false, 'splash'))}`)}
  ${sec(1, sz(I.done, 17), 'Zadania i zachowanie', `
    ${prefRow('Widok po uruchomieniu', 'Co widzisz po otwarciu aplikacji', segBtns('startView', s.startView, [['home', 'Start'], ['today', 'Dziś'], ['inbox', 'Skrzynka'], ['upcoming', 'Nadchodzące']]))}
    ${prefRow('Opisy zadań na liście', 'Pierwsza linia opisu pod tytułem', swBtn(s.showDesc !== false, 'showDesc'))}
    ${prefRow('Dźwięki', 'Przy odhaczaniu i końcu sesji', swBtn(s.sound !== false, 'sound'))}
    ${prefRow('Konfetti', 'Po osiągnięciu dziennego celu', swBtn(s.confetti !== false, 'confetti'))}
    ${prefRow('Dzienny cel', 'Ile zadań chcesz kończyć dziennie', stepper('dailyGoal', s.dailyGoal || 5, 1))}
    ${prefRow('Matryca – „pilne”', 'Termin w ciągu…', segBtns('mxDays', s.mxDays ?? 2, [[0, 'dziś'], [1, '1 d'], [2, '2 d'], [3, '3 d'], [7, '7 d']]))}`)}
  ${sec(2, sz(I.timer, 17), 'Skupienie', `
    ${prefRow('Sesja Pomodoro', 'Długość sesji pracy', stepper('pomo', s.pomo[0], 5, 'data-i="0"', ' min'))}
    ${prefRow('Krótka przerwa', '', stepper('pomo', s.pomo[1], 1, 'data-i="1"', ' min'))}
    ${prefRow('Długa przerwa', 'Co 4 sesje', stepper('pomo', s.pomo[2], 5, 'data-i="2"', ' min'))}`)}
  ${sec(3, sz(I.mic, 17), 'Dodawanie głosem', `
    ${prefRow('Status', voiceOk ? '<span class="ok-txt">Rozpoznawanie mowy dostępne</span>' : 'Niedostępne w tym oknie', `<button class="btn sm" data-act="voice">${sz(I.mic, 14)} Wypróbuj</button>`)}
    ${prefRow('Dodawaj od razu', 'Po zakończeniu mówienia bez potwierdzania', swBtn(s.voiceAuto, 'voiceAuto'))}`)}
  ${sec(4, sz(I.sidebar, 17), 'Menu boczne', `<p class="pf-p">Wybierz zakładki widoczne w menu. Ukryte nadal otworzysz z palety (Ctrl+K).</p><div class="pf-checks">${navOpts.map(([k, l, ic]) => `<button class="pf-chk ${hn.includes(k) ? '' : 'on'}" data-act="pref-nav" data-v="${k}" style="--nc:${NAV_HUE[k]}">${sz(ic, 16)}<span>${l}</span><i>${I.checkSmall}</i></button>`).join('')}</div>`)}
  ${sec(5, sz(I.home, 17), 'Kafelki na Starcie', `<p class="pf-p">Pokaż tylko te kafelki, których potrzebujesz.</p><div class="pf-checks">${cardOpts.map(([k, l]) => `<button class="pf-chk ${hc.includes(k) ? '' : 'on'}" data-act="pref-card" data-v="${k}"><span>${l}</span><i>${I.checkSmall}</i></button>`).join('')}</div>`)}
  ${sec(6, sz(I.cloud, 17), 'Konto i urządzenia', `
    ${accountRows()}
    ${installEvt ? prefRow('Zainstaluj aplikację', 'Własne okno i ikona – bez paska przeglądarki', `<button class="btn sm primary" data-act="pwa-install">Zainstaluj</button>`) : ''}
    ${prefRow('Przenieś zadania', 'Kopiuj z jednego miejsca, wklej w drugim', `<div style="display:flex;gap:6px"><button class="btn sm" data-act="acc-export">Kopiuj</button><button class="btn sm" data-act="acc-import">Wklej</button></div>`)}`)}
  ${sec(7, sz(I.edit, 17), 'Profil', `
    ${prefRow('Twoje imię', 'Widoczne w powitaniu', `<input class="pf-in" data-k="userName" value="${esc(s.userName || '')}" maxlength="40" aria-label="Imię">`)}
    ${prefRow('Przywróć domyślne', 'Wygląd i zachowanie jak na początku (zadania zostają)', `<button class="btn sm" data-act="pref-reset">Przywróć</button>`)}`)}
  </div>`;
  return html;
}

// ---------- Poradnik ----------
const GUIDE_VIEWS = [
  ['home', I.home, 'Start', 'Widok główny: najważniejsze zadanie „Na teraz”, plan dnia, nawyki, terminy i statystyki w jednym miejscu.', 'G H'],
  ['inbox', I.inbox, 'Skrzynka', 'Miejsce na wszystko, co jeszcze nie ma projektu. Wrzucaj tu pomysły i porządkuj później.', 'G I'],
  ['today', todayIcon(), 'Dziś', 'Zadania na dziś i zaległe. Przycisk „Zmień termin” przenosi zaległe na dziś.', 'G T'],
  ['upcoming', I.upcoming, 'Nadchodzące', 'Plan na kolejne tygodnie – przeciągaj zadania między dniami.', 'G U'],
  ['calendar', I.calMonth, 'Kalendarz', 'Widok miesiąca. Kliknij dzień, by zobaczyć zadania; przeciągnij zadanie, by zmienić termin.', 'G K'],
  ['matrix', I.matrix, 'Matryca', 'Matryca Eisenhowera: przeciągnięcie zadania zmienia jego priorytet i termin.', 'G M'],
  ['filters', I.filters, 'Filtry i etykiety', 'Własne widoki oparte na zapytaniach, np. „p1 & today”, oraz etykiety @.', 'G F'],
  ['reports', I.pulse, 'Raportowanie', 'Dzienny cel, serie, mapa aktywności i godziny, w których najczęściej kończysz zadania.', 'G R'],
  ['focus', I.timer, 'Skupienie', 'Pomodoro i stoper z dokładną historią sesji oraz czasem każdego zadania.', 'G S'],
  ['autoprio', I.bolt, 'Auto-priorytety', 'Reguły, które podnoszą priorytet, gdy zbliża się termin lub zadanie jest w ważnym projekcie.', 'G A'],
  ['habits', I.habit, 'Nawyki', 'Codzienne nawyki z seriami i mapą ostatnich 12 tygodni.', ''],
  ['completed', I.done, 'Ukończone', 'Historia ukończonych zadań – możesz je przywrócić jednym kliknięciem.', 'G C'],
  ['prefs', I.gear, 'Ustawienia', 'Wygląd, gęstość, animacje, długość Pomodoro, widoczne zakładki i kafelki Startu.', ','],
];
const GUIDE_KEYS = [
  ['Nawigacja', [['Ctrl K', 'Paleta poleceń – szukaj i uruchamiaj wszystko'], ['/', 'Szukaj'], ['M', 'Pokaż / ukryj menu'], ['G potem H/I/T/U/K/M/F/R/S/A/C', 'Przejdź do zakładki (patrz wyżej)'], ['?', 'Ten poradnik'], [',', 'Ustawienia']]],
  ['Dodawanie', [['Q', 'Szybkie dodawanie zadania'], ['V', 'Dodaj zadanie głosem'], ['Enter', 'Zapisz zadanie'], ['Tab', 'Zatwierdź podpowiedź #projekt / @etykieta'], ['Ctrl V', 'Wklej listę – każda linia to osobne zadanie']]],
  ['Zadanie pod kursorem', [['D', 'Ukończ'], ['T', 'Termin dziś'], ['J', 'Termin jutro'], ['1 … 4', 'Priorytet'], ['E', 'Edytuj'], ['Delete', 'Usuń']]],
  ['Zaznaczanie i edycja', [['Ctrl klik', 'Zaznacz kilka zadań'], ['Shift klik', 'Zaznacz zakres'], ['Ctrl A', 'Zaznacz wszystkie widoczne'], ['Ctrl Z', 'Cofnij ostatnią zmianę'], ['Esc', 'Zamknij / anuluj / odznacz'], ['Ctrl Enter', 'Wyślij komentarz']]],
];
const GUIDE_EX = ['Oddać sprawozdanie pt 10:00 p1 #Studia', 'Siłownia co pon @sport', 'Zapłacić rachunek 15.12 p2', 'Powtórka za 3 dni o 18:00', 'Kupić prezent w ten weekend'];
const kbd = k => k.split(' ').map(x => ['potem', 'klik'].includes(x) ? ` ${x} ` : `<kbd>${esc(x)}</kbd>`).join('');
function renderGuide() {
  let html = header('Poradnik', { icon: sz(I.book, 24), iconCls: 'tile', sub: 'Wszystko, co musisz wiedzieć o Listo – zakładki, składnia, głos i skróty klawiszowe.' });
  html += `<div class="gd-search">${I.search}<input class="gd-q" placeholder="Szukaj w poradniku, np. „termin”, „głos”, „skrót”…" aria-label="Szukaj w poradniku"></div>
  <section class="gd-sec" data-text="pierwsze kroki start dodaj zadanie termin skup"><h2>Pierwsze kroki</h2><div class="gd-steps">
    ${[[I.plus, 'Dodaj zadanie', 'Naciśnij <kbd>Q</kbd> albo „Dodaj zadanie”. Wpisz np. „Raport jutro 15:00 p1”.', 'quick-add', 'Dodaj teraz'],
       [I.mic, 'Powiedz je na głos', 'Naciśnij <kbd>V</kbd> i powiedz, co masz zrobić – termin i priorytet wykryją się same.', 'voice', 'Wypróbuj'],
       [I.timer, 'Skup się', 'W „Skupieniu” uruchom Pomodoro lub stoper – czas zapisze się przy zadaniu.', 'nav:focus', 'Otwórz'],
       [I.pulse, 'Sprawdzaj postępy', 'Start i Raportowanie pokażą Twój rytm, serie i najbardziej produktywne godziny.', 'nav:reports', 'Zobacz']]
      .map(([ic, t, d, a, b], i) => `<div class="gd-step spot" style="--i:${i}"><span class="gd-n">${i + 1}</span><span class="gd-ic">${sz(ic, 20)}</span><b>${t}</b><p>${d}</p><button class="btn sm" ${a.startsWith('nav:') ? `data-act="nav" data-view="${a.slice(4)}"` : `data-act="${a}"`}>${b}</button></div>`).join('')}
  </div></section>
  <section class="gd-sec"><h2>Zakładki</h2><div class="gd-views">${GUIDE_VIEWS.map(([v, ic, n, d, k], i) => `<div class="gd-view spot" data-text="${esc(fold(n + ' ' + d))}" style="--nc:${NAV_HUE[v]};--i:${i}"><span class="gd-vi">${sz(ic, 20)}</span><div class="grow"><b>${n}${k ? `<span class="gd-k">${kbd(k)}</span>` : ''}</b><p>${d}</p></div><button class="icon-btn" data-act="nav" data-view="${v}" title="Otwórz">${I.right}</button></div>`).join('')}</div></section>
  <section class="gd-sec" data-text="szybkie dodawanie skladnia termin priorytet projekt etykieta powtarzanie godzina"><h2>Szybkie dodawanie – wypróbuj</h2>
    <div class="gd-try"><input class="gd-try-in" placeholder="Wpisz zadanie, np. „Oddać projekt pt 10:00 p1 #Studia”" aria-label="Wypróbuj składnię"><div class="gd-try-out"><span class="muted small">Tu zobaczysz, co rozpozna Listo.</span></div></div>
    <div class="sh-chips" style="margin-top:10px">${GUIDE_EX.map(x => `<button class="sh-chip" data-act="gd-ex" data-t="${esc(x)}">${esc(x)}</button>`).join('')}</div>
    <table class="kbd-table gd-tbl">${[['jutro, pojutrze, pt, w sobotę, 24.12, 5 maj, za 3 dni', 'termin'], ['o 15:00, 9am', 'godzina'], ['codziennie, co tydzień, co pon', 'powtarzanie'], ['p1 … p4', 'priorytet (p1 najważniejszy)'], ['#Projekt  /Sekcja', 'projekt i sekcja'], ['@etykieta', 'etykieta']].map(([a, b]) => `<tr data-text="${esc(fold(a + ' ' + b))}"><td><code>${esc(a)}</code></td><td>${b}</td></tr>`).join('')}</table></section>
  <section class="gd-sec" data-text="glos glosowe mowa dyktowanie mikrofon"><h2>Dodawanie głosem</h2>
    <div class="gd-voice spot"><button class="gd-mic" data-act="voice" title="Wypróbuj">${sz(I.mic, 26)}</button><div><p>Naciśnij <kbd>V</kbd>, mikrofon na Starcie albo „Głos” w formularzu i po prostu powiedz zadanie. Listo samo rozpozna:</p>
      <ul><li><b>termin</b> – „jutro”, „w piątek”, „za tydzień”, „do środy”, „24 grudnia”, „na koniec tygodnia”</li><li><b>godzinę</b> – „o 15”, „o piętnastej trzydzieści”, „rano”, „po południu”, „wieczorem”</li>
      <li><b>priorytet</b> – „priorytet pierwszy”, „pilne”, „bardzo ważne” (P1), „ważne” (P2), „mało ważne” (P3)</li><li><b>projekt i etykietę</b> – „w projekcie Studia”, „etykieta sport”</li><li><b>kilka zadań naraz</b> – rozdziel je słowami „następne zadanie”</li></ul>
      <p class="muted small">Przykład: „Oddać sprawozdanie z fizyki w piątek o dziesiątej, pilne, w projekcie Studia”.</p></div></div></section>
  <section class="gd-sec"><h2>Skróty klawiszowe</h2><div class="gd-keys">${GUIDE_KEYS.map(([g, rows]) => `<div class="gd-kg spot"><h3>${g}</h3><table class="kbd-table">${rows.map(([k, d]) => `<tr data-text="${esc(fold(k + ' ' + d + ' skrot'))}"><td>${kbd(k)}</td><td>${d}</td></tr>`).join('')}</table></div>`).join('')}</div></section>
  <section class="gd-sec" data-text="myszka dotyk gesty przeciagnij prawy klik telefon"><h2>Myszka, dotyk i gesty</h2><div class="gd-tips">
    ${[['Prawy klik na zadaniu', 'szybkie menu z terminem, priorytetem i przenoszeniem'], ['Przeciągnij zadanie', 'zmień kolejność, sekcję, projekt (na menu) lub dzień'], ['Kliknij termin pod zadaniem', 'od razu otwiera wybór daty'], ['Najedź na zadanie i naciśnij klawisz', 'D, T, J, 1–4, E działają bez otwierania'], ['Telefon: przesuń w prawo', 'ukończ zadanie'], ['Telefon: przesuń w lewo', 'zmień termin']].map(([a, b]) => `<div class="gd-tip" data-text="${esc(fold(a + ' ' + b))}"><b>${a}</b><span>${b}</span></div>`).join('')}</div></section>
  <section class="gd-sec" data-text="wskazowki porady triki"><h2>Wskazówki</h2><div class="gd-tips">
    ${['Ustaw dzienny cel w Raportowaniu – kółko w „Dziś” pokaże postęp.', 'Włącz Auto-priorytety, by zbliżające się terminy same stawały się ważniejsze.', 'Na Starcie przycisk „Pomiń” pokazuje następne zadanie z kolejki.', 'W Skupieniu dodawaj notatki do sesji – po ukończeniu zadania zobaczysz je w raporcie.', 'Ctrl+K otwiera paletę: wpisz nazwę zadania, projektu albo polecenia.', 'W Ustawieniach ukryjesz zakładki i kafelki, których nie używasz.'].map(t => `<div class="gd-tip" data-text="${esc(fold(t))}"><span>💡 ${t}</span></div>`).join('')}</div></section>`;
  return html;
}
document.addEventListener('input', e => {
  if (e.target.classList?.contains('gd-q')) {
    const q = fold(e.target.value.trim());
    $$('.gd-sec').forEach(sec => {
      const items = $$('[data-text]', sec).filter(x => x !== sec);
      let any = !q || fold(sec.dataset.text || '').includes(q) || fold($('h2', sec)?.textContent || '').includes(q);
      items.forEach(it => { const hit = !q || fold(it.dataset.text).includes(q); it.classList.toggle('gd-hide', !hit && !(q && fold(sec.dataset.text || '').includes(q))); if (hit) any = true; });
      sec.classList.toggle('gd-hide', !any);
    });
  } else if (e.target.classList?.contains('gd-try-in')) gdTry(e.target.value);
  else if (e.target.classList?.contains('pf-in')) { clearTimeout(e.target._t); const el = e.target; el._t = setTimeout(() => { state.settings[el.dataset.k] = el.value.trim(); save(); renderSidebar(); }, 400); }
});
function gdTry(v) {
  const out = $('.gd-try-out');
  if (!out) return;
  if (!v.trim()) { out.innerHTML = '<span class="muted small">Tu zobaczysz, co rozpozna Listo.</span>'; return; }
  out.innerHTML = parsedChips(parseQuick(v, {}));
}
function parsedChips(r) {
  const di = r.due && dueInfo(r.due, r.time);
  return `<span class="pv-title">${esc(r.title || '…')}</span>${di ? `<span class="pchip due ${di.cls}">${I.cal} ${di.label}</span>` : ''}${r.recurring ? `<span class="pchip">${I.repeat} ${REC_LABEL[r.recurring]}</span>` : ''}${r.priority ? `<span class="pchip">${flagIcon(r.priority, 12)} P${r.priority}</span>` : ''}${r.projectId ? `<span class="pchip"># ${esc(projName(proj(r.projectId)))}${r.sectionId ? ' / ' + esc(sectionOf({ projectId: r.projectId, sectionId: r.sectionId })?.name || '') : ''}</span>` : ''}${r.labels.map(l => `<span class="pchip">@${esc(l)}</span>`).join('')}`;
}

// ---------- Dodawanie głosem ----------
let dictNS = null;
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
const voice = { el: null, final: '', partial: '', listening: false, rec: null, edited: false };
if (window.claude?.use) {
  claude.use('dictation').then(d => {
    dictNS = d;
    if (!d) return;
    d.onPartial(({ text }) => { voice.partial = text; voiceUpdate(); });
    d.onFinal(({ text }) => { voice.final = (voice.final ? voice.final + ' ' : '') + text; voice.partial = ''; voiceUpdate(); });
    d.onState(({ state: st, reason }) => { if (st === 'idle') { voice.listening = false; voiceEnded(reason); } else if (st === 'listening') { voice.listening = true; voiceSetState('listening'); } });
  }).catch(() => { /* brak dyktowania */ });
}
const NUMW = { jeden: 1, jedną: 1, jedna: 1, dwa: 2, dwie: 2, trzy: 3, cztery: 4, pięć: 5, sześć: 6, siedem: 7, osiem: 8, dziewięć: 9, dziesięć: 10, czternaście: 14 };
const ORDH = { pierwszej: 1, drugiej: 2, trzeciej: 3, czwartej: 4, piątej: 5, szóstej: 6, siódmej: 7, ósmej: 8, dziewiątej: 9, dziesiątej: 10, jedenastej: 11, dwunastej: 12, trzynastej: 13, czternastej: 14, piętnastej: 15, szesnastej: 16, siedemnastej: 17, osiemnastej: 18, dziewiętnastej: 19, dwudziestej: 20, 'dwudziestej pierwszej': 21, 'dwudziestej drugiej': 22, 'dwudziestej trzeciej': 23 };
const MINW = { piętnaście: 15, trzydzieści: 30, 'czterdzieści pięć': 45, dziesięć: 10, dwadzieścia: 20, pięćdziesiąt: 50, czterdzieści: 40 };
const WD_GEN = { poniedziałku: 'poniedziałek', wtorku: 'wtorek', środy: 'środa', czwartku: 'czwartek', piątku: 'piątek', soboty: 'sobota', niedzieli: 'niedziela' };
const fmtDMY = s => { const d = parseDate(s); return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`; };
function voiceToQuick(raw) {
  let s = ' ' + raw.replace(/[„”"]/g, '').replace(/[.!?]+\s*$/, '') + ' ';
  const E = '(?=[\\s,.!?])';
  s = s.replace(/^\s*(?:dodaj(?: nowe)? zadanie|nowe zadanie|zadanie|przypomnij mi(?:,)?(?: żeby| że| o)?|muszę|trzeba|zapisz)\s*[:,]?\s*/i, ' ');
  s = s.replace(new RegExp(`(\\s)za (${Object.keys(NUMW).join('|')})${E}`, 'gi'), (m, a, w) => `${a}za ${NUMW[w.toLowerCase()]}`);
  let p = null;
  const PR = [
    [new RegExp(`\\s+priorytet(?:em)?\\s*(?:numer\\s*)?(?:1|jeden|pierwszy|najwyższy|wysoki)${E}`, 'i'), 1],
    [new RegExp(`\\s+priorytet(?:em)?\\s*(?:numer\\s*)?(?:2|dwa|drugi|średni)${E}`, 'i'), 2],
    [new RegExp(`\\s+priorytet(?:em)?\\s*(?:numer\\s*)?(?:3|trzy|trzeci|niski)${E}`, 'i'), 3],
    [new RegExp(`\\s+priorytet(?:em)?\\s*(?:numer\\s*)?(?:4|cztery|czwarty|najniższy|brak)${E}`, 'i'), 4],
    [new RegExp(`[\\s,]+(?:mało ważne|nieważne|bez pośpiechu|kiedyś)${E}`, 'i'), 3],
    [new RegExp(`[\\s,]+(?:bardzo pilne|bardzo ważne|super ważne|na wczoraj|krytyczne|pilnie|pilne|natychmiast)${E}`, 'i'), 1],
    [new RegExp(`[\\s,]+(?:ważne|istotne)${E}`, 'i'), 2],
  ];
  for (const [re, v] of PR) if (re.test(s)) { p = v; s = s.replace(re, ' '); break; }
  const ORDK = Object.keys(ORDH).sort((a, b) => b.length - a.length).join('|'), MINK = Object.keys(MINW).sort((a, b) => b.length - a.length).join('|');
  s = s.replace(new RegExp(`(\\s)o\\s+(?:godzinie\\s+)?(${ORDK})(?:\\s+(${MINK}))?${E}`, 'i'), (m, a, h, mi) => ` o ${ORDH[h.toLowerCase()]}:${pad(mi ? MINW[mi.toLowerCase()] : 0)}`);
  s = s.replace(/(\s)o\s+(?:godzinie\s+)?(\d{1,2})(?:[:.\s](\d{2}))?(?=[\s,.!?])/i, (m, a, h, mi) => +h < 24 && (!mi || +mi < 60) ? ` o ${h}:${mi || '00'}` : m);
  const hasTime = /\so \d{1,2}:\d{2}/.test(s);
  for (const [re, tm] of [[/(\s)(?:rano|z rana|rankiem)(?=[\s,.])/i, '9:00'], [/(\s)w południe(?=[\s,.])/i, '12:00'], [/(\s)po południu(?=[\s,.])/i, '15:00'], [/(\s)wieczorem(?=[\s,.])/i, '19:00'], [/(\s)w nocy(?=[\s,.])/i, '22:00']]) {
    if (re.test(s)) { s = s.replace(re, hasTime ? ' ' : ` o ${tm} `); break; }
  }
  const td = todayStr();
  s = s.replace(/(\s)(?:w|na|we)\s+(?:przyszły|przyszłą|następny|następną|najbliższy|najbliższą)\s+/i, ' w ');
  s = s.replace(new RegExp(`(\\s)(?:do|przed|na)\\s+(${Object.keys(WD_GEN).join('|')})${E}`, 'i'), (m, a, w) => ` w ${WD_GEN[w.toLowerCase()]}`);
  s = s.replace(/(\s)(?:do|na|przed)\s+jutra(?=[\s,.])/i, ' jutro').replace(/(\s)(?:do|na)\s+(?:dziś|dzisiaj)(?=[\s,.])/i, ' dziś').replace(/(\s)na jutro(?=[\s,.])/i, ' jutro');
  s = s.replace(/(\s)(?:na\s+|do\s+)?koń?ca? tygodnia(?=[\s,.])/i, ' w piątek');
  s = s.replace(/(\s)(?:za|w ciągu)\s+miesiąc(?:a)?(?=[\s,.])/i, () => { const d = parseDate(td); d.setMonth(d.getMonth() + 1); return ' ' + fmtDMY(fmtDate(d)); });
  s = s.replace(/(\s)(?:na|do)\s+koniec miesiąca(?=[\s,.])/i, () => { const d = parseDate(td); return ' ' + fmtDMY(fmtDate(new Date(d.getFullYear(), d.getMonth() + 1, 0))); });
  s = s.replace(/(\s)(?:w|do|dla)\s+projek(?:tu|cie|t)\s+([\p{L}\d-]+)/iu, (m, a, n) => ` #${n}`);
  s = s.replace(/(\s)(?:w|do)\s+sekcji\s+([\p{L}\d-]+)/iu, (m, a, n) => ` /${n}`);
  s = s.replace(/(\s)(?:z\s+)?etykiet(?:ą|a|y)\s+([\p{L}\d-]+)/iu, (m, a, n) => ` @${n}`);
  // „do studiów”, „na studia” → #Studia (gdy pasuje do nazwy projektu)
  userProjects().forEach(pr => {
    const stem = fold(pr.name).replace(/\s+/g, '').slice(0, Math.max(4, pr.name.length - 2));
    s = s.replace(/(\s)(?:do|na|w|dla)\s+([\p{L}]+)(?=[\s,.])/giu, (m, a, w) => fold(w).startsWith(stem) && !s.includes('#') ? ` #${pr.name.replace(/\s+/g, '')}` : m);
  });
  const r = parseQuick(s, {});
  if (p) r.priority = p;
  r.title = cap(r.title.replace(/^[,\s-]+|[,\s-]+$/g, '').replace(/[,\s]+(?:i|oraz|a)$/i, '').replace(/\s+,/g, ','));
  return r;
}
function voiceParse(text) {
  return text.split(/(?:[;]|\s(?:następne|kolejne) zadanie[,:]?\s|\.\s+(?=\p{Lu}))/iu).map(x => x.trim()).filter(Boolean).map(voiceToQuick).filter(r => r.title);
}
function openVoice() {
  if (voice.el) return;
  closePopover(true);
  const el = document.createElement('div');
  el.id = 'voice';
  el.innerHTML = `<div class="vc-box" role="dialog" aria-label="Dodawanie głosem">
    <button class="vc-x icon-btn" data-v="close" aria-label="Zamknij">${I.x}</button>
    <button class="vc-mic" data-v="mic" aria-label="Mikrofon"><span class="vc-r r1"></span><span class="vc-r r2"></span><span class="vc-r r3"></span>${sz(I.mic, 34)}</button>
    <div class="vc-state">Przygotowuję mikrofon…</div>
    <div class="vc-wave">${'<i></i>'.repeat(18)}</div>
    <textarea class="vc-text" rows="2" placeholder="Mów… albo wpisz tutaj" spellcheck="false"></textarea>
    <div class="vc-prev"></div>
    <div class="vc-hint">Np. „Oddać sprawozdanie w piątek o dziesiątej, pilne, w projekcie Studia”. Kilka zadań rozdziel słowami „następne zadanie”.</div>
    <div class="vc-foot"><button class="btn" data-v="again">${sz(I.mic, 14)} Mów ponownie</button><span class="grow"></span><button class="btn ghost" data-v="close">Anuluj</button><button class="btn primary" data-v="add">Dodaj <kbd>Enter</kbd></button></div>
  </div>`;
  document.body.appendChild(el);
  voice.el = el; voice.edited = false;
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-v]');
    if (e.target === el) return voiceClose();
    if (!b) return;
    const a = b.dataset.v;
    if (a === 'close') voiceClose();
    else if (a === 'add') voiceCommit();
    else if (a === 'again' || a === 'mic') { if (voice.listening) voiceStop(); else voiceStart(); }
  });
  const ta = $('.vc-text', el);
  ta.addEventListener('input', () => { voice.edited = true; voicePreview(); });
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); voiceCommit(); } if (e.key === 'Escape') { e.stopPropagation(); voiceClose(); } });
  el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); voiceClose(); } });
  voiceStart();
}
function voiceSetState(st, msg) {
  const el = voice.el;
  if (!el) return;
  el.dataset.st = st;
  const txt = { listening: 'Słucham… mów śmiało', idle: voice.final || voice.partial ? 'Sprawdź i zatwierdź' : 'Kliknij mikrofon, aby mówić', error: msg || 'Nie udało się użyć mikrofonu – możesz wpisać zadanie', unavailable: 'Rozpoznawanie mowy jest niedostępne w tym oknie – wpisz zadanie poniżej' }[st];
  $('.vc-state', el).textContent = txt;
}
function voiceStart() {
  voice.final = ''; voice.partial = ''; voice.edited = false;
  if (voice.el) { $('.vc-text', voice.el).value = ''; voicePreview(); }
  if (dictNS) {
    voice.listening = true; voiceSetState('listening');
    dictNS.start().catch(e => { voice.listening = false; voiceSetState('error', e?.code === 'not_granted' ? 'Brak zgody na mikrofon – możesz wpisać zadanie' : undefined); });
    return;
  }
  if (SpeechRec) {
    try {
      const r = new SpeechRec();
      r.lang = 'pl-PL'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
      r.onresult = e => { let fin = '', part = ''; for (let i = 0; i < e.results.length; i++) { const x = e.results[i]; if (x.isFinal) fin += x[0].transcript; else part += x[0].transcript; } voice.final = fin.trim(); voice.partial = part; voiceUpdate(); };
      r.onerror = e => { voice.listening = false; voiceSetState('error', e.error === 'not-allowed' ? 'Brak zgody na mikrofon – możesz wpisać zadanie' : e.error === 'no-speech' ? 'Nic nie usłyszałem – spróbuj jeszcze raz' : undefined); };
      r.onend = () => { if (voice.listening) { voice.listening = false; voiceEnded(); } };
      voice.rec = r; r.start(); voice.listening = true; voiceSetState('listening');
    } catch (e) { voiceSetState('error'); }
    return;
  }
  voiceSetState('unavailable');
  setTimeout(() => voice.el && $('.vc-text', voice.el).focus(), 50);
}
function voiceStop() { try { dictNS?.stop(); } catch (e) { /* */ } try { voice.rec?.stop(); } catch (e) { /* */ } }
function voiceUpdate() {
  if (!voice.el) return;
  const ta = $('.vc-text', voice.el);
  if (!voice.edited) ta.value = (voice.final + (voice.partial ? ' ' + voice.partial : '')).trim();
  voicePreview();
}
function voicePreview() {
  if (!voice.el) return;
  const rs = voiceParse($('.vc-text', voice.el).value);
  $('.vc-prev', voice.el).innerHTML = rs.map((r, i) => `<div class="vc-task" style="--i:${i}">${parsedChips(r)}</div>`).join('');
  $('[data-v="add"]', voice.el).disabled = !rs.length;
}
function voiceEnded() {
  if (!voice.el) return;
  voiceSetState('idle');
  const v = $('.vc-text', voice.el).value.trim();
  if (v && state.settings.voiceAuto) setTimeout(voiceCommit, 500);
  else $('.vc-text', voice.el).focus();
}
function voiceCommit() {
  if (!voice.el) return;
  const rs = voiceParse($('.vc-text', voice.el).value);
  if (!rs.length) return;
  const d = ui.addForm?.defaults || {};
  const snap = snapshot();
  rs.forEach(r => {
    const labels = r.labels.map(n => { let l = state.labels.find(x => x.name.toLowerCase() === n.toLowerCase()); if (!l) { l = { id: uid(), name: n, color: '#808080' }; state.labels.push(l); } return l.id; });
    const t = newTask({ title: r.title, description: '', projectId: r.projectId || d.projectId || 'inbox', sectionId: r.sectionId || (r.projectId ? null : d.sectionId) || null, parentId: null,
      priority: r.priority || d.priority || 4, due: r.due || d.due || null, time: r.time || null, recurring: r.recurring || null, labels, order: nextOrder() });
    state.tasks.push(t); markEnter(t.id);
  });
  voiceClose();
  commit();
  playSound('done');
  toast(rs.length === 1 ? `🎙️ Dodano: ${rs[0].title}` : `🎙️ Dodano ${rs.length} zadania`, snap);
}
function voiceClose() {
  voiceStop();
  const el = voice.el;
  voice.el = null; voice.listening = false;
  if (!el) return;
  el.classList.add('out');
  setTimeout(() => el.remove(), REDUCED ? 0 : 220);
}

// ---------- ekran startowy ----------
function showSplash(force) {
  if (!force && (!freshLaunch || state.settings.splash === false || REDUCED || state.settings.anim === 'off')) return;
  // Abstrakcyjne pole przepływu: tysiące cząsteczek z rozmyciem ruchu, które zbiegają się w znaczek Listo
  const hr = new Date().getHours(), name = state.settings.userName || '';
  const greet = hr < 5 ? 'Dobrej nocy' : hr < 12 ? 'Dzień dobry' : hr < 18 ? 'Miłego popołudnia' : 'Dobry wieczór';
  const now0 = new Date(), td = todayStr();
  const nToday = active().filter(t => t.due && t.due <= td).length;
  const stamp = `${pad(now0.getDate())}.${pad(now0.getMonth() + 1)}.${now0.getFullYear()} ${pad(now0.getHours())}:${pad(now0.getMinutes())}`;
  const el = document.createElement('div');
  el.id = 'launch';
  el.className = 'flow';
  el.innerHTML = `<canvas class="lf-cv" aria-hidden="true"></canvas><div class="lf-glow" aria-hidden="true"></div><div class="lf-grain" aria-hidden="true"></div><div class="lf-vig" aria-hidden="true"></div>
    <div class="lf-hud tl"><b>LISTO</b><span>FLOW FIELD // v3</span><span class="lf-seed">SEED 0x0000</span></div>
    <div class="lf-hud tr"><span>${stamp}</span><span class="lf-cnt">PARTICLES 0000</span><span class="lf-fr">FRAME 0000</span></div>
    <div class="lf-hud bl"><span class="lf-st">INIT // VECTOR FIELD</span><span class="lf-bar"><i></i></span></div>
    <div class="lf-hud br"><span>${nToday} ${nToday === 1 ? 'TASK' : 'TASKS'} // TODAY</span><span>SYNC ${sync.ref ? 'LINKED' : 'LOCAL'}</span></div>
    <div class="lf-word"><span class="lf-name">${'LISTO'.split('').map((c, i) => `<i style="--i:${i}">${c}</i>`).join('')}</span><span class="lf-sub">${esc(greet)}${name ? ', ' + esc(name) : ''}</span></div>
    <div class="ls-skip">Kliknij, aby pominąć</div>`;
  document.body.appendChild(el);
  const app = $('#app');
  app.classList.add('app-pre', 'launch', 'launch-wait');
  const lite = innerWidth < 760 || matchMedia('(pointer: coarse)').matches;
  el.classList.toggle('lite', lite);

  const cv = $('.lf-cv', el), cx = cv.getContext('2d', { alpha: false });
  const DPR = Math.min(devicePixelRatio || 1, lite ? 1 : 1.5);
  let W = 0, H = 0, S = 0;
  const fit = () => { W = cv.width = Math.round(innerWidth * DPR); H = cv.height = Math.round(innerHeight * DPR); S = Math.min(W, H) * .36; cx.fillStyle = '#000'; cx.fillRect(0, 0, W, H); };
  fit();
  // kształt docelowy: znaczek (dwa odcinki), w jednostkach znormalizowanych
  const CK = [[-.7, -.02], [-.2, .46], [.74, -.53]];
  const segs = [[CK[0], CK[1]], [CK[1], CK[2]]].map(([a, b]) => ({ a, b, l: Math.hypot(b[0] - a[0], b[1] - a[1]) }));
  const totL = segs.reduce((s, g) => s + g.l, 0);
  const onCheck = () => {
    let r = Math.random() * totL, g = segs[0];
    for (const s of segs) { if (r <= s.l) { g = s; break; } r -= s.l; }
    const k = r / g.l, nx = -(g.b[1] - g.a[1]) / g.l, ny = (g.b[0] - g.a[0]) / g.l, j = (Math.random() - .5) * .16 * (Math.random() < .8 ? 1 : 2.6);
    return [g.a[0] + (g.b[0] - g.a[0]) * k + nx * j, g.a[1] + (g.b[1] - g.a[1]) * k + ny * j, (Math.random() - .5) * .22];
  };
  const N = lite ? 1800 : 5200;
  const P = new Float32Array(N * 10); // x y z vx vy vz tx ty tz kind
  const seed = Math.random() * 1000;
  const AX = [1.25, .74, .86];
  const LIFE = new Float32Array(N);
  const spawn = (i, spray) => {
    const o = i * 10, u = Math.random() * 6.283, v = Math.acos(2 * Math.random() - 1), r = spray ? 1 : .9 + Math.random() * .14;
    P[o] = Math.sin(v) * Math.cos(u) * r * AX[0]; P[o + 1] = Math.cos(v) * r * AX[1]; P[o + 2] = Math.sin(v) * Math.sin(u) * r * AX[2];
    P[o + 3] = P[o + 4] = P[o + 5] = 0;
    const t = onCheck(); P[o + 6] = t[0]; P[o + 7] = t[1]; P[o + 8] = t[2];
    P[o + 9] = spray ? 1 : 0;
    LIFE[i] = spray ? .4 + Math.random() * 1.1 : 0;
  };
  for (let i = 0; i < N; i++) spawn(i, i % 9 === 0);
  // pseudo-wirowe pole przepływu (tanie, organiczne)
  const flow = (x, y, z, t) => [
    Math.sin(y * 1.7 + t * .9 + seed) + Math.cos(z * 2.3 - t * .6) * .6 + Math.sin((x + y) * 3.1 + t) * .25,
    Math.sin(z * 1.9 - t * .7) + Math.cos(x * 2.1 + t * .8 + seed) * .6 + Math.sin((y - z) * 2.9 - t) * .25,
    Math.sin(x * 1.5 + t * .5) + Math.cos(y * 2.7 + t * .4 + seed) * .6,
  ];
  // falująca powierzchnia bryły
  const surf = (nx, ny, nz, t) => 1 + .2 * Math.sin(nx * 3 + t * 1.3 + seed) * Math.cos(ny * 2.2 - t * .9) + .11 * Math.sin(nz * 5 + t * 2.1) + .06 * Math.sin((nx - ny) * 7 - t * 2.6);
  const t0 = performance.now();
  const T_FORM = lite ? 1.5 : 1.75, T_EXIT = lite ? 3.3 : 3.75;
  let rot = .6, raf = 0, alive = true, last = t0, frame = 0, exploding = false, acc = 0;
  const hudF = $('.lf-fr', el), hudC = $('.lf-cnt', el), hudS = $('.lf-seed', el);
  hudS.textContent = 'SEED 0x' + Math.floor(seed * 65).toString(16).toUpperCase().padStart(4, '0');
  const Lx = -.45, Ly = -.6, Lz = -.66; // kierunek światła (z góry, z lewej, od widza)
  const ALPHA = ['rgba(255,255,255,.035)', 'rgba(255,255,255,.075)', 'rgba(255,255,255,.13)', 'rgba(255,255,255,.2)', 'rgba(255,255,255,.3)'];
  const step = (h, T, fe) => {
    for (let i = 0; i < N; i++) {
      const o = i * 10;
      const x = P[o], y = P[o + 1], z = P[o + 2], spray = P[o + 9] === 1;
      const qx = x / AX[0], qy = y / AX[1], qz = z / AX[2], d = Math.hypot(qx, qy, qz) + 1e-4;
      const nx = qx / d, ny = qy / d, nz = qz / d;
      const f = flow(x, y, z, T), fd = f[0] * nx + f[1] * ny + f[2] * nz;
      let rt;
      if (spray) { LIFE[i] -= h; rt = 1 + (1.5 - LIFE[i]) * .9; if (LIFE[i] <= 0 && !exploding) { spawn(i, true); continue; } }
      else rt = surf(nx, ny, nz, T);
      const rad = (rt - d) * (spray ? 2.2 : 3.2);
      let dx = (f[0] - nx * fd) * .78 + nx * rad * AX[0], dy = (f[1] - ny * fd) * .78 + ny * rad * AX[1], dz = (f[2] - nz * fd) * .78 + nz * rad * AX[2];
      if (fe > 0 && !exploding) {
        const k = 5.5;
        const keep = .28 + (1 - fe) * .45; dx = dx * keep + (P[o + 6] - x) * k * fe; dy = dy * keep + (P[o + 7] - y) * k * fe; dz = dz * keep + (P[o + 8] - z) * k * fe;
      }
      if (exploding) { dx += nx * 6; dy += ny * 6; dz += nz * 6; }
      const sm = .1 + fe * .14; P[o + 3] += (dx - P[o + 3]) * sm; P[o + 4] += (dy - P[o + 4]) * sm; P[o + 5] += (dz - P[o + 5]) * sm;
      const sp = Math.hypot(P[o + 3], P[o + 4], P[o + 5]), cap = exploding ? 9 : 2.1 + fe * 2.6; if (sp > cap) { P[o + 3] *= cap / sp; P[o + 4] *= cap / sp; P[o + 5] *= cap / sp; }
      P[o] = x + P[o + 3] * h; P[o + 1] = y + P[o + 4] * h; P[o + 2] = z + P[o + 5] * h;
    }
  };
  const draw = now => {
    if (!alive) return;
    const rdt = Math.min(.1, (now - last) / 1000); last = now;
    const T = (now - t0) / 1000;
    const form = Math.max(0, Math.min(1, (T - T_FORM) / .95)), fe = form * form * (3 - 2 * form);
    // stały krok fizyki – ten sam wygląd przy 30 i 144 kl./s
    acc += rdt; let n = 0;
    while (acc >= 1 / 60 && n < 4) { step(1 / 60, T, fe); acc -= 1 / 60; n++; }
    if (n === 4) acc = 0;
    rot += rdt * (.9 - fe * .75);
    const rr = 1 - fe, cr = Math.cos(rot) * rr + fe, sr = Math.sin(rot) * rr;
    // rozmycie ruchu: zostawiamy półprzezroczysty ślad poprzednich klatek
    cx.globalCompositeOperation = 'source-over';
    cx.fillStyle = `rgba(0,0,0,${exploding ? .2 : .085 + fe * .07})`;
    cx.fillRect(0, 0, W, H);
    cx.globalCompositeOperation = 'lighter';
    const ox = W / 2, oy = H / 2 - H * .02, F = 2.8, SC = S * 1.12, TR = .055;
    const B = [new Path2D(), new Path2D(), new Path2D(), new Path2D(), new Path2D()];
    for (let i = 0; i < N; i++) {
      const o = i * 10, x = P[o], y = P[o + 1], z = P[o + 2], vx = P[o + 3], vy = P[o + 4], vz = P[o + 5];
      // obrót widoku wokół osi pionowej + perspektywa
      const xr = x * cr - z * sr, zr = x * sr + z * cr;
      const p = F / (F + zr);
      const X = ox + xr * p * SC, Y = oy + y * p * SC;
      const bx = x - vx * TR, by = y - vy * TR, bz = z - vz * TR;
      const bxr = bx * cr - bz * sr, bzr = bx * sr + bz * cr, pb = F / (F + bzr);
      // cieniowanie: normalna powierzchni względem światła
      const qx = x / AX[0], qy = y / AX[1], qz = z / AX[2], dd = Math.hypot(qx, qy, qz) + 1e-4;
      const nxr = (qx * cr - qz * sr) / dd, nyr = qy / dd, nzr = (qx * sr + qz * cr) / dd;
      let lum = Math.max(0, nxr * Lx + nyr * Ly + nzr * Lz) * 1.15 + .08;
      if (nzr > .15) lum *= .35;               // tylna strona bryły
      if (P[o + 9] === 1) lum = .45 + lum * .3; // pył wokół
      lum = lum * (1 - fe) + .78 * fe;
      const b = B[lum < .18 ? 0 : lum < .38 ? 1 : lum < .58 ? 2 : lum < .8 ? 3 : 4];
      b.moveTo(ox + bxr * pb * SC, oy + by * pb * SC); b.lineTo(X, Y);
    }
    cx.lineWidth = DPR * (lite ? 1.3 : 1.15);
    cx.lineCap = 'round';
    for (let k = 0; k < 5; k++) { cx.strokeStyle = ALPHA[k]; cx.stroke(B[k]); }
    frame++;
    if (frame % 3 === 0) { hudF.textContent = 'FRAME ' + String(frame).padStart(4, '0'); hudC.textContent = 'PARTICLES ' + N + ' // ' + Math.round(1 / Math.max(rdt, .001)) + ' FPS'; }
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);

  const timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  const st = $('.lf-st', el);
  at(500, () => { st.textContent = 'SOLVING // CURL FLOW'; });
  at(T_FORM * 1000, () => { st.textContent = 'CONVERGE // ' + (sync.ref ? 'SYNCING TASKS' : 'LOADING TASKS'); el.classList.add('form'); });
  at(T_FORM * 1000 + 700, () => { el.classList.add('word'); });
  at(T_EXIT * 1000 - 300, () => { st.textContent = 'READY'; el.classList.add('ready'); });
  let out = false;
  const done = () => {
    if (out) return; out = true;
    timers.forEach(clearTimeout);
    exploding = true;
    launchIntroPrep();
    el.classList.add('out');
    app.classList.remove('app-pre', 'launch-wait');
    setTimeout(countUp, 900);
    setTimeout(() => { alive = false; cancelAnimationFrame(raf); el.remove(); }, 900);
    setTimeout(() => app.classList.remove('launch'), 3400);
  };
  el.addEventListener('click', done);
  addEventListener('keydown', function sk(e) { if (out) { removeEventListener('keydown', sk); return; } if (['Escape', 'Enter', ' '].includes(e.key)) { e.preventDefault(); done(); } });
  addEventListener('resize', () => { if (alive) fit(); });
  at(T_EXIT * 1000, done);
}

// ---------- obsługa kliknięć nowych elementów ----------
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.closest('#popover') || el.closest('#dialog-root')) return;
  const a = el.dataset.act, k = el.dataset.k, s = state.settings;
  switch (a) {
    case 'voice': e.preventDefault(); openVoice(); break;
    case 'pref': { let v = el.dataset.v; if (['scale', 'mxDays'].includes(k)) v = +v; if (String(s[k]) !== String(v)) setPref(k, v, el); break; }
    case 'pref-tg': { const v = !(PREF_FALSE.includes(k) ? !!s[k] : s[k] !== false); if (PREF_REDRAW.includes(k)) { state.settings[k] = v; ui.quiet = true; commit(); if (k === 'karma' && v) karmaDaily(); } else setPref(k, v, el); break; }
    case 'pref-step': {
      const d = +el.dataset.d;
      if (k === 'pomo') { const i = +el.dataset.i, arr = [...s.pomo]; arr[i] = Math.max(1, Math.min(120, arr[i] + d)); setPref('pomo', arr, el); }
      else setPref(k, Math.max(1, Math.min(50, (s[k] || 5) + d)), el);
      break;
    }
    case 'pref-nav': { const v = el.dataset.v, h = new Set(s.hiddenNav || []); h.has(v) ? h.delete(v) : h.add(v); setPref('hiddenNav', [...h], el); break; }
    case 'pref-card': { const v = el.dataset.v, h = new Set(s.hiddenCards || []); h.has(v) ? h.delete(v) : h.add(v); setPref('hiddenCards', [...h], el); break; }
    case 'pref-reset': confirmDlg('Przywrócić ustawienia domyślne?', 'Wygląd i zachowanie wrócą do ustawień początkowych. Zadania, nawyki i historia zostaną bez zmian.', 'Przywróć', () => {
      const keep = { userName: s.userName, dailyGoal: s.dailyGoal, completedGroup: s.completedGroup };
      state.settings = Object.assign({}, PREF_DEFAULTS, { theme: 'dark', accent: 'todoist', sound: true, mxDays: 2 }, keep);
      ui.quiet = true; commit(); toast('Przywrócono ustawienia domyślne');
    }); break;
    case 'splash-preview': showSplash(true); break;
    case 'hb-add': { const i = $('.hb-in'); hbAdd(i?.value); break; }
    case 'hb-sug': hbAdd(el.dataset.t); break;
    case 'hb-day': e.stopPropagation(); hbToggle(el.dataset.id, el.dataset.date); break;
    case 'hb-menu': hbMenu(el, state.habits.find(h => h.id === el.dataset.id)); break;
    case 'search-q': { const i = $('.search-input'); if (i) { i.value = el.dataset.q; ui.view.q = el.dataset.q; updateSearchResults(); i.focus(); } break; }
    case 'gd-ex': { const i = $('.gd-try-in'); if (i) { i.value = el.dataset.t; gdTry(i.value); i.focus(); } break; }
  }
});
document.addEventListener('keydown', e => {
  if (e.target.classList?.contains('hb-in') && e.key === 'Enter') { e.preventDefault(); hbAdd(e.target.value); }
});
// poświata pod kursorem na kartach
let spotRaf = 0;
document.addEventListener('pointermove', e => {
  if (spotRaf || e.pointerType === 'touch') return;
  spotRaf = requestAnimationFrame(() => {
    spotRaf = 0;
    const c = e.target.closest?.('.hm-card, .mx-q, .ap-card, .hb-card, .pf-card, .rep-box, .rep-card, .spot, .fz-live, .focus-side, .ins, .cs-cards > div');
    if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    c.style.setProperty('--my', (e.clientY - r.top) + 'px');
  });
}, { passive: true });
showSplash();
// ================================================================
//  Konta i synchronizacja przez własny serwer (Supabase) + instalowalna aplikacja (PWA)
// ================================================================
const CFG = Object.assign({ supabaseUrl: '', supabaseKey: '', siteUrl: '' }, window.LISTO_CONFIG || {});
const SB_LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
const auth = { sb: null, user: null, ready: false };
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
}
async function initSupabase() {
  try {
    if (!window.supabase?.createClient) await loadScript(SB_LIB);
  } catch (e) { sync.status = 'offline'; renderSyncBadge(); toast('Brak internetu – pracujesz lokalnie, zsynchronizuję później'); setTimeout(initSupabase, 30000); return; }
  const sb = auth.sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'listo-auth' } });
  sb.auth.onAuthStateChange((ev, session) => {
    if (ev === 'PASSWORD_RECOVERY') newPasswordDialog();
    if (ev === 'SIGNED_OUT' && auth.user) { auth.user = null; try { localStorage.removeItem(KEY); } catch (e) { /* */ } location.reload(); }
    if (ev === 'SIGNED_IN' && session?.user && !auth.user) startAccount(session.user);
  });
  const { data } = await sb.auth.getSession();
  auth.ready = true;
  if (data?.session?.user) startAccount(data.session.user);
  else if (!localFlag('listo-noauth')) showAuth();
  if (ui.view.type === 'prefs') render();
}
const localFlag = (k, v) => { try { if (v === undefined) return localStorage.getItem(k) === '1'; if (v) localStorage.setItem(k, '1'); else localStorage.removeItem(k); } catch (e) { return false; } };
function startAccount(user) {
  if (auth.user) return;
  auth.user = user;
  localFlag('listo-noauth', false);
  hideAuth();
  // inne konto niż ostatnio na tym urządzeniu → nie mieszamy danych
  try {
    const last = localStorage.getItem('listo-last-user');
    if (last && last !== user.id) { state = normalizeState(seed()); persist(); render(); }
    localStorage.setItem('listo-last-user', user.id);
  } catch (e) { /* */ }
  attachRef(supaRef(auth.sb, user.id));
  if (ui.view.type === 'prefs') render();
}
// adapter w tym samym kształcie co baza claude.ai: set() + onSnapshot()
function supaRef(sb, uid) {
  const T = 'listo_state';
  return {
    async set(doc) {
      const { error } = await sb.from(T).upsert({ user_id: uid, state: doc.state, client: doc.client, rev: doc.rev, saved_at: new Date(doc.savedAt).toISOString() });
      if (error) throw Object.assign(new Error(error.message), { code: 'unavailable' });
    },
    onSnapshot(cb, onErr) {
      let busy = false, again = false;
      const emit = row => cb({ exists: !!row, data: () => row ? { state: row.state, client: row.client, rev: row.rev, savedAt: Date.parse(row.saved_at) } : null, metadata: { fromCache: false, hasPendingWrites: false } });
      const fetchRow = async () => {
        if (busy) { again = true; return; }
        busy = true;
        const { data, error } = await sb.from(T).select('state, client, rev, saved_at').eq('user_id', uid).maybeSingle();
        busy = false;
        if (error) onErr(error); else emit(data);
        if (again) { again = false; fetchRow(); }
      };
      fetchRow();
      sb.channel('listo-' + uid).on('postgres_changes', { event: '*', schema: 'public', table: T, filter: `user_id=eq.${uid}` }, () => fetchRow()).subscribe();
      document.addEventListener('visibilitychange', () => { if (!document.hidden) fetchRow(); });
      addEventListener('online', () => { fetchRow(); if (sync.ready) pushRemote(); });
      setInterval(() => { if (sync.status === 'offline') { fetchRow(); if (sync.ready) pushRemote(); } }, 20000);
    },
  };
}
async function signOut() {
  if (!auth.sb) return;
  await pushRemote();
  try { localStorage.removeItem(KEY); localStorage.removeItem('listo-last-user'); } catch (e) { /* */ }
  auth.user = null;
  await auth.sb.auth.signOut();
  location.reload();
}

// ---------- ekran logowania ----------
function showAuth(mode = 'in') {
  let el = $('#auth');
  if (!el) { el = document.createElement('div'); el.id = 'auth'; document.body.appendChild(el); }
  el.dataset.mode = mode;
  el.innerHTML = `<div class="au-box">
    <div class="au-logo"><svg viewBox="0 0 64 64" aria-hidden="true"><rect x="4" y="4" width="56" height="56" rx="17" fill="var(--accent)"/><path d="M19 33.5l8.5 8.5L45.5 24" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
    <h1>${mode === 'up' ? 'Załóż konto w Listo' : mode === 'reset' ? 'Odzyskaj hasło' : 'Witaj w Listo'}</h1>
    <p class="au-p">${mode === 'reset' ? 'Wyślemy Ci link do ustawienia nowego hasła.' : 'Twoje zadania będą zsynchronizowane na komputerze i telefonie. Każde konto ma swoje, prywatne zadania.'}</p>
    ${mode === 'reset' ? '' : `<div class="au-tabs"><button class="${mode === 'in' ? 'sel' : ''}" data-au="in">Logowanie</button><button class="${mode === 'up' ? 'sel' : ''}" data-au="up">Rejestracja</button></div>`}
    <form class="au-form" novalidate>
      ${mode === 'up' ? '<label><span>Imię</span><input name="name" autocomplete="given-name" maxlength="40" placeholder="Jak mamy się do Ciebie zwracać?"></label>' : ''}
      <label><span>E-mail</span><input name="email" type="email" autocomplete="email" required placeholder="ty@przyklad.pl"></label>
      ${mode === 'reset' ? '' : `<label><span>Hasło</span><input name="pass" type="password" autocomplete="${mode === 'up' ? 'new-password' : 'current-password'}" required minlength="6" placeholder="${mode === 'up' ? 'Co najmniej 6 znaków' : 'Twoje hasło'}"></label>`}
      <div class="au-msg" role="status"></div>
      <button class="btn primary au-go" type="submit">${mode === 'up' ? 'Załóż konto' : mode === 'reset' ? 'Wyślij link' : 'Zaloguj się'}</button>
    </form>
    ${mode === 'in' ? '<button class="link-btn au-link" data-au="reset">Nie pamiętasz hasła?</button>' : mode === 'reset' ? '<button class="link-btn au-link" data-au="in">Wróć do logowania</button>' : ''}
    <div class="au-sep"><span>lub</span></div>
    <button class="btn ghost au-local" data-au="local">Używaj bez konta – tylko na tym urządzeniu</button>
  </div>`;
  const form = $('.au-form', el), msg = $('.au-msg', el), go = $('.au-go', el);
  const say = (t, ok) => { msg.textContent = t; msg.classList.toggle('ok', !!ok); };
  el.onclick = e => {
    const b = e.target.closest('[data-au]');
    if (!b) return;
    if (b.dataset.au === 'local') { localFlag('listo-noauth', true); hideAuth(); toast('Pracujesz bez konta. Zalogujesz się w każdej chwili w Ustawieniach.'); return; }
    showAuth(b.dataset.au);
  };
  form.onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(form), email = String(f.get('email') || '').trim(), pass = String(f.get('pass') || '');
    if (!/^\S+@\S+\.\S+$/.test(email)) return say('Podaj poprawny adres e-mail.');
    if (mode !== 'reset' && pass.length < 6) return say('Hasło musi mieć co najmniej 6 znaków.');
    go.disabled = true; say('Chwileczkę…', true);
    try {
      const redirect = CFG.siteUrl || (location.protocol.startsWith('http') ? location.origin + location.pathname : undefined);
      if (mode === 'in') {
        const { error } = await auth.sb.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
      } else if (mode === 'up') {
        const name = String(f.get('name') || '').trim();
        const { data, error } = await auth.sb.auth.signUp({ email, password: pass, options: { emailRedirectTo: redirect } });
        if (error) throw error;
        if (name) { state.settings.userName = name; save(); }
        if (!data.session) { say('Gotowe! Sprawdź skrzynkę e-mail i kliknij link potwierdzający, a potem zaloguj się tutaj.', true); go.disabled = false; return; }
      } else {
        const { error } = await auth.sb.auth.resetPasswordForEmail(email, { redirectTo: redirect });
        if (error) throw error;
        say('Wysłano link – sprawdź skrzynkę e-mail.', true); go.disabled = false; return;
      }
    } catch (err) {
      go.disabled = false;
      const m = String(err?.message || '');
      say(/invalid login/i.test(m) ? 'Nieprawidłowy e-mail lub hasło.' : /already registered/i.test(m) ? 'To konto już istnieje – zaloguj się.' : /not confirmed/i.test(m) ? 'Najpierw potwierdź adres – kliknij link w e-mailu.' : /fetch|network/i.test(m) ? 'Brak połączenia z serwerem.' : 'Nie udało się: ' + m);
    }
  };
  setTimeout(() => $('input', form)?.focus(), 60);
}
function hideAuth() { const el = $('#auth'); if (!el) return; el.classList.add('out'); setTimeout(() => el.remove(), 300); }
function newPasswordDialog() {
  openDialog({ title: 'Ustaw nowe hasło', submit: 'Zapisz hasło', fields: [{ key: 'pass', label: 'Nowe hasło (co najmniej 6 znaków)', required: true }], onSubmit: v => {
    if (v.pass.length < 6) { alertField('pass', 'Co najmniej 6 znaków'); return false; }
    auth.sb.auth.updateUser({ password: v.pass }).then(({ error }) => toast(error ? 'Nie udało się zmienić hasła' : 'Hasło zmienione ✓'));
  } });
}
function accountRows() {
  if (CFG.supabaseUrl && CFG.supabaseKey) {
    if (auth.user) return prefRow('Zalogowano', esc(auth.user.email || ''), `<button class="btn sm" data-act="acc-out">Wyloguj</button>`)
      + prefRow('Synchronizacja', SYNC_LABEL[sync.status], `<span class="acc-dot" data-s="${sync.status}"></span>`);
    return prefRow('Konto', auth.ready ? 'Nie zalogowano – zadania są tylko na tym urządzeniu' : 'Łączenie z serwerem…', auth.ready ? `<button class="btn sm primary" data-act="acc-in">Zaloguj się</button>` : '');
  }
  if (window.claude?.use) return prefRow('Synchronizacja', 'Przez Twoje konto claude.ai', `<span class="acc-dot" data-s="${sync.status}"></span>`);
  return prefRow('Synchronizacja', 'Wyłączona – uzupełnij config.js (patrz INSTRUKCJA.md)', '');
}
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]')?.dataset.act;
  if (a === 'acc-out') confirmDlg('Wylogować się?', 'Zadania zostaną bezpiecznie zapisane na koncie i usunięte z tego urządzenia.', 'Wyloguj', signOut);
  if (a === 'acc-in') { localFlag('listo-noauth', false); showAuth(); }
  if (a === 'acc-export') exportData();
  if (a === 'acc-import') importData();
});

// ---------- instalowalna aplikacja (telefon / komputer) ----------
if ('serviceWorker' in navigator && location.protocol === 'https:' && window.top === window && !location.hostname.endsWith('claude.ai')) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { /* */ }));
}
let installEvt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (ui.view.type === 'prefs') render(); });
document.addEventListener('click', async e => {
  if (!e.target.closest('[data-act="pwa-install"]') || !installEvt) return;
  installEvt.prompt();
  await installEvt.userChoice.catch(() => null);
  installEvt = null; render();
});
// ================================================================
//  v12 – kolejność menu, sekcje projektów, kafelki Startu, Nadchodzące, Kalendarz,
//        nowe Ustawienia, Karma, Kalendarz Google, interfejs na telefon
// ================================================================
Object.assign(I, {
  grip: sv('<circle cx="9" cy="6" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="18" r="1.3"/>', 16),
  up: sv('<path d="M6 14l6-6 6 6"/>', 16),
  down: sv('<path d="M6 10l6 6 6-6"/>', 16),
  star: sv('<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.8z"/>', 18),
  google: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z"/><path fill="#FBBC05" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2z"/><path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.4L6.4 10c.8-2.3 3-4.1 5.6-4.1z"/></svg>',
});

// ---------- menu boczne: definicje, kolejność, widoczność ----------
const NAV_DEF = {
  search: { label: 'Szukaj', icon: () => I.search },
  home: { label: 'Start', icon: () => I.home },
  inbox: { label: 'Skrzynka', icon: () => I.inbox, count: (a, c) => c.inbox },
  today: { label: 'Dziś', icon: () => todayIcon(), count: (a, c) => c.today },
  upcoming: { label: 'Nadchodzące', icon: () => I.upcoming },
  calendar: { label: 'Kalendarz', icon: () => I.calMonth },
  matrix: { label: 'Matryca', icon: () => I.matrix },
  filters: { label: 'Filtry i etykiety', icon: () => I.filters },
  reports: { label: 'Raportowanie', icon: () => I.pulse },
  focus: { label: 'Skupienie', icon: () => I.timer, count: () => focusBadge() },
  autoprio: { label: 'Auto-priorytety', icon: () => I.bolt, count: a => state.autoPrio.enabled ? (a.filter(t => t.autoSet != null).length || '✓') : '' },
  habits: { label: 'Nawyki', icon: () => I.habit, count: () => habitsLeftToday() || '' },
  completed: { label: 'Ukończone', icon: () => I.done, count: () => state.tasks.filter(t => t.completed).length },
};
function navOrder() {
  const o = (state.settings.navOrder || []).filter(k => NAV_DEF[k]);
  Object.keys(NAV_DEF).forEach(k => { if (!o.includes(k)) o.push(k); });
  return o;
}
function sbExpanded(id, set) {
  let a = [];
  try { a = JSON.parse(localStorage.getItem('listo-sb-exp') || '[]'); } catch (e) { /* */ }
  if (set === undefined) return a.includes(id);
  a = a.filter(x => x !== id); if (set) a.push(id);
  try { localStorage.setItem('listo-sb-exp', JSON.stringify(a)); } catch (e) { /* */ }
}

// ---------- kafelki Startu: własna kolejność ----------
function cardOrder(keys) {
  const o = state.settings.cardOrder || [];
  return [...keys].sort((a, b) => (o.indexOf(a) < 0 ? 99 + keys.indexOf(a) : o.indexOf(a)) - (o.indexOf(b) < 0 ? 99 + keys.indexOf(b) : o.indexOf(b)));
}
function moveCard(key, toKey, d) {
  const vis = $$('.hm-masonry .hm-card').map(c => c.dataset.card);
  const all = cardOrder([...new Set([...vis, ...(state.settings.cardOrder || [])])]);
  const i = all.indexOf(key);
  if (i < 0) return;
  all.splice(i, 1);
  let j = toKey ? all.indexOf(toKey) : i + d;
  j = Math.max(0, Math.min(all.length, j));
  all.splice(j, 0, key);
  state.settings.cardOrder = all;
  ui.quiet = true; ui.movedCard = key;
  commit();
}
let cardDrag = null;
document.addEventListener('dragstart', e => {
  const c = e.target.closest?.('.home.editing .hm-card');
  if (!c) return;
  cardDrag = c.dataset.card; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', cardDrag);
  requestAnimationFrame(() => c.classList.add('dragging'));
});
document.addEventListener('dragover', e => {
  if (!cardDrag) return;
  const c = e.target.closest('.hm-card');
  $$('.hm-card.drop-to').forEach(x => x !== c && x.classList.remove('drop-to'));
  if (c && c.dataset.card !== cardDrag) { e.preventDefault(); c.classList.add('drop-to'); }
});
document.addEventListener('drop', e => {
  if (!cardDrag) return;
  const c = e.target.closest('.hm-card'), k = cardDrag;
  cardDrag = null;
  if (!c || c.dataset.card === k) return;
  e.preventDefault(); moveCard(k, c.dataset.card);
});
document.addEventListener('dragend', () => { cardDrag = null; $$('.hm-card.drop-to, .hm-card.dragging').forEach(x => x.classList.remove('drop-to', 'dragging')); });

// ---------- Nadchodzące: pasek dat śledzi przewijanie ----------
function upStripDays(sws) {
  const td = todayStr(), act = active();
  return [...Array(7)].map((_, i) => addDays(sws, i)).map(d => `<button class="day-chip ${d === td ? 'today' : ''} ${d === ui.upCur ? 'cur' : ''}" data-act="up-day" data-date="${d}" ${d < td ? 'disabled' : ''}>
      <span>${PL_DAYS_SHORT[dow(d)]}</span><strong>${parseDate(d).getDate()}</strong>${act.some(t => t.due === d) || gcalEventsOn(d, 'gcalUp').length ? '<i class="dot"></i>' : ''}</button>`).join('');
}
function upTrack() {
  if (ui.view.type !== 'upcoming') return;
  const c = $('.content'), head = $('.up-head');
  if (!c || !head) return;
  const lim = head.getBoundingClientRect().bottom + 6;
  let cur = null;
  for (const g of $$('.group[id^="day-"]', c)) { if (g.getBoundingClientRect().bottom > lim) { cur = g.id.slice(4); break; } }
  if (!cur || cur === ui.upCur) return;
  ui.upCur = cur;
  const strip = $('.week-strip'), sws = weekStart(cur), old = ui.upStrip || ui.upStart;
  if (!strip) return;
  if (sws !== old) {
    ui.upStrip = sws;
    strip.innerHTML = upStripDays(sws);
    strip.classList.remove('sl', 'sr'); void strip.offsetWidth; strip.classList.add(sws > old ? 'sl' : 'sr');
    const md = parseDate(addDays(sws, 3)), t = $('.up-title');
    if (t) { t.textContent = `${PL_MON[md.getMonth()]} ${md.getFullYear()}`; t.classList.remove('flip'); void t.offsetWidth; t.classList.add('flip'); }
  } else $$('.day-chip', strip).forEach(b => b.classList.toggle('cur', b.dataset.date === cur));
}

// ---------- Karma (domyślnie wyłączona) ----------
const KARMA_LV = [[0, 'Początkujący', '🌱'], [300, 'Nowicjusz', '🌿'], [900, 'Uczeń', '📘'], [2000, 'Praktyk', '⚙️'], [4000, 'Profesjonalista', '💼'], [7500, 'Ekspert', '🎯'], [12500, 'Mistrz', '🏆'], [20000, 'Arcymistrz', '👑'], [32000, 'Oświecony', '✨']];
const K = () => state.karma || (state.karma = { points: 0, log: [], day: null });
function karmaLevel(p) {
  let i = 0; while (i + 1 < KARMA_LV.length && p >= KARMA_LV[i + 1][0]) i++;
  return { i, name: KARMA_LV[i][1], emo: KARMA_LV[i][2], cur: KARMA_LV[i][0], next: KARMA_LV[i + 1] ? KARMA_LV[i + 1][0] : null };
}
function karmaAdd(d, why, id, kind) {
  if (!state.settings.karma || !d) return;
  const k = K(), before = karmaLevel(k.points).i;
  k.points = Math.max(0, Math.round(k.points + d));
  k.log.unshift({ at: Date.now(), d: Math.round(d), why, id: id || null, kind });
  if (k.log.length > 400) k.log.length = 400;
  const after = karmaLevel(k.points).i;
  if (after > before) setTimeout(() => { celebrate(); toast(`${KARMA_LV[after][2]} Nowy poziom karmy: ${KARMA_LV[after][1]}!`); }, 700);
  else if (after < before) setTimeout(() => toast(`Karma spadła do poziomu: ${KARMA_LV[after][1]}`), 700);
}
function karmaOnDone(t) {
  if (!state.settings.karma) return;
  const td = todayStr(), lv = karmaLevel(K().points).i, mult = Math.max(.6, 1 - lv * .05);
  let p = 4 + (t.priority < 4 ? 4 - t.priority : 0);
  if (t.due) p += t.due >= td ? 3 : -2;
  karmaAdd(Math.max(1, p * mult), t.title, t.id, 'done');
}
function karmaOnUndo(t) {
  if (!state.settings.karma) return;
  const e = K().log.find(l => l.id === t.id && l.kind === 'done');
  if (e) karmaAdd(-e.d, `Cofnięto: ${t.title}`, t.id, 'undo');
}
function karmaDaily() {
  if (!state.settings.karma) return;
  const k = K(), td = todayStr();
  if (k.day === td) return;
  if (!k.day) { k.day = td; save(); return; }
  const yd = addDays(td, -1), lv = karmaLevel(k.points).i, pen = 1 + lv * .1, goal = state.settings.dailyGoal || 5;
  const byDay = {}; state.history.forEach(h => { const d = fmtDate(new Date(h.at)); byDay[d] = (byDay[d] || 0) + 1; });
  const done = byDay[yd] || 0;
  if (done >= goal) karmaAdd(10, 'Dzienny cel osiągnięty', null, 'goal');
  let streak = 0; for (let d = yd; (byDay[d] || 0) >= goal; d = addDays(d, -1)) streak++;
  if (streak >= 2) karmaAdd(Math.min(streak * 2, 20), `Seria ${streak} dni z celem`, null, 'streak');
  const created = state.tasks.filter(t => t.createdAt && fmtDate(new Date(t.createdAt)) === yd).length;
  if (created) karmaAdd(Math.min(created, 10), `Planowanie – dodano ${created} ${plural(created, 'zadanie', 'zadania', 'zadań')}`, null, 'add');
  const od = active().filter(t => t.due && t.due < td).length;
  if (od) karmaAdd(-Math.min(Math.round(od * 2 * pen), 30), `Zaległe zadania: ${od}`, null, 'overdue');
  if (!done) karmaAdd(-Math.round(3 * pen), 'Dzień bez ukończonego zadania', null, 'idle');
  k.day = td; save();
}
function karmaSpark(days = 14) {
  const td = todayStr(), per = [...Array(days)].map((_, i) => addDays(td, i - days + 1)).map(d => K().log.filter(l => fmtDate(new Date(l.at)) === d).reduce((a, l) => a + l.d, 0));
  const m = Math.max(1, ...per.map(Math.abs));
  return `<div class="k-spark">${per.map((v, i) => `<i class="${v < 0 ? 'neg' : ''}" style="--h:${Math.max(4, Math.abs(v) / m * 100).toFixed(0)}%;--d:${i}" title="${v > 0 ? '+' : ''}${v}"></i>`).join('')}</div>`;
}
function karmaCardBody() {
  const k = K(), L = karmaLevel(k.points), pct = L.next ? Math.round((k.points - L.cur) / (L.next - L.cur) * 100) : 100;
  return `<div class="k-head"><span class="k-emo">${L.emo}</span><div class="grow"><b>${L.name}</b><span class="muted small">${k.points} pkt${L.next ? ` · do następnego ${L.next - k.points}` : ' · najwyższy poziom'}</span></div></div>
    <div class="k-bar"><i style="--w:${pct}%"></i></div>${karmaSpark(10)}
    ${k.log.slice(0, 3).map(l => `<div class="k-log"><span class="${l.d < 0 ? 'neg' : 'pos'}">${l.d > 0 ? '+' : ''}${l.d}</span><span class="grow">${esc(l.why)}</span></div>`).join('')}`;
}

// ---------- Kalendarz Google ----------
const GC = { token: null, exp: 0, tc: null, cid: '' };
const gcalCid = () => (CFG.googleClientId || state.settings.gcalClientId || '').trim();
function gcalCache() { try { return JSON.parse(localStorage.getItem('listo-gcal') || '{}'); } catch (e) { return {}; } }
function gcalEventsOn(d, where) {
  if (!state.settings.gcalOn || (where && state.settings[where] === false)) return [];
  return (gcalCache().events || []).filter(e => e.date === d || (e.end && e.date < d && d < e.end)).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
}
function gcalPreload() {
  if (!gcalCid() || window.google?.accounts?.oauth2 || gcalPreload.busy) return;
  gcalPreload.busy = true;
  loadScript('https://accounts.google.com/gsi/client').then(() => { gcalPreload.busy = false; }).catch(() => { gcalPreload.busy = false; });
}
function gcalToken(cb) {
  const cid = gcalCid();
  if (!cid) { ui.prefTab = 'calendars'; setView({ type: 'prefs' }); toast('Najpierw wklej identyfikator klienta Google (Client ID)'); return; }
  if (GC.token && Date.now() < GC.exp) return cb();
  if (!window.google?.accounts?.oauth2) { gcalPreload(); toast('Łączę z Google… kliknij jeszcze raz za chwilę'); return; }
  if (!GC.tc || GC.cid !== cid) {
    GC.cid = cid;
    GC.tc = google.accounts.oauth2.initTokenClient({ client_id: cid, scope: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events', callback: () => {} });
  }
  GC.tc.callback = r => {
    if (r.error) { toast('Nie połączono z Google: ' + r.error); return; }
    GC.token = r.access_token; GC.exp = Date.now() + (Math.max(60, r.expires_in || 3600) - 60) * 1000;
    if (!state.settings.gcalOn) { state.settings.gcalOn = true; save(); }
    cb();
  };
  GC.tc.requestAccessToken({ prompt: state.settings.gcalOn ? '' : 'consent' });
}
async function gcalApi(path, opt = {}) {
  const r = await fetch('https://www.googleapis.com/calendar/v3/' + path, Object.assign({}, opt, { headers: Object.assign({ Authorization: 'Bearer ' + GC.token, 'Content-Type': 'application/json' }, opt.headers || {}) }));
  if (r.status === 401) { GC.token = null; throw new Error('Sesja Google wygasła – kliknij „Odśwież”'); }
  if (!r.ok) throw new Error('Google: ' + r.status);
  return r.json();
}
function gcalSync() {
  gcalToken(async () => {
    try {
      toast('Pobieram wydarzenia z Kalendarza Google…');
      const list = await gcalApi('users/me/calendarList?minAccessRole=reader');
      const cals = (list.items || []).filter(c => c.selected !== false);
      const tMin = new Date(Date.now() - 31 * 864e5).toISOString(), tMax = new Date(Date.now() + 120 * 864e5).toISOString();
      const events = [];
      for (const c of cals.slice(0, 12)) {
        const res = await gcalApi(`calendars/${encodeURIComponent(c.id)}/events?singleEvents=true&orderBy=startTime&maxResults=400&timeMin=${encodeURIComponent(tMin)}&timeMax=${encodeURIComponent(tMax)}`);
        (res.items || []).forEach(ev => {
          if (ev.status === 'cancelled') return;
          const all = !!ev.start?.date, sd = all ? ev.start.date : fmtDate(new Date(ev.start.dateTime)), ed = all ? ev.end?.date : null;
          events.push({ id: ev.id, title: ev.summary || '(bez tytułu)', date: sd, end: ed && diffDays(ed, sd) > 1 ? ed : null, time: all ? '' : nowHMof(ev.start.dateTime), endTime: all ? '' : nowHMof(ev.end?.dateTime), color: c.backgroundColor || '', cal: c.summary || '', link: ev.htmlLink || '' });
        });
      }
      localStorage.setItem('listo-gcal', JSON.stringify({ at: Date.now(), events, cals: cals.map(c => ({ name: c.summary, color: c.backgroundColor })) }));
      ui.quiet = true; render();
      toast(`📅 Zsynchronizowano ${events.length} ${plural(events.length, 'wydarzenie', 'wydarzenia', 'wydarzeń')} z ${cals.length} ${plural(cals.length, 'kalendarza', 'kalendarzy', 'kalendarzy')}`);
    } catch (e) { toast(String(e.message || e)); }
  });
}
const nowHMof = iso => { if (!iso) return ''; const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
function gcalAddTask(t) {
  gcalToken(async () => {
    try {
      const body = { summary: t.title, description: (t.description || '') + '\n\n— dodane z Listo' };
      if (t.time) { const s = new Date(`${t.due}T${t.time}:00`); body.start = { dateTime: s.toISOString() }; body.end = { dateTime: new Date(s.getTime() + 30 * 6e4).toISOString() }; }
      else { body.start = { date: t.due || todayStr() }; body.end = { date: addDays(t.due || todayStr(), 1) }; }
      const ev = await gcalApi('calendars/primary/events', { method: 'POST', body: JSON.stringify(body) });
      t.gcalId = ev.id; save(); toast('📅 Dodano do Kalendarza Google'); gcalSync();
    } catch (e) { toast(String(e.message || e)); }
  });
}
function gcalDisconnect() {
  try { if (GC.token && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(GC.token, () => {}); } catch (e) { /* */ }
  GC.token = null; state.settings.gcalOn = false;
  try { localStorage.removeItem('listo-gcal'); } catch (e) { /* */ }
  ui.quiet = true; commit(); toast('Odłączono Kalendarz Google');
}

// ---------- Kalendarz – nowy wygląd ----------
function calItems(d) {
  const ts = active().filter(t => t.due === d).sort(byDue);
  return { ts, ev: gcalEventsOn(d, 'gcalCal') };
}
function renderCalendar() {
  const td = todayStr(), mode = ui.calMode || 'month';
  const sel = ui.calSel || td;
  let title, grid = '';
  const navBtns = (act) => `<div class="cal2-nav"><button class="icon-btn" data-act="${act}" data-n="-1" title="Wstecz">${I.left}</button><button class="btn" data-act="${act}" data-n="0">Dziś</button><button class="icon-btn" data-act="${act}" data-n="1" title="Dalej">${I.right}</button></div>`;
  const chip = (t) => `<div class="cal2-chip" draggable="true" data-act="open" data-id="${t.id}" style="--c:var(--p${t.priority})" title="${esc(t.title)}"><i></i><span>${t.time ? `<b>${t.time}</b> ` : ''}${esc(t.title)}</span></div>`;
  const evChip = e => `<div class="cal2-chip ev" style="--c:${e.color || 'var(--qi-b)'}" title="${esc(e.cal + ': ' + e.title)}"><i></i><span>${e.time ? `<b>${e.time}</b> ` : ''}${esc(e.title)}</span></div>`;
  if (mode === 'week') {
    const ws = ui.calWeek || weekStart(td), days = [...Array(7)].map((_, i) => addDays(ws, i));
    const a = parseDate(ws), b = parseDate(days[6]);
    title = `${a.getDate()} ${PL_MON_SHORT[a.getMonth()]} – ${b.getDate()} ${PL_MON_SHORT[b.getMonth()]} ${b.getFullYear()}`;
    grid = `<div class="cal2-week">${days.map((d, i) => { const { ts, ev } = calItems(d); return `<div class="cal2-wcol ${d === td ? 'today' : ''} ${d === sel ? 'sel' : ''}" data-act="cal-day" data-date="${d}" data-drop="day" style="--i:${i}">
      <div class="cal2-wh"><span>${PL_DAYS_SHORT[dow(d)]}</span><b>${parseDate(d).getDate()}</b></div>
      <div class="cal2-wl">${ev.map(evChip).join('')}${ts.map(chip).join('') || (ev.length ? '' : '<span class="cal2-free">wolne</span>')}</div></div>`; }).join('')}</div>`;
  } else {
    const base = ui.calMonth || td.slice(0, 8) + '01', first = parseDate(base), y = first.getFullYear(), m = first.getMonth();
    title = `${PL_MON[m]} ${y}`;
    const start = weekStart(base), end = addDays(weekStart(fmtDate(new Date(y, m + 1, 0))), 6);
    let maxN = 1; for (let d = start; d <= end; d = addDays(d, 1)) maxN = Math.max(maxN, active().filter(t => t.due === d).length);
    let cells = '', i = 0;
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const { ts, ev } = calItems(d), n = ts.length + ev.length, w = dow(d);
      const items = [...ev.map(evChip), ...ts.map(chip)];
      if (w === 1 && state.settings.calWeekNums) cells += `<div class="cal2-wn">${isoWeek(d)}</div>`;
      cells += `<div class="cal2-cell ${parseDate(d).getMonth() === m ? '' : 'other'} ${d === td ? 'today' : ''} ${d === sel ? 'sel' : ''} ${w === 0 || w === 6 ? 'we' : ''} ${d < td ? 'past' : ''}" data-act="cal-day" data-date="${d}" data-drop="day" style="--i:${Math.min(i++, 41)};--load:${(ts.length / maxN).toFixed(2)}">
        <div class="cal2-top"><span class="cal2-num">${parseDate(d).getDate()}</span>${n ? `<span class="cal2-n">${n}</span>` : ''}</div>
        <div class="cal2-items">${items.slice(0, 3).join('')}${items.length > 3 ? `<span class="cal2-more">+${items.length - 3}</span>` : ''}</div>
        <div class="cal2-dots">${[...ev.map(e => `<i style="--c:${e.color || 'var(--qi-b)'}"></i>`), ...ts.map(t => `<i style="--c:var(--p${t.priority})"></i>`)].slice(0, 5).join('')}</div></div>`;
    }
    grid = `<div class="cal2-wd ${state.settings.calWeekNums ? 'wn' : ''}">${state.settings.calWeekNums ? '<span></span>' : ''}${['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'].map(x => `<span>${x}</span>`).join('')}</div><div class="cal2-month ${state.settings.calWeekNums ? 'wn' : ''}">${cells}</div>`;
  }
  const monthTasks = active().filter(t => t.due && (mode === 'week' ? false : t.due.slice(0, 7) === (ui.calMonth || td).slice(0, 7))).length;
  let html = header(`<span class="cal2-title">${title}</span>`, { icon: sz(I.calMonth, 24), iconCls: 'tile', barTitle: 'Kalendarz',
    sub: mode === 'month' ? `${monthTasks} ${plural(monthTasks, 'zadanie', 'zadania', 'zadań')} w tym miesiącu${state.settings.gcalOn ? ' · z Kalendarzem Google' : ''}` : 'Widok tygodnia',
    right: `<div class="seg-inline"><button class="${mode === 'month' ? 'sel' : ''}" data-act="cal-mode" data-v="month">Miesiąc</button><button class="${mode === 'week' ? 'sel' : ''}" data-act="cal-mode" data-v="week">Tydzień</button></div>${navBtns(mode === 'week' ? 'calw-nav' : 'cal-nav')}` });
  // panel wybranego dnia
  const { ts, ev } = calItems(sel), n = diffDays(sel, td), rel = n === 0 ? 'Dziś' : n === 1 ? 'Jutro' : n === -1 ? 'Wczoraj' : '';
  const sd = parseDate(sel);
  const agenda = `<aside class="cal2-agenda group" data-drop="day" data-date="${sel}">
    <div class="cal2-ah"><div class="cal2-big">${sd.getDate()}</div><div><b>${cap(PL_DAYS[sd.getDay()])}${rel ? ` · ${rel}` : ''}</b><span>${PL_MON[sd.getMonth()]} ${sd.getFullYear()} · ${ts.length} ${plural(ts.length, 'zadanie', 'zadania', 'zadań')}${ev.length ? ` · ${ev.length} ${plural(ev.length, 'wydarzenie', 'wydarzenia', 'wydarzeń')}` : ''}</span></div></div>
    ${ev.length ? `<div class="cal2-evs">${ev.map(e => `<a class="cal2-ev" ${e.link && /^https:\/\//.test(e.link) ? `href="${esc(e.link)}" target="_blank" rel="noopener"` : ''} style="--c:${e.color || 'var(--qi-b)'}"><span class="cal2-evt">${e.time ? `${e.time}${e.endTime ? '–' + e.endTime : ''}` : 'Cały dzień'}</span><span class="grow">${esc(e.title)}</span><span class="cal2-evc">${esc(e.cal)}</span></a>`).join('')}</div>` : ''}
    ${ts.map(t => taskRow(t, { showProject: true })).join('')}
    ${addTaskButton('day:' + sel, { due: sel })}
    ${!ts.length && !ev.length ? `<div class="cal2-empty">${sz(I.calMonth, 26)}<span>Brak planów na ten dzień</span></div>` : ''}
  </aside>`;
  html += `<div class="cal2 ${mode}"><div class="cal2-main">${grid}</div>${agenda}</div>`;
  return html;
}
function isoWeek(s) { const d = parseDate(s); d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7); const w1 = new Date(d.getFullYear(), 0, 4); return 1 + Math.round(((d - w1) / 864e5 - 3 + (w1.getDay() + 6) % 7) / 7); }

// ---------- Ustawienia z zakładkami ----------
const PREF_TABS = [['general', 'Ogólne', () => I.gear], ['theme', 'Motyw', () => I.moon], ['sidebar', 'Pasek boczny', () => I.sidebar], ['productivity', 'Produktywność', () => I.pulse], ['calendars', 'Kalendarze', () => I.calMonth], ['account', 'Konto', () => I.cloud]];
function renderPrefs() {
  const s = state.settings, tab = ui.prefTab || 'general';
  let html = header('Ustawienia', { icon: sz(I.gear, 24), iconCls: 'tile', sub: 'Domyślne wartości to obecny wygląd aplikacji – w każdej chwili możesz do nich wrócić.' });
  const sec = (i, title, body, extra = '') => `<section class="pf-card" style="--i:${i}"><h3>${title}${extra}</h3>${body}</section>`;
  let body = '';
  if (tab === 'general') {
    const cardOpts = [['next', 'Na teraz'], ['today', 'Dziś'], ['habits', 'Nawyki dziś'], ['week', 'Najbliższe 7 dni'], ['focus', 'Skupienie'], ['stats', 'Twój rytm'], ['proj', 'Projekty'], ['mx', 'Matryca'], ['done', 'Ostatnio ukończone'], ['karma', 'Karma'], ['events', 'Wydarzenia dziś']];
    body = sec(0, 'Profil', prefRow('Twoje imię', 'Widoczne w powitaniu', `<input class="pf-in" data-k="userName" value="${esc(s.userName || '')}" maxlength="40" aria-label="Imię">`)
      + prefRow('Widok po uruchomieniu', 'Co widzisz po otwarciu aplikacji', segBtns('startView', s.startView, [['home', 'Start'], ['today', 'Dziś'], ['inbox', 'Skrzynka'], ['upcoming', 'Plan']])))
      + sec(1, 'Lista zadań', prefRow('Gęstość listy', 'Odstępy między zadaniami', segBtns('density', s.density, [['compact', 'Zwarta'], ['normal', 'Normalna'], ['roomy', 'Przestronna']]))
      + prefRow('Opisy zadań na liście', 'Pierwsza linia opisu pod tytułem', swBtn(s.showDesc !== false, 'showDesc'))
      + prefRow('Dźwięki', 'Przy odhaczaniu i końcu sesji', swBtn(s.sound !== false, 'sound'))
      + prefRow('Skala interfejsu', 'Powiększ lub pomniejsz całą aplikację', segBtns('scale', s.scale, [[90, '90%'], [100, '100%'], [110, '110%'], [120, '120%']])))
      + sec(2, 'Animacje', prefRow('Animacje', 'Przejścia, wjazdy list, konfetti', segBtns('anim', s.anim, [['full', 'Pełne'], ['off', 'Wyłączone']]))
      + prefRow('Animacja przy uruchomieniu', '<button class="link-btn" data-act="splash-preview">Pokaż podgląd</button>', swBtn(s.splash !== false, 'splash'))
      + prefRow('Efekty po najechaniu', 'Podświetlenia i poświata pod kursorem', swBtn(s.hoverFx !== false, 'hoverFx')))
      + sec(3, 'Strona Start', `<p class="pf-p">Pokaż tylko potrzebne kafelki.</p><div class="pf-checks">${cardOpts.map(([k, l]) => `<button class="pf-chk ${(s.hiddenCards || []).includes(k) ? '' : 'on'}" data-act="pref-card" data-v="${k}"><span>${l}</span><i>${I.checkSmall}</i></button>`).join('')}</div>`
      + prefRow('Przestawianie kafelków', 'Pokazuje na Starcie przycisk „Ułóż kafelki”', swBtn(!!s.tileEdit, 'tileEdit'))
      + (s.cardOrder?.length ? prefRow('Kolejność kafelków', 'Wróć do układu domyślnego', `<button class="btn sm" data-act="card-reset">Przywróć</button>`) : ''))
      + sec(4, 'Dodawanie głosem', prefRow('Status', (dictNS || SpeechRec) ? '<span class="ok-txt">Rozpoznawanie mowy dostępne</span>' : 'Niedostępne w tym oknie', `<button class="btn sm" data-act="voice">${sz(I.mic, 14)} Wypróbuj</button>`)
      + prefRow('Dodawaj od razu', 'Po zakończeniu mówienia bez potwierdzania', swBtn(!!s.voiceAuto, 'voiceAuto')))
      + sec(5, 'Przywracanie', prefRow('Ustawienia domyślne', 'Wygląd i zachowanie jak na początku (zadania zostają)', `<button class="btn sm" data-act="pref-reset">Przywróć</button>`));
  } else if (tab === 'theme') {
    const cur = s.accent || 'todoist';
    body = sec(0, 'Tryb', `<div class="seg-inline th-modes">${[['dark', 'Ciemny'], ['light', 'Jasny'], ['auto', 'Systemowy']].map(([v, l]) => `<button class="${s.theme === v ? 'sel' : ''}" data-act="pref" data-k="theme" data-v="${v}"><span class="th-mp ${v}"><i></i><i></i><i></i></span><span>${l}</span></button>`).join('')}</div>`)
      + sec(1, 'Kolor motywu', `<div class="pf-sw th-grid">${ACCENTS.map(a => `<button class="${cur === a.id ? 'on' : ''}" data-act="pref" data-k="accent" data-v="${a.id}" style="--c:${a.color}"><span class="th-prev"><i class="sb"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="dot"></i></span><span class="th-n">${a.name}</span></button>`).join('')}</div>`)
      + sec(2, 'Wygląd menu', prefRow('Kolorowe ikony zakładek', 'Każda zakładka ma własny kolor', swBtn(s.navColors !== false, 'navColors')));
  } else if (tab === 'sidebar') {
    const ord = navOrder(), hid = s.hiddenNav || [];
    body = sec(0, 'Zakładki w menu', `<p class="pf-p">Zmieniaj kolejność strzałkami lub przeciągając uchwyt. Przełącznik ukrywa zakładkę – ukryte nadal otworzysz z palety (Ctrl+K).</p>
      <div class="nv-list">${ord.map((k, i) => `<div class="nv-row ${hid.includes(k) ? 'off' : ''} ${ui.navMoved === k ? 'moved' : ''}" draggable="true" data-nv="${k}" style="--nc:${NAV_HUE[k] || 'var(--accent)'}">
        <span class="nv-grip" title="Przeciągnij">${I.grip}</span><span class="nv-ic">${NAV_DEF[k].icon()}</span><span class="grow">${NAV_DEF[k].label}</span>
        <button class="icon-btn" data-act="nav-mv" data-k="${k}" data-d="-1" ${i === 0 ? 'disabled' : ''} title="Wyżej">${I.up}</button><button class="icon-btn" data-act="nav-mv" data-k="${k}" data-d="1" ${i === ord.length - 1 ? 'disabled' : ''} title="Niżej">${I.down}</button>
        <button class="switch ${hid.includes(k) ? '' : 'on'}" data-act="nav-vis" data-k="${k}" role="switch" aria-checked="${!hid.includes(k)}" aria-label="Pokaż ${NAV_DEF[k].label}"><i></i></button></div>`).join('')}</div>
      <div class="pf-actions"><button class="btn sm" data-act="nav-reset">Przywróć domyślną kolejność</button></div>`)
      + sec(1, 'Wygląd', prefRow('Liczniki zadań', 'Liczby przy zakładkach i projektach', swBtn(s.navCounts !== false, 'navCounts'))
      + prefRow('Kolorowe ikony', 'Każda zakładka w swoim kolorze', swBtn(s.navColors !== false, 'navColors')));
    ui.navMoved = null;
  } else if (tab === 'productivity') {
    const k = K(), L = karmaLevel(k.points);
    body = sec(0, 'Cele', prefRow('Dzienny cel', 'Ile zadań chcesz kończyć dziennie', stepper('dailyGoal', s.dailyGoal || 5, 1))
      + prefRow('Konfetti', 'Po osiągnięciu dziennego celu', swBtn(s.confetti !== false, 'confetti'))
      + prefRow('Auto-priorytety', state.autoPrio.enabled ? 'Włączone' : 'Wyłączone', `<button class="btn sm" data-act="nav" data-view="autoprio">Otwórz</button>`))
      + sec(1, 'Skupienie (Pomodoro)', prefRow('Sesja pracy', '', stepper('pomo', s.pomo[0], 5, 'data-i="0"', ' min')) + prefRow('Krótka przerwa', '', stepper('pomo', s.pomo[1], 1, 'data-i="1"', ' min')) + prefRow('Długa przerwa', 'Co 4 sesje', stepper('pomo', s.pomo[2], 5, 'data-i="2"', ' min')))
      + sec(2, 'Matryca', prefRow('Zadanie jest „pilne”, gdy termin wypada…', '', segBtns('mxDays', s.mxDays ?? 2, [[0, 'dziś'], [1, '1 d'], [2, '2 d'], [3, '3 d'], [7, '7 d']])))
      + sec(3, `${sz(I.star, 16)} Karma`, prefRow('Śledzenie karmy', 'Punkty za systematyczność – domyślnie wyłączone', swBtn(!!s.karma, 'karma'))
      + (s.karma ? `<div class="k-panel">${karmaCardBody()}<div class="k-ladder">${KARMA_LV.map(([p, n, e], i) => `<span class="${i === L.i ? 'cur' : i < L.i ? 'got' : ''}" title="${p} pkt">${e} ${n}<small>${p}</small></span>`).join('')}</div>
        <div class="pf-actions"><button class="btn sm" data-act="karma-reset">Wyzeruj karmę</button></div></div>` : '')
      + `<details class="k-rules" ${s.karma ? '' : 'open'}><summary>Jak działa karma?</summary>
        <p>Karma to licznik Twojej systematyczności. Rośnie, gdy robisz rzeczy na czas, i spada, gdy zadania zalegają. Kolejne poziomy wymagają coraz więcej punktów, a na wyższych poziomach nagrody są nieco mniejsze, a kary nieco większe.</p>
        <table class="kbd-table"><tr><td><b class="pos">+4</b> + priorytet (do +3)</td><td>ukończenie zadania (P1 daje +3, P2 +2, P3 +1)</td></tr>
        <tr><td><b class="pos">+3</b></td><td>zadanie ukończone w terminie lub przed nim</td></tr><tr><td><b class="neg">−2</b></td><td>zadanie ukończone po terminie (wciąż na plus)</td></tr>
        <tr><td><b class="pos">+10</b></td><td>osiągnięty dzienny cel (liczone następnego dnia)</td></tr><tr><td><b class="pos">+2 × dni</b> (do +20)</td><td>seria dni z osiągniętym celem</td></tr>
        <tr><td><b class="pos">+1</b> za zadanie (do +10)</td><td>planowanie – zadania dodane danego dnia</td></tr>
        <tr><td><b class="neg">−2</b> za zadanie (do −30)</td><td>każde zadanie po terminie, liczone raz dziennie</td></tr><tr><td><b class="neg">−3</b></td><td>dzień bez żadnego ukończonego zadania</td></tr>
        <tr><td>cofnięcie</td><td>odznaczenie ukończonego zadania odbiera przyznane za nie punkty</td></tr></table>
        <p class="muted small">Poziomy: ${KARMA_LV.map(([p, n]) => `${n} (${p})`).join(' → ')}. Na każdym kolejnym poziomie punkty za zadania są mniejsze o 5% (najwyżej o 40%), a kary większe o 10%.</p></details>`);
  } else if (tab === 'calendars') {
    const c = gcalCache(), on = !!s.gcalOn, cid = gcalCid();
    gcalPreload();
    body = sec(0, `${I.google} Kalendarz Google`, on
      ? prefRow('Połączono', c.at ? `Ostatnia synchronizacja: ${fmtDateTime(c.at)} · ${(c.events || []).length} wydarzeń` : 'Kliknij „Odśwież”, aby pobrać wydarzenia', `<div style="display:flex;gap:6px"><button class="btn sm primary" data-act="gcal-sync">Odśwież</button><button class="btn sm" data-act="gcal-off">Odłącz</button></div>`)
        + (c.cals?.length ? `<div class="gc-cals">${c.cals.map(k => `<span style="--c:${k.color || 'var(--qi-b)'}"><i></i>${esc(k.name)}</span>`).join('')}</div>` : '')
      : prefRow('Wydarzenia z Google w Listo', cid ? 'Zobaczysz swoje spotkania w Kalendarzu, Nadchodzących i na Starcie' : 'Wymaga jednorazowej konfiguracji (instrukcja poniżej)', `<button class="btn sm primary" data-act="gcal-sync">${I.google} Połącz</button>`))
      + sec(1, 'Gdzie pokazywać wydarzenia', prefRow('W Kalendarzu', '', swBtn(s.gcalCal !== false, 'gcalCal')) + prefRow('W Nadchodzących', '', swBtn(s.gcalUp !== false, 'gcalUp')) + prefRow('Na Starcie i w Dziś', '', swBtn(s.gcalToday !== false, 'gcalToday'))
        + prefRow('Numery tygodni', 'W widoku miesiąca', swBtn(!!s.calWeekNums, 'calWeekNums')))
      + sec(2, 'Konfiguracja (jednorazowo)', `${prefRow('Identyfikator klienta Google', 'OAuth Client ID – zaczyna się od cyfr, kończy na .apps.googleusercontent.com', `<input class="pf-in wide" data-k="gcalClientId" value="${esc(s.gcalClientId || '')}" placeholder="123…apps.googleusercontent.com" spellcheck="false" aria-label="Client ID">`)}
        <ol class="gc-steps"><li>Wejdź na <b>console.cloud.google.com</b> → utwórz projekt „Listo”.</li><li><b>APIs &amp; Services → Library</b> → włącz <b>Google Calendar API</b>.</li>
        <li><b>OAuth consent screen</b> → typ <i>External</i>, nazwa „Listo”, Twój e-mail; w <i>Test users</i> dodaj adresy osób, które będą łączyć kalendarz.</li>
        <li><b>Credentials → Create credentials → OAuth client ID</b> → typ <i>Web application</i>; w <i>Authorized JavaScript origins</i> dodaj adres swojej strony (np. <code>https://dasiek07.github.io</code>).</li>
        <li>Skopiuj <b>Client ID</b> i wklej go powyżej, potem kliknij „Połącz”.</li></ol>
        <p class="muted small">Listo prosi tylko o dostęp do kalendarza. Wydarzenia są zapisywane wyłącznie na tym urządzeniu; zadanie możesz wysłać do Google przyciskiem w oknie zadania. Połączenie działa na stronie i w aplikacji na telefonie; w aplikacji Windows okno logowania Google może się nie otworzyć – wtedy połącz kalendarz na stronie.</p>`);
  } else {
    body = sec(0, 'Konto i synchronizacja', accountRows())
      + sec(1, 'Urządzenia', (installEvt ? prefRow('Zainstaluj aplikację', 'Własne okno i ikona – bez paska przeglądarki', `<button class="btn sm primary" data-act="pwa-install">Zainstaluj</button>`) : '')
        + prefRow('Telefon', 'Otwórz stronę Listo i wybierz „Zainstaluj aplikację” (Android) lub „Do ekranu początkowego” (iPhone)', '')
        + prefRow('Przenieś zadania', 'Kopiuj z jednego miejsca, wklej w drugim', `<div style="display:flex;gap:6px"><button class="btn sm" data-act="acc-export">Kopiuj</button><button class="btn sm" data-act="acc-import">Wklej</button></div>`));
  }
  html += `<div class="pf2"><nav class="pf2-tabs" role="tablist">${PREF_TABS.map(([k, l, ic]) => `<button role="tab" class="${tab === k ? 'sel' : ''}" data-act="pref-tab" data-t="${k}">${sz(ic(), 17)}<span>${l}</span></button>`).join('')}</nav>
    <div class="pf2-body" data-tab="${tab}">${body}</div></div>`;
  return html;
}
// przeciąganie zakładek w Ustawieniach → Pasek boczny
let nvDrag = null;
document.addEventListener('dragstart', e => { const r = e.target.closest?.('.nv-row'); if (!r) return; nvDrag = r.dataset.nv; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', nvDrag); requestAnimationFrame(() => r.classList.add('dragging')); });
document.addEventListener('dragover', e => { if (!nvDrag) return; const r = e.target.closest('.nv-row'); $$('.nv-row.drop-to').forEach(x => x !== r && x.classList.remove('drop-to')); if (r && r.dataset.nv !== nvDrag) { e.preventDefault(); r.classList.add('drop-to'); } });
document.addEventListener('drop', e => { if (!nvDrag) return; const r = e.target.closest('.nv-row'), k = nvDrag; nvDrag = null; if (!r || r.dataset.nv === k) return; e.preventDefault(); const o = navOrder().filter(x => x !== k); o.splice(o.indexOf(r.dataset.nv), 0, k); state.settings.navOrder = o; ui.navMoved = k; ui.quiet = true; commit(); });
document.addEventListener('dragend', () => { nvDrag = null; $$('.nv-row.drop-to, .nv-row.dragging').forEach(x => x.classList.remove('drop-to', 'dragging')); });

// ---------- dolny pasek na telefonie ----------
function renderTabbar() {
  let tb = $('#tabbar');
  if (!tb) { tb = document.createElement('nav'); tb.id = 'tabbar'; tb.setAttribute('aria-label', 'Nawigacja'); document.body.appendChild(tb); }
  const td = todayStr(), n = active().filter(t => t.due && t.due <= td).length, v = ui.view.type;
  const items = [['home', I.home, 'Start'], ['today', todayIcon(), 'Dziś'], ['upcoming', I.upcoming, 'Plan'], ['search', I.search, 'Szukaj']];
  tb.innerHTML = items.map(([k, ic, l]) => `<button class="${v === k && !ui.sidebar ? 'on' : ''}" data-act="nav" data-view="${k}" aria-label="${l}"><span class="tb-ic">${ic}${k === 'today' && n ? `<b>${n > 99 ? '99+' : n}</b>` : ''}</span><span class="tb-l">${l}</span></button>`).join('')
    + `<button class="${ui.sidebar && isNarrow() ? 'on' : ''}" data-act="tb-more" aria-label="Menu"><span class="tb-ic">${I.menu}</span><span class="tb-l">Menu</span></button>`;
}
// gest: przesuń od lewej krawędzi, by otworzyć menu; w lewo, by zamknąć
(() => {
  let sx = 0, sy = 0, mode = null;
  document.addEventListener('touchstart', e => {
    if (!isNarrow() || e.touches.length !== 1) return;
    const t = e.touches[0]; sx = t.clientX; sy = t.clientY;
    mode = !ui.sidebar && sx < 22 ? 'open' : ui.sidebar && e.target.closest('#sidebar, .sb-backdrop') ? 'close' : null;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (!mode) return;
    const t = e.changedTouches[0], dx = t.clientX - sx, dy = Math.abs(t.clientY - sy);
    if (mode === 'open' && dx > 60 && dy < 60) { ui.sidebar = true; render(); }
    if (mode === 'close' && dx < -60 && dy < 60) { ui.sidebar = false; render(); }
    mode = null;
  }, { passive: true });
})();
// delikatna wibracja przy odhaczaniu na telefonie
document.addEventListener('click', e => { if (e.target.closest('.check[data-act="toggle"], .hb-today, .hb-d, .hm-hb-i') && navigator.vibrate && matchMedia('(pointer: coarse)').matches) navigator.vibrate(12); }, true);

// ---------- wejście aplikacji po animacji startowej ----------
function launchIntroPrep() {
  const h1 = $('.hm-greet h1');
  if (h1 && !h1.dataset.split) {
    h1.dataset.split = '1';
    let n = 0;
    const walk = node => [...node.childNodes].forEach(c => {
      if (c.nodeType === 3) {
        const frag = document.createDocumentFragment();
        c.textContent.split(/(\s+)/).forEach(w => {
          if (!w) return;
          if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(w)); return; }
          const ws = document.createElement('span'); ws.className = 'lw';
          [...w].forEach(ch => { const s = document.createElement('span'); s.className = 'lc'; s.textContent = ch; s.style.setProperty('--c', n++); ws.appendChild(s); });
          frag.appendChild(ws);
        });
        c.replaceWith(frag);
      } else walk(c);
    });
    walk(h1);
  }
  const cx = innerWidth / 2, by = innerHeight;
  $$('.hm-card').forEach((c, i) => {
    const r = c.getBoundingClientRect();
    c.style.setProperty('--dx', Math.round(cx - (r.left + r.width / 2)) + 'px');
    c.style.setProperty('--dy', Math.round(by - r.top) + 'px');
    c.style.setProperty('--rot', ((i % 2 ? 1 : -1) * (5 + (i % 4) * 3)) + 'deg');
  });
  $$('#sidebar > *, #sidebar .nav-item').forEach((el, i) => el.style.setProperty('--n', Math.min(i, 22)));
  $$('#tabbar button').forEach((el, i) => el.style.setProperty('--n', i));
}

// ---------- po każdym rysowaniu ----------
const baseRender = render;
render = function () {
  const app = $('#app');
  // rysowanie w trakcie wejścia po starcie nie może odtworzyć animacji od nowa
  if (app.classList.contains('launch') && !app.classList.contains('launch-wait')) app.classList.remove('launch');
  karmaDaily();
  baseRender();
  renderTabbar();
  document.documentElement.classList.toggle('no-nav-counts', state.settings.navCounts === false);
  const v = ui.view.type, content = $('.content');
  if (v === 'upcoming' && content) {
    let last = 0, tm = 0;
    content.addEventListener('scroll', () => {
      const now = Date.now();
      if (now - last > 50) { last = now; upTrack(); }
      clearTimeout(tm); tm = setTimeout(upTrack, 80);
    }, { passive: true });
    upTrack();
  }
  if (ui.movedCard) { const c = $(`.hm-card[data-card="${ui.movedCard}"]`); c?.classList.add('moved'); c?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); ui.movedCard = null; }
  // odznaka poziomu karmy przy imieniu
  const u = $('#sidebar .user');
  if (u && state.settings.karma) { const L = karmaLevel(K().points); u.insertAdjacentHTML('beforeend', `<span class="k-badge" title="Karma: ${L.name} · ${K().points} pkt">${L.emo}</span>`); }
  // „Dodaj do Kalendarza Google” w oknie zadania
  const side = $('#modal-root .tm-side'), mt = ui.modal?.id && task(ui.modal.id);
  if (side && mt && state.settings.gcalOn && !mt.completed && !$('.gc-add', side)) side.insertAdjacentHTML('beforeend', `<div class="side-field gc-add"><label>Kalendarz Google</label><button class="side-btn" data-act="gcal-add" data-id="${mt.id}">${I.google} ${mt.gcalId ? 'Dodano – dodaj ponownie' : 'Dodaj do kalendarza'}</button></div>`);
};

// ---------- kliknięcia ----------
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.closest('#popover') || el.closest('#dialog-root')) return;
  const a = el.dataset.act;
  switch (a) {
    case 'sb-exp': e.stopPropagation(); sbExpanded(el.dataset.id, !sbExpanded(el.dataset.id)); renderSidebar(); break;
    case 'sb-sec': {
      const pid = el.dataset.pid, sid = el.dataset.sid;
      ui.modal = null;
      if (!(ui.view.type === 'project' && ui.view.id === pid)) setView({ type: 'project', id: pid });
      setTimeout(() => { const s = $(`.section[data-sid="${sid}"]`); if (s) { s.scrollIntoView({ block: 'start', behavior: 'smooth' }); s.classList.remove('flash-sec'); void s.offsetWidth; s.classList.add('flash-sec'); } }, 120);
      break;
    }
    case 'home-edit': ui.homeEdit = !ui.homeEdit; ui.quiet = true; render(); if (!ui.homeEdit) toast('Zapisano układ kafelków'); break;
    case 'card-mv': e.stopPropagation(); moveCard(el.dataset.k, null, +el.dataset.d); break;
    case 'card-reset': state.settings.cardOrder = []; ui.quiet = true; commit(); toast('Przywrócono domyślny układ kafelków'); break;
    case 'pref-tab': ui.prefTab = el.dataset.t; ui.stagger = true; render(); $('.content') && ($('.content').scrollTop = 0); break;
    case 'pref-open': ui.prefTab = el.dataset.t; setView({ type: 'prefs' }); break;
    case 'nav-mv': { const k = el.dataset.k, o = navOrder(), i = o.indexOf(k), j = i + +el.dataset.d; if (j < 0 || j >= o.length) break; o.splice(i, 1); o.splice(j, 0, k); state.settings.navOrder = o; ui.navMoved = k; ui.quiet = true; commit(); break; }
    case 'nav-vis': { const k = el.dataset.k, h = new Set(state.settings.hiddenNav || []); h.has(k) ? h.delete(k) : h.add(k); state.settings.hiddenNav = [...h]; el.classList.toggle('on', !h.has(k)); el.closest('.nv-row')?.classList.toggle('off', h.has(k)); save(); renderSidebar(); break; }
    case 'nav-reset': state.settings.navOrder = []; state.settings.hiddenNav = []; ui.quiet = true; commit(); toast('Przywrócono domyślne menu'); break;
    case 'karma-reset': confirmDlg('Wyzerować karmę?', 'Punkty i historia karmy zostaną usunięte. Zadania pozostają bez zmian.', 'Wyzeruj', () => { state.karma = { points: 0, log: [], day: todayStr() }; ui.quiet = true; commit(); }); break;
    case 'gcal-sync': gcalSync(); break;
    case 'gcal-off': gcalDisconnect(); break;
    case 'gcal-add': gcalAddTask(task(el.dataset.id)); break;
    case 'cal-mode': ui.calMode = el.dataset.v; if (ui.calMode === 'week') ui.calWeek = weekStart(ui.calSel || todayStr()); ui.stagger = true; render(); break;
    case 'calw-nav': { const n = +el.dataset.n; ui.calWeek = n ? addDays(ui.calWeek || weekStart(todayStr()), 7 * n) : weekStart(todayStr()); if (!n) ui.calSel = todayStr(); ui.stagger = true; render(); break; }
    case 'tb-more': ui.sidebar = !ui.sidebar; render(); break;
  }
});
if (state.settings.gcalOn) setTimeout(gcalPreload, 4000);
render();
save();
initSync();
requestAnimationFrame(() => requestAnimationFrame(() => $('#app').classList.add('ready')));
})();
