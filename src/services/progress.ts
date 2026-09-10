import { addDays, fromDateStr, toDateStr } from '@/utils/date';

export interface FlatItem {
  occurrenceItemId: string;
  groupTitle: string;
  groupSortOrder: number;
  itemTitle: string;
  sortOrder: number;
  done: number;
}

export interface GroupView {
  title: string;
  sortOrder: number;
  items: FlatItem[];
  done: number;
  total: number;
}

export function occurrenceProgress(items: FlatItem[]) {
  const total = items.length;
  const done = items.filter((i) => i.done === 1).length;
  return { total, done, isDone: total > 0 && done === total };
}

export function nextUndoneItemId(items: FlatItem[]): string | null {
  const sorted = [...items].sort((a, b) => a.groupSortOrder - b.groupSortOrder || a.sortOrder - b.sortOrder);
  return sorted.find((i) => i.done === 0)?.occurrenceItemId ?? null;
}

export function groupByGroup(items: FlatItem[]): GroupView[] {
  const map = new Map<string, GroupView>();
  for (const it of items) {
    const key = `${it.groupSortOrder}:${it.groupTitle}`;
    if (!map.has(key)) {
      map.set(key, { title: it.groupTitle, sortOrder: it.groupSortOrder, items: [], done: 0, total: 0 });
    }
    const g = map.get(key)!;
    g.items.push(it);
    g.total += 1;
    if (it.done === 1) g.done += 1;
  }
  return [...map.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

export type DayStatusValue = 'done' | 'partial' | 'missed' | 'none';

export function dayStatus(occurrences: { status: string }[]): DayStatusValue {
  if (occurrences.length === 0) return 'none';
  if (occurrences.every((o) => o.status === 'done')) return 'done';
  return occurrences.some((o) => o.status === 'done') ? 'partial' : 'missed';
}

export function streak(dates: Record<string, DayStatusValue>, today: string): number {
  let cursor = dates[today] === 'done' ? today : toDateStr(addDays(fromDateStr(today), -1));
  let count = 0;
  while (dates[cursor] === 'done') {
    count += 1;
    cursor = toDateStr(addDays(fromDateStr(cursor), -1));
  }
  return count;
}

export function completionRate(days: { status: DayStatusValue }[]): number {
  const scheduled = days.filter((d) => d.status !== 'none');
  if (scheduled.length === 0) return 0;
  return scheduled.filter((d) => d.status === 'done').length / scheduled.length;
}
