import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { Priority } from "../types";

type Variant = "primary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-mint-400 text-white hover:bg-mint-500 shadow-sm",
  ghost: "text-ink-soft hover:bg-mint-50 hover:text-ink",
  danger: "text-red-500 hover:bg-red-50",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...rest
}: { variant?: Variant; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** 空状态占位 */
export function EmptyState({
  icon: Icon,
  text,
}: {
  icon: LucideIcon;
  text: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mint-50 text-mint-300">
        <Icon size={26} strokeWidth={1.8} />
      </div>
      <p className="text-sm text-ink-soft">{text}</p>
    </div>
  );
}

export const PRIORITY_META: Record<
  Priority,
  { label: string; dot: string; chip: string }
> = {
  high: { label: "高", dot: "bg-red-400", chip: "bg-red-50 text-red-500" },
  medium: { label: "中", dot: "bg-amber-400", chip: "bg-amber-50 text-amber-600" },
  low: { label: "低", dot: "bg-mint-300", chip: "bg-mint-50 text-mint-600" },
};

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md bg-mint-50 px-1.5 py-0.5 text-xs text-mint-600">
      #{children}
    </span>
  );
}

/** 通用输入框样式类 */
export const inputClass =
  "w-full rounded-xl border border-mint-100 bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-soft/50 focus:border-mint-300 focus:ring-2 focus:ring-mint-100";
