import { describe, expect, it, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRepositories } from '@/repositories/factory';
import { createAppActions } from '@/stores/useAppStore';
import { buildExportJson, parseExportJson } from './export';

let repo: ReturnType<typeof createRepositories>;
let actions: ReturnType<typeof createAppActions>;

beforeEach(() => {
  const sqlite = new Database(':memory:');
  sqlite.exec(readFileSync(join(__dirname, '../db/migrations/0000_init.sql'), 'utf8'));
  repo = createRepositories(drizzle(sqlite) as any);
  actions = createAppActions(repo, () => '2026-09-10');
});

describe('buildExportJson / parseExportJson', () => {
  it('导出含版本号与全部表数据，可往返解析', () => {
    actions.createChecklist({
      title: 'A', icon: 'star', color: 'blue', recurrence: 'workdays', weekdays: [],
      today: '2026-09-10', groups: [{ title: 'G', items: ['x'] }],
    });
    const json = buildExportJson(repo);
    const parsed = parseExportJson(json);
    expect(parsed.version).toBe(1);
    expect(parsed.data.checklists).toHaveLength(1);
    expect(parsed.data.groups).toHaveLength(1);
    expect(parsed.data.items).toHaveLength(1);
    expect(parsed.data.occurrences.length).toBeGreaterThan(0);
    expect(parsed.data.occurrenceItems).toHaveLength(parsed.data.occurrences.length);
    expect(parsed.data.dateExceptions).toEqual([]);
    expect(parsed.data.itemResults).toEqual([]);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('损坏的 JSON 抛出可读错误', () => {
    expect(() => parseExportJson('{bad')).toThrow(/备份文件格式错误/);
  });

  it('非本应用的数据抛出格式错误', () => {
    expect(() => parseExportJson(JSON.stringify({ app: 'other', version: 1 }))).toThrow(/备份文件格式错误/);
  });
});
