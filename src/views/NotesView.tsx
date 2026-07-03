import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bold,
  BookSearch,
  CheckSquare,
  Code,
  Columns2,
  Download,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  ListTodo,
  ListTree,
  Minus,
  NotebookPen,
  PanelLeft,
  Pencil,
  Plus,
  Search,
  Square,
  SquareCode,
  Strikethrough,
  Table,
  TextQuote,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import type { ComponentType } from "react";
import { useStore } from "../store/useStore";
import { dragRegion } from "../lib/platform";
import { fmtDate } from "../lib/date";
import { Button, EmptyState } from "../components/ui";
import Modal from "../components/Modal";
import Markdown from "../components/Markdown";
import { exportNotes } from "../store/notesFs";
import { getCaretCoordinates } from "../lib/caret";
import {
  filterSlash,
  buildCorpus,
  matchTags,
  matchPhrases,
  detectToken,
  PAIRS,
  WRAP_CHARS,
  type SlashCmd,
} from "../lib/completion";
import { deepseekChat } from "../lib/deepseek";

export default function NotesView() {
  const { notes, addNote, updateNote, deleteNote, deleteNotes, notesReady } =
    useStore();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    notes[0]?.id ?? null,
  );
  /** 刚新建的笔记 id，用于让标题输入框自动获焦 */
  const [createdId, setCreatedId] = useState<string | null>(null);
  /** 折叠笔记列表（逻辑同侧边栏折叠） */
  const [listCollapsed, setListCollapsed] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  /** 折叠态点放大镜后，展开列表并聚焦搜索框 */
  const wantFocusSearch = useRef(false);
  useEffect(() => {
    if (!listCollapsed && wantFocusSearch.current) {
      wantFocusSearch.current = false;
      searchRef.current?.focus();
    }
  }, [listCollapsed]);

  // 笔记从磁盘加载完成后，若尚未选中则默认选第一篇
  useEffect(() => {
    if (notesReady && selectedId === null && notes.length > 0) {
      setSelectedId(notes[0].id);
    }
  }, [notesReady, notes, selectedId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [notes, query]);

  const selected = notes.find((n) => n.id === selectedId) ?? null;

  // 多选 / 批量删除
  const [selectMode, setSelectMode] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const exitSelect = () => {
    setSelectMode(false);
    setCheckedIds(new Set());
  };
  const toggleChecked = (id: string) =>
    setCheckedIds((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const allChecked =
    filtered.length > 0 && filtered.every((n) => checkedIds.has(n.id));
  const toggleAll = () =>
    setCheckedIds(allChecked ? new Set() : new Set(filtered.map((n) => n.id)));
  const exportChecked = () => {
    const picked = notes.filter((n) => checkedIds.has(n.id));
    if (picked.length) void exportNotes(picked);
  };
  const confirmDelete = () => {
    const ids = [...checkedIds];
    deleteNotes(ids);
    if (selectedId && checkedIds.has(selectedId)) {
      const rest = notes.filter((n) => !checkedIds.has(n.id));
      setSelectedId(rest[0]?.id ?? null);
    }
    setConfirmOpen(false);
    exitSelect();
  };

  const createNote = () => {
    const id = addNote({ title: "未命名笔记", body: "" });
    setSelectedId(id);
    setCreatedId(id);
  };

  return (
    <div className="flex h-full">
      {/* 笔记列表（可折叠）：平滑过渡宽度，避免瞬间跳变导致的闪烁 */}
      <div
        className={[
          "flex shrink-0 flex-col overflow-hidden border-r border-mint-100 transition-[width] duration-200 ease-out",
          listCollapsed ? "w-[60px]" : "w-64",
        ].join(" ")}
      >
        {listCollapsed ? (
          /* 折叠态：头像轨道——展开/新建/搜索入口 + 各笔记首字 coin 占位 */
          <div className="flex h-full w-[60px] shrink-0 flex-col items-center gap-2 py-4">
            <button
              onClick={() => setListCollapsed(false)}
              title="展开笔记列表"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-soft transition-colors hover:bg-mint-50 hover:text-ink"
            >
              <PanelLeft size={18} />
            </button>
            <button
              onClick={createNote}
              title="新建笔记"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint-400 text-white transition-colors hover:bg-mint-500"
            >
              <Plus size={18} />
            </button>
            <button
              onClick={() => {
                wantFocusSearch.current = true;
                setListCollapsed(false);
              }}
              title="搜索笔记"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-soft transition-colors hover:bg-mint-50 hover:text-ink"
            >
              <Search size={18} />
            </button>

            {notes.length > 0 && <div className="my-0.5 h-px w-7 bg-mint-100" />}

            {/* 笔记首字头像 coin */}
            <div className="flex w-full flex-1 flex-col items-center gap-1.5 overflow-y-auto">
              {notes.map((n) => {
                const label = n.title.trim() || "未命名笔记";
                const active = n.id === selectedId;
                return (
                  <button
                    key={n.id}
                    onClick={() => setSelectedId(n.id)}
                    title={label}
                    className={[
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors",
                      active
                        ? "bg-mint-400 text-white"
                        : "bg-mint-50 text-ink hover:bg-mint-100",
                    ].join(" ")}
                  >
                    {label[0]}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* 展开态内容固定 w-64，过渡时由父级 overflow 裁剪显示，不随宽度重排 */
          <div className="flex h-full w-64 shrink-0 flex-col">
            {/* 页面标题 + 多选/折叠按钮 */}
            <div
              {...dragRegion}
              className="flex items-center justify-between px-4 pb-1 pt-4"
            >
              <div className="flex items-center gap-2">
                <NotebookPen
                  size={20}
                  className="text-mint-500"
                  strokeWidth={2.2}
                />
                <h1 className="text-xl font-semibold text-ink">笔记</h1>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
                  title={selectMode ? "退出多选" : "选择笔记"}
                  className={[
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors",
                    selectMode
                      ? "bg-mint-400/20 text-mint-600"
                      : "text-ink-soft hover:bg-mint-50 hover:text-ink",
                  ].join(" ")}
                >
                  <ListChecks size={18} />
                </button>
                <button
                  onClick={() => {
                    exitSelect();
                    setListCollapsed(true);
                  }}
                  title="折叠笔记列表"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-ink-soft transition-colors hover:bg-mint-50 hover:text-ink"
                >
                  <PanelLeft size={18} />
                </button>
              </div>
            </div>

            {/* 新建笔记 / 多选操作栏 */}
            {selectMode ? (
              <div className="flex items-center gap-2 px-3 pt-2">
                <button
                  onClick={toggleAll}
                  className="flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm text-ink-soft transition-colors hover:text-ink"
                >
                  {allChecked ? (
                    <CheckSquare size={16} className="text-mint-500" />
                  ) : (
                    <Square size={16} />
                  )}
                  全选
                </button>
                <span className="ml-auto text-xs text-ink-soft">
                  已选 {checkedIds.size}
                </span>
                <button
                  onClick={exportChecked}
                  disabled={checkedIds.size === 0}
                  title="导出所选为 .md"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-mint-400/20 hover:text-mint-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Download size={16} />
                </button>
                <button
                  onClick={() => checkedIds.size && setConfirmOpen(true)}
                  disabled={checkedIds.size === 0}
                  title="删除所选笔记"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-red-400/20 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ) : (
              <div className="px-3 pt-2">
                <button
                  onClick={createNote}
                  className="flex w-full items-center justify-start gap-2 whitespace-nowrap rounded-xl bg-mint-400 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-mint-500"
                >
                  <Plus size={16} />
                  新建笔记
                </button>
              </div>
            )}

            {/* 搜索 */}
            <div className="px-3 pb-2 pt-3">
              <div className="flex items-center gap-2 rounded-xl border border-mint-100 bg-surface px-2.5 py-1.5 focus-within:border-mint-300">
                <Search size={15} className="text-ink-soft" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索笔记"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-ink-soft/50"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-3">
              {filtered.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-ink-soft">
                  {!notesReady
                    ? "加载中…"
                    : notes.length === 0
                      ? "还没有笔记"
                      : "没有匹配的笔记"}
                </p>
              ) : (
                filtered.map((n) => {
                  const checked = checkedIds.has(n.id);
                  const highlighted = selectMode
                    ? checked
                    : n.id === selectedId;
                  return (
                    <button
                      key={n.id}
                      onClick={() =>
                        selectMode ? toggleChecked(n.id) : setSelectedId(n.id)
                      }
                      className={[
                        "mb-1 flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left transition-colors",
                        highlighted ? "bg-mint-50" : "hover:bg-mint-50/50",
                      ].join(" ")}
                    >
                      {selectMode &&
                        (checked ? (
                          <CheckSquare
                            size={16}
                            className="mt-0.5 shrink-0 text-mint-500"
                          />
                        ) : (
                          <Square
                            size={16}
                            className="mt-0.5 shrink-0 text-ink-soft/50"
                          />
                        ))}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">
                          {n.title || "未命名笔记"}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-ink-soft">
                          {n.body.replace(/[#*`\->]/g, "").trim() || "空笔记"}
                        </span>
                        <span className="mt-1 block text-[11px] text-ink-soft/60">
                          {fmtDate(n.updatedAt)}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* 编辑器 */}
      {selected ? (
        <Editor
          key={selected.id}
          note={selected}
          autoFocusTitle={selected.id === createdId}
          onChange={(patch) => updateNote(selected.id, patch)}
          onExport={() => void exportNotes([selected])}
          onDelete={() => {
            deleteNote(selected.id);
            const rest = notes.filter((n) => n.id !== selected.id);
            setSelectedId(rest[0]?.id ?? null);
          }}
        />
      ) : (
        <div className="flex flex-1 flex-col">
          <EmptyState icon={NotebookPen} text="选择左侧笔记，或新建一篇。" />
        </div>
      )}

      {/* 批量删除确认 */}
      <Modal
        open={confirmOpen}
        title="删除笔记"
        onClose={() => setConfirmOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              取消
            </Button>
            <button
              onClick={confirmDelete}
              className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-red-500/30 transition-colors hover:bg-red-600"
            >
              删除 {checkedIds.size} 篇
            </button>
          </>
        }
      >
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-500 ring-4 ring-red-50">
            <TriangleAlert size={22} />
          </div>
          <div className="flex-1 pt-0.5">
            <p className="text-sm text-ink">
              确定删除选中的{" "}
              <span className="font-semibold text-red-500">
                {checkedIds.size}
              </span>{" "}
              篇笔记吗？
            </p>
            <p className="mt-1.5 text-sm text-red-500/90">
              此操作无法撤销，对应的 .md 文件将被永久删除。
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

interface Heading {
  level: number;
  text: string;
  /** 在文档中的标题序号，对应预览里 md-h-{index} 锚点 */
  index: number;
  /** 标题所在行号（0 起） */
  line: number;
  /** 标题起始字符偏移，用于在 textarea 中定位 */
  offset: number;
}

/** 解析 Markdown 标题，跳过围栏代码块内的 #，与渲染锚点顺序一致 */
function parseHeadings(body: string): Heading[] {
  const lines = body.split("\n");
  const out: Heading[] = [];
  let inFence = false;
  let offset = 0;
  let index = 0;
  for (let lineNo = 0; lineNo < lines.length; lineNo++) {
    const line = lines[lineNo];
    const t = line.trim();
    if (t.startsWith("```") || t.startsWith("~~~")) {
      inFence = !inFence;
    } else if (!inFence) {
      const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
      if (m) {
        out.push({
          level: m[1].length,
          text: m[2],
          index: index++,
          line: lineNo,
          offset,
        });
      }
    }
    offset += line.length + 1; // 含换行
  }
  return out;
}

function Editor({
  note,
  autoFocusTitle,
  onChange,
  onExport,
  onDelete,
}: {
  note: { id: string; title: string; body: string };
  autoFocusTitle: boolean;
  onChange: (patch: { title?: string; body?: string }) => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  const { noteView, setNoteView, notes, settings } = useStore();
  const viewMode = noteView.mode;
  const singlePane = noteView.pane;
  const showOutline = noteView.outline;
  const ac = settings.autocomplete;
  const titleRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  /** 工具栏插入后待恢复的选区，body 提交后由 effect 应用 */
  const pendingSel = useRef<[number, number] | null>(null);

  // ── 补全：斜杠命令 / 标签 / 历史词 的下拉菜单 ─────────────────
  interface MenuItem {
    label: string;
    sub?: string;
    /** 词/标签补全：替换 token 的文本 */
    replace?: string;
    /** 斜杠命令 */
    cmd?: SlashCmd;
  }
  interface MenuState {
    items: MenuItem[];
    active: number;
    top: number;
    left: number;
    /** 被替换区间起点（token 的 from） */
    from: number;
  }
  const [menu, setMenu] = useState<MenuState | null>(null);
  const menuRef = useRef<MenuState | null>(null);
  menuRef.current = menu;
  const closeMenu = () => setMenu(null);

  // ── AI 幽灵文本续写 ──────────────────────────────────────────
  const [ghost, setGhost] = useState<string>("");
  const ghostRefVal = useRef<string>("");
  ghostRefVal.current = ghost;
  const aiTimer = useRef<number | null>(null);
  const aiSeq = useRef(0);
  const dismissGhost = () => {
    if (ghostRefVal.current) setGhost("");
  };

  // 历史词 / 标签语料库（随笔记变化重建）
  const corpus = useMemo(() => buildCorpus(notes), [notes]);

  // 新建笔记时，光标落在标题处并选中默认标题，便于直接覆盖输入
  useEffect(() => {
    if (autoFocusTitle) {
      titleRef.current?.focus();
      titleRef.current?.select();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 工具栏插入文本后，正文更新完毕再恢复光标/选区
  useEffect(() => {
    if (pendingSel.current && textareaRef.current) {
      const [s, e] = pendingSel.current;
      pendingSel.current = null;
      const ta = textareaRef.current;
      ta.focus();
      ta.setSelectionRange(s, e);
    }
  }, [note.body]);

  /** 基于当前选区改写正文，并记录新选区 */
  const edit = (
    fn: (s: { value: string; start: number; end: number }) => {
      value: string;
      start: number;
      end: number;
    },
  ) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const r = fn({
      value: note.body,
      start: ta.selectionStart,
      end: ta.selectionEnd,
    });
    pendingSel.current = [r.start, r.end];
    onChange({ body: r.value });
  };

  /** 用 before/after 包裹选区；无选区则插入占位符并选中 */
  const wrap = (before: string, after: string, placeholder: string) =>
    edit(({ value, start, end }) => {
      const sel = value.slice(start, end) || placeholder;
      const value2 =
        value.slice(0, start) + before + sel + after + value.slice(end);
      const s = start + before.length;
      return { value: value2, start: s, end: s + sel.length };
    });

  /** 给选区涉及的每一行加前缀（列表 / 待办 / 引用 / 标题） */
  const linePrefix = (make: (i: number) => string) =>
    edit(({ value, start, end }) => {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      let lineEnd = value.indexOf("\n", end);
      if (lineEnd === -1) lineEnd = value.length;
      const block = value.slice(lineStart, lineEnd);
      const newBlock = block
        .split("\n")
        .map((ln, i) => make(i) + ln)
        .join("\n");
      const value2 = value.slice(0, lineStart) + newBlock + value.slice(lineEnd);
      return { value: value2, start: lineStart, end: lineStart + newBlock.length };
    });

  /** 在光标处另起一块插入片段，返回光标落点（相对片段末尾的偏移） */
  const insertBlock = (snippet: string, caretBack = 0) =>
    edit(({ value, start }) => {
      const atLineStart = start === 0 || value[start - 1] === "\n";
      const text = (atLineStart ? "" : "\n") + snippet;
      const value2 = value.slice(0, start) + text + value.slice(start);
      const pos = start + text.length - caretBack;
      return { value: value2, start: pos, end: pos };
    });

  const TABLE_SNIPPET =
    "| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n|  |  |  |\n";

  // ── 补全菜单：定位、检测、采纳 ───────────────────────────────
  /** 在 token 起点处、下一行位置弹出菜单 */
  const openMenuAt = (items: MenuItem[], from: number, _caret: number) => {
    const ta = textareaRef.current;
    if (!ta || items.length === 0) {
      closeMenu();
      return;
    }
    const c = getCaretCoordinates(ta, from);
    const rect = ta.getBoundingClientRect();
    setMenu({
      items,
      active: 0,
      from,
      left: rect.left + c.left - ta.scrollLeft,
      top: rect.top + c.top - ta.scrollTop + c.height + 4,
    });
  };

  /** 根据光标左侧 token 刷新补全菜单（斜杠 / 标签 / 历史词） */
  const refreshMenu = (value: string, caret: number) => {
    const tok = detectToken(value, caret);
    if (!tok) {
      closeMenu();
      return;
    }
    if (tok.kind === "slash" && ac.slash) {
      const cmds = filterSlash(tok.token);
      openMenuAt(
        cmds.map((c) => ({ label: c.title, sub: c.key, cmd: c })),
        tok.from,
        caret,
      );
      return;
    }
    if (tok.kind === "tag" && ac.words) {
      const tags = matchTags(corpus.tags, tok.token);
      openMenuAt(
        tags.map((t) => ({ label: "#" + t, replace: "#" + t })),
        tok.from,
        caret,
      );
      return;
    }
    if (tok.kind === "word" && ac.words) {
      const ph = matchPhrases(corpus.phrases, tok.token);
      openMenuAt(
        ph.map((p) => ({ label: p, replace: p })),
        tok.from,
        caret,
      );
      return;
    }
    closeMenu();
  };

  /** 采纳斜杠命令：删掉 /token 并插入对应块/前缀 */
  const applySlash = (cmd: SlashCmd, from: number) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const caret = ta.selectionStart;
    const value = note.body;
    const before = value.slice(0, from);
    const after = value.slice(caret);
    let insert = cmd.text;
    const atLineStart = from === 0 || before.endsWith("\n");
    if (cmd.block && !atLineStart) insert = "\n" + insert;
    const pos = before.length + insert.length - (cmd.caretBack ?? 0);
    pendingSel.current = [pos, pos];
    closeMenu();
    onChange({ body: before + insert + after });
  };

  /** 采纳词/标签：用所选文本替换 token */
  const applyWord = (replace: string, from: number) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const caret = ta.selectionStart;
    const value = note.body;
    const pos = from + replace.length;
    pendingSel.current = [pos, pos];
    closeMenu();
    onChange({ body: value.slice(0, from) + replace + value.slice(caret) });
  };

  const acceptMenuItem = (item: MenuItem, from: number) => {
    if (item.cmd) applySlash(item.cmd, from);
    else if (item.replace !== undefined) applyWord(item.replace, from);
  };

  // ── AI 幽灵文本续写 ──────────────────────────────────────────
  /** 光标在文末且启用后，防抖调用 DeepSeek 生成续写 */
  const scheduleAI = (value: string, caret: number) => {
    if (aiTimer.current) {
      clearTimeout(aiTimer.current);
      aiTimer.current = null;
    }
    dismissGhost();
    if (!ac.ai || !settings.deepseekApiKey) return;
    if (caret !== value.length) return; // 仅在文末续写，避免与后文重叠
    const text = value.trimEnd();
    if (text.length < 2) return;
    const seq = ++aiSeq.current;
    aiTimer.current = window.setTimeout(() => {
      void (async () => {
        try {
          const out = await deepseekChat(
            settings.deepseekApiKey,
            settings.deepseekModel,
            [
              {
                role: "system",
                content:
                  "你是中文笔记续写助手。根据用户已写的内容，自然地续写紧接着的一小段（约 10-40 字），保持相同语言与语气。只输出续写文字本身，不要重复已有内容，不要加引号或说明。",
              },
              { role: "user", content: text.slice(-1500) },
            ],
          );
          const ta = textareaRef.current;
          // 结果过期（用户又改动 / 移动了光标）或补全菜单已打开则丢弃
          if (seq !== aiSeq.current || !ta || menuRef.current) return;
          if (ta.value !== value || ta.selectionStart !== value.length) return;
          const clean = out.trim().replace(/^["「『]+|["」』]+$/g, "");
          if (clean) setGhost(clean);
        } catch {
          // 续写为增强项，失败静默处理，不打扰书写
        }
      })();
    }, 700);
  };

  /** 采纳幽灵文本：追加到文末 */
  const acceptGhost = () => {
    const g = ghostRefVal.current;
    if (!g) return;
    const value2 = note.body + g;
    const pos = value2.length;
    pendingSel.current = [pos, pos];
    setGhost("");
    onChange({ body: value2 });
  };

  // 幽灵层与 textarea 滚动对齐
  useEffect(() => {
    if (ghost && ghostRef.current && textareaRef.current) {
      ghostRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, [ghost]);

  // 卸载（切换笔记）时清掉未触发的续写定时器
  useEffect(
    () => () => {
      if (aiTimer.current) clearTimeout(aiTimer.current);
    },
    [],
  );

  /** textarea 内容变化：提交 + 刷新补全 + 安排续写（组字中先跳过） */
  const onBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const caret = e.target.selectionStart;
    onChange({ body: value });
    if ((e.nativeEvent as InputEvent).isComposing) return;
    refreshMenu(value, caret);
    scheduleAI(value, caret);
  };

  /** 输入法组字结束后再触发补全（此时 CJK 词已定型） */
  const onCompositionEndBody = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    refreshMenu(ta.value, ta.selectionStart);
    scheduleAI(ta.value, ta.selectionStart);
  };

  // Tab/Shift+Tab 控制缩进；回车在列表行自动续项、空项退出
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 补全菜单打开时：方向键/回车/Tab/Esc 优先操作菜单
    const m = menuRef.current;
    if (m && m.items.length && !e.nativeEvent.isComposing) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMenu({ ...m, active: (m.active + 1) % m.items.length });
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMenu({ ...m, active: (m.active - 1 + m.items.length) % m.items.length });
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        acceptMenuItem(m.items[m.active], m.from);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closeMenu();
        return;
      }
    }

    // 幽灵文本：Tab 采纳、Esc 忽略；其它按键先撤下（若为输入会重新触发续写）
    if (ghostRefVal.current && !e.nativeEvent.isComposing) {
      if (e.key === "Tab") {
        e.preventDefault();
        acceptGhost();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        dismissGhost();
        return;
      }
      dismissGhost();
    }

    // Markdown 符号自动闭合 / 包裹选区
    if (
      ac.pairs &&
      !e.nativeEvent.isComposing &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey
    ) {
      const ta = textareaRef.current;
      if (ta) {
        const key = e.key;
        const hasSel = ta.selectionStart !== ta.selectionEnd;
        const value = note.body;
        const pos = ta.selectionStart;
        // 有选中 + 可包裹符号 → 在两侧加符号
        if (hasSel && WRAP_CHARS[key]) {
          e.preventDefault();
          const [b, a] = WRAP_CHARS[key];
          wrap(b, a, "");
          return;
        }
        // 越过：键入的闭合符正好等于光标右侧字符 → 光标右移一位
        const closers = new Set([")", "]", "}", "`", '"']);
        if (!hasSel && closers.has(key) && value[pos] === key) {
          e.preventDefault();
          ta.setSelectionRange(pos + 1, pos + 1);
          return;
        }
        // 成对左符 → 补右符并把光标放中间
        if (!hasSel && PAIRS[key]) {
          e.preventDefault();
          pendingSel.current = [pos + 1, pos + 1];
          onChange({
            body: value.slice(0, pos) + key + PAIRS[key] + value.slice(pos),
          });
          return;
        }
      }
    }

    // Tab / Shift+Tab：对当前行或选中的多行整体缩进 / 反缩进（2 空格一级）
    if (e.key === "Tab" && !e.nativeEvent.isComposing) {
      const ta = textareaRef.current;
      if (!ta) return;
      e.preventDefault();
      const value = note.body;
      const selStart = ta.selectionStart;
      const selEnd = ta.selectionEnd;
      const blockStart = value.lastIndexOf("\n", selStart - 1) + 1;
      let blockEnd = value.indexOf("\n", selEnd);
      if (blockEnd === -1) blockEnd = value.length;
      const lines = value.slice(blockStart, blockEnd).split("\n");
      // 一级 4 空格：能对齐到有序列表 `1. `(3 列宽)之下，单个 Tab 即可嵌套
      const UNIT = "    ";
      let newBlock: string;
      let ds: number;
      let dTotal: number;
      if (e.shiftKey) {
        let first = 0;
        let total = 0;
        const out = lines.map((ln, i) => {
          const r = /^ {1,4}/.exec(ln)?.[0].length ?? 0;
          if (i === 0) first = r;
          total += r;
          return ln.slice(r);
        });
        newBlock = out.join("\n");
        ds = -first;
        dTotal = -total;
      } else {
        newBlock = lines.map((ln) => UNIT + ln).join("\n");
        ds = UNIT.length;
        dTotal = UNIT.length * lines.length;
      }
      const value2 =
        value.slice(0, blockStart) + newBlock + value.slice(blockEnd);
      const ns = Math.max(blockStart, selStart + ds);
      const ne = Math.max(ns, selEnd + dTotal);
      pendingSel.current = [ns, ne];
      onChange({ body: value2 });
      return;
    }
    // Backspace：光标停在空列表项的标记后，一次删掉整个标记（序号 / 圆点 / 勾选框），而非逐字删
    if (e.key === "Backspace" && !e.nativeEvent.isComposing) {
      const ta = textareaRef.current;
      if (!ta || ta.selectionStart !== ta.selectionEnd) return; // 有选区交给默认删除
      const pos = ta.selectionStart;
      const value = note.body;
      // 空配对内退格：光标夹在自动补全的左右符之间 → 一起删掉
      if (ac.pairs && pos > 0 && PAIRS[value[pos - 1]] === value[pos]) {
        e.preventDefault();
        pendingSel.current = [pos - 1, pos - 1];
        onChange({ body: value.slice(0, pos - 1) + value.slice(pos + 1) });
        return;
      }
      const lineStart = value.lastIndexOf("\n", pos - 1) + 1;
      let lineEnd = value.indexOf("\n", pos);
      if (lineEnd === -1) lineEnd = value.length;
      const line = value.slice(lineStart, lineEnd);
      const task = /^(\s*)([-*+])[ \t]+\[[ xX]\][ \t]+/.exec(line);
      const ol = /^(\s*)(\d+)([.)])[ \t]+/.exec(line);
      const ul = /^(\s*)([-*+])[ \t]+/.exec(line);
      const full = (task ?? ol ?? ul)?.[0] ?? null;
      // 仅当光标恰在标记末尾、且该项无正文时触发；否则交给默认逐字删除
      if (
        full !== null &&
        pos === lineStart + full.length &&
        line.slice(full.length).trim() === ""
      ) {
        e.preventDefault();
        const value2 = value.slice(0, lineStart) + value.slice(lineStart + full.length);
        pendingSel.current = [lineStart, lineStart];
        onChange({ body: value2 });
      }
      return;
    }
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    const ta = textareaRef.current;
    if (!ta || ta.selectionStart !== ta.selectionEnd) return;
    const pos = ta.selectionStart;
    const value = note.body;
    const lineStart = value.lastIndexOf("\n", pos - 1) + 1;
    let lineEnd = value.indexOf("\n", pos);
    if (lineEnd === -1) lineEnd = value.length;
    const line = value.slice(lineStart, lineEnd);

    const task = /^(\s*)([-*+])[ \t]+\[[ xX]\][ \t]+/.exec(line);
    const ol = /^(\s*)(\d+)([.)])[ \t]+/.exec(line);
    const ul = /^(\s*)([-*+])[ \t]+/.exec(line);

    let full: string | null = null;
    let marker = "";
    if (task) {
      full = task[0];
      marker = `${task[1]}${task[2]} [ ] `;
    } else if (ol) {
      full = ol[0];
      marker = `${ol[1]}${Number(ol[2]) + 1}${ol[3]} `;
    } else if (ul) {
      full = ul[0];
      marker = `${ul[1]}${ul[2]} `;
    }
    if (full === null) return; // 非列表行，交给默认换行

    e.preventDefault();
    const contentEmpty = line.slice(full.length).trim() === "";
    let value2: string;
    let caret: number;
    if (contentEmpty) {
      // 空列表项：删掉标记，退出列表
      value2 = value.slice(0, lineStart) + value.slice(lineEnd);
      caret = lineStart;
    } else {
      const insert = "\n" + marker;
      value2 = value.slice(0, pos) + insert + value.slice(pos);
      caret = pos + insert.length;
    }
    pendingSel.current = [caret, caret];
    onChange({ body: value2 });
  };

  type Tool = { icon: ComponentType<{ size?: number }>; title: string; run: () => void };
  const tools: (Tool | "divider")[] = [
    { icon: Heading2, title: "标题", run: () => linePrefix(() => "## ") },
    { icon: Bold, title: "加粗", run: () => wrap("**", "**", "粗体") },
    { icon: Italic, title: "斜体", run: () => wrap("*", "*", "斜体") },
    {
      icon: Strikethrough,
      title: "删除线",
      run: () => wrap("~~", "~~", "删除线"),
    },
    "divider",
    { icon: Code, title: "行内代码", run: () => wrap("`", "`", "代码") },
    {
      icon: SquareCode,
      title: "代码块",
      run: () => insertBlock("```\n\n```\n", 5),
    },
    { icon: TextQuote, title: "引用", run: () => linePrefix(() => "> ") },
    "divider",
    { icon: List, title: "无序列表", run: () => linePrefix(() => "- ") },
    {
      icon: ListOrdered,
      title: "有序列表",
      run: () => linePrefix((i) => `${i + 1}. `),
    },
    { icon: ListTodo, title: "待办清单", run: () => linePrefix(() => "- [ ] ") },
    "divider",
    { icon: Link2, title: "链接", run: () => wrap("[", "](url)", "链接文字") },
    {
      icon: ImageIcon,
      title: "图片",
      run: () => wrap("![", "](url)", "图片描述"),
    },
    { icon: Table, title: "表格", run: () => insertBlock(TABLE_SNIPPET) },
    { icon: Minus, title: "分割线", run: () => insertBlock("---\n") },
  ];

  const headings = useMemo(() => parseHeadings(note.body), [note.body]);

  /** 点击大纲：预览可见则滚动预览，否则滚动 textarea 到对应行 */
  const gotoHeading = (h: Heading) => {
    const previewVisible = viewMode === "split" || singlePane === "preview";
    if (previewVisible) {
      const container = previewRef.current;
      const el = container?.querySelector<HTMLElement>(`#md-h-${h.index}`);
      if (container && el) {
        container.scrollTop +=
          el.getBoundingClientRect().top -
          container.getBoundingClientRect().top;
      }
    } else {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        ta.setSelectionRange(h.offset, h.offset);
        const cs = getComputedStyle(ta);
        const lh = parseFloat(cs.lineHeight) || 22;
        const pad = parseFloat(cs.paddingTop) || 0;
        ta.scrollTop = Math.max(0, pad + h.line * lh - 8);
      }
    }
  };

  const seg = (active: boolean) =>
    [
      "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition-colors",
      active
        ? "bg-surface text-ink shadow-sm"
        : "text-ink-soft hover:text-ink",
    ].join(" ");

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* 视图切换：双页（边写边预览）/ 单页（写↔预览），居中 */}
      <div
        {...dragRegion}
        className="relative flex shrink-0 items-center justify-center gap-2 border-b border-mint-100 px-6 py-2"
      >
        <div className="flex items-center gap-0.5 rounded-xl bg-mint-50 p-0.5">
          <button
            onClick={() => setNoteView({ mode: "split" })}
            className={seg(viewMode === "split")}
            title="双页：边写边预览"
          >
            <Columns2 size={14} />
            双页
          </button>
          <button
            onClick={() => setNoteView({ mode: "single" })}
            className={seg(viewMode === "single")}
            title="单页"
          >
            <Square size={14} />
            单页
          </button>
        </div>

        {/* 大纲（标题列表）开关，靠右 */}
        <button
          onClick={() => setNoteView({ outline: !showOutline })}
          className={[
            "absolute right-4 flex items-center justify-center rounded-lg p-1.5 transition-colors",
            showOutline
              ? "bg-mint-50 text-mint-500"
              : "text-ink-soft hover:text-ink",
          ].join(" ")}
          title={showOutline ? "隐藏大纲" : "显示大纲"}
        >
          <ListTree size={16} />
        </button>
      </div>

      {/* Markdown 快捷工具栏（格式按钮居中；单页态右侧放预览/编辑切换） */}
      {(viewMode === "split" || viewMode === "single") && (
        <div className="flex h-11 shrink-0 items-center border-b border-mint-100 px-4">
          {/* 左侧固定槽位，与右侧等宽，保证中间格式按钮中线恒定不抖 */}
          <div className="w-9 shrink-0" />

          {/* 中间：格式按钮，真居中且可横向滚动；仅书写区可见时显示 */}
          <div className="flex min-w-0 flex-1 items-center justify-center gap-0.5 overflow-x-auto">
            {(viewMode === "split" || singlePane === "write") &&
              tools.map((t, i) =>
                t === "divider" ? (
                  <span key={i} className="mx-1 h-4 w-px shrink-0 bg-mint-100" />
                ) : (
                  <button
                    key={i}
                    onClick={t.run}
                    title={t.title}
                    className="flex shrink-0 items-center justify-center rounded-lg p-1.5 text-ink-soft transition-colors hover:bg-mint-50 hover:text-ink"
                  >
                    <t.icon size={16} />
                  </button>
                ),
              )}
          </div>

          {/* 右侧固定槽位：单页态放预览/编辑切换（仅图标） */}
          <div className="flex w-9 shrink-0 justify-end">
            {viewMode === "single" && (
              <button
                onClick={() =>
                  setNoteView({
                    pane: singlePane === "write" ? "preview" : "write",
                  })
                }
                className="flex items-center justify-center rounded-lg border border-mint-100 p-1.5 text-ink-soft transition-colors hover:border-mint-300 hover:text-ink"
                title={singlePane === "write" ? "预览" : "编辑"}
              >
                {singlePane === "write" ? (
                  <BookSearch size={16} />
                ) : (
                  <Pencil size={16} />
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 标题栏 */}
      <div className="flex shrink-0 items-center gap-3 border-b border-mint-100 px-6 py-3">
        <input
          ref={titleRef}
          value={note.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="无标题"
          className="flex-1 bg-transparent text-lg font-semibold text-ink outline-none placeholder:text-ink-soft/40"
        />
        <button
          onClick={onExport}
          className="rounded-lg p-2 text-ink-soft transition-colors hover:bg-mint-400/20 hover:text-mint-600"
          title="导出为 .md"
        >
          <Download size={17} />
        </button>
        <button
          onClick={onDelete}
          className="rounded-lg p-2 text-ink-soft transition-colors hover:bg-red-400/20 hover:text-red-600"
          title="删除笔记"
        >
          <Trash2 size={17} />
        </button>
      </div>

      {/* 内容区：编辑面板 + 大纲 */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* 编辑面板：双页并排 / 单页（写或预览） */}
        <div className="flex flex-1 overflow-hidden">
          {(viewMode === "split" || singlePane === "write") && (
            <div
              className={[
                "relative h-full bg-surface",
                viewMode === "split"
                  ? "w-1/2 border-r border-mint-100"
                  : "w-full",
              ].join(" ")}
            >
              {/* AI 续写幽灵层：与 textarea 同排版，正文透明、仅显示灰色续写 */}
              {ghost && (
                <div
                  ref={ghostRef}
                  aria-hidden
                  className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words p-6 font-mono text-sm leading-relaxed text-transparent"
                >
                  {note.body}
                  <span className="text-ink-soft/50">{ghost}</span>
                </div>
              )}
              <textarea
                ref={textareaRef}
                value={note.body}
                onChange={onBodyChange}
                onKeyDown={handleKeyDown}
                onCompositionEnd={onCompositionEndBody}
                onScroll={(e) => {
                  if (ghostRef.current)
                    ghostRef.current.scrollTop = e.currentTarget.scrollTop;
                }}
                onClick={() => {
                  closeMenu();
                  dismissGhost();
                }}
                onBlur={() => {
                  // 延迟关闭，留出点击菜单项的时间
                  window.setTimeout(closeMenu, 150);
                  dismissGhost();
                }}
                placeholder="在此用 Markdown 书写…"
                spellCheck={false}
                className="relative h-full w-full resize-none bg-transparent p-6 font-mono text-sm leading-relaxed text-ink outline-none placeholder:text-ink-soft/40"
                style={{ userSelect: "text" }}
              />
            </div>
          )}
          {(viewMode === "split" || singlePane === "preview") && (
            <div
              ref={previewRef}
              className={[
                "h-full overflow-y-auto bg-paper p-6",
                viewMode === "split" ? "w-1/2" : "w-full",
              ].join(" ")}
            >
              {note.body.trim() ? (
                <Markdown>{note.body}</Markdown>
              ) : (
                <p className="text-sm text-ink-soft/50">预览区</p>
              )}
            </div>
          )}
        </div>

        {/* 大纲（标题列表） */}
        {showOutline && (
          <aside className="flex w-56 shrink-0 flex-col border-l border-mint-100 bg-surface">
            <div className="px-4 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-ink-soft/70">
              大纲
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-3">
              {headings.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-ink-soft/60">
                  暂无标题
                </p>
              ) : (
                headings.map((h) => (
                  <button
                    key={h.index}
                    onClick={() => gotoHeading(h)}
                    title={h.text}
                    style={{ paddingLeft: 8 + (h.level - 1) * 12 }}
                    className="block w-full truncate rounded-lg py-1 pr-2 text-left text-xs text-ink-soft transition-colors hover:bg-mint-50 hover:text-ink"
                  >
                    {h.text}
                  </button>
                ))
              )}
            </div>
          </aside>
        )}
      </div>

      {/* 补全下拉菜单（斜杠命令 / 标签 / 历史词）：定位在光标处 */}
      {menu && menu.items.length > 0 && (
        <div
          className="fixed z-50 max-h-64 w-56 overflow-y-auto rounded-xl border border-mint-100 bg-surface p-1 shadow-lg shadow-black/10"
          style={{ top: menu.top, left: menu.left }}
          // 防止点击菜单项时 textarea 失焦，保持选区
          onMouseDown={(e) => e.preventDefault()}
        >
          {menu.items.map((it, i) => (
            <button
              key={i}
              onClick={() => acceptMenuItem(it, menu.from)}
              onMouseEnter={() => setMenu((s) => (s ? { ...s, active: i } : s))}
              className={[
                "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
                i === menu.active
                  ? "bg-mint-50 text-ink"
                  : "text-ink-soft hover:bg-mint-50/60",
              ].join(" ")}
            >
              <span className="truncate">{it.label}</span>
              {it.sub && (
                <span className="shrink-0 text-[11px] text-ink-soft/50">
                  /{it.sub}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
