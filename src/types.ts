export type ViewKey = "today" | "notes" | "schedule" | "reports" | "settings";

export type Priority = "high" | "medium" | "low";

/** 规划层级：日/周/月/年 */
export type PlanLevel = "day" | "week" | "month" | "year";

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  note: string;
  /** ISO 字符串；无截止日为 null */
  dueAt: string | null;
  priority: Priority;
  done: boolean;
  tags: string[];
  /** 子待办（一层） */
  subtasks: Subtask[];
  /** 所属规划层级 */
  level: PlanLevel;
  /** 关联的上层规划 id（可越级）；无则为 null */
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface Note {
  id: string;
  title: string;
  /** Markdown 正文 */
  body: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleEvent {
  id: string;
  title: string;
  /** ISO 字符串 */
  start: string;
  end: string | null;
  allDay: boolean;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export type ReportType = "daily" | "weekly" | "monthly";

export interface Report {
  id: string;
  type: ReportType;
  rangeStart: string;
  rangeEnd: string;
  /** Markdown 内容 */
  content: string;
  createdAt: string;
}

export type ThemeMode = "light" | "dark";

export interface Settings {
  deepseekApiKey: string;
  deepseekModel: string;
  reportTemplate: string;
  theme: ThemeMode;
}
