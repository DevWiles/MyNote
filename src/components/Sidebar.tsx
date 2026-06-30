import { useState } from "react";
import {
  CheckSquare,
  NotebookPen,
  CalendarDays,
  Sparkles,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
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
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={[
        "flex shrink-0 flex-col overflow-hidden rounded-2xl bg-mint-50 shadow-[0_8px_28px_-6px_rgba(0,0,0,0.22)] ring-1 ring-black/[0.05] transition-[width] duration-200",
        collapsed ? "w-16" : "w-60",
      ].join(" ")}
    >
      {/* 顶部留白：给 macOS 红绿灯按钮腾位置，同时作为窗口拖拽区 */}
      <div data-tauri-drag-region className="h-8 shrink-0" />

      {/* 品牌区 + 折叠按钮（可拖拽窗口） */}
      <div
        data-tauri-drag-region
        className={
          collapsed
            ? "flex justify-center px-2 pb-3 pt-1"
            : "flex items-center gap-3 px-5 pb-3 pt-1"
        }
      >
        {!collapsed && (
          <>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-mint-400 text-white shadow-sm">
              <NotebookPen size={20} strokeWidth={2.2} />
            </div>
            <span className="text-xl font-semibold tracking-tight text-ink">
              MyNote
            </span>
          </>
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "展开侧边栏" : "收起侧边栏"}
          className={[
            "flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-surface/70 hover:text-ink",
            collapsed ? "" : "ml-auto",
          ].join(" ")}
        >
          {collapsed ? (
            <PanelLeftOpen size={18} />
          ) : (
            <PanelLeftClose size={18} />
          )}
        </button>
      </div>

      {/* 导航 */}
      <nav
        className={[
          "flex flex-1 flex-col gap-1.5 pt-2",
          collapsed ? "px-2" : "px-3",
        ].join(" ")}
      >
        {NAV_ITEMS.map(({ key, label, icon: Icon, tint }) => {
          const isActive = key === active;
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={[
                "group flex items-center rounded-xl text-[15px] font-medium transition-all",
                collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
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
              {!collapsed && label}
            </button>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="px-6 py-5 text-xs text-ink-soft/70">
          {__APP_COMMIT__} · 本地优先
        </div>
      )}
    </aside>
  );
}
