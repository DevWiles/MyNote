import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { appStorage } from "./storage";
import type {
  Task,
  Note,
  ScheduleEvent,
  Report,
  Settings,
  Priority,
} from "../types";

const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

const DEFAULT_TEMPLATE = `你是一位高效的个人助理。请根据以下「已完成任务、笔记、日程」，写一份条理清晰、简洁务实的{period}。
用中文输出 Markdown，包含：## 概览（一两句总结）、## 主要进展（要点列表）、## 亮点与思考、## 下一步建议。
不要编造数据，只基于给定内容。`;

export interface AppState {
  tasks: Task[];
  notes: Note[];
  events: ScheduleEvent[];
  reports: Report[];
  settings: Settings;

  // 待办
  addTask: (input: {
    title: string;
    note?: string;
    dueAt?: string | null;
    priority?: Priority;
    tags?: string[];
  }) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;

  // 笔记
  addNote: (input?: { title?: string; body?: string; tags?: string[] }) => string;
  updateNote: (id: string, patch: Partial<Note>) => void;
  deleteNote: (id: string) => void;

  // 日程
  addEvent: (input: {
    title: string;
    start: string;
    end?: string | null;
    allDay?: boolean;
    note?: string;
  }) => void;
  updateEvent: (id: string, patch: Partial<ScheduleEvent>) => void;
  deleteEvent: (id: string) => void;

  // 报告
  addReport: (r: Omit<Report, "id" | "createdAt">) => Report;
  deleteReport: (id: string) => void;

  // 设置
  updateSettings: (patch: Partial<Settings>) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      tasks: [],
      notes: [],
      events: [],
      reports: [],
      settings: {
        deepseekApiKey: "",
        deepseekModel: "deepseek-chat",
        reportTemplate: DEFAULT_TEMPLATE,
        theme: "light",
      },

      addTask: (input) =>
        set((s) => ({
          tasks: [
            {
              id: uid(),
              title: input.title.trim(),
              note: input.note ?? "",
              dueAt: input.dueAt ?? null,
              priority: input.priority ?? "medium",
              done: false,
              tags: input.tags ?? [],
              createdAt: now(),
              updatedAt: now(),
              completedAt: null,
            },
            ...s.tasks,
          ],
        })),
      updateTask: (id, patch) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, ...patch, updatedAt: now() } : t,
          ),
        })),
      toggleTask: (id) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  done: !t.done,
                  completedAt: !t.done ? now() : null,
                  updatedAt: now(),
                }
              : t,
          ),
        })),
      deleteTask: (id) =>
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      addNote: (input) => {
        const id = uid();
        set((s) => ({
          notes: [
            {
              id,
              title: input?.title ?? "",
              body: input?.body ?? "",
              tags: input?.tags ?? [],
              createdAt: now(),
              updatedAt: now(),
            },
            ...s.notes,
          ],
        }));
        return id;
      },
      updateNote: (id, patch) =>
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === id ? { ...n, ...patch, updatedAt: now() } : n,
          ),
        })),
      deleteNote: (id) =>
        set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

      addEvent: (input) =>
        set((s) => ({
          events: [
            {
              id: uid(),
              title: input.title.trim(),
              start: input.start,
              end: input.end ?? null,
              allDay: input.allDay ?? false,
              note: input.note ?? "",
              createdAt: now(),
              updatedAt: now(),
            },
            ...s.events,
          ],
        })),
      updateEvent: (id, patch) =>
        set((s) => ({
          events: s.events.map((e) =>
            e.id === id ? { ...e, ...patch, updatedAt: now() } : e,
          ),
        })),
      deleteEvent: (id) =>
        set((s) => ({ events: s.events.filter((e) => e.id !== id) })),

      addReport: (r) => {
        const report: Report = { ...r, id: uid(), createdAt: now() };
        set((s) => ({ reports: [report, ...s.reports] }));
        return report;
      },
      deleteReport: (id) =>
        set((s) => ({ reports: s.reports.filter((r) => r.id !== id) })),

      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),
    }),
    {
      name: "mynote-data",
      version: 1,
      storage: createJSONStorage(() => appStorage),
      partialize: (s) => ({
        tasks: s.tasks,
        notes: s.notes,
        events: s.events,
        reports: s.reports,
        settings: s.settings,
      }),
    },
  ),
);
