'use strict';

// ===================== 설정 창 =====================
// 버전 · 테마 · 항상 위 · 방해 금지 · 창 크기/자리 처음대로 · 튜토리얼 다시 보기.
// 집 창 제목줄의 톱니바퀴나 트레이 메뉴의 '설정'으로 연다
const settingsBox = $('settings');
let settingsPos = null;

function openSettings() {
  closeCard();
  const opening = settingsBox.hidden;
  settingsBox.hidden = false;
  refreshSettings();
  if (opening) {
    // 집 창이 열려 있으면 그 왼쪽 위에 나란히, 아니면 오른쪽 아래 (다른 창이 있으면 옆으로)
    const { w, h } = boxSize(settingsBox);
    const r = !home.hidden && home.getBoundingClientRect();
    settingsPos = autoSpot(settingsBox, r ? { x: r.left - w - 14, y: r.top } : { x: W - w - 30, y: H - h - 60 }, settingsPos);
  }
  placeSettings();
}

function placeSettings() {
  if (settingsBox.hidden) return;
  const { w, h } = boxSize(settingsBox);
  const left = settingsPos ? settingsPos.x : W - w - 30;
  const top = settingsPos ? settingsPos.y : H - h - 60;
  settingsBox.style.left = Math.round(clamp(left, 10, W - w - 10)) + 'px';
  settingsBox.style.top = Math.round(clamp(top, 10, H - h - 10)) + 'px';
}

function onOff(btn, on) {
  btn.textContent = on ? '켜짐' : '꺼짐';
  btn.classList.toggle('primary', on);
}

function refreshSettings() {
  if (settingsBox.hidden) return;
  $('setVer').textContent = 'v' + window.malang.version;
  $('setTheme').textContent = THEME_LABEL[state.theme];
  onOff($('setTop'), state.onTop);
  onOff($('setDnd'), state.dnd);
}

// 끌어서 옮긴 자리와 키운 크기를 모두 처음대로
function resetLayout() {
  state.uiScale = {};
  for (const box of panels()) box.style.scale = '1';
  userPlaced.clear();
  homePos = friendsPos = chatPos = advPos = closetPos = settingsPos = null;
  persist();
  toast('창 크기와 자리를 처음대로 돌렸어요');
}

$('hSettings').addEventListener('click', () => { if (settingsBox.hidden) openSettings(); else settingsBox.hidden = true; });
$('settingsClose').addEventListener('click', () => { settingsBox.hidden = true; });
$('setTheme').addEventListener('click', () => {
  setTheme({ system: 'light', light: 'dark', dark: 'system' }[state.theme] || 'system');
  refreshSettings();
});
$('setTop').addEventListener('click', toggleOnTop);
$('setDnd').addEventListener('click', toggleDnd);
$('setLayout').addEventListener('click', resetLayout);
$('setTour').addEventListener('click', () => { settingsBox.hidden = true; startTour(); });
dragBy($('settingsBar'), settingsBox, (pos) => { settingsPos = pos; });
resizeBy(settingsBox);
hooks.frame.push(placeSettings);

// ===================== 튜토리얼 =====================
// 내 말랑이가 상자 왼쪽에서 통통 튀며 말로 알려 준다. 가리키는 곳(말랑이 · 표지 · 버튼)엔
// 깜빡이는 도트 테두리와 통통 튀는 화살표. 처음 입양했을 때(1.8.6 전부터 키우던 사람은 다음에 켤 때) 한 번,
// 그다음엔 설정의 '튜토리얼 다시 보기'로
const tourBox = $('tour');
const tourRing = $('tourRing');
const tourArrow = $('tourArrow');
const tourCtx = $('tourPet').getContext('2d');
const tourView = { x: 48, y: 76, s: 0, sv: 0, face: 1, wob: 0, blink: 0, blinkT: 2, squint: 0, eatT: 0, playT: 0, held: false };
let tourStep = -1;
let tourHop = 0;   // 남은 깡충 시간 (초)

const arrowIcon = document.createElement('canvas');
arrowIcon.className = 'ico';
arrowIcon.dataset.icon = 'arrow';
tourArrow.append(arrowIcon);
renderIcon(arrowIcon);

const guidePet = () => focusPet() || selected() || state.pets[0] || null;
const guideName = () => (guidePet() ? guidePet().name : '말랑이');

// 가리킬 곳 (화면 좌표 사각형). 없으면 null
function petRect() {
  const p = guidePet();
  const g = p && viewOf(p).geo;
  return g ? { x: g.cx - g.rx - 8, y: g.top - 6, w: g.rx * 2 + 16, h: g.cy + g.ry - g.top + 10 } : null;
}
function markRect() {
  const g = homeMark.geo;
  return g ? { x: g.x - 4, y: g.y - 4, w: g.w + 8, h: g.h + 8 } : null;
}
function elRect(el) {
  if (!el || el.closest('[hidden]')) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left - 3, y: r.top - 3, w: r.width + 6, h: r.height + 6 };
}
// 트레이는 화면 밖(작업표시줄)이라 오른쪽 아래 끝을 화살표로만 가리킨다
const trayRect = () => ({ x: W - 70, y: H - 4, w: 60, h: 4, arrowOnly: true });

const TOUR = [
  { title: () => `안녕! 나는 ${josa(guideName(), '이야', '야')}`, text: '오늘부터 네 바탕화면에서 같이 살게 ♪ 어떻게 놀아 주면 되는지 내가 차근차근 알려 줄게!', at: petRect, mood: 'heart' },
  { title: '콕 눌러 줘', text: '나를 누르면 돌봄 카드가 떠. 밥 · 놀기 · 씻기 · 재우기로 돌봐 줘! 배고프거나 심심하면 말풍선으로 말할게', at: petRect, mood: 'note' },
  { title: '잡고 던지기', text: '나를 꾹 잡고 끌면 옮길 수 있고, 휙 놓으면 날아가! 너무 세게 던지면 어질어질해..', at: petRect, mood: 'sparkle' },
  { title: '여기가 우리 집', text: '이 새싹 말풍선이 말랑이네 표지야. 누르면 집 창이 열려! 밤에 졸리면 나는 여기 들어가서 쿨쿨 자', at: markRect, mood: 'heart' },
  { title: '집 창', text: '입양 · 친구 · 집중 모드 · 모험 · 옷장 버튼이 다 여기 있어. 창은 제목줄을 끌어 옮기고, 오른쪽 아래 모서리로 크기를 바꿔', at: () => elRect(home), home: true, mood: 'note' },
  { title: '집중 모드', text: '공부나 일할 땐 [집중 모드]! 나는 조용히 낚시하면서 기다릴게. 물고기를 100마리 낚으면 낚시꾼이 돼', at: () => elRect($('hFocus')), home: true, mood: 'focus' },
  { title: '친구랑 같이', text: '[친구 · 쪽지]에서 서로 친구 코드를 추가하고 단톡방에 부르면, 친구네 말랑이가 네 화면에 놀러 와! 쪽지는 말풍선으로 전해 줄게', at: () => elRect($('hFriends')), home: true, mood: 'letter' },
  { title: '모험 · 요리', text: '어른이 되면 모험을 떠나 재료를 모아 와. 요리해서 먹여 주면 힘이 펄펄 나!', at: () => elRect($('hAdv')), home: true, mood: 'sword' },
  { title: '트레이 메뉴', text: '작업표시줄 오른쪽 아래의 내 아이콘을 오른쪽 클릭해 봐. 숨기기 · 테마 · 항상 위에 표시 · 설정이 있어', at: trayRect, mood: 'sparkle' },
  { title: '이제 시작!', text: '잘 부탁해 ♥ 다시 보고 싶으면 집 창 제목줄의 톱니바퀴(설정)에서 [튜토리얼 다시 보기]를 눌러 줘', at: petRect, mood: 'heart' },
];

function startTour() {
  if (!state.pets.length) return;   // 알려 줄 말랑이가 있어야 한다
  closeCard();
  tourStep = 0;
  tourBox.hidden = false;
  showStep();
}

function endTour() {
  tourStep = -1;
  tourBox.hidden = tourRing.hidden = tourArrow.hidden = true;
  state.tourDone = true;
  persist();
}

function showStep() {
  const step = TOUR[tourStep];
  if (step.home && home.hidden) toggleHome();
  $('tourTitle').textContent = typeof step.title === 'function' ? step.title() : step.title;
  $('tourText').textContent = step.text;
  $('tourDots').replaceChildren(...TOUR.map((_, i) => {
    const dot = document.createElement('i');
    if (i <= tourStep) dot.className = 'on';
    return dot;
  }));
  $('tourPrev').disabled = tourStep === 0;
  $('tourNext').textContent = tourStep === TOUR.length - 1 ? '시작하기!' : '다음';
  $('tourSkip').hidden = tourStep === TOUR.length - 1;
  tourHop = 0.45;
  tourView.sv -= 3;
  placeTour(step.at());
}

// 상자는 단계가 바뀔 때만 옮긴다 (말랑이가 돌아다녀도 버튼이 도망가지 않게).
// 가리키는 곳 위 → 아래 → 왼쪽 → 오른쪽 중에서 가리키는 곳과 열린 창을 덜 가리는 자리
function placeTour(t) {
  const bw = tourBox.offsetWidth, bh = tourBox.offsetHeight, gap = 34;
  const fit = (x, y) => ({ x: Math.round(clamp(x, 10, W - bw - 10)), y: Math.round(clamp(y, 10, H - bh - 10)) });
  let spot = fit((W - bw) / 2, H * 0.3);
  if (t) {
    const cx = t.x + t.w / 2, cy = t.y + t.h / 2;
    const avoid = [t, ...panels().filter((b) => !b.hidden).map((b) => {
      const r = b.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    })];
    const covered = (p) => avoid.reduce((sum, r) => sum
      + Math.max(0, Math.min(p.x + bw, r.x + r.w) - Math.max(p.x, r.x)) * Math.max(0, Math.min(p.y + bh, r.y + r.h) - Math.max(p.y, r.y)), 0);
    const cands = [
      fit(cx - bw / 2, t.y - bh - gap), fit(cx - bw / 2, t.y + t.h + gap),
      fit(t.x - bw - gap, cy - bh / 2), fit(t.x + t.w + gap, cy - bh / 2),
    ];
    let best = Infinity;
    cands.forEach((p, i) => {
      const score = covered(p) * 1000 + i;   // 덜 가리는 곳, 같으면 위 → 아래 → 왼쪽 → 오른쪽
      if (score < best) { best = score; spot = p; }
    });
  }
  tourBox.style.left = spot.x + 'px';
  tourBox.style.top = spot.y + 'px';
}

// 매 프레임: 상자 속 말랑이 + 가리키는 테두리 · 화살표 (가리키는 곳이 움직이면 따라간다)
function drawTour(t, dt) {
  if (tourStep < 0) return;
  const step = TOUR[tourStep];
  const p = guidePet();
  if (!p) return endTour();

  const c = tourCtx;
  c.clearRect(0, 0, 96, 84);
  const v = tourView;
  v.sv += (-v.s * 260 - v.sv * 9) * dt;
  v.s += v.sv * dt;
  v.blinkT -= dt;
  if (v.blinkT <= 0) { v.blink = 0.15; v.blinkT = rand(2, 4); }
  v.blink = Math.max(0, v.blink - dt);
  tourHop = Math.max(0, tourHop - dt);
  const lift = Math.sin(Math.PI * (1 - tourHop / 0.45)) * (tourHop > 0 ? 14 : 0);
  const st = stageOf(p) === 'egg' ? 'baby' : stageOf(p);
  v.y = 76 - lift;
  drawPet(c, { ...p, sleeping: false, sick: false, clean: 100, poops: [] }, v, st, t, 76, 3);
  // 머리 위에 기분 아이콘이 둥실
  drawSprite(c, step.mood, 72, 22 - (Math.sin(t * 3) > 0 ? 2 : 0), 2);

  const r = step.at();
  tourRing.hidden = !r || !!r.arrowOnly;
  tourArrow.hidden = !r;
  if (!r) return;
  if (!r.arrowOnly) {
    Object.assign(tourRing.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
  }
  // 화살표는 가리키는 곳 위에서 아래를 콕 (위쪽 끝에 붙어 있으면 아래에서 위로)
  const up = r.y < 40;
  tourArrow.style.left = Math.round(r.x + r.w / 2 - 7) + 'px';
  tourArrow.style.top = Math.round(up ? r.y + r.h + 6 : r.y - 24) + 'px';
  arrowIcon.style.transform = up ? 'scaleY(-1)' : '';
}
hooks.frame.push(drawTour);

$('tourNext').addEventListener('click', () => {
  if (tourStep >= TOUR.length - 1) {
    endTour();
    const p = guidePet();
    if (p) { const v = viewOf(p); v.vy = -420; setEmote(v, 'heart', 1.2); }
    return toast(`${josa(guideName(), '과', '와')} 즐거운 하루 보내요!`);
  }
  tourStep++;
  showStep();
});
$('tourPrev').addEventListener('click', () => {
  if (tourStep <= 0) return;
  tourStep--;
  showStep();
});
$('tourSkip').addEventListener('click', () => {
  endTour();
  toast('튜토리얼은 설정(집 창 톱니바퀴)에서 다시 볼 수 있어요');
});
// 다른 칸에 글을 쓰는 중이 아니면 → / Enter 다음, ← 이전, Esc 건너뛰기
document.addEventListener('keydown', (e) => {
  if (tourStep < 0 || e.target.closest('input, textarea')) return;
  if (e.key === 'ArrowRight' || e.key === 'Enter') $('tourNext').click();
  else if (e.key === 'ArrowLeft') $('tourPrev').click();
  else if (e.key === 'Escape') $('tourSkip').click();
});

// 1.8.6 전부터 키우던 사람도 한 번은 본다 (입양 창이 떠 있는 첫 실행이면 입양한 뒤에 시작)
if (!state.tourDone && state.pets.length) setTimeout(startTour, 2500);
