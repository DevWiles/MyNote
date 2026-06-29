import {
  CheckSquare,
  NotebookPen,
  CalendarDays,
  Sparkles,
  Settings,
} from "lucide-react";
import type { ViewKey } from "../types";

type NavItem = {
  key: ViewKey;
  label: string;
  icon: typeof CheckSquare;
  /** 图标块底色（仿 macOS 设置的彩色圆角图标） */
  tint: string;
};

export const NAV_ITEMS: NavItem[] = [
  { key: "today", label: "待办", icon: CheckSquare, tint: "bg-mint-500" },
  { key: "notes", label: "笔记", icon: NotebookPen, tint: "bg-amber-500" },
  { key: "schedule", label: "日程", icon: CalendarDays, tint: "bg-rose-500" },
  { key: "reports", label: "报告", icon: Sparkles, tint: "bg-violet-500" },
  { key: "settings", label: "设置", icon: Settings, tint: "bg-slate-500" },
];

interface Props {
  active: ViewKey;
  onSelect: (key: ViewKey) => void;
}

export default function Sidebar({ active, onSelect }: Props) {
  return (
    <aside className="flex w-60 shrink-0 flex-col overflow-hidden rounded-2xl bg-mint-50 shadow-[0_8px_28px_-6px_rgba(0,0,0,0.22)] ring-1 ring-black/[0.05]">
      {/* 顶部留白：给 macOS 红绿灯按钮腾位置，同时作为窗口拖拽区 */}
      <div data-tauri-drag-region className="h-8 shrink-0" />

      {/* 品牌区（可拖拽窗口） */}
      <div
        data-tauri-drag-region
        className="flex items-center gap-3 px-5 pb-3 pt-1"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-mint-400 text-white shadow-sm">
          <NotebookPen size={20} strokeWidth={2.2} />
        </div>
        <span className="text-xl font-semibold tracking-tight text-ink">
          MyNote
        </span>
      </div>

      {/* 导航 */}
      <nav className="flex flex-1 flex-col gap-1.5 px-3 pt-2">
        {NAV_ITEMS.map(({ key, label, icon: Icon, tint }) => {
          const isActive = key === active;
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={[
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-all",
                isActive
                  ? "bg-surface text-ink shadow-sm"
                  : "text-ink-soft hover:bg-surface/60 hover:text-ink",
              ].join(" ")}
            >
              <span
                className={[
                  "flex h-7 w-7 items-center justify-center rounded-[8px] text-white shadow-sm transition-transform",
                  tint,
                  isActive ? "" : "group-hover:scale-105",
                ].join(" ")}
              >
                <Icon size={17} strokeWidth={2.2} />
              </span>
              {label}
            </button>
          );
        })}
      </nav>

      <div className="px-6 py-5 text-xs text-ink-soft/70">
        {__APP_COMMIT__} · 本地优先
      </div>
    </aside>
  );
}
