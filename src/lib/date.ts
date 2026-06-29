import {
  format,
  isToday as _isToday,
  isSameDay as _isSameDay,
  isPast,
  parseISO,
} from "date-fns";

export const isToday = (iso: string) => _isToday(parseISO(iso));
export const isSameDay = (a: string, b: string) =>
  _isSameDay(parseISO(a), parseISO(b));
export const isOverdue = (iso: string) => isPast(parseISO(iso));

export const fmtDate = (iso: string) => format(parseISO(iso), "yyyy-MM-dd");
export const fmtDateTime = (iso: string) =>
  format(parseISO(iso), "yyyy-MM-dd HH:mm");
export const fmtTime = (iso: string) => format(parseISO(iso), "HH:mm");
export const fmtMonthDay = (iso: string) => format(parseISO(iso), "MM-dd");

/** ISO → <input type="datetime-local"> 的值（本地时区） */
export const toLocalInput = (iso: string | null): string => {
  if (!iso) return "";
  return format(parseISO(iso), "yyyy-MM-dd'T'HH:mm");
};

/** <input type="datetime-local"> 的值 → ISO */
export const fromLocalInput = (val: string): string | null => {
  if (!val) return null;
  return new Date(val).toISOString();
};

/** ISO → <input type="date"> 的值 */
export const toDateInput = (iso: string | null): string => {
  if (!iso) return "";
  return format(parseISO(iso), "yyyy-MM-dd");
};

export const fromDateInput = (val: string): string | null => {
  if (!val) return null;
  return new Date(val + "T00:00:00").toISOString();
};
