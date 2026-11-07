// 활동지 Word(.docx) 만들기: NODE_PATH=$(npm root -g) node docs/worksheet/build-docx.mjs
// 선생님이 문구를 고칠 수 있는 편집용 (한글 프로그램에서도 열림). 내용은 content.mjs 와 같음.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import * as C from './content.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  AlignmentType, PageBreak, LevelFormat, VerticalAlign, TabStopType, Footer, PageNumber,
} = require('docx');

const FONT = '맑은 고딕';
const BROWN = '3D2A14';
const RED = 'D42F2F';
const GOLD = 'E9A825';
const LINE = 'E9C58A';
const W = 10206; // A4 폭 11906 - 좌우 여백 850*2 (DXA)
const img = (name) => fs.readFileSync(path.join(here, 'img', `${name}.jpg`));

const run = (text, o = {}) => new TextRun({ text, font: FONT, size: o.size ?? 22, bold: o.bold, color: o.color ?? BROWN, underline: o.underline });
const para = (children, o = {}) =>
  new Paragraph({ children, spacing: { before: o.before ?? 60, after: o.after ?? 60, ...(o.line ? { line: o.line } : {}) }, alignment: o.align, indent: o.indent, border: o.border, shading: o.shading, tabStops: o.tabs, keepNext: o.keepNext });

// {{정답:너비}} → 밑줄 빈칸(학생) / 빨간 정답(교사)
function fillRuns(text, teacher, size = 22) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(/\{\{(.*?)(?::(\d+))?\}\}/g)) {
    if (m.index > last) out.push(run(text.slice(last, m.index), { size }));
    const width = Number(m[2] || 4);
    const pad = ' '.repeat(Math.max(2, width * 2));
    if (!teacher || m[1] === '-') out.push(run(pad + pad, { size, underline: {} }));
    else out.push(run(`  ${m[1]}  `, { size, bold: true, color: RED, underline: { color: RED } }));
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(run(text.slice(last), { size }));
  return out;
}

const border = (color = LINE, size = 8) => ({ style: BorderStyle.SINGLE, size, color });
const allBorders = (color, size) => ({ top: border(color, size), bottom: border(color, size), left: border(color, size), right: border(color, size) });
const noBorders = { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } };

function table(widths, rows, o = {}) {
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    rows: rows.map(
      (cells, r) =>
        new TableRow({
          cantSplit: true,
          height: o.height ? { value: o.height, rule: 'atLeast' } : undefined,
          children: cells.map((c, i) => {
            const cell = typeof c === 'object' && c.children ? c : { children: [para(Array.isArray(c) ? c : [run(String(c))])] };
            return new TableCell({
              width: { size: widths[i] * (cell.span || 1), type: WidthType.DXA },
              columnSpan: cell.span,
              borders: o.borders ?? allBorders(LINE, 8),
              shading: cell.fill || (o.headRow && r === 0) ? { type: ShadingType.CLEAR, color: 'auto', fill: cell.fill || 'FFF3CF' } : undefined,
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              verticalAlign: VerticalAlign.CENTER,
              children: cell.children,
            });
          }),
        }),
    ),
  });
}

function questionParas(q, i, teacher) {
  const num = run(`${i + 1}. `, { bold: true, color: GOLD });
  switch (q.type) {
    case 'fill':
      return [para([num, ...fillRuns(q.text, teacher)])];
    case 'choice':
      return [
        para([num, run(q.text)]),
        ...[0, 2].map((k) =>
          para(
            [0, 1].flatMap((j) => {
              const idx = k + j;
              const picked = teacher && q.answers.includes(idx);
              return [run(`${j ? '\t' : ''}${'①②③④'[idx]} ${q.options[idx]}${picked ? '  ○' : ''}`, { color: picked ? RED : BROWN, bold: picked })];
            }),
            { indent: { left: 400 }, tabs: [{ type: TabStopType.LEFT, position: 4200 }] },
          ),
        ),
      ];
    case 'table':
      return [
        para([num, run(q.text)]),
        table([2400, 2400], [q.head.map((h) => [run(h, { bold: true })]), ...q.rows.map((r) => r.map((c) => fillRuns(c, teacher)))], { headRow: true }),
      ];
    case 'tteok':
      return [
        para([num, run(q.text)]),
        table(
          [2000, 2000, 2000],
          [
            q.names.map(() => [run('(색칠하기)', { color: 'B39A7C', size: 18 })]),
            q.names.map((n) => fillRuns(`{{${n}:4}}`, teacher)),
          ],
          { height: 500 },
        ),
      ];
    default:
      return [];
  }
}

function missionBlock(m, teacher, tag) {
  const title = para(
    [run(`${tag ?? `미션 ${m.no}`}  `, { bold: true, color: GOLD, size: 24 }), run(m.title, { bold: true, size: 26 }), run(`   ${m.place ?? ''}`, { size: 18, color: '9A7B5C' }), ...(m.no ? [run('   🎀 리본 색칠', { size: 18, color: 'E2574C' })] : [])],
    { before: 0, keepNext: true },
  );
  const body = [title, ...(m.text ? [para([run(m.text, { size: 20, color: '9A7B5C' })])] : []), ...m.questions.flatMap((q, i) => questionParas(q, i, teacher))];
  return [
    table(
      [1500, W - 1500],
      [[{ children: [para([new ImageRun({ type: 'jpg', data: img(m.img), transformation: { width: 82, height: 82 } })], { align: AlignmentType.CENTER })] }, { children: body }]],
      { borders: allBorders('F0DCB4', 10) },
    ),
    para([], { before: 60, after: 60 }),
  ];
}

const band = (text, fill = '3CB371') => para([run(text, { bold: true, color: 'FFFFFF', size: 26 })], { shading: { type: ShadingType.CLEAR, color: 'auto', fill }, before: 160, after: 120 });
const writeLines = (n) => Array.from({ length: n }, () => para([run(' ')], { border: { bottom: { style: BorderStyle.DASHED, size: 6, color: 'C9B392' } }, before: 160, indent: { left: 400 } }));
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

function build(teacher) {
  const S = [];
  // 1쪽
  S.push(para([run(`🌾 ${C.SUBTITLE}`, { color: 'E2574C', size: 22, bold: true })], { before: 0, after: 0 }));
  S.push(para([run(C.TITLE, { size: 44, bold: true, color: 'B9790A' })], { before: 0, after: 120 }));
  S.push(table([3400, 1400, W - 4800], [['____학년 ____반 ____번', '이름', ''], ['게임 닉네임', { children: [para([run('')])], span: 2 }]]));
  S.push(para([run(C.INTRO.speaker, { bold: true, color: 'E2574C' }), run(`  ${C.INTRO.text}`, { size: 20 })], { shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'FFF8E7' }, before: 160, after: 80 }));
  S.push(band('🗺️ 게임하며 미션 기록하기'));
  C.MISSIONS.slice(0, 3).forEach((m) => S.push(...missionBlock(m, teacher)));
  S.push(pageBreak());
  // 2쪽
  C.MISSIONS.slice(3).forEach((m) => S.push(...missionBlock(m, teacher)));
  S.push(...missionBlock({ ...C.BONUS, place: '' }, teacher, '보너스'));
  S.push(pageBreak());
  // 3쪽
  const Wr = C.WRAPUP;
  S.push(band(`✏️ ${Wr.title}`));
  S.push(para([run('🏆 '), ...fillRuns(Wr.record, teacher)], { after: 120 }));
  S.push(para([run('1. ', { bold: true, color: GOLD }), run(Wr.order.text)]));
  const box = (it) => [run(teacher ? `[ ${it.answer} ] ` : '[    ] ', { bold: true, color: teacher ? RED : BROWN }), run(it.text, { size: 20 })];
  S.push(table([W / 2, W / 2], [[box(Wr.order.items[0]), box(Wr.order.items[1])], [box(Wr.order.items[2]), box(Wr.order.items[3])]], { borders: noBorders }));
  S.push(para([run('2. ', { bold: true, color: GOLD }), run(Wr.compare.text), run('  ★ 생각 넓히기', { color: '3B7DD8', size: 18, bold: true })], { before: 160 }));
  const ex = (t) => (teacher ? [run(t, { color: RED, size: 19 })] : [run('')]);
  S.push(
    table(
      [1600, 2800, W - 4400],
      [
        Wr.compare.head.map((h) => [run(h, { bold: true })]),
        ...Wr.compare.rows.map((r) => [[run(r[0], { bold: true })], [run(r[1], { size: 20 })], ex(r[2])]),
        [[run('함께 쓰면?', { bold: true })], { children: [para(ex(Wr.compare.together))], span: 2 }],
      ],
      { headRow: true, height: 700 },
    ),
  );
  S.push(para([run('3. ', { bold: true, color: GOLD }), run(Wr.idea.text), run('  ★ 생각 넓히기', { color: '3B7DD8', size: 18, bold: true })], { before: 160 }));
  if (teacher) S.push(para([run(Wr.idea.example, { color: RED, size: 19 })], { indent: { left: 400 } }));
  else S.push(...writeLines(2));
  S.push(para([], { before: 60 }));
  S.push(
    table(
      [W],
      [[{ children: [para([run(`💌 ${Wr.card.text}`)]), para([run(Wr.card.to, { bold: true, color: 'E2574C' })]), ...writeLines(3), para([run('From. ____________', { bold: true, color: 'E2574C' })], { align: AlignmentType.RIGHT })], fill: 'FFF7F8' }]],
      { borders: allBorders('FF9AA2', 14) },
    ),
  );
  S.push(para([run(`⭐ ${Wr.rating.text}`)], { before: 160 }));
  Wr.rating.items.forEach((t) => S.push(para([run(t, { size: 20 }), run('\t☆  ☆  ☆', { color: GOLD, size: 26 })], { indent: { left: 400 }, tabs: [{ type: TabStopType.RIGHT, position: W - 200 }] })));
  // 교사용 4쪽
  if (teacher) {
    const T = C.TEACHER;
    S.push(pageBreak());
    S.push(band(`🧑‍🏫 ${T.title}`, '3B7DD8'));
    S.push(para([run('수업 흐름 (40분)', { bold: true, color: '3B7DD8', size: 24 })], { before: 120 }));
    S.push(table([1200, 1400, W - 2600], T.flow.map((r) => [[run(r[0], { bold: true })], [run(r[1])], [run(r[2], { size: 20 })]])));
    S.push(para([run('지도 팁', { bold: true, color: '3B7DD8', size: 24 })], { before: 200 }));
    T.tips.forEach((t) => S.push(new Paragraph({ numbering: { reference: 'tips', level: 0 }, children: [run(t, { size: 20 })], spacing: { before: 40, after: 40 } })));
    S.push(para([run('미션별 배움과 연계 교과', { bold: true, color: '3B7DD8', size: 24 })], { before: 200 }));
    S.push(table([2400, 4600, W - 7000], [['미션', '배우는 것', '연계 교과'].map((h) => [run(h, { bold: true })]), ...T.subjects.map((r) => r.map((c) => [run(c, { size: 20 })]))], { headRow: true }));
    S.push(para([run('게임 입장', { bold: true, color: '3B7DD8', size: 24 })], { before: 200 }));
    S.push(para([run(`교실 화면에서 ${C.GAME_URL}?qr 을 열면 입장 QR코드가 크게 뜹니다. 학생들은 태블릿 카메라로 찍어 입장해요. (게임 첫 화면과 오른쪽 위 QR 버튼으로도 띄울 수 있어요)`, { size: 20 })]));
  }

  return new Document({
    creator: '가래떡 마을',
    title: `${C.TITLE} 활동지${teacher ? ' (교사용)' : ''}`,
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    numbering: { config: [{ reference: 'tips', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 400, hanging: 260 } } } }] }] },
    sections: [
      {
        properties: { page: { margin: { top: 720, bottom: 720, left: 850, right: 850 } } },
        footers: {
          default: new Footer({
            children: [para([run(`${teacher ? '교사용 · ' : ''}${C.TITLE} 활동지 · `, { size: 16, color: 'B39A7C' }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: 'B39A7C' }), run(` · ${C.GAME_URL}`, { size: 16, color: 'B39A7C' })], { align: AlignmentType.CENTER })],
          }),
        },
        children: S,
      },
    ],
  });
}

const out = process.argv[2] || here;
for (const [teacher, name] of [[false, '가래떡마을-활동지-학생용'], [true, '가래떡마을-활동지-교사용']]) {
  fs.writeFileSync(path.join(out, `${name}.docx`), await Packer.toBuffer(build(teacher)));
  console.log('📝', `${name}.docx`);
}
