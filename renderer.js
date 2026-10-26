'use strict';

// ===================== 색상 (color.txt) =====================
const THEMES = {
  light: {
    bg: '#F5F0E1', floor: '#D4B38C', floor_grain: '#BF9C74',
    border: '#9A7352', text: '#4E4A36', text_sub: '#8F8A6E',
    pet: '#6FA36A', leaf: '#5E8C5A', pot: '#9A7352',
    gauge_empty: '#E5E0CC', hunger: '#E9C27F', fun: '#A9CF7E',
    clean: '#9ED2C6', warn: '#E39A7A',
  },
  dark: {
    bg: '#262218', floor: '#3F3526', floor_grain: '#31291D',
    border: '#5E4A35', text: '#ECE8D6', text_sub: '#ADA78C',
    pet: '#9CC594', leaf: '#7FAE79', pot: '#8C6E50',
    gauge_empty: '#36302A', hunger: '#D4AE6E', fun: '#93B96C',
    clean: '#82B8AC', warn: '#D58C70',
  },
};
// 각 스탯 게이지 색
const STAT_COLOR = { hunger: 'hunger', happy: 'fun', clean: 'clean', energy: 'leaf' };

// ===================== 설정 =====================
const HOUR = 3600 * 1000;
const EGG_MS = 30 * 1000;     // 알에서 깨어나기까지
const MAX_PETS = 6;
const GRAVITY = 1800;
const PX = 3;                 // 말랑이 도트 한 칸 = 화면 3px

// 도트 칸 단위 크기 — r: 몸 절반 너비, h: 몸 높이
const STAGES = {
  egg:   { label: '알',     r: 4, h: 9 },
  baby:  { label: '아기',   r: 5, h: 7 },
  child: { label: '어린이', r: 6, h: 8 },
  adult: { label: '어른',   r: 8, h: 10 },
};
const NAMES = ['말랑이', '몰랑이', '찹쌀이', '모찌', '젤리', '푸딩', '콩떡', '마시멜로', '두부', '방울', '솜사탕', '뭉치'];
const SPROUTS = ['twin', 'single', 'flower'];
const STAT_KEYS = ['hunger', 'happy', 'clean', 'energy'];

// 어른이 될 때 그동안 받은 돌봄에 따라 모습이 갈린다 (dr/dh: 몸 크기 보정)
const FORMS = {
  chubby: { label: '통통이', dr: 2, dh: -1 },
  sporty: { label: '날쌘이', dr: -1, dh: 2 },
  shiny:  { label: '반짝이', dr: 0, dh: 0 },
  sleepy: { label: '느긋이', dr: 1, dh: -2 },
  royal:  { label: '으뜸이', dr: 0, dh: 1 },
};
const CARE_FORM = { feed: 'chubby', play: 'sporty', clean: 'shiny', sleep: 'sleepy' };
const TENDENCY = { feed: '먹보', play: '개구쟁이', clean: '깔끔쟁이', sleep: '잠꾸러기' };
const formOf = (p, st) => (st === 'adult' && Object.hasOwn(FORMS, p.form || '') ? FORMS[p.form] : null);

// 가장 많이 받은 돌봄 [종류, 횟수]
function topCare(p) {
  const c = p.care || {};
  let best = 'feed';
  for (const k of Object.keys(CARE_FORM)) if ((c[k] || 0) > (c[best] || 0)) best = k;
  return [best, c[best] || 0];
}

function decideForm(p) {
  const c = p.care || {};
  // 한 번도 안 아프고 골고루 돌봐 주면 으뜸이
  if (!p.sickCount && ['feed', 'play', 'clean'].every((k) => (c[k] || 0) >= 5)) return 'royal';
  const [k, n] = topCare(p);
  return n > 0 ? CARE_FORM[k] : 'sleepy';
}

// 밤(22~6시)엔 졸리고, 아침(6~10시)엔 일어난다
const hourOf = (now) => new Date(now).getHours();
const isNight = (now) => hourOf(now) >= 22 || hourOf(now) < 6;
const isMorning = (now) => hourOf(now) >= 6 && hourOf(now) < 10;

// ===================== 도트 스프라이트 =====================
// 글자 하나 = 한 칸. 공백은 투명. 테두리는 그릴 때 자동으로 둘러진다.
const PAL = {
  o: 'outline', b: 'bg', p: 'pet', l: 'leaf', t: 'pot', h: 'hunger', f: 'fun',
  c: 'clean', w: 'warn', g: 'floor', r: 'floor_grain', s: 'text_sub', B: 'border',
};
const SPR = {
  heart:    [' ww ww ', 'wwwwwww', 'wwwwwww', ' wwwww ', '  www  ', '   w   '],
  sadHeart: [' ss ss ', 'sssssss', 'sssssss', ' sssss ', '  sss  ', '   s   '],
  sparkle:  ['  h  ', '  h  ', 'hhbhh', '  h  ', '  h  '],
  zee:      ['ssss', '  s ', ' s  ', 'ssss'],
  ring:     [' cc ', 'c  c', 'c  c', ' cc '],
  drop:     [' c ', ' c ', 'ccc', 'cbc', 'ccc'],
  tear:     ['c'],
  shell:    ['bb', 'b '],
  onigiri:  ['  bb  ', ' bbbb ', 'bbbbbb', 'bboobb', 'bboobb'],
  apple:    ['  l ', ' tl ', 'wwww', 'wbww', 'wwww', ' ww '],
  cookie:   [' hhh ', 'hthhh', 'hhhth', 'hthhh', ' hhh '],
  pudding:  ['  tt  ', ' hhhh ', ' hhhh ', 'hhhhhh'],
  poop:     ['  t   ', ' ttt  ', ' tbtt ', 'tttttt'],
  ball:     [' fff ', 'fbfff', 'fffff', 'fffff', ' fff '],
  moon:     [' hhh', 'hh  ', 'hh  ', 'hh  ', ' hhh'],
  sun:      ['h h h', ' hhh ', 'hhhhh', ' hhh ', 'h h h'],
  pill:     ['   ww', '  www', ' ccw ', 'ccc  ', ' c   '],
  cross:    ['  w  ', '  w  ', 'wwwww', '  w  ', '  w  '],
  note:     ['  lll', '  l l', '  l  ', 'lll  ', 'lll  '],
  exclaim:  ['ww', 'ww', 'ww', '  ', 'ww'],
  sadDrop:  ['  c  ', ' ccc ', 'ccccc', 'cbccc', ' ccc '],
  dots:     ['s s s'],
  letter:   ['bbbbbbb', 'bsbbbsb', 'bbsbsbb', 'bbbsbbb', 'bbbbbbb'],
  crown:    ['h h h', 'hhhhh', 'hwhwh'],
  broom:    ['      tt', '     tt ', '    tt  ', '   tt   ', '  BBB   ', ' hhhhh  ', ' hhhhh  ', 'hhhhhhh ', 'h h h h '],
  puff:     [' s ', 'sss', ' s '],
  fly:      ['b b', ' o '],
  fish:     ['  ccc c', ' cbccc ', '  ccc c'],
  fishBig:  ['  www   w', ' wwwwwwww', 'wbwwwwww ', ' wwwwwwww', '  www   w'],
  boot:     ['  sss', '  sss', '  sss', 'sssss', 'sssss'],
  can:      ['sss', 'hhh', 'sss', 'sss'],
  lily:     ['l lll', 'lllll'],
  reed:     ['t', 't', 'l', 'l', 'l'],
  bobber:   ['w', 'w', 'b'],
  stink:    ['l ', ' l', 'l ', ' l'],
  focus:    ['    ww', '   hww', '  hhh ', ' hhh  ', 'Bhh   ', 'BB    '],
  photo:    ['  sss  ', 'sssssss', 'ssscsss', 'sscbcss', 'ssscsss', 'sssssss'],
  // 머리 위 새싹 (맨 아랫줄이 머리에 붙는다)
  twin:     ['ll   ll', 'lll lll', ' lllll ', '   l   '],
  single:   ['   ll', '  lll', ' lll ', '  l  '],
  flower:   [' w ', 'whw', ' w ', ' ll', ' l '],
};
// 빗자루는 쓸 때 좌우로 기울어진다
SPR.broomL = SPR.broom.map((row) => [...row].reverse().join(''));
Object.assign(SPR, {
  banana:     ['   t', '  hh', ' hhh', 'hhh '],
  strawberry: [' ll ', 'wwww', 'whww', 'wwhw', ' ww '],
  watermelon: ['wwowoww', ' wwwww ', '  fff  '],
  donut:      [' www ', 'wwhww', 'wh hw', 'wwhww', ' www '],
  icecream:   [' www ', 'wwwww', ' hhh ', ' hhh ', '  h  '],
  cake:       ['  w   ', 'bbbbbb', 'wwwwww', 'bbbbbb', 'hhhhhh'],
  egg:        [' bbb ', 'bbhbb', 'bhhhb', 'bbhbb', ' bbb '],
  carrot:     [' ll ', 'wwww', ' ww ', ' ww ', '  w '],
  bread:      [' ttt ', 'thhht', 'thhht', 'ttttt'],
  sushi:      [' www ', 'wwwww', 'bbbbb', 'bbbbb'],
  candy:      ['w ccc w', 'wwcccww', 'w ccc w'],
});
// 음식마다 배부름·기분이 다르다 (간식은 덜 배부르고 더 신난다)
const FOOD_INFO = {
  onigiri: { name: '주먹밥', hunger: 30, happy: 2 },
  apple: { name: '사과', hunger: 22, happy: 3 },
  cookie: { name: '쿠키', hunger: 14, happy: 6 },
  pudding: { name: '푸딩', hunger: 16, happy: 6 },
  banana: { name: '바나나', hunger: 22, happy: 3 },
  strawberry: { name: '딸기', hunger: 16, happy: 5 },
  watermelon: { name: '수박', hunger: 18, happy: 5 },
  donut: { name: '도넛', hunger: 18, happy: 7 },
  icecream: { name: '아이스크림', hunger: 12, happy: 8 },
  cake: { name: '케이크', hunger: 18, happy: 8 },
  egg: { name: '달걀프라이', hunger: 26, happy: 3 },
  carrot: { name: '당근', hunger: 20, happy: -1 },
  bread: { name: '빵', hunger: 28, happy: 2 },
  sushi: { name: '초밥', hunger: 30, happy: 4 },
  candy: { name: '사탕', hunger: 8, happy: 7 },
};
const FOODS = Object.keys(FOOD_INFO);

// ===================== 사투리 =====================
// 창밖 날씨 지역에 따라 말랑이 말투가 바뀐다 (이스터에그)
const DIALECT = {
  std: {
    sleepy: ['졸려..', '눈이 감겨..', '졸려.. 재워 줘'], hungry: ['배고파.. 밥 줘!', '꼬르륵.. 밥!'],
    dirty: ['씻겨 줘!', '꼬질꼬질해..', '문질문질 해 줘'], bored: ['심심해.. 놀아 줘!', '공놀이 하자!'],
    sick: ['아파.. 약 줘'], morning: ['좋은 아침!'], yummy: ['맛있다!', '냠냠!'], full: ['배불러..'],
    slept: ['잘 잤다!'], night: ['하암..', '밤이 깊었네'], dizzy: ['어질어질..', '헤롱헤롱~'], buddy: ['나도 졸려..'],
  },
  gyeong: {
    sleepy: ['잠 온다..', '아 잠온데이..'], hungry: ['배고프다 아이가.. 밥 도!', '배고파 죽겠데이'],
    dirty: ['씻기 도!', '꼬질하데이..'], bored: ['심심하다 아이가, 놀아 도!'],
    sick: ['아프다.. 약 좀 도'], morning: ['좋은 아침이데이!'], yummy: ['억수로 맛있데이!', '쥑이네!'], full: ['배 터지겠다 아이가'],
    slept: ['잘 잤데이!'], night: ['하품 난데이..', '밤이 깊었데이'], dizzy: ['어지럽데이..', '머리 핑 돈다 아이가'], buddy: ['내도 잠온다..'],
  },
  jeolla: {
    sleepy: ['잠와 부러..', '겁나 졸리당께'], hungry: ['배고파 죽겄당께.. 밥 줘잉', '밥 쪼까 줘잉'],
    dirty: ['씻겨 줘잉!', '꼬질꼬질해 부러..'], bored: ['심심허다잉, 놀아 줘!'],
    sick: ['아파 부러.. 약 줘잉'], morning: ['좋은 아침이여!'], yummy: ['겁나 맛있당께!', '오메 맛난그'], full: ['배불러 부러..'],
    slept: ['잘 잤어잉!'], night: ['하암.. 잠와', '밤이 깊어 부렀네'], dizzy: ['오메 어질어질허다잉..'], buddy: ['나도 잠와 부러..'],
  },
  chung: {
    sleepy: ['졸려유..', '잠 와유..'], hungry: ['배고파유.. 밥 줘유'],
    dirty: ['씻겨 줘유~', '꼬질꼬질해유..'], bored: ['심심해유.. 놀아 줘유'],
    sick: ['아파유.. 약 줘유'], morning: ['좋은 아침이유~'], yummy: ['맛있슈!', '참말로 맛있네유'], full: ['배불러유..'],
    slept: ['잘 잤슈~'], night: ['하암.. 졸려유', '밤이 깊었슈'], dizzy: ['어지러워유..'], buddy: ['나도 졸려유..'],
  },
  gang: {
    sleepy: ['졸리드래요..', '잠 오드래요'], hungry: ['배고프드래요.. 밥 줘요'],
    dirty: ['씻겨 주드래요!', '꼬질하드래요..'], bored: ['심심하드래요, 놀아 줘요'],
    sick: ['아프드래요.. 약 줘요'], morning: ['좋은 아침이래요!'], yummy: ['맛있드래요!'], full: ['배부르드래요'],
    slept: ['잘 잤드래요!'], night: ['하암.. 졸리드래요'], dizzy: ['어지럽드래요..'], buddy: ['나도 졸리드래요..'],
  },
  jeju: {
    sleepy: ['졸려수다..', '잠 오쿠다'], hungry: ['배고프우다.. 밥 줍서'],
    dirty: ['씻겨 줍서!', '꼬질꼬질허우다'], bored: ['심심허우다, 놀아 줍서'],
    sick: ['아프우다.. 약 줍서'], morning: ['좋은 아침이우다!'], yummy: ['맛좋수다!', '맛있수다!'], full: ['배부르우다'],
    slept: ['잘 잤수다!'], night: ['하암.. 졸려수다'], dizzy: ['어지럽수다..'], buddy: ['나도 졸려수다..'],
  },
};
// 위도·경도로 대충 어느 지역 말씨인지 (한국 밖은 표준어)
function regionOf({ lat, lon }) {
  if (lat > 33 && lat < 33.7 && lon < 127.2) return 'jeju';
  if (lat < 33 || lat > 38.7 || lon < 124.5 || lon > 131) return 'std';
  if ((lon >= 128.0 && lat < 36.95) || (lon >= 127.75 && lat < 35.5)) return 'gyeong';
  if (lat < 36.1 && lon < 127.75) return 'jeolla';
  if (lat < 37.0) return 'chung';
  if (lon >= 127.6) return 'gang';
  return 'std';
}
const talk = (key) => pick((DIALECT[regionOf(state.weatherLoc)] || DIALECT.std)[key] || DIALECT.std[key]);

// ===================== 유틸 =====================
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const snap = (v, px) => Math.round(v / px) * px;
const $ = (id) => document.getElementById(id);

// 친구 코드 8자리 (헷갈리는 0/O, 1/I 는 뺀다)
function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return [...crypto.getRandomValues(new Uint8Array(8))].map((b) => chars[b % chars.length]).join('');
}

// #RRGGBB 색을 k배만큼 어둡게
function darken(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s) => Math.round(((n >> s) & 255) * k).toString(16).padStart(2, '0');
  return '#' + ch(16) + ch(8) + ch(0);
}

// 받침 유무에 따라 조사를 붙인다: josa('모찌', '이', '가') → '모찌가'
function josa(word, withBatchim, withoutBatchim) {
  const code = word.charCodeAt(word.length - 1);
  if (code < 0xac00 || code > 0xd7a3) return `${word}${withBatchim}(${withoutBatchim})`;
  return word + ((code - 0xac00) % 28 ? withBatchim : withoutBatchim);
}

function fmtDuration(ms) {
  const m = Math.floor(ms / 60000);
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  if (d > 0) return `${d}일 ${h}시간`;
  if (h > 0) return `${h}시간 ${mm}분`;
  return `${Math.max(1, mm)}분`;
}

// ===================== 저장 데이터 =====================
const DEFAULT_LOC = { name: '서울', lat: 37.5665, lon: 126.978 };   // 창밖 날씨를 볼 지역

function loadState() {
  const s = window.malang.load();
  if (s && Array.isArray(s.pets)) {
    // 예전 버전(색상 선택)의 말랑이는 새싹 모양으로 바꿔 준다
    for (const p of s.pets) {
      if (!p.sprout) p.sprout = SPROUTS[Math.abs(Math.round(p.hue || 0)) % 3];
      if (!p.care) p.care = { feed: 0, play: 0, clean: 0, sleep: 0 };
      p.sickCount = p.sickCount || 0;
    }
    if (!s.theme) s.theme = 'system';
    if (s.mark === undefined) s.mark = null;
    s.markLocked = !!s.markLocked;
    s.markHidden = !!s.markHidden;
    if (s.dnd === undefined) s.dnd = true;
    if (!Array.isArray(s.friends)) s.friends = [];
    if (!Array.isArray(s.blocked)) s.blocked = [];
    if (!s.myCode) s.myCode = makeCode();
    if (typeof s.nick !== 'string') s.nick = '';
    s.focus = !!s.focus;
    if (!s.weatherLoc || !Number.isFinite(s.weatherLoc.lat)) s.weatherLoc = DEFAULT_LOC;
    return s;
  }
  // mark: 말랑이네 표지 위치 (화면 비율, null이면 오른쪽 아래 기본 자리)
  return {
    version: 2, lastSim: Date.now(), selectedId: null, theme: 'system', pets: [],
    mark: null, markLocked: false, markHidden: false, dnd: true, focus: false,
    myCode: makeCode(), nick: '', friends: [], blocked: [], weatherLoc: DEFAULT_LOC,
  };
}
const state = loadState();
const persist = () => window.malang.save(state);

function newPet(name, sprout, color = null) {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name, sprout,
    color,      // 몸 색 (#RRGGBB, null이면 테마 기본색)
    born: Date.now(),
    hunger: 80, happy: 80, clean: 100, energy: 90,
    sleeping: false, sick: false,
    sickMeter: 0, poopMeter: 0,
    poops: [],  // 화면 가로 위치(0~1)
    care: { feed: 0, play: 0, clean: 0, sleep: 0 },   // 받은 돌봄 횟수 → 어른 모습
    sickCount: 0,
    form: null,
  };
}

function stageOf(p, now = Date.now()) {
  const age = now - p.born;
  if (age < EGG_MS) return 'egg';
  if (age < 24 * HOUR) return 'baby';
  if (age < 72 * HOUR) return 'child';
  return 'adult';
}

function clampStats(p) {
  for (const k of STAT_KEYS) p[k] = clamp(p[k], 0, 100);
}

function moodOf(p) {
  const m = Math.min(p.hunger, p.happy, p.clean + 10, p.energy + 10);
  if (p.sick || m < 25) return 'sad';
  if (m < 55) return 'meh';
  return 'happy';
}

// ===================== 테마 =====================
let T = null;   // 지금 쓰는 팔레트 (+ outline)
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
const THEME_LABEL = { system: '시스템', light: '라이트', dark: '다크' };

function applyTheme() {
  const name = state.theme === 'light' || state.theme === 'dark' ? state.theme : darkQuery.matches ? 'dark' : 'light';
  // 도트 테두리·눈: 라이트는 진한 글자색, 다크는 진한 배경색
  // 광택: 팔레트에서 가장 밝은 색 (라이트는 배경색, 다크는 글자색)
  T = {
    ...THEMES[name],
    outline: name === 'dark' ? THEMES.dark.bg : THEMES.light.text,
    shine: name === 'dark' ? THEMES.dark.text : THEMES.light.bg,
  };
  for (const [k, v] of Object.entries(THEMES[name])) document.documentElement.style.setProperty('--' + k, v);
  renderIcons();
  renderSwatches();
  renderGauges();
  $('hTheme').textContent = `테마: ${THEME_LABEL[state.theme]}`;
  trayKey = null;
  updateTrayIcon();
}
darkQuery.addEventListener('change', applyTheme);

function setTheme(theme) {
  state.theme = theme;
  applyTheme();
  window.malang.themeChanged(theme);
  persist();
}

// ===================== 도트 그리기 엔진 =====================
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const key = (x, y) => ((y + 512) << 10) | (x + 512);

class Cells {
  constructor() { this.m = new Map(); }
  set(x, y, color) { this.m.set(key(x, y), color); }
  has(x, y) { return this.m.has(key(x, y)); }
  outline(color) {
    const add = [];
    for (const k of this.m.keys()) {
      const x = (k & 1023) - 512, y = (k >> 10) - 512;
      for (const [dx, dy] of N4) if (!this.has(x + dx, y + dy)) add.push([x + dx, y + dy]);
    }
    for (const [x, y] of add) this.set(x, y, color);
    return this;
  }
  draw(c, ox, oy, px) {
    for (const [k, color] of this.m) {
      c.fillStyle = color;
      c.fillRect(ox + ((k & 1023) - 512) * px, oy + ((k >> 10) - 512) * px, px, px);
    }
  }
}

// 스프라이트를 칸에 찍는다. (dx, dy)는 스프라이트 맨 아랫줄 가운데 칸의 위치
function stamp(cells, rows, dx = 0, dy = 0, pal = T) {
  const ax = Math.floor(rows[0].length / 2), ay = rows.length - 1;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== ' ') cells.set(x - ax + dx, y - ay + dy, pal[PAL[row[x]]]);
    }
  });
  return cells;
}

function drawSprite(c, name, x, y, px, outline = true) {
  const cells = stamp(new Cells(), SPR[name]);
  if (outline) cells.outline(T.outline);
  cells.draw(c, snap(x, px), snap(y, px), px);
}

function drawShadow(c, x, groundY, halfW, lift, px) {
  const w = Math.max(1, Math.round(halfW * (1 - lift * 0.5)));
  c.globalAlpha = 0.35 * (1 - lift * 0.6);
  c.fillStyle = T.border;
  c.fillRect(snap(x, px) - w * px, snap(groundY, px), w * 2 * px, px);
  c.globalAlpha = 1;
}

function drawEgg(c, p, v, r, h, t, ox, oy, px) {
  const left = EGG_MS - (Date.now() - p.born);
  const rx = Math.max(3, Math.round(r * (1 + v.s * 0.6)));
  const ry = Math.max(3, Math.round((h / 2) * (1 - v.s)));
  // 깨어날 때가 다가오면 덜덜
  const shake = left < 8000 ? (Math.floor(t * (left < 4000 ? 16 : 8)) % 2 ? 1 : -1)
    : Math.sin(t * 2) > 0.96 ? 1 : 0;
  const cells = new Cells();
  for (let y = -2 * ry; y < 0; y++) {
    for (let x = -rx; x < rx; x++) {
      const dx = (x + 0.5) / rx, dy = (y + 0.5 + ry) / ry;
      if (dx * dx + dy * dy <= 1) cells.set(x + shake, y, T.bg);
    }
  }
  for (const [sx, sy] of [[-2, -2 * ry + 2], [1, -ry], [-2, -2]]) {
    if (cells.has(sx + shake, sy)) { cells.set(sx + shake, sy, T.pet); cells.set(sx + shake + 1, sy, T.pet); }
  }
  cells.outline(T.outline);
  if (left < 5000) {
    for (let x = -rx + 1; x < rx; x++) cells.set(x + shake, -ry - 1 + (x % 2 ? 1 : 0), T.outline);
  }
  cells.draw(c, ox, oy, px);
  v.geo = { cx: ox, cy: oy - ry * px, rx: rx * px, ry: ry * px, top: oy - (2 * ry + 1) * px };
}

// 꼬질 단계 0~3 (청결 50 / 30 / 15 아래)
const DIRT_SPOTS = [[-0.55, 0.35], [0.4, 0.6], [0.15, 0.22], [-0.25, 0.72], [0.6, 0.32], [-0.75, 0.62]];
function dirtLevel(p, st) {
  if (p.visitor || st === 'egg') return 0;
  return p.clean < 15 ? 3 : p.clean < 30 ? 2 : p.clean < 50 ? 1 : 0;
}

// 말랑이 한 마리를 칸 단위로 래스터라이즈해서 그린다
function drawPet(c, p, v, st, t, groundY, px = PX) {
  // 친구가 흔들면 좌우로 덜덜
  const jit = v.shakeT > 0 ? (Math.floor(t * 24) % 2 ? 2 : -2) * px : 0;
  const ox = snap(v.x, px) + jit, oy = snap(v.y, px);
  let { r, h } = STAGES[st];
  const form = formOf(p, st);
  if (form) { r += form.dr; h += form.dh; }
  drawShadow(c, v.x, groundY, r, clamp((groundY - v.y) / 200, 0, 1), px);
  if (st === 'egg') return drawEgg(c, p, v, r, h, t, ox, oy, px);

  // 숨 쉴 때 한 칸씩 들썩
  const breath = p.sleeping ? (Math.sin(t * 1.6) > 0.2 ? 0.12 : 0) : (Math.sin(t * 2.4 + v.wob) > 0.75 ? 0.1 : 0);
  const sq = v.s + breath;
  const hw = Math.max(3, Math.round(r * (1 + sq * 0.9)));   // 절반 너비
  const hh = Math.max(3, Math.round(h * (1 - sq)));         // 높이

  let body = p.sick ? T.text_sub : p.color || T.pet;
  if (!p.sick && dirtLevel(p, st) >= 3) body = darken(body, 0.88);   // 아주 꼬질하면 몸빛이 탁해진다
  const shade = p.sick ? T.border : p.color ? darken(p.color, 0.8) : T.leaf;
  // 몸 색을 바꾼 말랑이는 새싹도 같은 계열 색으로
  const pal = p.color && !p.sick ? { ...T, leaf: darken(p.color, 0.68) } : T;
  const cells = new Cells();
  // 슬라임 모양: 위는 둥근 돔, 옆은 곧게, 바닥은 평평. 몸 가운데는 x=-1과 0 사이
  const dome = Math.max(2, Math.round(hh * 0.6));
  for (let y = 0; y < hh; y++) {           // y는 머리 꼭대기부터
    let w = hw;
    if (y < dome) {
      // 초타원 곡선이라 꼭대기가 넓적하고 둥글다
      const d = (dome - y - 0.5) / dome;
      w = Math.max(1, Math.round(hw * (1 - d ** 2.5) ** 0.4));
    }
    if (y === hh - 1) w -= 1;              // 바닥 모서리만 살짝 둥글게
    for (let x = -w; x < w; x++) cells.set(x, y - hh, y >= hh - 2 ? shade : body);
  }
  // 오른쪽 위 광택
  const shine = (x, y) => { if (cells.has(x, y)) cells.set(x, y, T.shine); };
  const a = Math.max(1, Math.round(hw * 0.3)), b = Math.max(a + 1, Math.round(hw * 0.65));
  for (let x = a; x <= b; x++) shine(x, 1 - hh);
  shine(b, 2 - hh);
  if (form === FORMS.shiny) { shine(-b - 1, 3 - hh); shine(-b, 4 - hh); shine(b + 1, 4 - hh); }
  if (form === FORMS.royal) stamp(cells, SPR.crown, 0, -hh, pal);
  // 안 씻기면 꼬질꼬질: 몸에 얼룩이 하나둘 생긴다
  const spots = [0, 2, 4, 6][dirtLevel(p, st)];
  const mud = darken(body, 0.62);
  for (const [fx, fy] of DIRT_SPOTS.slice(0, spots)) {
    const x = Math.round(fx * hw), y = Math.round(fy * hh) - hh;
    if (cells.has(x, y)) cells.set(x, y, mud);
    if (cells.has(x + 1, y)) cells.set(x + 1, y, mud);
  }

  // 머리 위에 둥실 떠 있는 새싹
  const bob = v.held ? 0 : Math.sin(t * 3 + v.wob) > 0 ? 0 : 1;
  stamp(cells, SPR[p.sprout] || SPR.twin, 0, -hh - 4 - bob, pal);

  cells.outline(T.outline);

  // 얼굴 (몸 아래쪽에 옹기종기)
  const ink = T.outline;
  const mood = moodOf(p);
  const fx = hw >= 7 ? Math.sign(v.face) : 0;
  const ex = Math.max(2, Math.round(hw * 0.45));
  const ey = -Math.max(2, Math.round(hh * 0.4));
  const dot = (x, y, color = ink) => cells.set(x, y, color);

  // 입은 없고 눈으로만 감정을 표현한다
  for (const s of [-1, 1]) {
    const xe = s < 0 ? fx - 1 - ex : fx + ex;
    if (p.sleeping || (v.blink > 0 && !(v.dizzyT > 0))) {  // - -
      dot(xe, ey); dot(xe + s, ey);
    } else if (v.dizzyT > 0) {                             // @ @ 빙글빙글 (빈 칸이 돈다)
      const ring = [[-1, -2], [0, -2], [1, -2], [1, -1], [1, 0], [0, 0], [-1, 0], [-1, -1]];
      const gap = Math.floor(t * 12 + (s > 0 ? 4 : 0)) % 8;
      ring.forEach(([dx, dy], i) => { if (i !== gap) dot(xe + dx, ey + dy); });
    } else if (v.held) {                                   // > <
      dot(xe + s, ey - 2); dot(xe, ey - 1); dot(xe + s, ey);
    } else if (p.sick) {                                   // x x
      dot(xe - 1, ey - 2); dot(xe + 1, ey - 2); dot(xe, ey - 1); dot(xe - 1, ey); dot(xe + 1, ey);
    } else if (v.squint > 0 || v.playT > 0 || v.eatT > 0) { // ^ ^
      dot(xe - 1, ey); dot(xe, ey - 1); dot(xe + 1, ey);
    } else if (mood === 'sad') {                           // ㅠ ㅠ
      dot(xe - 1, ey - 2); dot(xe, ey - 2); dot(xe + 1, ey - 2); dot(xe, ey - 1);
      dot(xe, ey + (Math.floor(t * 3) % 2), T.clean);
    } else if (mood === 'meh') {                           // . .
      dot(xe, ey);
    } else {                                               // ● ●
      dot(xe, ey - 1); dot(xe, ey);
    }
    dot(xe + s, ey + 1, T.warn);                           // 볼터치
  }

  cells.draw(c, ox, oy, px);
  v.geo = { cx: ox, cy: oy - (hh / 2) * px, rx: hw * px, ry: (hh / 2) * px, top: oy - (hh + 9) * px };
}

// 감정은 구름 말풍선 + 아이콘
const CLOUD = [
  '   bbb  bbb   ',
  ' bbbbbbbbbbbb ',
  'bbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbb',
  ' bbbbbbbbbbbb ',
  '  bbbb  bbbb  ',
];
function drawCloud(c, cx, top, icon, t) {
  const px = 2, wc = CLOUD[0].length, hc = CLOUD.length;
  const bob = Math.sin(t * 3) > 0 ? 0 : px;
  const ox = snap(cx - (wc / 2) * px + 6, px), oy = snap(top - (hc + 5) * px, px) - bob;
  const cells = new Cells();
  CLOUD.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== ' ') cells.set(x, y, T.bg); });
  // 머리 쪽으로 이어지는 작은 구름 꼬리
  cells.set(3, hc + 1, T.bg); cells.set(4, hc + 1, T.bg); cells.set(2, hc + 3, T.bg);
  cells.outline(T.outline).draw(c, ox, oy, px);
  drawSprite(c, icon, ox + Math.floor(wc / 2) * px, oy + (hc - 2) * px, px);
}

// 원하는 건 네모 말풍선으로 말한다
// 말풍선 폭을 넘으면 여러 줄로 (띄어쓰기에서 먼저 끊고, 긴 단어는 글자 단위로)
const SPEECH_MAX_W = 132;
function wrapText(c, text, maxW) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const tryLine = line ? line + ' ' + word : word;
    if (c.measureText(tryLine).width <= maxW) { line = tryLine; continue; }
    if (line) lines.push(line);
    line = '';
    for (const ch of word) {
      if (c.measureText(line + ch).width > maxW && line) { lines.push(line); line = ''; }
      line += ch;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function drawSpeech(c, text, cx, top, icon = null, tail = true) {
  const px = 2, lineH = 14;
  c.font = '12px Galmuri11, "Malgun Gothic", sans-serif';
  const iw = icon ? (SPR[icon][0].length + 3) * px : 0;   // 글자 앞 아이콘 자리
  const lines = wrapText(c, text, SPEECH_MAX_W - iw);
  const textW = Math.max(...lines.map((l) => Math.ceil(c.measureText(l).width)));
  const wc = Math.ceil((textW + 12 + iw) / px), hc = 2 + Math.round((lines.length * lineH) / px);
  const ox = snap(clamp(cx - 12, 8, W - wc * px - 8), px), oy = snap(top - (hc + 4) * px, px);
  const tx = clamp(Math.round((cx - ox) / px), 2, wc - 3);
  const cells = new Cells();
  for (let y = 0; y < hc; y++) {
    for (let x = 0; x < wc; x++) {
      const corner = (x === 0 || x === wc - 1) && (y === 0 || y === hc - 1);
      if (!corner) cells.set(x, y, T.bg);
    }
  }
  if (tail) { cells.set(tx, hc, T.bg); cells.set(tx + 1, hc, T.bg); cells.set(tx, hc + 1, T.bg); }
  cells.outline(T.outline).draw(c, ox, oy, px);
  if (icon) drawSprite(c, icon, ox + 6 + Math.floor(SPR[icon][0].length / 2) * px + px, oy + (hc - 2) * px, px);
  c.fillStyle = T.text;
  c.textAlign = 'left'; c.textBaseline = 'middle';
  lines.forEach((l, i) => c.fillText(l, ox + 6 + iw, oy + px + lineH * i + lineH / 2 + 1));
  return oy;
}

// 대화 말풍선 쌓기: 새 말이 머리 바로 위, 예전 말은 위로 밀려 올라가며 흐려진다
const CHAT_LIFE = 20, CHAT_MAX = 3;
const CHAT_ALPHA = [1, 0.5, 0.28];
function pushChat(list, text, thumb = null) {
  list.push({ text, thumb, t: CHAT_LIFE });
  while (list.length > CHAT_MAX) list.shift();
}
function ageChat(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) if ((list[i].t -= dt) <= 0) list.splice(i, 1);
}
function drawChat(c, list, cx, top) {
  let y = top;
  for (let i = list.length - 1, k = 0; i >= 0; i--, k++) {
    const m = list[i];
    c.globalAlpha = CHAT_ALPHA[k] * Math.min(1, m.t);   // 마지막 1초 동안 스르르
    if (m.thumb) y = drawPhotoCard(c, m.thumb, cx, y);
    if (m.text) y = drawSpeech(c, m.text, cx, y, null, k === 0 && !m.thumb);
  }
  c.globalAlpha = 1;
}

// 사진은 머리 위에 폴라로이드처럼. 카드 윗변 y를 돌려준다 (말풍선은 그 위에)
function drawPhotoCard(c, thumb, cx, top) {
  const s = thumb.width, pad = 3;
  const w = s + pad * 2, h = s + pad * 2 + 6;
  const x = Math.round(clamp(cx - w / 2, 8, W - w - 8)), y = Math.round(top - h - 8);
  c.fillStyle = T.outline;
  c.fillRect(x - 2, y - 2, w + 4, h + 4);
  c.fillStyle = '#FFFFFF';
  c.fillRect(x, y, w, h);
  c.drawImage(thumb, x + pad, y + pad);
  return y + 4;
}

function drawLabel(c, text, cx, y) {
  c.font = '12px Galmuri11, "Malgun Gothic", sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = Math.ceil(c.measureText(text).width / 2) * 2 + 12, h = 18;
  const x = Math.round(cx - w / 2), top = Math.round(y - h / 2);
  c.fillStyle = T.border;
  c.fillRect(x + 2, top, w - 4, h);
  c.fillRect(x, top + 2, w, h - 4);
  c.fillStyle = T.bg;
  c.fillRect(x + 2, top + 2, w - 4, h - 4);
  c.fillStyle = T.text;
  c.fillText(text, Math.round(cx), top + h / 2 + 1);
}

// ===================== 말랑이네 (집 표지) =====================
// 새싹이 든 네모 말풍선. 클릭하면 집 창이 열리고, 고정을 풀면 끌어서 옮길 수 있다.
const homeMark = { geo: null, ox: 0, oy: 0, shakeT: 0 };
const MARK_W = 11 * 3, MARK_H = 12 * 3;   // 말풍선 + 꼬리 크기(px)

function drawHomeMark(c, t) {
  if (state.markHidden) { homeMark.geo = null; return; }
  const px = 3, wc = 11, hc = 9;
  const bob = Math.sin(t * 1.5) > 0 ? 0 : px;
  let ox = W - 64 - (wc * px) / 2, oy = floorY() - (hc + 3) * px;
  if (state.mark) { ox = state.mark.x * W; oy = state.mark.y * H; }
  ox = snap(clamp(ox, 4, W - MARK_W - 4), px);
  oy = snap(clamp(oy, 4, H - MARK_H - 4), px);
  homeMark.ox = ox; homeMark.oy = oy;
  if (!(mouse.down && mouse.down.mark && mouse.down.dragging)) oy -= bob;
  // 집 안 말랑이를 친구가 흔들면 표지가 들썩
  if (homeMark.shakeT > 0) { ox += Math.floor(t * 24) % 2 ? 2 * px : -2 * px; oy -= Math.floor(t * 12) % 2 ? px : 0; }
  const cells = new Cells();
  for (let y = 0; y < hc; y++) {
    for (let x = 0; x < wc; x++) {
      const corner = (x === 0 || x === wc - 1) && (y === 0 || y === hc - 1);
      if (!corner) cells.set(x, y, T.bg);
    }
  }
  cells.set(2, hc, T.bg); cells.set(3, hc, T.bg); cells.set(2, hc + 1, T.bg);
  cells.outline(T.outline).draw(c, ox, oy, px);
  drawSprite(c, Math.sin(t * 1.2) > 0.6 ? 'single' : 'twin', ox + 5 * px, oy + 6 * px, px);
  // 집 안에서 자는 말랑이가 있으면 쿨쿨
  if (state.pets.some((p) => p.sleeping && views.has(p.id) && views.get(p.id).inside)) {
    drawSprite(c, 'zee', ox + (wc + 1) * px, oy - (Math.sin(t * 2) > 0 ? 2 : 0), 2);
  }
  homeMark.geo = { x: ox - px, y: oy - px, w: (wc + 2) * px, h: (hc + 4) * px };
}

const overHomeMark = (pt) => {
  const g = homeMark.geo;
  return !!g && pt.x >= g.x && pt.x <= g.x + g.w && pt.y >= g.y && pt.y <= g.y + g.h;
};

// 표지·방해 금지 설정이 바뀌면 집 창 버튼과 트레이 메뉴에 알린다
function prefsChanged() {
  $('hLock').textContent = state.markLocked ? '표지 고정 풀기' : '표지 고정';
  $('hHide').textContent = state.markHidden ? '표지 보이기' : '표지 숨기기';
  $('hFocusLabel').textContent = state.focus ? '집중 끝내기' : '집중 모드';
  $('hFocus').classList.toggle('primary', state.focus);
  window.malang.prefsChanged({ hidden: state.markHidden, locked: state.markLocked, dnd: state.dnd, focus: state.focus });
  persist();
}

function toggleMarkLock() {
  state.markLocked = !state.markLocked;
  toast(state.markLocked ? '말랑이네 표지를 고정했어요' : '이제 표지를 끌어서 옮길 수 있어요');
  prefsChanged();
}

function toggleMarkHidden() {
  state.markHidden = !state.markHidden;
  if (state.markHidden) toast('표지를 숨겼어요. 트레이 메뉴에서 다시 열 수 있어요');
  prefsChanged();
}

// 집중 모드: 내 말랑이 머리 위에 연필 구름이 뜨고, 친구들에게도 '집중 중'으로 보인다
function toggleFocus() {
  state.focus = !state.focus;
  if (state.focus) {
    fishing.fish = 0; fishing.trash = 0;
    toast('집중 모드 시작! 말랑이는 연못에서 낚시하며 기다릴게요');
  } else {
    const got = [fishing.fish && `물고기 ${fishing.fish}마리`, fishing.trash && `쓰레기 ${fishing.trash}개`].filter(Boolean);
    toast(got.length ? `집중 모드 끝! 그동안 ${got.join(', ')}를 낚았어요` : '집중 모드 끝! 수고했어요');
    stopFishing();
  }
  const p = focusPet();
  if (p) {
    const v = viewOf(p);
    v.sv += 2;
    if (!state.focus) setEmote(v, 'sparkle', 1.5);
  }
  prefsChanged();
  broadcastStatus();
}

// 집중 구름을 띄울 말랑이: 고른 말랑이가 깨어 있으면 그 아이, 아니면 깨어 있는 첫째
function focusPet() {
  const awake = (p) => p && stageOf(p) !== 'egg' && !p.sleeping && !viewOf(p).inside;
  if (state.focus && awake(fisher())) return fisher();   // 집중 중엔 낚시하는 아이
  return [selected(), ...state.pets].find(awake) || null;
}

function resetMark() {
  state.mark = null;
  state.markHidden = false;
  prefsChanged();
}

// ===================== 시간 흐름 =====================
const pendingEvents = [];

// dtH: 흐른 시간(시간 단위)
function simulate(p, dtH, now) {
  if (stageOf(p, now) === 'egg') return;
  const sickMul = p.sick ? 1.5 : 1;
  const night = isNight(now);

  if (p.sleeping) {
    // 옆에서 같이 자면 더 푹 자고 외롭지 않다
    const cozy = sleepBuddy(p);
    p.hunger -= 5 * dtH;
    p.happy -= (cozy ? 0 : 2) * dtH;
    p.clean -= 3 * dtH;
    p.energy += 30 * dtH * (cozy ? 1.3 : 1);
    // 밤에는 기운이 다 차도 아침까지 자고, 아침엔 웬만큼 찼으면 일어난다
    const morning = isMorning(now) && p.energy >= 70 && now - (p.sleptAt || 0) > HOUR;
    if (!night && (p.energy >= 100 || morning)) {
      p.sleeping = false;
      p.wokeAt = now;
      pendingEvents.push({ type: isMorning(now) ? 'morning' : 'wake', pet: p });
    }
  } else {
    p.hunger -= 16 * dtH * sickMul;
    p.happy -= 10 * dtH * sickMul;
    p.clean -= 12 * dtH;
    p.energy -= 9 * dtH * (night ? 1.6 : 1);
    if (p.energy <= 0) {
      p.sleeping = true;
      p.sleptAt = now;
      pendingEvents.push({ type: 'faint', pet: p });
    } else if (badCondition(p) && now - (p.wokeAt || 0) > HOUR / 3) {
      // 컨디션이 나쁘면 알아서 쉬러 간다 (깨워 주면 20분은 버틴다)
      p.sleeping = true;
      p.sleptAt = now;
      pendingEvents.push({ type: 'rest', pet: p });
    } else if (night && p.energy < 50 && !p.sick && now - (p.wokeAt || 0) > HOUR / 2) {
      // 밤이 깊으면 스르르 잠든다 (방금 깨웠으면 30분은 봐준다)
      p.sleeping = true;
      p.sleptAt = now;
      pendingEvents.push({ type: 'nightSleep', pet: p });
    }
    p.poopMeter += dtH * 0.6;
    if (p.poopMeter >= 1) {
      p.poopMeter = 0;
      if (p.poops.length < 5) {
        // 말랑이가 있던 자리에 응가를 한다
        const v = views.get(p.id);
        p.poops.push(v && W ? clamp((v.x + rand(-30, 30)) / W, 0.01, 0.99) : rand(0.5, 0.85));
        pendingEvents.push({ type: 'poop', pet: p });
      }
    }
  }

  // 응가가 쌓이면 더러워지고 기분도 나빠진다
  p.clean -= p.poops.length * 4 * dtH;
  p.happy -= p.poops.length * 2 * dtH;

  // 배고프거나 더러운 상태가 오래가면 아프다
  if (!p.sick) {
    if (p.hunger < 10 || p.clean < 10) {
      p.sickMeter += dtH;
      if (p.sickMeter > 1.5) {
        p.sick = true;
        p.sickMeter = 0;
        p.sickCount = (p.sickCount || 0) + 1;
        pendingEvents.push({ type: 'sick', pet: p });
      }
    } else {
      p.sickMeter = Math.max(0, p.sickMeter - dtH);
    }
  }
  clampStats(p);
}

// 다들 집 침대에서 자니까, 다른 말랑이도 자고 있으면 같이 자는 셈
// 기운이 바닥이거나, 아프거나, 전체적으로 많이 지쳤을 때
function badCondition(p) {
  return p.energy < 20 || p.sick || (p.hunger + p.happy + p.clean + p.energy) / 4 < 25;
}

function sleepBuddy(p) {
  return state.pets.some((o) => o !== p && o.sleeping);
}

// 마지막 계산 시점부터 to까지 1분 단위로 진행 (앱이 꺼져 있던 시간도 포함)
function advance(to) {
  let t = state.lastSim;
  while (t < to) {
    const step = Math.min(60000, to - t);
    t += step;
    for (const p of state.pets) simulate(p, step / HOUR, t);
  }
  state.lastSim = to;
}

// ===================== 화면 상태 (저장 안 함) =====================
const canvas = $('scene');
const ctx = canvas.getContext('2d');
let W = 0, H = 0;
const floorY = () => H - 8;   // 창 아래 = 작업표시줄 바로 위

const views = new Map();
const particles = [];
const foods = [];
const mouse = { x: -9999, y: -9999, down: null };
let hoverId = null;

function viewOf(p) {
  let v = views.get(p.id);
  if (!v) {
    v = {
      x: rand(W * 0.55, W - 220), y: floorY(), vx: 0, vy: 0,
      s: 0, sv: 0, sTarget: 0,          // 찌그러짐 스프링 (+ 납작, - 길쭉)
      grounded: true, held: false,
      hopT: rand(0.5, 3), blinkT: rand(1, 4), blink: 0,
      eatT: 0, playT: 0, squint: 0,
      goal: null, goalT: 0,
      emote: null, speech: null, bubbleT: rand(4, 9),
      face: 1, wob: Math.random() * 10,
      stage: stageOf(p), lastPoke: 0, notified: {},
      geo: null,
      // 자는 말랑이는 집 안 침대에 있다 (켤 때 이미 자고 있었으면 바로 집 안)
      inside: !!p.sleeping && !p.visitor, goHome: false, enterT: 0,
      shakeT: 0,
    };
    views.set(p.id, v);
  }
  return v;
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  for (const v of views.values()) {
    v.x = clamp(v.x, 40, Math.max(40, W - 40));
    v.y = Math.min(v.y, floorY());
  }
}

function emit(x, y, sprite, { n = 1, spread = 60, up = 120, life = 1.2, gravity = -30, px = 2 } = {}) {
  for (let i = 0; i < n; i++) {
    particles.push({
      x: x + rand(-spread, spread) * 0.3, y,
      vx: rand(-spread, spread), vy: -rand(up * 0.6, up),
      life, max: life, sprite, px, g: gravity,
    });
  }
}

const poopX = (f) => f * W;

// ===================== 집으로 들어가 자기 =====================
// 말랑이네 표지 아래가 현관. 표지를 숨겼으면 오른쪽 아래 구석.
const doorX = () => (homeMark.geo ? clamp(homeMark.geo.x + homeMark.geo.w / 2, 40, W - 40) : W - 64);

function goHome(p, v) {
  v.goHome = true;
  v.goal = doorX();
  v.goalT = 25;
  v.hopT = Math.min(v.hopT, 0.4);
  v.meet = null; v.joinSleep = null;
  v.emote = null; v.speech = null;
}

let wakeTipShown = false;
function enterHouse(p, v) {
  v.goHome = false;
  v.goalT = 0;
  v.inside = true;
  v.enterT = 0.5;   // 스르르 사라지는 시간
  emit(v.x, v.y - 30, 'zee', { n: 2, spread: 30, up: 60, life: 1.2 });
  if (state.selectedId === p.id && !card.hidden && home.hidden) closeCard();
  if (!wakeTipShown && !p.visitor) {
    wakeTipShown = true;
    toast('깨우려면 말랑이네를 열고 침대의 말랑이를 눌러 주세요');
  }
}

function leaveHouse(p, v) {
  v.inside = false;
  v.goHome = false;
  v.enterT = 0;
  v.x = doorX(); v.y = floorY();
  v.vx = rand(-120, 120); v.vy = -420; v.sv -= 3;
  emit(v.x, v.y - 30, 'sparkle', { n: 4, spread: 80, up: 160 });
}

// ===================== 움직임 =====================
function hop(p, v) {
  if (v.eatT > 0) { v.hopT = 0.5; return; }
  if (v.fishing) { v.hopT = 1; v.face = v.fishFace || 1; return; }   // 낚시 중엔 가만히

  // "집으로 부르기" 중이면 목표 지점으로 폴짝폴짝
  if (v.goalT > 0 && v.goal !== null) {
    const dx = v.goal - v.x;
    if (Math.abs(dx) < 30) {
      v.goalT = 0;
      v.hopT = rand(1.5, 3);
      arrive(p, v);
      return;
    }
    const dir = Math.sign(dx);
    const drowsy = p.sleeping ? 0.6 : 1;   // 졸면서 비척비척
    v.face = dir;
    v.vx = dir * Math.min(Math.abs(dx) * 1.5, rand(260, 340) * drowsy);
    v.vy = -rand(340, 440) * drowsy;
    v.sv -= 2;
    v.hopT = rand(0.15, 0.3) / drowsy;
    return;
  }

  const form = formOf(p, stageOf(p));
  const jump = form === FORMS.sporty ? 1.2 : 1;

  // 공이 있으면 쫓아간다
  if (ball && !p.sick && (p.visitor || p.energy > 5)) {
    const dx = ball.x - v.x;
    const dir = Math.sign(dx) || v.face;
    v.face = dir;
    v.vx = dir * Math.min(Math.abs(dx) * 1.8, rand(200, 320));
    v.vy = -rand(300, 460) * jump;
    v.sv -= 2;
    v.hopT = rand(0.2, 0.5);
    return;
  }

  const playing = v.playT > 0;
  v.hopT = playing ? rand(0.25, 0.6)
    : p.sick ? rand(5, 10)
    : moodOf(p) === 'sad' ? rand(4, 8)
    : rand(1.5, 4.5);
  if (form === FORMS.sleepy) v.hopT *= 1.5;
  if (!playing && Math.random() < 0.35) { v.sv += 1.2; return; } // 제자리에서 꿈틀

  let dir = Math.random() < 0.5 ? -1 : 1;
  if (v.x < 120) dir = 1;
  if (v.x > W - 120) dir = -1;
  v.face = dir;
  v.vx = dir * rand(50, 150) * (playing ? 1.3 : 1);
  v.vy = -(playing ? rand(380, 520) : rand(200, 320)) * jump;
  v.sv -= playing ? 3 : 2;
}

// 목적지에 닿았을 때: 같이 자러 왔거나, 친구를 만나러 왔거나
function arrive(p, v) {
  if (v.goHome) return enterHouse(p, v);
  if (v.joinSleep) {
    const buddy = state.pets.find((x) => x.id === v.joinSleep);
    v.joinSleep = null;
    if (buddy && buddy.sleeping && !p.sleeping) {
      p.sleeping = true;
      p.sleptAt = Date.now();
      v.emote = null; v.speech = null;
      toast(`${p.name}도 ${buddy.name} 옆에서 같이 자러 들어가요`);
    }
  }
  if (v.meet) {
    const other = state.pets.find((x) => x.id === v.meet);
    v.meet = null;
    if (!other) return;
    if (other.sleeping) return say(v, '쉿.. 자고 있네', 2);
    greet(p, v, other, viewOf(other));
  }
}

// 두 말랑이가 하트를 주고받는다
function greet(a, va, b, vb) {
  pairCool.set(pairKey(a, b), performance.now() / 1000 + 5);
  setEmote(va, 'heart'); setEmote(vb, 'heart');
  va.squint = vb.squint = 0.8;
  va.sv += 2; vb.sv += 2;
  emit((va.x + vb.x) / 2, Math.min(va.y, vb.y) - 40, 'heart', { n: 2, spread: 40, up: 100 });
  for (const p of [a, b]) if (!p.visitor) p.happy = clamp(p.happy + 3, 0, 100);
}

// 졸린 말랑이들이 옆으로 와서 같이 잔다
function callSleepBuddies(p) {
  let n = 0;
  for (const o of state.pets) {
    if (o === p || o.sleeping || o.sick || o.energy >= 60 || stageOf(o) === 'egg') continue;
    const ov = viewOf(o);
    if (ov.held) continue;
    n++;
    ov.goal = clamp(doorX() + (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 24, 40, W - 40);
    ov.goalT = 15;
    ov.joinSleep = p.id;
    ov.hopT = rand(0.2, 0.8);
    say(ov, talk('buddy'), 2);
  }
}

// 원하는 게 있을 때 하는 말
function needSpeech(p) {
  if (p.sleeping) return null;
  if (p.sick) return talk('sick');
  if (p.hunger < 30) return talk('hungry');
  if (p.poops.length >= 2) return '응가 치워 줘!';
  if (p.clean < 30) return talk('dirty');
  if (p.energy < 25) return talk('sleepy');
  if (p.happy < 30) return talk('bored');
  return null;
}

function setEmote(v, icon, dur = 1.6) {
  v.emote = { icon, t: dur };
  v.speech = null;
}

function say(v, text, dur = 2.5) {
  v.speech = { text, t: dur };
  v.emote = null;
}

function updateView(p, v, dt) {
  const st = stageOf(p);
  const r = STAGES[st].r * PX;
  const fy = floorY();

  if (v.stage === 'egg' && st !== 'egg') {
    emit(v.x, v.y - 30, 'sparkle', { n: 6, spread: 120, up: 220 });
    emit(v.x, v.y - 30, 'shell', { n: 4, spread: 90, up: 260, gravity: 900 });
    v.sv -= 4; v.vy = -450;
    setEmote(v, 'sparkle', 2);
    toast(`${josa(p.name, '이', '가')} 태어났어요!`);
  }
  v.stage = st;

  // 잠들면 집으로 걸어 들어가고, 깨면 현관에서 폴짝 나온다
  if (!p.visitor && st !== 'egg') {
    if (p.sleeping && !v.inside && !v.held) {
      if (!v.goHome) goHome(p, v);
      else if (v.goalT <= 0) enterHouse(p, v);
    } else if (!p.sleeping && (v.inside || v.goHome)) {
      if (v.inside) leaveHouse(p, v);
      else { v.goHome = false; v.goalT = 0; }
    }
  }
  if (v.enterT > 0) v.enterT = Math.max(0, v.enterT - dt);
  if (v.shakeT > 0) v.shakeT = Math.max(0, v.shakeT - dt);
  if (v.dizzyT > 0) {
    // 어질어질: 비틀비틀 흔들리고 가끔 휘청
    v.dizzyT = Math.max(0, v.dizzyT - dt);
    v.sTarget = Math.sin(performance.now() / 120) * 0.12;
    if (v.grounded && !v.held && !p.sleeping && Math.random() < dt * 2) { v.vx = rand(-90, 90); v.vy = -rand(80, 160); v.face = -v.face; }
  }
  if (v.inside) { v.geo = null; return; }

  if (st === 'adult' && !p.form && !p.visitor) {
    p.form = decideForm(p);
    emit(v.x, v.y - 30, 'sparkle', { n: 8, spread: 140, up: 240 });
    v.sv -= 4; v.vy = -450;
    setEmote(v, 'sparkle', 2.5);
    toast(`${josa(p.name, '이', '가')} 어른 ${FORMS[p.form].label}로 자랐어요!`);
    persist();
  }

  // 먹는 중엔 오물오물 들썩
  v.sTarget = v.eatT > 0 && Math.floor(v.eatT * 8) % 2 ? 0.14 : 0;
  // 기지개: 위로 쭉 늘어난다
  if (v.stretchT > 0) { v.stretchT -= dt; v.sTarget = -0.4; }
  // 반짝이는 가끔 반짝반짝
  if (formOf(p, st) === FORMS.shiny && !p.sleeping && v.geo && Math.random() < dt * 0.5) {
    emit(v.geo.cx + rand(-v.geo.rx, v.geo.rx), v.geo.cy, 'sparkle', { n: 1, spread: 10, up: 50, life: 0.8 });
  }
  if (v.held) {
    const nx = clamp(mouse.x, r, W - r);
    const ny = clamp(mouse.y + r * 0.9, r * 2, fy);
    const idt = 1 / Math.max(dt, 1e-3);
    v.vx = v.vx * 0.6 + (nx - v.x) * idt * 0.4;
    v.vy = v.vy * 0.6 + (ny - v.y) * idt * 0.4;
    v.x = nx; v.y = ny;
    v.sTarget = -clamp(Math.hypot(v.vx, v.vy) / 4000, 0.08, 0.3);
    v.grounded = false;
  } else {
    v.vy += GRAVITY * dt;
    v.x += v.vx * dt;
    v.y += v.vy * dt;
    if (v.y >= fy) {
      if (v.vy > 250) {
        v.sv += v.vy * 0.006;   // 착지할 때 철퍼덕
        if (dirtLevel(p, st) >= 2) emit(v.x, fy - 4, 'puff', { n: 2, spread: 60, up: 40, life: 0.5, gravity: 60 });
      }
      v.y = fy; v.vy = 0; v.grounded = true;
    } else {
      v.grounded = false;
    }
    if (v.x < r) { v.x = r; v.vx = Math.abs(v.vx) * 0.5; v.sv += 1.5; }
    if (v.x > W - r) { v.x = W - r; v.vx = -Math.abs(v.vx) * 0.5; v.sv += 1.5; }
    if (v.y - r * 2 < 0) { v.y = r * 2; v.vy = Math.abs(v.vy) * 0.4; }

    if (v.grounded) {
      v.vx *= Math.pow(0.004, dt);
      if (st !== 'egg' && (!p.sleeping || v.goHome)) {
        v.hopT -= dt;
        if (v.hopT <= 0) hop(p, v);
      }
    }
  }

  // 말랑한 스프링
  v.sv += (-(v.s - v.sTarget) * 260 - v.sv * 9) * dt;
  v.s = clamp(v.s + v.sv * dt, -0.45, 0.55);

  v.blinkT -= dt;
  if (v.blinkT <= 0) { v.blink = 0.15; v.blinkT = rand(2, 5); }
  v.blink = Math.max(0, v.blink - dt);
  v.eatT = Math.max(0, v.eatT - dt);
  v.playT = Math.max(0, v.playT - dt);
  v.squint = Math.max(0, v.squint - dt);
  v.goalT = Math.max(0, v.goalT - dt);
  if (v.goalT === 0) { v.joinSleep = null; v.meet = null; }

  if (st !== 'egg' && !v.held) {
    v.bubbleT -= dt;
    if (v.bubbleT <= 0) {
      const need = needSpeech(p);
      if (need) {
        say(v, need, 3);
        v.bubbleT = rand(7, 11);
      } else {
        v.bubbleT = rand(6, 12);
        // 밤엔 하품, 아니면 가끔 기분을 구름으로 (집중 모드엔 혼잣말 없이 조용히)
        const chatty = !state.focus && !v.emote && !p.sleeping;
        if (chatty && isNight(Date.now()) && Math.random() < 0.5) {
          say(v, talk(pick(['night', 'sleepy'])), 2);
        } else if (chatty && Math.random() < 0.4) {
          const mood = moodOf(p);
          setEmote(v, mood === 'happy' ? pick(['note', 'heart']) : mood === 'sad' ? 'sadDrop' : 'dots', 2);
        }
      }
    }
  }
  if (v.speech && (v.speech.t -= dt) <= 0) v.speech = null;
  if (v.emote && (v.emote.t -= dt) <= 0) v.emote = null;
}

function updateFoods(dt) {
  for (let i = foods.length - 1; i >= 0; i--) {
    const f = foods[i];
    const p = state.pets.find((x) => x.id === f.petId);
    if (!p || p.sleeping) { foods.splice(i, 1); continue; }
    const v = viewOf(p);
    const r = STAGES[stageOf(p)].r * PX;
    f.x += (v.x - f.x) * Math.min(1, dt * 6);
    f.vy += 900 * dt;
    f.y += f.vy * dt;
    if (f.y >= v.y - r) {
      foods.splice(i, 1);
      eat(p, v, f.sprite);
    }
  }
}

function eat(p, v, food) {
  const info = FOOD_INFO[food] || FOOD_INFO.onigiri;
  const wasFull = p.hunger > 90;
  p.hunger += info.hunger;
  p.clean -= 3;          // 흘리면서 먹는다
  p.poopMeter += 0.25;
  v.eatT = 1.2;
  v.sv += 2;
  if (wasFull) {
    p.happy -= 4;
    say(v, talk('full'));
  } else if (info.happy < 0) {
    p.happy += info.happy;
    say(v, `${info.name}은 별로..`);
  } else {
    p.happy += info.happy;
    if (Math.random() < 0.5) say(v, `${info.name}! ${talk('yummy')}`, 2.2);
    else setEmote(v, 'heart');
  }
  clampStats(p);
}

function gather() {
  const awake = state.pets.filter((p) => !p.sleeping && stageOf(p) !== 'egg');
  if (!awake.length) return toast('다들 자고 있어요');
  // 표지가 있는 곳 아래로 모인다
  const g = homeMark.geo;
  const base = g ? g.x + g.w / 2 : W - 120;
  const dir = base > W / 2 ? -1 : 1;
  awake.forEach((p, i) => {
    const v = viewOf(p);
    v.goal = clamp(base + dir * i * 56, 40, W - 40);
    v.goalT = 20;
    v.hopT = rand(0, 0.4);
  });
  toast('말랑이들아 집으로 모여라~');
}

// ===================== 말랑이끼리 =====================
const pairCool = new Map();   // 두 말랑이가 다시 반응할 수 있는 시각
const pairKey = (a, b) => (a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id);
let meetT = rand(20, 40);

function socialize(dt, now) {
  const all = [...state.pets, ...visitors.map((x) => x.pet)]
    .filter((p) => stageOf(p) !== 'egg' && !p.sleeping && !viewOf(p).held && !viewOf(p).fishing);
  // 부딪히면 통 튕기고, 둘 다 기분이 좋으면 하트를 주고받는다
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j];
      const va = viewOf(a), vb = viewOf(b);
      const reach = (STAGES[stageOf(a)].r + STAGES[stageOf(b)].r) * PX * 0.8;
      const dx = vb.x - va.x;
      if (Math.abs(dx) > reach || Math.abs(va.y - vb.y) > 30) continue;
      const k = pairKey(a, b);
      if ((pairCool.get(k) || 0) > now) continue;
      pairCool.set(k, now + 4);
      const dir = Math.sign(dx) || 1;
      va.vx -= dir * 160; va.vy = Math.min(va.vy, -200); va.sv += 2;
      vb.vx += dir * 160; vb.vy = Math.min(vb.vy, -200); vb.sv += 2;
      const da = dirtLevel(a, stageOf(a)) >= 2, db = dirtLevel(b, stageOf(b)) >= 2;
      if (da !== db) say(da ? vb : va, pick(['으, 냄새..', '꼬질이다!', '씻고 와~']), 2);   // 꼬질한 친구는 피한다
      else if (moodOf(a) !== 'sad' && moodOf(b) !== 'sad' && Math.random() < 0.6) greet(a, va, b, vb);
      else setEmote(Math.random() < 0.5 ? va : vb, 'exclaim', 1);
    }
  }
  // 가끔 한 마리가 다른 말랑이에게 놀러 간다
  if ((meetT -= dt) > 0) return;
  meetT = rand(20, 40);
  const free = state.pets.filter((p) => stageOf(p) !== 'egg' && !p.sleeping && !p.sick && viewOf(p).goalT <= 0 && !viewOf(p).held && !viewOf(p).fishing);
  if (free.length < 2 || ball) return;
  const a = pick(free), b = pick(free.filter((x) => x !== a));
  const va = viewOf(a), vb = viewOf(b);
  va.meet = b.id;
  va.goal = vb.x - Math.sign(vb.x - va.x) * 36;
  va.goalT = 10;
  va.hopT = 0;
  setEmote(va, 'note', 1.2);
}

// ===================== 공놀이 =====================
const BALL_R = 9;
let ball = null;   // { x, y, vx, vy, t, hits, held, cool }

function startBall(v) {
  if (ball) { ball.t = 20; return; }
  ball = { x: clamp(v.x + v.face * 90, 40, W - 40), y: Math.max(40, v.y - 200), vx: 0, vy: 0, t: 20, hits: 0, held: false, cool: 0 };
  toast('공놀이 시작! 공을 끌어서 던져 줘도 돼요');
}

const ballAt = (pt) => !!ball && Math.hypot(pt.x - ball.x, pt.y - ball.y) < BALL_R + 8;

function updateBall(dt) {
  if (!ball) return;
  const b = ball;
  b.cool -= dt;
  if ((b.t -= dt) <= 0) {
    emit(b.x, b.y, 'sparkle', { n: 4, spread: 60, up: 120 });
    toast(b.hits ? `공놀이 끝! 모두 ${b.hits}번 찼어요` : '공놀이 끝!');
    ball = null;
    return;
  }
  if (b.held) {
    const idt = 1 / Math.max(dt, 1e-3);
    b.vx = b.vx * 0.6 + (mouse.x - b.x) * idt * 0.4;
    b.vy = b.vy * 0.6 + (mouse.y - b.y) * idt * 0.4;
    b.x = clamp(mouse.x, BALL_R, W - BALL_R);
    b.y = clamp(mouse.y, BALL_R, floorY() - BALL_R);
    return;
  }
  b.vy += GRAVITY * 0.8 * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  const fy = floorY() - BALL_R;
  if (b.y >= fy) {
    b.y = fy;
    b.vy = Math.abs(b.vy) > 120 ? -b.vy * 0.6 : 0;
    b.vx *= Math.pow(0.2, dt);
  }
  if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx) * 0.7; }
  if (b.x > W - BALL_R) { b.x = W - BALL_R; b.vx = -Math.abs(b.vx) * 0.7; }
  if (b.y < BALL_R) { b.y = BALL_R; b.vy = Math.abs(b.vy) * 0.5; }

  // 말랑이가 공에 닿으면 톡 찬다
  if (b.cool > 0) return;
  for (const p of [...state.pets, ...visitors.map((x) => x.pet)]) {
    const v = viewOf(p), g = v.geo;
    if (!g || p.sleeping || v.held || stageOf(p) === 'egg') continue;
    const dx = (b.x - g.cx) / (g.rx + BALL_R), dy = (b.y - g.cy) / (g.ry + BALL_R);
    if (dx * dx + dy * dy > 1) continue;
    b.vx = (Math.sign(b.x - g.cx) || v.face) * rand(250, 450);
    b.vy = -rand(450, 650);
    b.cool = 0.3;
    b.hits++;
    v.sv += 2; v.squint = 0.6;
    v.playT = Math.max(v.playT, 1.5);
    if (Math.random() < 0.4) setEmote(v, 'note', 1);
    if (!p.visitor) {
      p.happy += 4; p.energy -= 1.5; p.hunger -= 1; p.clean -= 0.8;
      p.care.play += 0.25;
      clampStats(p);
    }
    break;
  }
}

function drawBall(c) {
  if (ball.t < 3 && Math.floor(ball.t * 8) % 2) return;   // 끝나갈 때 깜빡깜빡
  drawSprite(c, 'ball', ball.x, ball.y + 4, 3);
}

// ===================== 빗자루로 응가 치우기 =====================
const SWEEP_TIME = 1.1;
const sweeps = [];   // { p, f, x, t, delay } — f는 응가 위치(0~1)
const sweepOf = (p, f) => sweeps.find((s) => s.p === p && s.f === f);

function sweepPoop(p, f, delay = 0) {
  if (sweepOf(p, f)) return;
  sweeps.push({ p, f, x: poopX(f), t: 0, delay });
}

function drawPoops(c) {
  for (const p of state.pets) {
    for (const f of p.poops) {
      const s = sweepOf(p, f);
      const live = s && s.delay <= 0;
      // 쓸리는 동안 들썩이다가 막판엔 깜빡이며 사라진다
      if (live && s.t > SWEEP_TIME * 0.7 && Math.floor(s.t * 20) % 2) continue;
      const jit = live ? Math.round(Math.sin(s.t * 40)) * 2 : 0;
      drawSprite(c, 'poop', poopX(f) + jit, floorY() - 2, 2);
    }
  }
}

function updateSweeps(c, dt) {
  for (let i = sweeps.length - 1; i >= 0; i--) {
    const s = sweeps[i];
    if (s.delay > 0) { s.delay -= dt; continue; }
    s.t += dt;
    const k = s.t / SWEEP_TIME;
    if (k >= 1 || !state.pets.includes(s.p)) {
      const j = s.p.poops.indexOf(s.f);
      if (j >= 0) s.p.poops.splice(j, 1);
      emit(s.x, floorY() - 12, 'sparkle', { n: 3, spread: 50, up: 120 });
      sweeps.splice(i, 1);
      persist();
      continue;
    }
    // 위에서 쓱 내려와서 좌우로 슥슥 세 번
    const sw = Math.sin(k * Math.PI * 6), dir = Math.cos(k * Math.PI * 6);
    const bx = s.x + 10 + sw * 16;
    const drop = k < 0.12 ? (0.12 - k) * 200 : 0;
    drawSprite(c, dir > 0 ? 'broom' : 'broomL', bx, floorY() + 2 - drop, 3);
    if (!drop && Math.random() < dt * 12) {
      emit(bx - dir * 12, floorY() - 4, 'puff', { n: 1, spread: 50, up: 50, life: 0.5, gravity: 60 });
    }
  }
}

function updateParticles(c, dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const q = particles[i];
    q.life -= dt;
    if (q.life <= 0) { particles.splice(i, 1); continue; }
    q.vy += q.g * dt;
    q.vx *= Math.pow(0.3, dt);
    q.x += q.vx * dt; q.y += q.vy * dt;
    // 사라질 때 깜빡깜빡
    if (q.life < 0.35 && Math.floor(q.life * 20) % 2) continue;
    drawSprite(c, q.sprite, q.x, q.y, q.px);
  }
}

// ===================== 꼬질꼬질 · 문질문질 =====================
// 꼬질한 말랑이 주변엔 냄새가 피어오르고, 아주 꼬질하면 파리가 맴돈다
function drawGrime(c, t, dt) {
  for (const p of state.pets) {
    const v = viewOf(p), g = v.geo;
    if (!g || v.inside) continue;
    const lv = dirtLevel(p, stageOf(p));
    if (lv >= 2 && Math.random() < dt * 1.2) {
      emit(g.cx + rand(-g.rx, g.rx), g.top + 18, 'stink', { n: 1, spread: 10, up: 30, life: 1.2, gravity: -10 });
    }
    if (lv >= 3) {
      for (let i = 0; i < 2; i++) {
        const a = t * (3 + i) + i * 2.5 + v.wob;
        drawSprite(c, 'fly', g.cx + Math.cos(a) * (g.rx + 14), g.top + 22 + Math.sin(a * 1.7) * 10, 2);
      }
    }
  }
}

// 꼬질한 말랑이 위에서 마우스를 좌우로 문지르면 뽀득뽀득 씻겨진다
let scrub = { id: null, x: 0, dir: 0, n: 0 };
function updateScrub() {
  const p = !mouse.down && hoverId ? state.pets.find((x) => x.id === hoverId) : null;
  if (!p || p.sleeping || stageOf(p) === 'egg' || p.clean >= 100) { scrub.id = null; return; }
  if (scrub.id !== p.id) { scrub = { id: p.id, x: mouse.x, dir: 0, n: 0 }; return; }
  const dx = mouse.x - scrub.x;
  if (Math.abs(dx) < 8) return;
  scrub.x = mouse.x;
  if (Math.sign(dx) === scrub.dir) return;
  scrub.dir = Math.sign(dx);
  if (++scrub.n < 2) return;   // 한 번 스친 건 빼고, 왔다 갔다 해야 문지르기
  const v = viewOf(p);
  const was = p.clean;
  p.clean = clamp(p.clean + 3, 0, 100);
  v.sv += 0.8;
  v.squint = 0.4;
  emit(mouse.x, mouse.y, 'ring', { n: 1, spread: 40, up: 70, gravity: -40, life: 0.8 });
  if (scrub.n % 7 === 0) say(v, pick(['간질간질', '시원해~', '뽀득뽀득', '거기 거기!']), 1.5);
  if (was < 100 && p.clean >= 100) {
    p.care.clean++;
    p.happy = clamp(p.happy + 5, 0, 100);
    setEmote(v, 'sparkle', 2);
    emit(v.x, v.y - 30, 'sparkle', { n: 5, spread: 80, up: 160 });
    toast(`${josa(p.name, '이', '가')} 뽀득뽀득 깨끗해졌어요!`);
    persist();
  }
}

// ===================== 집중 모드 낚시 =====================
// 집중 모드를 켜면 대표 말랑이가 오른쪽 구석 작은 연못으로 가서 낚시를 한다.
// 가끔 찌가 쏙 들어가면 물고기나 쓰레기를 낚아 올린다.
// 이스터에그: 놀러 온 친구도 집중 중이면 친구네 말랑이가 맞은편에서 같이 낚시한다.
const POND_RX = 14, POND_RY = 3;   // 연못 크기 (칸, 1칸 = 3px)
const CATCHES = [
  { sprite: 'fish', fish: true, w: 6 },
  { sprite: 'fishBig', fish: true, w: 2 },
  { sprite: 'boot', fish: false, w: 1.5 },
  { sprite: 'can', fish: false, w: 1.5 },
];
// side: 연못 어느 쪽에 서는지 (-1 왼쪽에서 오른쪽을 봄, +1 오른쪽에서 왼쪽을 봄)
const makeAngler = (side) => ({ id: null, side, phase: 'off', t: 0, item: null, fish: 0, trash: 0 });
const fishing = makeAngler(-1);       // 내 말랑이
const buddyFishing = makeAngler(1);   // 같이 집중 중인 친구네 말랑이
const pondX = () => Math.max(160, W - 100);
const anglerSpot = (a) => pondX() + a.side * (POND_RX * 3 + 26);
const bobberX = (a) => pondX() + a.side * 12;
const fisher = () => (fishing.id && state.pets.find((p) => p.id === fishing.id)) || null;
const buddyVis = () => (buddyFishing.id && visitors.find((x) => x.pet.id === buddyFishing.id)) || null;
const anglerPet = (a) => (a === fishing ? fisher() : (buddyVis() || {}).pet || null);

function pickCatch() {
  let r = Math.random() * CATCHES.reduce((s, c) => s + c.w, 0);
  for (const c of CATCHES) if ((r -= c.w) <= 0) return c;
  return CATCHES[0];
}

function stopAngler(a) {
  const p = anglerPet(a);
  if (p) { const v = viewOf(p); v.fishing = false; v.goal = null; v.goalT = 0; }
  a.id = null;
  a.phase = 'off';
  a.item = null;
}
const stopFishing = () => { stopAngler(fishing); stopAngler(buddyFishing); };

function updateFishing(dt) {
  if (!state.focus) { if (fishing.id || buddyFishing.id) stopFishing(); return; }
  // 낚시꾼이 잠들면 다른 깨어 있는 말랑이가 이어서 한다
  const p = fisher();
  if (!p || p.sleeping || stageOf(p) === 'egg' || viewOf(p).inside) {
    if (p) stopAngler(fishing);
    const next = [selected(), ...state.pets].find((x) => x && stageOf(x) !== 'egg' && !x.sleeping && !viewOf(x).inside);
    if (next) { fishing.id = next.id; fishing.phase = 'walk'; }
  }
  if (fishing.id) stepAngler(fishing, fisher(), dt);

  // 친구도 집중 중이면 놀러 온 친구네 말랑이가 맞은편에서 같이
  const ok = (x) => x && !x.v.inside && !x.pet.sleeping && (friendStatus.get(x.code) || {}).focus;
  if (buddyFishing.id && !ok(buddyVis())) stopAngler(buddyFishing);
  if (!buddyFishing.id && fishing.id) {
    const vis = visitors.find(ok);
    if (vis) {
      buddyFishing.id = vis.pet.id;
      buddyFishing.phase = 'walk';
      toast(`${vis.nick}님도 집중 중! 같이 낚시해요`);
    }
  }
  if (buddyFishing.id) stepAngler(buddyFishing, buddyVis().pet, dt);
}

function stepAngler(a, p, dt) {
  const v = viewOf(p);
  const spot = anglerSpot(a);
  if (v.held) { v.fishing = false; a.phase = 'walk'; return; }
  if (a.phase === 'walk') {
    v.fishing = false;
    if (Math.abs(v.x - spot) < 24 && v.grounded) {
      a.phase = 'cast';
      a.t = 0.6;
      v.fishing = true;
      v.goalT = 0;
    } else if (v.goalT <= 0) {
      v.goal = spot; v.goalT = 30; v.hopT = Math.min(v.hopT, 0.3);
    }
    return;
  }
  // 낚시 중엔 제자리에서 연못 쪽을 본다 (밀려나면 다시 걸어간다)
  v.fishing = true;
  v.fishFace = -a.side;
  v.face = v.fishFace;
  if (Math.abs(v.x - spot) > 40) { a.phase = 'walk'; return; }
  a.t -= dt;
  if (a.t > 0) return;
  if (a.phase === 'cast') {
    a.phase = 'wait';
    a.t = rand(12, 25);
  } else if (a.phase === 'wait') {
    a.phase = 'bite';
    a.t = 1.2;
    setEmote(v, 'exclaim', 1.2);
  } else if (a.phase === 'bite') {
    // 휙! 낚아 올린다
    a.phase = 'reel';
    a.t = 0.9;
    a.item = pickCatch();
    v.vy = -280; v.sv -= 2;
    emit(bobberX(a), floorY() - 8, 'drop', { n: 3, spread: 50, up: 120, gravity: 600 });
  } else if (a.phase === 'reel') {
    // 낚싯줄 끝에 매달고 잠깐 자랑
    a.phase = 'show';
    a.t = 1.6;
    const fish = a.item.fish;
    if (fish) a.fish++; else a.trash++;
    if (!p.visitor) p.happy = clamp(p.happy + (fish ? 3 : -1), 0, 100);
    emit(v.x, v.y - 40, fish ? 'heart' : 'sadDrop', { n: fish ? 2 : 1, spread: 40, up: 100 });
    // 같이 낚시하는 친구는 박수
    const other = anglerPet(a === fishing ? buddyFishing : fishing);
    if (other && fish) { const ov = viewOf(other); ov.sv += 2; emit(ov.x, ov.y - 40, 'note', { n: 1, spread: 20, up: 90 }); }
  } else if (a.phase === 'show') {
    if (a.item) emit(...rodTip(v, a), a.item.fish ? 'sparkle' : 'puff', { n: 3, spread: 40, up: 80 });
    a.item = null;
    a.phase = 'cast';
    a.t = 0.6;
  }
}

// 낚싯대 끝 위치 (연못 쪽 위)
function rodTip(v, a) {
  const g = v.geo, dir = -a.side;
  const swing = a.phase === 'cast' ? -10 : a.phase === 'reel' || a.phase === 'show' ? -6 : 0;
  return g ? [g.cx + dir * (g.rx + 30 + swing), g.cy - 24 + swing] : [v.x + dir * 40, v.y - 50];
}

function drawPond(c, t) {
  if (!state.focus) return;
  const px = 3, cx = snap(pondX(), px), cy = snap(floorY() + 2, px);
  const water = '#7FC4EC', deep = '#5FA8D6';
  const cells = new Cells();
  for (let y = -POND_RY; y < POND_RY; y++) {
    for (let x = -POND_RX; x < POND_RX; x++) {
      const dx = (x + 0.5) / POND_RX, dy = (y + 0.5) / POND_RY;
      if (dx * dx + dy * dy <= 1) cells.set(x, y, y >= 0 ? deep : water);
    }
  }
  // 반짝이는 물결
  for (let i = 0; i < 3; i++) {
    const x = Math.round(((t * 2 + i * 9) % (POND_RX * 2 - 6)) - POND_RX + 3);
    if (cells.has(x, -1)) { cells.set(x, -1, T.shine); cells.set(x + 1, -1, T.shine); }
  }
  cells.outline(T.outline).draw(c, cx, cy, px);
  // 연잎 · 부들
  drawSprite(c, 'lily', cx + 6 * px, cy - 1 * px, px);
  drawSprite(c, 'reed', cx - (POND_RX - 2) * px, cy, px);
  drawSprite(c, 'reed', cx - (POND_RX - 4) * px, cy + px, px);
}

function drawAngler(c, a, t) {
  const p = anglerPet(a);
  if (!p) return;
  const v = viewOf(p);
  if (!v.fishing || !v.geo) return;
  const [tx, ty] = rodTip(v, a);
  const g = v.geo, dir = -a.side;
  // 낚싯대: 말랑이 옆구리에서 위로 비스듬히
  const bx = g.cx + dir * (g.rx - 2), by = g.cy;
  c.fillStyle = T.pot;
  for (let i = 0; i <= 24; i++) {
    c.fillRect(snap(bx + ((tx - bx) * i) / 24, 2) - 1, snap(by + ((ty - by) * i) / 24, 2) - 1, 3, 3);
  }
  // 찌: 기다릴 땐 둥실, 입질엔 쏙쏙
  const wx = bobberX(a);
  let wy = floorY() - 4;
  if (a.phase === 'wait') wy += Math.sin(t * 2.5 + a.side) > 0.6 ? 2 : 0;
  if (a.phase === 'bite') wy += Math.floor(t * 10) % 2 ? 6 : 0;
  // 낚아 올리는 중엔 걸린 것이 물에서 낚싯대 끝으로 휙
  let ex = wx, ey = wy;
  if (a.phase === 'reel' && a.item) {
    const k = 1 - a.t / 0.9;
    ex = wx + (tx - wx) * k;
    ey = wy + (ty + 26 - wy) * k - Math.sin(k * Math.PI) * 50;
  } else if (a.phase === 'show') {
    ex = tx; ey = ty + 26 + Math.sin(t * 12) * 2;   // 대롱대롱 (물고기는 파닥파닥)
  }
  c.strokeStyle = T.outline;
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(tx + 0.5, ty + 0.5);
  c.lineTo(ex + 0.5, ey - 4.5);
  c.stroke();
  if ((a.phase === 'reel' || a.phase === 'show') && a.item) drawSprite(c, a.item.sprite, ex, ey + 6, 2);
  else drawSprite(c, 'bobber', ex, ey, 2);
}

function drawFishing(c, t) {
  if (!state.focus) return;
  drawAngler(c, fishing, t);
  drawAngler(c, buddyFishing, t);
}

// 어질어질한 말랑이 머리 위를 도는 별
function drawDizzy(c, t) {
  for (const v of [...state.pets.map(viewOf), ...visitors.map((x) => x.v)]) {
    if (!(v.dizzyT > 0) || !v.geo || v.inside) continue;
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + (i * Math.PI * 2) / 3;
      drawSprite(c, 'sparkle', v.geo.cx + Math.cos(a) * (v.geo.rx + 6), v.geo.top + 16 + Math.sin(a) * 5, 2);
    }
  }
}

// ===================== 메인 루프 =====================
let lastFrame = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  const t = now / 1000;
  const fy = floorY();

  ctx.clearRect(0, 0, W, H);
  if (homeMark.shakeT > 0) homeMark.shakeT -= dt;
  drawPond(ctx, t);
  drawHomeMark(ctx, t);
  drawPoops(ctx);
  updateSweeps(ctx, dt);
  updateFishing(dt);
  for (const p of state.pets) updateView(p, viewOf(p), dt);
  updateVisitors(dt);
  socialize(dt, t);
  updateBall(dt);
  updateFoods(dt);

  // 선택된 말랑이(와 들고 있는 말랑이)를 맨 위에 그린다
  const order = [...state.pets].sort((a, b) => {
    const score = (p) => (viewOf(p).held ? 2 : 0) + (p.id === state.selectedId ? 1 : 0);
    return score(a) - score(b);
  });
  for (const vis of visitors) {
    if (vis.v.inside) {
      if (vis.v.enterT > 0 && Math.floor(vis.v.enterT * 16) % 2) drawPet(ctx, vis.pet, vis.v, stageOf(vis.pet), t, fy);
      vis.v.geo = null;
      continue;
    }
    drawPet(ctx, vis.pet, vis.v, stageOf(vis.pet), t, fy);
  }
  for (const p of order) {
    const v = viewOf(p);
    if (v.inside) {
      // 현관으로 들어가는 중: 깜빡깜빡하다 쏙
      if (v.enterT > 0 && Math.floor(v.enterT * 16) % 2) drawPet(ctx, p, v, stageOf(p), t, fy);
      v.geo = null;
      continue;
    }
    drawPet(ctx, p, v, stageOf(p), t, fy);
  }
  if (ball) drawBall(ctx);
  for (const f of foods) drawSprite(ctx, f.sprite, f.x, f.y, PX);
  drawGrime(ctx, t, dt);
  drawFishing(ctx, t);
  drawDizzy(ctx, t);
  updateScrub();
  updateParticles(ctx, dt);

  const cardFor = card.hidden ? null : state.selectedId;
  const talker = focusPet();
  const focusP = state.focus ? talker : null;
  for (const p of order) {
    const v = viewOf(p);
    if (!v.geo || v.held) continue;
    if (p.id === hoverId || p.id === cardFor) {
      const fishy = v.fishing && (fishing.fish || fishing.trash) ? ` · 물고기 ${fishing.fish} · 쓰레기 ${fishing.trash}` : '';
      drawLabel(ctx, p.name + fishy, v.geo.cx, v.geo.top - 14);
      continue;
    }
    // 집중 모드 말풍선이 먼저(맨 아래), 쪽지 말풍선은 그 위로 쌓인다
    if (p === talker && (focusP || myChat.length)) continue;
    const icon = v.emote ? v.emote.icon : p.sleeping ? 'zee' : null;
    if (icon) drawCloud(ctx, v.geo.cx, v.geo.top, icon, t);
    else if (v.speech) drawSpeech(ctx, v.speech.text, v.geo.cx, v.geo.top);
  }
  // 내 말랑이(다들 자고 있으면 집 표지) 위: 집중 중 → 쪽지들
  ageChat(myChat, dt);
  const tv = talker && viewOf(talker);
  const anchor = tv ? (tv.geo && !tv.held && talker.id !== hoverId && talker.id !== cardFor ? { cx: tv.geo.cx, top: tv.geo.top } : null)
    : homeMark.geo ? { cx: homeMark.geo.x + homeMark.geo.w / 2, top: homeMark.geo.y } : null;
  if (anchor) {
    let top = anchor.top;
    if (state.focus) top = drawSpeech(ctx, '집중 중', anchor.cx, top, 'focus');
    if (myChat.length) drawChat(ctx, myChat, anchor.cx, top);
  }
  // 놀러 온 친구네 말랑이는 쪽지(와 사진)를 말풍선으로 보여 준다
  for (const vis of visitors) {
    const v = vis.v;
    if (!v.geo) continue;
    if (vis.pet.id === hoverVisitor) { drawLabel(ctx, `${vis.nick}의 ${vis.pet.name}`, v.geo.cx, v.geo.top - 14); continue; }
    // 친구가 집중 중이면 집중 말풍선이 먼저, 쪽지는 그 위로. 평소엔 그냥 같이 논다
    const st = friendStatus.get(vis.code) || {};
    let top = v.geo.top;
    if (st.focus) top = drawSpeech(ctx, '집중 중', v.geo.cx, top, 'focus');
    if (vis.chat.length) drawChat(ctx, vis.chat, v.geo.cx, top);
    else if (!st.focus && v.emote) drawCloud(ctx, v.geo.cx, top, v.emote.icon, t);
    else if (!st.focus && vis.pet.sleeping) drawCloud(ctx, v.geo.cx, top, 'zee', t);
  }

  if (home.hidden && overHomeMark(mouse) && !hoverId && !(mouse.down && mouse.down.dragging)) {
    const zzz = state.pets.filter((p) => p.sleeping && viewOf(p).inside).length;
    const label = (state.markLocked ? '말랑이네 · 고정됨' : '말랑이네') + (zzz ? ` · 쿨쿨 ${zzz}` : '');
    drawLabel(ctx, label, homeMark.geo.x + homeMark.geo.w / 2, homeMark.geo.y - 12);
  }
  if (!home.hidden) drawRoom(t, dt);
  updateFriendHouse(t, dt);

  placeCard();
  placeHome();
  placeFriends();
  updateHover();
  if (!modal.hidden) drawPreview(t);
  requestAnimationFrame(frame);
}

// ===================== 클릭 통과 처리 =====================
// 말랑이·응가·집 표지·카드 위에 마우스가 있을 때만 창이 클릭을 받는다.
let ignoring = true;
function setInteractive(on) {
  if (on === !ignoring) return;
  ignoring = !on;
  window.malang.setIgnore(!on);
}

function overUi(x, y) {
  const el = document.elementFromPoint(x, y);
  return !!(el && el.closest('.ui'));
}

function updateHover() {
  const pt = { x: mouse.x, y: mouse.y };
  const p = petAt(pt);
  hoverId = p ? p.id : null;
  const vis = p ? null : visitorAt(pt);
  hoverVisitor = vis ? vis.pet.id : null;
  const onBall = !p && ballAt(pt);
  const onMark = !p && !vis && overHomeMark(pt);
  const clickable = p || vis || onBall || poopAt(pt) || onMark;
  setInteractive(!!(mouse.down || uiDrag || clickable || overUi(pt.x, pt.y)));
  canvas.style.cursor = mouse.down && mouse.down.dragging ? 'grabbing'
    : p || vis || onBall || (onMark && !state.markLocked) ? 'grab' : clickable ? 'pointer' : 'default';
}

window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
document.addEventListener('mouseleave', () => {
  if (!mouse.down) { mouse.x = -9999; mouse.y = -9999; }
});

// ===================== 마우스 =====================
function petAt(pt) {
  const sorted = [...state.pets].reverse().sort((a, b) => (b.id === state.selectedId) - (a.id === state.selectedId));
  for (const p of sorted) {
    const g = viewOf(p).geo;
    if (!g) continue;
    const dx = (pt.x - g.cx) / (g.rx + 6), dy = (pt.y - g.cy) / (g.ry + 6);
    if (dx * dx + dy * dy <= 1) return p;
  }
  return null;
}

function poopAt(pt) {
  for (const p of state.pets) {
    for (let i = 0; i < p.poops.length; i++) {
      if (sweepOf(p, p.poops[i])) continue;
      const x = poopX(p.poops[i]);
      if (Math.abs(pt.x - x) < 14 && pt.y > floorY() - 20 && pt.y < floorY() + 6) return { p, i };
    }
  }
  return null;
}

canvas.addEventListener('pointerdown', (e) => {
  mouse.x = e.clientX; mouse.y = e.clientY;
  const pt = { x: mouse.x, y: mouse.y };
  const p = petAt(pt);
  if (p) {
    mouse.down = { id: p.id, x: pt.x, y: pt.y, dragging: false };
    canvas.setPointerCapture(e.pointerId);
    return;
  }
  if (ballAt(pt)) {
    ball.held = true;
    mouse.down = { ball: true, x: pt.x, y: pt.y, dragging: true };
    canvas.setPointerCapture(e.pointerId);
    return;
  }
  const vis = visitorAt(pt);
  if (vis) {
    // 놀러 온 말랑이도 들어서 옮길 수 있다 (안 움직이고 떼면 클릭)
    mouse.down = { visitor: vis, x: pt.x, y: pt.y, dragging: false };
    canvas.setPointerCapture(e.pointerId);
    return;
  }
  const hit = poopAt(pt);
  if (hit) {
    sweepPoop(hit.p, hit.p.poops[hit.i]);
    hit.p.clean = clamp(hit.p.clean + 5, 0, 100);
    return;
  }
  if (overHomeMark(pt)) {
    if (state.markLocked) return toggleHome();
    // 고정이 풀려 있으면 끌어서 옮길 수 있다 (안 움직이고 떼면 클릭)
    mouse.down = { mark: true, x: pt.x, y: pt.y, offX: pt.x - homeMark.ox, offY: pt.y - homeMark.oy, dragging: false };
    canvas.setPointerCapture(e.pointerId);
  }
});

canvas.addEventListener('pointermove', (e) => {
  mouse.x = e.clientX; mouse.y = e.clientY;
  const d = mouse.down;
  if (d && d.ball) return;
  if (d && d.visitor) {
    if (!d.dragging && Math.hypot(mouse.x - d.x, mouse.y - d.y) > 6) {
      d.dragging = true;
      d.visitor.v.held = true;
      d.visitor.v.fishing = false;
    }
    return;
  }
  if (d && d.mark) {
    if (!d.dragging && Math.hypot(mouse.x - d.x, mouse.y - d.y) > 6) d.dragging = true;
    if (d.dragging) {
      const x = clamp(mouse.x - d.offX, 4, W - MARK_W - 4), y = clamp(mouse.y - d.offY, 4, H - MARK_H - 4);
      state.mark = { x: x / W, y: y / H };
    }
    return;
  }
  if (d && !d.dragging && Math.hypot(mouse.x - d.x, mouse.y - d.y) > 6) {
    const p = state.pets.find((x) => x.id === d.id);
    if (!p) { mouse.down = null; return; }
    if (p.sleeping) {
      toast(`${josa(p.name, '이', '가')} 곤히 자고 있어요`);
      mouse.down = null;
      return;
    }
    d.dragging = true;
    viewOf(p).held = true;
    closeCard();
  }
});

canvas.addEventListener('pointerup', () => {
  const d = mouse.down;
  mouse.down = null;
  if (!d) return;
  if (d.ball) {
    if (ball) {
      ball.held = false;
      ball.vx = clamp(ball.vx, -1400, 1400);
      ball.vy = clamp(ball.vy, -1400, 1400);
    }
    return;
  }
  if (d.mark) {
    if (d.dragging) persist();
    else toggleHome();
    return;
  }
  if (d.visitor) {
    const v = d.visitor.v;
    if (d.dragging) {
      v.held = false;
      v.vx = clamp(v.vx, -1600, 1600);
      v.vy = clamp(v.vy, -1600, 1600);
    } else {
      visitorClicked(d.visitor);
    }
    return;
  }
  const p = state.pets.find((x) => x.id === d.id);
  if (!p) return;
  const v = viewOf(p);
  if (d.dragging) {
    v.held = false;
    v.vx = clamp(v.vx, -1600, 1600);
    v.vy = clamp(v.vy, -1600, 1600);
    if (Math.hypot(v.vx, v.vy) > 1200 && stageOf(p) !== 'egg') {
      p.happy = clamp(p.happy - 2, 0, 100);
      setEmote(v, 'exclaim');
    }
  } else {
    poke(p, v);
    openCard(p.id);
  }
});

function poke(p, v) {
  v.sv += 3.5;
  if (stageOf(p) === 'egg' || p.sleeping) return;
  const now = performance.now();
  if (now - v.lastPoke > 800) {
    p.happy = clamp(p.happy + 2, 0, 100);
    v.lastPoke = now;
  }
  v.squint = 0.5;
  setEmote(v, 'heart');
}

// ===================== 돌봄 카드 =====================
const card = $('card');

function selected() {
  return state.pets.find((p) => p.id === state.selectedId) || null;
}

function openCard(id) {
  state.selectedId = id;
  card.hidden = false;
  refreshCard();
  placeCard();
}

function closeCard() {
  card.hidden = true;
}

// 카드는 말랑이 머리 위에 붙어서 따라다닌다
function placeCard() {
  if (card.hidden) return;
  const p = selected();
  const v = p && viewOf(p);
  const w = card.offsetWidth, h = card.offsetHeight;
  if (v && v.inside) {
    // 집 안에서 자는 말랑이: 집 창 옆에 붙여서 연다 (집 창을 가리지 않게)
    if (home.hidden) return closeCard();
    const r = home.getBoundingClientRect();
    const left = r.left - w - 14 >= 10 ? r.left - w - 14 : r.right + 14;
    card.style.left = Math.round(clamp(left, 10, W - w - 10)) + 'px';
    card.style.top = Math.round(clamp(r.bottom - h, 10, H - h - 10)) + 'px';
    return;
  }
  const g = v && v.geo;
  if (!g) return closeCard();
  card.style.left = Math.round(clamp(g.cx - w / 2, 10, W - w - 10)) + 'px';
  card.style.top = Math.round(clamp(g.top - h - 34, 10, H - h - 10)) + 'px';
}

// ===================== 말랑이네 (집 창) =====================
const home = $('home');
const roomCanvas = $('room');
const roomCtx = roomCanvas.getContext('2d');
const RW = roomCanvas.width, RH = roomCanvas.height;
const ROOM_FLOOR = 118;        // 방 안 말랑이 발 위치
const BED_TOP = 96;
const roomViews = new Map();   // 방 안 말랑이 움직임 (바탕화면과 따로 논다)
let homePos = null;            // 제목줄을 끌어서 옮긴 위치
let uiDrag = false;

function toggleHome() {
  home.hidden = !home.hidden;
  if (!home.hidden) { closeCard(); refreshHome(); placeHome(); }
}

function placeHome() {
  if (home.hidden) return;
  const w = home.offsetWidth, h = home.offsetHeight;
  // 표지를 숨겼으면 오른쪽 아래에 연다
  const g = homeMark.geo || { x: W - 20, y: floorY(), w: 0 };
  const left = homePos ? homePos.x : g.x + g.w - w;
  const top = homePos ? homePos.y : g.y - h - 14;
  home.style.left = Math.round(clamp(left, 10, W - w - 10)) + 'px';
  home.style.top = Math.round(clamp(top, 10, H - h - 10)) + 'px';
}

function refreshHome() {
  if (home.hidden) return;
  $('homeCount').textContent = `식구 ${state.pets.length}/${MAX_PETS}`;
  const wl = weatherText();
  if ($('wLine').textContent !== wl) $('wLine').textContent = wl;
}

function roomViewOf(p, map = roomViews) {
  let rv = map.get(p.id);
  if (!rv) {
    rv = {
      x: rand(30, 170), y: ROOM_FLOOR, vx: 0, vy: 0, s: 0, sv: 0,
      face: 1, wob: Math.random() * 10, blink: 0, blinkT: rand(1, 4),
      squint: 0, eatT: 0, playT: 0, held: false, hopT: rand(0.5, 3), geo: null,
    };
    map.set(p.id, rv);
  }
  return rv;
}

// 2px 테두리를 두른 네모
function rectO(c, x, y, w, h, color) {
  c.fillStyle = T.outline;
  c.fillRect(x - 2, y - 2, w + 4, h + 4);
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

// ===================== 창밖 (날씨 · 시간 · 달) =====================
const WIN = { x: 18, y: 12, w: 60, h: 50 };
const WEATHER_KO = { clear: '맑음', partly: '구름 조금', cloudy: '흐림', fog: '안개', rain: '비', snow: '눈', storm: '천둥번개' };
const MOON_KO = ['삭 (달이 숨었어요)', '초승달', '상현달', '차오르는 달', '보름달', '기우는 달', '하현달', '그믐달'];
let weather = { kind: 'clear', temp: null, status: 'loading' };
// 창문마다 따로 노는 비·눈·번개 상태 (우리 집, 친구네 집)
const makeSky = () => ({ fallers: [], glassDrops: [], fallKind: null, flashT: 0, flashWait: rand(4, 9) });
const homeSky = makeSky();

// Open-Meteo 날씨 코드(WMO) → 창밖 모습
function weatherKind(code) {
  if (code === 0) return 'clear';
  if (code <= 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'cloudy';
}

// 달의 위상 0~1 (0 삭, 0.5 보름) — 2000-01-06 18:14 UTC 삭을 기준으로 삭망월 29.53일
function moonPhase(now) {
  const days = (now - Date.UTC(2000, 0, 6, 18, 14)) / 86400000;
  return (((days / 29.530588853) % 1) + 1) % 1;
}
const moonName = (ph) => MOON_KO[Math.round(ph * 8) % 8];

const hourF = (now) => { const d = new Date(now); return d.getHours() + d.getMinutes() / 60; };
function skyPhase(h) {
  if (h < 5 || h >= 20) return 'night';
  if (h < 6.5) return 'dawn';
  if (h < 17) return 'day';
  if (h < 18.5) return 'sunset';
  return 'dusk';
}
// 하늘 [위, 아래] — [맑을 때, 흐릴 때]
const SKY = {
  night:  [['#1B2340', '#2E3866'], ['#22252F', '#30333D']],
  dawn:   [['#8FA3D9', '#F4B79A'], ['#8C94A8', '#B8A7A4']],
  day:    [['#7FC4EC', '#C4E7F7'], ['#A3AEB8', '#C6CDD3']],
  sunset: [['#F29A6B', '#F7D08A'], ['#A8968E', '#C9B49E']],
  dusk:   [['#4A4B8C', '#C9809A'], ['#4A4D5E', '#6E6A78']],
};

// 칸 단위 동그라미. lit(nx, ny)가 거짓인 칸은 dim 색으로
function drawDisk(c, cx, cy, R, px, color, lit = null, dim = null) {
  for (let j = -R; j < R; j++) {
    for (let i = -R; i < R; i++) {
      const nx = (i + 0.5) / R, ny = (j + 0.5) / R;
      if (nx * nx + ny * ny > 1) continue;
      const on = !lit || lit(nx, ny);
      if (!on && !dim) continue;
      c.fillStyle = on ? color : dim;
      c.fillRect(cx + i * px, cy + j * px, px, px);
    }
  }
}

// 오늘 밤 달 모양 그대로 (북반구: 차오를 땐 오른쪽부터 밝다)
function drawMoon(c, cx, cy, ph) {
  const k = Math.cos(2 * Math.PI * ph);
  const lit = (nx, ny) => {
    const edge = k * Math.sqrt(1 - ny * ny);
    return ph < 0.5 ? nx > edge : nx < -edge;
  };
  drawDisk(c, snap(cx, 2), snap(cy, 2), 5, 2, '#F7E8A6', lit, 'rgba(255,255,255,0.12)');
}

function drawSun(c, cx, cy, color, t) {
  cx = snap(cx, 2); cy = snap(cy, 2);
  c.fillStyle = color;
  // 햇살이 깜빡깜빡
  const r = Math.sin(t * 2) > 0 ? 14 : 12;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.fillRect(cx + dx * r - 1, cy + dy * r - 1, 2, 2);
  drawDisk(c, cx, cy, 4, 2, color);
}

function drawPixelCloud(c, x, y, w, color) {
  c.fillStyle = color;
  c.fillRect(x, y + 4, w, 6);
  c.fillRect(x + 4, y, Math.round(w * 0.45 / 2) * 2, 6);
  c.fillRect(x + Math.round(w * 0.5 / 2) * 2, y + 2, Math.round(w * 0.36 / 2) * 2, 4);
}

function drawWindow(c, t, dt, kind, sky) {
  const { x, y, w, h } = WIN;
  const now = Date.now();
  const hf = hourF(now);
  const ph = skyPhase(hf);
  const wet = kind === 'rain' || kind === 'storm';
  const gloomy = wet || kind === 'cloudy' || kind === 'snow' || kind === 'fog';
  const dark = ph === 'night' || ph === 'dusk';
  const [top, bottom] = SKY[ph][gloomy ? 1 : 0];

  // 커튼 봉
  c.fillStyle = T.border;
  c.fillRect(x - 14, y - 8, w + 28, 2);
  rectO(c, x, y, w, h, top);
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  // 아래로 갈수록 밝아지는 띠 (도트라 계단식)
  c.fillStyle = bottom;
  for (let i = 0; i < 4; i++) {
    c.globalAlpha = 0.25;
    c.fillRect(x, y + Math.round(h * (0.3 + i * 0.17) / 2) * 2, w, h);
  }
  c.globalAlpha = 1;

  // 맑은 밤엔 별이 반짝
  if (dark && !gloomy) {
    c.fillStyle = '#FFF6D5';
    for (let i = 0; i < 12; i++) {
      if (Math.sin(t * 1.5 + i * 1.7) < -0.4) continue;
      c.fillRect(x + snap((i * 37) % w, 2), y + snap((i * 23) % (h * 0.6), 2), 2, 2);
    }
  }

  // 해 · 달 — 오전/저녁엔 왼쪽 칸, 오후/새벽엔 오른쪽 칸
  const leftPane = x + w * 0.25, rightPane = x + w * 0.75;
  if (kind === 'clear' || kind === 'partly') {
    if (dark) {
      drawMoon(c, hf >= 12 ? leftPane : rightPane, y + h * 0.26, moonPhase(now));
    } else {
      const low = ph === 'day' ? 0 : 1;   // 해 뜰 때·질 때는 낮게, 붉게
      drawSun(c, hf < 12 ? leftPane : rightPane, y + h * (0.26 + low * 0.34), low ? '#FFB36B' : '#FFE08A', t);
    }
  }

  // 구름이 천천히 흘러간다
  const nCloud = { clear: 1, partly: 2, cloudy: 4, fog: 2, rain: 4, snow: 3, storm: 4 }[kind] || 1;
  const cloudCol = gloomy ? (dark ? '#3C4050' : '#8E979F') : dark ? '#4E5578' : '#FFFFFF';
  for (let i = 0; i < nCloud; i++) {
    const cw = 16 + (i % 2) * 8;
    const cx = x - cw + ((t * (2.5 + i * 1.1) + i * 41) % (w + cw * 2));
    drawPixelCloud(c, snap(cx, 2), y + 2 + ((i * 9) % 22), cw, cloudCol);
  }

  // 창밖에 내리는 비 · 눈
  const falling = wet || kind === 'snow' ? kind : null;
  if (falling !== sky.fallKind) { sky.fallers.length = 0; sky.fallKind = falling; }
  if (falling) {
    const snow = falling === 'snow';
    const want = snow ? 18 : falling === 'storm' ? 36 : 26;
    while (sky.fallers.length < want) {
      sky.fallers.push({ x: rand(0, w + 10), y: rand(-h, h), v: snow ? rand(8, 18) : rand(90, 150), ph: rand(0, 6) });
    }
    c.fillStyle = snow ? '#FFFFFF' : 'rgba(225,238,255,0.7)';
    for (const f of sky.fallers) {
      f.y += f.v * dt;
      f.x += snow ? Math.sin(t * 2 + f.ph) * 6 * dt : -f.v * 0.2 * dt;   // 비는 바람에 살짝 비스듬히
      if (f.y > h) { f.y = -6; f.x = rand(0, w + 10); }
      if (f.x < -4) f.x += w + 8;
      if (snow) c.fillRect(x + snap(f.x, 2), y + snap(f.y, 2), 2, 2);
      else c.fillRect(x + Math.round(f.x), y + Math.round(f.y), 1, 5);
    }
  }

  // 안개
  if (kind === 'fog') {
    c.fillStyle = 'rgba(228,230,235,0.45)';
    c.fillRect(x, y, w, h);
    for (let i = 0; i < 3; i++) c.fillRect(x - 30 + snap((t * 4 + i * 25) % (w + 30), 2), y + 12 + i * 12, 30, 4);
  }

  // 번쩍! (천둥번개)
  if (kind === 'storm' && (sky.flashWait -= dt) <= 0) { sky.flashT = 0.2; sky.flashWait = rand(4, 10); }
  if (sky.flashT > 0) {
    c.fillStyle = 'rgba(255,255,235,0.7)';
    c.fillRect(x, y, w, h);
    c.fillStyle = '#FFF4B0';
    const bx = x + w * 0.62;
    [[0, 0], [-2, 4], [0, 8], [-4, 12], [-2, 16], [-6, 20]].forEach(([dx, dy]) => c.fillRect(snap(bx + dx, 2), y + dy, 2, 4));
  }

  // 유리창을 타고 주르륵 흐르는 빗방울
  if (wet) {
    while (sky.glassDrops.length < 7) sky.glassDrops.push({ x: snap(rand(2, w - 4), 2), y: rand(-10, h), v: 0, max: rand(14, 30), wait: rand(0, 3) });
    for (const d of sky.glassDrops) {
      if (d.wait > 0) { d.wait -= dt; d.v = 0; } else d.v = Math.min(d.max, d.v + 30 * dt);
      if (d.v > 0 && Math.random() < dt * 0.5) d.wait = rand(0.3, 1.2);   // 멈칫했다가 다시
      d.y += d.v * dt;
      if (d.y > h + 4) Object.assign(d, { x: snap(rand(2, w - 4), 2), y: rand(-6, h * 0.4), wait: rand(0.5, 2.5), v: 0 });
      c.fillStyle = 'rgba(220,236,255,0.35)';
      c.fillRect(x + d.x, y + d.y - 10, 1, 10);
      c.fillStyle = 'rgba(235,245,255,0.9)';
      c.fillRect(x + d.x - 1, y + Math.round(d.y), 2, 3);
    }
  } else {
    sky.glassDrops.length = 0;
  }
  c.restore();
  if (sky.flashT > 0) sky.flashT -= dt;

  // 창살 + 창틀
  c.fillStyle = T.border;
  c.fillRect(x + w / 2 - 1, y, 2, h);
  c.fillRect(x, y + h / 2 - 1, w, 2);
  rectO(c, x - 4, y + h + 2, w + 8, 2, T.floor);
  // 양옆 커튼 (끈으로 묶어 둠)
  for (const cx of [x - 11, x + w + 6]) {
    rectO(c, cx, y - 6, 5, Math.round(h * 0.55), T.warn);
    rectO(c, cx + 1, y - 6 + Math.round(h * 0.55) + 2, 3, 12, T.warn);
    c.fillStyle = T.hunger;
    c.fillRect(cx - 1, y - 6 + Math.round(h * 0.55), 7, 2);
  }
  return { dark: ph === 'night' ? 0.22 : ph === 'dusk' ? 0.12 : 0, wet };
}

function weatherText() {
  const w = weather.status === 'ok' ? `${WEATHER_KO[weather.kind]} ${weather.temp}°`
    : weather.status === 'fail' ? '날씨를 못 불러왔어요' : '날씨 확인 중..';
  return `${state.weatherLoc.name} · ${w} · 오늘 밤 ${moonName(moonPhase(Date.now()))}`;
}

async function fetchWeather() {
  const { lat, lon } = state.weatherLoc;
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`);
    const cur = (await r.json()).current;
    weather = { kind: weatherKind(cur.weather_code), temp: Math.round(cur.temperature_2m), status: 'ok' };
  } catch {
    if (weather.status !== 'ok') weather.status = 'fail';   // 인터넷이 없으면 맑은 하늘로
  }
  refreshHome();
}

async function setWeatherPlace(q) {
  q = cleanText(q, 30);
  if (!q) return;
  try {
    // '부산'으로만 찾으면 같은 이름의 작은 마을만 나와서 '부산시·부산광역시'로도 찾아보고,
    // 그중 사람이 제일 많이 사는 곳을 고른다 (부산 → 부산광역시)
    const search = async (name) => {
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=10&language=ko&format=json`);
      return (await r.json()).results || [];
    };
    const names = /시$/.test(q) ? [q] : [q, q + '시', q + '광역시', q + '특별시'];
    const g = (await Promise.all(names.map(search))).flat().sort((a, b) => (b.population || 0) - (a.population || 0))[0];
    if (!g) return toast('그런 지역을 못 찾았어요');
    state.weatherLoc = { name: q.slice(0, 20), lat: g.latitude, lon: g.longitude };
    persist();
    $('wEdit').hidden = true;
    weather.status = 'loading';
    refreshHome();
    fetchWeather();
    toast(`이제 ${state.weatherLoc.name} 날씨가 창밖에 보여요`);
  } catch {
    toast('지금은 지역을 찾을 수 없어요. 인터넷을 확인해 주세요');
  }
}

function drawRoomBg(c, t, dt, kind, sky) {
  // 벽 + 벽지 점무늬
  c.fillStyle = T.bg;
  c.fillRect(0, 0, RW, RH);
  c.fillStyle = T.gauge_empty;
  for (let y = 8, row = 0; y < 96; y += 14, row++) {
    for (let x = (row % 2) * 8 + 6; x < RW; x += 16) c.fillRect(x, y, 2, 2);
  }
  const light = drawWindow(c, t, dt, kind, sky);
  // 바닥 (나무 판자)
  const fy = 106;
  c.fillStyle = T.border;
  c.fillRect(0, fy - 4, RW, 4);
  c.fillStyle = T.floor;
  c.fillRect(0, fy, RW, RH - fy);
  c.fillStyle = T.floor_grain;
  for (let y = fy, row = 0; y < RH; y += 11, row++) {
    c.fillRect(0, y + 9, RW, 2);
    for (let x = (row % 2) * 30 + 14; x < RW; x += 60) c.fillRect(x, y, 2, 9);
  }
  // 화분
  rectO(c, 102, 94, 12, 12, T.pot);
  drawSprite(c, 'twin', 108, 90, 2);
  // 밥그릇
  rectO(c, 132, 114, 20, 6, T.pot);
  c.fillStyle = T.hunger;
  c.fillRect(134, 110, 16, 4);
  // 침대: 머리판 · 매트리스 · 베개
  rectO(c, 192, 70, 6, 46, T.pot);
  rectO(c, 192, 70, 6, 4, T.border);
  rectO(c, 200, BED_TOP, 66, 10, T.bg);
  rectO(c, 200, 108, 66, 6, T.pot);
  rectO(c, 202, 88, 14, 7, T.gauge_empty);
  return light;
}

// 이불은 자는 말랑이 위로 덮는다 (눈만 빼꼼)
function drawBlanket(c) {
  rectO(c, 220, BED_TOP - 1, 46, 11, T.fun);
  c.fillStyle = T.bg;
  c.fillRect(220, BED_TOP - 1, 46, 3);
  c.fillStyle = T.leaf;
  for (let x = 226; x < 266; x += 10) c.fillRect(x, BED_TOP + 2, 4, 2);
}

// 우리 집: 내 말랑이들 + 놀러 온 친구네 말랑이
function drawRoom(t, dt) {
  const guests = visitors.filter((x) => x.v.inside).map((x) => x.pet);
  drawRoomScene(roomCtx, [...state.pets, ...guests], roomViews, t, dt, weather.kind, homeSky);
}

function drawRoomScene(c, pets, rviews, t, dt, kind, sky) {
  const light = drawRoomBg(c, t, dt, kind, sky);
  let slot = 0;
  const sleepers = [];
  for (const p of pets) {
    const rv = roomViewOf(p, rviews);
    const st = stageOf(p);
    rv.blinkT -= dt;
    if (rv.blinkT <= 0) { rv.blink = 0.15; rv.blinkT = rand(2, 5); }
    rv.blink = Math.max(0, rv.blink - dt);
    rv.squint = Math.max(0, rv.squint - dt);
    if (rv.shakeT > 0) rv.shakeT = Math.max(0, rv.shakeT - dt);
    if (rv.dizzyT > 0) rv.dizzyT = Math.max(0, rv.dizzyT - dt);

    let ground = ROOM_FLOOR;
    if (p.sleeping) {
      // 자는 말랑이는 침대에 나란히 (넷째부터는 사이사이에)
      ground = BED_TOP + 4;   // 매트리스에 살짝 파묻혀서
      rv.x = 230 + (slot % 3) * 15 + (slot >= 3 ? 7 : 0);
      slot++;
      rv.y = ground; rv.vx = 0; rv.vy = 0;
    } else {
      rv.vy += 900 * dt;
      rv.x += rv.vx * dt;
      rv.y += rv.vy * dt;
      if (rv.y >= ground) {
        if (rv.vy > 120) rv.sv += rv.vy * 0.01;
        rv.y = ground; rv.vy = 0;
        rv.vx *= Math.pow(0.004, dt);
        if (st !== 'egg' && (rv.hopT -= dt) <= 0) {
          rv.hopT = rand(1.2, 3.5);
          let dir = Math.random() < 0.5 ? -1 : 1;
          if (rv.x < 40) dir = 1;
          if (rv.x > 170) dir = -1;
          rv.face = dir;
          rv.vx = dir * rand(20, 60);
          rv.vy = -rand(120, 190);
          rv.sv -= 2;
        }
      }
      rv.x = clamp(rv.x, 16, 184);
    }
    rv.sv += (-rv.s * 260 - rv.sv * 9) * dt;
    rv.s = clamp(rv.s + rv.sv * dt, -0.45, 0.55);
    if (p.sleeping) sleepers.push([p, rv, st]);
    else drawPet(c, p, rv, st, t, ground, 2);
  }
  for (const [p, rv, st] of sleepers) drawPet(c, p, rv, st, t, BED_TOP + 4, 2);
  drawBlanket(c);
  for (const [, rv] of sleepers) {
    if (rv.geo) drawSprite(c, 'zee', rv.x + 10, rv.geo.top + 10 - (Math.sin(t * 2 + rv.wob) > 0 ? 2 : 0), 2);
  }

  // 밤엔 방이 어둑어둑 (창문만 빼고), 비 오는 날도 살짝
  const dim = light.dark + (light.wet ? 0.08 : 0);
  if (dim > 0) {
    const { x, y, w, h } = WIN;
    c.fillStyle = `rgba(18,22,50,${dim})`;
    c.fillRect(0, 0, RW, y - 2);
    c.fillRect(0, y + h + 2, RW, RH - y - h - 2);
    c.fillRect(0, y - 2, x - 2, h + 4);
    c.fillRect(x + w + 2, y - 2, RW - x - w - 2, h + 4);
  }
  if (sky.flashT > 0) {
    c.fillStyle = 'rgba(255,255,235,0.12)';
    c.fillRect(0, 0, RW, RH);
  }
}

// 집 창 안에 있는 말랑이의 화면 위치 (자는 말랑이의 돌봄 카드를 띄울 때)
function roomGeo(p) {
  if (home.hidden) return null;
  const rv = roomViews.get(p.id);
  if (!rv || !rv.geo) return null;
  const r = roomCanvas.getBoundingClientRect();
  const k = r.width / RW;
  return { cx: r.left + rv.geo.cx * k, top: r.top + rv.geo.top * k };
}

// 방 안 말랑이를 콕 누르면 말랑
roomCanvas.addEventListener('pointerdown', (e) => {
  const r = roomCanvas.getBoundingClientRect();
  const pt = { x: (e.clientX - r.left) * (RW / r.width), y: (e.clientY - r.top) * (RH / r.height) };
  for (const p of state.pets) {
    const rv = roomViews.get(p.id);
    const g = rv && rv.geo;
    if (!g) continue;
    const dx = (pt.x - g.cx) / (g.rx + 4), dy = (pt.y - g.cy) / (g.ry + 4);
    if (dx * dx + dy * dy <= 1) {
      rv.sv += 3.5;
      if (!p.sleeping) rv.squint = 0.5;
      // 집 안에서 자는 말랑이는 여기서 돌봄 카드를 연다 (깨우기 등)
      if (viewOf(p).inside) openCard(p.id);
      return;
    }
  }
});

// 제목줄을 끌어서 창 옮기기
function dragBy(bar, box, setPos) {
  bar.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    const r = box.getBoundingClientRect();
    const off = { x: e.clientX - r.left, y: e.clientY - r.top };
    uiDrag = true;
    const move = (ev) => setPos({ x: ev.clientX - off.x, y: ev.clientY - off.y });
    const up = () => {
      uiDrag = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });
}
dragBy($('homeBar'), home, (pos) => { homePos = pos; });

// 게이지: 10칸짜리 도트 막대
function renderGauges() {
  document.querySelectorAll('.gauge').forEach((g) => {
    if (!g.children.length) for (let i = 0; i < 10; i++) g.append(document.createElement('i'));
  });
}

function refreshCard() {
  if (card.hidden) return;
  const p = selected();
  if (!p) return closeCard();

  const st = stageOf(p);
  const age = Date.now() - p.born;
  $('pName').textContent = p.name;
  const form = formOf(p, st);
  const [care, n] = topCare(p);
  const tend = !form && st !== 'egg' && n >= 3 ? TENDENCY[care] : null;
  $('pStage').textContent = STAGES[st].label + (form ? ` · ${form.label}` : tend ? ` · ${tend}` : '');
  $('pAge').textContent = st === 'egg'
    ? `부화까지 ${Math.ceil((EGG_MS - age) / 1000)}초`
    : `태어난 지 ${fmtDuration(age - EGG_MS)}`;

  const status = [];
  if (p.sick) status.push('아파요..');
  if (p.sleeping) status.push('쿨쿨');
  if (p.poops.length) status.push(`응가 ${p.poops.length}개`);
  if (!status.length && st !== 'egg') status.push({ happy: '기분 최고!', meh: '그럭저럭', sad: '시무룩..' }[moodOf(p)]);
  $('pStatus').textContent = status.join(' · ');

  document.querySelectorAll('.gauge').forEach((g) => {
    const k = g.dataset.stat;
    const filled = Math.ceil(p[k] / 10);
    const color = p[k] < 25 ? T.warn : T[STAT_COLOR[k]];
    [...g.children].forEach((seg, i) => { seg.style.background = i < filled ? color : ''; });
  });

  const egg = st === 'egg';
  document.querySelectorAll('.actions .btn').forEach((b) => {
    const a = b.dataset.act;
    b.disabled = egg || (a === 'medicine' && !p.sick) || (p.sleeping && (a === 'feed' || a === 'play'));
  });
  const sleepIcon = $('sleepIcon');
  const icon = p.sleeping ? 'sun' : 'moon';
  if (sleepIcon.dataset.icon !== icon) { sleepIcon.dataset.icon = icon; renderIcon(sleepIcon); }
  $('sleepLabel').textContent = p.sleeping ? '깨우기' : '재우기';
}

$('closeCard').addEventListener('click', closeCard);
$('editBtn').addEventListener('click', () => openModal('edit'));
$('homeClose').addEventListener('click', () => { home.hidden = true; });
$('hAdopt').addEventListener('click', () => openModal('adopt'));
$('hGather').addEventListener('click', gather);
$('hTheme').addEventListener('click', () => {
  setTheme({ system: 'light', light: 'dark', dark: 'system' }[state.theme] || 'system');
});
$('hLock').addEventListener('click', toggleMarkLock);
$('hHide').addEventListener('click', toggleMarkHidden);
$('hFriends').addEventListener('click', openFriends);
$('hFocus').addEventListener('click', toggleFocus);
// 끄기: 한 번 더 눌러야 꺼진다
let quitArmed = null;
$('hQuit').addEventListener('click', () => {
  if (!quitArmed) {
    $('hQuit').textContent = '정말 끌까요?';
    quitArmed = setTimeout(() => { quitArmed = null; $('hQuit').textContent = '끄기'; }, 3000);
    return;
  }
  quitApp();
});

function quitApp() {
  persist();
  sayBye();
  setTimeout(() => window.malang.quit(), 300);   // 작별 인사가 전해질 틈을 준다
}
$('wPlace').addEventListener('click', () => {
  const box = $('wEdit');
  box.hidden = !box.hidden;
  if (!box.hidden) { $('wCity').value = ''; $('wCity').focus(); }
});
$('wOk').addEventListener('click', () => setWeatherPlace($('wCity').value));
$('wCity').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') setWeatherPlace(e.target.value);
  if (e.key === 'Escape') $('wEdit').hidden = true;
});
// 바탕화면 등 다른 곳을 클릭하면 카드를 닫는다 (집 창은 직접 닫을 때까지 둔다)
window.addEventListener('blur', closeCard);

// 버튼 속 도트 아이콘
function renderIcon(cv) {
  const rows = SPR[cv.dataset.icon];
  const px = 2;
  const w = rows[0].length + 2, h = rows.length + 2;
  cv.width = w * px; cv.height = h * px;
  cv.style.width = w * px + 'px'; cv.style.height = h * px + 'px';
  const c = cv.getContext('2d');
  c.clearRect(0, 0, cv.width, cv.height);
  drawSprite(c, cv.dataset.icon, (Math.floor(rows[0].length / 2) + 1) * px, (h - 2) * px, px);
}
function renderIcons() {
  document.querySelectorAll('canvas.ico').forEach(renderIcon);
}

// ===================== 행동 =====================
function act(name) {
  const p = selected();
  if (!p) return;
  const v = viewOf(p);
  const st = stageOf(p);
  if (st === 'egg') return toast('아직 알이에요. 조금만 기다려 주세요!');
  const r = STAGES[st].r * PX;
  const asleep = () => toast(`${josa(p.name, '은', '는')} 자고 있어요. 깨워 주세요`);

  switch (name) {
    case 'feed':
      if (p.sleeping) return asleep();
      if (foods.some((f) => f.petId === p.id)) return;
      p.care.feed++;
      foods.push({ petId: p.id, x: v.x, y: v.y - r * 2 - 240, vy: 0, sprite: pick(FOODS) });
      break;
    case 'play':
      if (p.sleeping) return asleep();
      if (p.sick) return toast('아파서 놀 수 없어요. 약을 먹여 주세요');
      if (p.energy < 15) return toast('너무 피곤해요.. 재워 주세요');
      // 기분은 공을 찰 때마다 조금씩 오른다
      p.happy += 6; p.energy -= 3;
      p.care.play++;
      v.playT = 4; v.hopT = 0;
      setEmote(v, 'note', 2);
      startBall(v);
      break;
    case 'clean':
      // 응가는 빗자루가 하나씩 슥슥 쓸어 간다
      p.poops.forEach((f, i) => sweepPoop(p, f, i * 0.35));
      p.clean = 100;
      p.care.clean++;
      p.happy += 3;
      v.sv += 2;
      emit(v.x, v.y - r, 'ring', { n: 8, spread: r * 2, up: 160, gravity: -60, px: 2 });
      setEmote(v, 'sparkle');
      break;
    case 'sleep':
      if (p.sleeping) {
        p.sleeping = false;
        p.wokeAt = Date.now();
        if (p.energy < 50) p.happy -= 5;
        toast(`${josa(p.name, '이', '가')} 일어났어요`);
        // 일어나자마자 필요한 걸 말한다
        say(v, needSpeech(p) || talk('slept'), 4);
        v.bubbleT = rand(6, 9);
      } else {
        if (p.energy > 85) return toast('아직 졸리지 않대요');
        p.sleeping = true;
        p.sleptAt = Date.now();
        p.care.sleep++;
        toast(`${josa(p.name, '이', '가')} 집에 들어가서 자요. 잘 자~`);
        callSleepBuddies(p);
      }
      break;
    case 'medicine':
      if (!p.sick) return toast('아프지 않아요!');
      p.sick = false;
      p.sickMeter = 0;
      p.happy -= 5;
      emit(v.x, v.y - r * 2, 'pill', {});
      setEmote(v, 'sparkle');
      toast('다 나았어요!');
      break;
  }
  clampStats(p);
  refreshCard();
  persist();
}

document.querySelectorAll('.actions .btn').forEach((b) => b.addEventListener('click', () => act(b.dataset.act)));

function toast(msg) {
  const box = $('toasts');
  const el = document.createElement('div');
  el.className = 'toast box';
  el.textContent = msg;
  box.append(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => el.classList.add('out'), 2600);
  setTimeout(() => el.remove(), 2700);
}

// ===================== 트레이 아이콘 =====================
let trayKey = null;
function updateTrayIcon() {
  const p = selected() || state.pets[0];
  const sprout = p ? p.sprout : 'twin';
  const color = p ? p.color : null;
  if (trayKey === sprout + T.pet + color) return;
  trayKey = sprout + T.pet + color;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const x = c.getContext('2d');
  const fake = { sprout, color, form: null, hunger: 100, happy: 100, clean: 100, energy: 100, sick: false, sleeping: false, poops: [] };
  const v = { x: 16, y: 31, s: 0, face: 0, wob: 0, blink: 0, squint: 0, eatT: 0, playT: 0, held: false };
  drawPet(x, fake, v, 'baby', 0, 999, 2);
  window.malang.setTrayIcon(c.toDataURL());
}

// ===================== 입양 / 정보 창 =====================
const modal = $('modal');
const mName = $('mName'), mOk = $('mOk'), mFarewell = $('mFarewell');
const previewCtx = $('mPreview').getContext('2d');
const previewView = { x: 88, y: 116, s: 0, sv: 0, face: 1, wob: 0, blink: 0, blinkT: 2, squint: 0, eatT: 0, playT: 0, held: false };
let modalMode = null;
let modalSprout = 'twin';
let modalColor = null;
let farewellArmed = false;

function suggestName() {
  const used = new Set(state.pets.map((p) => p.name));
  const free = NAMES.filter((n) => !used.has(n));
  return free.length ? pick(free) : pick(NAMES) + (state.pets.length + 1);
}

function setModalSprout(s) {
  modalSprout = s;
  document.querySelectorAll('#mSprouts .sprout').forEach((b) => b.classList.toggle('on', b.dataset.sprout === s));
  previewView.sv += 2;
}

function setModalColor(color) {
  modalColor = color || null;
  const preset = document.querySelector(`#mColors .swatch[data-color="${modalColor || ''}"]`);
  const custom = document.querySelector('#mColors .custom');
  document.querySelectorAll('#mColors .swatch').forEach((b) => b.classList.toggle('on', b === (preset || custom)));
  // 견본에 없는 색이면 '직접 고르기' 칸의 말랑이가 그 색이 된다
  if (!preset) custom.dataset.custom = modalColor;
  $('mColorPick').value = (modalColor || T.pet).toLowerCase();
  renderSwatches();
  previewView.sv += 2;
}

// 색 견본마다 그 색 아기 말랑이를 그린다
function renderSwatches() {
  document.querySelectorAll('#mColors .swatch').forEach((b) => {
    let cv = b.querySelector('canvas');
    if (!cv) {
      cv = document.createElement('canvas');
      cv.width = 26; cv.height = 34;
      b.append(cv);
    }
    const color = b.classList.contains('custom') ? b.dataset.custom || T.bg : b.dataset.color || null;
    const c = cv.getContext('2d');
    c.clearRect(0, 0, cv.width, cv.height);
    const fake = { sprout: 'twin', color, form: null, hunger: 100, happy: 100, clean: 100, energy: 100, sick: false, sleeping: false, poops: [] };
    const v = { x: 13, y: 32, s: 0, face: 0, wob: 0, blink: 0, squint: 0, eatT: 0, playT: 0, held: false };
    drawPet(c, fake, v, 'baby', 0, 32, 2);
  });
}

function openModal(mode) {
  if (mode === 'adopt' && state.pets.length >= MAX_PETS) {
    return toast(`말랑이는 최대 ${MAX_PETS}마리까지 함께 살 수 있어요`);
  }
  modalMode = mode;
  farewellArmed = false;
  mFarewell.textContent = '작별하기';
  if (mode === 'adopt') {
    $('mTitle').textContent = state.pets.length ? '새 말랑이 입양하기' : '첫 말랑이를 데려와요';
    mName.value = suggestName();
    setModalSprout(pick(SPROUTS));
    setModalColor(null);
    mOk.textContent = '입양하기';
    mFarewell.hidden = true;
  } else {
    const p = selected();
    if (!p) return;
    $('mTitle').textContent = '말랑이 정보';
    mName.value = p.name;
    setModalSprout(p.sprout);
    setModalColor(p.color);
    mOk.textContent = '저장';
    mFarewell.hidden = false;
  }
  closeCard();
  modal.hidden = false;
  mName.focus();
  mName.select();
}

function closeModal() {
  modal.hidden = true;
  modalMode = null;
}

function confirmModal() {
  const name = mName.value.trim() || suggestName();
  if (modalMode === 'adopt') {
    const p = newPet(name, modalSprout, modalColor);
    state.pets.push(p);
    const v = viewOf(p);
    v.x = rand(W * 0.55, W - 220);
    v.y = 120;   // 하늘에서 톡 떨어진다
    state.selectedId = p.id;
    toast(`${name}의 알이 도착했어요!`);
  } else if (modalMode === 'edit') {
    const p = selected();
    if (p) { p.name = name; p.sprout = modalSprout; p.color = modalColor; }
  }
  closeModal();
  updateTrayIcon();
  persist();
}

function farewell() {
  if (!farewellArmed) {
    farewellArmed = true;
    mFarewell.textContent = '정말요? 한 번 더';
    return;
  }
  const p = selected();
  if (!p) return;
  state.pets = state.pets.filter((x) => x.id !== p.id);
  views.delete(p.id);
  state.selectedId = state.pets[0] ? state.pets[0].id : null;
  toast(`${josa(p.name, '아', '야')} 잘 지내~`);
  closeModal();
  updateTrayIcon();
  persist();
}

function drawPreview(t) {
  const c = previewCtx;
  c.clearRect(0, 0, 176, 128);
  const fake = { sprout: modalSprout, color: modalColor, form: null, hunger: 100, happy: 100, clean: 100, energy: 100, sick: false, sleeping: false, poops: [] };
  const v = previewView;
  v.sv += (-v.s * 260 - v.sv * 9) / 60;
  v.s += v.sv / 60;
  v.blinkT -= 1 / 60;
  if (v.blinkT <= 0) { v.blink = 0.15; v.blinkT = rand(2, 4); }
  v.blink = Math.max(0, v.blink - 1 / 60);
  drawPet(c, fake, v, 'child', t, 116, 6);
}

mOk.addEventListener('click', confirmModal);
$('mCancel').addEventListener('click', closeModal);
mFarewell.addEventListener('click', farewell);
$('mDice').addEventListener('click', () => { mName.value = suggestName(); });
document.querySelectorAll('#mSprouts .sprout').forEach((b) => b.addEventListener('click', () => setModalSprout(b.dataset.sprout)));
document.querySelectorAll('#mColors .swatch[data-color]').forEach((b) => {
  b.addEventListener('click', () => setModalColor(b.dataset.color));
});
$('mColorPick').addEventListener('input', (e) => setModalColor(e.target.value.toUpperCase()));
$('mPreview').addEventListener('click', () => { previewView.sv += 3.5; });
document.addEventListener('keydown', (e) => {
  if (modal.hidden) return;
  if (e.key === 'Enter') confirmModal();
  if (e.key === 'Escape') closeModal();
});

// 트레이 메뉴에서 오는 명령
window.malang.onCommand((command) => {
  if (command === 'adopt') openModal('adopt');
  if (command === 'gather') gather();
  if (command.startsWith('theme:')) setTheme(command.slice(6));
  if (command === 'home' && home.hidden) toggleHome();
  if (command === 'mark:hidden') toggleMarkHidden();
  if (command === 'mark:lock') toggleMarkLock();
  if (command === 'mark:reset') resetMark();
  if (command === 'friends') openFriends();
  if (command === 'focus') toggleFocus();
  if (command === 'quit') quitApp();
  if (command === 'dnd') {
    state.dnd = !state.dnd;
    toast(state.dnd ? '방해 금지 모드: 전체화면 창이 앞에 있으면 숨어 있을게요' : '방해 금지 모드를 껐어요');
    prefsChanged();
  }
  if (command === 'dnd:quiet') quiet = true;
  if (command === 'dnd:loud') quiet = false;
});

// ===================== 알림 / 이벤트 =====================
function handleEvents() {
  while (pendingEvents.length) {
    const { type, pet } = pendingEvents.shift();
    const v = views.get(pet.id);
    const msg = {
      poop: `${josa(pet.name, '이', '가')} 응가를 했어요`,
      faint: `${josa(pet.name, '이', '가')} 지쳐서 잠들었어요`,
      wake: `${josa(pet.name, '이', '가')} 푹 자고 일어났어요`,
      sick: `${josa(pet.name, '이', '가')} 아파요! 약을 먹여 주세요`,
      morning: `${josa(pet.name, '이', '가')} 기지개를 켜며 일어났어요`,
      nightSleep: `밤이 깊어 ${josa(pet.name, '이', '가')} 잠들었어요`,
      rest: `${josa(pet.name, '이', '가')} 컨디션이 안 좋아서 쉬러 들어갔어요`,
    }[type];
    toast(msg);
    if (type === 'poop' && v) v.sv += 2;
    if (type === 'morning' && v) { v.stretchT = 1.2; say(v, talk('morning'), 2.5); }
    if (type === 'sick' || type === 'faint' || type === 'rest') notify(msg);
  }
}

// 말랑이가 화면에 보이면 말풍선으로 충분하니, 숨겨 뒀을 때만 윈도우 알림을 띄운다.
// 방해 금지 모드로 숨은 동안(게임·영상 중)은 알림도 쉿.
let quiet = false;
function notify(body) {
  if (!document.hidden || quiet) return;
  try { new Notification('말랑이 키우기', { body }); } catch { /* 알림을 못 띄워도 게임은 계속된다 */ }
}

const NEED_MSGS = { hunger: '배고파요', happy: '심심해요', clean: '씻고 싶어요', energy: '졸려요' };
function checkNeeds(p) {
  if (stageOf(p) === 'egg') return;
  const v = viewOf(p);
  for (const k of STAT_KEYS) {
    if (k === 'energy' && p.sleeping) continue;
    if (p[k] < 20 && !v.notified[k]) {
      v.notified[k] = true;
      notify(`${josa(p.name, '이', '가')} ${NEED_MSGS[k]}`);
    } else if (p[k] > 40) {
      v.notified[k] = false;
    }
  }
}

// ===================== 친구 · 쪽지 (P2P) =====================
// 친구 코드로 서로 연결하면, 말랑이가 쪽지를 들고 친구 바탕화면에 놀러 간다.
// PeerJS 공개 서버는 둘을 이어 줄 때만 쓰고 쪽지는 둘 사이에 바로 오간다.
// 그래서 둘 다 켜져 있을 때만 전해진다.
const PEER_PREFIX = 'malangpet-';
const MAX_FRIENDS = 20;
const friendsBox = $('friends');
const conns = new Map();     // 친구 코드 → 인사까지 마친 연결
const pending = new Map();   // 친구 코드 → 거는 중인 연결
const visitors = [];         // 쪽지를 들고 놀러 온 친구네 말랑이
const noteLog = [];          // 이번에 주고받은 쪽지 { code, dir: in|out|sys, text, img }
const friendStatus = new Map();   // 친구 코드 → { focus }
const PHOTO_MAX = 100000;    // 사진(data URL) 최대 글자 수
const PART_SIZE = 12000;     // PeerJS json 채널은 한 번에 16KB까지라 쪼개 보낸다
let attached = null;         // 보낼 사진 { data, thumb }
let shakeSentAt = 0, shakeGotAt = 0;
let chatKey = '';
let peer = null;
let netState = 'off';
let fTarget = null;          // 쪽지 받을 친구 코드
let friendsPos = null;
let hoverVisitor = null;
let removeArmed = null;

const fmtCode = (c) => `${c.slice(0, 4)}-${c.slice(4)}`;
const parseCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const cleanText = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
const findFriend = (code) => state.friends.find((f) => f.code === code);
const friendName = (f) => f.nick || fmtCode(f.code);
const myNick = () => state.nick || '친구';

function setNet(s) {
  netState = s;
  refreshFriends();
}

function startNet() {
  if (typeof Peer === 'undefined') return setNet('off');
  setNet('connecting');
  const pr = new Peer(PEER_PREFIX + state.myCode.toLowerCase(), { debug: 0 });
  peer = pr;
  pr.on('open', () => { setNet('on'); connectFriends(); });
  pr.on('connection', (conn) => setupConn(conn));
  pr.on('disconnected', () => {
    if (peer !== pr || pr.destroyed) return;
    setNet('connecting');
    setTimeout(() => { if (peer === pr && !pr.destroyed && pr.disconnected) pr.reconnect(); }, 5000);
  });
  pr.on('error', (err) => {
    if (err.type === 'peer-unavailable') return;   // 친구가 꺼져 있을 뿐
    if (peer !== pr) return;
    // 인터넷이 끊겼거나, 방금 껐다 켜서 서버가 예전 연결을 아직 쥐고 있을 때 — 잠시 뒤 다시
    peer = null;
    pr.destroy();
    setNet('off');
    setTimeout(startNet, 15000);
  });
}

function connectFriends() {
  if (!peer || !peer.open) return;
  for (const f of state.friends) {
    if (conns.has(f.code) || pending.has(f.code)) continue;
    const conn = peer.connect(PEER_PREFIX + f.code.toLowerCase(), { serialization: 'json', reliable: true });
    pending.set(f.code, conn);
    // 친구가 꺼져 있으면 연결이 열리지 않는다 — 정리하고 나중에 다시
    setTimeout(() => {
      if (pending.get(f.code) === conn) pending.delete(f.code);
      if (!conn.open) conn.close();
    }, 15000);
    setupConn(conn);
  }
}

// 인사할 때 내 대표 말랑이 모습도 같이 보내서, 친구 화면에 바로 놀러 간다
function myPetInfo() {
  const p = focusPet() || state.pets.find((x) => stageOf(x) !== 'egg');
  return p ? { name: p.name, sprout: p.sprout, color: p.color, form: p.form, stage: stageOf(p) } : null;
}
// 말랑이가 다 자고 있어도 앱이 켜져 있으면 온라인. 자는 중인지는 따로 알려 준다
const mySleeping = () => state.pets.length > 0 && !focusPet();
const hello = () => ({ t: 'hi', code: state.myCode, nick: myNick(), focus: state.focus, sleeping: mySleeping(), pet: myPetInfo() });

function setupConn(conn) {
  conn.on('open', () => conn.send(hello()));
  conn.on('data', (d) => onData(conn, d));
  conn.on('close', () => dropConn(conn));
  conn.on('error', () => dropConn(conn));
}

function dropConn(conn) {
  for (const [code, c] of conns) if (c === conn) conns.delete(code);
  for (const [code, c] of pending) if (c === conn) pending.delete(code);
  refreshFriends();
}

function onData(conn, d) {
  if (!d || typeof d !== 'object') return;
  if (d.t === 'hi') {
    const code = parseCode(d.code);
    // 코드가 실제 연결 주소와 같은지 확인해서 남의 코드를 흉내 내지 못하게 한다
    if (code.length !== 8 || code === state.myCode || conn.peer !== PEER_PREFIX + code.toLowerCase()) return conn.close();
    if (state.blocked.includes(code)) return conn.close();
    let f = findFriend(code);
    if (!f) {
      if (state.friends.length >= MAX_FRIENDS) return conn.close();
      f = { code, nick: '' };
      state.friends.push(f);
      toast(`${cleanText(d.nick, 10) || fmtCode(code)}님과 친구가 됐어요`);
    }
    f.nick = cleanText(d.nick, 10) || f.nick;
    friendStatus.set(code, { focus: !!d.focus, sleeping: !!d.sleeping });
    lastSeen.set(code, Date.now());
    pending.delete(code);
    conns.set(code, conn);
    if (d.pet && typeof d.pet === 'object') visitorFor(f, d.pet).pet.sleeping = !!d.sleeping;
    persist();
    refreshFriends();
    return;
  }
  const entry = [...conns].find(([, c]) => c === conn);
  if (!entry) return;   // 인사 전에 온 건 무시
  const f = findFriend(entry[0]);
  if (!f) return;
  lastSeen.set(f.code, Date.now());
  if (d.t === 'bye') { conn.close(); dropConn(conn); return; }   // 친구가 앱을 껐다
  if (d.t === 'part') receivePart(conn, d);
  if (d.t === 'msg') receiveNote(f, d, takePhoto(conn, d.photo));
  if (d.t === 'shake') receiveShake(f);
  if (d.t === 'visit') { guestArrived(f); conn.send(houseSnapshot()); }
  if (d.t === 'house?') conn.send(houseSnapshot());
  if (d.t === 'house') receiveHouse(f, d);
  if (d.t === 'leave') guestLeft(f);
  if (d.t === 'status') {
    friendStatus.set(f.code, { focus: !!d.focus, sleeping: !!d.sleeping });
    const vis = visitors.find((x) => x.code === f.code);
    if (vis) vis.pet.sleeping = !!d.sleeping;
    refreshFriends();
  }
}

// 사진 조각 모으기 (조각 수·크기를 제한해서 너무 큰 건 버린다)
function receivePart(conn, d) {
  const id = String(d.id || '').slice(0, 16);
  const n = d.n | 0, i = d.i | 0;
  if (!id || n < 1 || n > 10 || i < 0 || i >= n || typeof d.s !== 'string' || d.s.length > PART_SIZE) return;
  conn.parts = conn.parts || new Map();
  let buf = conn.parts.get(id);
  if (!buf) {
    if (conn.parts.size >= 4) conn.parts.delete(conn.parts.keys().next().value);
    buf = { n, got: [] };
    conn.parts.set(id, buf);
  }
  if (buf.n === n) buf.got[i] = d.s;
}

function takePhoto(conn, id) {
  if (!id || !conn.parts) return null;
  const buf = conn.parts.get(String(id));
  conn.parts.delete(String(id));
  if (!buf || buf.got.filter((x) => typeof x === 'string').length !== buf.n) return null;
  const data = buf.got.join('');
  return data.length <= PHOTO_MAX + 1000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(data) ? data : null;
}

function logNote(entry) {
  noteLog.push(entry);
  if (noteLog.length > 60) noteLog.shift();
}

let statusKey = '';
function broadcastStatus() {
  statusKey = `${state.focus}|${mySleeping()}`;
  for (const c of conns.values()) if (c.open) c.send({ t: 'status', focus: state.focus, sleeping: mySleeping() });
}

// 10초마다 살아 있다고 알리고, 45초 동안 아무 소식이 없으면 꺼진 걸로 본다
// (컴퓨터가 꺼지거나 인터넷이 끊긴 경우). 말랑이가 자는 것과는 상관없다.
const lastSeen = new Map();
let beatN = 0;
function heartbeat() {
  if (`${state.focus}|${mySleeping()}` !== statusKey) broadcastStatus();
  if (++beatN % 10 !== 0) return;
  const now = Date.now();
  for (const [code, c] of [...conns]) {
    if (now - (lastSeen.get(code) || now) > 45000) { c.close(); dropConn(c); continue; }
    if (c.open) c.send({ t: 'ping' });
  }
}

// 앱을 끌 때 친구들에게 바로 알린다
function sayBye() {
  for (const c of conns.values()) if (c.open) { try { c.send({ t: 'bye' }); } catch { /* 이미 끊김 */ } }
}

function receiveNote(f, d, img) {
  const text = cleanText(d.text, 40);
  if (!text && !img) return;
  const nick = friendName(f);
  logNote({ code: f.code, dir: 'in', text, img });
  const vis = visitorFor(f, d.pet && typeof d.pet === 'object' ? d.pet : {});
  vis.v.vy = -380; vis.v.sv -= 2;
  pushChat(vis.chat, text, img ? makeThumb(img) : null);
  if (!state.focus) notify(`${nick}: ${text || '사진을 보냈어요'}`);
  refreshFriends();
}

// 흔들린 횟수: 20초 안에 3번 넘게 흔들리면 눈이 빙글빙글
const shakeLog = new Map();   // 누구(나 또는 친구 코드) → 흔들린 시각들
function shakeCount(key) {
  const now = Date.now();
  const list = (shakeLog.get(key) || []).filter((x) => now - x < 20000);
  list.push(now);
  shakeLog.set(key, list);
  return list.length;
}

// 말랑이 한 마리를 크게 흔든다 (dizzy면 헤롱헤롱)
function shakePet(p, v, dizzy) {
  v.shakeT = 1.6;
  v.sv += 4;
  if (stageOf(p) === 'egg') return;
  if (!p.sleeping && v.grounded) { v.vy = -rand(320, 420); v.vx = rand(-120, 120); }
  if (dizzy && !p.sleeping) { v.dizzyT = 7; say(v, talk('dizzy'), 2.5); }
  else if (!p.sleeping) setEmote(v, 'exclaim', 1.4);
}

// 친구가 내 말랑이를 흔들었다! (집 안에서 자는 아이는 집째로 들썩)
function receiveShake(f) {
  const now = Date.now();
  if (now - shakeGotAt < 2000) return;
  shakeGotAt = now;
  const nick = friendName(f);
  const dizzy = shakeCount('me') >= 3;
  for (const p of state.pets) {
    const v = viewOf(p);
    if (v.inside) {
      homeMark.shakeT = 1.6;
      const rv = roomViewOf(p);
      rv.shakeT = 1.6; rv.sv += 4;
      continue;
    }
    shakePet(p, v, dizzy);
  }
  logNote({ code: f.code, dir: 'sys', text: `${nick}님이 내 말랑이를 흔들었어요${dizzy ? ' (어질어질..)' : ''}` });
  toast(`${nick}님이 말랑이를 흔들었어요!`);
  if (!state.focus) notify(`${nick}님이 말랑이를 흔들었어요!`);
  refreshFriends();
}

function sendShake() {
  if (!fTarget) return toast('흔들 친구를 골라 주세요');
  const conn = conns.get(fTarget);
  if (!conn || !conn.open) return toast('친구가 지금 꺼져 있어요');
  const f = findFriend(fTarget);
  if (Date.now() - shakeSentAt < 3000) return toast('조금 있다가 다시 흔들어 주세요');
  shakeSentAt = Date.now();
  conn.send({ t: 'shake' });
  // 내 화면에 놀러 와 있는 친구네 말랑이도 같이 흔들린다
  const vis = visitors.find((x) => x.code === fTarget);
  if (vis) shakePet(vis.pet, vis.v, shakeCount(fTarget) >= 3);
  logNote({ code: fTarget, dir: 'sys', text: `${friendName(f)}의 말랑이를 흔들었어요` });
  refreshFriends();
}

// 사진을 작게 줄여서 JPEG data URL로 (P2P로 보내기 좋게 100KB 아래로)
async function compressPhoto(blob) {
  if (!blob || !String(blob.type).startsWith('image/')) throw new Error('not image');
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const cv = document.createElement('canvas');
    let data = '';
    for (const [side, q] of [[400, 0.8], [340, 0.7], [280, 0.6], [220, 0.55], [160, 0.5]]) {
      const k = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
      cv.width = Math.max(1, Math.round(img.naturalWidth * k));
      cv.height = Math.max(1, Math.round(img.naturalHeight * k));
      const c = cv.getContext('2d');
      c.fillStyle = '#FFFFFF';
      c.fillRect(0, 0, cv.width, cv.height);
      c.drawImage(img, 0, 0, cv.width, cv.height);
      data = cv.toDataURL('image/jpeg', q);
      if (data.length <= PHOTO_MAX) return data;
    }
    throw new Error('too big');
  } finally {
    URL.revokeObjectURL(url);
  }
}

// 바탕화면 말풍선용 작은 정사각 썸네일
function makeThumb(data, size = 40) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const img = new Image();
  img.onload = () => {
    const c = cv.getContext('2d');
    const k = size / Math.min(img.naturalWidth, img.naturalHeight);
    const w = img.naturalWidth * k, h = img.naturalHeight * k;
    c.imageSmoothingQuality = 'high';
    c.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  };
  img.src = data;
  return cv;
}

async function attachPhoto(blob) {
  try {
    const data = await compressPhoto(blob);
    attached = { data, thumb: makeThumb(data) };
    $('fAttachImg').src = data;
    $('fAttach').hidden = false;
    placeFriends();
    $('fMsg').focus();
  } catch {
    toast('이 사진은 보낼 수 없어요');
  }
}

function clearAttach() {
  attached = null;
  $('fAttach').hidden = true;
  $('fAttachImg').removeAttribute('src');
  $('fFile').value = '';
}

function sendNote() {
  const input = $('fMsg');
  const text = cleanText(input.value, 40);
  const photo = attached;
  if (!text && !photo) return;
  if (!fTarget) return toast('쪽지를 받을 친구를 골라 주세요');
  const conn = conns.get(fTarget);
  if (!conn || !conn.open) return toast('친구가 지금 꺼져 있어요. 둘 다 켜져 있어야 전해져요');
  // 깨어 있는 말랑이가 쪽지를 들고 간다
  const p = focusPet();
  // 사진은 조각내서 먼저 보내고, 쪽지에 사진 번호를 붙인다
  let photoId = null;
  if (photo) {
    photoId = Math.random().toString(36).slice(2, 10);
    const n = Math.ceil(photo.data.length / PART_SIZE);
    for (let i = 0; i < n; i++) conn.send({ t: 'part', id: photoId, i, n, s: photo.data.slice(i * PART_SIZE, (i + 1) * PART_SIZE) });
  }
  conn.send({
    t: 'msg', text, photo: photoId,
    pet: myPetInfo(),
  });
  logNote({ code: fTarget, dir: 'out', text, img: photo ? photo.data : null });
  input.value = '';
  clearAttach();
  // 내 화면에서도 내 말랑이가 보낸 말을 말풍선으로 말한다
  pushChat(myChat, text, photo ? photo.thumb : null);
  if (p) {
    const v = viewOf(p);
    v.vy = -380; v.sv -= 2; v.emote = null; v.speech = null;
  }
  refreshFriends();
}

// 친구네 말랑이는 친구마다 한 마리만. 둘 다 켜져서 연결되면 한 번 톡 떨어져 놀러 오고,
// 연결이 끊길 때까지 머물며 새 쪽지를 말풍선으로 전한다.
const myChat = [];   // 내가 보낸 쪽지 → 내 말랑이 머리 위 말풍선
function visitorLooks(info) {
  const stage = ['baby', 'child', 'adult'].includes(info.stage) ? info.stage : 'child';
  return {
    name: cleanText(info.name, 10) || '말랑이',
    sprout: SPROUTS.includes(info.sprout) ? info.sprout : 'twin',
    color: /^#[0-9A-Fa-f]{6}$/.test(String(info.color || '')) ? info.color : null,
    form: stage === 'adult' && Object.hasOwn(FORMS, String(info.form || '')) ? info.form : null,
    born: Date.now() - EGG_MS - { baby: 2, child: 30, adult: 80 }[stage] * HOUR,
  };
}

function visitorFor(f, info) {
  const nick = friendName(f);
  let vis = visitors.find((x) => x.code === f.code);
  if (vis) {
    // 이미 와 있으면 모습만 맞춘다 (새로 만들지 않는다)
    Object.assign(vis.pet, visitorLooks(info));
    vis.nick = nick;
  } else {
    const pet = {
      id: 'visitor-' + Math.random().toString(36).slice(2), visitor: true, ...visitorLooks(info),
      hunger: 100, happy: 100, clean: 100, energy: 100, sick: false, sleeping: false, poops: [],
    };
    // 하늘에서 톡 떨어져서 놀러 온다
    const v = viewOf(pet);
    v.x = rand(W * 0.25, W * 0.75);
    v.y = STAGES[stageOf(pet)].r * PX * 2;
    v.bubbleT = Infinity;
    setEmote(v, 'letter', 1.5);
    emit(v.x, v.y, 'sparkle', { n: 5, spread: 100, up: 160 });
    vis = { pet, v, code: f.code, nick, chat: [] };
    visitors.push(vis);
    while (visitors.length > 3) removeVisitor(visitors[0]);
    toast(`${nick}님의 ${josa(pet.name, '이', '가')} 놀러 왔어요`);
  }
  return vis;
}

function removeVisitor(vis) {
  const i = visitors.indexOf(vis);
  if (i >= 0) visitors.splice(i, 1);
  views.delete(vis.pet.id);
  if (vis.v.geo) emit(vis.v.geo.cx, vis.v.geo.cy, 'sparkle', { n: 5, spread: 80, up: 140 });
}

function updateVisitors(dt) {
  for (const vis of [...visitors]) {
    updateView(vis.pet, vis.v, dt);
    ageChat(vis.chat, dt);
    // 우리 집에 놀러 오면 현관으로 걸어 들어간다
    const v = vis.v;
    if (vis.visiting && !v.inside && !v.held) {
      if (!v.goHome) { v.goHome = true; v.fishing = false; v.goal = doorX(); v.goalT = 25; v.hopT = Math.min(v.hopT, 0.3); }
      else if (v.goalT <= 0) enterHouse(vis.pet, v);
    }
    // 친구가 앱을 끄면 집으로 돌아간다
    if (!conns.has(vis.code)) removeVisitor(vis);
  }
}

function visitorAt(pt) {
  for (const vis of visitors) {
    const g = vis.v.geo;
    if (!g) continue;
    const dx = (pt.x - g.cx) / (g.rx + 6), dy = (pt.y - g.cy) / (g.ry + 6);
    if (dx * dx + dy * dy <= 1) return vis;
  }
  return null;
}

// 놀러 온 말랑이를 누르면 인사하고 답장 창이 열린다
function visitorClicked(vis) {
  vis.v.sv += 3.5;
  vis.v.squint = 0.5;
  setEmote(vis.v, 'heart', 0.8);
  fTarget = vis.code;
  openFriends();
  $('fMsg').focus();
}

// ===================== 친구네 집 놀러 가기 =====================
// 친구네 집 창이 열리고, 친구네 말랑이들 사이에 내 말랑이가 손님으로 놀러 가 있다.
// 친구 화면에서는 놀러 가 있던 내 말랑이가 친구네 현관으로 쏙 들어간다.
const fHouse = $('fHouse');
const fhCanvas = $('fhRoom');
const fhCtx = fhCanvas.getContext('2d');
const friendSky = makeSky();
const house = { code: null, pets: [], guest: null, views: new Map(), kind: 'clear', line: '', pos: null, askT: 0 };

function visitHouse() {
  if (!fTarget) return toast('놀러 갈 친구를 골라 주세요');
  const conn = conns.get(fTarget);
  if (!conn || !conn.open) return toast('친구가 지금 꺼져 있어요');
  if (house.code && house.code !== fTarget) leaveHouseVisit();
  const info = myPetInfo();
  if (!info) return toast('놀러 갈 말랑이가 없어요');
  house.code = fTarget;
  house.pets = [];
  house.views.clear();
  house.line = '친구네 집으로 가는 중..';
  house.guest = { id: 'house-me', visitor: true, ...visitorLooks(info), hunger: 100, happy: 100, clean: 100, energy: 100, sick: false, sleeping: false, poops: [] };
  conn.send({ t: 'visit' });
  $('fhName').textContent = `${friendName(findFriend(fTarget))}네 집`;
  fHouse.hidden = false;
  placeFriendHouse();
  const p = focusPet();
  if (p) say(viewOf(p), '다녀올게!', 2);
}

function leaveHouseVisit() {
  const conn = house.code && conns.get(house.code);
  if (conn && conn.open) conn.send({ t: 'leave' });
  house.code = null;
  fHouse.hidden = true;
}

// 내 집 모습을 친구에게 (말랑이 모습 · 자는지 · 창밖 날씨)
function houseSnapshot() {
  return {
    t: 'house',
    pets: state.pets.filter((p) => stageOf(p) !== 'egg').slice(0, MAX_PETS)
      .map((p) => ({ name: p.name, sprout: p.sprout, color: p.color, form: p.form, stage: stageOf(p), sleeping: !!p.sleeping })),
    kind: weather.kind,
    line: weatherText(),
  };
}

function receiveHouse(f, d) {
  if (house.code !== f.code || !Array.isArray(d.pets)) return;
  // 같은 자리의 말랑이는 같은 물체로 둬서 방 안 움직임이 끊기지 않게
  house.pets = d.pets.slice(0, MAX_PETS).map((info, i) => {
    const old = house.pets[i] || { id: `house-${i}`, visitor: true, hunger: 100, happy: 100, clean: 100, energy: 100, sick: false, poops: [] };
    return Object.assign(old, visitorLooks(info && typeof info === 'object' ? info : {}), { sleeping: !!(info && info.sleeping) });
  });
  house.kind = Object.hasOwn(WEATHER_KO, String(d.kind)) ? d.kind : 'clear';
  house.line = cleanText(d.line, 60);
}

// 친구가 우리 집에 놀러 왔다 / 돌아갔다
function guestArrived(f) {
  const vis = visitors.find((x) => x.code === f.code);
  if (!vis) return;
  vis.visiting = true;
  toast(`${friendName(f)}님의 ${josa(vis.pet.name, '이', '가')} 우리 집에 놀러 왔어요! (말랑이네에서 볼 수 있어요)`);
}
function guestLeft(f) {
  const vis = visitors.find((x) => x.code === f.code);
  if (!vis) return;
  vis.visiting = false;
  if (vis.v.inside) leaveHouse(vis.pet, vis.v);
  vis.v.goHome = false;
}

function updateFriendHouse(t, dt) {
  // 친구가 꺼지면 집에서 나온다
  if (house.code && !conns.has(house.code)) {
    toast('친구가 앱을 꺼서 집으로 돌아왔어요');
    house.code = null;
    fHouse.hidden = true;
  }
  if (fHouse.hidden || !house.code) return;
  if ((house.askT -= dt) <= 0) {
    house.askT = 5;   // 5초마다 친구네 집 모습을 다시 받아 온다
    const conn = conns.get(house.code);
    if (conn && conn.open) conn.send({ t: 'house?' });
  }
  const pets = house.guest ? [...house.pets, house.guest] : house.pets;
  drawRoomScene(fhCtx, pets, house.views, t, dt, house.kind, friendSky);
  if ($('fhLine').textContent !== house.line) $('fhLine').textContent = house.line;
  placeFriendHouse();
}

function placeFriendHouse() {
  if (fHouse.hidden) return;
  const w = fHouse.offsetWidth, h = fHouse.offsetHeight;
  const left = house.pos ? house.pos.x : (W - w) / 2;
  const top = house.pos ? house.pos.y : H - h - 60;
  fHouse.style.left = Math.round(clamp(left, 10, W - w - 10)) + 'px';
  fHouse.style.top = Math.round(clamp(top, 10, H - h - 10)) + 'px';
}

// 친구네 방 말랑이를 누르면 말랑
fhCanvas.addEventListener('pointerdown', (e) => {
  const r = fhCanvas.getBoundingClientRect();
  const pt = { x: (e.clientX - r.left) * (RW / r.width), y: (e.clientY - r.top) * (RH / r.height) };
  for (const rv of house.views.values()) {
    const g = rv.geo;
    if (!g) continue;
    const dx = (pt.x - g.cx) / (g.rx + 4), dy = (pt.y - g.cy) / (g.ry + 4);
    if (dx * dx + dy * dy <= 1) { rv.sv += 3.5; rv.squint = 0.5; return; }
  }
});

function openFriends() {
  closeCard();
  friendsBox.hidden = false;
  $('fNick').value = state.nick;
  refreshFriends();
  placeFriends();
}

function placeFriends() {
  if (friendsBox.hidden) return;
  const w = friendsBox.offsetWidth, h = friendsBox.offsetHeight;
  const left = friendsPos ? friendsPos.x : W - w - 345;
  const top = friendsPos ? friendsPos.y : H - h - 60;
  friendsBox.style.left = Math.round(clamp(left, 10, W - w - 10)) + 'px';
  friendsBox.style.top = Math.round(clamp(top, 10, H - h - 10)) + 'px';
}

function refreshFriends() {
  if (friendsBox.hidden) return;
  $('netState').textContent = { on: '연결됨', connecting: '연결 중..', off: '오프라인' }[netState];
  $('myCode').textContent = fmtCode(state.myCode);
  const list = $('fList');
  if (!state.friends.length) {
    list.textContent = '아직 친구가 없어요. 서로 코드를 추가해 보세요';
  } else {
    list.replaceChildren(...state.friends.map((f) => {
      const online = conns.has(f.code);
      const row = document.createElement('div');
      row.className = 'friend' + (f.code === fTarget ? ' on' : '');
      const dot = document.createElement('i');
      dot.className = 'dot' + (online ? ' online' : '');
      const who = document.createElement('span');
      who.className = 'who';
      who.textContent = friendName(f);
      const sub = document.createElement('span');
      sub.className = 'sub';
      const st = friendStatus.get(f.code) || {};
      const focusing = online && st.focus;
      sub.textContent = focusing ? '집중 중' : online && st.sleeping ? '접속 중 · 쿨쿨' : online ? '접속 중' : '꺼져 있음';
      if (focusing) sub.classList.add('focus');
      const del = document.createElement('button');
      del.className = 'link warn';
      del.textContent = removeArmed === f.code ? '정말?' : '삭제';
      del.addEventListener('click', (e) => { e.stopPropagation(); removeFriend(f.code); });
      row.append(dot, who, sub, del);
      row.addEventListener('click', () => { fTarget = f.code; removeArmed = null; refreshFriends(); $('fMsg').focus(); });
      return row;
    }));
  }
  const f = fTarget && findFriend(fTarget);
  $('fTo').textContent = f ? `${friendName(f)}와의 대화` : '대화할 친구를 골라 주세요';
  $('fShake').disabled = !f || !conns.has(f.code);
  $('fVisit').disabled = !f || !conns.has(f.code);
  $('fVisit').textContent = house.code && house.code === fTarget ? '집에 있어요' : '놀러 가기';
  renderChat();
}

// 대화창: 내가 보낸 건 오른쪽, 친구가 보낸 건 왼쪽 말풍선
function renderChat() {
  const items = noteLog.filter((n) => !fTarget || n.code === fTarget);
  const key = `${fTarget}|${noteLog.length}|${items.length && noteLog[noteLog.length - 1] === items[items.length - 1]}`;
  if (key === chatKey) return;
  chatKey = key;
  const box = $('fLog');
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = fTarget ? '아직 주고받은 쪽지가 없어요' : '친구를 고르면 대화가 보여요';
    box.replaceChildren(empty);
    return;
  }
  box.replaceChildren(...items.slice(-30).map((n) => {
    const el = document.createElement('div');
    el.className = 'msg ' + n.dir;
    if (n.dir !== 'sys' && !fTarget) {
      const who = document.createElement('span');
      who.className = 'who';
      const fr = findFriend(n.code);
      who.textContent = n.dir === 'out' ? `→ ${fr ? friendName(fr) : ''}` : fr ? friendName(fr) : '';
      el.append(who);
    }
    if (n.img) {
      const img = document.createElement('img');
      img.src = n.img;
      img.alt = '사진';
      img.addEventListener('load', () => { box.scrollTop = box.scrollHeight; });
      el.append(img);
    }
    if (n.text) {
      const tx = document.createElement('span');
      tx.className = 'text';
      tx.textContent = n.text;
      el.append(tx);
    }
    return el;
  }));
  box.scrollTop = box.scrollHeight;
}

function addFriend() {
  const code = parseCode($('fCode').value);
  if (code.length !== 8) return toast('친구 코드는 8자리예요 (예: ABCD-1234)');
  if (code === state.myCode) return toast('내 코드예요! 친구 코드를 넣어 주세요');
  state.blocked = state.blocked.filter((c) => c !== code);
  if (!findFriend(code)) {
    if (state.friends.length >= MAX_FRIENDS) return toast(`친구는 ${MAX_FRIENDS}명까지예요`);
    state.friends.push({ code, nick: '' });
  }
  fTarget = code;
  $('fCode').value = '';
  persist();
  refreshFriends();
  connectFriends();
  toast('친구를 추가했어요. 친구도 켜져 있으면 바로 연결돼요');
}

function removeFriend(code) {
  if (removeArmed !== code) { removeArmed = code; return refreshFriends(); }
  removeArmed = null;
  state.friends = state.friends.filter((f) => f.code !== code);
  // 지운 친구가 다시 연결해 와도 받지 않는다 (코드를 다시 추가하면 풀린다)
  if (!state.blocked.includes(code)) state.blocked.push(code);
  const c = conns.get(code);
  if (c) c.close();
  conns.delete(code);
  if (fTarget === code) fTarget = null;
  persist();
  refreshFriends();
}

dragBy($('friendsBar'), friendsBox, (pos) => { friendsPos = pos; });
$('friendsClose').addEventListener('click', () => { friendsBox.hidden = true; });
$('fAdd').addEventListener('click', addFriend);
$('fCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') addFriend(); });
$('fSend').addEventListener('click', sendNote);
$('fShake').addEventListener('click', sendShake);
$('fVisit').addEventListener('click', visitHouse);
$('fhClose').addEventListener('click', leaveHouseVisit);
dragBy($('fhBar'), fHouse, (pos) => { house.pos = pos; });
$('fPhoto').addEventListener('click', () => $('fFile').click());
$('fFile').addEventListener('change', (e) => { if (e.target.files[0]) attachPhoto(e.target.files[0]); });
$('fAttachDel').addEventListener('click', clearAttach);
// 캡처한 이미지를 쪽지 칸에 붙여넣어도 된다
$('fMsg').addEventListener('paste', (e) => {
  const item = [...(e.clipboardData ? e.clipboardData.items : [])].find((x) => x.type.startsWith('image/'));
  if (!item) return;
  e.preventDefault();
  attachPhoto(item.getAsFile());
});
$('fMsg').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendNote(); });
$('fNick').addEventListener('change', (e) => {
  state.nick = cleanText(e.target.value, 10);
  e.target.value = state.nick;
  persist();
  for (const c of conns.values()) if (c.open) c.send(hello());
});
$('copyCode').addEventListener('click', () => {
  navigator.clipboard.writeText(fmtCode(state.myCode))
    .then(() => toast('친구 코드를 복사했어요'))
    .catch(() => toast(`내 코드: ${fmtCode(state.myCode)}`));
});

// ===================== 시작 =====================
resize();
window.addEventListener('resize', resize);
applyTheme();
window.malang.themeChanged(state.theme);
prefsChanged();

const awayMs = Date.now() - state.lastSim;
advance(Date.now());
pendingEvents.length = 0;   // 자리 비운 동안의 일은 하나하나 알리지 않는다
if (!selected() && state.pets.length) state.selectedId = state.pets[0].id;
if (state.pets.length && awayMs > 10 * 60 * 1000) {
  setTimeout(() => toast(`자리를 비운 동안 ${fmtDuration(awayMs)}이 흘렀어요`), 400);
}
if (!state.pets.length) openModal('adopt');

// 픽셀 폰트가 준비되면 캔버스 글자도 갈무리로
document.fonts.load('12px Galmuri11').catch(() => {});

let tick = 0;
setInterval(() => {
  advance(Date.now());
  handleEvents();
  state.pets.forEach(checkNeeds);
  if (++tick % 15 === 0) persist();
}, 1000);
setInterval(() => { refreshCard(); refreshHome(); }, 250);
window.addEventListener('beforeunload', () => { persist(); sayBye(); });

startNet();
setInterval(connectFriends, 30000);
setInterval(heartbeat, 1000);
fetchWeather();
setInterval(fetchWeather, 30 * 60 * 1000);

requestAnimationFrame(frame);
