import { useEffect, useRef, useState } from 'react';
import { useGame, OUTFIT_COLORS } from '../store.js';
import { api } from '../api.js';
import { resetPlayer } from '../game/runtime.js';
import { sfx } from '../sfx.js';

const NICK_RE = /^[가-힣a-zA-Z0-9 ]{2,10}$/;

function SchoolSearch({ value, onChange }) {
  const [query, setQuery] = useState(value?.name ?? '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (!q || q === value?.name) {
      setResults([]);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const r = await api.searchSchools(q);
        if (id === reqId.current) setResults(r.schools);
      } catch {
        if (id === reqId.current) setResults([]);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, value]);

  const pick = (school) => {
    onChange(school);
    setQuery(school.name);
    setOpen(false);
  };

  const q = query.trim();
  return (
    <div className="school-search">
      <input
        value={query}
        placeholder="🏫 우리 학교 이름을 검색하세요"
        maxLength={20}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(null);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && q && !value && (
        <ul className="dropdown">
          {loading && <li className="muted">검색 중…</li>}
          {results.map((s) => (
            <li key={s.code} onMouseDown={() => pick(s)}>
              <b>{s.name}</b> <span className="muted">{s.region}</span>
            </li>
          ))}
          {!loading && q.length >= 2 && (
            <li className="custom" onMouseDown={() => pick({ code: '', name: q, region: '직접 입력' })}>
              ✏️ &quot;{q}&quot; (으)로 직접 입력하기
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export function TitleScreen() {
  const { profile, sessionId, startNew, resume, resetAll, setPhase } = useGame();
  const [school, setSchool] = useState(null);
  const [nickname, setNickname] = useState('');
  const [outfit, setOutfit] = useState({ overall: OUTFIT_COLORS.overall[0], shirt: OUTFIT_COLORS.shirt[0] });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const canResume = !!(sessionId && profile);

  const join = async (e) => {
    e.preventDefault();
    setError('');
    if (!school) return sfx.play('hint'), setError('학교를 검색해서 선택해 주세요.');
    if (!NICK_RE.test(nickname.trim())) return sfx.play('hint'), setError('닉네임은 한글·영문·숫자 2~10자로 지어 주세요.');
    setBusy(true);
    try {
      await startNew({ nickname: nickname.trim(), school, outfit });
      sfx.play('start');
      resetPlayer();
      setPhase('intro');
    } catch (err) {
      setError(err.message || '잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  const continueGame = async () => {
    setBusy(true);
    await resume();
    sfx.play('start');
    resetPlayer();
    setBusy(false);
    setPhase('play');
  };

  return (
    <div className="title-screen">
      <div className="title-card">
        <div className="badge">11월 11일 농업인의 날</div>
        <h1>
          <span>가래떡 마을의</span>
          <br />
          황금 들판 🌾
        </h1>

        {canResume ? (
          <div className="resume">
            <p>
              다시 왔구나, <b>{profile.nickname}</b>! <br />
              <span className="muted">🏫 {profile.school?.name}</span>
            </p>
            <button className="btn primary" disabled={busy} onClick={continueGame}>
              이어서 축제 즐기기 ▶
            </button>
            <button
              className="btn ghost"
              disabled={busy}
              onClick={() => window.confirm('처음부터 새로 시작할까요? (지금까지의 진행이 사라져요)') && resetAll()}
            >
              새 친구로 시작하기
            </button>
          </div>
        ) : (
          <form onSubmit={join}>
            <SchoolSearch value={school} onChange={setSchool} />
            <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="😊 닉네임 (2~10자)" maxLength={10} />
            <div className="outfit">
              <div>
                <span>작업복</span>
                {OUTFIT_COLORS.overall.map((c) => (
                  <button
                    type="button"
                    key={c}
                    aria-label={`작업복 색 ${c}`}
                    className={`swatch ${outfit.overall === c ? 'on' : ''}`}
                    style={{ background: c }}
                    onClick={() => (sfx.play('click'), setOutfit({ ...outfit, overall: c }))}
                  />
                ))}
              </div>
              <div>
                <span>셔츠</span>
                {OUTFIT_COLORS.shirt.map((c) => (
                  <button
                    type="button"
                    key={c}
                    aria-label={`셔츠 색 ${c}`}
                    className={`swatch ${outfit.shirt === c ? 'on' : ''}`}
                    style={{ background: c }}
                    onClick={() => (sfx.play('click'), setOutfit({ ...outfit, shirt: c }))}
                  />
                ))}
              </div>
            </div>
            {error && <p className="error">{error}</p>}
            <button className="btn primary big" disabled={busy}>
              {busy ? '준비 중…' : '축제 참가하기 🎉'}
            </button>
          </form>
        )}
        <p className="hint">회원가입 없이 바로 즐겨요 · 바른 말 고운 말 닉네임을 써 주세요</p>
      </div>
    </div>
  );
}
