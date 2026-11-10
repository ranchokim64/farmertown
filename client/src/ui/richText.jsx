// "**정답**" 표시를 굵게(강조) 렌더링 — 대화창과 배움 노트에서 함께 사용
export function richText(text) {
  return String(text)
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? (
        <b key={i} className="key">
          {part.slice(2, -2)}
        </b>
      ) : (
        part
      ),
    );
}

// 굵게 표시를 뺀 순수 텍스트 (알림 등)
export const plainText = (text) => String(text).replace(/\*\*/g, '');
