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
  // 머리 위 새싹 (맨 아랫줄이 머리에 붙는다)
  twin:     ['ll   ll', 'lll lll', ' lllll ', '   l   '],
  single:   ['   ll', '  lll', ' lll ', '  l  '],
  flower:   [' w ', 'whw', ' w ', ' ll', ' l '],
};
const FOODS = ['onigiri', 'apple', 'cookie', 'pudding'];

// ===================== 유틸 =====================
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const snap = (v, px) => Math.round(v / px) * px;
const $ = (id) => document.getElementById(id);

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
function loadState() {
  const s = window.malang.load();
  if (s && Array.isArray(s.pets)) {
    // 예전 버전(색상 선택)의 말랑이는 새싹 모양으로 바꿔 준다
    for (const p of s.pets) if (!p.sprout) p.sprout = SPROUTS[Math.abs(Math.round(p.hue || 0)) % 3];
    if (!s.theme) s.theme = 'system';
    return s;
  }
  return { version: 2, lastSim: Date.now(), selectedId: null, theme: 'system', pets: [] };
}
const state = loadState();
const persist = () => window.malang.save(state);

function newPet(name, sprout) {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name, sprout,
    born: Date.now(),
    hunger: 80, happy: 80, clean: 100, energy: 90,
    sleeping: false, sick: false,
    sickMeter: 0, poopMeter: 0,
    poops: [],  // 화면 가로 위치(0~1)
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
function stamp(cells, rows, dx = 0, dy = 0) {
  const ax = Math.floor(rows[0].length / 2), ay = rows.length - 1;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== ' ') cells.set(x - ax + dx, y - ay + dy, T[PAL[row[x]]]);
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

// 말랑이 한 마리를 칸 단위로 래스터라이즈해서 그린다
function drawPet(c, p, v, st, t, groundY, px = PX) {
  const ox = snap(v.x, px), oy = snap(v.y, px);
  const { r, h } = STAGES[st];
  drawShadow(c, v.x, groundY, r, clamp((groundY - v.y) / 200, 0, 1), px);
  if (st === 'egg') return drawEgg(c, p, v, r, h, t, ox, oy, px);

  // 숨 쉴 때 한 칸씩 들썩
  const breath = p.sleeping ? (Math.sin(t * 1.6) > 0.2 ? 0.12 : 0) : (Math.sin(t * 2.4 + v.wob) > 0.75 ? 0.1 : 0);
  const sq = v.s + breath;
  const hw = Math.max(3, Math.round(r * (1 + sq * 0.9)));   // 절반 너비
  const hh = Math.max(3, Math.round(h * (1 - sq)));         // 높이

  const body = p.sick ? T.text_sub : T.pet;
  const shade = p.sick ? T.border : T.leaf;
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

  // 머리 위에 둥실 떠 있는 새싹
  const bob = v.held ? 0 : Math.sin(t * 3 + v.wob) > 0 ? 0 : 1;
  stamp(cells, SPR[p.sprout] || SPR.twin, 0, -hh - 4 - bob);

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
    if (p.sleeping || v.blink > 0) {                       // - -
      dot(xe, ey); dot(xe + s, ey);
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
function drawSpeech(c, text, cx, top) {
  const px = 2;
  c.font = '12px Galmuri11, "Malgun Gothic", sans-serif';
  const wc = Math.ceil((Math.ceil(c.measureText(text).width) + 12) / px), hc = 9;
  const ox = snap(clamp(cx - 12, 8, W - wc * px - 8), px), oy = snap(top - (hc + 4) * px, px);
  const tail = clamp(Math.round((cx - ox) / px), 2, wc - 3);
  const cells = new Cells();
  for (let y = 0; y < hc; y++) {
    for (let x = 0; x < wc; x++) {
      const corner = (x === 0 || x === wc - 1) && (y === 0 || y === hc - 1);
      if (!corner) cells.set(x, y, T.bg);
    }
  }
  cells.set(tail, hc, T.bg); cells.set(tail + 1, hc, T.bg); cells.set(tail, hc + 1, T.bg);
  cells.outline(T.outline).draw(c, ox, oy, px);
  c.fillStyle = T.text;
  c.textAlign = 'left'; c.textBaseline = 'middle';
  c.fillText(text, ox + 6, oy + (hc * px) / 2 + 1);
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
// 바탕화면 오른쪽 아래, 새싹이 든 네모 말풍선. 클릭하면 집 창이 열린다.
const homeMark = { geo: null };

function drawHomeMark(c, t) {
  const px = 3, wc = 11, hc = 9;
  const bob = Math.sin(t * 1.5) > 0 ? 0 : px;
  const ox = snap(W - 64 - (wc * px) / 2, px), oy = snap(floorY() - (hc + 3) * px, px) - bob;
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
  homeMark.geo = { x: ox - px, y: oy - px, w: (wc + 2) * px, h: (hc + 4) * px };
}

const overHomeMark = (pt) => {
  const g = homeMark.geo;
  return !!g && pt.x >= g.x && pt.x <= g.x + g.w && pt.y >= g.y && pt.y <= g.y + g.h;
};

// ===================== 시간 흐름 =====================
const pendingEvents = [];

// dtH: 흐른 시간(시간 단위)
function simulate(p, dtH, now) {
  if (stageOf(p, now) === 'egg') return;
  const sickMul = p.sick ? 1.5 : 1;

  if (p.sleeping) {
    p.hunger -= 5 * dtH;
    p.happy -= 2 * dtH;
    p.clean -= 2 * dtH;
    p.energy += 30 * dtH;
    if (p.energy >= 100) {
      p.sleeping = false;
      pendingEvents.push({ type: 'wake', pet: p });
    }
  } else {
    p.hunger -= 16 * dtH * sickMul;
    p.happy -= 10 * dtH * sickMul;
    p.clean -= 6 * dtH;
    p.energy -= 9 * dtH;
    if (p.energy <= 0) {
      p.sleeping = true;
      pendingEvents.push({ type: 'faint', pet: p });
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
        pendingEvents.push({ type: 'sick', pet: p });
      }
    } else {
      p.sickMeter = Math.max(0, p.sickMeter - dtH);
    }
  }
  clampStats(p);
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

// ===================== 움직임 =====================
function hop(p, v) {
  if (v.eatT > 0) { v.hopT = 0.5; return; }

  // "집으로 부르기" 중이면 목표 지점으로 폴짝폴짝
  if (v.goalT > 0 && v.goal !== null) {
    const dx = v.goal - v.x;
    if (Math.abs(dx) < 30) {
      v.goalT = 0;
      v.hopT = rand(1.5, 3);
      return;
    }
    const dir = Math.sign(dx);
    v.face = dir;
    v.vx = dir * Math.min(Math.abs(dx) * 1.5, rand(260, 340));
    v.vy = -rand(340, 440);
    v.sv -= 2;
    v.hopT = rand(0.15, 0.3);
    return;
  }

  const playing = v.playT > 0;
  v.hopT = playing ? rand(0.25, 0.6)
    : p.sick ? rand(5, 10)
    : moodOf(p) === 'sad' ? rand(4, 8)
    : rand(1.5, 4.5);
  if (!playing && Math.random() < 0.35) { v.sv += 1.2; return; } // 제자리에서 꿈틀

  let dir = Math.random() < 0.5 ? -1 : 1;
  if (v.x < 120) dir = 1;
  if (v.x > W - 120) dir = -1;
  v.face = dir;
  v.vx = dir * rand(50, 150) * (playing ? 1.3 : 1);
  v.vy = -(playing ? rand(380, 520) : rand(200, 320));
  v.sv -= playing ? 3 : 2;
}

// 원하는 게 있을 때 하는 말
function needSpeech(p) {
  if (p.sleeping) return null;
  if (p.sick) return '아파.. 약 줘';
  if (p.hunger < 30) return '배고파..';
  if (p.poops.length >= 2 || p.clean < 30) return '씻겨 줘!';
  if (p.energy < 25) return '졸려..';
  if (p.happy < 30) return '놀아 줘!';
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

  // 먹는 중엔 오물오물 들썩
  v.sTarget = v.eatT > 0 && Math.floor(v.eatT * 8) % 2 ? 0.14 : 0;
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
      if (v.vy > 250) v.sv += v.vy * 0.006;   // 착지할 때 철퍼덕
      v.y = fy; v.vy = 0; v.grounded = true;
    } else {
      v.grounded = false;
    }
    if (v.x < r) { v.x = r; v.vx = Math.abs(v.vx) * 0.5; v.sv += 1.5; }
    if (v.x > W - r) { v.x = W - r; v.vx = -Math.abs(v.vx) * 0.5; v.sv += 1.5; }
    if (v.y - r * 2 < 0) { v.y = r * 2; v.vy = Math.abs(v.vy) * 0.4; }

    if (v.grounded) {
      v.vx *= Math.pow(0.004, dt);
      if (st !== 'egg' && !p.sleeping) {
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

  if (st !== 'egg' && !v.held) {
    v.bubbleT -= dt;
    if (v.bubbleT <= 0) {
      const need = needSpeech(p);
      if (need) {
        say(v, need, 3);
        v.bubbleT = rand(7, 11);
      } else {
        v.bubbleT = rand(6, 12);
        // 할 말이 없으면 가끔 기분을 구름으로
        if (!v.emote && !p.sleeping && Math.random() < 0.4) {
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
      eat(p, v);
    }
  }
}

function eat(p, v) {
  const wasFull = p.hunger > 90;
  p.hunger += 28;
  p.poopMeter += 0.25;
  v.eatT = 1.2;
  v.sv += 2;
  if (wasFull) {
    p.happy -= 4;
    say(v, '배불러..');
  } else {
    p.happy += 4;
    setEmote(v, 'heart');
  }
  clampStats(p);
}

function gather() {
  const awake = state.pets.filter((p) => !p.sleeping && stageOf(p) !== 'egg');
  if (!awake.length) return toast('다들 자고 있어요');
  awake.forEach((p, i) => {
    const v = viewOf(p);
    v.goal = W - 120 - i * 46;
    v.goalT = 20;
    v.hopT = rand(0, 0.4);
  });
  toast('말랑이들아 집으로 모여라~');
}

function drawPoops(c) {
  for (const p of state.pets) for (const f of p.poops) drawSprite(c, 'poop', poopX(f), floorY() - 2, 2);
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

// ===================== 메인 루프 =====================
let lastFrame = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  const t = now / 1000;
  const fy = floorY();

  ctx.clearRect(0, 0, W, H);
  drawHomeMark(ctx, t);
  drawPoops(ctx);
  for (const p of state.pets) updateView(p, viewOf(p), dt);
  updateFoods(dt);

  // 선택된 말랑이(와 들고 있는 말랑이)를 맨 위에 그린다
  const order = [...state.pets].sort((a, b) => {
    const score = (p) => (viewOf(p).held ? 2 : 0) + (p.id === state.selectedId ? 1 : 0);
    return score(a) - score(b);
  });
  for (const p of order) drawPet(ctx, p, viewOf(p), stageOf(p), t, fy);
  for (const f of foods) drawSprite(ctx, f.sprite, f.x, f.y, PX);
  updateParticles(ctx, dt);

  const cardFor = card.hidden ? null : state.selectedId;
  for (const p of order) {
    const v = viewOf(p);
    if (!v.geo || v.held) continue;
    if (p.id === hoverId || p.id === cardFor) {
      drawLabel(ctx, p.name, v.geo.cx, v.geo.top - 14);
      continue;
    }
    const icon = v.emote ? v.emote.icon : p.sleeping ? 'zee' : null;
    if (icon) drawCloud(ctx, v.geo.cx, v.geo.top, icon, t);
    else if (v.speech) drawSpeech(ctx, v.speech.text, v.geo.cx, v.geo.top);
  }

  if (home.hidden && overHomeMark(mouse) && !hoverId) {
    drawLabel(ctx, '말랑이네', homeMark.geo.x + homeMark.geo.w / 2, homeMark.geo.y - 12);
  }
  if (!home.hidden) drawRoom(t, dt);

  placeCard();
  placeHome();
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
  const clickable = p || poopAt(pt) || overHomeMark(pt);
  setInteractive(!!(mouse.down || uiDrag || clickable || overUi(pt.x, pt.y)));
  canvas.style.cursor = mouse.down && mouse.down.dragging ? 'grabbing' : p ? 'grab' : clickable ? 'pointer' : 'default';
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
  const hit = poopAt(pt);
  if (hit) {
    hit.p.poops.splice(hit.i, 1);
    hit.p.clean = clamp(hit.p.clean + 5, 0, 100);
    emit(pt.x, floorY() - 10, 'sparkle', { n: 3, spread: 50, up: 120 });
    persist();
    return;
  }
  if (overHomeMark(pt)) toggleHome();
});

canvas.addEventListener('pointermove', (e) => {
  mouse.x = e.clientX; mouse.y = e.clientY;
  const d = mouse.down;
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
  const g = p && viewOf(p).geo;
  if (!g) return closeCard();
  const w = card.offsetWidth, h = card.offsetHeight;
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
  if (home.hidden || !homeMark.geo) return;
  const w = home.offsetWidth, h = home.offsetHeight;
  const left = homePos ? homePos.x : homeMark.geo.x + homeMark.geo.w - w;
  const top = homePos ? homePos.y : homeMark.geo.y - h - 14;
  home.style.left = Math.round(clamp(left, 10, W - w - 10)) + 'px';
  home.style.top = Math.round(clamp(top, 10, H - h - 10)) + 'px';
}

function refreshHome() {
  if (home.hidden) return;
  $('homeCount').textContent = `식구 ${state.pets.length}/${MAX_PETS}`;
}

function roomViewOf(p) {
  let rv = roomViews.get(p.id);
  if (!rv) {
    rv = {
      x: rand(30, 170), y: ROOM_FLOOR, vx: 0, vy: 0, s: 0, sv: 0,
      face: 1, wob: Math.random() * 10, blink: 0, blinkT: rand(1, 4),
      squint: 0, eatT: 0, playT: 0, held: false, hopT: rand(0.5, 3), geo: null,
    };
    roomViews.set(p.id, rv);
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

function drawRoomBg(c) {
  // 벽 + 벽지 점무늬
  c.fillStyle = T.bg;
  c.fillRect(0, 0, RW, RH);
  c.fillStyle = T.gauge_empty;
  for (let y = 8, row = 0; y < 96; y += 14, row++) {
    for (let x = (row % 2) * 8 + 6; x < RW; x += 16) c.fillRect(x, y, 2, 2);
  }
  // 창문
  rectO(c, 20, 16, 48, 36, T.clean);
  c.fillStyle = T.bg;
  c.fillRect(28, 24, 10, 4); c.fillRect(32, 22, 8, 2);
  c.fillStyle = T.border;
  c.fillRect(43, 16, 2, 36); c.fillRect(20, 33, 48, 2);
  rectO(c, 16, 54, 56, 2, T.floor);
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
  rectO(c, 82, 94, 12, 12, T.pot);
  drawSprite(c, 'twin', 88, 90, 2);
  // 밥그릇
  rectO(c, 118, 114, 20, 6, T.pot);
  c.fillStyle = T.hunger;
  c.fillRect(120, 110, 16, 4);
  // 침대
  rectO(c, 196, 74, 6, 42, T.pot);
  rectO(c, 204, BED_TOP, 58, 10, T.bg);
  rectO(c, 204, 108, 58, 6, T.pot);
  rectO(c, 206, 90, 12, 6, T.gauge_empty);
  rectO(c, 226, 92, 36, 14, T.fun);
}

function drawRoom(t, dt) {
  const c = roomCtx;
  drawRoomBg(c);
  let slot = 0;
  for (const p of state.pets) {
    const rv = roomViewOf(p);
    const st = stageOf(p);
    rv.blinkT -= dt;
    if (rv.blinkT <= 0) { rv.blink = 0.15; rv.blinkT = rand(2, 5); }
    rv.blink = Math.max(0, rv.blink - dt);
    rv.squint = Math.max(0, rv.squint - dt);

    let ground = ROOM_FLOOR;
    if (p.sleeping) {
      // 자는 말랑이는 침대 위에
      ground = BED_TOP;
      rv.x = 222 + (slot++ % 3) * 14;
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
    drawPet(c, p, rv, st, t, ground, 2);
    if (p.sleeping && rv.geo) drawSprite(c, 'zee', rv.x + 10, rv.geo.top + 10 - (Math.sin(t * 2) > 0 ? 2 : 0), 2);
  }
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
      return;
    }
  }
});

// 제목줄을 끌어서 창 옮기기
$('homeBar').addEventListener('pointerdown', (e) => {
  if (e.target.closest('button')) return;
  const r = home.getBoundingClientRect();
  const off = { x: e.clientX - r.left, y: e.clientY - r.top };
  uiDrag = true;
  const move = (ev) => { homePos = { x: ev.clientX - off.x, y: ev.clientY - off.y }; };
  const up = () => {
    uiDrag = false;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
});

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
  $('pStage').textContent = STAGES[st].label;
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
      foods.push({ petId: p.id, x: v.x, y: v.y - r * 2 - 240, vy: 0, sprite: pick(FOODS) });
      break;
    case 'play':
      if (p.sleeping) return asleep();
      if (p.sick) return toast('아파서 놀 수 없어요. 약을 먹여 주세요');
      if (p.energy < 15) return toast('너무 피곤해요.. 재워 주세요');
      p.happy += 18; p.energy -= 12; p.hunger -= 6;
      v.playT = 4; v.hopT = 0;
      setEmote(v, 'note', 4);
      break;
    case 'clean':
      for (const f of p.poops) emit(poopX(f), floorY() - 10, 'sparkle', { n: 2, spread: 40 });
      p.poops = [];
      p.clean = 100;
      p.happy += 3;
      v.sv += 2;
      emit(v.x, v.y - r, 'ring', { n: 8, spread: r * 2, up: 160, gravity: -60, px: 2 });
      setEmote(v, 'sparkle');
      break;
    case 'sleep':
      if (p.sleeping) {
        p.sleeping = false;
        if (p.energy < 50) p.happy -= 5;
        toast(`${josa(p.name, '이', '가')} 일어났어요`);
      } else {
        if (p.energy > 85) return toast('아직 졸리지 않대요');
        p.sleeping = true;
        toast(`${josa(p.name, '아', '야')} 잘 자~`);
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
  if (trayKey === sprout + T.pet) return;
  trayKey = sprout + T.pet;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const x = c.getContext('2d');
  const fake = { sprout, hunger: 100, happy: 100, clean: 100, energy: 100, sick: false, sleeping: false, poops: [] };
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
    mOk.textContent = '입양하기';
    mFarewell.hidden = true;
  } else {
    const p = selected();
    if (!p) return;
    $('mTitle').textContent = '말랑이 정보';
    mName.value = p.name;
    setModalSprout(p.sprout);
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
    const p = newPet(name, modalSprout);
    state.pets.push(p);
    const v = viewOf(p);
    v.x = rand(W * 0.55, W - 220);
    v.y = 120;   // 하늘에서 톡 떨어진다
    state.selectedId = p.id;
    toast(`${name}의 알이 도착했어요!`);
  } else if (modalMode === 'edit') {
    const p = selected();
    if (p) { p.name = name; p.sprout = modalSprout; }
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
  const fake = { sprout: modalSprout, hunger: 100, happy: 100, clean: 100, energy: 100, sick: false, sleeping: false, poops: [] };
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
    }[type];
    toast(msg);
    if (type === 'poop' && v) v.sv += 2;
    if (type === 'sick' || type === 'faint') notify(msg);
  }
}

// 말랑이가 화면에 보이면 말풍선으로 충분하니, 숨겨 뒀을 때만 윈도우 알림을 띄운다
function notify(body) {
  if (!document.hidden) return;
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

// ===================== 시작 =====================
resize();
window.addEventListener('resize', resize);
applyTheme();
window.malang.themeChanged(state.theme);

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
window.addEventListener('beforeunload', persist);

requestAnimationFrame(frame);
