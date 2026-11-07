// 퀘스트 진행 규칙. 미션은 차례대로 열리고, 각 미션은 맡기는 NPC 와 이야기해야 시작됩니다.
// 대사는 story.js 에 있습니다.
import { PLACES, WEEDY_PADDIES, ELDERS } from './world.js';
import { CHIEF_NAME, NPCS, STORY, STEP_GUIDE, greetLines, missionLines, chiefHintLines } from './story.js';

// ── 아이템 ───────────────────────────────────────────
export const ITEMS = {
  hanja_sip_a: { name: '十 조각', icon: '十' },
  hanja_sip_b: { name: '十 조각', icon: '十' },
  hanja_il_a: { name: '一 조각', icon: '一' },
  hanja_il_b: { name: '一 조각', icon: '一' },
  snail_basket: { name: '우렁이 바구니', icon: '🐌' },
  straw_hat: { name: '밀짚모자', icon: '👒' },
  old_shirt: { name: '낡은 셔츠', icon: '👕' },
  tteok_white: { name: '하얀 가래떡', icon: '⚪' },
  tteok_ssuk: { name: '쑥 가래떡', icon: '🟢' },
  tteok_pumpkin: { name: '단호박 가래떡', icon: '🟡' },
  sensor: { name: '온·습도 센서', icon: '📟' },
};

// 바닥에 놓여 있는 줍기 아이템 (자기 미션이 시작돼야 나타남)
export const PICKUPS = [
  { id: 'hanja_sip_a', quest: 'soil', pos: [10, 0, -5] },
  { id: 'hanja_sip_b', quest: 'soil', pos: [-9, 0, 7] },
  { id: 'hanja_il_a', quest: 'soil', pos: [-5, 0, -11] },
  { id: 'hanja_il_b', quest: 'soil', pos: [13, 0, 11] },
  { id: 'straw_hat', quest: 'scarecrow', pos: [22.5, 1.05, 2.2] },
  { id: 'old_shirt', quest: 'scarecrow', pos: [-25, 1.6, 22] },
  { id: 'tteok_white', quest: 'tteok', pos: [-23.6, 1.05, 2.5] },
  { id: 'tteok_ssuk', quest: 'tteok', pos: [-23, 1.05, 2.5] },
  { id: 'tteok_pumpkin', quest: 'tteok', pos: [-22.4, 1.05, 2.5] },
  { id: 'sensor', quest: 'smartfarm', pos: [28, 1.25, -34.8] },
];

export const MAIN_QUESTS = ['soil', 'snail', 'scarecrow', 'tteok', 'smartfarm'];
export const QUEST_ORDER = [...MAIN_QUESTS, 'final'];

// 각 미션을 맡기는 NPC (흙의 비밀은 튜토리얼에서 촌장님이 맡김)
export const QUEST_GIVER = { soil: 'chief', snail: 'farmer', scarecrow: 'farmer', tteok: 'miller', smartfarm: 'youngFarmer', final: 'chief' };

// 미션을 맡을 때 NPC 에게 받는 물건
export const QUEST_START_ITEMS = { snail: ['snail_basket'] };

// ── 진행 상태 ─────────────────────────────────────────
const has = (p, id) => p.inventory.includes(id);
const flag = (p, id) => !!p.flags[id];
const count = (p, ids) => ids.filter((id) => flag(p, id) || has(p, id)).length;
const HANJA = ['hanja_sip_a', 'hanja_sip_b', 'hanja_il_a', 'hanja_il_b'];
const TTEOK = ['tteok_white', 'tteok_ssuk', 'tteok_pumpkin'];

// 지금 해야 할 미션 (차례대로 첫 번째 미완료)
export const currentQuest = (p) => QUEST_ORDER.find((q) => !p.completed.includes(q)) ?? null;

// 미션을 맡았는지 (NPC 와 시작 대화를 했는지)
export function questStarted(p, q) {
  if (p.completed.includes(q)) return true;
  if (q === 'soil') return ['pickup', 'mission', 'done'].includes(p.tutorial ?? 'done') || flag(p, 'start_soil');
  if (q === 'snail') return flag(p, 'start_snail') || flag(p, 'got_basket'); // got_basket: 예전 저장 데이터
  return flag(p, `start_${q}`);
}

// 지금 진행 중인 미션인지 (차례가 왔고, 맡았고, 아직 안 끝남)
export const questActive = (p, q) => currentQuest(p) === q && questStarted(p, q);

// 머리 위에 ❗ 를 띄울 NPC: 다음 미션을 맡길 사람
export function npcWithNews(p) {
  const q = currentQuest(p);
  if (!q || questStarted(p, q) || (p.tutorial ?? 'done') !== 'done') return null;
  return QUEST_GIVER[q];
}

export const ribbonsOf = (p) => MAIN_QUESTS.filter((q) => p.completed.includes(q)).length;

// ── 퀘스트 목록 (HUD 표시용) ─────────────────────────
const giverStep = (p, q) => ({ text: `${NPCS[QUEST_GIVER[q]].name}의 이야기 듣기`, done: questStarted(p, q) });

export const QUESTS = [
  {
    id: 'soil',
    title: "'흙(土)'의 비밀",
    place: '광장',
    steps: (p) => [
      { text: `광장에 흩어진 한자 조각 줍기 (${count(p, HANJA)}/4)`, done: count(p, HANJA) === 4 },
      { text: '분수대 앞 부서진 비석에 끼워 맞추기', done: p.completed.includes('soil') },
    ],
  },
  {
    id: 'snail',
    title: '우렁이 특공대 출동',
    place: '들판',
    steps: (p) => [
      giverStep(p, 'snail'),
      { text: `잡초가 무성한 논에 우렁이 풀어주기 (${WEEDY_PADDIES.filter((w) => flag(p, w.id)).length}/3)`, done: p.completed.includes('snail') },
    ],
  },
  {
    id: 'scarecrow',
    title: '허수아비 옷 입히기',
    place: '들판',
    steps: (p) => [
      giverStep(p, 'scarecrow'),
      { text: '장터에서 밀짚모자 찾기', done: count(p, ['straw_hat']) === 1 },
      { text: '빨랫줄에서 낡은 셔츠 찾기', done: count(p, ['old_shirt']) === 1 },
      { text: '들판의 허수아비에게 입혀 참새 쫓기', done: p.completed.includes('scarecrow') },
    ],
  },
  {
    id: 'tteok',
    title: '따끈따끈 삼색 가래떡',
    place: '방앗간 → 장터',
    steps: (p) => [
      giverStep(p, 'tteok'),
      { text: `방앗간에서 가래떡 3개 줍기 (${count(p, TTEOK)}/3)`, done: count(p, TTEOK) === 3 },
      { text: `장터 평상의 어르신께 배달하기 (${ELDERS.filter((e) => flag(p, e.id)).length}/3)`, done: p.completed.includes('tteok') },
    ],
  },
  {
    id: 'smartfarm',
    title: '스마트팜 고치기',
    place: '온실 → 창고 → 온실',
    steps: (p) => [
      giverStep(p, 'smartfarm'),
      { text: '창고에서 온·습도 센서 찾기', done: count(p, ['sensor']) === 1 },
      { text: '온실 안 고장 난 콘솔에 센서 장착하기', done: p.completed.includes('smartfarm') },
    ],
  },
  {
    id: 'final',
    title: '[최종] 황금 들판 감사 트리',
    place: '광장',
    steps: (p) => [
      { text: `감사 리본 모으기 (${ribbonsOf(p)}/5)`, done: ribbonsOf(p) === 5 },
      { text: '촌장님께 리본 보여 드리기', done: questStarted(p, 'final') },
      { text: '광장의 당산나무에 리본 매달기', done: p.completed.includes('final') },
    ],
  },
];

// ── 상호작용 대상 ────────────────────────────────────
// quest: 이 대상이 속한 미션 (그 미션이 진행 중일 때만 [E] 가 뜨고 화살표가 가리킴)
// active(p): 상호작용 가능 여부 / guide(p): 길안내 화살표 대상 여부
// interact(ctx): ctx = { p, nickname, pick, take, setFlag, complete, say, hint, sfx, toast, startQuest, setTutorial, finishTutorial }

// 미션 대상: 자기 미션이 진행 중일 때만 활성
const questTarget = (q, it) => ({
  ...it,
  quest: q,
  active: (p) => questActive(p, q) && it.active(p),
  guide: (p) => questActive(p, q) && it.guide(p),
});

const pickupInteractables = PICKUPS.map((it) =>
  questTarget(it.quest, {
    id: it.id,
    pos: it.pos,
    radius: 2.0,
    active: (p) => !flag(p, it.id),
    guide: (p) => !flag(p, it.id),
    label: () => `줍기 · ${ITEMS[it.id].name}`,
    interact: (ctx) => {
      ctx.pick(it.id);
      ctx.setFlag(it.id);
    },
  }),
);

// 미션을 맡기는 NPC 공통 대화: 차례 전 / 미션 시작 / 진행 중 / 끝난 뒤
function questGiverTalk(ctx, npc, quests) {
  const p = ctx.p;
  const name = NPCS[npc].name;
  const cur = currentQuest(p);
  const mine = quests.find((q) => q === cur);
  if (mine && !questStarted(p, mine)) {
    const s = STORY[mine];
    ctx.say(name, s.start, 'talk', () => ctx.startQuest(mine));
    return true;
  }
  if (mine) return false; // 진행 중: 호출한 쪽에서 안내
  const allDone = quests.every((q) => p.completed.includes(q));
  if (!allDone) ctx.say(name, STORY[quests[0]].before ?? ['나중에 다시 와 주렴!']);
  return !allDone ? true : null; // null: 다 끝남 → 호출한 쪽에서 감사 대사
}

export const INTERACTABLES = [
  ...pickupInteractables,

  // 1. 흙(土)의 비밀
  questTarget('soil', {
    id: 'tablet',
    pos: PLACES.tablet,
    radius: 2.6,
    active: () => true,
    guide: (p) => count(p, HANJA) === 4,
    label: () => '조각 끼워 맞추기 · 부서진 비석',
    interact: (ctx) => {
      const have = HANJA.filter((id) => has(ctx.p, id)).length;
      if (have < 4) return ctx.hint('부서진 비석', STORY.soil.remindTablet(have));
      ctx.take(HANJA);
      ctx.complete('soil');
      ctx.say('비석의 비밀', STORY.soil.done);
    },
  }),

  // 2·3. 농부 아저씨: 우렁이 → 허수아비
  {
    id: 'farmer',
    pos: PLACES.farmer,
    radius: 2.8,
    active: () => true,
    guide: () => false,
    label: () => '대화하기 · 농부 아저씨',
    interact: (ctx) => {
      const r = questGiverTalk(ctx, 'farmer', ['snail', 'scarecrow']);
      if (r === true) return;
      if (r === null) return ctx.say('농부 아저씨', STORY.scarecrow.farmerAfter);
      const p = ctx.p;
      if (currentQuest(p) === 'snail') return ctx.say('농부 아저씨', STORY.snail.remind(3 - WEEDY_PADDIES.filter((w) => flag(p, w.id)).length));
      const need = ['straw_hat', 'old_shirt'].filter((id) => !has(p, id) && !flag(p, id)).map((id) => ITEMS[id].name);
      ctx.say('농부 아저씨', need.length ? STORY.scarecrow.remind(need.join('와 ')) : ['다 찾았구나! 어서 허수아비에게 입혀 주렴.']);
    },
  },
  ...WEEDY_PADDIES.map((w) =>
    questTarget('snail', {
      id: w.id,
      pos: [w.x, 0, w.z - 7.5],
      radius: 3.2,
      active: (p) => !flag(p, w.id),
      guide: (p) => !flag(p, w.id),
      label: () => '우렁이 풀어주기 · 잡초 논',
      interact: (ctx) => {
        ctx.setFlag(w.id);
        ctx.sfx('splash');
        const done = WEEDY_PADDIES.filter((x) => x.id === w.id || flag(ctx.p, x.id)).length;
        if (done < 3) return ctx.toast(`🐌 우렁이 출동! (${done}/3)`);
        ctx.take(['snail_basket']);
        ctx.complete('snail');
        ctx.say('우렁이 특공대', STORY.snail.done);
      },
    }),
  ),
  questTarget('scarecrow', {
    id: 'scarecrow',
    pos: PLACES.scarecrow,
    radius: 2.8,
    active: () => true,
    guide: (p) => has(p, 'straw_hat') && has(p, 'old_shirt'),
    label: () => '옷 입히기 · 허수아비',
    interact: (ctx) => {
      const need = ['straw_hat', 'old_shirt'].filter((id) => !has(ctx.p, id));
      if (need.length) return ctx.hint('허수아비 뼈대', STORY.scarecrow.remindScarecrow(need.map((id) => ITEMS[id].name).join('와 ')));
      ctx.take(['straw_hat', 'old_shirt']);
      ctx.complete('scarecrow');
      ctx.say('허수아비', STORY.scarecrow.done);
    },
  }),

  // 4. 방앗간 주인 → 어르신 배달
  {
    id: 'miller',
    pos: PLACES.miller,
    radius: 2.6,
    active: () => true,
    guide: () => false,
    label: () => '대화하기 · 방앗간 주인',
    interact: (ctx) => {
      const r = questGiverTalk(ctx, 'miller', ['tteok']);
      if (r === true) return;
      ctx.say('방앗간 주인', r === null ? STORY.tteok.millerAfter : STORY.tteok.remind);
    },
  },
  ...ELDERS.map((e) =>
    questTarget('tteok', {
      id: e.id,
      pos: [e.pos[0], 0, e.pos[2] + 1.2],
      radius: 1.7,
      active: (p) => !flag(p, e.id),
      guide: (p) => has(p, e.want),
      label: () => `배달하기 · ${e.name}`,
      interact: (ctx) => {
        if (!has(ctx.p, e.want)) return ctx.hint(e.name, STORY.tteok.elderWrong(ITEMS[e.want].name));
        ctx.take([e.want]);
        ctx.setFlag(e.id);
        ctx.sfx('deliver');
        const done = ELDERS.filter((x) => x.id === e.id || flag(ctx.p, x.id)).length;
        if (done < 3) return ctx.say(e.name, STORY.tteok.elderThanks(done));
        ctx.complete('tteok');
        ctx.say(e.name, STORY.tteok.done);
      },
    }),
  ),

  // 5. 청년 농부 → 창고 센서 → 온실 콘솔
  {
    id: 'youngFarmer',
    pos: [PLACES.youngFarmer[0], 0, PLACES.youngFarmer[2] + 0.8],
    radius: 2.4,
    active: () => true,
    guide: () => false,
    label: () => '대화하기 · 청년 농부',
    interact: (ctx) => {
      const r = questGiverTalk(ctx, 'youngFarmer', ['smartfarm']);
      if (r === true) return;
      ctx.say('청년 농부', r === null ? STORY.smartfarm.after : STORY.smartfarm.remind);
    },
  },
  questTarget('smartfarm', {
    id: 'console',
    pos: [PLACES.console[0], 0, PLACES.console[2] + 1.6],
    radius: 2.4,
    active: () => true,
    guide: (p) => has(p, 'sensor'),
    label: () => '센서 장착하기 · 스마트팜 콘솔',
    interact: (ctx) => {
      if (!has(ctx.p, 'sensor')) return ctx.hint('스마트팜 콘솔', STORY.smartfarm.remindConsole);
      ctx.take(['sensor']);
      ctx.complete('smartfarm');
      ctx.say('스마트팜 콘솔', STORY.smartfarm.done);
    },
  }),

  // 6. 촌장님 → 당산나무
  questTarget('final', {
    id: 'dangsan',
    pos: [PLACES.dangsan[0] + 2.2, 0, PLACES.dangsan[2] + 2.2],
    radius: 3.2,
    active: () => true,
    guide: () => true,
    label: () => '감사 리본 매달기 · 당산나무',
    interact: (ctx) => {
      ctx.complete('final');
      ctx.say('황금 들판 감사 트리', STORY.final.done);
    },
  }),

  // 촌장님: 튜토리얼 → 최종 미션 시작 → 그 밖에는 지금 할 일을 알려 줌
  {
    id: 'chief',
    pos: [PLACES.chief[0], 0, PLACES.chief[2] + 0.8],
    radius: 2.4,
    active: () => true,
    guide: () => false,
    label: () => `대화하기 · ${CHIEF_NAME}`,
    interact: (ctx) => {
      const p = ctx.p;
      const step = p.tutorial ?? 'done';
      if (step === 'greet') return ctx.say(CHIEF_NAME, greetLines(ctx.nickname), 'talk', () => ctx.setTutorial('move'));
      if (step === 'mission') return ctx.say(CHIEF_NAME, missionLines, 'talk', () => ctx.finishTutorial());
      if (STEP_GUIDE[step]) return ctx.say(CHIEF_NAME, [STEP_GUIDE[step].chief]);
      const cur = currentQuest(p);
      if (cur === 'final' && !questStarted(p, 'final')) return ctx.say(CHIEF_NAME, STORY.final.start, 'talk', () => ctx.startQuest('final'));
      if (cur === 'final') return ctx.say(CHIEF_NAME, STORY.final.remind);
      ctx.say(CHIEF_NAME, chiefHintLines({ current: cur, started: cur && questStarted(p, cur), giver: cur && QUEST_GIVER[cur], ribbons: ribbonsOf(p) }));
    },
  },

  // 안내 NPC
  {
    id: 'sparrowGuide',
    pos: [PLACES.sparrowGuide[0], 0, PLACES.sparrowGuide[2] + 1],
    radius: 2.2,
    active: () => true,
    guide: () => false,
    label: () => '대화하기 · 말하는 참새 짹짹이',
    interact: (ctx) =>
      ctx.say('말하는 참새 짹짹이', [
        '짹! 가래떡 마을 농업인의 날 축제에 온 걸 환영해!',
        '마을 사람들을 차례차례 도와 감사 리본 5개를 모아 줘. 발밑의 노란 화살표가 길을 알려 줄 거야!',
        '머리 위에 ❗ 가 떠 있는 사람에게 말을 걸면 새로운 미션을 받을 수 있어. 미션을 깰 때마다 우리 학교 점수가 올라간다구!',
      ]),
  },
  {
    id: 'frog',
    pos: PLACES.frog,
    radius: 2.2,
    active: () => true,
    guide: () => false,
    label: () => '대화하기 · 개구리 개굴이',
    interact: (ctx) =>
      ctx.say('개구리 개굴이', [
        '개굴! 논은 쌀만 키우는 게 아니야.',
        '비가 많이 오면 물을 가둬 홍수를 막고, 나 같은 개구리와 여러 생물의 집이 되어 준다구!',
        '쌀 한 톨이 밥상에 오르기까지 농부님 손길이 여든여덟 번 간대. 그래서 쌀 미(米) 자에 八十八이 숨어 있지! 개굴~',
      ]),
  },
];

// 길안내 화살표가 가리킬 대상: 미션을 아직 안 맡았으면 맡길 NPC, 맡았으면 그 미션의 다음 목표
export function isGuideTarget(it, p) {
  const q = currentQuest(p);
  if (!q) return false;
  if (!questStarted(p, q)) return it.id === QUEST_GIVER[q];
  return it.quest === q && it.guide(p);
}
