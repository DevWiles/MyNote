import type { Note } from "../types";
import { getPaths } from "./paths";

/**
 * 笔记以「磁盘 .md 文件」为存储后端。
 * - Tauri：每篇笔记一个 {AppData}/notes/{id}.md，含 YAML frontmatter 元数据 + 正文。
 * - 纯浏览器（npm run dev 调试）：回退到 localStorage（key: mynote-notes）。
 * 另提供导出：把笔记保存成可读的 {标题}.md 到用户选择的文件夹。
 */

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const NOTES_DIR = "notes";
const LS_KEY = "mynote-notes";

// ---------- frontmatter 序列化 / 解析 ----------

function serialize(note: Note): string {
  const fm = [
    "---",
    `id: ${JSON.stringify(note.id)}`,
    `title: ${JSON.stringify(note.title)}`,
    `tags: ${JSON.stringify(note.tags ?? [])}`,
    `createdAt: ${JSON.stringify(note.createdAt)}`,
    `updatedAt: ${JSON.stringify(note.updatedAt)}`,
    "---",
    "",
  ].join("\n");
  return fm + note.body;
}

/** 容错解析：无 frontmatter 的 .md 也能当作正文读入 */
function parse(content: string, fallbackId: string): Note {
  const now = new Date(0).toISOString();
  const base: Note = {
    id: fallbackId,
    title: "",
    body: content,
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
  if (!content.startsWith("---")) return base;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return base;
  const head = content.slice(3, end).trim();
  // 正文：跳过结尾的 ---\n
  const after = content.slice(end + 4);
  const body = after.startsWith("\n") ? after.slice(1) : after;
  const note: Note = { ...base, body };
  for (const line of head.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const raw = line.slice(idx + 1).trim();
    let val: unknown = raw;
    try {
      val = JSON.parse(raw);
    } catch {
      /* 原样保留字符串 */
    }
    if (key === "id" && typeof val === "string" && val) note.id = val;
    else if (key === "title" && typeof val === "string") note.title = val;
    else if (key === "tags" && Array.isArray(val))
      note.tags = val.map(String);
    else if (key === "createdAt" && typeof val === "string")
      note.createdAt = val;
    else if (key === "updatedAt" && typeof val === "string")
      note.updatedAt = val;
  }
  return note;
}

// ---------- Tauri fs 懒加载 ----------

type FsMod = typeof import("@tauri-apps/plugin-fs");
type BaseDir = import("@tauri-apps/plugin-fs").BaseDirectory;
type Opts = { baseDir?: BaseDir } | undefined;

let fsPromise: Promise<FsMod> | null = null;
function fs() {
  if (!fsPromise) fsPromise = import("@tauri-apps/plugin-fs");
  return fsPromise;
}

/**
 * 解析笔记目录：自定义 notesDir 用绝对路径（opts 为 undefined）；
 * 否则用默认 AppData/notes（带 baseDir）。
 */
async function loc(): Promise<{
  dir: string;
  file: (name: string) => string;
  opts: Opts;
}> {
  const { notesDir } = await getPaths();
  if (notesDir) {
    return {
      dir: notesDir,
      file: (name) => `${notesDir}/${name}`,
      opts: undefined,
    };
  }
  const { BaseDirectory } = await fs();
  return {
    dir: NOTES_DIR,
    file: (name) => `${NOTES_DIR}/${name}`,
    opts: { baseDir: BaseDirectory.AppData },
  };
}

async function ensureDir(l: Awaited<ReturnType<typeof loc>>) {
  const { exists, mkdir } = await fs();
  if (!(await exists(l.dir, l.opts))) {
    await mkdir(l.dir, { ...(l.opts ?? {}), recursive: true });
  }
}

// ---------- localStorage 回退 ----------

function lsLoad(): Note[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]") as Note[];
  } catch {
    return [];
  }
}
function lsSaveAll(notes: Note[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(notes));
}

// ---------- 对外 API ----------

/** 读入全部笔记（按 updatedAt 倒序，与列表展示一致） */
export async function loadNotes(): Promise<Note[]> {
  let notes: Note[];
  if (!isTauri) {
    notes = lsLoad();
  } else {
    const { readDir, readTextFile } = await fs();
    const l = await loc();
    await ensureDir(l);
    const entries = await readDir(l.dir, l.opts);
    const mdFiles = entries.filter(
      (e) => e.isFile && e.name.toLowerCase().endsWith(".md"),
    );
    notes = await Promise.all(
      mdFiles.map(async (e) => {
        const content = await readTextFile(l.file(e.name), l.opts);
        return parse(content, e.name.replace(/\.md$/i, ""));
      }),
    );
  }
  return notes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

// 按 id 串行化写入，避免快速连续保存时旧内容覆盖新内容
const writeChains = new Map<string, Promise<unknown>>();
function queue<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const prev = writeChains.get(id) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  writeChains.set(
    id,
    next.catch(() => {}),
  );
  return next;
}

export function saveNote(note: Note): Promise<void> {
  return queue(note.id, async () => {
    if (!isTauri) {
      const all = lsLoad().filter((n) => n.id !== note.id);
      lsSaveAll([note, ...all]);
      return;
    }
    const { writeTextFile } = await fs();
    const l = await loc();
    await ensureDir(l);
    await writeTextFile(l.file(`${note.id}.md`), serialize(note), l.opts);
  }).catch((e) => console.error("saveNote 失败", e));
}

export function removeNote(id: string): Promise<void> {
  return queue(id, async () => {
    if (!isTauri) {
      lsSaveAll(lsLoad().filter((n) => n.id !== id));
      return;
    }
    const { remove, exists } = await fs();
    const l = await loc();
    const path = l.file(`${id}.md`);
    if (await exists(path, l.opts)) {
      await remove(path, l.opts);
    }
  }).catch((e) => console.error("removeNote 失败", e));
}

export async function removeNotes(ids: string[]): Promise<void> {
  await Promise.all(ids.map(removeNote));
}

// ---------- 导出 ----------

function safeFileName(title: string, fallback: string): string {
  const base = (title.trim() || fallback).replace(/[\\/:*?"<>|\n\r]+/g, "_");
  return base.slice(0, 80) || fallback;
}

/** 用唯一文件名导出每篇笔记的正文为 {标题}.md */
function buildExportFiles(notes: Note[]): { name: string; content: string }[] {
  const used = new Set<string>();
  return notes.map((n) => {
    let name = safeFileName(n.title, n.id);
    let candidate = `${name}.md`;
    let i = 2;
    while (used.has(candidate.toLowerCase())) {
      candidate = `${name}-${i++}.md`;
    }
    used.add(candidate.toLowerCase());
    return { name: candidate, content: n.body };
  });
}

export interface ExportResult {
  ok: boolean;
  count: number;
  dir?: string;
}

/** 导出笔记为 .md 文件；Tauri 下选文件夹写入，浏览器下逐个下载 */
export async function exportNotes(notes: Note[]): Promise<ExportResult> {
  const files = buildExportFiles(notes);
  if (files.length === 0) return { ok: false, count: 0 };

  if (!isTauri) {
    for (const f of files) {
      const url = URL.createObjectURL(
        new Blob([f.content], { type: "text/markdown" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = f.name;
      a.click();
      URL.revokeObjectURL(url);
    }
    return { ok: true, count: files.length };
  }

  const { open } = await import("@tauri-apps/plugin-dialog");
  const dir = await open({ directory: true, title: "选择导出文件夹" });
  if (typeof dir !== "string") return { ok: false, count: 0 };

  const { writeTextFile } = await fs();
  for (const f of files) {
    await writeTextFile(`${dir}/${f.name}`, f.content);
  }
  // 导出后打开文件夹，给用户直观反馈
  try {
    const { openPath } = await import("@tauri-apps/plugin-opener");
    await openPath(dir);
  } catch {
    /* 打开失败不影响导出 */
  }
  return { ok: true, count: files.length, dir };
}
