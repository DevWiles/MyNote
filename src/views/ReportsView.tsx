import { useState } from "react";
import {
  Sparkles,
  Loader2,
  FileDown,
  Trash2,
  AlertCircle,
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
import type { Report, ReportType } from "../types";
import { deepseekChat } from "../lib/deepseek";
import { fmtDate, fmtDateTime } from "../lib/date";
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

        <div className="flex-1 overflow-y-auto p-2">
          {reports.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-ink-soft">
              还没有报告
            </p>
          ) : (
            reports.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={[
                  "mb-1 w-full rounded-xl px-3 py-2.5 text-left transition-colors",
                  r.id === selectedId ? "bg-mint-50" : "hover:bg-mint-50/50",
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
      {selected ? (
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
