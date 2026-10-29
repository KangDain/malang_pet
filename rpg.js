'use strict';
// ===================== 방치형 모험 · 요리 =====================
// renderer.js 다음에 읽힌다. renderer.js의 전역(state, drawPet, toast, 친구 연결 등)을 그대로 쓰고
// hooks로 프레임 · 1초 · 친구 메시지 · 먹기 · 돌봄 카드 · 낚시에 끼어든다.
//
// 말랑이를 모험에 보내면 바탕화면에서 빠져(state.rpg.away) 30초마다 한 번씩 싸운다.
// 앱이 꺼져 있던 동안의 싸움도 켤 때 한꺼번에 계산한다. 모아 온 재료로 요리하면 배도 차고 버프가 붙는다.
// 친구들과 단톡방에 모여 있으면 '같이 가자고 하기'로 파티(최대 5명)를 꾸린다. 파티장은 방장 —
// 방원끼리는 직접 이어져 있지 않을 수 있어서 방장이 파티원 소식을 모아 다시 나눠 준다.

// ---------- 그림 ----------
Object.assign(SPR, {
  // 재료
  wheat:  [' h h ', 'h h h', ' hhh ', '  t  ', '  t  '],
  berry:  ['  l  ', ' w w ', 'wwwww', ' www '],
  shroom: [' www ', 'wbwbw', '  b  ', '  b  '],
  honey:  [' tt ', 'hhhh', 'hBhh', 'hhhh'],
  rawEgg: [' bb ', 'bbbb', 'bbbb', ' bb '],
  milk:   [' bb ', 'bbbb', 'bcbb', 'bbbb'],
  potato: [' tt ', 'tttt', 'ttgt', ' tt '],
  // 요리
  pie:     [' tttt ', 'twwwwt', 'tttttt'],
  soup:    [' s  s ', 'BhhhhB', ' BBBB '],
  pancake: [' hhhh ', 'tttttt', ' hhhh ', 'tttttt'],
  roast:   ['  tt  ', ' tttt ', 'tthttt', ' tttt '],
  // 몬스터
  mouse:   ['  ss ss', ' ssssss', 'ssbssss', 'sssssss', ' s   s '],
  ladybug: ['  BB  ', ' wwww ', 'wBwwBw', 'wwBBww', ' wwww '],
  mshroom: [' wwww ', 'wbwwbw', 'wwwwww', ' bobb ', ' bbbb '],
  bee:     ['cc  cc', ' hhhh ', 'hBhBhB', ' hhhh '],
  chick:   ['  w  ', ' hhh ', 'hohhw', 'hhhh ', ' t t '],
  cow:     ['B    B', 'bbbbbb', 'bobBbb', 'bbBBbb', 'bb  bb'],
  crab:    ['w     w', 'ww   ww', ' wwwww ', 'wowwwow', ' w w w '],
  jelly:   [' ccc ', 'ccccc', 'cococ', 'ccccc', 'c c c'],
  bat:     ['s     s', 'ss s ss', 'sssssss', ' sosos ', '  s s  '],
  mole:    [' tttt ', 'tttttt', 'totott', 'ttwwtt', ' t  t '],
  golem:   ['  sss  ', ' sssss ', 'sosssos', 'sssssss', 'ss   ss'],
});

// ---------- 재료 · 요리 · 버프 ----------
const ITEMS = {
  wheat: { name: '밀', sprite: 'wheat' },
  berry: { name: '베리', sprite: 'berry' },
  shroom: { name: '버섯', sprite: 'shroom' },
  honey: { name: '꿀', sprite: 'honey' },
  egg: { name: '달걀', sprite: 'rawEgg' },
  milk: { name: '우유', sprite: 'milk' },
  fish: { name: '생선', sprite: 'fish' },
  potato: { name: '감자', sprite: 'potato' },
};
const RECIPES = {
  bread:   { name: '빵', sprite: 'bread', need: { wheat: 2 }, hunger: 28, happy: 3 },
  pie:     { name: '베리 파이', sprite: 'pie', need: { wheat: 1, berry: 2 }, hunger: 20, happy: 8, buff: 'atk' },
  fried:   { name: '달걀프라이', sprite: 'egg', need: { egg: 1 }, hunger: 26, happy: 3 },
  soup:    { name: '버섯 수프', sprite: 'soup', need: { shroom: 2, milk: 1 }, hunger: 30, happy: 4, buff: 'def' },
  grill:   { name: '생선구이', sprite: 'fishBig', need: { fish: 1 }, hunger: 30, happy: 4, buff: 'exp' },
  roast:   { name: '감자구이', sprite: 'roast', need: { potato: 2 }, hunger: 32, happy: 3, buff: 'stamina' },
  cake:    { name: '꿀 케이크', sprite: 'cake', need: { wheat: 2, egg: 1, honey: 1 }, hunger: 18, happy: 12, buff: 'luck' },
  pancake: { name: '팬케이크', sprite: 'pancake', need: { wheat: 1, egg: 1, milk: 1, honey: 1 }, hunger: 35, happy: 10, buff: 'all' },
};
const BUFFS = {
  atk: '공격 +25%', def: '받는 피해 -30%', exp: '경험치 +30%',
  stamina: '배고픔·기운이 덜 닳아요', luck: '재료 +50%', all: '모든 능력 +15%',
};
const BUFF_POWER = { atk: 0.25, def: 0.3, exp: 0.3, stamina: 0.4, luck: 0.5 };
const BUFF_MS = HOUR;
// 요리도 밥처럼 떨어뜨려 먹인다 (renderer.js의 eat가 FOOD_INFO · SPR로 그린다)
for (const [id, r] of Object.entries(RECIPES)) {
  SPR['dish_' + id] = SPR[r.sprite];
  FOOD_INFO['dish_' + id] = { name: r.name, hunger: r.hunger, happy: r.happy };
}

// 어른 모습마다 특기가 있다
const FORM_BONUS = {
  chubby: { hp: 0.2 }, sporty: { atk: 0.15 }, shiny: { luck: 0.3 }, sleepy: { stamina: 0.25 },
  royal: { hp: 0.1, atk: 0.1, luck: 0.1, stamina: 0.1 },
  grubby: { hp: 0.1, luck: 0.2 },   // 흙바닥을 뒤지고 다녀서 재료를 잘 찾는다
};

// ---------- 지역 · 몬스터 ----------
// drops: 1보다 작으면 나올 확률, 1 이상이면 그만큼 (보스)
const ZONES = [
  { id: 'meadow', name: '풀숲', minLv: 1,
    mobs: [{ name: '들쥐', sprite: 'mouse', hp: 12, atk: 2, exp: 5, drops: { wheat: 0.33, berry: 0.17 } },
      { name: '무당벌레', sprite: 'ladybug', hp: 18, atk: 3, exp: 7, drops: { berry: 0.33, wheat: 0.11 } }],
    boss: { name: '들쥐 대장', sprite: 'mouse', hp: 90, atk: 6, exp: 45, drops: { wheat: 3, berry: 2, honey: 0.28 } } },
  { id: 'forest', name: '버섯 숲', minLv: 4,
    mobs: [{ name: '버섯돌이', sprite: 'mshroom', hp: 32, atk: 4, exp: 12, drops: { shroom: 0.39 } },
      { name: '꿀벌', sprite: 'bee', hp: 26, atk: 5, exp: 13, drops: { honey: 0.22, berry: 0.22 } }],
    boss: { name: '버섯왕', sprite: 'mshroom', hp: 220, atk: 10, exp: 110, drops: { shroom: 4, honey: 1 } } },
  { id: 'farm', name: '들판 목장', minLv: 7,
    mobs: [{ name: '꼬꼬', sprite: 'chick', hp: 46, atk: 6, exp: 19, drops: { egg: 0.39, wheat: 0.17 } },
      { name: '얼룩소', sprite: 'cow', hp: 62, atk: 7, exp: 23, drops: { milk: 0.39 } }],
    boss: { name: '화난 황소', sprite: 'cow', hp: 340, atk: 14, exp: 170, drops: { milk: 3, egg: 3 } } },
  { id: 'beach', name: '바닷가', minLv: 10,
    mobs: [{ name: '꽃게', sprite: 'crab', hp: 72, atk: 9, exp: 29, drops: { fish: 0.33 } },
      { name: '해파리', sprite: 'jelly', hp: 60, atk: 10, exp: 30, drops: { fish: 0.28, berry: 0.11 } }],
    boss: { name: '대왕 꽃게', sprite: 'crab', hp: 500, atk: 19, exp: 250, drops: { fish: 5, honey: 1 } } },
  { id: 'cave', name: '반짝 동굴', minLv: 14,
    mobs: [{ name: '박쥐', sprite: 'bat', hp: 88, atk: 12, exp: 40, drops: { honey: 0.17, potato: 0.17 } },
      { name: '두더지', sprite: 'mole', hp: 100, atk: 11, exp: 42, drops: { potato: 0.39 } }],
    boss: { name: '돌골렘', sprite: 'golem', hp: 720, atk: 26, exp: 380, drops: { potato: 5, honey: 2 } } },
];
const zoneOf = (id) => ZONES.find((z) => z.id === id) || ZONES[0];
const EXPLORE = 30;   // 한 지역에서 이만큼 물리치면 그 지역 탐험 완료

// ---------- 장비 (무기: 칼 · 활 / 갑옷) ----------
// 단계마다 그 지역에서 주울 수 있고, 입으려면 레벨 + 앞 지역 탐험 완료가 필요하다.
// 별빛 장비는 반짝 동굴에서 아주 드물게 나오고, 동굴까지 탐험해야 입을 수 있다.
// blade: 칼날 · 활대 색, guard: 칼 손잡이 색, look: 갑옷 [바탕, 무늬] 색 (SPR 글자)
const GEAR_TIERS = [
  { key: 'wood', zone: 'meadow', lv: 1, need: null, sword: '나무 칼', bow: '나무 활', armor: '나뭇잎 옷', blade: 'g', guard: 't', look: ['l', 'f'] },
  { key: 'stone', zone: 'forest', lv: 4, need: 'meadow', sword: '돌 칼', bow: '덩굴 활', armor: '버섯 갑옷', blade: 's', guard: 'l', look: ['w', 'b'] },
  { key: 'iron', zone: 'farm', lv: 7, need: 'forest', sword: '쇠 칼', bow: '깃털 활', armor: '가죽 갑옷', blade: 'b', guard: 'B', look: ['t', 'h'] },
  { key: 'coral', zone: 'beach', lv: 10, need: 'farm', sword: '산호 칼', bow: '조개 활', armor: '조개 갑옷', blade: 'w', guard: 'c', look: ['c', 'b'] },
  { key: 'crystal', zone: 'cave', lv: 14, need: 'beach', sword: '수정 칼', bow: '수정 활', armor: '수정 갑옷', blade: 'c', guard: 'h', look: ['c', 'h'] },
  { key: 'star', zone: 'cave', lv: 18, need: 'cave', sword: '별빛 칼', bow: '별빛 활', armor: '별빛 갑옷', blade: 'h', guard: 'w', look: ['h', 'w'], rare: true },
];
const SWORD_ATK = [3, 5, 8, 11, 14, 18];
const BOW_ATK = [2, 4, 6, 8, 10, 13];
const BOW_DEF = 0.15;   // 활은 멀리서 쏴서 덜 맞는다
const ARMOR_DEF = [0.05, 0.08, 0.11, 0.14, 0.17, 0.2];
const ARMOR_HP = [4, 8, 14, 20, 28, 36];
const GEAR = {};
const paint = (rows, map) => rows.map((row) => row.replace(/[XGAa]/g, (ch) => map[ch]));
const mirror = (rows) => rows.map((row) => [...row].reverse().join(''));
GEAR_TIERS.forEach((g, i) => {
  const base = { tier: i, zone: g.zone, lv: g.lv, need: g.need, rare: !!g.rare };
  const add = (id, gear, rows) => {
    GEAR[id] = { ...base, ...gear, sprite: 'gear_' + id };
    SPR['gear_' + id] = rows;
    SPR['gear_' + id + 'L'] = mirror(rows);
  };
  add(g.key + 'Sword', { name: g.sword, slot: 'weapon', kind: 'sword', atk: SWORD_ATK[i] },
    paint([' X ', ' X ', ' X ', ' X ', 'GGG', ' t '], { X: g.blade, G: g.guard }));
  add(g.key + 'Bow', { name: g.bow, slot: 'weapon', kind: 'bow', atk: BOW_ATK[i], def: BOW_DEF },
    paint([' X ', 'X s', 'X s', 'X s', 'X s', ' X '], { X: g.blade }));
  add(g.key + 'Armor', { name: g.armor, slot: 'armor', kind: 'armor', def: ARMOR_DEF[i], hp: ARMOR_HP[i], look: g.look },
    paint(['AA AA', 'AAAAA', 'AaAaA', 'AAAAA', ' AAA '], { A: g.look[0], a: g.look[1] }));
});
const SLOT_NAME = { weapon: '무기', armor: '갑옷' };
function gearText(g) {
  if (g.kind === 'armor') return `체력 +${g.hp} · 받는 피해 -${Math.round(g.def * 100)}%`;
  return `공격 +${g.atk}` + (g.kind === 'bow' ? ` · 받는 피해 -${Math.round(g.def * 100)}%` : '');
}
const WAVE_MS = 30000;         // 한 번 싸우는 간격 (한 시간에 120번)
const BOSS_EVERY = 8;          // 파티면 여덟 번째 싸움마다 보스
const MAX_BACKLOG = 12 * HOUR; // 꺼져 있던 시간은 12시간까지만 계산

// ---------- 저장 데이터 ----------
if (!state.rpg || typeof state.rpg !== 'object') state.rpg = {};
const R = state.rpg;
R.bag = R.bag && typeof R.bag === 'object' ? R.bag : {};
R.dishes = R.dishes && typeof R.dishes === 'object' ? R.dishes : {};
R.away = Array.isArray(R.away) ? R.away : [];
R.adv = R.adv || null;       // 모험 중: { petId, zone, next, start, wave, kills, bosses, loot, party: { id, host } }
R.host = R.host || null;     // 내가 파티장일 때 { id, zone }
R.lastZone = R.lastZone || 'meadow';
R.gear = R.gear && typeof R.gear === 'object' ? R.gear : {};   // 옷장: 장비 id → 가진 개수 (입은 것 포함)
if (!R.gearStart) {
  // 처음 옷장을 여는 집에는 연습용 칼과 활이 하나씩 있다
  R.gearStart = true;
  R.gear.woodSword = (R.gear.woodSword || 0) + 1;
  R.gear.woodBow = (R.gear.woodBow || 0) + 1;
}

function rpgOf(p) {
  if (!p.rpg) p.rpg = { lv: 1, exp: 0, hp: null, buff: null };
  const r = p.rpg;
  if (!r.gear) r.gear = { weapon: null, armor: null };
  if (!r.zones) {
    // 지역별 물리친 수. 예전 말랑이는 레벨로 보아 이미 지나온 지역을 탐험한 셈 친다
    r.zones = {};
    ZONES.forEach((z, i) => { if (ZONES[i + 1] && r.lv >= ZONES[i + 1].minLv) r.zones[z.id] = EXPLORE; });
  }
  return r;
}
const expNeed = (lv) => Math.round(15 * Math.pow(lv, 1.6));
const formK = (p, k) => (FORM_BONUS[p.form] || {})[k] || 0;
function buffK(p, k, now = Date.now()) {
  const b = rpgOf(p).buff;
  if (!b || b.until <= now) return 0;
  return b.id === k ? BUFF_POWER[k] : b.id === 'all' ? 0.15 : 0;
}
// 입고 있는 장비
const worn = (p, slot) => GEAR[rpgOf(p).gear[slot]] || null;
const gearAtk = (p) => (worn(p, 'weapon') || {}).atk || 0;
const gearHp = (p) => (worn(p, 'armor') || {}).hp || 0;
const gearDef = (p) => 1 - (1 - ((worn(p, 'armor') || {}).def || 0)) * (1 - ((worn(p, 'weapon') || {}).def || 0));
const maxHp = (p) => Math.round((30 + 9 * rpgOf(p).lv + gearHp(p)) * (1 + formK(p, 'hp')));
const atkOf = (p, now) => (4 + 2.2 * rpgOf(p).lv + gearAtk(p)) * (1 + formK(p, 'atk') + buffK(p, 'atk', now));
const atkOfLv = (lv) => 4 + 2.2 * lv;   // 친구 말랑이는 레벨만 안다
const awayPet = () => (R.adv && R.away.find((p) => p.id === R.adv.petId)) || null;
const itemName = (k) => (ITEMS[k] || GEAR[k] || { name: k }).name;

// 탐험 · 장비 조건
const explored = (p, zoneId) => (rpgOf(p).zones[zoneId] || 0) >= EXPLORE;
const gearLack = (p, g) => ({ lv: rpgOf(p).lv < g.lv, zone: !!g.need && !explored(p, g.need) });
const canWear = (p, g) => { const l = gearLack(p, g); return !l.lv && !l.zone; };
const wornCount = (id) => [...state.pets, ...R.away].filter((p) => p.rpg && p.rpg.gear && (p.rpg.gear.weapon === id || p.rpg.gear.armor === id)).length;
const freeCount = (id) => (R.gear[id] || 0) - wornCount(id);

// 이긴 싸움에서 가끔 장비를 줍는다 (보스는 자주). 식구 수만큼 모이면 그 장비는 더 안 나온다
function rollGear(zone, boss, luck) {
  if (Math.random() >= Math.min(0.9, (boss ? 0.35 : 0.012) * luck)) return null;
  const pool = Object.keys(GEAR).filter((id) => GEAR[id].zone === zone.id && (R.gear[id] || 0) < MAX_PETS)
    .flatMap((id) => Array(GEAR[id].rare ? 1 : 4).fill(id));
  return pool.length ? pick(pool) : null;
}
const lootText = (loot) => Object.entries(loot || {}).map(([k, n]) => `${itemName(k)} ${n}`).join(', ') || '빈손';

// 모험 갈 수 있는지 (안 되면 이유)
function cannotGo(p) {
  if (stageOf(p) === 'egg') return '아직 알이에요';
  if (p.sleeping) return '자고 있어요';
  if (p.sick) return '아파요';
  if (p.hunger < 30) return '배고파요';
  if (p.energy < 30) return '지쳤어요';
  return null;
}

// ---------- 파티 ----------
// 파티장(방장)은 파티원 소식을 모아 두고(hostRoster) 5초마다 모두에게 나눠 준다(proster).
// 파티원은 받은 명단(memberRoster)으로 옆에서 같이 싸우는 친구들을 그린다.
const hostRoster = new Map();   // 친구 코드 → { code, nick, looks, lv, hpPct, at }
let memberRoster = null;        // { id, list: [{ code, nick, looks, lv, hpPct }], at }
const invites = new Map();      // 파티장 코드 → { id, zone, n, at }
const MATE_FRESH = 75000;   // 파티원 소식(30초마다)이 이만큼 끊기면 혼자 싸운다

const partyId = () => Math.random().toString(36).slice(2, 10);
const amHost = () => !!(R.adv && R.adv.party && R.adv.party.host === state.myCode);

function myEntry() {
  const p = awayPet();
  if (!p || !R.adv.party) return null;
  return { code: state.myCode, nick: myNick(), looks: looksOf(p), lv: rpgOf(p).lv, hpPct: clamp(rpgOf(p).hp / maxHp(p), 0, 1) };
}

// 지금 옆에서 같이 싸우는 친구들 (나는 빼고)
function mates(now = Date.now()) {
  const a = R.adv;
  if (!a || !a.party) return [];
  if (amHost()) return [...hostRoster.values()].filter((m) => now - m.at < MATE_FRESH);
  if (!memberRoster || memberRoster.id !== a.party.id || now - memberRoster.at > MATE_FRESH) return [];
  return memberRoster.list.filter((m) => m.code !== state.myCode);
}

// 파티장: 명단을 모두에게
function broadcastRoster() {
  if (!R.host) return;
  const now = Date.now();
  const list = [...hostRoster.values()].filter((m) => now - m.at < MATE_FRESH)
    .map(({ code, nick, looks, lv, hpPct }) => ({ code, nick, looks, lv, hpPct }));
  const me = R.adv && R.adv.party && R.adv.party.id === R.host.id ? myEntry() : null;
  if (me) list.unshift(me);
  const msg = { t: 'proster', id: R.host.id, zone: R.host.zone, list };
  const to = new Set([...hostRoster.keys(), ...(amRoomHost() ? roomOthers().map((m) => m.code) : [])]);
  for (const code of to) sendTo(code, msg);
}

// 단톡방(내가 방장)에 모인 사람들에게 파티를 연다 (이미 열려 있으면 그대로)
function openParty(zone) {
  if (!R.host) { R.host = { id: partyId(), zone }; hostRoster.clear(); }
  invites.set(state.myCode, { id: R.host.id, zone: R.host.zone, n: 1 + hostRoster.size, at: Date.now() });
  for (const m of roomOthers()) sendTo(m.code, { t: 'pinv', id: R.host.id, zone: R.host.zone, n: 1 + hostRoster.size });
  broadcastRoster();
  persist();
}

function askTogether() {
  if (!room) return toast('단톡방에 모인 친구들과 같이 갈 수 있어요');
  if (amRoomHost()) {
    openParty(selZone);
    toast(`${zoneOf(selZone).name} 파티를 열었어요! 친구들이 참가하면 같이 싸워요`);
  } else {
    sendTo(room.host, { t: 'pask', zone: selZone });
    toast('방장에게 같이 가자고 했어요');
  }
  refreshAdv(true);
}

function joinParty(hostCode) {
  const inv = invites.get(hostCode);
  if (!inv) return;
  const p = pickedPet();
  if (!p) return toast('보낼 말랑이를 골라 주세요');
  if (!depart(p, inv.zone, { id: inv.id, host: hostCode })) return;
  invites.delete(hostCode);
  if (hostCode === state.myCode) broadcastRoster();
  else sendStat('pjoin');
}

function sendStat(t = 'pstat') {
  const a = R.adv;
  if (!a || !a.party || amHost()) return;
  const me = myEntry();
  if (me) sendTo(a.party.host, { t, id: a.party.id, lv: me.lv, hpPct: me.hpPct, looks: me.looks });
}

function leaveParty(party) {
  if (!party) return;
  if (party.host === state.myCode) broadcastRoster();
  else sendTo(party.host, { t: 'pleave', id: party.id });
  memberRoster = null;
}

function onPartyData(conn, f, d) {
  const now = Date.now();
  if (d.t === 'pask') {
    // 단톡방 사람이 같이 가자고 했다
    if (!amRoomHost() || !roomHas(f.code)) return;
    openParty(R.host ? R.host.zone : zoneOf(String(d.zone)).id);
    toast(`${friendName(f)}님이 같이 모험 가자고 해요! (모험 창에서 참가)`);
    if (!state.focus) openAdv();   // 집중 중엔 창을 저절로 띄우지 않는다
  } else if (d.t === 'pinv') {
    if (!room || room.host !== f.code) return;   // 지금 있는 단톡방 방장의 초대만
    invites.set(f.code, { id: String(d.id).slice(0, 12), zone: zoneOf(String(d.zone)).id, n: clamp(d.n | 0, 1, MAX_ROOM), at: now });
    if (!R.adv) { toast(`${friendName(f)}님이 같이 모험 갈 사람을 찾아요! (모험 창에서 참가)`); if (!state.focus) openAdv(); }
    refreshAdv(true);
  } else if ((d.t === 'pjoin' || d.t === 'pstat') && R.host && d.id === R.host.id) {
    if (!hostRoster.has(f.code) && hostRoster.size >= MAX_ROOM - 1) return;
    const joined = !hostRoster.has(f.code);
    hostRoster.set(f.code, {
      code: f.code, nick: friendName(f), looks: d.looks && typeof d.looks === 'object' ? d.looks : {},
      lv: clamp(d.lv | 0, 1, 99), hpPct: clamp(+d.hpPct || 0, 0, 1), at: now,
    });
    if (joined) { toast(`${friendName(f)}님이 파티에 들어왔어요`); broadcastRoster(); refreshAdv(true); }
  } else if (d.t === 'pleave' && R.host && d.id === R.host.id) {
    if (hostRoster.delete(f.code)) { toast(`${friendName(f)}님의 말랑이가 모험에서 돌아갔어요`); broadcastRoster(); refreshAdv(true); }
  } else if (d.t === 'proster') {
    const id = String(d.id).slice(0, 12);
    const list = (Array.isArray(d.list) ? d.list : []).slice(0, MAX_ROOM).flatMap((m) => {
      const code = parseCode(m && m.code);
      if (code.length !== 8) return [];
      return [{ code, nick: cleanText(m.nick, 10) || fmtCode(code), looks: m.looks && typeof m.looks === 'object' ? m.looks : {},
        lv: clamp(m.lv | 0, 1, 99), hpPct: clamp(+m.hpPct || 0, 0, 1) }];
    });
    const inv = invites.get(f.code);
    if (inv && inv.id === id) inv.n = Math.max(1, list.length);
    if (R.adv && R.adv.party && R.adv.party.host === f.code && R.adv.party.id === id) {
      const before = memberRoster ? memberRoster.list.length : 0;
      memberRoster = { id, list, at: now };
      if (list.length !== before) refreshAdv(true);
    }
  }
}

// ---------- 모험 ----------
let selZone = R.lastZone;
let selPetId = null;

function pickedPet() {
  const id = selPetId || state.selectedId;
  return state.pets.find((p) => p.id === id && !cannotGo(p)) || state.pets.find((p) => !cannotGo(p)) || null;
}

function depart(p, zoneId, party = null) {
  if (R.adv) { toast('이미 모험 중인 말랑이가 있어요'); return false; }
  const why = cannotGo(p);
  if (why) { toast(`${josa(p.name, '은', '는')} ${why}`); return false; }
  const zone = zoneOf(zoneId);
  if (!party && rpgOf(p).lv < zone.minLv) { toast(`${zone.name}은 Lv.${zone.minLv}부터 갈 수 있어요`); return false; }
  const v = views.get(p.id);
  if (v && v.geo) emit(v.geo.cx, v.geo.cy, 'sparkle', { n: 6, spread: 90, up: 160 });
  state.pets = state.pets.filter((x) => x !== p);
  views.delete(p.id);
  if (state.selectedId === p.id) closeCard();
  R.away.push(p);
  rpgOf(p).hp = maxHp(p);
  R.adv = { petId: p.id, zone: zone.id, next: Date.now() + 3000, start: Date.now(), wave: 0, kills: 0, bosses: 0, loot: {}, party };
  R.lastZone = zone.id;
  scene.fight = null;
  persist();
  toast(`${josa(p.name, '이', '가')} ${zone.name}${party ? '에 친구들과' : '(으)로'} 모험을 떠났어요!`);
  openAdv();
  refreshAdv(true);
  return true;
}

// 한 번 싸운다. 결과를 돌려준다 (창에서 그 모습을 보여 준다)
function fight(p, zone, now, live) {
  const a = R.adv;
  const r = rpgOf(p);
  const team = live ? mates(now) : [];
  const n = 1 + team.length;
  a.wave++;
  const boss = n >= 2 && a.wave % BOSS_EVERY === 0;
  const mob = boss ? zone.boss : pick(zone.mobs);
  const mobHp = mob.hp * (boss ? n : 1);
  const atk = atkOf(p, now) + team.reduce((s, m) => s + atkOfLv(m.lv), 0);
  const rounds = Math.max(1, Math.ceil(mobHp / atk));
  const def = 1 - (1 - buffK(p, 'def', now)) * (1 - gearDef(p));
  let dmg = 0;
  // 보스는 파티원이 나눠 맞는다
  for (let i = 1; i < rounds; i++) dmg += mob.atk * rand(0.6, 1) * (1 - def) / (boss ? n : 1);
  dmg = Math.round(dmg);
  if (r.hp == null) r.hp = maxHp(p);
  r.hp -= dmg;
  const res = { mob, boss, rounds, dmg, win: r.hp > 0, loot: {}, exp: 0, team, levelUp: 0 };
  if (res.win) {
    // 파티는 한 명마다 20%, 집중 중이면 50% 더
    const bonus = 1 + 0.2 * (n - 1) + (live && state.focus ? 0.5 : 0);
    res.exp = Math.round(mob.exp * bonus * (1 + buffK(p, 'exp', now)));
    r.exp += res.exp;
    while (r.exp >= expNeed(r.lv)) { r.exp -= expNeed(r.lv); r.lv++; res.levelUp = r.lv; r.hp = maxHp(p); }
    const luck = 1 + buffK(p, 'luck', now) + formK(p, 'luck') + 0.2 * (n - 1);
    for (const [item, v] of Object.entries(mob.drops)) {
      const k = v >= 1 ? Math.round(v * luck) : Math.random() < Math.min(0.95, v * luck) ? 1 : 0;
      if (!k) continue;
      R.bag[item] = (R.bag[item] || 0) + k;
      a.loot[item] = (a.loot[item] || 0) + k;
      res.loot[item] = k;
    }
    res.gear = rollGear(zone, boss, luck);
    if (res.gear) {
      R.gear[res.gear] = (R.gear[res.gear] || 0) + 1;
      a.loot[res.gear] = (a.loot[res.gear] || 0) + 1;
      toast(`${josa(p.name, '이', '가')} ${josa(GEAR[res.gear].name, '을', '를')} 주웠어요! 옷장에 넣어 뒀어요`);
    }
    // 이 지역을 얼마나 다녔는지 → 장비 조건
    r.zones[zone.id] = (r.zones[zone.id] || 0) + 1;
    if (r.zones[zone.id] === EXPLORE) toast(`${josa(p.name, '이', '가')} ${zone.name} 탐험을 마쳤어요! 새 장비를 입을 수 있을지도`);
    a.kills++;
    if (boss) a.bosses++;
    r.hp = Math.min(maxHp(p), r.hp + Math.round(maxHp(p) * 0.08));
  }
  // 모험하면 배고프고 지친다
  const keep = 1 - buffK(p, 'stamina', now) - formK(p, 'stamina');
  p.hunger -= 0.15 * keep;   // 한 시간에 18
  p.energy -= 0.125 * keep;  // 한 시간에 15
  p.clean -= 0.1;
  clampStats(p);
  return res;
}

function retreatReason(p) {
  const r = rpgOf(p);
  if (r.hp <= 0) return 'lose';
  if (r.hp < maxHp(p) * 0.2) return 'hurt';
  if (p.hunger < 15) return 'hungry';
  if (p.energy < 15) return 'tired';
  return null;
}

// 모험에서 돌아온다 → 현관에서 폴짝
function comeHome(why) {
  const a = R.adv;
  const p = awayPet();
  R.adv = null;
  scene.fight = null;
  if (!p) return;
  R.away = R.away.filter((x) => x !== p);
  const r = rpgOf(p);
  if (why === 'lose') p.happy = clamp(p.happy - 10, 0, 100);
  r.hp = null;   // 집에 오면 다시 꽉
  state.pets.push(p);
  const v = viewOf(p);
  v.inside = false;
  v.x = doorX(); v.y = floorY();
  v.vx = rand(-120, 120); v.vy = -420; v.sv -= 3;
  emit(v.x, v.y - 30, 'sparkle', { n: 6, spread: 100, up: 180 });
  const how = { lose: '쓰러져서 ', hurt: '많이 다쳐서 ', hungry: '배가 고파서 ', tired: '지쳐서 ', call: '' }[why] || '';
  const msg = `${josa(p.name, '이', '가')} ${how}모험에서 돌아왔어요 · ${a.kills}마리 물리침 · ${lootText(a.loot)}`;
  toast(msg);
  if (why !== 'call') notify(msg);
  leaveParty(a.party);
  persist();
  refreshAdv(true);
}

// 밀린 싸움까지 한꺼번에 (앱이 꺼져 있던 동안)
function stepAdventure() {
  const a = R.adv;
  if (!a) return;
  const p = awayPet();
  if (!p) { R.adv = null; return; }
  const zone = zoneOf(a.zone);
  const now = Date.now();
  if (a.next < now - MAX_BACKLOG) a.next = now - MAX_BACKLOG;
  let n = 0, last = null;
  const kills0 = a.kills, lv0 = rpgOf(p).lv;
  while (R.adv && a.next <= now) {
    const live = now - a.next < WAVE_MS * 1.5;
    last = fight(p, zone, a.next, live);
    a.next += WAVE_MS;
    n++;
    if (last.levelUp && live) toast(`${josa(p.name, '이', '가')} Lv.${last.levelUp}이 됐어요!`);
    const why = retreatReason(p);
    if (why) { if (n > 1) toast(`자리를 비운 동안 ${a.kills - kills0}마리를 물리쳤어요`); comeHome(why); return; }
  }
  if (!n) return;
  if (n === 1) { showFight(last); sendStat(); }
  else {
    const lv = rpgOf(p).lv;
    toast(`자리를 비운 동안 ${josa(p.name, '이', '가')} ${a.kills - kills0}마리를 물리쳤어요${lv > lv0 ? ` · Lv.${lv}` : ''}`);
  }
  refreshAdv();
}

// ---------- 요리 ----------
const canCook = (r) => Object.entries(r.need).every(([k, n]) => (R.bag[k] || 0) >= n);

function cook(id) {
  const r = RECIPES[id];
  if (!r || !canCook(r)) return toast('재료가 모자라요');
  for (const [k, n] of Object.entries(r.need)) R.bag[k] -= n;
  R.dishes[id] = (R.dishes[id] || 0) + 1;
  scene.cook = { id, t: 0 };
  scene.steam = [];
  toast(`${r.name} 완성!`);
  persist();
  refreshAdv(true);
}

function applyBuff(p, id) {
  const r = RECIPES[id];
  if (!r || !r.buff) return;
  rpgOf(p).buff = { id: r.buff, until: Date.now() + BUFF_MS };
  toast(`${r.name} 효과: ${BUFFS[r.buff]} (1시간)`);
}

// 모험 중이면 그 아이에게 도시락을 보내고, 아니면 고른 말랑이에게 떨어뜨려 준다
function serve(id) {
  const r = RECIPES[id];
  if (!r || !R.dishes[id]) return;
  const away = awayPet();
  if (away) {
    away.hunger = clamp(away.hunger + r.hunger, 0, 100);
    away.happy = clamp(away.happy + r.happy, 0, 100);
    applyBuff(away, id);
    scene.yum = { sprite: r.sprite, t: 1.4 };
  } else {
    const p = [selected(), focusPet()].find((x) => x && !x.sleeping && stageOf(x) !== 'egg');
    if (!p) return toast('먹일 말랑이를 골라 주세요 (깨어 있는 아이)');
    if (foods.some((f) => f.petId === p.id)) return;
    const v = viewOf(p);
    foods.push({ petId: p.id, x: v.x, y: v.y - STAGES[stageOf(p)].r * PX * 2 - 240, vy: 0, sprite: 'dish_' + id });
  }
  R.dishes[id]--;
  persist();
  refreshAdv(true);
}

// ---------- 창 ----------
const advBox = $('adv');
const sceneCv = $('advScene');
const sctx = sceneCv.getContext('2d');
const SW = sceneCv.width, SH = sceneCv.height, SG = 82;   // 장면 크기 · 땅 높이
let advPos = null;
let kitchen = false;
let advKey = '';
const scene = {
  scroll: 0, fight: null, floaters: [], bits: [], yum: null, views: new Map(), mates: new Map(),
  cook: null, steam: [], kviews: new Map(),   // 주방
};

function openAdv() {
  advBox.hidden = false;
  refreshAdv(true);
  placeAdv();
}

function placeAdv() {
  if (advBox.hidden) return;
  const w = advBox.offsetWidth, h = advBox.offsetHeight;
  const left = advPos ? advPos.x : 16;
  const top = advPos ? advPos.y : H - h - 24;
  advBox.style.left = Math.round(clamp(left, 10, W - w - 10)) + 'px';
  advBox.style.top = Math.round(clamp(top, 10, H - h - 10)) + 'px';
}

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
function icon(name) { const cv = el('canvas', 'ico'); cv.dataset.icon = name; renderIcon(cv); return cv; }
function bar(pct, cls = '') { const b = el('div', 'hpbar ' + cls); const i = el('i'); i.style.width = Math.round(clamp(pct, 0, 1) * 100) + '%'; b.append(i); return b; }
function button(text, onClick, cls = 'btn small', disabled = false) {
  const b = el('button', cls, text);
  b.disabled = disabled;
  b.addEventListener('click', onClick);
  return b;
}

// force: 목록까지 새로 (아니면 숫자만 바뀌는 줄만)
function refreshAdv(force = false) {
  if (advBox.hidden) return;
  const p = awayPet();
  const a = R.adv;
  $('advTab').textContent = kitchen ? '모험' : '요리';
  $('advMain').hidden = kitchen;
  $('advKitchen').hidden = !kitchen;
  $('advSub').textContent = a ? zoneOf(a.zone).name + (a.party ? ` · 파티 ${1 + mates().length}명` : '') : '준비 중';
  if (kitchen) return refreshKitchen(force);

  // 모험 중: 체력 · 경험치 · 전과
  const info = $('advInfo');
  info.replaceChildren();
  if (p) {
    const r = rpgOf(p);
    const row1 = el('div', 'row');
    row1.append(el('span', null, `${p.name} Lv.${r.lv}`), bar(r.hp / maxHp(p)), el('span', 'sub', `${Math.max(0, r.hp)}/${maxHp(p)}`));
    const row2 = el('div', 'row');
    row2.append(el('span', 'sub', '경험치'), bar(r.exp / expNeed(r.lv), 'exp'), el('span', 'sub', `배 ${Math.round(p.hunger)} · 기운 ${Math.round(p.energy)}`));
    const left = Math.max(0, Math.ceil((a.next - Date.now()) / 1000));
    const b = r.buff && r.buff.until > Date.now() ? ` · ${BUFFS[r.buff.id]} ${Math.ceil((r.buff.until - Date.now()) / 60000)}분` : '';
    const k = r.zones[a.zone] || 0;
    const ex = k < EXPLORE ? ` · 탐험 ${k}/${EXPLORE}` : '';
    const row3 = el('div', 'sub', `${a.kills}마리${a.bosses ? ` (보스 ${a.bosses})` : ''} · ${lootText(a.loot)}${ex} · 다음 ${left}초${b}`);
    info.append(row1, row2, row3);
  }
  $('advReady').hidden = !!p;
  $('advGo').hidden = !!p;
  $('advTogether').hidden = !!p;
  $('advBack').hidden = !p;
  $('advTogether').disabled = !roomOthers().length;
  $('advTogether').title = roomOthers().length ? '단톡방에 모인 친구들과 같이 모험 가요' : '친구들과 단톡방에 모였을 때 쓸 수 있어요';

  const key = `${!!p}|${state.pets.map((x) => x.id + cannotGo(x) + rpgOf(x).lv).join()}|${selZone}|${selPetId}|${[...invites.entries()].map(([k, v]) => k + v.id + v.n).join()}|${mates().map((m) => m.code + m.lv).join()}|${roomOthers().map((m) => m.code).join()}`;
  if (!force && key === advKey) return updatePartyBars();
  advKey = key;
  renderParty();
  if (p) return;

  // 보낼 말랑이 고르기
  const sel = $('advPet');
  const pets = state.pets.filter((x) => stageOf(x) !== 'egg');
  const cur = pickedPet();
  sel.replaceChildren(...(pets.length ? pets.map((x) => {
    const why = cannotGo(x);
    const o = el('option', null, `${x.name} Lv.${rpgOf(x).lv}${why ? ` (${why})` : ''}`);
    o.value = x.id;
    o.disabled = !!why;
    o.selected = cur && cur.id === x.id;
    return o;
  }) : [el('option', null, '보낼 수 있는 말랑이가 없어요')]));
  // 갈 곳
  const lv = cur ? rpgOf(cur).lv : 1;
  $('advZones').replaceChildren(...ZONES.map((z) => {
    const locked = lv < z.minLv;
    const k = cur ? rpgOf(cur).zones[z.id] || 0 : 0;
    const b = button('', () => { selZone = z.id; refreshAdv(true); }, 'btn' + (z.id === selZone ? ' on' : ''), locked);
    b.append(icon(z.mobs[0].sprite), el('span', null, z.name),
      el('span', 'sub', locked ? `Lv.${z.minLv}부터` : k >= EXPLORE ? '탐험 끝' : `${k}/${EXPLORE}`));
    b.title = locked ? '' : `탐험: 여기서 ${EXPLORE}마리를 물리치면 완료 (장비 조건)`;
    return b;
  }));
  $('advGo').disabled = !cur || lv < zoneOf(selZone).minLv;
}

// 파티 · 초대
function renderParty() {
  const box = $('advParty');
  box.replaceChildren();
  const a = R.adv;
  if (a && a.party) {
    for (const m of mates()) {
      const row = el('div', 'row');
      row.dataset.code = m.code;
      row.append(el('span', null, `${m.nick} Lv.${m.lv}`), bar(m.hpPct));
      box.append(row);
    }
    if (!mates().length) box.append(el('div', 'sub', '파티원 소식을 기다리는 중.. (연결이 끊기면 혼자 싸워요)'));
    return;
  }
  const now = Date.now();
  for (const [code, inv] of invites) {
    // 지금 있는 단톡방의 파티만 (오래된 초대는 버린다)
    if (now - inv.at > 10 * 60000 || !room || code !== room.host) { invites.delete(code); continue; }
    const who = code === state.myCode ? '내' : `${friendName(findFriend(code) || { code })}님`;
    const row = el('div', 'invite');
    row.append(icon('sword'), el('span', 'spacer', `${who} 파티 · ${zoneOf(inv.zone).name} · ${inv.n}명`),
      button('참가', () => joinParty(code), 'btn small primary', !pickedPet() || inv.n >= MAX_ROOM));
    box.append(row);
  }
}
function updatePartyBars() {
  for (const m of mates()) {
    const row = document.querySelector(`#advParty [data-code="${m.code}"] .hpbar i`);
    if (row) row.style.width = Math.round(m.hpPct * 100) + '%';
  }
}

function refreshKitchen(force) {
  const key = `${JSON.stringify(R.bag)}|${JSON.stringify(R.dishes)}|${!!R.adv}`;
  if (!force && key === advKey) return;
  advKey = key;
  const items = Object.keys(ITEMS).filter((k) => R.bag[k] > 0);
  $('advBag').replaceChildren(...(items.length ? items.map((k) => {
    const s = el('span', 'item');
    s.append(icon(ITEMS[k].sprite), el('span', null, `${ITEMS[k].name} ${R.bag[k]}`));
    return s;
  }) : [el('span', 'empty', '모험을 다녀오면 재료가 쌓여요 (낚시한 물고기도!)')]));
  $('advRecipes').replaceChildren(...Object.entries(RECIPES).map(([id, r]) => {
    const row = el('div', 'recipe');
    const need = el('span', 'need');
    for (const [k, n] of Object.entries(r.need)) {
      const s = el('span', (R.bag[k] || 0) < n ? 'lack' : null, `${itemName(k)} ${R.bag[k] || 0}/${n} `);
      need.append(s);
    }
    row.append(icon(r.sprite), el('span', 'name', r.name), need, button('만들기', () => cook(id), 'btn small', !canCook(r)));
    row.title = r.buff ? `배부름 +${r.hunger} · ${BUFFS[r.buff]} (1시간)` : `배부름 +${r.hunger}`;
    return row;
  }));
  const dishes = Object.keys(RECIPES).filter((id) => R.dishes[id] > 0);
  $('advDishes').replaceChildren(...(dishes.length ? dishes.map((id) => {
    const r = RECIPES[id];
    const row = el('div', 'recipe');
    row.append(icon(r.sprite), el('span', 'name', `${r.name} ×${R.dishes[id]}`), el('span', 'need', r.buff ? BUFFS[r.buff] : `배부름 +${r.hunger}`),
      button(R.adv ? '도시락' : '먹이기', () => serve(id), 'btn small primary'));
    return row;
  }) : [el('div', 'empty', '아직 만든 요리가 없어요')]));
}

// ---------- 싸우는 모습 ----------
function showFight(res) {
  if (advBox.hidden || kitchen) return;
  scene.fight = { res, t: 0 };
}
const HIT = 0.45, ENTER = 0.8;
const fightLen = (res) => ENTER + Math.min(res.rounds, 4) * HIT * 2 + 1.4;

function drawZoneBg(c, zone, s, t) {
  const sky = { meadow: T.bg, forest: T.gauge_empty, farm: T.bg, beach: T.bg, cave: T.border }[zone.id];
  const ground = { meadow: T.fun, forest: T.leaf, farm: T.hunger, beach: T.hunger, cave: T.text_sub }[zone.id];
  c.fillStyle = sky;
  c.fillRect(0, 0, SW, SH);
  const loop = (gap, speed, fn) => { const off = (s * speed) % gap; for (let x = -gap; x < SW + gap; x += gap) fn(Math.round(x - off)); };
  if (zone.id === 'meadow') {
    loop(70, 0.3, (x) => { c.fillStyle = T.gauge_empty; c.fillRect(x, 18, 26, 6); c.fillRect(x + 6, 14, 14, 4); });
    loop(23, 1, (x) => { c.fillStyle = T.leaf; c.fillRect(x, SG - 4, 2, 4); c.fillRect(x + 3, SG - 6, 2, 6); });
    loop(57, 1, (x) => { c.fillStyle = T.warn; c.fillRect(x + 10, SG - 8, 2, 2); });
  } else if (zone.id === 'forest') {
    loop(46, 0.5, (x) => { c.fillStyle = T.pot; c.fillRect(x + 8, 20, 6, SG - 20); c.fillStyle = T.leaf; c.fillRect(x, 8, 22, 16); c.fillRect(x + 4, 4, 14, 4); });
    loop(61, 1, (x) => { c.fillStyle = T.warn; c.fillRect(x, SG - 6, 6, 3); c.fillStyle = T.bg; c.fillRect(x + 2, SG - 3, 2, 3); });
  } else if (zone.id === 'farm') {
    loop(30, 1, (x) => { c.fillStyle = T.pot; c.fillRect(x, SG - 14, 3, 14); c.fillRect(x - 15, SG - 11, 30, 2); });
    loop(90, 0.4, (x) => { c.fillStyle = T.gauge_empty; c.fillRect(x, 16, 30, 6); });
  } else if (zone.id === 'beach') {
    c.fillStyle = T.clean;
    c.fillRect(0, SG - 22, SW, 14);
    loop(18, 0.6, (x) => { c.fillStyle = T.bg; c.fillRect(x + (Math.sin(t * 2) > 0 ? 2 : 0), SG - 18, 6, 2); });
    loop(52, 1, (x) => { c.fillStyle = T.bg; c.fillRect(x, SG - 3, 3, 2); });
  } else {
    loop(28, 0.6, (x) => { c.fillStyle = T.text_sub; c.fillRect(x, 0, 6, 6); c.fillRect(x + 2, 6, 2, 4); });
    loop(67, 1, (x) => { c.fillStyle = T.clean; c.fillRect(x, SG - 8, 3, 8); c.fillRect(x + 4, SG - 5, 2, 5); });
  }
  c.fillStyle = ground;
  c.fillRect(0, SG, SW, SH - SG);
  c.fillStyle = T.border;
  c.fillRect(0, SG, SW, 2);
}

function petView(id, map) {
  const rv = roomViewOf({ id }, map);
  rv.blinkT -= 1 / 60;
  if (rv.blinkT <= 0) { rv.blink = 0.15; rv.blinkT = rand(2, 5); }
  rv.blink = Math.max(0, rv.blink - 1 / 60);
  rv.squint = Math.max(0, rv.squint - 1 / 60);
  rv.sv += (-rv.s * 260 - rv.sv * 9) / 60;
  rv.s = clamp(rv.s + rv.sv / 60, -0.45, 0.55);
  return rv;
}

function drawScene(t, dt) {
  if (kitchen) return drawKitchen(t, dt);
  const a = R.adv;
  const p = awayPet();
  const zone = zoneOf(a ? a.zone : selZone);
  const f = scene.fight;
  if (f) f.t += dt;
  const fighting = f && f.t < fightLen(f.res);
  if (!fighting) scene.fight = null;
  if (!fighting && p) scene.scroll += dt * 26;   // 싸울 상대가 없으면 앞으로 걸어간다
  drawZoneBg(sctx, zone, scene.scroll, t);
  if (!p) {
    // 준비 중: 갈 곳의 몬스터가 어슬렁
    const m = zone.mobs[Math.floor(t / 3) % zone.mobs.length];
    drawSprite(sctx, m.sprite, 200 + Math.sin(t) * 6, SG - (Math.sin(t * 5) > 0.6 ? 2 : 0), 2);
    sctx.fillStyle = T.text_sub;
    sctx.font = '11px Galmuri11, "Malgun Gothic", sans-serif';
    sctx.textAlign = 'left'; sctx.textBaseline = 'top';
    sctx.fillText(`${zone.name} · 말랑이를 보내 보세요`, 8, 6);
    return;
  }

  // 우리 편: 맨 앞이 내 말랑이, 뒤로 파티원들
  const team = [{ pet: p, id: p.id }, ...(f ? f.res.team : mates()).map((m) => {
    let mp = scene.mates.get(m.code);
    if (!mp) { mp = guestPet('adv-' + m.code, m.looks); scene.mates.set(m.code, mp); }
    Object.assign(mp, visitorLooks(m.looks));
    return { pet: mp, id: mp.id };
  })].slice(0, MAX_ROOM);
  const ft = f ? f.t - ENTER : -1;
  const hits = f ? Math.min(f.res.rounds, 4) : 0;
  const hitI = ft >= 0 ? Math.floor(ft / HIT) : -1;      // 짝수: 우리 편이 때림, 홀수: 몬스터가 때림
  const over = f && hitI >= hits * 2;
  const bow = (worn(p, 'weapon') || {}).kind === 'bow';
  const ourTurn = fighting && hitI >= 0 && !over && hitI % 2 === 0;
  team.forEach((m, i) => {
    const rv = petView(m.id, scene.views);
    let x = 96 - i * 18;
    const walkHop = !fighting ? Math.abs(Math.sin(t * 7 + i)) * 4 : 0;
    // 우리 차례면 앞으로 콩 (활을 든 내 말랑이는 제자리에서 쏜다)
    if (ourTurn && (i === 0 || hitI % 4 === 0) && !(i === 0 && bow)) {
      x += Math.sin(((ft % HIT) / HIT) * Math.PI) * 14;
    }
    if (over && !f.res.win && i === 0) rv.s = 0.4;   // 졌으면 납작
    rv.x = x; rv.y = SG - walkHop; rv.face = 1;
    rv.playT = fighting && f.res.win && over ? 1 : 0;
    drawPet(sctx, m.pet, rv, stageOf(m.pet), t, SG, 2);
  });

  // 상대
  if (fighting) {
    const res = f.res;
    const px = res.boss ? 3 : 2;
    let mx = 206;
    if (f.t < ENTER) mx = 206 + (1 - f.t / ENTER) * 90;
    const theirTurn = hitI >= 0 && !over && hitI % 2 === 1 && res.dmg > 0;
    if (theirTurn) mx -= Math.sin(((ft % HIT) / HIT) * Math.PI) * 14;
    const hurt = hitI >= 0 && !over && hitI % 2 === 0 && (ft % HIT) / HIT > 0.4;
    const gone = over && res.win;
    // 활: 화살이 슝 날아가서 맞힌다 (몬스터가 움찔하기 전에 닿는다)
    const fly = ((ft % HIT) / HIT) * 2.5;
    if (bow && ourTurn && fly < 1) {
      const ax = Math.round(110 + (mx - 8 - 110) * fly), ay = SG - 12;
      sctx.fillStyle = T.pot;
      sctx.fillRect(ax - 8, ay, 8, 2);
      sctx.fillStyle = T.text_sub;
      sctx.fillRect(ax, ay - 1, 2, 4);
      sctx.fillRect(ax - 10, ay - 2, 2, 2); sctx.fillRect(ax - 10, ay + 2, 2, 2);
    }
    if (!gone && !(hurt && Math.floor(t * 20) % 2)) {
      drawSprite(sctx, res.mob.sprite, mx + (hurt ? 2 : 0), SG, px);
      if (res.boss) drawSprite(sctx, 'crown', mx, SG - SPR[res.mob.sprite].length * px - 4, 2);
    }
    // 한 대 맞을 때마다 숫자가 톡
    if (hitI >= 0 && !over && hitI !== f.lastHit) {
      f.lastHit = hitI;
      if (hitI % 2 === 0) scene.floaters.push({ x: mx, y: SG - 24, text: String(Math.round(res.mob.hp * (res.boss ? Math.max(1, res.team.length + 1) : 1) / res.rounds)), color: T.text, t: 0.8 });
      else if (res.dmg > 0) scene.floaters.push({ x: 96, y: SG - 30, text: '-' + Math.max(1, Math.round(res.dmg / Math.max(1, res.rounds - 1))), color: T.warn, t: 0.8 });
    }
    if (gone && !f.done) {
      f.done = true;
      for (let i = 0; i < 6; i++) scene.bits.push({ x: mx, y: SG - 10, vx: rand(-60, 60), vy: -rand(60, 140), t: 0.7, sprite: 'puff' });
      let k = 0;
      for (const [item, n] of Object.entries(res.loot)) {
        scene.floaters.push({ x: mx - 10 + k * 22, y: SG - 18, text: `+${n}`, color: T.text, t: 1.3, sprite: ITEMS[item].sprite });
        k++;
      }
      if (res.levelUp) scene.floaters.push({ x: 96, y: SG - 44, text: `Lv.${res.levelUp}!`, color: T.warn, t: 1.6 });
      if (res.gear) scene.floaters.push({ x: mx, y: SG - 40, text: '!', color: T.warn, t: 2, sprite: GEAR[res.gear].sprite });
    }
    if (over && !res.win && !f.done) { f.done = true; scene.floaters.push({ x: 96, y: SG - 40, text: '후퇴..', color: T.warn, t: 1.4 }); }
    sctx.fillStyle = res.boss ? T.warn : T.text_sub;
    sctx.font = '11px Galmuri11, "Malgun Gothic", sans-serif';
    sctx.textAlign = 'right'; sctx.textBaseline = 'top';
    sctx.fillText(res.boss ? `보스! ${res.mob.name}` : res.mob.name, SW - 6, 5);
  }

  // 도시락 받았을 때
  if (scene.yum && (scene.yum.t -= dt) > 0) drawSprite(sctx, scene.yum.sprite, 96, SG - 34 - (1.4 - scene.yum.t) * 10, 2);
  drawFx(dt);
}

// 떠오르는 숫자 · 재료 · 연기
function drawFx(dt) {
  sctx.font = 'bold 11px Galmuri11, "Malgun Gothic", sans-serif';
  sctx.textAlign = 'center'; sctx.textBaseline = 'middle';
  scene.floaters = scene.floaters.filter((fl) => (fl.t -= dt) > 0);
  for (const fl of scene.floaters) {
    fl.y -= dt * 18;
    sctx.globalAlpha = Math.min(1, fl.t * 2);
    if (fl.sprite) drawSprite(sctx, fl.sprite, fl.x - 6, fl.y + 4, 2);
    sctx.fillStyle = fl.color;
    sctx.fillText(fl.text, fl.x + (fl.sprite ? 8 : 0), fl.y);
  }
  scene.bits = scene.bits.filter((b) => (b.t -= dt) > 0);
  for (const b of scene.bits) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 300 * dt;
    sctx.globalAlpha = Math.min(1, b.t * 2);
    drawSprite(sctx, b.sprite, b.x, b.y, 2);
  }
  sctx.globalAlpha = 1;
}

// ---------- 요리하는 모습 ----------
const COOK_IN = 0.9, COOK_FRY = 2.4, COOK_LEN = 3.6;   // 재료 넣기 → 볶기 → 완성 → 끝
const PAN_X = 198, PAN_Y = 50;                          // 프라이팬 가운데 · 바닥
const CHEF_X = 138;

// 집에 있는 아이가 요리한다 (깨어 있는 아이 먼저)
function cookPet() {
  const pool = [selected(), ...state.pets].filter((p) => p && stageOf(p) !== 'egg');
  return pool.find((p) => !p.sleeping) || pool[0] || null;
}

function drawKitchenBg(c, t, fire, shake) {
  c.fillStyle = T.bg;
  c.fillRect(0, 0, SW, SG);
  // 창문
  c.fillStyle = T.border;
  c.fillRect(102, 20, 32, 26);
  c.fillStyle = T.clean;
  c.fillRect(104, 22, 28, 22);
  c.fillStyle = T.border;
  c.fillRect(117, 22, 2, 22);
  c.fillRect(104, 32, 28, 2);
  // 선반과 병
  c.fillStyle = T.pot;
  c.fillRect(10, 46, 82, 3);
  c.fillRect(16, 49, 3, 5);
  c.fillRect(83, 49, 3, 5);
  [T.clean, T.hunger, T.warn, T.fun].forEach((col, i) => {
    const x = 18 + i * 18, h = i % 2 ? 10 : 13;
    c.fillStyle = col;
    c.fillRect(x, 46 - h, 10, h);
    c.fillStyle = T.border;
    c.fillRect(x - 1, 46 - h - 3, 12, 3);
  });
  // 타일 벽 · 걸어 둔 국자들
  c.fillStyle = T.gauge_empty;
  c.fillRect(150, 28, 104, SG - 28);
  c.fillStyle = T.bg;
  for (let y = 36; y < SG; y += 10) c.fillRect(150, y, 104, 2);
  for (let x = 160; x < 254; x += 12) c.fillRect(x, 28, 2, SG - 28);
  c.fillStyle = T.border;
  c.fillRect(166, 22, 70, 2);
  c.fillStyle = T.text_sub;
  c.fillRect(178, 24, 2, 10); c.fillRect(175, 34, 8, 4);               // 국자
  c.fillRect(204, 24, 2, 8); c.fillRect(201, 32, 8, 6);                // 뒤집개
  c.fillRect(226, 24, 2, 6); c.fillRect(223, 30, 8, 2); c.fillRect(223, 30, 2, 8); c.fillRect(229, 30, 2, 8); c.fillRect(223, 36, 8, 2);  // 거품기
  // 바닥
  c.fillStyle = T.floor;
  c.fillRect(0, SG, SW, SH - SG);
  c.fillStyle = T.floor_grain;
  for (let x = 6; x < SW; x += 34) c.fillRect(x, SG + 7, 14, 2);
  for (let x = 22; x < SW; x += 34) c.fillRect(x, SG + 13, 10, 2);
  c.fillStyle = T.border;
  c.fillRect(0, SG, SW, 2);
  // 가스레인지
  c.fillStyle = T.text_sub;
  c.fillRect(162, 56, 74, SG - 56);
  c.fillStyle = T.border;
  c.fillRect(160, 54, 78, 4);
  c.fillStyle = T.gauge_empty;
  c.fillRect(172, 62, 54, 16);
  c.fillStyle = T.border;
  c.fillRect(182, 64, 34, 2);
  c.fillRect(166, 58, 4, 2); c.fillRect(228, 58, 4, 2);
  // 불
  if (fire) {
    for (let i = 0; i < 5; i++) {
      const h = 2 + ((Math.floor(t * 12) + i * 2) % 3) * 2;
      c.fillStyle = T.warn;
      c.fillRect(PAN_X - 10 + i * 4, 54 - h, 3, h);
      c.fillStyle = T.hunger;
      c.fillRect(PAN_X - 9 + i * 4, 54 - Math.ceil(h / 2), 1, Math.ceil(h / 2));
    }
  }
  // 프라이팬
  const px = PAN_X + shake.x, py = PAN_Y + shake.y;
  c.fillStyle = T.pot;
  c.fillRect(px - 30, py - 5, 16, 3);
  c.fillStyle = T.outline;
  c.fillRect(px - 14, py - 6, 28, 6);
  c.fillStyle = T.text_sub;
  c.fillRect(px - 12, py - 6, 24, 2);
}

function drawKitchen(t, dt) {
  const ck = scene.cook;
  if (ck && (ck.t += dt) > COOK_LEN) scene.cook = null;
  const r = ck && RECIPES[ck.id];
  const ft = ck ? ck.t : -1;
  const frying = ck && ft >= COOK_IN && ft < COOK_FRY;
  const done = ck && ft >= COOK_FRY;
  const shake = frying ? { x: Math.round(Math.sin(t * 28) * 2), y: Math.sin(ft * 5) > 0.7 ? -2 : 0 } : { x: 0, y: 0 };
  drawKitchenBg(sctx, t, ck && ft >= COOK_IN * 0.5 && !done, shake);

  // 요리사 말랑이: 볶을 땐 콩콩, 다 되면 기뻐서 폴짝
  const p = cookPet();
  if (p) {
    const rv = petView(p.id, scene.kviews);
    rv.x = CHEF_X; rv.face = 1;
    rv.y = SG - (done ? Math.abs(Math.sin(t * 9)) * 7 : frying ? Math.abs(Math.sin(t * 8)) * 2 : 0);
    rv.playT = done ? 1 : 0;
    drawPet(sctx, p, rv, stageOf(p), t, SG, 2);
    // 뒤집개로 휘휘
    if (frying) {
      const bx = CHEF_X + 12, by = SG - 14;
      const tx = PAN_X + shake.x - 4 + Math.sin(t * 12) * 7, ty = PAN_Y + shake.y - 8;
      sctx.fillStyle = T.pot;
      for (let i = 0; i <= 8; i++) sctx.fillRect(Math.round(bx + (tx - bx) * i / 8), Math.round(by + (ty - by) * i / 8), 2, 2);
      sctx.fillStyle = T.text_sub;
      sctx.fillRect(Math.round(tx) - 2, Math.round(ty), 6, 3);
    }
  }

  if (r) {
    const ks = Object.keys(r.need);
    if (!done) {
      // 재료가 하나씩 퐁퐁 팬으로 들어가고, 볶을 땐 팬 안에서 튄다
      ks.forEach((k, i) => {
        const toX = PAN_X + shake.x + (i - (ks.length - 1) / 2) * 8;
        const toY = PAN_Y + shake.y - 4;
        const q = clamp((ft - i * 0.18) / 0.5, 0, 1);
        if (q <= 0) return;
        const x = q < 1 ? CHEF_X + (toX - CHEF_X) * q : toX;
        const y = q < 1 ? (SG - 26) + (toY - (SG - 26)) * q - Math.sin(q * Math.PI) * 22
          : toY - (frying ? Math.max(0, Math.sin(ft * 9 + i * 2)) * 6 : 0);
        drawSprite(sctx, ITEMS[k].sprite, x, y, 2);
      });
      if (frying && Math.random() < dt * 7) scene.steam.push({ x: PAN_X + rand(-12, 12), y: PAN_Y - 10, t: 1 });
    } else {
      // 완성! 팬 위로 요리가 쏙
      const q = Math.min(1, (ft - COOK_FRY) / 0.35);
      drawSprite(sctx, r.sprite, PAN_X, PAN_Y - 4 - q * 14, 2);
      if (!ck.done) {
        ck.done = true;
        for (let i = 0; i < 6; i++) scene.bits.push({ x: PAN_X, y: PAN_Y - 16, vx: rand(-70, 70), vy: -rand(60, 130), t: 0.8, sprite: 'sparkle' });
        scene.floaters.push({ x: PAN_X - 20, y: 24, text: `${r.name} 완성!`, color: T.warn, t: 1.4 });
      }
    }
  }
  // 김이 모락모락
  scene.steam = scene.steam.filter((s) => (s.t -= dt) > 0);
  for (const s of scene.steam) {
    s.y -= dt * 22;
    s.x += Math.sin(s.t * 8) * dt * 10;
    sctx.globalAlpha = Math.min(1, s.t * 1.5) * 0.8;
    drawSprite(sctx, 'puff', s.x, s.y, 2, false);
  }
  sctx.globalAlpha = 1;

  sctx.font = '11px Galmuri11, "Malgun Gothic", sans-serif';
  sctx.textBaseline = 'top';
  sctx.textAlign = 'left';
  sctx.fillStyle = T.text_sub;
  sctx.fillText(p ? `${p.name}네 주방` : '주방', 8, 6);
  if (r && !done) {
    sctx.textAlign = 'right';
    sctx.fillStyle = T.text;
    sctx.fillText(`${r.name} 만드는 중..`, SW - 6, 6);
  } else if (!r && !p) {
    sctx.textAlign = 'right';
    sctx.fillText('요리할 말랑이가 없어요', SW - 6, 6);
  }
  drawFx(dt);
}

// ---------- 옷장 ----------
const closetBox = $('closet');
const closetCv = $('closetScene');
const cctx = closetCv.getContext('2d');
const CW = closetCv.width, CH = closetCv.height, CG = 74;   // 장면 크기 · 바닥 높이
const closetViews = new Map();
let closetPos = null;
let closetPetId = null;
let closetKey = '';

// 옷장 앞에 선 아이 (집에 있는 아이만 갈아입힐 수 있다)
function closetPet() {
  const ok = (p) => p && stageOf(p) !== 'egg';
  return state.pets.find((p) => p.id === closetPetId && ok(p)) || [selected(), ...state.pets].find(ok) || null;
}

function openCloset() {
  closetBox.hidden = false;
  refreshCloset(true);
  placeCloset();
}

function placeCloset() {
  if (closetBox.hidden) return;
  const w = closetBox.offsetWidth, h = closetBox.offsetHeight;
  let left = 16, top = H - h - 24;
  if (closetPos) ({ x: left, y: top } = closetPos);
  else if (!home.hidden) {
    // 집 창 왼쪽에 나란히
    const r = home.getBoundingClientRect();
    left = r.left - w - 14;
    top = r.bottom - h;
  }
  closetBox.style.left = Math.round(clamp(left, 10, W - w - 10)) + 'px';
  closetBox.style.top = Math.round(clamp(top, 10, H - h - 10)) + 'px';
}

function wear(p, id) {
  const g = GEAR[id];
  if (!p || !g) return;
  if (!canWear(p, g)) return toast('아직 입을 수 없어요 (레벨 · 탐험 조건을 확인해 주세요)');
  if (freeCount(id) <= 0) return toast(`${josa(g.name, '은', '는')} 다른 말랑이가 입고 있어요`);
  rpgOf(p).gear[g.slot] = id;
  const rv = closetViews.get(p.id);
  if (rv) { rv.jumpT = 0.5; rv.sv -= 2.5; }
  toast(`${josa(p.name, '이', '가')} ${josa(g.name, '을', '를')} ${g.slot === 'weapon' ? '들었어요' : '입었어요'}!`);
  persist();
  refreshCloset(true);
}

function takeOff(p, slot) {
  if (!p || !rpgOf(p).gear[slot]) return;
  rpgOf(p).gear[slot] = null;
  const rv = closetViews.get(p.id);
  if (rv) rv.sv += 2;
  persist();
  refreshCloset(true);
}

function refreshCloset(force = false) {
  if (closetBox.hidden) return;
  const p = closetPet();
  const key = `${p ? p.id + JSON.stringify(rpgOf(p).gear) + rpgOf(p).lv + JSON.stringify(rpgOf(p).zones) : ''}|${JSON.stringify(R.gear)}|${state.pets.map((x) => x.id + stageOf(x)).join()}|${R.away.map((x) => x.id).join()}`;
  if (!force && key === closetKey) return;
  closetKey = key;
  const total = Object.values(R.gear).reduce((s, n) => s + n, 0);
  $('closetSub').textContent = `장비 ${total}개`;

  // 입힐 말랑이 (모험 간 아이는 돌아오면)
  const pets = state.pets.filter((x) => stageOf(x) !== 'egg');
  const opts = pets.map((x) => {
    const o = el('option', null, `${x.name} Lv.${rpgOf(x).lv}`);
    o.value = x.id;
    o.selected = p && p.id === x.id;
    return o;
  });
  for (const x of R.away) { const o = el('option', null, `${x.name} (모험 중)`); o.disabled = true; opts.push(o); }
  $('closetPet').replaceChildren(...(opts.length ? opts : [el('option', null, '입힐 말랑이가 없어요')]));

  // 지금 입은 것 · 능력치 · 탐험한 곳
  const wearBox = $('closetWear');
  wearBox.replaceChildren();
  if (p) {
    for (const slot of ['weapon', 'armor']) {
      const g = worn(p, slot);
      const row = el('div', 'row');
      row.append(el('span', 'slot', SLOT_NAME[slot]), el('span', 'what', g ? g.name : '없음'));
      if (g) row.append(el('span', 'sub', gearText(g)), button('벗기기', () => takeOff(p, slot), 'link'));
      wearBox.append(row);
    }
    const def = Math.round(gearDef(p) * 100);
    wearBox.append(el('div', 'sub', `공격 ${Math.round(atkOf(p))} · 체력 ${maxHp(p)}${def ? ` · 받는 피해 -${def}%` : ''}`));
    const done = ZONES.filter((z) => explored(p, z.id)).map((z) => z.name);
    wearBox.append(el('div', 'sub', done.length ? `탐험 끝: ${done.join(', ')}` : `탐험 끝낸 곳이 아직 없어요 (한 곳에서 ${EXPLORE}마리)`));
  }

  // 가진 장비: 단계 순, 무기 먼저
  const ids = Object.keys(GEAR).filter((id) => R.gear[id] > 0);
  $('closetList').replaceChildren(...(ids.length ? ids.map((id) => {
    const g = GEAR[id];
    const mine = p && rpgOf(p).gear[g.slot] === id;
    const row = el('div', 'gear' + (mine ? ' worn' : ''));
    const info = el('span', 'info');
    info.append(el('span', 'name', `${g.name}${R.gear[id] > 1 ? ` ×${R.gear[id]}` : ''}`));
    const need = el('span', 'need');
    const lack = p ? gearLack(p, g) : { lv: true, zone: !!g.need };
    need.append(el('span', lack.lv ? 'lack' : null, `Lv.${g.lv}`));
    if (g.need) need.append(' · ', el('span', lack.zone ? 'lack' : null, `${zoneOf(g.need).name} 탐험`));
    need.append(` · ${gearText(g)}`);
    info.append(need);
    let btn;
    if (mine) btn = button('벗기기', () => takeOff(p, g.slot));
    else {
      const free = freeCount(id) > 0;
      btn = button('입히기', () => wear(p, id), 'btn small primary', !p || lack.lv || lack.zone || !free);
      btn.title = !p ? '' : lack.lv || lack.zone ? '레벨 · 탐험 조건이 모자라요' : !free ? '다른 말랑이가 입고 있어요' : '';
    }
    row.append(icon(g.sprite), info, btn);
    return row;
  }) : [el('div', 'empty', '모험에서 장비를 주워 오면 여기 걸려요')]));
}

// 옷장 앞에서 입은 모습을 보여 준다
function drawCloset(t, dt) {
  const c = cctx;
  c.fillStyle = T.bg;
  c.fillRect(0, 0, CW, CH);
  c.fillStyle = T.gauge_empty;
  for (let y = 8, row = 0; y < CG; y += 14, row++) {
    for (let x = (row % 2) * 8 + 6; x < CW; x += 16) c.fillRect(x, y, 2, 2);
  }
  c.fillStyle = T.floor;
  c.fillRect(0, CG, CW, CH - CG);
  c.fillStyle = T.border;
  c.fillRect(0, CG, CW, 2);
  // 문이 열린 옷장: 옷걸이에 아직 아무도 안 입은 장비가 걸려 있다
  rectO(c, 30, 12, 70, CG - 14, T.pot);
  c.fillStyle = T.floor_grain;
  c.fillRect(34, 16, 62, CG - 22);
  rectO(c, 16, 14, 8, CG - 18, T.pot);
  rectO(c, 106, 14, 8, CG - 18, T.pot);
  c.fillStyle = T.border;
  c.fillRect(34, 22, 62, 2);
  const hanging = Object.keys(GEAR).filter((id) => freeCount(id) > 0).slice(-5);
  hanging.forEach((id, i) => {
    const x = 42 + i * 12;
    c.fillStyle = T.text_sub;
    c.fillRect(x - 1, 24, 2, 4);
    drawSprite(c, GEAR[id].sprite, x - 2, 30 + SPR[GEAR[id].sprite].length * 2 + (Math.sin(t * 2 + i) > 0.6 ? 1 : 0), 2);
  });
  c.fillStyle = T.hunger;
  c.fillRect(20, CG / 2, 2, 4);
  c.fillRect(108, CG / 2, 2, 4);

  const p = closetPet();
  c.font = '11px Galmuri11, "Malgun Gothic", sans-serif';
  c.textBaseline = 'top';
  c.textAlign = 'right';
  c.fillStyle = T.text_sub;
  if (!p) { c.fillText('입힐 말랑이가 없어요', CW - 6, 6); return; }
  const rv = petView(p.id, closetViews);
  rv.jumpT = Math.max(0, (rv.jumpT || 0) - dt);
  rv.x = 180; rv.face = 1;
  rv.y = CG - Math.sin((rv.jumpT / 0.5) * Math.PI) * 12;
  drawPet(c, p, rv, stageOf(p), t, CG, 3);
}

// 말랑이 몸에 갑옷을 입히고 무기를 쥐여 준다 (renderer.js의 drawPet이 부른다)
hooks.dress.push((cells, p, d) => {
  const g = p.rpg && p.rpg.gear;
  if (!g || d.st === 'egg') return;
  const armor = GEAR[g.armor], weapon = GEAR[g.weapon];
  if (armor) {
    // 몸 아랫부분을 감싸는 띠 + 위쪽 테두리 + 징
    const [main, edge] = armor.look.map((k) => d.pal[PAL[k]]);
    const top = d.hh >= 9 ? -3 : -2;
    for (let y = top; y <= -1; y++) {
      for (let x = -d.hw - 1; x <= d.hw; x++) if (cells.has(x, y)) cells.set(x, y, y === top ? edge : main);
    }
    for (let x = 1 - d.hw; x < d.hw - 1; x += 3) if (cells.has(x, -1)) cells.set(x, -1, edge);
  }
  if (weapon) {
    // 보는 쪽 옆구리에 세워 든다
    const right = !(d.face < 0);
    stamp(cells, SPR[weapon.sprite + (right ? '' : 'L')], right ? d.hw + 1 : -d.hw - 2, -1, d.pal);
  }
});

// ---------- 연결 ----------
$('hCloset').addEventListener('click', () => { if (closetBox.hidden) openCloset(); else closetBox.hidden = true; });
$('closetClose').addEventListener('click', () => { closetBox.hidden = true; });
$('closetPet').addEventListener('change', (e) => { closetPetId = e.target.value; refreshCloset(true); });
dragBy($('closetBar'), closetBox, (pos) => { closetPos = pos; });
hooks.wardrobe.push(openCloset);
hooks.frame.push((t, dt) => {
  if (closetBox.hidden) return;
  drawCloset(t, dt);
  placeCloset();
});
hooks.tick.push(() => refreshCloset());
$('hAdv').addEventListener('click', () => { if (advBox.hidden) openAdv(); else advBox.hidden = true; });
$('advClose').addEventListener('click', () => { advBox.hidden = true; });
$('advTab').addEventListener('click', () => { kitchen = !kitchen; advKey = ''; refreshAdv(true); });
$('advGo').addEventListener('click', () => { const p = pickedPet(); if (p) depart(p, selZone); });
$('advTogether').addEventListener('click', askTogether);
$('advBack').addEventListener('click', () => { if (R.adv) comeHome('call'); });
$('advPet').addEventListener('change', (e) => { selPetId = e.target.value; refreshAdv(true); });
dragBy($('advBar'), advBox, (pos) => { advPos = pos; });

hooks.frame.push((t, dt) => {
  if (advBox.hidden) return;
  drawScene(t, dt);
  placeAdv();
});
let rosterBeat = 0;
hooks.tick.push(() => {
  stepAdventure();
  // 파티장은 5초마다 명단을 나눠 준다. 아무도 없고 나도 안 가 있으면 1분 뒤 파티를 닫는다
  if (R.host && ++rosterBeat % 5 === 0) {
    broadcastRoster();
    const mine = R.adv && R.adv.party && R.adv.party.id === R.host.id;
    const anyone = [...hostRoster.values()].some((m) => Date.now() - m.at < 60000);
    if (!mine && !anyone && Date.now() - (R.host.openedAt || (R.host.openedAt = Date.now())) > 60000) { R.host = null; hostRoster.clear(); invites.delete(state.myCode); }
    else if (mine || anyone) R.host.openedAt = Date.now();
  }
  refreshAdv();
});
hooks.data.push(onPartyData);
hooks.eat.push((p, v, food) => { if (String(food).startsWith('dish_')) applyBuff(p, food.slice(5)); });
hooks.card.push((p) => { if (stageOf(p) !== 'egg') $('pStage').textContent += ` · Lv.${rpgOf(p).lv}`; });
hooks.caught.push(() => { R.bag.fish = (R.bag.fish || 0) + 1; if (kitchen) refreshAdv(); });

renderIcons();
// 켤 때 모험 중이면 밀린 싸움을 계산하고 창을 띄운다
if (R.adv) { stepAdventure(); if (R.adv) openAdv(); }
