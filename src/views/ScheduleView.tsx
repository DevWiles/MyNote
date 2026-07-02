import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
} from "lucide-react";
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { useStore } from "../store/useStore";
import { dragRegion } from "../lib/platform";
import type { ScheduleEvent } from "../types";
import { fmtTime } from "../lib/date";
import { Button, inputClass } from "../components/ui";
import Modal from "../components/Modal";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

export default function ScheduleView() {
  const { events, tasks, addEvent, updateEvent, deleteEvent } = useStore();
  // 用 ISO 串保存「当前月份锚点」，避免在渲染期直接 new Date 引发的复杂度
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [editing, setEditing] = useState<ScheduleEvent | null>(null);
  const [creatingDay, setCreatingDay] = useState<Date | null>(null);

  const days = useMemo(() => {
    const first = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    return Array.from({ length: 42 }, (_, i) => addDays(first, i));
  }, [cursor]);

  const monthEnd = endOfMonth(cursor);

  return (
    <div className="flex h-full flex-col">
      <header {...dragRegion} className="flex items-center justify-between border-b border-mint-100 px-8 py-5">
        <div className="flex items-center gap-3">
          <CalendarDays size={22} className="text-mint-500" strokeWidth={2.2} />
          <h1 className="text-xl font-semibold text-ink">日程</h1>
          <span className="ml-2 text-lg font-medium text-ink-soft">
            {format(cursor, "yyyy 年 M 月")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCursor(addMonths(cursor, -1))}
            className="rounded-lg p-2 text-ink-soft hover:bg-mint-50 hover:text-ink"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setCursor(startOfMonth(new Date()))}
            className="rounded-lg px-3 py-1.5 text-sm text-ink-soft hover:bg-mint-50 hover:text-ink"
          >
            今天
          </button>
          <button
            onClick={() => setCursor(addMonths(cursor, 1))}
            className="rounded-lg p-2 text-ink-soft hover:bg-mint-50 hover:text-ink"
          >
            <ChevronRight size={18} />
          </button>
          <Button
            className="ml-2 flex items-center gap-1"
            onClick={() => setCreatingDay(new Date())}
          >
            <Plus size={16} /> 新建事件
          </Button>
        </div>
      </header>

      {/* 星期标题 */}
      <div className="grid grid-cols-7 border-b border-mint-100 px-6 pt-3 text-center text-xs font-medium text-ink-soft">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-2">
            {w}
          </div>
        ))}
      </div>

      {/* 日格 */}
      <div className="grid flex-1 grid-cols-7 grid-rows-6 gap-px overflow-y-auto bg-mint-100 px-6 py-px">
        {days.map((day) => {
          const inMonth = isSameMonth(day, cursor) || isSameMonth(day, monthEnd);
          const dayEvents = events
            .filter((e) => isSameDay(parseISO(e.start), day))
            .sort((a, b) => a.start.localeCompare(b.start));
          const dayTasks = tasks.filter(
            (t) => t.dueAt && isSameDay(parseISO(t.dueAt), day),
          );
          const today = isToday(day);
          return (
            <div
              key={day.toISOString()}
              onClick={() => setCreatingDay(day)}
              className={[
                "flex min-h-[84px] cursor-pointer flex-col gap-1 bg-paper p-1.5 transition-colors hover:bg-mint-50/50",
                inMonth ? "" : "opacity-40",
              ].join(" ")}
            >
              <span
                className={[
                  "flex h-6 w-6 items-center justify-center self-start rounded-full text-xs",
                  today
                    ? "bg-mint-400 font-semibold text-white"
                    : "text-ink-soft",
                ].join(" ")}
              >
                {format(day, "d")}
              </span>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {dayEvents.slice(0, 3).map((e) => (
                  <button
                    key={e.id}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setEditing(e);
                    }}
                    className="truncate rounded-md bg-mint-400/90 px-1.5 py-0.5 text-left text-[11px] text-white"
                  >
                    {!e.allDay && (
                      <span className="opacity-80">{fmtTime(e.start)} </span>
                    )}
                    {e.title}
                  </button>
                ))}
                {dayTasks.slice(0, 2).map((t) => (
                  <span
                    key={t.id}
                    className={[
                      "truncate rounded-md border px-1.5 py-0.5 text-[11px]",
                      t.done
                        ? "border-mint-100 text-ink-soft/50 line-through"
                        : "border-mint-200 text-mint-600",
                    ].join(" ")}
                    title="待办截止"
                  >
                    ✓ {t.title}
                  </span>
                ))}
                {dayEvents.length + dayTasks.length > 5 && (
                  <span className="px-1 text-[11px] text-ink-soft">
                    +{dayEvents.length + dayTasks.length - 5}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {(editing || creatingDay) && (
        <EventEditor
          event={editing}
          defaultDay={creatingDay}
          onClose={() => {
            setEditing(null);
            setCreatingDay(null);
          }}
          onSave={(data) => {
            if (editing) updateEvent(editing.id, data);
            else addEvent(data as any);
            setEditing(null);
            setCreatingDay(null);
          }}
          onDelete={
            editing
              ? () => {
                  deleteEvent(editing.id);
                  setEditing(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function EventEditor({
  event,
  defaultDay,
  onClose,
  onSave,
  onDelete,
}: {
  event: ScheduleEvent | null;
  defaultDay: Date | null;
  onClose: () => void;
  onSave: (data: {
    title: string;
    start: string;
    end: string | null;
    allDay: boolean;
    note: string;
  }) => void;
  onDelete?: () => void;
}) {
  const base = event ? parseISO(event.start) : (defaultDay ?? new Date());
  const [title, setTitle] = useState(event?.title ?? "");
  const [date, setDate] = useState(format(base, "yyyy-MM-dd"));
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [startTime, setStartTime] = useState(
    event && !event.allDay ? format(parseISO(event.start), "HH:mm") : "09:00",
  );
  const [endTime, setEndTime] = useState(
    event?.end ? format(parseISO(event.end), "HH:mm") : "10:00",
  );
  const [note, setNote] = useState(event?.note ?? "");

  const save = () => {
    if (!title.trim()) return;
    const start = allDay
      ? new Date(date + "T00:00:00").toISOString()
      : new Date(`${date}T${startTime}`).toISOString();
    const end = allDay ? null : new Date(`${date}T${endTime}`).toISOString();
    onSave({ title: title.trim(), start, end, allDay, note });
  };

  return (
    <Modal
      open
      title={event ? "编辑事件" : "新建事件"}
      onClose={onClose}
      footer={
        <>
          {onDelete && (
            <Button variant="danger" onClick={onDelete} className="mr-auto flex items-center gap-1">
              <Trash2 size={15} /> 删除
            </Button>
          )}
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
          placeholder="事件标题"
          className={inputClass}
        />
        <div className="flex items-center gap-3">
          <label className="flex-1">
            <span className="mb-1 block text-xs text-ink-soft">日期</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="mt-5 flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="h-4 w-4 accent-mint-400"
            />
            全天
          </label>
        </div>
        {!allDay && (
          <div className="flex gap-3">
            <label className="flex-1">
              <span className="mb-1 block text-xs text-ink-soft">开始</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex-1">
              <span className="mb-1 block text-xs text-ink-soft">结束</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
        )}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="备注（可选）"
          rows={2}
          className={`${inputClass} resize-none`}
        />
      </div>
    </Modal>
  );
}
