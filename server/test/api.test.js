import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import RedisMock from 'ioredis-mock';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';

let server;
let base;
const testConfig = {
  ...config,
  staticDir: '',
  rateLimit: { ...config.rateLimit, questCooldownMs: 50, minMsPerQuest: 0, sessionPerMinute: 1000 },
};

before(async () => {
  const app = createApp({ redis: new RedisMock(), config: testConfig });
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());

const post = (path, body) =>
  fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('세션 생성 → 퀘스트 완료 → 학교 점수/스피드런 반영', async () => {
  const sessionId = randomUUID();
  let res = await post('/session', { sessionId, nickname: '꼬마농부', school: { code: 'demo:haetsal', name: '햇살초등학교' } });
  assert.equal(res.status, 201);

  // 세션 복구: 같은 UUID 로 다시 요청하면 기존 정보 유지
  res = await post('/session', { sessionId, nickname: '다른이름', school: { name: '다른학교' } });
  assert.equal((await res.json()).nickname, '꼬마농부');

  // 최종 퀘스트는 5개 완료 전 불가
  res = await post(`/session/${sessionId}/complete`, { questId: 'final' });
  assert.equal(res.status, 409);

  for (const q of ['soil', 'snail', 'scarecrow', 'tteok', 'smartfarm']) {
    res = await post(`/session/${sessionId}/complete`, { questId: q });
    assert.equal(res.status, 200, q);
    await sleep(60);
  }
  // 중복 완료는 점수 0
  res = await post(`/session/${sessionId}/complete`, { questId: 'soil' });
  assert.equal((await res.json()).added, 0);

  await sleep(60);
  res = await post(`/session/${sessionId}/complete`, { questId: 'final' });
  const body = await res.json();
  assert.equal(body.score, 100);
  assert.equal(body.speedRank, 1);
  assert.ok(body.clearTimeMs >= 0);

  const lb = await (await fetch(`${base}/leaderboard?school=demo:haetsal`)).json();
  assert.equal(lb.schools[0].name, '햇살초등학교');
  assert.equal(lb.schools[0].score, 100);
  assert.equal(lb.speedrun[0].nickname, '꼬마농부');
  assert.equal(lb.mySchool.rank, 1);
});

test('퀘스트 완료 쿨타임 (연타 방지)', async () => {
  const sessionId = randomUUID();
  await post('/session', { sessionId, nickname: '연타왕', school: { name: '우리초등학교' } });
  assert.equal((await post(`/session/${sessionId}/complete`, { questId: 'soil' })).status, 200);
  assert.equal((await post(`/session/${sessionId}/complete`, { questId: 'snail' })).status, 429);
});

test('비속어 닉네임/잘못된 세션 거부', async () => {
  let res = await post('/session', { sessionId: randomUUID(), nickname: '씨 발', school: { name: '우리초등학교' } });
  assert.equal(res.status, 400);
  res = await post('/session', { sessionId: 'not-a-uuid', nickname: '농부', school: { name: '우리초등학교' } });
  assert.equal(res.status, 400);
});
