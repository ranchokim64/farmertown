import { PLACES, WEEDY_PADDIES, ELDERS } from './world.js';

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

// 바닥에 놓여 있는 줍기 아이템
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

// ── 퀘스트 목록 (HUD 표시용) ─────────────────────────
const has = (p, id) => p.inventory.includes(id);
const flag = (p, id) => !!p.flags[id];
const count = (p, ids) => ids.filter((id) => flag(p, id) || has(p, id)).length;

export const QUESTS = [
  {
    id: 'soil',
    title: "'흙(土)'의 비밀",
    place: '광장',
    steps: (p) => [
      { text: `광장에 흩어진 한자 조각 줍기 (${count(p, ['hanja_sip_a', 'hanja_sip_b', 'hanja_il_a', 'hanja_il_b'])}/4)`, done: count(p, ['hanja_sip_a', 'hanja_sip_b', 'hanja_il_a', 'hanja_il_b']) === 4 },
      { text: '분수대 앞 부서진 비석에 끼워 맞추기', done: p.completed.includes('soil') },
    ],
  },
  {
    id: 'snail',
    title: '우렁이 특공대 출동',
    place: '들판',
    steps: (p) => [
      { text: '들판의 농부 아저씨에게 우렁이 바구니 받기', done: flag(p, 'got_basket') },
      { text: `잡초가 무성한 논에 우렁이 풀어주기 (${WEEDY_PADDIES.filter((w) => flag(p, w.id)).length}/3)`, done: p.completed.includes('snail') },
    ],
  },
  {
    id: 'scarecrow',
    title: '허수아비 옷 입히기',
    place: '들판',
    steps: (p) => [
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
      { text: `방앗간에서 가래떡 3개 줍기 (${count(p, ['tteok_white', 'tteok_ssuk', 'tteok_pumpkin'])}/3)`, done: count(p, ['tteok_white', 'tteok_ssuk', 'tteok_pumpkin']) === 3 },
      { text: `장터 평상의 어르신께 배달하기 (${ELDERS.filter((e) => flag(p, e.id)).length}/3)`, done: p.completed.includes('tteok') },
    ],
  },
  {
    id: 'smartfarm',
    title: '스마트팜 고치기',
    place: '창고 → 온실',
    steps: (p) => [
      { text: '창고에서 온·습도 센서 찾기', done: count(p, ['sensor']) === 1 },
      { text: '온실 안 고장 난 콘솔에 센서 장착하기', done: p.completed.includes('smartfarm') },
    ],
  },
  {
    id: 'final',
    title: '[최종] 황금 들판 감사 트리',
    place: '광장',
    steps: (p) => [
      { text: `감사 리본 모으기 (${MAIN_QUESTS.filter((q) => p.completed.includes(q)).length}/5)`, done: MAIN_QUESTS.every((q) => p.completed.includes(q)) },
      { text: '광장의 당산나무에 리본 매달기', done: p.completed.includes('final') },
    ],
  },
];

// ── 상호작용 대상 ────────────────────────────────────
// active(p): 현재 상호작용 가능 여부 / guide(p): 길안내 화살표 대상 여부
// interact(ctx): ctx = { p, pick, take, setFlag, complete, say, hint, sfx, toast }
//   hint = 아직 조건이 안 됐을 때의 안내 대사 (say 와 같지만 다른 효과음)

const pickupInteractables = PICKUPS.map((it) => ({
  id: it.id,
  pos: it.pos,
  radius: 2.0,
  active: (p) => !flag(p, it.id),
  guide: (p) => !flag(p, it.id) && !p.completed.includes(it.quest),
  label: () => `줍기 · ${ITEMS[it.id].name}`,
  interact: (ctx) => {
    ctx.pick(it.id);
    ctx.setFlag(it.id);
  },
}));

export const INTERACTABLES = [
  ...pickupInteractables,

  // 1. 흙(土)의 비밀
  {
    id: 'tablet',
    pos: PLACES.tablet,
    radius: 2.6,
    active: (p) => !p.completed.includes('soil'),
    guide: (p) => count(p, ['hanja_sip_a', 'hanja_sip_b', 'hanja_il_a', 'hanja_il_b']) === 4 && !p.completed.includes('soil'),
    label: () => '조각 끼워 맞추기 · 부서진 비석',
    interact: (ctx) => {
      const pieces = ['hanja_sip_a', 'hanja_sip_b', 'hanja_il_a', 'hanja_il_b'];
      const have = pieces.filter((id) => has(ctx.p, id));
      if (have.length < 4) {
        ctx.hint('부서진 비석', [
          `비석에 홈이 4개 파여 있어요. 지금 조각은 ${have.length}개!`,
          '광장 곳곳에 반짝이는 十 조각 2개와 一 조각 2개를 찾아보세요.',
        ]);
        return;
      }
      ctx.take(pieces);
      ctx.complete('soil');
      ctx.say('비석의 비밀', [
        '딸깍! 十 과 一 이 합쳐지자… 흙 토(土) 글자가 두 개 나타났어요!',
        "土 를 풀어 쓰면 十(열 십) + 一(한 일) = '十一', 즉 11 이에요.",
        "土 가 두 번 → 土月 土日 → 十一月 十一日 = '11월 11일'!",
        '농업인은 흙에서 나서 흙과 더불어 살다 흙으로 돌아간다는 뜻을 담아, 11월 11일을 농업인의 날로 정했답니다.',
        "🎀 감사 리본을 받았어요! (+10점)",
      ]);
    },
  },

  // 2. 우렁이 특공대
  {
    id: 'farmer',
    pos: PLACES.farmer,
    radius: 2.8,
    active: () => true,
    guide: (p) => !flag(p, 'got_basket'),
    label: () => '대화하기 · 농부 아저씨',
    interact: (ctx) => {
      const p = ctx.p;
      if (p.completed.includes('snail')) {
        ctx.say('농부 아저씨', ['우렁이들이 잡초를 냠냠 먹어 치우고 있어! 정말 고마워.', '농약을 덜 쓰니 땅도, 물도, 벼도 모두 건강해진단다.']);
      } else if (!flag(p, 'got_basket')) {
        ctx.pick('snail_basket');
        ctx.setFlag('got_basket');
        ctx.say('농부 아저씨', [
          '어이쿠, 잘 왔다! 논에 잡초가 너무 많이 자라서 큰일이야.',
          '이 바구니에 든 우렁이들은 물속 잡초를 아주 좋아해. 그래서 농약 대신 우렁이가 잡초를 없애 주지!',
          '이걸 친환경 "우렁이 농법"이라고 한단다.',
          '빨간 표시가 있는 논 3곳에 우렁이를 풀어 주겠니? 🐌',
        ]);
      } else {
        ctx.say('농부 아저씨', [`빨간 표시가 있는 논이 아직 ${3 - WEEDY_PADDIES.filter((w) => flag(p, w.id)).length}곳 남았어. 부탁한다!`]);
      }
    },
  },
  ...WEEDY_PADDIES.map((w) => ({
    id: w.id,
    pos: [w.x, 0, w.z - 7.5],
    radius: 3.2,
    active: (p) => !flag(p, w.id),
    guide: (p) => flag(p, 'got_basket') && !flag(p, w.id),
    label: (p) => (has(p, 'snail_basket') ? '우렁이 풀어주기 · 잡초 논' : '살펴보기 · 잡초 논'),
    interact: (ctx) => {
      if (!has(ctx.p, 'snail_basket')) {
        ctx.hint('잡초가 무성한 논', ['잡초가 벼보다 더 많아 보여요…', '들판 입구의 농부 아저씨께 이야기를 들어 보세요.']);
        return;
      }
      ctx.setFlag(w.id);
      ctx.sfx('splash');
      const done = WEEDY_PADDIES.filter((x) => x.id === w.id || flag(ctx.p, x.id)).length;
      if (done === 3) {
        ctx.take(['snail_basket']);
        ctx.complete('snail');
        ctx.say('우렁이 특공대', ['우렁이 특공대 출동 완료! 잡초가 쏙쏙 사라지고 있어요.', '🎀 감사 리본을 받았어요! (+10점)']);
      } else {
        ctx.toast(`🐌 우렁이 출동! (${done}/3)`);
      }
    },
  })),

  // 3. 허수아비
  {
    id: 'scarecrow',
    pos: PLACES.scarecrow,
    radius: 2.8,
    active: (p) => !p.completed.includes('scarecrow'),
    guide: (p) => has(p, 'straw_hat') && has(p, 'old_shirt'),
    label: () => '옷 입히기 · 허수아비',
    interact: (ctx) => {
      const need = ['straw_hat', 'old_shirt'].filter((id) => !has(ctx.p, id));
      if (need.length) {
        ctx.hint('허수아비 뼈대', [
          '짹짹! 참새들이 벼 이삭을 쪼아 먹고 있어요.',
          `허수아비에게 ${need.map((id) => ITEMS[id].name).join('와 ')}이(가) 필요해요.`,
          '밀짚모자는 장터에, 낡은 셔츠는 마을 빨랫줄에 있대요.',
        ]);
        return;
      }
      ctx.take(['straw_hat', 'old_shirt']);
      ctx.complete('scarecrow');
      ctx.say('허수아비', [
        '짠! 멋쟁이 허수아비 완성! 참새들이 깜짝 놀라 날아가요. 푸드득~',
        '허수아비는 옛날부터 새들로부터 소중한 곡식을 지켜 준 들판의 지킴이랍니다.',
        '🎀 감사 리본을 받았어요! (+10점)',
      ]);
    },
  },

  // 4. 삼색 가래떡
  {
    id: 'miller',
    pos: PLACES.miller,
    radius: 2.6,
    active: () => true,
    guide: () => false,
    label: () => '대화하기 · 방앗간 주인',
    interact: (ctx) =>
      ctx.say('방앗간 주인', [
        '어서 와! 갓 뽑은 가래떡이 김이 모락모락 나지?',
        '11월 11일은 "가래떡 데이"이기도 해. 길쭉한 가래떡이 숫자 1을 닮았거든!',
        '우리 쌀로 만든 하얀 떡, 쑥 떡, 단호박 떡을 장터 평상의 어르신들께 배달해 주렴.',
      ]),
  },
  ...ELDERS.map((e) => ({
    id: e.id,
    pos: [e.pos[0], 0, e.pos[2] + 1.2],
    radius: 1.7,
    active: (p) => !flag(p, e.id),
    guide: (p) => has(p, e.want),
    label: () => `배달하기 · ${e.name}`,
    interact: (ctx) => {
      if (!has(ctx.p, e.want)) {
        ctx.hint(e.name, [`아이고, 배가 출출하구나. 나는 ${ITEMS[e.want].name}이 먹고 싶은데…`, '방앗간에 가면 있을 거란다.']);
        return;
      }
      ctx.take([e.want]);
      ctx.setFlag(e.id);
      ctx.sfx('deliver');
      const done = ELDERS.filter((x) => x.id === e.id || flag(ctx.p, x.id)).length;
      if (done === 3) {
        ctx.complete('tteok');
        ctx.say(e.name, ['고맙다, 얘야! 우리 쌀로 만든 떡이 최고야.', '삼색 가래떡 배달 완료! 🎀 감사 리본을 받았어요! (+10점)']);
      } else {
        ctx.say(e.name, ['오호, 쫄깃쫄깃 맛있구나! 고맙다 얘야.', `(배달 ${done}/3)`]);
      }
    },
  })),

  // 5. 스마트팜
  {
    id: 'console',
    pos: [PLACES.console[0], 0, PLACES.console[2] + 1.6],
    radius: 2.4,
    active: (p) => !p.completed.includes('smartfarm'),
    guide: (p) => has(p, 'sensor'),
    label: () => '센서 장착하기 · 스마트팜 콘솔',
    interact: (ctx) => {
      if (!has(ctx.p, 'sensor')) {
        ctx.hint('스마트팜 콘솔', ['삐빅! [오류] 온·습도 센서를 찾을 수 없습니다.', '창고에 예비 센서가 있을지도 몰라요.']);
        return;
      }
      ctx.take(['sensor']);
      ctx.complete('smartfarm');
      ctx.say('스마트팜 콘솔', [
        '삐빅! 센서 연결 완료. 온도 22℃ · 습도 65% · 토양 수분 부족 → 스프링클러 가동!',
        '스마트팜은 센서와 컴퓨터로 작물이 자라기 좋은 환경을 자동으로 맞춰 주는 똑똑한 농장이에요.',
        '🎀 감사 리본을 받았어요! (+10점)',
      ]);
    },
  },

  // 6. 최종: 당산나무
  {
    id: 'dangsan',
    pos: [PLACES.dangsan[0] + 2.2, 0, PLACES.dangsan[2] + 2.2],
    radius: 3.2,
    active: (p) => !p.completed.includes('final'),
    guide: (p) => MAIN_QUESTS.every((q) => p.completed.includes(q)),
    label: () => '감사 리본 매달기 · 당산나무',
    interact: (ctx) => {
      const n = MAIN_QUESTS.filter((q) => ctx.p.completed.includes(q)).length;
      if (n < 5) {
        ctx.hint('마을 당산나무', [
          '수백 년 동안 마을을 지켜 온 당산나무예요.',
          `감사 리본 5개를 모두 모아 오면 황금 들판 감사 트리를 완성할 수 있어요. (지금 ${n}/5)`,
        ]);
        return;
      }
      ctx.complete('final');
      ctx.say('황금 들판 감사 트리', [
        '리본 5개를 매달자 당산나무가 황금빛으로 반짝여요! 🎆',
        '우리가 매일 먹는 밥 한 그릇에는 농업인의 땀과 정성이 담겨 있어요.',
        '농업인 여러분, 고맙습니다! 🌾',
      ]);
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
        '마을 곳곳의 친구들을 도와 감사 리본 5개를 모아 줘. 머리 위의 노란 화살표가 길을 알려 줄 거야!',
        '[E] 키로 줍고, 말하고, 끼워 맞출 수 있어. 퀘스트를 깰 때마다 우리 학교 점수가 올라간다구!',
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
