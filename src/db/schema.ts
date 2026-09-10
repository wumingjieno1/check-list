import { integer, sqliteTable, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const checklists = sqliteTable('checklists', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  icon: text('icon').notNull().default('checkmark-circle-outline'),
  color: text('color').notNull().default('green'),
  recurrence: text('recurrence').notNull().default('none'),
  weekdays: text('weekdays').notNull().default('[]'),
  sortOrder: integer('sort_order').notNull().default(0),
  isArchived: integer('is_archived').notNull().default(0),
  createdAt: integer('created_at').notNull(),
});

export const groups = sqliteTable('groups', {
  id: text('id').primaryKey(),
  checklistId: text('checklist_id').notNull(),
  title: text('title').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const items = sqliteTable('items', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull(),
  title: text('title').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const occurrences = sqliteTable('occurrences', {
  id: text('id').primaryKey(),
  checklistId: text('checklist_id').notNull(),
  dueDate: text('due_date').notNull(),
  status: text('status').notNull().default('active'),
  completedAt: integer('completed_at'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  dateIdx: index('idx_occ_date').on(t.dueDate),
  clIdx: index('idx_occ_cl').on(t.checklistId),
}));

export const occurrenceItems = sqliteTable('occurrence_items', {
  id: text('id').primaryKey(),
  occurrenceId: text('occurrence_id').notNull(),
  sourceItemId: text('source_item_id').notNull(),
  groupTitle: text('group_title').notNull(),
  groupSortOrder: integer('group_sort_order').notNull(),
  itemTitle: text('item_title').notNull(),
  sortOrder: integer('sort_order').notNull(),
}, (t) => ({
  occIdx: index('idx_oitem_occ').on(t.occurrenceId),
}));

export const itemResults = sqliteTable('item_results', {
  occurrenceItemId: text('occurrence_item_id').primaryKey(),
  done: integer('done').notNull().default(0),
  toggledAt: integer('toggled_at').notNull(),
});

export const dateExceptions = sqliteTable('date_exceptions', {
  id: text('id').primaryKey(),
  checklistId: text('checklist_id').notNull(),
  date: text('date').notNull(),
  type: text('type').notNull(),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  uniq: uniqueIndex('idx_exc_cl_date').on(t.checklistId, t.date),
}));
