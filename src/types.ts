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

/** 笔记编辑器视图偏好（持久化，重启后沿用上次状态） */
export type NoteViewMode = "split" | "single";
export type NoteEditPane = "write" | "preview";
export interface NoteViewPrefs {
  /** 单页 / 双页 */
  mode: NoteViewMode;
  /** 单页时：书写 / 预览 */
  pane: NoteEditPane;
  /** 是否显示大纲 */
  outline: boolean;
}

/** 笔记编辑器补全功能开关（可在设置里各自开关） */
export interface AutocompletePrefs {
  /** AI 智能续写（幽灵文本），需 DeepSeek API Key */
  ai: boolean;
  /** Markdown 符号自动闭合 / 包裹选区 */
  pairs: boolean;
  /** 斜杠命令菜单 */
  slash: boolean;
  /** 标签 / 历史词补全 */
  words: boolean;
}

export interface Settings {
  deepseekApiKey: string;
  deepseekModel: string;
  reportTemplate: string;
  theme: ThemeMode;
  autocomplete: AutocompletePrefs;
}
