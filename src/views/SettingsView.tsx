import { useEffect, useState } from "react";
import {
  Settings as SettingsIcon,
  Eye,
  EyeOff,
  Check,
  Download,
  Sun,
  Moon,
  FolderOpen,
  RotateCcw,
  FolderTree,
  RefreshCw,
} from "lucide-react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";
import type { ThemeMode } from "../types";
import { useStore } from "../store/useStore";
import { Button, inputClass } from "../components/ui";
import {
  getPaths,
  savePaths,
  defaultDirs,
  migrateDataFile,
  resolveBase,
  resolveDataDir,
} from "../store/paths";
import { saveNote } from "../store/notesFs";

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function pickDir(): Promise<string | null> {
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const d = await open({ directory: true, title: "选择文件夹" });
    return typeof d === "string" ? d : null;
  } catch (e) {
    console.error("选择文件夹失败", e);
    return null;
  }
}

export default function SettingsView() {
  const { settings, updateSettings, tasks, notes, events, reports } = useStore();
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  // 存储位置
  const [notesDir, setNotesDir] = useState("");
  const [dataDir, setDataDir] = useState("");
  const [defaults, setDefaults] = useState({
    dataDefault: "",
    notesDefault: "",
  });
  const [needRestart, setNeedRestart] = useState(false);
  const [pathError, setPathError] = useState<string | null>(null);

  // 版本 / 检查更新
  const [version, setVersion] = useState("");
  const [updateMsg, setUpdateMsg] = useState("");
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    if (isTauri) getVersion().then(setVersion).catch(() => {});
  }, []);

  const checkUpdate = async () => {
    setChecking(true);
    setUpdateMsg("正在检查更新…");
    try {
      const update = await check();
      if (update) {
        setUpdateMsg(`发现新版本 ${update.version}，正在下载…`);
        await update.downloadAndInstall();
        setUpdateMsg("下载完成，正在重启应用…");
        await relaunch();
      } else {
        setUpdateMsg("已是最新版本 ✓");
      }
    } catch (e) {
      setUpdateMsg(`检查失败：${String(e)}`);
    } finally {
      setChecking(false);
    }
  };

  // 所选目录里是否已存在该用途的 MyNote 子目录（note / json）
  const targetExists = async (picked: string, sub: string) => {
    try {
      const { exists } = await import("@tauri-apps/plugin-fs");
      const { join } = await import("@tauri-apps/api/path");
      return await exists(await join(picked, "MyNote", sub));
    } catch {
      return false;
    }
  };

  useEffect(() => {
    getPaths().then((p) => {
      setNotesDir(p.notesDir);
      setDataDir(p.dataDir);
    });
    defaultDirs().then(setDefaults);
  }, []);

  const markSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  // 在所选目录里嵌套 MyNote 子目录，避免和该文件夹已有内容混在一起
  const nest = async (picked: string, sub: string) => {
    const { join } = await import("@tauri-apps/api/path");
    return join(picked, "MyNote", sub);
  };

  // 改笔记目录：picked="" 恢复默认，否则用 {picked}/MyNote/note；把内存笔记复制过去（不删旧）
  const changeNotesDir = async (picked: string) => {
    const target = picked ? await nest(picked, "note") : "";
    await savePaths({ notesDir: target });
    setNotesDir(target);
    await Promise.all(useStore.getState().notes.map(saveNote));
    markSaved();
  };
  // 改数据目录：用 {picked}/MyNote/json，复制 mynote.json 过去（目标已有则不覆盖），提示重启
  const changeDataDir = async (picked: string) => {
    const prevAbs = await resolveDataDir();
    const target = picked ? await nest(picked, "json") : "";
    const { join } = await import("@tauri-apps/api/path");
    const nextAbs = target || (await join(await resolveBase(), "json"));
    await migrateDataFile(prevAbs, nextAbs);
    await savePaths({ dataDir: target });
    setDataDir(target);
    setNeedRestart(true);
  };

  const exportData = () => {
    const data = JSON.stringify({ tasks, notes, events, reports }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mynote-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full flex-col">
      <header data-tauri-drag-region className="flex items-center gap-3 border-b border-mint-100 px-8 py-5">
        <SettingsIcon size={22} className="text-mint-500" strokeWidth={2.2} />
        <h1 className="text-xl font-semibold text-ink">设置</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto flex max-w-xl flex-col gap-8">
          {/* 外观 */}
          <section>
            <h2 className="mb-1 text-sm font-semibold text-ink">外观</h2>
            <p className="mb-4 text-xs text-ink-soft">
              亮色对应白色透明毛玻璃，暗色对应灰色毛玻璃。
            </p>
            <div className="inline-flex gap-1 rounded-xl border border-mint-100 bg-surface p-1">
              {([
                { key: "light", label: "亮色", icon: Sun },
                { key: "dark", label: "暗色", icon: Moon },
              ] as { key: ThemeMode; label: string; icon: typeof Sun }[]).map(
                ({ key, label, icon: Icon }) => {
                  const on = (settings.theme ?? "light") === key;
                  return (
                    <button
                      key={key}
                      onClick={() => updateSettings({ theme: key })}
                      className={[
                        "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                        on
                          ? "bg-mint-500 text-white shadow-sm"
                          : "text-ink-soft hover:text-ink",
                      ].join(" ")}
                    >
                      <Icon size={16} strokeWidth={2.2} />
                      {label}
                    </button>
                  );
                },
              )}
            </div>
          </section>

          {/* DeepSeek */}
          <section>
            <h2 className="mb-1 text-sm font-semibold text-ink">DeepSeek AI</h2>
            <p className="mb-4 text-xs text-ink-soft">
              用于生成日/周/月报。API Key 仅保存在本地，调用时直接发送至 DeepSeek。
            </p>
            <div className="flex flex-col gap-4">
              <label>
                <span className="mb-1 block text-xs text-ink-soft">API Key</span>
                <div className="flex gap-2">
                  <input
                    type={showKey ? "text" : "password"}
                    value={settings.deepseekApiKey}
                    onChange={(e) => updateSettings({ deepseekApiKey: e.target.value })}
                    onBlur={markSaved}
                    placeholder="sk-..."
                    className={inputClass}
                  />
                  <button
                    onClick={() => setShowKey((v) => !v)}
                    className="rounded-xl border border-mint-100 px-3 text-ink-soft hover:bg-mint-50"
                  >
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
              <label>
                <span className="mb-1 block text-xs text-ink-soft">模型</span>
                <select
                  value={settings.deepseekModel}
                  onChange={(e) => updateSettings({ deepseekModel: e.target.value })}
                  className={inputClass}
                >
                  <option value="deepseek-chat">deepseek-chat</option>
                  <option value="deepseek-reasoner">deepseek-reasoner</option>
                </select>
              </label>
            </div>
          </section>

          {/* 报告模板 */}
          <section>
            <h2 className="mb-1 text-sm font-semibold text-ink">报告 Prompt 模板</h2>
            <p className="mb-4 text-xs text-ink-soft">
              生成报告时作为系统提示。可用占位符 <code className="rounded bg-mint-50 px-1">{"{period}"}</code>，会替换为「日报/周报/月报」。
            </p>
            <textarea
              value={settings.reportTemplate}
              onChange={(e) => updateSettings({ reportTemplate: e.target.value })}
              onBlur={markSaved}
              rows={6}
              className={`${inputClass} resize-none font-mono leading-relaxed`}
            />
          </section>

          {/* 存储位置 */}
          <section>
            <h2 className="mb-1 text-sm font-semibold text-ink">存储位置</h2>
            <p className="mb-4 text-xs text-ink-soft">
              选择文件夹后会在其中自动建 MyNote 子目录（笔记放 note/、数据放 json/），不与该文件夹已有内容混在一起。改动后会把现有内容复制过去（不删除旧文件）。
            </p>
            {!isTauri ? (
              <p className="text-xs text-ink-soft/70">
                （存储位置仅在桌面应用中可配置）
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {[
                  {
                    key: "notes" as const,
                    sub: "note",
                    label: "笔记 .md 文件夹",
                    cur: notesDir,
                    def: defaults.notesDefault,
                    onPick: changeNotesDir,
                  },
                  {
                    key: "data" as const,
                    sub: "json",
                    label: "所有数据文件夹（mynote.json）",
                    cur: dataDir,
                    def: defaults.dataDefault,
                    onPick: changeDataDir,
                  },
                ].map((row) => (
                  <div key={row.key}>
                    <span className="mb-1 flex items-center gap-1.5 text-xs text-ink-soft">
                      <FolderTree size={13} />
                      {row.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 truncate rounded-xl border border-mint-100 bg-surface px-3 py-2 text-xs text-ink">
                        {row.cur || row.def}
                      </code>
                      <button
                        onClick={async () => {
                          const d = await pickDir();
                          if (!d) return;
                          if (await targetExists(d, row.sub)) {
                            setPathError(
                              `「${d}」下已存在 MyNote/${row.sub}，可能含有其它数据。为避免冲突，请换一个目录，或先移走它。`,
                            );
                            return;
                          }
                          setPathError(null);
                          await row.onPick(d);
                        }}
                        title="选择文件夹"
                        className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-mint-100 px-3 text-xs text-ink-soft transition-colors hover:border-mint-300 hover:text-ink"
                      >
                        <FolderOpen size={15} /> 选择
                      </button>
                      {row.cur && (
                        <button
                          onClick={() => {
                            setPathError(null);
                            row.onPick("");
                          }}
                          title="恢复默认"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-mint-100 text-ink-soft transition-colors hover:border-mint-300 hover:text-ink"
                        >
                          <RotateCcw size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {pathError && (
                  <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">
                    {pathError}
                  </p>
                )}
                {needRestart && (
                  <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-600">
                    数据文件夹已更改并复制，请重启应用使其生效。
                  </p>
                )}
              </div>
            )}
          </section>

          {/* 更新 */}
          <section>
            <h2 className="mb-1 text-sm font-semibold text-ink">更新</h2>
            <p className="mb-4 text-xs text-ink-soft">
              当前版本 v{version || "—"}。可在应用内检查并安装新版本，无需重新下载安装。
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={checkUpdate}
                disabled={checking || !isTauri}
                className="flex items-center gap-2 border border-mint-100"
              >
                <RefreshCw size={15} className={checking ? "animate-spin" : ""} />
                检查更新
              </Button>
              {updateMsg && (
                <span className="text-xs text-ink-soft">{updateMsg}</span>
              )}
            </div>
          </section>

          {/* 数据 */}
          <section>
            <h2 className="mb-1 text-sm font-semibold text-ink">数据</h2>
            <p className="mb-4 text-xs text-ink-soft">
              数据本地保存。当前：{tasks.length} 待办 · {notes.length} 笔记 ·{" "}
              {events.length} 日程 · {reports.length} 报告。
            </p>
            <Button
              variant="ghost"
              onClick={exportData}
              className="flex items-center gap-2 border border-mint-100"
            >
              <Download size={15} /> 导出备份（JSON）
            </Button>
          </section>

          {saved && (
            <div className="fixed bottom-6 right-6 flex items-center gap-1.5 rounded-xl bg-mint-500 px-3 py-2 text-sm text-white shadow-lg">
              <Check size={15} /> 已保存
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
