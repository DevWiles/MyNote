import type { PlanLevel } from "../types";

/** 层级中文名 */
export const LEVEL_LABEL: Record<PlanLevel, string> = {
  day: "日",
  week: "周",
  month: "月",
  year: "年",
};

/** 层级高低排序（日最低、年最高） */
export const LEVEL_RANK: Record<PlanLevel, number> = {
  day: 0,
  week: 1,
  month: 2,
  year: 3,
};

/** 各层级配色：line=连线/SVG，badgeBg/badgeText=标签底色与字色 */
export const LEVEL_STYLE: Record<
  PlanLevel,
  { line: string; badgeBg: string; badgeText: string }
> = {
  year: { line: "#34a07a", badgeBg: "#e3f4ec", badgeText: "#1f6650" },
  month: { line: "#3f97d1", badgeBg: "#e4f1f9", badgeText: "#1f6f9c" },
  week: { line: "#8f78dd", badgeBg: "#ece7f8", badgeText: "#5f48ad" },
  day: { line: "#e0a03c", badgeBg: "#fbefd8", badgeText: "#a96c0c" },
};
