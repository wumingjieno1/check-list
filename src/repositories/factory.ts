import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
import {
  checklists, groups, items, occurrences, occurrenceItems, itemResults, dateExceptions,
} from '@/db/schema';
import { buildSnapshots } from '@/services/snapshot';
import type { TemplateStructure } from '@/services/snapshot';
import type {
  ChecklistDTO, ExceptionDTO, GroupDTO, ItemDTO, OccurrenceDTO,
  OccurrenceItemDTO, RecurrenceType,
} from './types';

type AnyDb = {
  select(...args: any[]): any;
  insert(...args: any[]): any;
  update(...args: any[]): any;
  delete(...args: any[]): any;
};

const mapChecklist = (r: typeof checklists.$inferSelect): ChecklistDTO => ({
  id: r.id,
  title: r.title,
  icon: r.icon,
  color: r.color,
  recurrence: r.recurrence as RecurrenceType,
  weekdays: JSON.parse(r.weekdays),
  sortOrder: r.sortOrder,
  isArchived: r.isArchived === 1,
  createdAt: r.createdAt,
});

export function createRepositories(db: AnyDb) {
  return {
    checklists: {
      create(input: Omit<ChecklistDTO, 'isArchived'> & { isArchived?: boolean }) {
        db.insert(checklists).values({
          id: input.id, title: input.title, icon: input.icon, color: input.color,
          recurrence: input.recurrence, weekdays: JSON.stringify(input.weekdays),
          sortOrder: input.sortOrder,
          isArchived: input.isArchived ? 1 : 0,
          createdAt: input.createdAt,
        }).run();
      },
      listActive(): ChecklistDTO[] {
        return db.select().from(checklists).where(eq(checklists.isArchived, 0))
          .orderBy(asc(checklists.sortOrder), asc(checklists.createdAt)).all().map(mapChecklist);
      },
      listAll(): ChecklistDTO[] {
        return db.select().from(checklists).orderBy(asc(checklists.sortOrder)).all().map(mapChecklist);
      },
      get(id: string): ChecklistDTO | null {
        const r = db.select().from(checklists).where(eq(checklists.id, id)).get();
        return r ? mapChecklist(r) : null;
      },
      update(id: string, patch: Partial<Pick<ChecklistDTO, 'title' | 'icon' | 'color' | 'recurrence' | 'weekdays' | 'sortOrder'>>) {
        db.update(checklists).set({
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.icon !== undefined ? { icon: patch.icon } : {}),
          ...(patch.color !== undefined ? { color: patch.color } : {}),
          ...(patch.recurrence !== undefined ? { recurrence: patch.recurrence } : {}),
          ...(patch.weekdays !== undefined ? { weekdays: JSON.stringify(patch.weekdays) } : {}),
          ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
        }).where(eq(checklists.id, id)).run();
      },
      archive(id: string, archived: boolean) {
        db.update(checklists).set({ isArchived: archived ? 1 : 0 }).where(eq(checklists.id, id)).run();
      },
      delete(id: string) {
        const gs = db.select().from(groups).where(eq(groups.checklistId, id)).all();
        for (const g of gs) db.delete(items).where(eq(items.groupId, g.id)).run();
        db.delete(groups).where(eq(groups.checklistId, id)).run();
        const occs = db.select().from(occurrences).where(eq(occurrences.checklistId, id)).all();
        for (const o of occs) {
          db.delete(itemResults).where(sql`occurrence_item_id IN (
            SELECT id FROM occurrence_items WHERE occurrence_id = ${o.id})`).run();
          db.delete(occurrenceItems).where(eq(occurrenceItems.occurrenceId, o.id)).run();
        }
        db.delete(occurrences).where(eq(occurrences.checklistId, id)).run();
        db.delete(dateExceptions).where(eq(dateExceptions.checklistId, id)).run();
        db.delete(checklists).where(eq(checklists.id, id)).run();
      },
      getStructure(id: string): TemplateStructure {
        const gs = db.select().from(groups).where(eq(groups.checklistId, id))
          .orderBy(asc(groups.sortOrder)).all();
        return {
          groups: gs.map((g: typeof groups.$inferSelect) => ({
            id: g.id, title: g.title, sortOrder: g.sortOrder,
            items: db.select().from(items).where(eq(items.groupId, g.id))
              .orderBy(asc(items.sortOrder)).all()
              .map((it: typeof items.$inferSelect): ItemDTO => ({
                id: it.id, groupId: it.groupId, title: it.title, sortOrder: it.sortOrder,
              })),
          })),
        };
      },
    },

    groups: {
      create(input: GroupDTO) { db.insert(groups).values(input).run(); },
      update(id: string, patch: Partial<Pick<GroupDTO, 'title' | 'sortOrder'>>) {
        db.update(groups).set(patch).where(eq(groups.id, id)).run();
      },
      delete(id: string) {
        db.delete(items).where(eq(items.groupId, id)).run();
        db.delete(groups).where(eq(groups.id, id)).run();
      },
    },

    items: {
      create(input: ItemDTO) { db.insert(items).values(input).run(); },
      update(id: string, patch: Partial<Pick<ItemDTO, 'title' | 'sortOrder'>>) {
        db.update(items).set(patch).where(eq(items.id, id)).run();
      },
      delete(id: string) { db.delete(items).where(eq(items.id, id)).run(); },
    },

    occurrences: {
      createWithItems(id: string, checklistId: string, dueDate: string, structure: TemplateStructure, now: number): OccurrenceDTO {
        db.insert(occurrences).values({
          id, checklistId, dueDate, status: 'active', completedAt: null, createdAt: now,
        }).run();
        const rows = buildSnapshots(id, structure);
        if (rows.length > 0) {
          db.insert(occurrenceItems).values(rows.map((r) => ({
            id: `${r.occurrenceId}:${r.sourceItemId}`,
            occurrenceId: r.occurrenceId, sourceItemId: r.sourceItemId,
            groupTitle: r.groupTitle, groupSortOrder: r.groupSortOrder,
            itemTitle: r.itemTitle, sortOrder: r.sortOrder,
          }))).run();
        }
        return { id, checklistId, dueDate, status: 'active', completedAt: null, createdAt: now };
      },
      exists(checklistId: string, dueDate: string): boolean {
        return !!db.select().from(occurrences)
          .where(and(eq(occurrences.checklistId, checklistId), eq(occurrences.dueDate, dueDate))).get();
      },
      get(id: string) {
        const r = db.select({
          id: occurrences.id, checklistId: occurrences.checklistId, dueDate: occurrences.dueDate,
          status: occurrences.status, completedAt: occurrences.completedAt, createdAt: occurrences.createdAt,
          checklistTitle: checklists.title, color: checklists.color,
        }).from(occurrences)
          .innerJoin(checklists, eq(occurrences.checklistId, checklists.id))
          .where(eq(occurrences.id, id)).get();
        return r ? { ...r, status: r.status as 'active' | 'done' } : null;
      },
      listByDate(dueDate: string) {
        return db.select({
          id: occurrences.id, checklistId: occurrences.checklistId, dueDate: occurrences.dueDate,
          status: occurrences.status, completedAt: occurrences.completedAt, createdAt: occurrences.createdAt,
          checklistTitle: checklists.title, icon: checklists.icon, color: checklists.color,
        }).from(occurrences)
          .innerJoin(checklists, eq(occurrences.checklistId, checklists.id))
          .where(eq(occurrences.dueDate, dueDate))
          .orderBy(asc(checklists.sortOrder)).all()
          .map((r: any) => ({ ...r, status: r.status as 'active' | 'done' }));
      },
      listInRange(start: string, end: string): OccurrenceDTO[] {
        return db.select().from(occurrences)
          .where(and(gte(occurrences.dueDate, start), lte(occurrences.dueDate, end)))
          .orderBy(asc(occurrences.dueDate)).all();
      },
      deleteFutureUntouched(checklistId: string, fromDate: string) {
        const candidates = db.select().from(occurrences).where(
          and(eq(occurrences.checklistId, checklistId), gte(occurrences.dueDate, fromDate))).all();
        for (const o of candidates) {
          const touched = db.select().from(occurrenceItems)
            .innerJoin(itemResults, sql`${itemResults.occurrenceItemId} = ${occurrenceItems.id} AND ${itemResults.done} = 1`)
            .where(eq(occurrenceItems.occurrenceId, o.id)).get();
          if (touched) continue;
          db.delete(itemResults).where(sql`occurrence_item_id IN (
            SELECT id FROM occurrence_items WHERE occurrence_id = ${o.id})`).run();
          db.delete(occurrenceItems).where(eq(occurrenceItems.occurrenceId, o.id)).run();
          db.delete(occurrences).where(eq(occurrences.id, o.id)).run();
        }
      },
      getFlatItems(occurrenceId: string): OccurrenceItemDTO[] {
        return db.select({
          id: occurrenceItems.id, occurrenceId: occurrenceItems.occurrenceId,
          sourceItemId: occurrenceItems.sourceItemId, groupTitle: occurrenceItems.groupTitle,
          groupSortOrder: occurrenceItems.groupSortOrder, itemTitle: occurrenceItems.itemTitle,
          sortOrder: occurrenceItems.sortOrder,
          done: sql<number>`COALESCE(${itemResults.done}, 0)`,
          toggledAt: itemResults.toggledAt,
        }).from(occurrenceItems)
          .leftJoin(itemResults, eq(occurrenceItems.id, itemResults.occurrenceItemId))
          .where(eq(occurrenceItems.occurrenceId, occurrenceId)).all()
          .map((r: any): OccurrenceItemDTO => ({
            id: r.id, occurrenceItemId: r.id, occurrenceId: r.occurrenceId,
            sourceItemId: r.sourceItemId, groupTitle: r.groupTitle,
            groupSortOrder: r.groupSortOrder, itemTitle: r.itemTitle, sortOrder: r.sortOrder,
            done: Number(r.done ?? 0), toggledAt: r.toggledAt ?? null,
          }));
      },
      setStatus(occurrenceId: string, done: boolean, now: number) {
        db.update(occurrences).set({
          status: done ? 'done' : 'active', completedAt: done ? now : null,
        }).where(eq(occurrences.id, occurrenceId)).run();
      },
    },

    results: {
      toggle(occurrenceItemId: string, now: number): boolean {
        const existing = db.select().from(itemResults)
          .where(eq(itemResults.occurrenceItemId, occurrenceItemId)).get();
        const nextDone = existing ? (existing.done === 1 ? 0 : 1) : 1;
        if (existing) {
          db.update(itemResults).set({ done: nextDone, toggledAt: now })
            .where(eq(itemResults.occurrenceItemId, occurrenceItemId)).run();
        } else {
          db.insert(itemResults).values({ occurrenceItemId, done: 1, toggledAt: now }).run();
        }
        return nextDone === 1;
      },
    },

    exceptions: {
      set(id: string, checklistId: string, date: string, type: 'exclude' | 'include', now: number) {
        db.insert(dateExceptions).values({ id, checklistId, date, type, createdAt: now })
          .onConflictDoUpdate({
            target: [dateExceptions.checklistId, dateExceptions.date],
            set: { type, createdAt: now },
          }).run();
      },
      remove(checklistId: string, date: string) {
        db.delete(dateExceptions)
          .where(and(eq(dateExceptions.checklistId, checklistId), eq(dateExceptions.date, date))).run();
      },
      listForChecklist(checklistId: string): ExceptionDTO[] {
        return db.select().from(dateExceptions).where(eq(dateExceptions.checklistId, checklistId)).all()
          .map((r: any): ExceptionDTO => ({
            id: r.id, checklistId: r.checklistId, date: r.date,
            type: r.type as 'exclude' | 'include',
          }));
      },
    },
  };
}
