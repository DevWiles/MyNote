import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, PhysicalPosition } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import { isWindows } from "./lib/platform";
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

/** Windows 自绘标题栏：顶部可拖动条 + 最小化/最大化/关闭 */
function WinTitleBar() {
  const win = getCurrentWindow();
  const btn =
    "flex h-8 w-11 items-center justify-center text-ink-soft transition-colors hover:bg-mint-100 hover:text-ink";
  // 手动拖动：用 setPosition 自己移动窗口 + Pointer Capture，
  // 绕过 WebView2 上原生 startDragging 松手不停的漂移 bug（透明窗口特有）。
  const onPointerDown = async (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;
    const el = e.currentTarget;
    const pointerId = e.pointerId;
    const sx = e.screenX;
    const sy = e.screenY;
    el.setPointerCapture(pointerId);
    const scale = await win.scaleFactor();
    const pos = await win.outerPosition(); // 物理像素
    const ox = pos.x - sx * scale;
    const oy = pos.y - sy * scale;
    const move = (ev: PointerEvent) => {
      void win.setPosition(
        new PhysicalPosition(
          Math.round(ev.screenX * scale + ox),
          Math.round(ev.screenY * scale + oy),
        ),
      );
    };
    const up = () => {
      try {
        el.releasePointerCapture(pointerId);
      } catch {
        /* ignore */
      }
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };
  return (
    <div
      onPointerDown={onPointerDown}
      onDoubleClick={() => void win.toggleMaximize()}
      className="flex h-8 shrink-0 items-center justify-end"
    >
      <button className={btn} title="最小化" onClick={() => win.minimize()}>
        <Minus size={15} />
      </button>
      <button
        className={btn}
        title="最大化"
        onClick={() => win.toggleMaximize()}
      >
        <Square size={12} />
      </button>
      <button
        className={`${btn} hover:!bg-red-500 hover:!text-white`}
        title="关闭"
        onClick={() => win.close()}
      >
        <X size={16} />
      </button>
    </div>
  );
}

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
    <div className="app-shell flex h-screen w-screen flex-col overflow-hidden rounded-[14px] bg-white/[0.06] p-1 text-ink shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]">
      {isWindows && <WinTitleBar />}
      <div className="flex flex-1 gap-1 overflow-hidden">
        <Sidebar active={active} onSelect={setActive} />
        <main className="flex-1 overflow-hidden rounded-2xl bg-paper shadow-[0_8px_28px_-6px_rgba(0,0,0,0.22)] ring-1 ring-black/[0.05]">
          {VIEWS[active]}
        </main>
      </div>
    </div>
  );
}
