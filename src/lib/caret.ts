// 计算 textarea 中某个字符位置的像素坐标（相对 textarea 边框盒左上角，未减滚动）。
// 原理：把 textarea 的关键排版样式镜像到一个隐藏 div，用一个零宽 span 标出插入点位置。
const MIRRORED = [
  "boxSizing",
  "width",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "fontSize",
  "lineHeight",
  "fontFamily",
  "textAlign",
  "textTransform",
  "textIndent",
  "letterSpacing",
  "wordSpacing",
  "tabSize",
] as const;

export interface CaretPos {
  /** 相对 textarea 边框盒的顶部偏移（含 padding，未减 scrollTop） */
  top: number;
  /** 相对 textarea 边框盒的左侧偏移 */
  left: number;
  /** 当前行高 */
  height: number;
}

export function getCaretCoordinates(
  el: HTMLTextAreaElement,
  position: number,
): CaretPos {
  const computed = getComputedStyle(el);
  const div = document.createElement("div");
  const s = div.style;
  s.position = "absolute";
  s.visibility = "hidden";
  s.whiteSpace = "pre-wrap";
  s.overflowWrap = "break-word";
  for (const prop of MIRRORED) {
    s[prop] = computed[prop];
  }
  s.overflow = "hidden";

  div.textContent = el.value.slice(0, position);
  const span = document.createElement("span");
  // 用后续一个字符（或占位）撑出插入点，取其左上角
  span.textContent = el.value.slice(position) || ".";
  div.appendChild(span);

  document.body.appendChild(div);
  const top = span.offsetTop + parseFloat(computed.borderTopWidth);
  const left = span.offsetLeft + parseFloat(computed.borderLeftWidth);
  const height = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize);
  document.body.removeChild(div);

  return { top, left, height };
}
