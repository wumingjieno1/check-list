import { describe, expect, it, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRepositories } from './factory';

let repo: ReturnType<typeof createRepositories>;

function makeRepo() {
  const sqlite = new Database(':memory:');
  sqlite.exec(readFileSync(join(__dirname, '../db/migrations/0000_init.sql'), 'utf8'));
  return createRepositories(drizzle(sqlite) as any);
}

const newChecklist = (id: string, sortOrder = 0, recurrence: any = 'daily') =>
  repo.checklists.create({ id, title: id, icon: 'star', color: 'blue', recurrence, weekdays: [], sortOrder, createdAt: 1 });

beforeEach(() => { repo = makeRepo(); });

describe('checklists', () => {
  it('按 sortOrder,createdAt 列出活跃项；归档项隐藏', () => {
    newChecklist('c1', 1);
    newChecklist('c2', 0);
    expect(repo.checklists.listActive().map((c) => c.id)).toEqual(['c2', 'c1']);
    repo.checklists.archive('c2', true);
    expect(repo.checklists.listActive().map((c) => c.id)).toEqual(['c1']);
    expect(repo.checklists.listAll()).toHaveLength(2);
  });
  it('get/update', () => {
    newChecklist('c1');
    repo.checklists.update('c1', { title: '改名', weekdays: [1, 5] });
    const c = repo.checklists.get('c1')!;
    expect(c.title).toBe('改名');
    expect(c.weekdays).toEqual([1, 5]);
  });
  it('delete 级联清空', () => {
    newChecklist('c1');
    repo.groups.create({ id: 'g1', checklistId: 'c1', title: 'G', sortOrder: 0 });
    repo.items.create({ id: 'i1', groupId: 'g1', title: 'X', sortOrder: 0 });
    repo.checklists.delete('c1');
    expect(repo.checklists.get('c1')).toBeNull();
    expect(repo.checklists.getStructure('c1').groups).toEqual([]);
  });
  it('getStructure 组/项按排序返回', () => {
    newChecklist('c1');
    repo.groups.create({ id: 'g1', checklistId: 'c1', title: 'G1', sortOrder: 0 });
    repo.items.create({ id: 'i1', groupId: 'g1', title: '后', sortOrder: 1 });
    repo.items.create({ id: 'i2', groupId: 'g1', title: '前', sortOrder: 0 });
    expect(repo.checklists.getStructure('c1').groups[0].items.map((i) => i.title)).toEqual(['前', '后']);
  });
});

describe('occurrences/results', () => {
  beforeEach(() => {
    newChecklist('c1');
    repo.groups.create({ id: 'g1', checklistId: 'c1', title: 'G1', sortOrder: 0 });
    repo.items.create({ id: 'i1', groupId: 'g1', title: 'X', sortOrder: 0 });
  });

  it('createWithItems 固化快照，getFlatItems 带 done=0', () => {
    const s = repo.checklists.getStructure('c1');
    repo.occurrences.createWithItems('o1', 'c1', '2026-09-10', s, 100);
    expect(repo.occurrences.exists('c1', '2026-09-10')).toBe(true);
    const flat = repo.occurrences.getFlatItems('o1');
    expect(flat).toHaveLength(1);
    expect(flat[0]).toMatchObject({ itemTitle: 'X', groupTitle: 'G1', done: 0 });
  });

  it('toggle 勾选/取消持久化', () => {
    repo.occurrences.createWithItems('o1', 'c1', '2026-09-10', repo.checklists.getStructure('c1'), 100);
    const oi = repo.occurrences.getFlatItems('o1')[0].id;
    expect(repo.results.toggle(oi, 200)).toBe(true);
    expect(repo.occurrences.getFlatItems('o1')[0].done).toBe(1);
    expect(repo.results.toggle(oi, 300)).toBe(false);
    expect(repo.occurrences.getFlatItems('o1')[0].done).toBe(0);
  });

  it('listByDate join 出标题/颜色；setStatus 更新', () => {
    repo.occurrences.createWithItems('o1', 'c1', '2026-09-10', repo.checklists.getStructure('c1'), 100);
    const row = repo.occurrences.listByDate('2026-09-10')[0];
    expect(row.checklistTitle).toBe('c1');
    expect(row.color).toBe('blue');
    repo.occurrences.setStatus('o1', true, 200);
    expect(repo.occurrences.get('o1')!.status).toBe('done');
    expect(repo.occurrences.get('o1')!.completedAt).toBe(200);
  });

  it('deleteFutureUntouched 保留有勾选的、删除无勾选的', () => {
    repo.occurrences.createWithItems('o1', 'c1', '2026-09-10', repo.checklists.getStructure('c1'), 100);
    repo.occurrences.createWithItems('o2', 'c1', '2026-09-11', repo.checklists.getStructure('c1'), 100);
    const oi = repo.occurrences.getFlatItems('o2')[0].id;
    repo.results.toggle(oi, 200);
    repo.occurrences.deleteFutureUntouched('c1', '2026-09-10');
    const left = repo.occurrences.listInRange('2026-09-10', '2026-09-11').map((o) => o.id);
    expect(left).toEqual(['o2']);
  });
});

describe('exceptions', () => {
  it('set upsert / remove', () => {
    newChecklist('c1');
    repo.exceptions.set('e1', 'c1', '2026-10-01', 'exclude', 1);
    repo.exceptions.set('e1', 'c1', '2026-10-01', 'include', 2);
    expect(repo.exceptions.listForChecklist('c1')).toHaveLength(1);
    expect(repo.exceptions.listForChecklist('c1')[0].type).toBe('include');
    repo.exceptions.remove('c1', '2026-10-01');
    expect(repo.exceptions.listForChecklist('c1')).toHaveLength(0);
  });
});
