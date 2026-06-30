import type { StateStorage } from "zustand/middleware";
import { dataFilePath } from "./paths";

/**
 * zustand 持久化适配器。
 * Tauri 下用 plugin-fs 读写 {数据目录}/mynote.json（默认 ~/MyNote），键值结构与
 * 旧 store 插件文件兼容；首次读取若新位置无文件、旧 AppData 有，则自动迁移过来。
 * 纯浏览器（npm run dev）回退 localStorage。
 */

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type FsMod = typeof import("@tauri-apps/plugin-fs");
let fsPromise: Promise<FsMod> | null = null;
const fs = () => (fsPromise ??= import("@tauri-apps/plugin-fs"));

type KV = Record<string, string>;

function parseKV(s: string): KV {
  try {
    const o = JSON.parse(s);
    return o && typeof o === "object" ? (o as KV) : {};
  } catch {
    return {};
  }
}

async function readKV(path: string): Promise<KV> {
  const { exists, readTextFile } = await fs();
  if (!(await exists(path))) return {};
  return parseKV(await readTextFile(path));
}

async function writeKV(path: string, obj: KV): Promise<void> {
  const { writeTextFile, mkdir, exists } = await fs();
  const dir = path.replace(/[/\\][^/\\]*$/, "");
  if (dir && !(await exists(dir))) await mkdir(dir, { recursive: true });
  await writeTextFile(path, JSON.stringify(obj));
}

// 旧版数据在 AppData/mynote.json（store 插件格式，同为键值 JSON）。
// 新位置首次无文件时迁移过来（只复制一次，不删旧）。
let migrated = false;
async function migrateOnce(targetPath: string): Promise<void> {
  if (migrated) return;
  migrated = true;
  const { exists, readTextFile, BaseDirectory } = await fs();
  try {
    if (await exists(targetPath)) return;
    if (await exists("mynote.json", { baseDir: BaseDirectory.AppData })) {
      const content = await readTextFile("mynote.json", {
        baseDir: BaseDirectory.AppData,
      });
      await writeKV(targetPath, parseKV(content));
    }
  } catch (e) {
    console.error("数据迁移失败", e);
  }
}

// 串行化写入，避免并发读改写互相覆盖
let chain: Promise<unknown> = Promise.resolve();
function queue<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => {});
  return next;
}

export const appStorage: StateStorage = {
  getItem: async (name) => {
    if (!isTauri) return localStorage.getItem(name);
    const path = await dataFilePath();
    await migrateOnce(path);
    const obj = await readKV(path);
    return obj[name] ?? null;
  },
  setItem: async (name, value) => {
    if (!isTauri) {
      localStorage.setItem(name, value);
      return;
    }
    const path = await dataFilePath();
    await queue(async () => {
      const obj = await readKV(path);
      obj[name] = value;
      obj.__app = "mynote"; // 标记为本应用数据文件，便于辨认
      await writeKV(path, obj);
    });
  },
  removeItem: async (name) => {
    if (!isTauri) {
      localStorage.removeItem(name);
      return;
    }
    const path = await dataFilePath();
    await queue(async () => {
      const obj = await readKV(path);
      delete obj[name];
      await writeKV(path, obj);
    });
  },
};
