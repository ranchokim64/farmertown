import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { config as defaultConfig, QUEST_IDS, FINAL_QUEST_ID, ALL_QUESTS } from './config.js';
import { validateNickname, containsProfanity } from './profanity.js';
import { tooMany, ipLimiter } from './rateLimit.js';
import { searchSchools, validSchoolCode, customSchoolCode, SAMPLE_SCHOOLS } from './schools.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// store: stores/redisStore.js 또는 stores/postgresStore.js
export function createApp({ store, config = defaultConfig }) {
  const app = express();
  app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '4kb' }));

  const api = express.Router();
  api.use(ipLimiter(store, { limit: config.rateLimit.ipPerMinute }));

  const asyncRoute = (fn) => (req, res, next) => fn(req, res, next).catch(next);

  async function loadSession(id) {
    if (!UUID_RE.test(id ?? '')) return null;
    const s = await store.getSession(id);
    if (!s) return null;
    return {
      sessionId: id,
      nickname: s.nickname,
      school: { code: s.schoolCode, name: s.schoolName },
      startedAt: s.startedAt,
      score: s.score,
      clearTimeMs: s.clearTimeMs,
      completed: ALL_QUESTS.filter((q) => s.completed.includes(q)),
    };
  }

  // 세션 단위 호출 제한 (새로고침 연타/매크로 방지)
  const sessionLimiter = asyncRoute(async (req, res, next) => {
    const r = await store.rateHit(`sess:${req.params.id}`, config.rateLimit.sessionPerMinute, 60_000);
    if (!r.allowed) return tooMany(res, r.retryAfterMs);
    next();
  });

  api.get('/health', (_req, res) => res.json({ ok: true, store: store.kind }));

  // ── 학교 검색 (자동완성) ─────────────────────────────
  api.get('/schools', asyncRoute(async (req, res) => {
    res.json(await searchSchools(store, req.query.q, config.neisApiKey));
  }));

  // ── 세션 생성 / 갱신 ────────────────────────────────
  // 클라이언트가 LocalStorage 에 저장한 임시 UUID 를 그대로 사용합니다.
  api.post('/session', asyncRoute(async (req, res) => {
    const { sessionId, nickname: rawNick, school } = req.body ?? {};
    if (!UUID_RE.test(sessionId ?? '')) return res.status(400).json({ error: 'BAD_SESSION_ID', message: '잘못된 세션입니다.' });

    const existing = await loadSession(sessionId);
    if (existing) return res.json(existing); // 세션 복구: 학교/닉네임은 처음 값 유지

    const rl = await store.rateHit(`create:${req.ip}`, config.rateLimit.sessionCreatePerIpPerMinute, 60_000);
    if (!rl.allowed) return tooMany(res, rl.retryAfterMs);

    const nick = validateNickname(rawNick);
    if (!nick.ok) return res.status(400).json({ error: 'BAD_NICKNAME', message: nick.reason });

    const schoolName = String(school?.name ?? '').trim();
    let schoolCode = String(school?.code ?? '');
    if (!schoolName || schoolName.length > 20 || containsProfanity(schoolName)) {
      return res.status(400).json({ error: 'BAD_SCHOOL', message: '학교 이름을 다시 확인해 주세요.' });
    }
    if (schoolCode.startsWith('custom:') || !schoolCode) schoolCode = customSchoolCode(schoolName);
    if (!validSchoolCode(schoolCode)) return res.status(400).json({ error: 'BAD_SCHOOL', message: '학교 정보를 다시 선택해 주세요.' });

    // NEIS/예시 학교는 서버가 알고 있는 이름으로 고정 (이름 위조 방지)
    const known = (await store.knownSchoolName(schoolCode)) ?? SAMPLE_SCHOOLS.find((s) => s.code === schoolCode)?.name;
    const finalSchoolName = schoolCode.startsWith('custom:') ? schoolName : known ?? schoolName;
    await store.createSession(sessionId, { nickname: nick.nickname, schoolCode, schoolName: finalSchoolName });

    res.status(201).json(await loadSession(sessionId));
  }));

  api.get('/session/:id', sessionLimiter, asyncRoute(async (req, res) => {
    const s = await loadSession(req.params.id);
    if (!s) return res.status(404).json({ error: 'NO_SESSION', message: '세션을 찾을 수 없어요.' });
    res.json(s);
  }));

  // ── 퀘스트 완료 → 학교 점수 합산 ────────────────────
  api.post('/session/:id/complete', sessionLimiter, asyncRoute(async (req, res) => {
    const id = req.params.id;
    const questId = req.body?.questId;
    if (!ALL_QUESTS.includes(questId)) return res.status(400).json({ error: 'BAD_QUEST' });

    const s = await loadSession(id);
    if (!s) return res.status(404).json({ error: 'NO_SESSION', message: '세션을 찾을 수 없어요.' });
    if (s.completed.includes(questId)) return res.json({ ...s, added: 0 }); // 멱등 처리

    if (questId === FINAL_QUEST_ID && !QUEST_IDS.every((q) => s.completed.includes(q))) {
      return res.status(409).json({ error: 'NOT_READY', message: '감사 리본 5개를 모두 모아야 해요.' });
    }

    // 플레이 시간 기준 최소 소요 시간 검사 (n번째 퀘스트는 n * minMsPerQuest 이후)
    const now = Date.now();
    const nth = s.completed.length + 1;
    if (now - s.startedAt < nth * config.rateLimit.minMsPerQuest) {
      return tooMany(res, nth * config.rateLimit.minMsPerQuest - (now - s.startedAt), '너무 빨라요! 마을을 조금 더 둘러보세요.');
    }
    const cd = await store.cooldown(`quest:${id}`, config.rateLimit.questCooldownMs);
    if (!cd.allowed) return tooMany(res, cd.retryAfterMs);

    // 저장소가 원자적으로 중복 완료(동시 요청)를 걸러내고 학교 점수를 합산합니다.
    const isFinal = questId === FINAL_QUEST_ID;
    const points = isFinal ? config.points.final : config.points.quest;
    const r = await store.completeQuest(id, questId, points, isFinal);
    const result = { ...(await loadSession(id)), added: r.added ? points : 0 };
    if (r.added && isFinal) result.speedRank = await store.speedRank(id);
    res.json(result);
  }));

  // ── 랭킹 ────────────────────────────────────────────
  // 모든 학생이 10초마다 불러오므로 인스턴스별로 3초 동안 캐시
  let boardCache = { at: 0, limit: 0, data: null };
  api.get('/leaderboard', asyncRoute(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 5, 20);
    if (Date.now() - boardCache.at > 3000 || boardCache.limit !== limit) {
      const [schools, speedrun] = await Promise.all([store.topSchools(limit), store.topSpeedrun(10)]);
      boardCache = {
        at: Date.now(),
        limit,
        data: {
          schools: schools.map((s, i) => ({ rank: i + 1, ...s })),
          speedrun: speedrun.map((s, i) => ({ rank: i + 1, ...s })),
        },
      };
    }
    let mySchool = null;
    const code = String(req.query.school ?? '');
    if (validSchoolCode(code)) mySchool = { code, ...(await store.schoolStanding(code)) };
    res.json({ ...boardCache.data, mySchool, updatedAt: boardCache.at });
  }));

  api.use((_req, res) => res.status(404).json({ error: 'NOT_FOUND' }));
  app.use('/api', api);

  // 빌드된 클라이언트 정적 서빙 (있을 때만)
  if (config.staticDir && fs.existsSync(config.staticDir)) {
    app.use(express.static(config.staticDir, { maxAge: '1h', index: false }));
    app.get('*', (_req, res) => res.sendFile(path.join(config.staticDir, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'SERVER_ERROR', message: '서버에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.' });
  });

  return app;
}
