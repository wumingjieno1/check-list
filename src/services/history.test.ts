import { describe, expect, it, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRepositories } from '@/repositories/factory';
import { ensureWindow } from './occurrence-generator';
import { toggleItem } from './actions';
import { buildDayStatusMap, listVirtualDay, type VirtualOccurrence } from './history';

let repo: ReturnType<typeof createRepositories>;

function makeRepo() {
  const sqlite = new Database(':memory:');
  sqlite.exec(readFileSync(join(__dirname, '../db/migrations/0000_init.sql'), 'utf8'));
  return createRepositories(drizzle(sqlite) as any);
}

function seedDaily(id: string, title: string, sortOrder: number) {
  repo.checklists.create({ id, title, icon: 'star', color: 'green', recurrence: 'daily', weekdays: [], sortOrder, createdAt: Date.parse('2026-09-01T00:00:00+08:00') });
  repo.groups.create({ id: `g-${id}`, checklistId: id, title: 'G', sortOrder: 0 });
  repo.items.create({ id: `i-${id}`, groupId: `g-${id}`, title: 'X', sortOrder: 0 });
}

beforeEach(() => {
  repo = makeRepo();
});

describe('buildDayStatusMap', () => {
  it('过去有规则但无实例的日记为 missed', () => {
    seedDaily('c1', 'A', 0);
    const map = buildDayStatusMap(repo, '2026-09-08', '2026-09-10', '2026-09-10');
    expect(map['2026-09-08']).toBe('missed');
    expect(map['2026-09-09']).toBe('missed');
  });

  it('exclude 例外的过去日不计入', () => {
    seedDaily('c1', 'A', 0);
    repo.exceptions.set('e1', 'c1', '2026-09-09', 'exclude', 1);
    const map = buildDayStatusMap(repo, '2026-09-08', '2026-09-09', '2026-09-10');
    expect(map['2026-09-08']).toBe('missed');
    expect(map['2026-09-09']).toBe('none');
  });

  it('实际实例的完成状态覆盖虚拟补算', () => {
    seedDaily('c1', 'A', 0);
    ensureWindow(repo, '2026-09-10', 0, 100);
    toggleItem(repo, 'occ:c1:2026-09-10', repo.occurrences.getFlatItems('occ:c1:2026-09-10')[0].occurrenceItemId, 200);
    const map = buildDayStatusMap(repo, '2026-09-09', '2026-09-10', '2026-09-10');
    expect(map['2026-09-09']).toBe('missed');
    expect(map['2026-09-10']).toBe('done');
  });

  it('早于检查单创建日的日期不补算', () => {
    seedDaily('c1', 'A', 0);
    const map = buildDayStatusMap(repo, '2026-08-30', '2026-08-31', '2026-09-10');
    expect(map['2026-08-30']).toBe('none');
    expect(map['2026-08-31']).toBe('none');
  });

  it('归档与空模板不补算；workdays 跳过周末', () => {
    seedDaily('c1', '归档', 0);
    repo.checklists.archive('c1', true);
    repo.checklists.create({ id: 'c2', title: '空', icon: 'star', color: 'blue', recurrence: 'daily', weekdays: [], sortOrder: 1, createdAt: 1 });
    repo.checklists.create({ id: 'c3', title: '工作日', icon: 'star', color: 'blue', recurrence: 'workdays', weekdays: [], sortOrder: 2, createdAt: Date.parse('2026-09-01T00:00:00+08:00') });
    repo.groups.create({ id: 'g3', checklistId: 'c3', title: 'G', sortOrder: 0 });
    repo.items.create({ id: 'i3', groupId: 'g3', title: 'X', sortOrder: 0 });
    const map = buildDayStatusMap(repo, '2026-09-11', '2026-09-12', '2026-09-13');
    expect(map['2026-09-11']).toBe('missed');
    expect(map['2026-09-12']).toBe('none');
  });
});

describe('listVirtualDay', () => {
  it('返回实际实例与虚拟实例合并、按 sortOrder 排序', () => {
    seedDaily('c1', 'A', 0);
    seedDaily('c2', 'B', 1);
    ensureWindow(repo, '2026-09-10', 0, 100);
    const rows = listVirtualDay(repo, '2026-09-09', '2026-09-10');
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.checklistId)).toEqual(['c1', 'c2']);
    expect(rows.every((r) => r.virtual)).toBe(true);
    const todayRows = listVirtualDay(repo, '2026-09-10', '2026-09-10');
    expect(todayRows).toHaveLength(2);
    expect(todayRows.every((r) => !r.virtual)).toBe(true);
  });

  it('虚拟行标记只读且无 id', () => {
    seedDaily('c1', 'A', 0);
    const rows: VirtualOccurrence[] = listVirtualDay(repo, '2026-09-08', '2026-09-10');
    expect(rows[0]).toMatchObject({ id: null, status: 'missed', virtual: true });
  });

  it('未来未生成实例的安排日在状态图中显示为 missed（灰点），今天不补算', () => {
    repo.checklists.create({ id: 'c1', title: '周', icon: 'star', color: 'blue', recurrence: 'weekly', weekdays: [1], sortOrder: 0, createdAt: Date.parse('2026-09-01T00:00:00+08:00') });
    repo.groups.create({ id: 'g1', checklistId: 'c1', title: 'G', sortOrder: 0 });
    repo.items.create({ id: 'i1', groupId: 'g1', title: 'X', sortOrder: 0 });
    const map = buildDayStatusMap(repo, '2026-09-11', '2026-09-14', '2026-09-10');
    expect(map['2026-09-11']).toBe('none');
    expect(map['2026-09-14']).toBe('missed');
    expect(map['2026-09-10'] ?? 'none').toBe('none');
  });
});
