# 활동지

| 파일 | 용도 |
| --- | --- |
| `가래떡마을-활동지-학생용.pdf` | A4 3쪽, 바로 인쇄 |
| `가래떡마을-활동지-교사용.pdf` | 정답(빨간 글씨) + 4쪽 지도 도움 자료 |
| `가래떡마을-활동지-학생용.docx` / `-교사용.docx` | 문구를 고칠 수 있는 Word 파일 (한글에서도 열림) |

## 내용 고치기

문항과 정답은 모두 `content.mjs` 한 파일에 있습니다. 빈칸은 `{{정답}}` 또는 `{{정답:칸너비}}` 로 쓰면
학생용에는 빈칸, 교사용에는 빨간 정답으로 나옵니다. 고친 뒤 다시 만들기:

```bash
NODE_PATH=$(npm root -g) node docs/worksheet/build-pdf.mjs    # PDF (Playwright 필요)
NODE_PATH=$(npm root -g) node docs/worksheet/build-docx.mjs   # Word (docx 패키지 필요)
```

게임 대사를 바꾸면(`client/src/game/data/story.js`) 활동지 정답도 함께 확인해 주세요.
