import { useState } from "react";
import {
  CheckSquare,
  NotebookPen,
  CalendarDays,
  Sparkles,
  Settings,
  PanelLeft,
} from "lucide-react";
import type { ViewKey } from "../types";

type NavItem = {
  key: ViewKey;
  label: string;
  icon: typeof CheckSquare;
};

export const NAV_ITEMS: NavItem[] = [
  { key: "today", label: "待办", icon: CheckSquare },
  { key: "notes", label: "笔记", icon: NotebookPen },
  { key: "schedule", label: "日程", icon: CalendarDays },
  { key: "reports", label: "报告", icon: Sparkles },
  { key: "settings", label: "设置", icon: Settings },
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
        "flex shrink-0 flex-col overflow-hidden rounded-2xl bg-mint-50 shadow-[0_8px_28px_-6px_rgba(0,0,0,0.22)] ring-1 ring-black/[0.05]",
        collapsed ? "w-[68px]" : "w-60",
      ].join(" ")}
    >
      {/* 顶部留白：给 macOS 红绿灯按钮腾位置，同时作为窗口拖拽区（Windows 隐藏） */}
      <div data-tauri-drag-region className="mac-traffic-spacer h-8 shrink-0" />

      {/* 品牌区（可拖拽窗口）：展开时 logo + 名称 + 收起按钮；收起时 logo 即展开按钮 */}
      <div
        data-tauri-drag-region
        className={[
          "flex items-center pb-3 pt-1",
          collapsed ? "justify-center px-0" : "gap-3 px-4",
        ].join(" ")}
      >
        {collapsed ? (
          <button
            onClick={() => setCollapsed(false)}
            title="展开侧边栏"
            className="group/logo flex h-9 w-9 shrink-0 items-center justify-center text-ink"
          >
            {/* 默认 logo，悬停换成面板图标 */}
            <NotebookPen
              size={24}
              strokeWidth={1.8}
              className="group-hover/logo:hidden"
            />
            <PanelLeft
              size={22}
              strokeWidth={1.8}
              className="hidden group-hover/logo:block"
            />
          </button>
        ) : (
          <>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center text-ink">
              <NotebookPen size={24} strokeWidth={1.8} />
            </div>
            <span className="whitespace-nowrap text-xl font-semibold tracking-tight text-ink">
              MyNote
            </span>
            <button
              onClick={() => setCollapsed(true)}
              title="收起侧边栏"
              className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-surface/70 hover:text-ink"
            >
              <PanelLeft size={18} strokeWidth={1.8} />
            </button>
          </>
        )}
      </div>

      {/* 导航：灰色极简线性图标 */}
      <nav
        className={[
          "flex flex-1 flex-col gap-1 pt-2",
          collapsed ? "items-center px-0" : "px-3",
        ].join(" ")}
      >
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
          const isActive = key === active;
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              title={collapsed ? label : undefined}
              className={[
                "flex h-11 items-center whitespace-nowrap rounded-xl text-[15px] font-medium transition-colors",
                collapsed ? "w-11 justify-center" : "w-full gap-3 px-3",
                isActive
                  ? "bg-mint-400/20 text-mint-600"
                  : "text-ink-soft hover:bg-surface/60 hover:text-ink",
              ].join(" ")}
            >
              <Icon size={20} strokeWidth={1.8} className="shrink-0" />
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
