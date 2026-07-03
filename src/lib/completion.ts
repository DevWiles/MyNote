// 笔记编辑器的补全逻辑：斜杠命令、语料库、光标处 token 识别。
// 纯函数，不依赖 React，便于单独测试与在组件里组合。

export interface SlashCmd {
  key: string;
  title: string;
  /** 用于筛选匹配的关键词（含中英文别名） */
  keywords: string;
  /** 采纳后插入的文本（替换掉 /token） */
  text: string;
  /** 光标从插入文本末尾回退的字符数 */
  caretBack?: number;
  /** 是否块级：不在行首时前置换行 */
  block?: boolean;
}

const TABLE_SNIPPET = "| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n|  |  |  |\n";

/** 斜杠命令表：顺序即菜单展示顺序 */
export const SLASH_COMMANDS: SlashCmd[] = [
  { key: "h1", title: "一级标题", keywords: "h1 heading 标题 yijibiaoti", text: "# ", block: true },
  { key: "h2", title: "二级标题", keywords: "h2 heading 标题 erjibiaoti", text: "## ", block: true },
  { key: "h3", title: "三级标题", keywords: "h3 heading 标题 sanjibiaoti", text: "### ", block: true },
  { key: "ul", title: "无序列表", keywords: "ul list 列表 wuxuliebiao dian", text: "- ", block: true },
  { key: "ol", title: "有序列表", keywords: "ol list 列表 youxuliebiao xuhao", text: "1. ", block: true },
  { key: "todo", title: "待办清单", keywords: "todo task 待办 daiban checkbox", text: "- [ ] ", block: true },
  { key: "quote", title: "引用", keywords: "quote 引用 yinyong blockquote", text: "> ", block: true },
  { key: "code", title: "代码块", keywords: "code 代码 daimakuai fence", text: "```\n\n```\n", caretBack: 5, block: true },
  { key: "table", title: "表格", keywords: "table 表格 biaoge", text: TABLE_SNIPPET, block: true },
  { key: "hr", title: "分割线", keywords: "hr divider 分割线 fengexian", text: "---\n", block: true },
  { key: "link", title: "链接", keywords: "link 链接 lianjie url", text: "[](url)", caretBack: 6 },
  { key: "image", title: "图片", keywords: "image 图片 tupian img", text: "![](url)", caretBack: 6 },
];

/** 按 token 过滤斜杠命令；空 token 返回全部 */
export function filterSlash(token: string): SlashCmd[] {
  const q = token.trim().toLowerCase();
  if (!q) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter(
    (c) => c.title.includes(q) || c.keywords.toLowerCase().includes(q),
  );
}

export interface Corpus {
  /** 去重的标签（不含 #） */
  tags: string[];
  /** 去重的历史短语：标题、标题行、英文词 */
  phrases: string[];
}

const HEADING_RE = /^#{1,6}\s+(.+?)\s*#*\s*$/;
const LATIN_WORD_RE = /[A-Za-z][A-Za-z0-9_-]{2,}/g;

/** 从所有笔记提取可补全的标签与历史短语 */
export function buildCorpus(
  notes: { title: string; body: string; tags: string[] }[],
): Corpus {
  const tags = new Set<string>();
  const phrases = new Set<string>();
  for (const n of notes) {
    for (const t of n.tags) if (t.trim()) tags.add(t.trim());
    const title = n.title.trim();
    if (title && title !== "未命名笔记") phrases.add(title);
    for (const line of n.body.split("\n")) {
      const h = HEADING_RE.exec(line.trim());
      if (h) phrases.add(h[1].trim());
    }
    const words = n.body.match(LATIN_WORD_RE);
    if (words) for (const w of words) phrases.add(w);
    // 上限保护，避免超大笔记库拖慢
    if (phrases.size > 4000) break;
  }
  return { tags: [...tags], phrases: [...phrases] };
}

/** 排序：前缀匹配优先，其次包含匹配；同级按长度升序 */
function rank(candidates: string[], token: string, limit: number): string[] {
  const q = token.toLowerCase();
  const starts: string[] = [];
  const contains: string[] = [];
  for (const c of candidates) {
    if (c === token) continue;
    const lc = c.toLowerCase();
    if (lc.startsWith(q)) starts.push(c);
    else if (lc.includes(q)) contains.push(c);
  }
  const byLen = (a: string, b: string) => a.length - b.length;
  return [...starts.sort(byLen), ...contains.sort(byLen)].slice(0, limit);
}

export function matchTags(tags: string[], token: string, limit = 8): string[] {
  const q = token.toLowerCase();
  if (!q) return tags.slice(0, limit);
  return rank(tags, token, limit);
}

export function matchPhrases(
  phrases: string[],
  token: string,
  limit = 8,
): string[] {
  return rank(phrases, token, limit);
}

export type TokenKind = "slash" | "tag" | "word";
export interface TokenMatch {
  kind: TokenKind;
  /** token（斜杠/井号后面的部分，不含前导符号；word 为整词） */
  token: string;
  /** 需要被替换区间的起始偏移：slash 指向 '/'，tag 指向 '#'，word 指向词首 */
  from: number;
}

// 词的组成：Unicode 字母/数字/下划线/连字符（含 CJK）
const WORD_TAIL = /[\p{L}\p{N}_-]+$/u;
const SLASH_TAIL = /(?:^|\s)\/([^\s/]*)$/;
const TAG_TAIL = /(?:^|\s)#([^\s#]*)$/u;

/** 识别光标左侧正在输入的 token；优先级 slash > tag > word */
export function detectToken(value: string, caret: number): TokenMatch | null {
  const s = value.slice(0, caret);

  const slash = SLASH_TAIL.exec(s);
  if (slash) {
    const token = slash[1];
    return { kind: "slash", token, from: caret - token.length - 1 };
  }

  const tag = TAG_TAIL.exec(s);
  if (tag) {
    const token = tag[1];
    return { kind: "tag", token, from: caret - token.length - 1 };
  }

  const word = WORD_TAIL.exec(s);
  if (word) {
    const token = word[0];
    // 纯数字不触发；长度不足 2 不触发
    if (token.length >= 2 && !/^\d+$/.test(token)) {
      return { kind: "word", token, from: caret - token.length };
    }
  }
  return null;
}

/** 成对符号：键入左符时自动补右符 */
export const PAIRS: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
  "`": "`",
  '"': '"',
};

/** 包裹用符号：选中文本时按这些键在两侧加同一符号 */
export const WRAP_CHARS: Record<string, [string, string]> = {
  "`": ["`", "`"],
  "*": ["*", "*"],
  "~": ["~", "~"],
  _: ["_", "_"],
  "(": ["(", ")"],
  "[": ["[", "]"],
  "{": ["{", "}"],
  '"': ['"', '"'],
};

/** 中文（全角）成对符号：左符 → 右符。经输入法提交，用输入差分识别，不走 keydown */
export const CJK_PAIRS: Record<string, string> = {
  "（": "）",
  "【": "】",
  "「": "」",
  "『": "』",
  "《": "》",
  "〈": "〉",
  "［": "］",
  "｛": "｝",
  "“": "”",
  "‘": "’",
};

/** 所有全角右符集合，用于「越过」判断 */
export const CJK_CLOSERS = new Set(Object.values(CJK_PAIRS));

/** 合并 ASCII + 全角的「左符 → 右符」查表（供退格删配对用） */
export const ALL_PAIRS: Record<string, string> = { ...PAIRS, ...CJK_PAIRS };

/**
 * 若 newV 相对 oldV「恰好在 caret 前插入了一个字符」，返回该字符，否则 null。
 * 用于识别用户刚键入/输入法刚提交的单个符号；插入两个字符（输入法自带配对）时返回 null，
 * 天然避免自动闭合与输入法配对叠加成重复符号。
 */
export function insertedChar(
  oldV: string,
  newV: string,
  caret: number,
): string | null {
  if (newV.length !== oldV.length + 1) return null;
  const i = caret - 1;
  if (i < 0) return null;
  if (newV.slice(0, i) !== oldV.slice(0, i)) return null;
  if (newV.slice(i + 1) !== oldV.slice(i)) return null;
  return newV[i];
}
