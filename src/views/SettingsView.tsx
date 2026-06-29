import { useState } from "react";
import { Settings as SettingsIcon, Eye, EyeOff, Check, Download, Sun, Moon } from "lucide-react";
import type { ThemeMode } from "../types";
import { useStore } from "../store/useStore";
import { Button, inputClass } from "../components/ui";

export default function SettingsView() {
  const { settings, updateSettings, tasks, notes, events, reports } = useStore();
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const markSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
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
      <header className="flex items-center gap-3 border-b border-mint-100 px-8 py-5">
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
