import { eachDay, toDateStr, fromDateStr } from '@/utils/date';
import { isScheduled } from './recurrence';
import { dayStatus, type DayStatusValue } from './progress';
import type { createRepositories } from '@/repositories/factory';

type Repo = ReturnType<typeof createRepositories>;

export interface VirtualOccurrence {
  id: string | null;
  checklistId: string;
  dueDate: string;
  status: 'active' | 'done' | 'missed';
  checklistTitle: string;
  icon: string;
  color: string;
  virtual: boolean;
}

interface ChecklistRule {
  id: string;
  title: string;
  icon: string;
  color: string;
  sortOrder: number;
  recurrence: 'none' | 'daily' | 'weekly' | 'workdays';
  weekdays: number[];
  createdAtDay: string;
}

function ruleInputs(repo: Repo): ChecklistRule[] {
  return repo.checklists.listAll()
    .filter((c) => !c.isArchived)
    .filter((c) => !repo.checklists.getStructure(c.id).groups.every((g) => g.items.length === 0))
    .map((c) => ({
      id: c.id,
      title: c.title,
      icon: c.icon,
      color: c.color,
      sortOrder: c.sortOrder,
      recurrence: c.recurrence,
      weekdays: c.weekdays,
      createdAtDay: toDateStr(new Date(c.createdAt)),
    }));
}

function scheduled(repo: Repo, c: ChecklistRule, date: string): boolean {
  if (date < c.createdAtDay) return false;
  const exceptions = repo.exceptions.listForChecklist(c.id)
    .map((e) => ({ date: e.date, type: e.type }));
  const rule = { recurrence: c.recurrence, weekdays: c.weekdays, exceptions };
  return isScheduled(date, rule, c.createdAtDay);
}

export function buildDayStatusMap(repo: Repo, start: string, end: string, today: string): Record<string, DayStatusValue> {
  const rules = ruleInputs(repo);
  const real = new Map<string, Set<{ checklistId: string; status: string }>>();
  for (const o of repo.occurrences.listInRange(start, end)) {
    const set = real.get(o.dueDate) ?? new Set();
    set.add({ checklistId: o.checklistId, status: o.status });
    real.set(o.dueDate, set);
  }

  const map: Record<string, DayStatusValue> = {};
  for (const date of eachDay(start, end)) {
    const realSet = real.get(date);
    const statuses: string[] = [];
    const covered = new Set<string>();
    if (realSet) {
      for (const r of realSet) {
        statuses.push(r.status);
        covered.add(r.checklistId);
      }
    }
    if (date !== today) {
      for (const c of rules) {
        if (covered.has(c.id)) continue;
        if (scheduled(repo, c, date)) statuses.push('active');
      }
    }
    map[date] = statuses.length === 0 ? 'none' : dayStatus(statuses.map((s) => ({ status: s })));
  }
  return map;
}

export function listVirtualDay(repo: Repo, date: string, today: string): VirtualOccurrence[] {
  const real = repo.occurrences.listByDate(date);
  const covered = new Set(real.map((r) => r.checklistId));
  const rows: VirtualOccurrence[] = real.map((r) => ({
    id: r.id, checklistId: r.checklistId, dueDate: r.dueDate, status: r.status,
    checklistTitle: r.checklistTitle, icon: r.icon, color: r.color, virtual: false,
  }));

  if (date < today) {
    for (const c of ruleInputs(repo)) {
      if (covered.has(c.id)) continue;
      if (scheduled(repo, c, date)) {
        rows.push({
          id: null, checklistId: c.id, dueDate: date, status: 'missed',
          checklistTitle: c.title, icon: c.icon, color: c.color, virtual: true,
        });
      }
    }
  }
  const order = new Map(repo.checklists.listAll().map((c, i) => [c.id, i]));
  return rows.sort((a, b) => (order.get(a.checklistId) ?? 0) - (order.get(b.checklistId) ?? 0));
}
