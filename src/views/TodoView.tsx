import { useMemo, useState } from "react";
import {
  CheckSquare,
  Plus,
  Trash2,
  Pencil,
  CalendarClock,
} from "lucide-react";
import { useStore } from "../store/useStore";
import type { Task, Priority } from "../types";
import { fmtDate, isToday, isOverdue, toDateInput, fromDateInput } from "../lib/date";
import { Button, EmptyState, PRIORITY_META, Tag, inputClass } from "../components/ui";
import Modal from "../components/Modal";

type Filter = "today" | "upcoming" | "all" | "done";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "today", label: "今日" },
  { key: "upcoming", label: "即将到期" },
  { key: "all", label: "全部" },
  { key: "done", label: "已完成" },
];

export default function TodoView() {
  const { tasks, addTask, toggleTask, deleteTask } = useStore();
  const [filter, setFilter] = useState<Filter>("today");
  const [quick, setQuick] = useState("");
  const [editing, setEditing] = useState<Task | null>(null);

  const filtered = useMemo(() => {
    const active = tasks.filter((t) => !t.done);
    switch (filter) {
      case "today":
        return active.filter((t) => t.dueAt && (isToday(t.dueAt) || isOverdue(t.dueAt)));
      case "upcoming":
        return active.filter((t) => t.dueAt && !isToday(t.dueAt) && !isOverdue(t.dueAt));
      case "all":
        return active;
      case "done":
        return tasks.filter((t) => t.done);
    }
  }, [tasks, filter]);

  const submitQuick = () => {
    const title = quick.trim();
    if (!title) return;
    addTask({ title });
    setQuick("");
  };

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-mint-100 px-8 pt-5">
        <div className="mb-4 flex items-center gap-3">
          <CheckSquare size={22} className="text-mint-500" strokeWidth={2.2} />
          <h1 className="text-xl font-semibold text-ink">待办</h1>
        </div>
        <div className="flex gap-1">
          {FILTERS.map((f) => {
            const count =
              f.key === "done"
                ? tasks.filter((t) => t.done).length
                : undefined;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={[
                  "relative px-3 py-2 text-sm font-medium transition-colors",
                  filter === f.key
                    ? "text-mint-600"
                    : "text-ink-soft hover:text-ink",
                ].join(" ")}
              >
                {f.label}
                {count !== undefined && count > 0 && (
                  <span className="ml-1 text-xs text-ink-soft/60">{count}</span>
                )}
                {filter === f.key && (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-mint-400" />
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* 速记 */}
      <div className="px-8 pt-5">
        <div className="flex items-center gap-2 rounded-xl border border-mint-100 bg-surface px-3 py-2 focus-within:border-mint-300 focus-within:ring-2 focus-within:ring-mint-100">
          <Plus size={18} className="text-mint-400" />
          <input
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitQuick()}
            placeholder="速记一条待办，回车添加…"
            className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft/50"
          />
        </div>
      </div>

      {/* 列表 */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-8 py-5">
        {filtered.length === 0 ? (
          <EmptyState icon={CheckSquare} text="这里还没有待办，添加一条试试。" />
        ) : (
          filtered.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              onToggle={() => toggleTask(t.id)}
              onEdit={() => setEditing(t)}
              onDelete={() => deleteTask(t.id)}
            />
          ))
        )}
      </div>

      {editing && (
        <TaskEditor task={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: Task;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const p = PRIORITY_META[task.priority];
  const overdue = task.dueAt && !task.done && isOverdue(task.dueAt);
  return (
    <div className="group flex items-center gap-3 rounded-xl border border-transparent bg-surface px-4 py-3 transition-colors hover:border-mint-100">
      <button
        onClick={onToggle}
        className={[
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
          task.done
            ? "border-mint-400 bg-mint-400 text-white"
            : "border-mint-200 hover:border-mint-400",
        ].join(" ")}
      >
        {task.done && <CheckSquare size={12} strokeWidth={3} />}
      </button>

      <span className={`h-2 w-2 shrink-0 rounded-full ${p.dot}`} title={`优先级：${p.label}`} />

      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm ${
            task.done ? "text-ink-soft line-through" : "text-ink"
          }`}
        >
          {task.title}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          {task.dueAt && (
            <span
              className={`flex items-center gap-1 text-xs ${
                overdue ? "text-red-500" : "text-ink-soft"
              }`}
            >
              <CalendarClock size={12} />
              {fmtDate(task.dueAt)}
            </span>
          )}
          {task.tags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={onEdit}
          className="rounded-lg p-1.5 text-ink-soft hover:bg-mint-50 hover:text-ink"
        >
          <Pencil size={15} />
        </button>
        <button
          onClick={onDelete}
          className="rounded-lg p-1.5 text-ink-soft hover:bg-red-50 hover:text-red-500"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

function TaskEditor({ task, onClose }: { task: Task; onClose: () => void }) {
  const updateTask = useStore((s) => s.updateTask);
  const [title, setTitle] = useState(task.title);
  const [note, setNote] = useState(task.note);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [due, setDue] = useState(toDateInput(task.dueAt));
  const [tags, setTags] = useState(task.tags.join(", "));

  const save = () => {
    if (!title.trim()) return;
    updateTask(task.id, {
      title: title.trim(),
      note,
      priority,
      dueAt: fromDateInput(due),
      tags: tags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
    onClose();
  };

  return (
    <Modal
      open
      title="编辑待办"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save}>保存</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="标题"
          className={inputClass}
        />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="备注（可选）"
          rows={3}
          className={`${inputClass} resize-none`}
        />
        <div className="flex gap-3">
          <label className="flex-1">
            <span className="mb-1 block text-xs text-ink-soft">截止日期</span>
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex-1">
            <span className="mb-1 block text-xs text-ink-soft">优先级</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className={inputClass}
            >
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
          </label>
        </div>
        <label>
          <span className="mb-1 block text-xs text-ink-soft">标签（逗号分隔）</span>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="工作, 想法"
            className={inputClass}
          />
        </label>
      </div>
    </Modal>
  );
}
