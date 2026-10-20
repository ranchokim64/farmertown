// API 통합 테스트: 인메모리(Redis Mock) 저장소와, TEST_DATABASE_URL 이 있으면 Postgres 저장소에서도 실행
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import RedisMock from 'ioredis-mock';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { redisStore } from '../src/stores/redisStore.js';

const testConfig = {
  ...config,
  staticDir: '',
  rateLimit: { ...config.rateLimit, questCooldownMs: 50, minMsPerQuest: 0, sessionPerMinute: 1000 },
};

const stores = [['memory', async () => redisStore(new RedisMock(), { kind: 'memory' })]];
if (process.env.TEST_DATABASE_URL) {
  stores.push([
    'postgres',
    async () => {
      const { createPostgresStore } = await import('../src/stores/postgresStore.js');
      const store = createPostgresStore(process.env.TEST_DATABASE_URL);
      await store.cacheGet('warmup');
      return store;
    },
  ]);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const [name, makeStore] of stores) {
  describe(`API (${name} 저장소)`, () => {
    let server;
    let base;
    let store;
    const post = (path, body) =>
      fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

    before(async () => {
      store = await makeStore();
      const app = createApp({ store, config: testConfig });
      await new Promise((r) => {
        server = app.listen(0, r);
      });
      base = `http://127.0.0.1:${server.address().port}/api`;
    });
    after(async () => {
      server.close();
      await store.close();
    });

    // 테스트마다 다른 학교를 써서 저장소가 공유돼도 서로 영향 없게
    const school = `테스트${name}${Date.now() % 100000}초`;

    test('세션 생성 → 퀘스트 완료 → 학교 점수/스피드런 반영', async () => {
      const health = await (await fetch(`${base}/health`)).json();
      assert.equal(health.store, name);

      const sessionId = randomUUID();
      let res = await post('/session', { sessionId, nickname: '꼬마농부', school: { name: school } });
      assert.equal(res.status, 201);
      const created = await res.json();
      assert.equal(created.school.name, school);

      // 세션 복구: 같은 UUID 로 다시 요청하면 기존 정보 유지
      res = await post('/session', { sessionId, nickname: '다른이름', school: { name: '다른학교' } });
      assert.equal((await res.json()).nickname, '꼬마농부');

      // 최종 퀘스트는 5개 완료 전 불가
      res = await post(`/session/${sessionId}/complete`, { questId: 'final' });
      assert.equal(res.status, 409);

      for (const q of ['soil', 'snail', 'scarecrow', 'tteok', 'smartfarm']) {
        res = await post(`/session/${sessionId}/complete`, { questId: q });
        assert.equal(res.status, 200, q);
        await sleep(80);
      }
      // 중복 완료는 점수 0
      res = await post(`/session/${sessionId}/complete`, { questId: 'soil' });
      assert.equal((await res.json()).added, 0);

      await sleep(80);
      res = await post(`/session/${sessionId}/complete`, { questId: 'final' });
      const body = await res.json();
      assert.equal(body.added, 50);
      assert.equal(body.score, 100);
      assert.ok(body.speedRank >= 1);
      assert.ok(body.clearTimeMs >= 0);
      assert.deepEqual(body.completed, ['soil', 'snail', 'scarecrow', 'tteok', 'smartfarm', 'final']);

      const lb = await (await fetch(`${base}/leaderboard?school=${encodeURIComponent(created.school.code)}`)).json();
      const mine = lb.schools.find((s) => s.code === created.school.code);
      assert.equal(mine?.score, 100);
      assert.ok(lb.speedrun.some((r) => r.nickname === '꼬마농부' && r.schoolName === school));
      assert.equal(lb.mySchool.score, 100);
      assert.ok(lb.mySchool.rank >= 1);
    });

    test('동시에 같은 퀘스트를 여러 번 보내도 점수는 한 번만', async () => {
      const sessionId = randomUUID();
      await post('/session', { sessionId, nickname: '동시요청', school: { name: `${school}2` } });
      const results = await Promise.all(
        Array.from({ length: 5 }, () => post(`/session/${sessionId}/complete`, { questId: 'soil' }).then((r) => r.json())),
      );
      const s = await (await fetch(`${base}/session/${sessionId}`)).json();
      assert.equal(s.score, 10, JSON.stringify(results.map((r) => r.added ?? r.error)));
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
      res = await fetch(`${base}/session/${randomUUID()}`);
      assert.equal(res.status, 404);
    });

    test('학교 검색 (NEIS 실패 시 예시 목록) 및 캐시', async () => {
      const r1 = await (await fetch(`${base}/schools?q=${encodeURIComponent('햇살')}`)).json();
      assert.ok(r1.schools.length >= 1);
      const r2 = await (await fetch(`${base}/schools?q=${encodeURIComponent('햇살')}`)).json();
      assert.deepEqual(r2, r1);
    });
  });
}
