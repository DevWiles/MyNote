/**
 * 存储位置「引导配置」。
 * 固定保存在默认应用数据目录的 mynote-paths.json，记录用户自定义的
 * 数据目录(dataDir)与笔记目录(notesDir)。空字符串 = 默认相对路径(AppData)。
 * 启动时先读它，再据此定位 mynote.json 与笔记 .md，避开「路径设置存在被搬走的文件里」的死循环。
 */

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const LS_KEY = "mynote-paths";
const BOOTSTRAP_FILE = "mynote-paths.json";

export interface AppPaths {
  /** 所有数据(mynote.json)所在文件夹；空=默认 AppData */
  dataDir: string;
  /** 笔记 .md 所在文件夹；空=默认 AppData/notes */
  notesDir: string;
}

const DEFAULTS: AppPaths = { dataDir: "", notesDir: "" };

async function bootstrapStore() {
  const m = await import("@tauri-apps/plugin-store");
  return m.Store.load(BOOTSTRAP_FILE);
}

let cache: Promise<AppPaths> | null = null;

export function getPaths(): Promise<AppPaths> {
  if (!cache) {
    cache = (async () => {
      try {
        if (!isTauri) {
          return {
            ...DEFAULTS,
            ...(JSON.parse(localStorage.getItem(LS_KEY) ?? "{}") as Partial<AppPaths>),
          };
        }
        const s = await bootstrapStore();
        return {
          dataDir: ((await s.get("dataDir")) as string) ?? "",
          notesDir: ((await s.get("notesDir")) as string) ?? "",
        };
      } catch {
        return { ...DEFAULTS };
      }
    })();
  }
  return cache;
}

export async function savePaths(patch: Partial<AppPaths>): Promise<AppPaths> {
  const next = { ...(await getPaths()), ...patch };
  cache = Promise.resolve(next);
  if (!isTauri) {
    localStorage.setItem(LS_KEY, JSON.stringify(next));
    return next;
  }
  const s = await bootstrapStore();
  await s.set("dataDir", next.dataDir);
  await s.set("notesDir", next.notesDir);
  await s.save();
  return next;
}

/** 默认目录（用于设置页展示真实落点） */
export async function defaultDirs(): Promise<{
  dataDefault: string;
  notesDefault: string;
}> {
  if (!isTauri) return { dataDefault: "(浏览器 localStorage)", notesDefault: "(浏览器 localStorage)" };
  try {
    const { appDataDir, join } = await import("@tauri-apps/api/path");
    const base = await appDataDir();
    return { dataDefault: base, notesDefault: await join(base, "notes") };
  } catch {
    return { dataDefault: "应用数据目录", notesDefault: "应用数据目录/notes" };
  }
}

// ---------- 数据文件(mynote.json)迁移 ----------

async function readDataFile(dir: string): Promise<string | null> {
  const { readTextFile, exists, BaseDirectory } = await import(
    "@tauri-apps/plugin-fs"
  );
  if (dir) {
    const p = `${dir}/mynote.json`;
    return (await exists(p)) ? readTextFile(p) : null;
  }
  return (await exists("mynote.json", { baseDir: BaseDirectory.AppData }))
    ? readTextFile("mynote.json", { baseDir: BaseDirectory.AppData })
    : null;
}

async function writeDataFile(dir: string, content: string): Promise<void> {
  const { writeTextFile, mkdir, exists, BaseDirectory } = await import(
    "@tauri-apps/plugin-fs"
  );
  if (dir) {
    if (!(await exists(dir))) await mkdir(dir, { recursive: true });
    await writeTextFile(`${dir}/mynote.json`, content);
  } else {
    await writeTextFile("mynote.json", content, {
      baseDir: BaseDirectory.AppData,
    });
  }
}

/** 把数据文件从 fromDir 复制到 toDir（不删旧的） */
export async function migrateDataFile(
  fromDir: string,
  toDir: string,
): Promise<void> {
  if (!isTauri || fromDir === toDir) return;
  const content = await readDataFile(fromDir);
  if (content != null) await writeDataFile(toDir, content);
}
