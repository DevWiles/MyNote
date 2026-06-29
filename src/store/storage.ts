import type { StateStorage } from "zustand/middleware";

/**
 * zustand 持久化适配器。
 * 在 Tauri 环境下落盘到应用数据目录（mynote.json），保证重启不丢；
 * 在纯浏览器（npm run dev 调试）下回退到 localStorage。
 */

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// 延迟加载 tauri store，避免在非 Tauri 环境下报错
let storePromise: Promise<any> | null = null;
async function getTauriStore() {
  if (!storePromise) {
    storePromise = import("@tauri-apps/plugin-store").then((m) =>
      m.Store.load("mynote.json"),
    );
  }
  return storePromise;
}

export const appStorage: StateStorage = {
  getItem: async (name) => {
    if (!isTauri) return localStorage.getItem(name);
    const store = await getTauriStore();
    const value = (await store.get(name)) as string | undefined;
    return value ?? null;
  },
  setItem: async (name, value) => {
    if (!isTauri) {
      localStorage.setItem(name, value);
      return;
    }
    const store = await getTauriStore();
    await store.set(name, value);
    await store.save();
  },
  removeItem: async (name) => {
    if (!isTauri) {
      localStorage.removeItem(name);
      return;
    }
    const store = await getTauriStore();
    await store.delete(name);
    await store.save();
  },
};
