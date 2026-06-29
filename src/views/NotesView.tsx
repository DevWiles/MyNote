import { useMemo, useState } from "react";
import { NotebookPen, Plus, Search, Trash2 } from "lucide-react";
import { useStore } from "../store/useStore";
import { fmtDate } from "../lib/date";
import { EmptyState, Tag } from "../components/ui";
import Markdown from "../components/Markdown";

export default function NotesView() {
  const { notes, addNote, updateNote, deleteNote } = useStore();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    notes[0]?.id ?? null,
  );

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

function Editor({
  note,
  onChange,
  onDelete,
}: {
  note: { id: string; title: string; body: string; tags: string[] };
  onChange: (patch: { title?: string; body?: string; tags?: string[] }) => void;
  onDelete: () => void;
}) {
  const [tagInput, setTagInput] = useState(note.tags.join(", "));

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center gap-3 border-b border-mint-100 px-6 py-3">
        <input
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

      {/* 标签 */}
      <div className="flex items-center gap-2 border-b border-mint-100 px-6 py-2">
        <input
          value={tagInput}
          onChange={(e) => {
            setTagInput(e.target.value);
            onChange({
              tags: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            });
          }}
          placeholder="标签（逗号分隔）"
          className="flex-1 bg-transparent text-xs text-ink-soft outline-none placeholder:text-ink-soft/40"
        />
        <div className="flex gap-1">
          {note.tags.map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </div>
      </div>

      {/* 分屏：左源码 右预览 */}
      <div className="flex flex-1 overflow-hidden">
        <textarea
          value={note.body}
          onChange={(e) => onChange({ body: e.target.value })}
          placeholder="在此用 Markdown 书写…"
          spellCheck={false}
          className="h-full w-1/2 resize-none border-r border-mint-100 bg-surface p-6 font-mono text-sm leading-relaxed text-ink outline-none placeholder:text-ink-soft/40"
          style={{ userSelect: "text" }}
        />
        <div className="h-full w-1/2 overflow-y-auto bg-paper p-6">
          {note.body.trim() ? (
            <Markdown>{note.body}</Markdown>
          ) : (
            <p className="text-sm text-ink-soft/50">预览区</p>
          )}
        </div>
      </div>
    </div>
  );
}
