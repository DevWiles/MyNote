import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Sparkles,
  Loader2,
  FileDown,
  Trash2,
  AlertCircle,
  GitBranch,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { useStore } from "../store/useStore";
import type { Report, ReportType, Task, PlanLevel } from "../types";
import { deepseekChat } from "../lib/deepseek";
import { fmtDate, fmtDateTime } from "../lib/date";
import {
  LEVEL_LABEL as LV_LABEL,
  LEVEL_RANK as LV_RANK,
  LEVEL_STYLE,
} from "../lib/levels";
import { Button, EmptyState } from "../components/ui";
import Markdown from "../components/Markdown";

const TYPE_LABEL: Record<ReportType, string> = {
  daily: "日报",
  weekly: "周报",
  monthly: "月报",
};

function rangeFor(type: ReportType): [Date, Date] {
  const now = new Date();
  switch (type) {
    case "daily":
      return [startOfDay(now), endOfDay(now)];
    case "weekly":
      return [
        startOfWeek(now, { weekStartsOn: 1 }),
        endOfWeek(now, { weekStartsOn: 1 }),
      ];
    case "monthly":
      return [startOfMonth(now), endOfMonth(now)];
  }
}

export default function ReportsView() {
  const { reports, tasks, notes, events, settings, addReport, deleteReport, addNote } =
    useStore();
  const [selectedId, setSelectedId] = useState<string | null>(reports[0]?.id ?? null);
  const [loading, setLoading] = useState<ReportType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"report" | "tree">("report");
  const [treeRootId, setTreeRootId] = useState<string | null>(null);

  const treeRoots = useMemo(() => candidateRoots(tasks), [tasks]);
  const treeRoot =
    treeRootId !== null ? (tasks.find((t) => t.id === treeRootId) ?? null) : null;

  const selected = reports.find((r) => r.id === selectedId) ?? null;

  const generate = async (type: ReportType) => {
    setError(null);
    setLoading(type);
    try {
      const [start, end] = rangeFor(type);
      const inRange = (iso: string | null) => {
        if (!iso) return false;
        const d = parseISO(iso);
        return d >= start && d <= end;
      };

      const doneTasks = tasks.filter((t) => t.done && inRange(t.completedAt));
      const openTasks = tasks.filter((t) => !t.done && inRange(t.dueAt));
      const rangeNotes = notes.filter((n) => inRange(n.updatedAt));
      const rangeEvents = events.filter((e) => inRange(e.start));

      const context = [
        `时间范围：${format(start, "yyyy-MM-dd")} ~ ${format(end, "yyyy-MM-dd")}`,
        "",
        "## 已完成任务",
        doneTasks.length
          ? doneTasks.map((t) => `- ${t.title}${t.note ? `（${t.note}）` : ""}`).join("\n")
          : "（无）",
        "",
        "## 进行中/待截止任务",
        openTasks.length ? openTasks.map((t) => `- ${t.title}`).join("\n") : "（无）",
        "",
        "## 日程",
        rangeEvents.length
          ? rangeEvents
              .map((e) => `- ${fmtDate(e.start)} ${e.title}${e.note ? `：${e.note}` : ""}`)
              .join("\n")
          : "（无）",
        "",
        "## 笔记摘要",
        rangeNotes.length
          ? rangeNotes
              .map((n) => `### ${n.title || "未命名"}\n${n.body.slice(0, 500)}`)
              .join("\n\n")
          : "（无）",
      ].join("\n");

      const system = settings.reportTemplate.replace("{period}", TYPE_LABEL[type]);
      const content = await deepseekChat(
        settings.deepseekApiKey,
        settings.deepseekModel,
        [
          { role: "system", content: system },
          { role: "user", content: context },
        ],
      );

      const report = addReport({
        type,
        rangeStart: start.toISOString(),
        rangeEnd: end.toISOString(),
        content,
      });
      setSelectedId(report.id);
      setView("report");
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(null);
    }
  };

  const saveAsNote = (r: Report) => {
    addNote({
      title: `${TYPE_LABEL[r.type]} · ${fmtDate(r.rangeStart)}`,
      body: r.content,
      tags: ["报告", TYPE_LABEL[r.type]],
    });
  };

  return (
    <div className="flex h-full">
      {/* 左侧：生成 + 历史 */}
      <div className="flex w-64 shrink-0 flex-col border-r border-mint-100">
        <div className="flex items-center gap-2 border-b border-mint-100 px-5 py-4">
          <Sparkles size={20} className="text-mint-500" strokeWidth={2.2} />
          <h1 className="text-lg font-semibold text-ink">报告</h1>
        </div>

        <div className="flex flex-col gap-2 border-b border-mint-100 p-4">
          {(["daily", "weekly", "monthly"] as ReportType[]).map((type) => (
            <Button
              key={type}
              variant="ghost"
              disabled={loading !== null}
              onClick={() => generate(type)}
              className="flex items-center justify-center gap-2 border border-mint-100"
            >
              {loading === type ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Sparkles size={15} />
              )}
              生成{TYPE_LABEL[type]}
            </Button>
          ))}
          {error && (
            <div className="flex items-start gap-1.5 rounded-lg bg-red-50 px-2.5 py-2 text-xs text-red-500">
              <AlertCircle size={14} className="mt-px shrink-0" />
              <span className="break-all">{error}</span>
            </div>
          )}
        </div>

        {/* 待办工作树入口 */}
        <div className="border-b border-mint-100 p-2">
          <button
            onClick={() => {
              setView("tree");
              setTreeRootId(null); // 每次进入先回到选择页
            }}
            className={[
              "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
              view === "tree"
                ? "bg-mint-50 text-mint-600"
                : "text-ink hover:bg-mint-50/50",
            ].join(" ")}
          >
            <GitBranch size={16} className="shrink-0 text-mint-500" />
            待办工作树
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {reports.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-ink-soft">
              还没有报告
            </p>
          ) : (
            reports.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setSelectedId(r.id);
                  setView("report");
                }}
                className={[
                  "mb-1 w-full rounded-xl px-3 py-2.5 text-left transition-colors",
                  r.id === selectedId && view === "report"
                    ? "bg-mint-50"
                    : "hover:bg-mint-50/50",
                ].join(" ")}
              >
                <p className="text-sm font-medium text-ink">
                  {TYPE_LABEL[r.type]}
                </p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {fmtDate(r.rangeStart)}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* 右侧：内容 */}
      {view === "tree" ? (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="border-b border-mint-100 px-8 py-4">
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
              {treeRoot ? (
                <button
                  onClick={() => setTreeRootId(null)}
                  title="返回选择"
                  className="-ml-1 flex items-center rounded-lg p-1 text-ink-soft hover:bg-mint-50 hover:text-ink"
                >
                  <ChevronLeft size={18} />
                </button>
              ) : (
                <GitBranch size={17} className="text-mint-500" />
              )}
              待办工作树
              {treeRoot && (
                <span className="truncate font-normal text-ink-soft">
                  · {treeRoot.title}
                </span>
              )}
            </h2>
            {treeRoot && (
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                {(["year", "month", "week", "day"] as PlanLevel[]).map((l) => (
                  <span key={l} className="flex items-center gap-1">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: LEVEL_STYLE[l].line }}
                    />
                    {LV_LABEL[l]}
                  </span>
                ))}
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full border-2 border-ink-soft/40" />
                  子待办
                </span>
                <span>┄ 虚线＝越级</span>
              </p>
            )}
          </div>
          <div className="flex-1 overflow-auto px-8 py-6">
            {treeRoot ? (
              <WorkTree root={treeRoot} tasks={tasks} />
            ) : (
              <TreeChooser
                roots={treeRoots}
                tasks={tasks}
                onPick={setTreeRootId}
              />
            )}
          </div>
        </div>
      ) : selected ? (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-mint-100 px-8 py-4">
            <div>
              <h2 className="text-base font-semibold text-ink">
                {TYPE_LABEL[selected.type]}
              </h2>
              <p className="text-xs text-ink-soft">
                生成于 {fmtDateTime(selected.createdAt)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => saveAsNote(selected)}
                className="flex items-center gap-1 border border-mint-100"
              >
                <FileDown size={15} /> 存为笔记
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  deleteReport(selected.id);
                  const rest = reports.filter((r) => r.id !== selected.id);
                  setSelectedId(rest[0]?.id ?? null);
                }}
                className="flex items-center gap-1"
              >
                <Trash2 size={15} />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <Markdown>{selected.content}</Markdown>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col">
          <EmptyState
            icon={Sparkles}
            text="点击左侧按钮，让 DeepSeek 根据你的任务与笔记生成报告。"
          />
        </div>
      )}
    </div>
  );
}

/* ----------------------- 待办工作树（git-graph 形式） ----------------------- */

type TreeNode = {
  key: string;
  kind: "task" | "sub";
  title: string;
  done: boolean;
  level?: PlanLevel;
  skip?: boolean;
  children: TreeNode[];
};

function buildNode(t: Task, tasks: Task[], parentLevel?: PlanLevel): TreeNode {
  const childPlans = tasks
    .filter((x) => x.parentId === t.id)
    .map((x) => buildNode(x, tasks, t.level));
  const subs: TreeNode[] = (t.subtasks ?? []).map((s) => ({
    key: "s" + s.id,
    kind: "sub",
    title: s.title,
    done: s.done,
    children: [],
  }));
  return {
    key: "t" + t.id,
    kind: "task",
    title: t.title,
    done: t.done,
    level: t.level,
    skip: parentLevel ? LV_RANK[parentLevel] - LV_RANK[t.level] > 1 : false,
    children: [...childPlans, ...subs],
  };
}

/** 候选工作树：根（无父，或父已不存在）且最高层级不是「日」——纯日级待办不计入 */
function candidateRoots(tasks: Task[]): Task[] {
  const ids = new Set(tasks.map((t) => t.id));
  return tasks.filter(
    (t) => (!t.parentId || !ids.has(t.parentId)) && t.level !== "day",
  );
}

/** 统计某棵树包含的规划数（任务节点，不含子待办） */
function countTreeTasks(rootId: string, tasks: Task[]): number {
  let count = 0;
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop() as string;
    count++;
    tasks.forEach((t) => {
      if (t.parentId === id) stack.push(t.id);
    });
  }
  return count;
}

const SUB_LINE = "#c2d4cd";
const lineFor = (lvl?: PlanLevel) => (lvl ? LEVEL_STYLE[lvl].line : SUB_LINE);

// 图布局常量
const INDENT = 22;
const ROW_H = 32;
const CY = ROW_H / 2;
const CORNER = 6;
const colX = (c: number) => c * INDENT + 11;

function NodeLabel({ node }: { node: TreeNode }) {
  const isTask = node.kind === "task";
  const st = isTask && node.level ? LEVEL_STYLE[node.level] : null;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {st && node.level && (
        <span
          className="rounded px-1.5 py-0.5 text-[11px] font-semibold"
          style={{ backgroundColor: st.badgeBg, color: st.badgeText }}
        >
          {LV_LABEL[node.level]}
        </span>
      )}
      <span
        className={
          node.done
            ? "text-ink-soft line-through"
            : isTask
              ? "text-ink"
              : "text-ink-soft"
        }
      >
        {node.title}
      </span>
    </span>
  );
}

type FlatNode = { node: TreeNode; depth: number; childIdx: number[] };

/** 工作树选择：列出每棵树的最高级待办作为选项 */
function TreeChooser({
  roots,
  tasks,
  onPick,
}: {
  roots: Task[];
  tasks: Task[];
  onPick: (id: string) => void;
}) {
  if (roots.length === 0) {
    return (
      <EmptyState
        icon={GitBranch}
        text="还没有多层级的工作树。在「待办」里把规划下放到更低层级，即可形成一棵工作树。"
      />
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="mb-1 text-sm text-ink-soft">选择要查看的工作树（按最高级规划）：</p>
      {roots.map((r) => {
        const st = LEVEL_STYLE[r.level];
        return (
          <button
            key={r.id}
            onClick={() => onPick(r.id)}
            className="group flex items-center gap-3 rounded-xl border border-mint-100 bg-surface px-4 py-3 text-left transition-colors hover:border-mint-300 hover:bg-mint-50/40"
          >
            <span
              className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold"
              style={{ backgroundColor: st.badgeBg, color: st.badgeText }}
            >
              {LV_LABEL[r.level]}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
              {r.title}
            </span>
            <span className="shrink-0 text-xs text-ink-soft">
              {countTreeTasks(r.id, tasks)} 项规划
            </span>
            <ChevronRight
              size={16}
              className="shrink-0 text-ink-soft/50 transition-colors group-hover:text-mint-500"
            />
          </button>
        );
      })}
    </div>
  );
}

function WorkTree({ root, tasks }: { root: Task; tasks: Task[] }) {
  // 把该树压平：记录每个节点的行序、深度（列）、孩子的行序
  const flat = useMemo(() => {
    const out: FlatNode[] = [];
    const visit = (node: TreeNode, depth: number): number => {
      const index = out.length;
      out.push({ node, depth, childIdx: [] });
      node.children.forEach((c) => out[index].childIdx.push(visit(c, depth + 1)));
      return index;
    };
    visit(buildNode(root, tasks), 0);
    return out;
  }, [root, tasks]);

  const rowY = (i: number) => i * ROW_H + CY;
  const colorOf = (n: TreeNode) => (n.kind === "task" ? lineFor(n.level) : SUB_LINE);
  const dashOf = (n: TreeNode) => (n.skip ? "4 4" : undefined);
  const maxDepth = flat.reduce((m, f) => Math.max(m, f.depth), 0);
  const height = flat.length * ROW_H;
  const svgWidth = (maxDepth + 1) * INDENT + 24;

  const segs: ReactNode[] = [];

  flat.forEach((f, index) => {
    const n = f.childIdx.length;
    if (n === 0) return;
    const cx = colX(f.depth);
    const childCx = colX(f.depth + 1);
    const lastIdx = f.childIdx[n - 1];
    const last = flat[lastIdx];

    // 重叠主干：父 → 倒数第二个子，被多个子共享 → 用父（高级）颜色
    if (n >= 2) {
      const secondIdx = f.childIdx[n - 2];
      segs.push(
        <line
          key={`trunk${index}`}
          x1={cx}
          y1={rowY(index)}
          x2={cx}
          y2={rowY(secondIdx)}
          stroke={colorOf(f.node)}
          strokeWidth={2}
        />,
      );
    }
    // 尾段：（倒二 / 单子时为父）→ 最后一个子，只通往它 → 用下一级颜色（含圆角拐入）
    const tailFromY = n >= 2 ? rowY(f.childIdx[n - 2]) : rowY(index);
    const ly = rowY(lastIdx);
    segs.push(
      <path
        key={`tail${index}`}
        d={`M ${cx} ${tailFromY} L ${cx} ${ly - CORNER} Q ${cx} ${ly} ${cx + CORNER} ${ly} L ${childCx} ${ly}`}
        fill="none"
        stroke={colorOf(last.node)}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dashOf(last.node)}
      />,
    );
    // 其余子（非最后）：从共享主干水平分叉，各用下一级颜色
    for (let i = 0; i < n - 1; i++) {
      const ci = flat[f.childIdx[i]];
      const y = rowY(f.childIdx[i]);
      segs.push(
        <path
          key={`br${index}_${i}`}
          d={`M ${cx} ${y} L ${childCx} ${y}`}
          fill="none"
          stroke={colorOf(ci.node)}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={dashOf(ci.node)}
        />,
      );
    }
  });

  // 节点圆点（盖在线之上）
  flat.forEach((f, index) => {
    const cx = colX(f.depth);
    const cy = rowY(index);
    segs.push(
      f.node.kind === "task" ? (
        <circle key={`dot${index}`} cx={cx} cy={cy} r={5} fill={colorOf(f.node)} />
      ) : (
        <circle
          key={`dot${index}`}
          cx={cx}
          cy={cy}
          r={3.5}
          fill="#fff"
          stroke={SUB_LINE}
          strokeWidth={2}
        />
      ),
    );
  });

  return (
    <div className="relative" style={{ height, minWidth: "fit-content" }}>
      <svg
        className="absolute left-0 top-0"
        width={svgWidth}
        height={height}
        style={{ overflow: "visible" }}
      >
        {segs}
      </svg>
      {flat.map((f) => (
        <div
          key={f.node.key}
          className="flex items-center text-sm"
          style={{ height: ROW_H, paddingLeft: colX(f.depth) + 14 }}
        >
          <NodeLabel node={f.node} />
        </div>
      ))}
    </div>
  );
}
