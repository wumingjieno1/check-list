import { describe, expect, it, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRepositories } from '@/repositories/factory';
import { toggleItem } from './actions';

let repo: ReturnType<typeof createRepositories>;

beforeEach(() => {
  const sqlite = new Database(':memory:');
  sqlite.exec(readFileSync(join(__dirname, '../db/migrations/0000_init.sql'), 'utf8'));
  repo = createRepositories(drizzle(sqlite) as any);
  repo.checklists.create({ id: 'c1', title: 'A', icon: 'star', color: 'blue', recurrence: 'daily', weekdays: [], sortOrder: 0, createdAt: 1 });
  repo.groups.create({ id: 'g1', checklistId: 'c1', title: 'G', sortOrder: 0 });
  repo.items.create({ id: 'i1', groupId: 'g1', title: 'X', sortOrder: 0 });
  repo.items.create({ id: 'i2', groupId: 'g1', title: 'Y', sortOrder: 1 });
  repo.occurrences.createWithItems('o1', 'c1', '2026-09-10', repo.checklists.getStructure('c1'), 100);
});

describe('toggleItem', () => {
  it('勾到最后一项 -> done 且写 completedAt', () => {
    const items = repo.occurrences.getFlatItems('o1');
    toggleItem(repo, 'o1', items[0].id, 200);
    expect(repo.occurrences.get('o1')!.status).toBe('active');
    toggleItem(repo, 'o1', items[1].id, 300);
    const occ = repo.occurrences.get('o1')!;
    expect(occ.status).toBe('done');
    expect(occ.completedAt).toBe(300);
  });

  it('全完成后取消一项 -> active 且 completedAt 清空', () => {
    const items = repo.occurrences.getFlatItems('o1');
    toggleItem(repo, 'o1', items[0].id, 200);
    toggleItem(repo, 'o1', items[1].id, 300);
    toggleItem(repo, 'o1', items[1].id, 400);
    const occ = repo.occurrences.get('o1')!;
    expect(occ.status).toBe('active');
    expect(occ.completedAt).toBeNull();
  });
});
