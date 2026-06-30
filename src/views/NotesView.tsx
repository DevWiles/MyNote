import { useEffect, useMemo, useRef, useState } from "react";
import {
  Columns2,
  Eye,
  ListTree,
  NotebookPen,
  Pencil,
  Plus,
  Search,
  Square,
  Trash2,
} from "lucide-react";
import { useStore } from "../store/useStore";
import { fmtDate } from "../lib/date";
import { EmptyState } from "../components/ui";
import Markdown from "../components/Markdown";

export default function NotesView() {
  const { notes, addNote, updateNote, deleteNote } = useStore();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    notes[0]?.id ?? null,
  );
  /** 刚新建的笔记 id，用于让标题输入框自动获焦 */
  const [createdId, setCreatedId] = useState<string | null>(null);

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

  const createNote = () => {
    const id = addNote({ title: "未命名笔记", body: "" });
    setSelectedId(id);
    setCreatedId(id);
  };

  return (
    <div className="flex h-full">
      {/* 笔记列表 */}
      <div className="flex w-64 shrink-0 flex-col border-r border-mint-100">
        <div className="flex items-center gap-2 px-4 py-4">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-mint-100 bg-surface px-2.5 py-1.5 focus-within:border-mint-300">
            <Search size={15} className="text-ink-soft" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索笔记"
              className="w-full bg-transparent text-sm outline-none placeholder:text-ink-soft/50"
            />
          </div>
          <button
            onClick={createNote}
            title="新建笔记"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-mint-400 text-white transition-colors hover:bg-mint-500"
          >
            <Plus size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-ink-soft">
              {notes.length === 0 ? "还没有笔记" : "没有匹配的笔记"}
            </p>
          ) : (
            filtered.map((n) => (
              <button
                key={n.id}
                onClick={() => setSelectedId(n.id)}
                className={[
                  "mb-1 w-full rounded-xl px-3 py-2.5 text-left transition-colors",
                  n.id === selectedId
                    ? "bg-mint-50"
                    : "hover:bg-mint-50/50",
                ].join(" ")}
              >
                <p className="truncate text-sm font-medium text-ink">
                  {n.title || "未命名笔记"}
                </p>
                <p className="mt-0.5 truncate text-xs text-ink-soft">
                  {n.body.replace(/[#*`\->]/g, "").trim() || "空笔记"}
                </p>
                <p className="mt-1 text-[11px] text-ink-soft/60">
                  {fmtDate(n.updatedAt)}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* 编辑器 */}
      {selected ? (
        <Editor
          key={selected.id}
          note={selected}
          autoFocusTitle={selected.id === createdId}
          onChange={(patch) => updateNote(selected.id, patch)}
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
    </div>
  );
}

type ViewMode = "split" | "single";
type SinglePane = "write" | "preview";

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
  onDelete,
}: {
  note: { id: string; title: string; body: string };
  autoFocusTitle: boolean;
  onChange: (patch: { title?: string; body?: string }) => void;
  onDelete: () => void;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [singlePane, setSinglePane] = useState<SinglePane>("write");
  const [showOutline, setShowOutline] = useState(true);
  const titleRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // 新建笔记时，光标落在标题处并选中默认标题，便于直接覆盖输入
  useEffect(() => {
    if (autoFocusTitle) {
      titleRef.current?.focus();
      titleRef.current?.select();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <div className="relative flex items-center justify-center gap-2 border-b border-mint-100 px-6 py-2">
        <div className="flex items-center gap-0.5 rounded-xl bg-mint-50 p-0.5">
          <button
            onClick={() => setViewMode("split")}
            className={seg(viewMode === "split")}
            title="双页：边写边预览"
          >
            <Columns2 size={14} />
            双页
          </button>
          <button
            onClick={() => setViewMode("single")}
            className={seg(viewMode === "single")}
            title="单页"
          >
            <Square size={14} />
            单页
          </button>
        </div>

        {viewMode === "single" && (
          <button
            onClick={() =>
              setSinglePane((p) => (p === "write" ? "preview" : "write"))
            }
            className="flex items-center gap-1.5 rounded-lg border border-mint-100 px-2.5 py-1 text-xs text-ink-soft transition-colors hover:border-mint-300 hover:text-ink"
            title={singlePane === "write" ? "预览编译结果" : "返回编辑"}
          >
            {singlePane === "write" ? (
              <>
                <Eye size={14} />
                预览
              </>
            ) : (
              <>
                <Pencil size={14} />
                编辑
              </>
            )}
          </button>
        )}

        {/* 大纲（标题列表）开关，靠右 */}
        <button
          onClick={() => setShowOutline((v) => !v)}
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

      {/* 标题栏 */}
      <div className="flex items-center gap-3 border-b border-mint-100 px-6 py-3">
        <input
          ref={titleRef}
          value={note.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="无标题"
          className="flex-1 bg-transparent text-lg font-semibold text-ink outline-none placeholder:text-ink-soft/40"
        />
        <button
          onClick={onDelete}
          className="rounded-lg p-2 text-ink-soft transition-colors hover:bg-red-50 hover:text-red-500"
          title="删除笔记"
        >
          <Trash2 size={17} />
        </button>
      </div>

      {/* 内容区：编辑面板 + 大纲 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 编辑面板：双页并排 / 单页（写或预览） */}
        <div className="flex flex-1 overflow-hidden">
          {(viewMode === "split" || singlePane === "write") && (
            <textarea
              ref={textareaRef}
              value={note.body}
              onChange={(e) => onChange({ body: e.target.value })}
              placeholder="在此用 Markdown 书写…"
              spellCheck={false}
              className={[
                "h-full resize-none bg-surface p-6 font-mono text-sm leading-relaxed text-ink outline-none placeholder:text-ink-soft/40",
                viewMode === "split"
                  ? "w-1/2 border-r border-mint-100"
                  : "w-full",
              ].join(" ")}
              style={{ userSelect: "text" }}
            />
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
    </div>
  );
}
