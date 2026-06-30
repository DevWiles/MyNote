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

/** 默认基目录：主文件夹下的 MyNote（mac: ~/MyNote；win: C:\Users\你\MyNote） */
export async function resolveBase(): Promise<string> {
  const { homeDir, join } = await import("@tauri-apps/api/path");
  return join(await homeDir(), "MyNote");
}

/** 笔记 .md 实际目录（自定义 or 默认基目录） */
export async function resolveNotesDir(): Promise<string> {
  const { notesDir } = await getPaths();
  return notesDir || resolveBase();
}

/** 数据实际目录（自定义 or 默认基目录） */
export async function resolveDataDir(): Promise<string> {
  const { dataDir } = await getPaths();
  return dataDir || resolveBase();
}

/** mynote.json 完整路径 */
export async function dataFilePath(): Promise<string> {
  const { join } = await import("@tauri-apps/api/path");
  return join(await resolveDataDir(), "mynote.json");
}

/** 默认目录（用于设置页展示真实落点） */
export async function defaultDirs(): Promise<{
  dataDefault: string;
  notesDefault: string;
}> {
  if (!isTauri)
    return {
      dataDefault: "(浏览器 localStorage)",
      notesDefault: "(浏览器 localStorage)",
    };
  try {
    const base = await resolveBase();
    return { dataDefault: base, notesDefault: base };
  } catch {
    return { dataDefault: "主文件夹/MyNote", notesDefault: "主文件夹/MyNote" };
  }
}

// ---------- 数据文件(mynote.json)迁移 ----------

/** 把 fromDir/mynote.json 复制到 toDir（绝对目录，不删旧的） */
export async function migrateDataFile(
  fromDir: string,
  toDir: string,
): Promise<void> {
  if (!isTauri || !fromDir || !toDir || fromDir === toDir) return;
  const { readTextFile, writeTextFile, mkdir, exists } = await import(
    "@tauri-apps/plugin-fs"
  );
  const { join } = await import("@tauri-apps/api/path");
  const src = await join(fromDir, "mynote.json");
  if (!(await exists(src))) return;
  const content = await readTextFile(src);
  if (!(await exists(toDir))) await mkdir(toDir, { recursive: true });
  await writeTextFile(await join(toDir, "mynote.json"), content);
}
