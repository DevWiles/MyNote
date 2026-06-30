import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Sidebar from "./components/Sidebar";
import TodoView from "./views/TodoView";
import NotesView from "./views/NotesView";
import ScheduleView from "./views/ScheduleView";
import ReportsView from "./views/ReportsView";
import SettingsView from "./views/SettingsView";
import { useStore } from "./store/useStore";
import { loadNotes, saveNote } from "./store/notesFs";
import type { ViewKey } from "./types";

const VIEWS: Record<ViewKey, React.ReactNode> = {
  today: <TodoView />,
  notes: <NotesView />,
  schedule: <ScheduleView />,
  reports: <ReportsView />,
  settings: <SettingsView />,
};

export default function App() {
  const [active, setActive] = useState<ViewKey>("today");
  const theme = useStore((s) => s.settings.theme) ?? "light";
  const didInit = useRef(false);
  const didLoadNotes = useRef(false);

  // 从磁盘 .md 文件加载笔记；若磁盘为空但旧版数据里还有笔记，则迁移落盘
  useEffect(() => {
    if (didLoadNotes.current) return;
    didLoadNotes.current = true;
    (async () => {
      const ready = () => {
        useStore.getState().setNotesReady(true);
      };
      try {
        // 等 persist 水合完成，旧笔记（若有）此时已在 state 里，便于迁移
        if (!useStore.persist.hasHydrated()) {
          await new Promise<void>((res) => {
            const unsub = useStore.persist.onFinishHydration(() => {
              unsub();
              res();
            });
          });
        }
        const fsNotes = await loadNotes();
        if (fsNotes.length > 0) {
          useStore.getState().setNotes(fsNotes);
        } else {
          const old = useStore.getState().notes;
          if (old.length > 0) await Promise.all(old.map(saveNote)); // 一次性迁移
        }
      } catch (e) {
        console.error("加载笔记失败", e);
      } finally {
        ready();
      }
    })();
  }, []);

  // 主题切换：① webview 加 .dark 类驱动 CSS 变量；② 原生窗口切外观，
  // 让 macOS 毛玻璃随之变成 亮=白色磨砂 / 暗=灰色磨砂。
  // 首次挂载时：等主题应用 + 首帧渲染完成后再显示窗口，避免先露出空毛玻璃。
  useEffect(() => {
    const dark = theme === "dark";
    document.documentElement.classList.toggle("dark", dark);
    const applied = invoke("set_theme", { dark }).catch(() => {});

    if (!didInit.current) {
      didInit.current = true;
      // 注意：窗口隐藏时 webview 不可见，requestAnimationFrame 会被暂停，
      // 不能用 rAF 来触发显示。挂载后 DOM 已就绪，直接 show 即有完整内容。
      const reveal = () => getCurrentWindow().show().catch(() => {});
      applied.finally(reveal);
      // 兜底：即使主题调用异常，也保证窗口一定会显示，绝不卡在隐藏态
      setTimeout(reveal, 800);
    }
  }, [theme]);

  return (
    <div
      data-tauri-drag-region
      className="flex h-screen w-screen gap-1 overflow-hidden rounded-[14px] bg-white/[0.06] p-1 text-ink shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]"
    >
      <Sidebar active={active} onSelect={setActive} />
      <main className="flex-1 overflow-hidden rounded-2xl bg-paper shadow-[0_8px_28px_-6px_rgba(0,0,0,0.22)] ring-1 ring-black/[0.05]">
        {VIEWS[active]}
      </main>
    </div>
  );
}
