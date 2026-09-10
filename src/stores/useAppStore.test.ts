import { describe, expect, it, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRepositories } from '@/repositories/factory';
import { createAppActions } from './useAppStore';

let repo: ReturnType<typeof createRepositories>;
let actions: ReturnType<typeof createAppActions>;

beforeEach(() => {
  const sqlite = new Database(':memory:');
  sqlite.exec(readFileSync(join(__dirname, '../db/migrations/0000_init.sql'), 'utf8'));
  repo = createRepositories(drizzle(sqlite) as any);
  actions = createAppActions(repo, () => '2026-09-10');
});

const input = (recurrence: any = 'daily') => ({
  title: '开机检查', icon: 'star', color: 'blue',
  recurrence, weekdays: [] as number[], today: '2026-09-10',
  groups: [{ title: '电源', items: ['看灯', '量电压'] }],
});

describe('createAppActions.createChecklist', () => {
  it('daily：建模板并懒生成今天实例，快照含 2 项', () => {
    const id = actions.createChecklist(input());
    const list = repo.occurrences.listByDate('2026-09-10');
    expect(list).toHaveLength(1);
    expect(repo.occurrences.getFlatItems(list[0].id)).toHaveLength(2);
    expect(repo.checklists.get(id)!.title).toBe('开机检查');
  });

  it('none：仅今天一个实例', () => {
    actions.createChecklist(input('none'));
    expect(repo.occurrences.listInRange('2026-09-10', '2026-09-20')).toHaveLength(1);
  });
});

describe('loadToday', () => {
  it('workdays 窗口内只生成工作日', () => {
    actions.createChecklist(input('workdays'));
    expect(actions.loadToday('2026-09-10')).toHaveLength(1); // 周四
    expect(repo.occurrences.listByDate('2026-09-12')).toHaveLength(0); // 周六
  });
});

describe('setException', () => {
  it('exclude 未来日期后该实例消失，今天保留', () => {
    const id = actions.createChecklist(input());
    actions.setException(id, '2026-09-11', 'exclude');
    const dates = repo.occurrences.listInRange('2026-09-10', '2026-09-12').map((o) => o.dueDate);
    expect(dates).toContain('2026-09-10');
    expect(dates).not.toContain('2026-09-11');
  });

  it('include 周末为 workdays 检查单补一次', () => {
    const id = actions.createChecklist(input('workdays'));
    actions.setException(id, '2026-09-12', 'include');
    expect(repo.occurrences.listByDate('2026-09-12')).toHaveLength(1);
  });

  it('null 取消例外后恢复生成', () => {
    const id = actions.createChecklist(input());
    actions.setException(id, '2026-09-11', 'exclude');
    actions.setException(id, '2026-09-11', null);
    expect(repo.occurrences.listByDate('2026-09-11')).toHaveLength(1);
  });
});
