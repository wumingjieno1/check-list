import { describe, expect, it, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRepositories } from '@/repositories/factory';
import { ensureWindow, rebuildFutureForChecklist } from './occurrence-generator';

let repo: ReturnType<typeof createRepositories>;

function makeRepo() {
  const sqlite = new Database(':memory:');
  sqlite.exec(readFileSync(join(__dirname, '../db/migrations/0000_init.sql'), 'utf8'));
  return createRepositories(drizzle(sqlite) as any);
}

function seedDaily() {
  repo = makeRepo();
  repo.checklists.create({ id: 'c1', title: 'A', icon: 'star', color: 'blue', recurrence: 'daily', weekdays: [], sortOrder: 0, createdAt: 1 });
  repo.groups.create({ id: 'g1', checklistId: 'c1', title: 'G', sortOrder: 0 });
  repo.items.create({ id: 'i1', groupId: 'g1', title: 'X', sortOrder: 0 });
}

beforeEach(seedDaily);

describe('ensureWindow', () => {
  it('生成 [今天, +days] 实例，重复执行幂等', () => {
    expect(ensureWindow(repo, '2026-09-10', 3, 100)).toBe(4);
    expect(repo.occurrences.listInRange('2026-09-10', '2026-09-13')).toHaveLength(4);
    expect(ensureWindow(repo, '2026-09-10', 3, 101)).toBe(0);
    expect(repo.occurrences.listInRange('2026-09-10', '2026-09-13')).toHaveLength(4);
  });

  it('workdays 跳过周末', () => {
    repo.checklists.update('c1', { recurrence: 'workdays' });
    ensureWindow(repo, '2026-09-10', 4, 100);
    expect(repo.occurrences.listInRange('2026-09-10', '2026-09-14').map((o) => o.dueDate))
      .toEqual(['2026-09-10', '2026-09-11', '2026-09-14']);
  });

  it('exclude 例外不生成；include 例外补生成', () => {
    repo.exceptions.set('e1', 'c1', '2026-09-11', 'exclude', 1);
    repo.exceptions.set('e2', 'c1', '2026-09-12', 'include', 1);
    repo.checklists.update('c1', { recurrence: 'workdays' });
    ensureWindow(repo, '2026-09-10', 3, 100);
    expect(repo.occurrences.listInRange('2026-09-10', '2026-09-13').map((o) => o.dueDate))
      .toEqual(['2026-09-10', '2026-09-12']);
  });

  it('空检查单不生成', () => {
    repo.checklists.create({ id: 'c2', title: '空', icon: 'star', color: 'blue', recurrence: 'daily', weekdays: [], sortOrder: 1, createdAt: 2 });
    ensureWindow(repo, '2026-09-10', 2, 100);
    expect(repo.occurrences.listInRange('2026-09-10', '2026-09-12').filter((o) => o.checklistId === 'c2')).toHaveLength(0);
  });

  it('归档检查单不生成', () => {
    repo.checklists.archive('c1', true);
    ensureWindow(repo, '2026-09-10', 2, 100);
    expect(repo.occurrences.listInRange('2026-09-10', '2026-09-12')).toHaveLength(0);
  });

  it('none 一次性检查单不参与每日懒生成', () => {
    repo.checklists.create({ id: 'c2', title: '一次性', icon: 'star', color: 'blue', recurrence: 'none', weekdays: [], sortOrder: 1, createdAt: 2 });
    repo.groups.create({ id: 'g2', checklistId: 'c2', title: 'G', sortOrder: 0 });
    repo.items.create({ id: 'i2', groupId: 'g2', title: 'X', sortOrder: 0 });
    ensureWindow(repo, '2026-09-10', 2, 100);
    expect(repo.occurrences.listInRange('2026-09-10', '2026-09-11').filter((o) => o.checklistId === 'c2')).toHaveLength(0);
    ensureWindow(repo, '2026-09-11', 2, 101);
    expect(repo.occurrences.listInRange('2026-09-10', '2026-09-11').filter((o) => o.checklistId === 'c2')).toHaveLength(0);
  });
});

describe('rebuildFutureForChecklist', () => {
  it('改规则后重建未触碰的未来实例，保留有勾选的', () => {
    ensureWindow(repo, '2026-09-10', 3, 100);
    // 勾选 09-11
    const oi = repo.occurrences.getFlatItems('occ:c1:2026-09-11')[0].id;
    repo.results.toggle(oi, 200);
    // 改为 workdays：09-12(周六)、09-13(周日) 应消失；09-11 有勾选保留
    repo.checklists.update('c1', { recurrence: 'workdays' });
    rebuildFutureForChecklist(repo, 'c1', '2026-09-10', 3, 300);
    const dates = repo.occurrences.listInRange('2026-09-10', '2026-09-13').map((o) => o.dueDate);
    expect(dates).toContain('2026-09-10');
    expect(dates).toContain('2026-09-11');
    expect(dates).not.toContain('2026-09-12');
    expect(dates).not.toContain('2026-09-13');
  });

  it('none 一次性检查单重建不伪造今日实例', () => {
    repo.checklists.update('c1', { recurrence: 'none' });
    repo.occurrences.createWithItems(
      'occ:c1:2026-09-10', 'c1', '2026-09-10', repo.checklists.getStructure('c1'), 100,
    );
    rebuildFutureForChecklist(repo, 'c1', '2026-09-11', 2, 200);
    expect(repo.occurrences.listInRange('2026-09-10', '2026-09-13').map((o) => o.dueDate))
      .toEqual(['2026-09-10']);
  });
});
