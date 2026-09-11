import { create } from 'zustand';
import { createRepositories } from '@/repositories/factory';
import { ensureWindow, rebuildFutureForChecklist } from '@/services/occurrence-generator';
import { toggleItem as toggleAction } from '@/services/actions';
import { occurrenceProgress, nextUndoneItemId } from '@/services/progress';
import { todayStr } from '@/utils/date';
import { uuid } from '@/utils/id';
import type { RecurrenceType } from '@/repositories/types';

export const WINDOW_DAYS = 30;

type Repo = ReturnType<typeof createRepositories>;

let defaultRepo: Repo | null = null;
function getRepo(): Repo {
  if (!defaultRepo) {
    const { getDb } = require('../db/client') as typeof import('@/db/client');
    defaultRepo = createRepositories(getDb() as any);
  }
  return defaultRepo;
}

export const repo: Repo = new Proxy({} as Repo, {
  get: (_t, prop) => (getRepo() as any)[prop],
});

export interface TodayRow {
  occurrenceId: string;
  checklistId: string;
  title: string;
  icon: string;
  color: string;
  status: 'active' | 'done';
  total: number;
  done: number;
  quickTargetItemId: string | null;
}

function toTodayRow(raw: ReturnType<typeof repo.occurrences.listByDate>[number]): TodayRow {
  const flat = repo.occurrences.getFlatItems(raw.id);
  const p = occurrenceProgress(flat);
  return {
    occurrenceId: raw.id,
    checklistId: raw.checklistId,
    title: raw.checklistTitle,
    icon: raw.icon,
    color: raw.color,
    status: raw.status,
    total: p.total,
    done: p.done,
    quickTargetItemId: nextUndoneItemId(flat),
  };
}

interface AppState {
  todayDate: string;
  todayRows: TodayRow[];
  hydrated: boolean;
  hydrate: () => void;
  loadToday: (date?: string) => TodayRow[];
  quickToggle: (row: TodayRow) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  todayDate: todayStr(),
  todayRows: [],
  hydrated: false,
  hydrate: () => {
    ensureWindow(repo, todayStr(), WINDOW_DAYS, Date.now());
    set({ todayRows: get().loadToday(), hydrated: true });
  },
  loadToday: (date) => {
    const d = date ?? get().todayDate;
    ensureWindow(repo, d, WINDOW_DAYS, Date.now());
    const rows = repo.occurrences.listByDate(d).map(toTodayRow);
    set({ todayRows: rows });
    return rows;
  },
  quickToggle: (row) => {
    if (!row.quickTargetItemId) return;
    const { isDone } = toggleAction(repo, row.occurrenceId, row.quickTargetItemId, Date.now());
    if (isDone) {
      import('expo-haptics').then((H) =>
        H.notificationAsync(H.NotificationFeedbackType.Success).catch(() => {}));
    }
    get().loadToday();
  },
}));

export function createAppActions(r: Repo, getToday: () => string = todayStr) {
  return {
    createChecklist(input: {
      title: string; icon: string; color: string;
      recurrence: RecurrenceType; weekdays: number[]; today: string;
      groups: { title: string; items: string[] }[];
    }): string {
      const id = uuid();
      const now = Date.now();
      r.checklists.create({
        id, title: input.title, icon: input.icon, color: input.color,
        recurrence: input.recurrence, weekdays: input.weekdays,
        sortOrder: r.checklists.listAll().length, createdAt: now,
      });
      input.groups.forEach((g, gi) => {
        const gid = uuid();
        r.groups.create({ id: gid, checklistId: id, title: g.title, sortOrder: gi });
        g.items.forEach((title, ii) => {
          r.items.create({ id: uuid(), groupId: gid, title, sortOrder: ii });
        });
      });
      if (input.recurrence === 'none') {
        const structure = r.checklists.getStructure(id);
        if (structure.groups.some((g) => g.items.length > 0)) {
          r.occurrences.createWithItems(`occ:${id}:${input.today}`, id, input.today, structure, now);
        }
      } else {
        ensureWindow(r, input.today, WINDOW_DAYS, now);
      }
      return id;
    },

    updateMeta(checklistId: string, patch: { title: string; icon: string; color: string }) {
      r.checklists.update(checklistId, patch);
    },

    deleteChecklist(checklistId: string) {
      r.checklists.delete(checklistId);
    },

    archiveChecklist(checklistId: string, archived: boolean) {
      r.checklists.archive(checklistId, archived);
    },

    updateRecurrence(checklistId: string, patch: { recurrence: RecurrenceType; weekdays: number[] }) {
      r.checklists.update(checklistId, patch);
      rebuildFutureForChecklist(r, checklistId, getToday(), WINDOW_DAYS, Date.now());
    },

    replaceStructure(checklistId: string, groups: { id?: string; title: string; sortOrder: number; items: { id?: string; title: string; sortOrder: number }[] }[]) {
      const oldGroupIds = new Set(r.checklists.getStructure(checklistId).groups.map((g) => g.id));
      const keepGroupIds = new Set(groups.map((g) => g.id).filter(Boolean) as string[]);
      for (const gid of oldGroupIds) {
        if (!keepGroupIds.has(gid)) r.groups.delete(gid);
      }
      groups.forEach((g) => {
        if (g.id && oldGroupIds.has(g.id)) {
          r.groups.update(g.id, { title: g.title, sortOrder: g.sortOrder });
        } else {
          const ngid = uuid();
          r.groups.create({ id: ngid, checklistId, title: g.title, sortOrder: g.sortOrder });
          g.items.forEach((it) => r.items.create({ id: uuid(), groupId: ngid, title: it.title, sortOrder: it.sortOrder }));
          return;
        }
        const oldItemIds = new Set(r.checklists.getStructure(checklistId).groups.find((x) => x.id === g.id)?.items.map((i) => i.id) ?? []);
        const keepItemIds = new Set(g.items.map((i) => i.id).filter(Boolean) as string[]);
        for (const iid of oldItemIds) if (!keepItemIds.has(iid)) r.items.delete(iid);
        g.items.forEach((it) => {
          if (it.id && oldItemIds.has(it.id)) r.items.update(it.id, { title: it.title, sortOrder: it.sortOrder });
          else r.items.create({ id: uuid(), groupId: g.id!, title: it.title, sortOrder: it.sortOrder });
        });
      });
      rebuildFutureForChecklist(r, checklistId, getToday(), WINDOW_DAYS, Date.now());
    },

    setException(checklistId: string, date: string, type: 'exclude' | 'include' | null) {
      if (type === null) r.exceptions.remove(checklistId, date);
      else r.exceptions.set(uuid(), checklistId, date, type, Date.now());
      if (date >= getToday()) {
        rebuildFutureForChecklist(r, checklistId, getToday(), WINDOW_DAYS, Date.now());
      }
    },

    loadToday(today: string) {
      ensureWindow(r, today, WINDOW_DAYS, Date.now());
      return r.occurrences.listByDate(today);
    },
  };
}
