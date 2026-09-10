export type DateStr = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateStr(d: Date): DateStr {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function fromDateStr(s: DateStr): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
export function todayStr(): DateStr {
  return toDateStr(new Date());
}
export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
export function diffDays(a: DateStr, b: DateStr): number {
  return Math.round((fromDateStr(a).getTime() - fromDateStr(b).getTime()) / 86_400_000);
}
export function weekday(d: Date): number {
  const js = d.getDay();
  return js === 0 ? 7 : js;
}
export function eachDay(start: DateStr, end: DateStr): DateStr[] {
  const out: DateStr[] = [];
  let cur = fromDateStr(start);
  const last = fromDateStr(end);
  while (cur <= last) {
    out.push(toDateStr(cur));
    cur = addDays(cur, 1);
  }
  return out;
}
export function mondayOfWeek(d: Date): Date {
  return addDays(d, -(weekday(d) - 1));
}
export function formatCN(s: DateStr): string {
  const [, m, d] = s.split('-').map(Number);
  return `${m}月${d}日`;
}
