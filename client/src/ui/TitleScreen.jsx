import { useEffect, useRef, useState } from 'react';
import { useGame, OUTFIT_COLORS } from '../store.js';
import { api } from '../api.js';
import { resetPlayer } from '../game/runtime.js';
import { sfx } from '../sfx.js';
import { enterFullscreen } from '../fullscreen.js';
import { isTouchDevice } from '../quality.js';
import { useQr } from './QrOverlay.jsx';

const NICK_RE = /^[가-힣a-zA-Z0-9 ]{2,10}$/;

// 학교 검색 (태블릿 기준)
// - 목록은 입력칸 아래에 붙어 나오고(떠 있는 메뉴가 아님), 학교를 고를 때까지 계속 보입니다.
//   키보드를 내리려고 바깥을 눌러도 사라지지 않아요.
// - 검색이 안 될 때도 '직접 입력'으로 진행할 수 있어요.
function SchoolSearch({ value, onChange }) {
  const [query, setQuery] = useState(value?.name ?? '');
  // 받은 결과는 어떤 검색어의 결과인지와 함께 보관 → 지금 검색어의 결과가 아직이면 항상 "검색 중"
  const [res, setRes] = useState({ q: '', schools: [], failed: false });
  const wantFirst = useRef(false); // 결과가 오기 전에 엔터를 누르면, 오자마자 첫 번째 학교 선택
  const panel = useRef();
  const q = query.trim();
  const pending = !value && q.length > 0 && res.q !== q;

  useEffect(() => {
    if (!q || value) return undefined;
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        const r = await api.searchSchools(q);
        if (alive) setRes({ q, schools: r.schools ?? [], failed: false });
      } catch {
        if (alive) setRes({ q, schools: [], failed: true });
      }
    }, 400); // 한글은 자모를 칠 때마다 바뀌므로 조금 더 기다렸다 검색
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [q, value]);

  const pick = (school) => {
    wantFirst.current = false;
    onChange(school);
    setQuery(school.name);
    sfx.play('click');
  };

  useEffect(() => {
    if (res.q !== q) return;
    if (wantFirst.current && res.schools[0]) pick(res.schools[0]);
    wantFirst.current = false;
    // 결과가 나오면 목록이 화면(키보드 위) 안에 보이도록 스크롤
    panel.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res]);

  const results = res.q === q ? res.schools : [];
  const failed = res.q === q && res.failed;
  const showPanel = !value && q.length > 0;
  return (
    <div className="school-search">
      <input
        value={query}
        placeholder="🏫 우리 학교 이름을 검색하세요"
        maxLength={20}
        autoComplete="off"
        enterKeyHint="search"
        className={value ? 'picked' : ''}
        onChange={(e) => {
          setQuery(e.target.value);
          wantFirst.current = false;
          if (value) onChange(null);
        }}
        onKeyDown={(e) => {
          // 엔터(키보드의 "검색"): 첫 번째 학교를 선택 (폼 제출 막기)
          if (e.key !== 'Enter') return;
          e.preventDefault();
          if (pending) wantFirst.current = true;
          else if (results[0]) pick(results[0]);
        }}
        onFocus={keepInView}
      />
      {value && (
        <div className="school-picked">
          ✅ <b>{value.name}</b> {value.region && <span className="muted">{value.region}</span>}
          <button type="button" className="link" onClick={() => { onChange(null); setQuery(''); }}>
            다시 고르기
          </button>
        </div>
      )}
      {showPanel && (
        <ul className="school-list" ref={panel}>
          {pending && <li className="muted">검색 중…</li>}
          {!pending && failed && <li className="muted">학교 검색이 잠시 안 돼요. 아래 &apos;직접 입력&apos;을 눌러 주세요.</li>}
          {!pending && !failed && !results.length && q.length < 2 && <li className="muted">학교 이름을 두 글자 이상 써 주세요</li>}
          {!pending && !failed && !results.length && q.length >= 2 && <li className="muted">찾는 학교가 없어요. 이름을 다시 확인하거나 아래 &apos;직접 입력&apos;을 눌러 주세요.</li>}
          {results.map((s) => (
            <li key={s.code} role="button" onClick={() => pick(s)}>
              <b>{s.name}</b> <span className="muted">{s.region}</span>
            </li>
          ))}
          {!pending && q.length >= 2 && (
            <li className="custom" role="button" onClick={() => pick({ code: '', name: q, region: '직접 입력' })}>
              ✏️ &quot;{q}&quot; (으)로 직접 입력하기
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

// 입력칸을 누르면 화면 키보드가 올라온 뒤 입력칸이 가려지지 않게 스크롤
function keepInView(e) {
  const el = e.currentTarget;
  setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 350);
}

// 화면 키보드 높이만큼 타이틀 화면 아래에 여백을 줘서, 가려진 부분까지 스크롤할 수 있게 함
// (키보드가 화면을 줄이지 않고 덮는 브라우저 대비)
function useKeyboardInset(ref) {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const update = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      ref.current?.style.setProperty('--kb', `${Math.round(kb)}px`);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [ref]);
}

// 터치 기기를 세로로 들고 있는지
function usePortrait() {
  const query = '(orientation: portrait) and (pointer: coarse)';
  const [portrait, setPortrait] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return undefined;
    const on = () => setPortrait(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return portrait;
}

export function TitleScreen() {
  const { profile, sessionId, startNew, resume, resetAll, setPhase } = useGame();
  const [school, setSchool] = useState(null);
  const [nickname, setNickname] = useState('');
  const [outfit, setOutfit] = useState({ overall: OUTFIT_COLORS.overall[0], shirt: OUTFIT_COLORS.shirt[0] });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const canResume = !!(sessionId && profile);
  const portrait = usePortrait();
  const screen = useRef();
  useKeyboardInset(screen);

  const join = async (e) => {
    e.preventDefault();
    setError('');
    if (!school) return sfx.play('hint'), setError('학교 이름을 쓰고 아래 목록에서 우리 학교를 눌러 주세요.');
    if (!NICK_RE.test(nickname.trim())) return sfx.play('hint'), setError('닉네임은 한글·영문·숫자 2~10자로 지어 주세요.');
    setBusy(true);
    if (isTouchDevice) enterFullscreen(); // 태블릿: 주소창을 숨겨 화면을 넓게 (버튼을 누른 순간에만 가능)
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
    if (isTouchDevice) enterFullscreen();
    await resume();
    sfx.play('start');
    resetPlayer();
    setBusy(false);
    setPhase('play');
  };

  return (
    <div className="title-screen" ref={screen}>
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
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="😊 닉네임 (2~10자)"
              maxLength={10}
              autoComplete="off"
              enterKeyHint="go"
              onFocus={keepInView}
            />
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
        <button type="button" className="btn ghost qr-open" onClick={useQr.getState().show}>
          📱 QR코드로 입장 안내 (선생님용)
        </button>
        {portrait && <p className="portrait-tip">📱↻ 태블릿을 가로로 돌리면 마을을 더 넓게 볼 수 있어요</p>}
      </div>
    </div>
  );
}
