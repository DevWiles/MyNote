import { useMemo, useState } from "react";
import {
  CheckSquare,
  Plus,
  Trash2,
  Pencil,
  CalendarClock,
  ChevronRight,
  ListTree,
  X,
  ArrowUpRight,
  ArrowDownRight,
  CornerDownRight,
  Undo2,
} from "lucide-react";
import { useStore } from "../store/useStore";
import type { Task, Priority, PlanLevel } from "../types";
import { fmtDate, isOverdue, toDateInput, fromDateInput } from "../lib/date";
import { LEVEL_LABEL, LEVEL_RANK, LEVEL_STYLE } from "../lib/levels";
import { Button, EmptyState, PRIORITY_META, Tag, inputClass } from "../components/ui";
import Modal from "../components/Modal";

type Filter = "all" | "upcoming" | "done";

// 按层级从低到高展示的切换器顺序
const PERIODS: { key: PlanLevel; label: string }[] = [
  { key: "day", label: "日" },
  { key: "week", label: "周" },
  { key: "month", label: "月" },
  { key: "year", label: "年" },
];

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "upcoming", label: "即将到期" },
  { key: "done", label: "已完成" },
];

/** 比给定层级更低的层级（高→低），如 year → [month, week, day] */
const lowerLevels = (lvl: PlanLevel): PlanLevel[] =>
  (["year", "month", "week", "day"] as PlanLevel[]).filter(
    (l) => LEVEL_RANK[l] < LEVEL_RANK[lvl],
  );

/** 下放弹窗的入参 */
type DemoteTarget = { parent: Task; subId?: string; subTitle?: string };

export default function TodoView() {
  const { tasks, addTask, toggleTask, deleteTask } = useStore();
  const [level, setLevel] = useState<PlanLevel>("day");
  const [filter, setFilter] = useState<Filter>("all");
  const [quick, setQuick] = useState("");
  const [editing, setEditing] = useState<Task | null>(null);
  const [demote, setDemote] = useState<DemoteTarget | null>(null);

  // 三标签都只在「当前层级」内筛选
  const lists = useMemo(() => {
    const atLevel = tasks.filter((t) => (t.level ?? "day") === level);
    const dueMs = (t: Task) => (t.dueAt ? new Date(t.dueAt).getTime() : null);
    const byDue = (a: Task, b: Task) =>
      (dueMs(a) ?? Infinity) - (dueMs(b) ?? Infinity);

    const all = atLevel.filter((t) => !t.done).sort(byDue);
    const upcoming = atLevel.filter((t) => !t.done && t.dueAt).sort(byDue);
    const done = atLevel
      .filter((t) => t.done)
      .sort(
        (a, b) =>
          new Date(b.completedAt ?? 0).getTime() -
          new Date(a.completedAt ?? 0).getTime(),
      );

    return { all, upcoming, done } as Record<Filter, Task[]>;
  }, [tasks, level]);

  const filtered = lists[filter];

  // 切换层级时统一回到「全部」，确保跳过去能看到目标
  const goLevel = (lvl: PlanLevel) => {
    setLevel(lvl);
    setFilter("all");
  };

  const submitQuick = () => {
    const title = quick.trim();
    if (!title) return;
    addTask({ title, level }); // 新建在当前层级
    setQuick("");
    if (filter !== "all") setFilter("all");
  };

  return (
    <div className="relative flex h-full flex-col">
      <header className="border-b border-mint-100 px-8 pt-5">
        <div className="relative mb-4 flex items-center">
          <div className="flex items-center gap-3">
            <CheckSquare size={22} className="text-mint-500" strokeWidth={2.2} />
            <h1 className="text-xl font-semibold text-ink">待办</h1>
          </div>
          {/* 规划层级：日/周/月/年（页面水平居中） */}
          <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-xl bg-mint-50 p-1">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => goLevel(p.key)}
                className={[
                  "rounded-lg px-3 py-1 text-sm font-medium transition-colors",
                  level === p.key
                    ? "bg-surface text-mint-600 shadow-sm"
                    : "text-ink-soft hover:text-ink",
                ].join(" ")}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
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
              {filter === f.key && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-mint-400" />
              )}
            </button>
          ))}
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
            placeholder={`在「${LEVEL_LABEL[level]}」规划速记一条，回车添加…`}
            className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft/50"
          />
        </div>
      </div>

      {/* 列表 */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-8 py-5">
        {filtered.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            text={`「${LEVEL_LABEL[level]}」规划这里还没有待办，添加一条试试。`}
          />
        ) : (
          filtered.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              onToggle={() => toggleTask(t.id)}
              onEdit={() => setEditing(t)}
              onDelete={() => deleteTask(t.id)}
              onNavigate={goLevel}
              onDemote={setDemote}
            />
          ))
        )}
      </div>

      {/* 数量角标：固定右下角，避免内联计数推动标签抖动 */}
      {filtered.length > 0 && (
        <div className="pointer-events-none absolute bottom-5 right-7 rounded-full border border-mint-100 bg-surface/90 px-3 py-1 text-xs font-medium text-ink-soft shadow-sm backdrop-blur">
          共 {filtered.length} 项
        </div>
      )}

      {editing && <TaskEditor task={editing} onClose={() => setEditing(null)} />}
      {demote && (
        <DemoteModal
          target={demote}
          onClose={() => setDemote(null)}
          onDone={goLevel}
        />
      )}
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
  onEdit,
  onDelete,
  onNavigate,
  onDemote,
}: {
  task: Task;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onNavigate: (lvl: PlanLevel) => void;
  onDemote: (t: DemoteTarget) => void;
}) {
  const tasks = useStore((s) => s.tasks);
  const { addSubtask, toggleSubtask, deleteSubtask, recallChild } = useStore();
  const subtasks = task.subtasks ?? [];
  const doneCount = subtasks.filter((s) => s.done).length;
  const allDone = subtasks.length > 0 && doneCount === subtasks.length;

  const parent = task.parentId ? tasks.find((t) => t.id === task.parentId) : null;
  const children = tasks.filter((t) => t.parentId === task.id);
  const childLevels = [...new Set(children.map((c) => LEVEL_LABEL[c.level]))].join("·");
  const canDemote = lowerLevels(task.level).length > 0;

  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState("");

  const p = PRIORITY_META[task.priority];
  const overdue = task.dueAt && !task.done && isOverdue(task.dueAt);

  const submitSub = () => {
    const title = draft.trim();
    if (!title) return;
    addSubtask(task.id, title);
    setDraft("");
  };

  return (
    <div className="rounded-xl border border-transparent bg-surface transition-colors hover:border-mint-100">
      <div className="group flex items-center gap-2 px-4 py-3">
        <button
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? "收起子待办" : "展开子待办"}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-ink-soft/50 transition-colors hover:bg-mint-50 hover:text-ink-soft"
        >
          <ChevronRight
            size={15}
            className={`transition-transform ${expanded ? "rotate-90" : ""}`}
          />
        </button>

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
            className={[
              "truncate text-sm",
              task.done
                ? "text-mint-600 line-through"
                : overdue
                  ? "text-red-500"
                  : "text-ink",
            ].join(" ")}
          >
            {task.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
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
            {/* 所属上层规划（可越级） */}
            {parent && (
              <button
                onClick={() => onNavigate(parent.level)}
                title="跳到所属规划"
                style={{
                  backgroundColor: LEVEL_STYLE[parent.level].badgeBg,
                  color: LEVEL_STYLE[parent.level].badgeText,
                }}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-80"
              >
                <ArrowUpRight size={12} />
                所属 {parent.title} · {LEVEL_LABEL[parent.level]}
              </button>
            )}
            {/* 已下放的子规划 */}
            {children.length > 0 && (
              <button
                onClick={() => onNavigate(children[0].level)}
                title="跳到已下放的子规划"
                className="flex items-center gap-1 rounded-md border border-mint-100 bg-surface px-1.5 py-0.5 text-xs font-medium text-ink-soft transition-colors hover:text-ink"
              >
                <ArrowDownRight size={12} />
                已下放 {children.length} · 到 {childLevels}
              </button>
            )}
            {subtasks.length > 0 && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className={`flex items-center gap-1 text-xs ${
                  allDone ? "text-mint-600" : "text-ink-soft"
                }`}
                title="子待办进度"
              >
                <ListTree size={12} />
                {doneCount}/{subtasks.length}
              </button>
            )}
            {task.tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {canDemote && (
            <button
              onClick={() => onDemote({ parent: task })}
              title="下放为更低层级的子规划"
              className="rounded-lg p-1.5 text-ink-soft hover:bg-mint-50 hover:text-mint-600"
            >
              <CornerDownRight size={15} />
            </button>
          )}
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

      {expanded && (
        <div className="mb-2 ml-9 mr-4 flex flex-col gap-1 border-l border-mint-100 pl-3">
          {/* 已下放/越级的子规划：即便降级也能在此看到，并可撤回 */}
          {children.length > 0 && (
            <div className="mb-1 flex flex-col gap-1">
              <p className="text-[11px] font-medium text-ink-soft/70">
                已下放的子规划
              </p>
              {children.map((c) => {
                return (
                  <div
                    key={c.id}
                    className="group/ch flex items-center gap-2 py-0.5"
                  >
                    <CornerDownRight size={13} className="shrink-0 text-mint-400" />
                    <span
                      style={{
                        backgroundColor: LEVEL_STYLE[c.level].badgeBg,
                        color: LEVEL_STYLE[c.level].badgeText,
                      }}
                      className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold"
                    >
                      {LEVEL_LABEL[c.level]}
                    </span>
                    <button
                      onClick={() => onNavigate(c.level)}
                      title="跳到该子规划所在层级"
                      className={`min-w-0 flex-1 truncate text-left text-sm hover:text-mint-600 ${
                        c.done ? "text-ink-soft line-through" : "text-ink"
                      }`}
                    >
                      {c.title}
                    </button>
                    <button
                      onClick={() => recallChild(c.id)}
                      title="撤回到本规划（变回子待办）"
                      className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs text-ink-soft opacity-0 transition-opacity hover:bg-mint-50 hover:text-mint-600 group-hover/ch:opacity-100"
                    >
                      <Undo2 size={12} />
                      撤回
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {subtasks.map((sub) => (
            <div key={sub.id} className="group/sub flex items-center gap-2 py-0.5">
              <button
                onClick={() => toggleSubtask(task.id, sub.id)}
                className={[
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors",
                  sub.done
                    ? "border-mint-400 bg-mint-400 text-white"
                    : "border-mint-200 hover:border-mint-400",
                ].join(" ")}
              >
                {sub.done && <CheckSquare size={10} strokeWidth={3} />}
              </button>
              <span
                className={`min-w-0 flex-1 truncate text-sm ${
                  sub.done ? "text-ink-soft line-through" : "text-ink"
                }`}
              >
                {sub.title}
              </span>
              {canDemote && (
                <button
                  onClick={() =>
                    onDemote({ parent: task, subId: sub.id, subTitle: sub.title })
                  }
                  title="把这条子待办提为独立规划"
                  className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs text-ink-soft opacity-0 transition-opacity hover:bg-mint-50 hover:text-mint-600 group-hover/sub:opacity-100"
                >
                  <CornerDownRight size={12} />
                  提为规划
                </button>
              )}
              <button
                onClick={() => deleteSubtask(task.id, sub.id)}
                className="rounded p-1 text-ink-soft opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover/sub:opacity-100"
              >
                <X size={13} />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2 py-0.5">
            <Plus size={14} className="shrink-0 text-mint-400" />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitSub()}
              placeholder="加一条子待办，回车添加…"
              className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft/40"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function DemoteModal({
  target,
  onClose,
  onDone,
}: {
  target: DemoteTarget;
  onClose: () => void;
  onDone: (lvl: PlanLevel) => void;
}) {
  const { addTask, promoteSubtask } = useStore();
  const { parent, subId, subTitle } = target;
  const targets = lowerLevels(parent.level);
  const isPromote = !!subId;

  const [title, setTitle] = useState(subTitle ?? "");
  const [level, setLevel] = useState<PlanLevel>(targets[0]);

  const save = () => {
    if (isPromote && subId) {
      promoteSubtask(parent.id, subId, level); // 用子待办原标题
    } else {
      const t = title.trim();
      if (!t) return;
      addTask({ title: t, level, parentId: parent.id });
    }
    onDone(level);
    onClose();
  };

  return (
    <Modal
      open
      title={isPromote ? "提为子规划" : "下放为子规划"}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save}>下放</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {isPromote ? (
          <div className="rounded-xl border border-mint-100 bg-mint-50 px-3 py-2 text-sm text-ink">
            {subTitle}
          </div>
        ) : (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="子规划标题"
            className={inputClass}
          />
        )}
        <label>
          <span className="mb-1 block text-xs text-ink-soft">下放到层级</span>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as PlanLevel)}
            className={inputClass}
          >
            {targets.map((l) => (
              <option key={l} value={l}>
                {LEVEL_LABEL[l]}规划
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-ink-soft">
          将关联回「{parent.title}」（{LEVEL_LABEL[parent.level]}规划），可随时沿 ↑
          追溯。
        </p>
      </div>
    </Modal>
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
