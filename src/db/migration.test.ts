import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('0000_init migration', () => {
  it('空库可执行、表齐全、重复执行幂等', () => {
    const db = new Database(':memory:');
    const sql = readFileSync(join(__dirname, 'migrations/0000_init.sql'), 'utf8');
    db.exec(sql);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all().map((r: any) => r.name);
    for (const t of ['checklists', 'groups', 'items', 'occurrences', 'occurrence_items', 'item_results', 'date_exceptions']) {
      expect(tables).toContain(t);
    }
    expect(() => db.exec(sql)).not.toThrow();
    db.close();
  });
});
