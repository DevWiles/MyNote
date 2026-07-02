export const isWindows =
  typeof navigator !== "undefined" && navigator.userAgent.includes("Windows");

/**
 * 窗口拖拽区属性（展开到元素上）。
 * Windows 用顶部自绘标题栏拖动，其余（主要是 macOS）才给标题栏空白处加拖拽标记，
 * 避免 Windows 上内容区误触拖动、以及拖动不释放的漂移问题。
 */
export const dragRegion: Record<string, unknown> = isWindows
  ? {}
  : { "data-tauri-drag-region": true };
