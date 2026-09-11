import { addDays, fromDateStr, toDateStr } from '@/utils/date';
import { buildSchedule } from './recurrence';
import type { createRepositories } from '@/repositories/factory';

type Repo = ReturnType<typeof createRepositories>;

function scheduleFor(repo: Repo, checklistId: string, recurrence: any, weekdays: number[], today: string, daysAhead: number) {
  const end = toDateStr(addDays(fromDateStr(today), daysAhead));
  const exceptions = repo.exceptions.listForChecklist(checklistId)
    .map((e) => ({ date: e.date, type: e.type }));
  return buildSchedule({ recurrence, weekdays, exceptions }, today, end);
}

function isEmptyTemplate(repo: Repo, checklistId: string): boolean {
  return repo.checklists.getStructure(checklistId).groups.every((g) => g.items.length === 0);
}

export function ensureWindow(repo: Repo, today: string, daysAhead: number, now: number): number {
  let created = 0;
  for (const c of repo.checklists.listActive()) {
    if (c.recurrence === 'none' || isEmptyTemplate(repo, c.id)) continue;
    for (const dueDate of scheduleFor(repo, c.id, c.recurrence, c.weekdays, today, daysAhead)) {
      if (repo.occurrences.exists(c.id, dueDate)) continue;
      repo.occurrences.createWithItems(
        `occ:${c.id}:${dueDate}`, c.id, dueDate,
        repo.checklists.getStructure(c.id), now,
      );
      created += 1;
    }
  }
  return created;
}

export function rebuildFutureForChecklist(repo: Repo, checklistId: string, today: string, daysAhead: number, now: number) {
  const c = repo.checklists.get(checklistId);
  if (!c || c.isArchived) return;
  if (c.recurrence === 'none') {
    const tomorrow = toDateStr(addDays(fromDateStr(today), 1));
    repo.occurrences.deleteFutureUntouched(checklistId, tomorrow);
    return;
  }
  repo.occurrences.deleteFutureUntouched(checklistId, today);
  if (isEmptyTemplate(repo, checklistId)) return;
  for (const dueDate of scheduleFor(repo, checklistId, c.recurrence, c.weekdays, today, daysAhead)) {
    if (repo.occurrences.exists(checklistId, dueDate)) continue;
    repo.occurrences.createWithItems(
      `occ:${checklistId}:${dueDate}`, checklistId, dueDate,
      repo.checklists.getStructure(checklistId), now,
    );
  }
}
