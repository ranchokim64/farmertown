// 활동지 PDF 만들기: node docs/worksheet/build-pdf.mjs
// content.mjs 를 A4 HTML 로 그린 뒤 브라우저(Playwright)로 PDF 저장 → 학생용·교사용 2개
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import * as C from './content.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const img = (name) => `data:image/jpeg;base64,${fs.readFileSync(path.join(here, 'img', `${name}.jpg`)).toString('base64')}`;

// {{정답:너비}} → 빈칸(학생) / 빨간 정답(교사)
function fill(text, teacher) {
  return esc(text).replace(/\{\{(.*?)(?::(\d+))?\}\}/g, (_, ans, w) => {
    const width = `${Number(w || 4) * 1.15 + 1}em`;
    if (!teacher || ans === '-') return `<span class="blank" style="min-width:${width}"></span>`;
    return `<span class="blank ans" style="min-width:${width}">${ans}</span>`;
  });
}

const ribbon = `<svg class="ribbon" viewBox="0 0 40 40"><path d="M20 18 C12 6 4 8 6 16 C8 22 16 21 20 18 Z M20 18 C28 6 36 8 34 16 C32 22 24 21 20 18 Z" fill="none" stroke="#e2574c" stroke-width="2.2"/><path d="M18 19 L12 36 L17 33 L20 37 Z M22 19 L28 36 L23 33 L20 37 Z" fill="none" stroke="#e2574c" stroke-width="2.2"/><circle cx="20" cy="18" r="3.4" fill="none" stroke="#e2574c" stroke-width="2.2"/></svg>`;

function question(q, i, teacher) {
  const num = `<span class="qn">${i + 1}</span>`;
  const star = q.star ? '<span class="star">★ 생각 넓히기</span>' : '';
  switch (q.type) {
    case 'fill':
      return `<li>${num}<p>${fill(q.text, teacher)}</p></li>`;
    case 'choice':
      return `<li>${num}<p>${esc(q.text)}</p><div class="choices">${q.options
        .map((o, k) => `<span class="choice ${teacher && q.answers.includes(k) ? 'picked' : ''}">${'①②③④⑤'[k]} ${esc(o)}</span>`)
        .join('')}</div></li>`;
    case 'table':
      return `<li>${num}<p>${esc(q.text)}</p><table class="mini"><tr>${q.head.map((h) => `<th>${h}</th>`).join('')}</tr>${q.rows
        .map((r) => `<tr>${r.map((c) => `<td>${fill(c, teacher)}</td>`).join('')}</tr>`)
        .join('')}</table></li>`;
    case 'tteok':
      return `<li>${num}<p>${esc(q.text)}</p><div class="tteoks">${q.names
        .map((n) => `<div class="tteok"><div class="stick"></div><span class="blank ${teacher ? 'ans' : ''}" style="min-width:4.5em">${teacher ? n : ''}</span></div>`)
        .join('')}</div></li>`;
    default:
      return star;
  }
}

function mission(m, teacher) {
  return `<section class="mission">
    <img class="thumb" src="${img(m.img)}" alt="">
    <div class="body">
      <h3><span class="mno">미션 ${m.no}</span>${esc(m.title)} <span class="place">${esc(m.place)}</span>${ribbon}</h3>
      <ol>${m.questions.map((q, i) => question(q, i, teacher)).join('')}</ol>
    </div>
  </section>`;
}

function header() {
  return `<header class="top">
    <div class="titles"><div class="sub">🌾 ${C.SUBTITLE}</div><h1>${C.TITLE}</h1></div>
    <table class="who"><tr><td>___학년 ___반 ___번</td><td>이름</td><td class="w"></td></tr>
    <tr><td>게임 닉네임</td><td colspan="2" class="w"></td></tr></table>
  </header>`;
}

function page(content, n, total, teacher) {
  return `<div class="page">${content}<footer>${teacher ? '교사용 · ' : ''}${esc(C.TITLE)} 활동지 · ${n}/${total} · ${C.GAME_URL}</footer></div>`;
}

function wrapup(teacher) {
  const W = C.WRAPUP;
  const lines = (n) => `<div class="lines">${'<div></div>'.repeat(n)}</div>`;
  const example = (t) => (teacher ? `<div class="example">${esc(t)}</div>` : '');
  return `<h2 class="band">✏️ ${W.title}</h2>
  <div class="box"><p class="lead">🏆 ${fill(W.record, teacher)}</p></div>
  <div class="box"><p class="lead"><span class="qn">1</span>${esc(W.order.text)}</p>
    <div class="order">${W.order.items.map((it) => `<div class="oi"><span class="obox">${teacher ? it.answer : ''}</span>${esc(it.text)}</div>`).join('')}</div></div>
  <div class="box"><p class="lead"><span class="qn">2</span>${esc(W.compare.text)} <span class="star">★ 생각 넓히기</span></p>
    <table class="mini wide"><colgroup><col class="c1"><col class="c2"><col></colgroup><tr>${W.compare.head.map((h) => `<th>${h}</th>`).join('')}</tr>
    ${W.compare.rows.map((r) => `<tr><th>${r[0]}</th><td>${r[1]}</td><td class="tall">${teacher ? `<span class="exa">${esc(r[2])}</span>` : ''}</td></tr>`).join('')}
    <tr><th>함께 쓰면?</th><td colspan="2" class="tall">${teacher ? `<span class="exa">${esc(W.compare.together)}</span>` : ''}</td></tr></table></div>
  <div class="box"><p class="lead"><span class="qn">3</span>${esc(W.idea.text)} <span class="star">★ 생각 넓히기</span></p>${teacher ? example(W.idea.example) : lines(2)}</div>
  <div class="card"><p class="lead">💌 ${esc(W.card.text)}</p><div class="to">${esc(W.card.to)}</div>${lines(3)}<div class="from">From. ____________</div></div>
  <div class="box"><p class="lead">⭐ ${esc(W.rating.text)}</p>${W.rating.items.map((t) => `<div class="rate"><span>${esc(t)}</span><span class="stars">☆ ☆ ☆</span></div>`).join('')}</div>`;
}

function teacherPage() {
  const T = C.TEACHER;
  return `<h2 class="band teal">🧑‍🏫 ${T.title}</h2>
  <h4>수업 흐름 (40분)</h4>
  <table class="mini wide">${T.flow.map((r) => `<tr><th>${r[0]}</th><td class="c">${r[1]}</td><td>${esc(r[2])}</td></tr>`).join('')}</table>
  <h4>지도 팁</h4><ul class="tips">${T.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
  <h4>미션별 배움과 연계 교과</h4>
  <table class="mini wide"><tr><th>미션</th><th>배우는 것</th><th>연계 교과</th></tr>${T.subjects.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</table>
  <h4>게임 입장</h4>
  <p class="note">교실 화면에서 <b>${C.GAME_URL}?qr</b> 을 열면 입장 QR코드가 크게 뜹니다. 학생들은 태블릿 카메라로 찍어 입장해요. (게임 첫 화면과 오른쪽 위 <b>QR</b> 버튼으로도 띄울 수 있어요)</p>`;
}

function html(teacher) {
  const p1 = `${header()}
    <div class="intro"><img class="thumb round" src="${img(C.INTRO.img)}" alt=""><div><b>${C.INTRO.speaker}</b><p>${esc(C.INTRO.text)}</p></div></div>
    <h2 class="band">🗺️ 게임하며 미션 기록하기</h2>
    ${C.MISSIONS.slice(0, 3).map((m) => mission(m, teacher)).join('')}`;
  const p2 = `${C.MISSIONS.slice(3).map((m) => mission(m, teacher)).join('')}
    <section class="mission bonus"><img class="thumb" src="${img(C.BONUS.img)}" alt=""><div class="body">
      <h3><span class="mno gold">보너스</span>${esc(C.BONUS.title)}</h3><p class="muted">${esc(C.BONUS.text)}</p>
      <ol>${C.BONUS.questions.map((q, i) => question(q, i, teacher)).join('')}</ol></div></section>`;
  const pages = [p1, p2, wrapup(teacher)];
  if (teacher) pages.push(teacherPage());
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Jua&family=Gowun+Dodum&display=swap" rel="stylesheet">
  <style>${fs.readFileSync(path.join(here, 'worksheet.css'), 'utf8')}</style></head>
  <body class="${teacher ? 'teacher' : ''}">${pages.map((p, i) => page(p, i + 1, pages.length, teacher)).join('')}</body></html>`;
}

const out = process.argv[2] || here;
const browser = await chromium.launch();
for (const [teacher, name] of [[false, '가래떡마을-활동지-학생용'], [true, '가래떡마을-활동지-교사용']]) {
  const page = await browser.newPage();
  const file = path.join(out, `${name}.html`);
  fs.writeFileSync(file, html(teacher));
  await page.goto(`file://${file}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  // 넘치는 쪽이 있는지 검사 (A4 한 쪽 안에 들어가야 함)
  const overflow = await page.evaluate(() =>
    [...document.querySelectorAll('.page')].map((p, i) => [i + 1, p.scrollHeight - p.clientHeight]).filter(([, d]) => d > 1),
  );
  if (overflow.length) console.warn(`⚠️ ${name}: 넘치는 쪽`, overflow);
  await page.pdf({ path: path.join(out, `${name}.pdf`), format: 'A4', printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
  fs.unlinkSync(file);
  console.log('📄', `${name}.pdf`);
}
await browser.close();
