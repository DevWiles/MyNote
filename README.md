# MyNote

> 简洁清新的跨平台桌面应用，把 **待办、笔记、日程** 三合一，并接入 **DeepSeek** 自动生成日报 / 周报 / 月报。

小清新风格、本地优先、隐私可控，兼容 **Windows 与 macOS**。

完整产品需求见 [PRD.md](./PRD.md)。

## ✨ 功能

- **待办** — 增删改查；今日 / 即将到期 / 全部 / 已完成 视图；优先级、截止日期、标签；顶部一行速记，回车即建；过期标红。
- **笔记** — 列表 + 全文搜索；左右分屏 Markdown 编辑器（左写源码、右实时预览）；标签管理。
- **日程** — 月历视图；事件增删改（全天 / 定时）；带截止日期的待办自动显示在对应日期。
- **报告** — 一键调用 DeepSeek，按时间范围聚合已完成任务、笔记与日程，生成日报 / 周报 / 月报；可编辑、存为笔记。
- **设置** — DeepSeek API Key 与模型、自定义报告 Prompt 模板、数据导出备份（JSON）。

## 🛠 技术栈

- **Tauri 2.x**（Rust）+ **React 19 + TypeScript + Vite**
- **Tailwind CSS v4**（小清新主题）+ **lucide-react** 图标
- **zustand** 状态管理；数据本地落盘（`tauri-plugin-store`），重启不丢
- DeepSeek 调用经 `tauri-plugin-http` 绕过浏览器 CORS

## 🚀 开发

环境要求：Node.js、Rust（stable）。

```bash
npm install          # 安装前端依赖
npm run tauri dev    # 启动桌面应用（开发模式，含热更新）
```

首次启动后，到 **设置** 填入 DeepSeek API Key（仅报告功能需要，其余模块离线可用）。

仅前端调试（浏览器，数据回退 localStorage）：

```bash
npm run dev          # http://localhost:1420
npm run build        # 类型检查 + 构建前端
```

## 📦 打包

```bash
npm run tauri build  # 生成当前平台安装包（macOS dmg / Windows msi 等）
```

## 📁 目录结构

```
src/
  components/   通用组件（侧边栏、弹窗、Markdown、UI 原子）
  views/        五大功能视图
  store/        zustand 状态 + 本地持久化适配器
  lib/          日期工具、DeepSeek 客户端
  types.ts      共享类型
src-tauri/      Tauri / Rust 后端
PRD.md          产品需求文档
```

## 🗺 路线图

MVP 已完成：待办、笔记、日程、AI 报告、本地持久化。

后续规划（按 PRD）：WebDAV 多设备同步、桌面通知提醒、深色主题、子任务。

## 🌿 分支

- `main` — 稳定分支
- `dev` — 日常开发分支

## 🔒 隐私

数据默认全部保存在本地。仅在你主动生成报告时，相关内容才会发送至 DeepSeek；API Key 只保存在本地。

## License

个人项目，暂未指定开源协议。
