import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { appStorage } from "./storage";
import { saveNote, removeNote, removeNotes } from "./notesFs";
import type {
  Task,
  Note,
  ScheduleEvent,
  Report,
  Settings,
  Priority,
  Subtask,
  PlanLevel,
  NoteViewPrefs,
} from "../types";

const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

const DEFAULT_TEMPLATE = `你是一位高效的个人助理。请根据以下「已完成任务、笔记、日程」，写一份条理清晰、简洁务实的{period}。
用中文输出 Markdown，包含：## 概览（一两句总结）、## 主要进展（要点列表）、## 亮点与思考、## 下一步建议。
不要编造数据，只基于给定内容。`;

// 补全默认值：AI 续写默认关闭（需 API Key、会消耗额度），其余本地功能默认开启
const DEFAULT_AUTOCOMPLETE = {
  ai: false,
  pairs: true,
  slash: true,
  words: true,
};

export interface AppState {
  tasks: Task[];
  notes: Note[];
  events: ScheduleEvent[];
  reports: Report[];
  settings: Settings;
  noteView: NoteViewPrefs;
  /** 笔记是否已从磁盘加载完成（不持久化） */
  notesReady: boolean;

  // 待办
  addTask: (input: {
    title: string;
    note?: string;
    dueAt?: string | null;
    priority?: Priority;
    tags?: string[];
    level?: PlanLevel;
    parentId?: string | null;
  }) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  addSubtask: (taskId: string, title: string) => void;
  toggleSubtask: (taskId: string, subId: string) => void;
  updateSubtask: (taskId: string, subId: string, title: string) => void;
  deleteSubtask: (taskId: string, subId: string) => void;
  /** 把某条子待办「下放」成 toLevel 层的独立规划，并关联回原任务 */
  promoteSubtask: (taskId: string, subId: string, toLevel: PlanLevel) => void;
  /** 撤回：把已下放/越级的子规划收回父规划，变回一条子待办 */
  recallChild: (childId: string) => void;

  // 笔记
  addNote: (input?: { title?: string; body?: string; tags?: string[] }) => string;
  updateNote: (id: string, patch: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  /** 批量删除笔记 */
  deleteNotes: (ids: string[]) => void;
  /** 用磁盘加载结果整体替换笔记 */
  setNotes: (notes: Note[]) => void;
  setNotesReady: (v: boolean) => void;

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

  // 笔记视图偏好
  setNoteView: (patch: Partial<NoteViewPrefs>) => void;
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
        autocomplete: { ...DEFAULT_AUTOCOMPLETE },
      },
      noteView: { mode: "split", pane: "write", outline: true },
      notesReady: false,

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
              subtasks: [],
              level: input.level ?? "day",
              parentId: input.parentId ?? null,
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
        set((s) => {
          const target = s.tasks.find((t) => t.id === id);
          if (!target) return {};
          const done = !target.done;
          // 收集自身 + 所有下放/越级出去的后代规划，连同它们的子待办一起同步
          const affected = new Set<string>([id]);
          let grew = true;
          while (grew) {
            grew = false;
            for (const t of s.tasks) {
              if (t.parentId && affected.has(t.parentId) && !affected.has(t.id)) {
                affected.add(t.id);
                grew = true;
              }
            }
          }
          const ts = now();
          return {
            tasks: s.tasks.map((t) =>
              affected.has(t.id)
                ? {
                    ...t,
                    done,
                    completedAt: done ? (t.done ? t.completedAt : ts) : null,
                    subtasks: t.subtasks.map((sub) => ({ ...sub, done })),
                    updatedAt: ts,
                  }
                : t,
            ),
          };
        }),
      deleteTask: (id) =>
        set((s) => {
          // 连同所有下放/越级出去的后代规划一并删除，避免留下悬空的子规划
          const remove = new Set<string>([id]);
          let grew = true;
          while (grew) {
            grew = false;
            for (const t of s.tasks) {
              if (t.parentId && remove.has(t.parentId) && !remove.has(t.id)) {
                remove.add(t.id);
                grew = true;
              }
            }
          }
          return { tasks: s.tasks.filter((t) => !remove.has(t.id)) };
        }),

      addSubtask: (taskId, title) => {
        const name = title.trim();
        if (!name) return;
        const sub: Subtask = { id: uid(), title: name, done: false };
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? { ...t, subtasks: [...t.subtasks, sub], updatedAt: now() }
              : t,
          ),
        }));
      },
      toggleSubtask: (taskId, subId) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  subtasks: t.subtasks.map((sub) =>
                    sub.id === subId ? { ...sub, done: !sub.done } : sub,
                  ),
                  updatedAt: now(),
                }
              : t,
          ),
        })),
      updateSubtask: (taskId, subId, title) => {
        const name = title.trim();
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  subtasks: t.subtasks.flatMap((sub) =>
                    sub.id === subId
                      ? name
                        ? [{ ...sub, title: name }]
                        : [] // 清空标题即删除该子待办
                      : [sub],
                  ),
                  updatedAt: now(),
                }
              : t,
          ),
        }));
      },
      deleteSubtask: (taskId, subId) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  subtasks: t.subtasks.filter((sub) => sub.id !== subId),
                  updatedAt: now(),
                }
              : t,
          ),
        })),
      promoteSubtask: (taskId, subId, toLevel) =>
        set((s) => {
          const parent = s.tasks.find((t) => t.id === taskId);
          const sub = parent?.subtasks.find((x) => x.id === subId);
          if (!parent || !sub) return {};
          const child: Task = {
            id: uid(),
            title: sub.title,
            note: "",
            dueAt: null,
            priority: "medium",
            done: false,
            tags: [],
            subtasks: [],
            level: toLevel,
            parentId: taskId,
            createdAt: now(),
            updatedAt: now(),
            completedAt: null,
          };
          return {
            tasks: [
              child,
              ...s.tasks.map((t) =>
                t.id === taskId
                  ? {
                      ...t,
                      subtasks: t.subtasks.filter((x) => x.id !== subId),
                      updatedAt: now(),
                    }
                  : t,
              ),
            ],
          };
        }),
      recallChild: (childId) =>
        set((s) => {
          const child = s.tasks.find((t) => t.id === childId);
          if (!child || !child.parentId) return {};
          const parentId = child.parentId;
          // child 本身变成父规划的一条子待办，其自带子待办也一并并入
          const absorbed: Subtask[] = [
            { id: uid(), title: child.title, done: child.done },
            ...child.subtasks,
          ];
          return {
            tasks: s.tasks
              .filter((t) => t.id !== childId)
              .map((t) => {
                if (t.id === parentId) {
                  return {
                    ...t,
                    subtasks: [...t.subtasks, ...absorbed],
                    updatedAt: now(),
                  };
                }
                // child 的下级规划上移，改挂到父规划，避免悬空
                if (t.parentId === childId) {
                  return { ...t, parentId, updatedAt: now() };
                }
                return t;
              }),
          };
        }),

      addNote: (input) => {
        const note: Note = {
          id: uid(),
          title: input?.title ?? "",
          body: input?.body ?? "",
          tags: input?.tags ?? [],
          createdAt: now(),
          updatedAt: now(),
        };
        set((s) => ({ notes: [note, ...s.notes] }));
        void saveNote(note); // 落盘为 .md
        return note.id;
      },
      updateNote: (id, patch) =>
        set((s) => {
          let updated: Note | null = null;
          const notes = s.notes.map((n) => {
            if (n.id !== id) return n;
            updated = { ...n, ...patch, updatedAt: now() };
            return updated;
          });
          if (updated) void saveNote(updated); // 同步落盘
          return { notes };
        }),
      deleteNote: (id) => {
        set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
        void removeNote(id);
      },
      deleteNotes: (ids) => {
        const rm = new Set(ids);
        set((s) => ({ notes: s.notes.filter((n) => !rm.has(n.id)) }));
        void removeNotes(ids);
      },

      setNotes: (notes) => set({ notes }),
      setNotesReady: (v) => set({ notesReady: v }),

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

      setNoteView: (patch) =>
        set((s) => ({ noteView: { ...s.noteView, ...patch } })),
    }),
    {
      name: "mynote-data",
      version: 4,
      storage: createJSONStorage(() => appStorage),
      migrate: (persisted, version) => {
        const state = persisted as Partial<AppState> | undefined;
        if (state?.tasks && version < 3) {
          state.tasks = state.tasks.map((t) => ({
            ...t,
            subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
            // 旧数据无层级概念，默认归到「日」层；关联默认无
            level: t.level ?? "day",
            parentId: t.parentId ?? null,
          }));
        }
        // v4：为旧数据补全 autocomplete 偏好
        if (state?.settings && version < 4) {
          state.settings = {
            ...state.settings,
            autocomplete: {
              ...DEFAULT_AUTOCOMPLETE,
              ...(state.settings.autocomplete ?? {}),
            },
          };
        }
        return state as AppState;
      },
      // 笔记改为独立 .md 文件存储，不再进 mynote.json
      partialize: (s) => ({
        tasks: s.tasks,
        events: s.events,
        reports: s.reports,
        settings: s.settings,
        noteView: s.noteView,
      }),
    },
  ),
);
