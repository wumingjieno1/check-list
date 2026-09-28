# 检查列表 App 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一款个人单机手机 App：可建含分组/检查项的检查单，按重复周期生成每日实例，点击勾选、全部完成自动达成，日历回看与连续天数/完成率统计。

**Architecture:** Expo + React Native + TypeScript；expo-router 底部 4 Tab；expo-sqlite + Drizzle ORM 本地持久化；Zustand 薄状态层；业务规则（周期、进度、快照）为不依赖 React/DB 的纯函数，TDD 优先。模板与实例分离，实例生成时固化标题快照。

**Tech Stack:** Expo SDK（最新稳定版）、React Native、TypeScript、expo-router、expo-sqlite、drizzle-orm、zustand、expo-haptics、react-native-svg、react-native-draggable-flatlist（+ gesture-handler/reanimated）、expo-file-system + expo-sharing（导出）、Vitest（纯函数/仓储）、jest-expo + RNTL（组件）

**设计文档：** `docs/superpowers/specs/2026-09-10-checklist-app-design.md`

---

## 文件结构总览

```
app/
  _layout.tsx                       根 Layout（初始化 DB、hydrate）
  (tabs)/_layout.tsx                底部 Tab
  (tabs)/index.tsx                  今日
  (tabs)/calendar.tsx               日历
  (tabs)/templates.tsx              模板列表
  (tabs)/settings.tsx               设置
  checklist/[id].tsx                执行页（params: id=occurrenceId）
  template/edit.tsx                 模板编辑（params: checklistId?）
src/
  db/schema.ts                      Drizzle 表定义
  db/client.ts                      打开 sqlite + 建表迁移
  db/migrations/0000_init.sql       初始 SQL（规范源）
  repositories/types.ts             DTO 类型
  repositories/factory.ts           仓储工厂（注入 drizzle 实例）
  utils/date.ts                     本地日期纯函数
  utils/id.ts
  services/recurrence.ts            周期命中、日期序列（纯函数）
  services/snapshot.ts              模板结构 -> 快照行（纯函数）
  services/progress.ts              完成推导/连续天数/完成率/日聚合（纯函数）
  services/occurrence-generator.ts  懒生成/幂等/未来重建
  services/actions.ts               勾选动作 + 状态重算
  services/export.ts                全量数据导出 JSON
  stores/useAppStore.ts             zustand store + createAppActions 编排层
  theme/colors.ts
  components/Checkbox.tsx
  components/ProgressBar.tsx
  components/ProgressRing.tsx
  components/EmptyState.tsx
  components/MonthCalendar.tsx
  features/today/TodayCard.tsx
  features/checklist/GroupSection.tsx
  features/template/RepeaterEditor.tsx
vitest.config.ts  jest.config.js  jest.setup.ts  drizzle.config.ts
```

**分层约定：** UI → store/hooks → repositories（注入 drizzle 实例）→ DB。services 中 recurrence/snapshot/progress 不 import db、不 import react。组件不直接写 SQL。

---

## Task 1: 脚手架与依赖

**Files:** 整个 Expo 工程（当前仓库根目录，已存在 `docs/`、`.git/`、`.gitignore`）

- [ ] **Step 1: 在临时位置生成 Expo 模板再搬入仓库**

```bash
npx create-expo-app@latest <tmp-dir>/checklist-scaffold --template blank-typescript
cp -R <tmp-dir>/checklist-scaffold/. <repo-root>/
```

- [ ] **Step 2: 安装依赖**

```bash
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar expo-sqlite expo-haptics react-native-svg react-native-gesture-handler react-native-reanimated react-native-draggable-flatlist expo-file-system expo-sharing
npm install drizzle-orm zustand
npm install -D drizzle-kit vitest @testing-library/react-native @testing-library/jest-native jest-expo jest @types/jest better-sqlite3 @types/better-sqlite3
```

记录 `npx expo --version` 输出的 SDK 版本（后续命令与小版本无关）。

- [ ] **Step 3: 配置 expo-router 入口**

`package.json` 改 `"main": "expo-router/entry"`，删除模板自带 `App.tsx`。

`app.json`：

```json
{
  "expo": {
    "name": "检查清单",
    "slug": "check-list",
    "scheme": "checklist",
    "version": "0.1.0",
    "orientation": "portrait",
    "userInterfaceStyle": "light",
    "ios": { "supportsTablet": true },
    "android": { "package": "com.local.checklist" },
    "plugins": ["expo-router"]
  }
}
```

- [ ] **Step 4: tsconfig 路径别名**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

- [ ] **Step 5: 测试配置**

`package.json` scripts 增加：

```json
"test:unit": "vitest run",
"test:component": "jest",
"test": "npm run test:unit && npm run test:component",
"typecheck": "tsc --noEmit",
"start": "expo start"
```

`vitest.config.ts`：

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: { environment: 'node', include: ['src/**/*.test.ts'], passWithNoTests: true },
});
```

`jest.config.js`：

```js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['**/*.component.test.tsx'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-gesture-handler|react-native-reanimated|react-native-draggable-flatlist|drizzle-orm))',
  ],
};
```

`jest.setup.ts`：

```ts
import '@testing-library/react-native/extend-expect';
```

- [ ] **Step 6: 冒烟验证并提交**

Run: `npx tsc --noEmit` → 无错误
Run: `npm run test:unit` → 通过（无测试文件）

```bash
git add -A
git commit -m "chore: 初始化 Expo + expo-router + 测试脚手架"
```

---

## Task 2: 本地日期工具（TDD）

**Files:** Create `src/utils/date.ts`, Test `src/utils/date.test.ts`

全 App 使用本地时区日期字符串 `YYYY-MM-DD`。

- [ ] **Step 1: 写失败测试** — `src/utils/date.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import {
  toDateStr, fromDateStr, addDays, diffDays, weekday,
  startOfToday, todayStr, eachDay, mondayOfWeek, formatCN,
} from './date';

describe('date utils', () => {
  it('toDateStr/fromDateStr 往返且补零', () => {
    expect(toDateStr(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(fromDateStr('2026-01-05').getDate()).toBe(5);
  });
  it('weekday: 周一=1 … 周日=7', () => {
    expect(weekday(new Date(2026, 8, 7))).toBe(1);
    expect(weekday(new Date(2026, 8, 13))).toBe(7);
  });
  it('addDays/diffDays 跨月', () => {
    expect(toDateStr(addDays(new Date(2026, 8, 30), 3))).toBe('2026-10-03');
    expect(diffDays('2026-10-03', '2026-09-30')).toBe(3);
  });
  it('eachDay 含首尾', () => {
    expect(eachDay('2026-09-10', '2026-09-12')).toEqual(['2026-09-10', '2026-09-11', '2026-09-12']);
  });
  it('mondayOfWeek', () => {
    expect(toDateStr(mondayOfWeek(new Date(2026, 8, 10)))).toBe('2026-09-07');
  });
  it('formatCN', () => {
    expect(formatCN('2026-09-10')).toBe('9月10日');
  });
  it('todayStr 与 startOfToday', () => {
    expect(todayStr()).toBe(toDateStr(new Date()));
    expect(startOfToday().getHours()).toBe(0);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/utils/date.test.ts` → FAIL（模块不存在）

- [ ] **Step 3: 实现** — `src/utils/date.ts`：

```ts
export type DateStr = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateStr(d: Date): DateStr {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function fromDateStr(s: DateStr): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
export function todayStr(): DateStr {
  return toDateStr(new Date());
}
export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
export function diffDays(a: DateStr, b: DateStr): number {
  return Math.round((fromDateStr(a).getTime() - fromDateStr(b).getTime()) / 86_400_000);
}
export function weekday(d: Date): number {
  const js = d.getDay();
  return js === 0 ? 7 : js;
}
export function eachDay(start: DateStr, end: DateStr): DateStr[] {
  const out: DateStr[] = [];
  let cur = fromDateStr(start);
  const last = fromDateStr(end);
  while (cur <= last) {
    out.push(toDateStr(cur));
    cur = addDays(cur, 1);
  }
  return out;
}
export function mondayOfWeek(d: Date): Date {
  return addDays(d, -(weekday(d) - 1));
}
export function formatCN(s: DateStr): string {
  const [, m, d] = s.split('-').map(Number);
  return `${m}月${d}日`;
}
```

- [ ] **Step 4: 通过并提交**

Run: `npx vitest run src/utils/date.test.ts` → PASS

```bash
git add src/utils/
git commit -m "feat: 本地日期工具函数"
```

---

## Task 3: 数据库 schema 与建表迁移（TDD）

**Files:** Create `src/db/schema.ts`, `src/db/migrations/0000_init.sql`, `src/db/client.ts`, `drizzle.config.ts`; Test `src/db/migration.test.ts`

- [ ] **Step 1: 定义 schema** — `src/db/schema.ts`：

```ts
import { integer, sqliteTable, text, primaryKey, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

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
```

- [ ] **Step 2: 初始迁移 SQL（规范源）** — `src/db/migrations/0000_init.sql`：

```sql
CREATE TABLE IF NOT EXISTS checklists (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'checkmark-circle-outline',
  color TEXT NOT NULL DEFAULT 'green',
  recurrence TEXT NOT NULL DEFAULT 'none',
  weekdays TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  checklist_id TEXT NOT NULL,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS occurrences (
  id TEXT PRIMARY KEY,
  checklist_id TEXT NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  completed_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS occurrence_items (
  id TEXT PRIMARY KEY,
  occurrence_id TEXT NOT NULL,
  source_item_id TEXT NOT NULL,
  group_title TEXT NOT NULL,
  group_sort_order INTEGER NOT NULL,
  item_title TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS item_results (
  occurrence_item_id TEXT PRIMARY KEY,
  done INTEGER NOT NULL DEFAULT 0,
  toggled_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS date_exceptions (
  id TEXT PRIMARY KEY,
  checklist_id TEXT NOT NULL,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_exc_cl_date ON date_exceptions(checklist_id, date);
CREATE INDEX IF NOT EXISTS idx_occ_date ON occurrences(due_date);
CREATE INDEX IF NOT EXISTS idx_occ_cl ON occurrences(checklist_id);
CREATE INDEX IF NOT EXISTS idx_oitem_occ ON occurrence_items(occurrence_id);
```

`drizzle.config.ts`：

```ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
} satisfies Config;
```

- [ ] **Step 3: 迁移 SQL 测试** — `src/db/migration.test.ts`：

```ts
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
```

Run: `npx vitest run src/db/migration.test.ts` → PASS

- [ ] **Step 4: 生产 db client** — `src/db/client.ts`：

```ts
import * as SQLite from 'expo-sqlite';
import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

let db: ExpoSQLiteDatabase<typeof schema> | null = null;

export const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS checklists (
  id TEXT PRIMARY KEY, title TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'checkmark-circle-outline',
  color TEXT NOT NULL DEFAULT 'green', recurrence TEXT NOT NULL DEFAULT 'none',
  weekdays TEXT NOT NULL DEFAULT '[]', sort_order INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY, checklist_id TEXT NOT NULL, title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY, group_id TEXT NOT NULL, title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS occurrences (
  id TEXT PRIMARY KEY, checklist_id TEXT NOT NULL, due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', completed_at INTEGER, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS occurrence_items (
  id TEXT PRIMARY KEY, occurrence_id TEXT NOT NULL, source_item_id TEXT NOT NULL,
  group_title TEXT NOT NULL, group_sort_order INTEGER NOT NULL,
  item_title TEXT NOT NULL, sort_order INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS item_results (
  occurrence_item_id TEXT PRIMARY KEY, done INTEGER NOT NULL DEFAULT 0, toggled_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS date_exceptions (
  id TEXT PRIMARY KEY, checklist_id TEXT NOT NULL, date TEXT NOT NULL,
  type TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_exc_cl_date ON date_exceptions(checklist_id, date);
CREATE INDEX IF NOT EXISTS idx_occ_date ON occurrences(due_date);
CREATE INDEX IF NOT EXISTS idx_occ_cl ON occurrences(checklist_id);
CREATE INDEX IF NOT EXISTS idx_oitem_occ ON occurrence_items(occurrence_id);
`;

export function getDb(): ExpoSQLiteDatabase<typeof schema> {
  if (db) return db;
  const sqlite = SQLite.openDatabaseSync('checklist.db');
  sqlite.execSync(MIGRATION_SQL);
  db = drizzle(sqlite, { schema });
  return db;
}
```

> 维护约定：`MIGRATION_SQL` 与 `0000_init.sql` 内容保持一致。第一版仅一版迁移，直接内联。

- [ ] **Step 5: 全量验证并提交**

Run: `npm run test:unit` → PASS；`npx tsc --noEmit` → 无错误

```bash
git add src/db/ drizzle.config.ts
git commit -m "feat: 数据库 schema、初始迁移与客户端"
```

---

## Task 4: 重复规则纯函数（TDD）

**Files:** Create `src/services/recurrence.ts`, Test `src/services/recurrence.test.ts`

- [ ] **Step 1: 写失败测试** — `src/services/recurrence.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { isScheduled, buildSchedule } from './recurrence';
import type { RuleInput } from './recurrence';

const mk = (recurrence: RuleInput['recurrence'], weekdays: number[] = [], exceptions: RuleInput['exceptions'] = []): RuleInput =>
  ({ recurrence, weekdays, exceptions });

describe('isScheduled', () => {
  it('none 仅在起始日命中', () => {
    expect(isScheduled('2026-09-10', mk('none'), '2026-09-10')).toBe(true);
    expect(isScheduled('2026-09-11', mk('none'), '2026-09-10')).toBe(false);
  });
  it('daily 每天命中', () => {
    expect(isScheduled('2026-12-25', mk('daily'), '2026-09-10')).toBe(true);
  });
  it('weekly 仅命中所选星期（跨月）', () => {
    const rule = mk('weekly', [1, 3]);
    expect(isScheduled('2026-09-07', rule, '2026-09-07')).toBe(true);
    expect(isScheduled('2026-10-05', rule, '2026-09-07')).toBe(true); // 周一
    expect(isScheduled('2026-09-08', rule, '2026-09-07')).toBe(false);
  });
  it('workdays 周一到周五命中、周末不命中', () => {
    expect(isScheduled('2026-09-11', mk('workdays'), '2026-09-07')).toBe(true);
    expect(isScheduled('2026-09-12', mk('workdays'), '2026-09-07')).toBe(false);
    expect(isScheduled('2026-09-13', mk('workdays'), '2026-09-07')).toBe(false);
  });
  it('exclude 例外跳过本来命中的工作日', () => {
    const rule = mk('workdays', [], [{ date: '2026-10-01', type: 'exclude' }]);
    expect(isScheduled('2026-10-01', rule, '2026-09-07')).toBe(false);
  });
  it('include 例外可在周末补一次', () => {
    const rule = mk('workdays', [], [{ date: '2026-10-10', type: 'include' }]);
    expect(isScheduled('2026-10-10', rule, '2026-09-07')).toBe(true);
  });
  it('none 不响应 include（一次性不补做）', () => {
    const rule = mk('none', [], [{ date: '2026-09-20', type: 'include' }]);
    expect(isScheduled('2026-09-20', rule, '2026-09-10')).toBe(false);
  });
});

describe('buildSchedule', () => {
  it('生成窗口内全部命中日期且排序', () => {
    expect(buildSchedule(mk('workdays'), '2026-09-10', '2026-09-14'))
      .toEqual(['2026-09-10', '2026-09-11', '2026-09-14']);
  });
  it('同一天 include+exclude 冲突时 exclude 优先', () => {
    const rule = mk('daily', [], [
      { date: '2026-09-11', type: 'include' },
      { date: '2026-09-11', type: 'exclude' },
    ]);
    expect(buildSchedule(rule, '2026-09-10', '2026-09-12')).not.toContain('2026-09-11');
  });
});
```

Run: `npx vitest run src/services/recurrence.test.ts` → FAIL（模块不存在）

- [ ] **Step 2: 实现** — `src/services/recurrence.ts`：

```ts
import { eachDay, fromDateStr, weekday } from '@/utils/date';

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'workdays';

export interface RuleException {
  date: string;
  type: 'exclude' | 'include';
}

export interface RuleInput {
  recurrence: RecurrenceType;
  weekdays: number[];
  exceptions: RuleException[];
}

export function isScheduled(date: string, rule: RuleInput, startDate: string): boolean {
  const exception = new Map(rule.exceptions.map((e) => [e.date, e.type])).get(date);
  if (exception === 'exclude') return false;
  if (exception === 'include' && rule.recurrence !== 'none') return true;

  const day = fromDateStr(date);
  switch (rule.recurrence) {
    case 'daily':
      return true;
    case 'weekly':
      return rule.weekdays.includes(weekday(day));
    case 'workdays':
      return weekday(day) <= 5;
    case 'none':
    default:
      return date === startDate;
  }
}

export function buildSchedule(rule: RuleInput, start: string, end: string): string[] {
  return eachDay(start, end).filter((d) => isScheduled(d, rule, start));
}
```

Run: `npx vitest run src/services/recurrence.test.ts` → PASS

- [ ] **Step 3: 提交**

```bash
git add src/services/recurrence.ts src/services/recurrence.test.ts
git commit -m "feat: 重复规则与日期例外表逻辑"
```

---

## Task 5: 快照与进度纯函数（TDD）

**Files:** Create `src/services/snapshot.ts`, `src/services/progress.ts`; Tests 同名 `.test.ts`

- [ ] **Step 1: snapshot 测试** — `src/services/snapshot.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { buildSnapshots } from './snapshot';

const template = {
  groups: [
    { id: 'g1', title: '电源', sortOrder: 0, items: [
      { id: 'i1', title: '看指示灯', sortOrder: 0 },
      { id: 'i2', title: '量电压', sortOrder: 1 },
    ]},
    { id: 'g2', title: '传动', sortOrder: 1, items: [
      { id: 'i3', title: '查传送带', sortOrder: 0 },
    ]},
  ],
};

describe('buildSnapshots', () => {
  it('拍平并保留组/项顺序与标题', () => {
    expect(buildSnapshots('occ1', template)).toEqual([
      { occurrenceId: 'occ1', sourceItemId: 'i1', groupTitle: '电源', groupSortOrder: 0, itemTitle: '看指示灯', sortOrder: 0 },
      { occurrenceId: 'occ1', sourceItemId: 'i2', groupTitle: '电源', groupSortOrder: 0, itemTitle: '量电压', sortOrder: 1 },
      { occurrenceId: 'occ1', sourceItemId: 'i3', groupTitle: '传动', groupSortOrder: 1, itemTitle: '查传送带', sortOrder: 0 },
    ]);
  });
  it('空分组不产生行', () => {
    expect(buildSnapshots('o', { groups: [{ id: 'g', title: '空', sortOrder: 0, items: [] }] })).toEqual([]);
  });
});
```

- [ ] **Step 2: 实现 snapshot** — `src/services/snapshot.ts`：

```ts
export interface TemplateItem { id: string; title: string; sortOrder: number }
export interface TemplateGroup { id: string; title: string; sortOrder: number; items: TemplateItem[] }
export interface TemplateStructure { groups: TemplateGroup[] }

export interface SnapshotRow {
  occurrenceId: string;
  sourceItemId: string;
  groupTitle: string;
  groupSortOrder: number;
  itemTitle: string;
  sortOrder: number;
}

export function buildSnapshots(occurrenceId: string, template: TemplateStructure): SnapshotRow[] {
  const rows: SnapshotRow[] = [];
  for (const g of [...template.groups].sort((a, b) => a.sortOrder - b.sortOrder)) {
    for (const it of [...g.items].sort((a, b) => a.sortOrder - b.sortOrder)) {
      rows.push({
        occurrenceId,
        sourceItemId: it.id,
        groupTitle: g.title,
        groupSortOrder: g.sortOrder,
        itemTitle: it.title,
        sortOrder: it.sortOrder,
      });
    }
  }
  return rows;
}
```

Run: `npx vitest run src/services/snapshot.test.ts` → PASS

- [ ] **Step 3: progress 测试** — `src/services/progress.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { occurrenceProgress, nextUndoneItemId, groupByGroup, dayStatus, streak, completionRate } from './progress';
import type { FlatItem } from './progress';

const items: FlatItem[] = [
  { occurrenceItemId: 'a', groupTitle: 'G1', groupSortOrder: 0, itemTitle: 'x', sortOrder: 0, done: 1 },
  { occurrenceItemId: 'b', groupTitle: 'G1', groupSortOrder: 0, itemTitle: 'y', sortOrder: 1, done: 0 },
  { occurrenceItemId: 'c', groupTitle: 'G2', groupSortOrder: 1, itemTitle: 'z', sortOrder: 0, done: 0 },
];

describe('occurrenceProgress', () => {
  it('统计并推导 done', () => {
    expect(occurrenceProgress([items[0]])).toEqual({ total: 1, done: 1, isDone: true });
    expect(occurrenceProgress(items)).toEqual({ total: 3, done: 1, isDone: false });
    expect(occurrenceProgress([])).toEqual({ total: 0, done: 0, isDone: false });
  });
});

describe('nextUndoneItemId', () => {
  it('按组/项顺序返回第一个未完成，全完成返回 null', () => {
    expect(nextUndoneItemId(items)).toBe('b');
    expect(nextUndoneItemId(items.map((i) => ({ ...i, done: 1 })))).toBeNull();
  });
});

describe('groupByGroup', () => {
  it('按组聚合排序并统计', () => {
    const gs = groupByGroup(items);
    expect(gs.map((g) => g.title)).toEqual(['G1', 'G2']);
    expect(gs[0]).toMatchObject({ done: 1, total: 2 });
  });
});

describe('dayStatus', () => {
  it('全完成 done / 部分 partial / 全未 missed / 空 none', () => {
    expect(dayStatus([{ status: 'done' }, { status: 'done' }])).toBe('done');
    expect(dayStatus([{ status: 'done' }, { status: 'active' }])).toBe('partial');
    expect(dayStatus([{ status: 'active' }])).toBe('missed');
    expect(dayStatus([])).toBe('none');
  });
});

describe('streak', () => {
  it('从今天往回数连续 done，中断即止，忽略未来', () => {
    const dates = {
      '2026-09-10': 'done' as const, '2026-09-09': 'done' as const,
      '2026-09-08': 'done' as const, '2026-09-07': 'missed' as const,
      '2026-09-11': 'done' as const,
    };
    expect(streak(dates, '2026-09-10')).toBe(3);
  });
  it('今天非 done 时从昨天起算', () => {
    const dates = { '2026-09-10': 'partial' as const, '2026-09-09': 'done' as const, '2026-09-08': 'done' as const };
    expect(streak(dates, '2026-09-10')).toBe(2);
  });
});

describe('completionRate', () => {
  it('done 天数 / 有安排天数；无安排返回 0', () => {
    const days = [
      { status: 'done' as const }, { status: 'done' as const }, { status: 'partial' as const },
    ];
    expect(completionRate(days)).toBeCloseTo(2 / 3);
    expect(completionRate([{ status: 'none' as const }])).toBe(0);
  });
});
```

- [ ] **Step 4: 实现 progress** — `src/services/progress.ts`：

```ts
import { addDays, fromDateStr, toDateStr } from '@/utils/date';

export interface FlatItem {
  occurrenceItemId: string;
  groupTitle: string;
  groupSortOrder: number;
  itemTitle: string;
  sortOrder: number;
  done: number;
}

export interface GroupView {
  title: string;
  sortOrder: number;
  items: FlatItem[];
  done: number;
  total: number;
}

export function occurrenceProgress(items: FlatItem[]) {
  const total = items.length;
  const done = items.filter((i) => i.done === 1).length;
  return { total, done, isDone: total > 0 && done === total };
}

export function nextUndoneItemId(items: FlatItem[]): string | null {
  const sorted = [...items].sort((a, b) => a.groupSortOrder - b.groupSortOrder || a.sortOrder - b.sortOrder);
  return sorted.find((i) => i.done === 0)?.occurrenceItemId ?? null;
}

export function groupByGroup(items: FlatItem[]): GroupView[] {
  const map = new Map<string, GroupView>();
  for (const it of items) {
    const key = `${it.groupSortOrder}:${it.groupTitle}`;
    if (!map.has(key)) {
      map.set(key, { title: it.groupTitle, sortOrder: it.groupSortOrder, items: [], done: 0, total: 0 });
    }
    const g = map.get(key)!;
    g.items.push(it);
    g.total += 1;
    if (it.done === 1) g.done += 1;
  }
  return [...map.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

export type DayStatusValue = 'done' | 'partial' | 'missed' | 'none';

export function dayStatus(occurrences: { status: string }[]): DayStatusValue {
  if (occurrences.length === 0) return 'none';
  if (occurrences.every((o) => o.status === 'done')) return 'done';
  return occurrences.some((o) => o.status === 'done') ? 'partial' : 'missed';
}

export function streak(dates: Record<string, DayStatusValue>, today: string): number {
  let cursor = dates[today] === 'done' ? today : toDateStr(addDays(fromDateStr(today), -1));
  let count = 0;
  while (dates[cursor] === 'done') {
    count += 1;
    cursor = toDateStr(addDays(fromDateStr(cursor), -1));
  }
  return count;
}

export function completionRate(days: { status: DayStatusValue }[]): number {
  const scheduled = days.filter((d) => d.status !== 'none');
  if (scheduled.length === 0) return 0;
  return scheduled.filter((d) => d.status === 'done').length / scheduled.length;
}
```

Run: `npm run test:unit` → 全 PASS；`npx tsc --noEmit` → 无错误

- [ ] **Step 5: 提交**

```bash
git add src/services/
git commit -m "feat: 快照构建与进度/连续天数/完成率纯函数"
```

---

## Task 6: 仓储层（TDD，better-sqlite3）

**Files:** Create `src/repositories/types.ts`, `src/repositories/factory.ts`; Test `src/repositories/factory.test.ts`

仓储用工厂函数注入 drizzle 实例；测试用 `drizzle-orm/better-sqlite3`（同步 API），生产用 `drizzle-orm/expo-sqlite`（同样同步）。

- [ ] **Step 1: DTO 类型** — `src/repositories/types.ts`：

```ts
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'workdays';

export interface ChecklistDTO {
  id: string;
  title: string;
  icon: string;
  color: string;
  recurrence: RecurrenceType;
  weekdays: number[];
  sortOrder: number;
  isArchived: boolean;
  createdAt: number;
}
export interface GroupDTO { id: string; checklistId: string; title: string; sortOrder: number }
export interface ItemDTO { id: string; groupId: string; title: string; sortOrder: number }
export interface OccurrenceDTO {
  id: string; checklistId: string; dueDate: string;
  status: 'active' | 'done'; completedAt: number | null; createdAt: number;
}
export interface OccurrenceItemDTO {
  id: string; occurrenceId: string; sourceItemId: string;
  groupTitle: string; groupSortOrder: number; itemTitle: string; sortOrder: number;
  done: number; toggledAt: number | null;
}
export interface ExceptionDTO {
  id: string; checklistId: string; date: string; type: 'exclude' | 'include';
}
```

- [ ] **Step 2: 写失败测试** — `src/repositories/factory.test.ts`：

```ts
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
```

Run: `npx vitest run src/repositories/factory.test.ts` → FAIL（模块不存在）

- [ ] **Step 3: 实现仓储工厂** — `src/repositories/factory.ts`：

```ts
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
```

- [ ] **Step 4: 验证并提交**

Run: `npx vitest run src/repositories/factory.test.ts` → PASS
Run: `npm run test:unit` → PASS；`npx tsc --noEmit` → 无错误

```bash
git add src/repositories/
git commit -m "feat: 仓储层（检查单/分组/项/实例/结果/例外）"
```

---

## Task 7: 实例生成服务（TDD）

**Files:** Create `src/services/occurrence-generator.ts`; Test `src/services/occurrence-generator.test.ts`

- [ ] **Step 1: 失败测试**

```ts
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
});
```

Run: `npx vitest run src/services/occurrence-generator.test.ts` → FAIL

- [ ] **Step 2: 实现** — `src/services/occurrence-generator.ts`：

```ts
import { addDays, fromDateStr, toDateStr } from '@/utils/date';
import { buildSchedule } from './recurrence';
import type { createRepositories } from '@/repositories/factory';

type Repo = ReturnType<typeof createRepositories>;

function scheduleFor(repo: Repo, checklistId: string, recurrence: any, weekdays: number[], today: string, daysAhead: number) {
  const end = toDateStr(addDays(fromDateStr(today), daysAhead));
  const exceptions = repo.exceptions.listForChecklist(checklistId)
    .map((e) => ({ date: e.date, type: e.type }));
  return buildSchedule({ recurrence, weekdays, exceptions }, today, end);
}

function isEmptyTemplate(repo: Repo, checklistId: string): boolean {
  return repo.checklists.getStructure(checklistId).groups.every((g) => g.items.length === 0);
}

export function ensureWindow(repo: Repo, today: string, daysAhead: number, now: number): number {
  let created = 0;
  for (const c of repo.checklists.listActive()) {
    if (isEmptyTemplate(repo, c.id)) continue;
    for (const dueDate of scheduleFor(repo, c.id, c.recurrence, c.weekdays, today, daysAhead)) {
      if (repo.occurrences.exists(c.id, dueDate)) continue;
      repo.occurrences.createWithItems(
        `occ:${c.id}:${dueDate}`, c.id, dueDate,
        repo.checklists.getStructure(c.id), now,
      );
      created += 1;
    }
  }
  return created;
}

export function rebuildFutureForChecklist(repo: Repo, checklistId: string, today: string, daysAhead: number, now: number) {
  repo.occurrences.deleteFutureUntouched(checklistId, today);
  const c = repo.checklists.get(checklistId);
  if (!c || c.isArchived || isEmptyTemplate(repo, checklistId)) return;
  for (const dueDate of scheduleFor(repo, checklistId, c.recurrence, c.weekdays, today, daysAhead)) {
    if (repo.occurrences.exists(checklistId, dueDate)) continue;
    repo.occurrences.createWithItems(
      `occ:${checklistId}:${dueDate}`, checklistId, dueDate,
      repo.checklists.getStructure(checklistId), now,
    );
  }
}
```

Run: `npx vitest run src/services/occurrence-generator.test.ts` → PASS

- [ ] **Step 3: 提交**

```bash
git add src/services/occurrence-generator.ts src/services/occurrence-generator.test.ts
git commit -m "feat: 实例懒生成/幂等与未来重建服务"
```

---

## Task 8: 勾选动作与完成重算（TDD）

**Files:** Create `src/services/actions.ts`; Test `src/services/actions.test.ts`

- [ ] **Step 1: 失败测试**

```ts
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
```

- [ ] **Step 2: 实现** — `src/services/actions.ts`：

```ts
import type { createRepositories } from '@/repositories/factory';
import { occurrenceProgress } from './progress';

type Repo = ReturnType<typeof createRepositories>;

export function toggleItem(repo: Repo, occurrenceId: string, occurrenceItemId: string, now: number) {
  repo.results.toggle(occurrenceItemId, now);
  const items = repo.occurrences.getFlatItems(occurrenceId);
  const { isDone } = occurrenceProgress(items);
  repo.occurrences.setStatus(occurrenceId, isDone, now);
  return { isDone, items };
}
```

`occurrenceProgress(items)` 直接接受 `OccurrenceItemDTO[]`（其结构与 `FlatItem` 兼容：都有 done）。

Run: `npx vitest run src/services/actions.test.ts` → PASS；`npm run test:unit` → 全 PASS

- [ ] **Step 3: 提交**

```bash
git add src/services/actions.ts src/services/actions.test.ts
git commit -m "feat: 勾选动作与实例完成状态重算"
```

---

## Task 9: ID 工具、Zustand store 与编排层（TDD）

**Files:** Create `src/utils/id.ts`, `src/stores/useAppStore.ts`; Test `src/stores/useAppStore.test.ts`

- [ ] **Step 1: ID 工具** — `src/utils/id.ts`：

```ts
export function uuid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
```

- [ ] **Step 2: 失败测试** — `src/stores/useAppStore.test.ts`：

```ts
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
```

Run: `npx vitest run src/stores/useAppStore.test.ts` → FAIL

- [ ] **Step 3: 实现 store/编排层** — `src/stores/useAppStore.ts`：

```ts
import { create } from 'zustand';
import { getDb } from '@/db/client';
import { createRepositories } from '@/repositories/factory';
import { ensureWindow, rebuildFutureForChecklist } from '@/services/occurrence-generator';
import { toggleItem as toggleAction } from '@/services/actions';
import { occurrenceProgress, nextUndoneItemId } from '@/services/progress';
import { todayStr } from '@/utils/date';
import { uuid } from '@/utils/id';
import type { RecurrenceType } from '@/repositories/types';

export const WINDOW_DAYS = 30;
export const repo = createRepositories(getDb() as any);

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
    toggleAction(repo, row.occurrenceId, row.quickTargetItemId, Date.now());
    get().loadToday();
  },
}));

type Repo = ReturnType<typeof createRepositories>;

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

    updateRecurrence(checklistId: string, patch: { recurrence: RecurrenceType; weekdays: number[] }) {
      r.checklists.update(checklistId, patch);
      rebuildFutureForChecklist(r, checklistId, getToday(), WINDOW_DAYS, Date.now());
    },

    replaceStructure(checklistId: string, groups: { id?: string; title: string; sortOrder: number; items: { id?: string; title: string; sortOrder: number }[] }[]) {
      // 全量替换模板结构（编辑页提交时调用），随后重建未触碰的未来实例
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
```

Run: `npm run test:unit` → 全 PASS；`npx tsc --noEmit` → 无错误

- [ ] **Step 4: 提交**

```bash
git add src/utils/id.ts src/stores/
git commit -m "feat: zustand store 与建单/结构编辑/例外编排"
```

---

## Task 10: 主题与基础组件

**Files:** Create `src/theme/colors.ts`, `src/components/Checkbox.tsx`, `src/components/ProgressBar.tsx`, `src/components/ProgressRing.tsx`, `src/components/EmptyState.tsx`

- [ ] **Step 1: 主题** — `src/theme/colors.ts`：

```ts
export const palette = {
  green: '#34C759',
  blue: '#0A7FFF',
  orange: '#FF9F0A',
  purple: '#AF52DE',
  red: '#FF3B30',
  gray: '#8E8E93',
  lightGray: '#F2F2F7',
  border: '#D5D5DD',
  text: '#1C1C1E',
  subtext: '#8A8A8F',
  danger: '#FF3B30',
  bg: '#FAFAFA',
  white: '#FFFFFF',
};

export const checklistColors: Record<string, string> = {
  green: palette.green,
  blue: palette.blue,
  orange: palette.orange,
  purple: palette.purple,
  red: palette.red,
};
```

- [ ] **Step 2: Checkbox（行右侧操作钮，触感反馈）** — `src/components/Checkbox.tsx`：

```tsx
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '@/theme/colors';

interface Props {
  checked: boolean;
  onChange: () => void;
  color?: string;
  disabled?: boolean;
  size?: number;
}

export function Checkbox({ checked, onChange, color = palette.green, disabled = false, size = 24 }: Props) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      hitSlop={10}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onChange();
      }}
      style={styles.hit}
    >
      <View style={[
        styles.box,
        { width: size, height: size, borderColor: checked ? color : palette.gray },
        checked && { backgroundColor: color },
        disabled && styles.disabled,
      ]}>
        {checked && <Ionicons name="checkmark" size={size - 9} color="#fff" />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  box: { borderWidth: 2, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
});
```

- [ ] **Step 3: ProgressBar / ProgressRing / EmptyState**

`src/components/ProgressBar.tsx`：

```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { palette } from '@/theme/colors';

export function ProgressBar({ value, color = palette.green }: { value: number; color?: string }) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: 3, backgroundColor: palette.lightGray, overflow: 'hidden', marginTop: 6 },
  fill: { height: '100%', borderRadius: 3 },
});
```

`src/components/ProgressRing.tsx`（react-native-svg）：

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { palette } from '@/theme/colors';

export function ProgressRing({ done, total, size = 110, color = palette.green }: {
  done: number; total: number; size?: number; color?: string;
}) {
  const thickness = 10;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const pct = total === 0 ? 0 : done / total;
  return (
    <View style={{ width: size, height: size, alignSelf: 'center', marginVertical: 12 }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={palette.lightGray} strokeWidth={thickness} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={thickness} fill="none"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={styles.text}>{done}/{total}</Text>
        <Text style={styles.pct}>{Math.round(pct * 100)}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 20, fontWeight: '700', color: palette.text },
  pct: { fontSize: 12, color: palette.subtext },
});
```

`src/components/EmptyState.tsx`：

```tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { palette } from '@/theme/colors';

export function EmptyState({ title, subtitle, actionLabel, onAction }: {
  title: string; subtitle?: string; actionLabel?: string; onAction?: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      {actionLabel ? (
        <Pressable style={styles.btn} onPress={onAction} accessibilityRole="button">
          <Text style={styles.btnText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  title: { fontSize: 17, fontWeight: '600', color: palette.text, textAlign: 'center' },
  sub: { fontSize: 14, color: palette.subtext, textAlign: 'center' },
  btn: { marginTop: 12, backgroundColor: palette.blue, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
```

- [ ] **Step 4: 验证提交**

Run: `npx tsc --noEmit` → 无错误

```bash
git add src/theme/ src/components/
git commit -m "feat: 主题色与基础组件（勾选钮/进度条/进度环/空状态）"
```

---

## Task 11: 根 Layout 与 Tab 框架

**Files:** Create `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, 四个占位 Tab 页

- [ ] **Step 1: 根 Layout** — `app/_layout.tsx`：

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAppStore } from '@/stores/useAppStore';
import { palette } from '@/theme/colors';

export default function RootLayout() {
  const hydrate = useAppStore((s) => s.hydrate);
  const hydrated = useAppStore((s) => s.hydrated);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      hydrate();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [hydrate]);

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: palette.text }}>数据库初始化失败：{error}</Text>
      </View>
    );
  }
  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={palette.blue} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="checklist/[id]" options={{ presentation: 'card', headerShown: true, title: '' }} />
        <Stack.Screen name="template/edit" options={{ presentation: 'modal', headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 2: Tab Layout** — `app/(tabs)/_layout.tsx`：

```tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '@/theme/colors';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: palette.blue,
      tabBarInactiveTintColor: palette.gray,
      headerStyle: { backgroundColor: palette.bg },
    }}>
      <Tabs.Screen name="index" options={{
        title: '今日',
        tabBarIcon: ({ color, size }) => <Ionicons name="today-outline" color={color} size={size} />,
      }} />
      <Tabs.Screen name="calendar" options={{
        title: '日历',
        tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" color={color} size={size} />,
      }} />
      <Tabs.Screen name="templates" options={{
        title: '模板',
        tabBarIcon: ({ color, size }) => <Ionicons name="list-outline" color={color} size={size} />,
      }} />
      <Tabs.Screen name="settings" options={{
        title: '设置',
        tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} />,
      }} />
    </Tabs>
  );
}
```

- [ ] **Step 3: 四个占位页**（内容相同，后续任务逐个替换）

`app/(tabs)/index.tsx`、`calendar.tsx`、`templates.tsx`、`settings.tsx`：

```tsx
import React from 'react';
import { View, Text } from 'react-native';

export default function Placeholder() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>TODO</Text>
    </View>
  );
}
```

- [ ] **Step 4: 验证提交**

Run: `npx tsc --noEmit`

```bash
git add app/
git commit -m "feat: 根 Layout 与底部 Tab 框架"
```

---

## Task 12: 今日页 + TodayCard

**Files:** Create `src/features/today/TodayCard.tsx`; Replace `app/(tabs)/index.tsx`

- [ ] **Step 1: TodayCard** — `src/features/today/TodayCard.tsx`：

```tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Checkbox } from '@/components/Checkbox';
import { ProgressBar } from '@/components/ProgressBar';
import { checklistColors, palette } from '@/theme/colors';
import type { TodayRow } from '@/stores/useAppStore';

interface Props {
  row: TodayRow;
  onOpen: () => void;
  onQuickToggle: () => void;
}

export function TodayCard({ row, onOpen, onQuickToggle }: Props) {
  const done = row.status === 'done';
  const color = checklistColors[row.color] ?? palette.green;
  return (
    <Pressable onPress={onOpen} style={[styles.card, done && styles.cardDone]} accessibilityRole="button">
      <View style={styles.top}>
        <Ionicons name={(row.icon as any) ?? 'checkmark-circle-outline'} size={20} color={color} />
        <Text style={[styles.title, done && styles.doneText]} numberOfLines={1}>{row.title}</Text>
        <Text style={styles.count}>{row.done}/{row.total}</Text>
        <Checkbox checked={done} onChange={onQuickToggle} color={color} disabled={done} />
      </View>
      <ProgressBar value={row.total === 0 ? 0 : row.done / row.total} color={color} />
      <Text style={styles.state}>
        {done ? '已完成' : row.done > 0 ? `进行中 ${row.done}/${row.total}` : '未开始'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.white, borderRadius: 12, borderWidth: 1, borderColor: palette.border, padding: 14, marginBottom: 10 },
  cardDone: { opacity: 0.55 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '600', color: palette.text, flexShrink: 1 },
  doneText: { textDecorationLine: 'line-through' },
  count: { fontSize: 12, color: palette.subtext, marginLeft: 'auto' },
  state: { fontSize: 12, color: palette.subtext, marginTop: 4 },
});
```

- [ ] **Step 2: 今日页** — 替换 `app/(tabs)/index.tsx`：

```tsx
import React, { useCallback, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAppStore, repo } from '@/stores/useAppStore';
import { TodayCard } from '@/features/today/TodayCard';
import { EmptyState } from '@/components/EmptyState';
import { palette } from '@/theme/colors';
import {
  addDays, eachDay, formatCN, fromDateStr, toDateStr, todayStr, weekday,
} from '@/utils/date';
import { dayStatus, streak } from '@/services/progress';

const WEEK_CN = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export default function TodayScreen() {
  const router = useRouter();
  const rows = useAppStore((s) => s.todayRows);
  const loadToday = useAppStore((s) => s.loadToday);
  const today = todayStr();

  useFocusEffect(useCallback(() => {
    loadToday(today);
  }, [loadToday, today]));

  const sorted = useMemo(
    () => [...rows].sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done')),
    [rows],
  );

  const streakCount = useMemo(() => {
    const start = toDateStr(addDays(fromDateStr(today), -29));
    const occs = repo.occurrences.listInRange(start, today);
    const byDate = new Map<string, string[]>();
    for (const o of occs) byDate.set(o.dueDate, [...(byDate.get(o.dueDate) ?? []), o.status]);
    const map: Record<string, 'done' | 'partial' | 'missed' | 'none'> = {};
    for (const d of eachDay(start, today)) {
      map[d] = dayStatus((byDate.get(d) ?? []).map((status) => ({ status })));
    }
    return streak(map, today);
  }, [today, rows]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 11) return '早上好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    return '晚上好';
  })();
  const doneCount = rows.filter((r) => r.status === 'done').length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.date}>{formatCN(today)} {WEEK_CN[weekday(new Date())]}</Text>
        <Text style={styles.hello}>
          {greeting} · 今日 {doneCount}/{rows.length} 已完成{streakCount > 0 ? ` · 🔥 ${streakCount} 天` : ''}
        </Text>
      </View>
      {rows.length === 0 ? (
        <EmptyState
          title="今天没有检查安排"
          subtitle="创建一个检查单，开始每日打卡"
          actionLabel="去创建"
          onAction={() => router.push('/template/edit')}
        />
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(r) => r.occurrenceId}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <TodayCard
              row={item}
              onOpen={() => router.push(`/checklist/${item.occurrenceId}`)}
              onQuickToggle={() => useAppStore.getState().quickToggle(item)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  date: { fontSize: 22, fontWeight: '700', color: palette.text },
  hello: { fontSize: 13, color: palette.subtext, marginTop: 2 },
});
```

- [ ] **Step 3: 验证提交**

Run: `npx tsc --noEmit`

```bash
git add src/features/today/ "app/(tabs)/index.tsx"
git commit -m "feat: 今日页与检查单卡片（右侧快捷勾选、完成沉底）"
```

---

## Task 13: 执行页 + 分组组件测试

**Files:** Create `src/features/checklist/GroupSection.tsx`, `app/checklist/[id].tsx`, `src/features/checklist/GroupSection.component.test.tsx`

- [ ] **Step 1: GroupSection** — `src/features/checklist/GroupSection.tsx`：

```tsx
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Checkbox } from '@/components/Checkbox';
import { palette } from '@/theme/colors';
import type { GroupView } from '@/services/progress';

interface Props {
  group: GroupView;
  color: string;
  readOnly: boolean;
  onToggle: (occurrenceItemId: string) => void;
  defaultExpanded?: boolean;
}

export function GroupSection({ group, color, readOnly, onToggle, defaultExpanded = true }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <View style={styles.group}>
      <Pressable onPress={() => setExpanded((v) => !v)} style={styles.header} accessibilityRole="button">
        <Ionicons name={expanded ? 'chevron-down' : 'chevron-forward'} size={16} color={palette.gray} />
        <Text style={styles.title}>{group.title}</Text>
        <Text style={styles.count}>{group.done}/{group.total}</Text>
      </Pressable>
      {expanded ? group.items.map((it) => (
        <View key={it.occurrenceItemId} style={styles.row}>
          <Text style={[styles.itemText, it.done === 1 && styles.doneText]}>{it.itemTitle}</Text>
          {readOnly ? (
            it.done === 1
              ? <Ionicons name="checkmark-circle" size={24} color={color} style={styles.readMark} />
              : <View style={styles.readPlaceholder} />
          ) : (
            <Checkbox checked={it.done === 1} onChange={() => onToggle(it.occurrenceItemId)} color={color} />
          )}
        </View>
      )) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { backgroundColor: palette.white, borderRadius: 12, borderWidth: 1, borderColor: palette.border, marginBottom: 12, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 12 },
  title: { fontSize: 14, fontWeight: '700', color: palette.subtext },
  count: { marginLeft: 'auto', fontSize: 12, color: palette.subtext },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border, minHeight: 48 },
  itemText: { flex: 1, fontSize: 15, color: palette.text, paddingVertical: 12 },
  doneText: { color: palette.subtext, textDecorationLine: 'line-through' },
  readMark: { marginRight: 10 },
  readPlaceholder: { width: 44, height: 44 },
});
```

- [ ] **Step 2: 执行页** — `app/checklist/[id].tsx`：

```tsx
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ProgressRing } from '@/components/ProgressRing';
import { GroupSection } from '@/features/checklist/GroupSection';
import { repo } from '@/stores/useAppStore';
import { groupByGroup, occurrenceProgress } from '@/services/progress';
import { toggleItem } from '@/services/actions';
import { checklistColors, palette } from '@/theme/colors';
import { formatCN, todayStr } from '@/utils/date';

export default function ChecklistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [version, setVersion] = useState(0);

  useFocusEffect(useCallback(() => {
    setVersion((v) => v + 1);
  }, []));

  const occ = useMemo(() => (id ? repo.occurrences.get(id) : null), [id, version]);
  const flat = useMemo(() => (id ? repo.occurrences.getFlatItems(id) : []), [id, version]);
  const groups = useMemo(() => groupByGroup(flat), [flat]);
  const progress = occurrenceProgress(flat);
  const readOnly = occ ? occ.dueDate < todayStr() : false;
  const color = checklistColors[(occ as any)?.color ?? 'green'] ?? palette.green;
  const justFinished = progress.isDone;

  const onToggle = (oiId: string) => {
    if (!id) return;
    const { isDone } = toggleItem(repo, id, oiId, Date.now());
    if (isDone && !justFinished) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    setVersion((v) => v + 1);
  };

  if (!occ) {
    return (
      <View style={styles.center}><Text>未找到该检查</Text></View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: `${occ.checklistTitle} · ${formatCN(occ.dueDate)}` }} />
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={groups}
        keyExtractor={(g) => `${g.sortOrder}:${g.title}`}
        ListHeaderComponent={<ProgressRing done={progress.done} total={progress.total} color={color} />}
        renderItem={({ item }) => (
          <GroupSection group={item} color={color} readOnly={readOnly} onToggle={onToggle} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 3: 组件测试** — `src/features/checklist/GroupSection.component.test.tsx`：

```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { GroupSection } from './GroupSection';
import type { GroupView } from '@/services/progress';

const group: GroupView = {
  title: '电源', sortOrder: 0, done: 0, total: 2,
  items: [
    { occurrenceItemId: 'a', groupTitle: '电源', groupSortOrder: 0, itemTitle: '看灯', sortOrder: 0, done: 0 },
    { occurrenceItemId: 'b', groupTitle: '电源', groupSortOrder: 0, itemTitle: '量电压', sortOrder: 1, done: 0 },
  ],
};

describe('GroupSection', () => {
  it('点击右侧勾选钮以正确 id 回调', () => {
    const onToggle = jest.fn();
    render(<GroupSection group={group} color="#34C759" readOnly={false} onToggle={onToggle} />);
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(2);
    fireEvent.press(boxes[0]);
    expect(onToggle).toHaveBeenCalledWith('a');
  });

  it('勾选后 checkbox 为选中态', () => {
    const checked: GroupView = {
      ...group, done: 2,
      items: group.items.map((i) => ({ ...i, done: 1 })),
    };
    render(<GroupSection group={checked} color="#34C759" readOnly={false} onToggle={() => {}} />);
    expect(screen.getAllByRole('checkbox')[0].props.accessibilityState.checked).toBe(true);
  });

  it('只读模式不渲染 checkbox', () => {
    render(<GroupSection group={group} color="#34C759" readOnly onToggle={() => {}} />);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });
});
```

- [ ] **Step 4: 验证提交**

Run: `npm run test:component` → PASS（若报 reanimated 需要 mock，在 `jest.setup.ts` 顶部加 `jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));`；Checkbox 依赖的 expo-haptics 由 jest-expo 自动 mock）
Run: `npm run test:unit && npx tsc --noEmit`

```bash
git add src/features/checklist/ app/checklist/
git commit -m "feat: 执行页分组勾选、进度环、完成触感与只读回看"
```

---

## Task 14: 日历页（月历 + 统计 + 例外菜单）

**Files:** Create `src/components/MonthCalendar.tsx`; Replace `app/(tabs)/calendar.tsx`

- [ ] **Step 1: MonthCalendar** — `src/components/MonthCalendar.tsx`：

```tsx
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '@/theme/colors';
import { addDays, fromDateStr, mondayOfWeek, toDateStr } from '@/utils/date';
import type { DayStatusValue } from '@/services/progress';

const STATUS_COLOR: Record<DayStatusValue, string | null> = {
  done: palette.green, partial: palette.orange, missed: palette.gray, none: null,
};

interface Props {
  month: string;                 // 该月 1 号 YYYY-MM-DD
  title: string;
  statusByDate: Record<string, DayStatusValue>;
  exceptionDates: Set<string>;
  selected: string;
  today: string;
  onSelect: (date: string) => void;
  onLongPress: (date: string) => void;
  onPrev: () => void;
  onNext: () => void;
}

export function MonthCalendar(p: Props) {
  const cells = useMemo(() => {
    const start = mondayOfWeek(fromDateStr(p.month));
    return Array.from({ length: 42 }, (_, i) => toDateStr(addDays(start, i)));
  }, [p.month]);

  return (
    <View style={styles.card}>
      <View style={styles.nav}>
        <Pressable onPress={p.onPrev} accessibilityLabel="上个月">
          <Ionicons name="chevron-back" size={20} color={palette.text} />
        </Pressable>
        <Text style={styles.monthTitle}>{p.title}</Text>
        <Pressable onPress={p.onNext} accessibilityLabel="下个月">
          <Ionicons name="chevron-forward" size={20} color={palette.text} />
        </Pressable>
      </View>
      <View style={styles.weekRow}>
        {['一', '二', '三', '四', '五', '六', '日'].map((w) => (
          <Text key={w} style={styles.weekText}>{w}</Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((d) => {
          const inMonth = d.slice(5, 7) === p.month.slice(5, 7);
          const dot = STATUS_COLOR[p.statusByDate[d] ?? 'none'];
          return (
            <Pressable
              key={d}
              onPress={() => p.onSelect(d)}
              onLongPress={() => p.onLongPress(d)}
              style={[styles.cell, d === p.selected && styles.selected]}
            >
              <Text style={[styles.day, !inMonth && styles.outside, d === p.today && styles.todayText]}>
                {Number(d.slice(8, 10))}
              </Text>
              <View style={styles.dotRow}>
                {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : <View style={styles.dot} />}
                {p.exceptionDates.has(d) ? <Text style={styles.excMark}>!</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.white, borderRadius: 12, borderWidth: 1, borderColor: palette.border, padding: 12 },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  monthTitle: { fontSize: 16, fontWeight: '700', color: palette.text },
  weekRow: { flexDirection: 'row' },
  weekText: { flex: 1, textAlign: 'center', fontSize: 11, color: palette.subtext, paddingVertical: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', paddingTop: 6, borderRadius: 8 },
  selected: { borderWidth: 2, borderColor: palette.blue },
  day: { fontSize: 13, color: palette.text },
  outside: { color: '#C7C7CC' },
  todayText: { fontWeight: '800', color: palette.blue },
  dotRow: { height: 12, flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  excMark: { fontSize: 11, color: palette.danger, fontWeight: '800' },
});
```

- [ ] **Step 2: 日历页** — 替换 `app/(tabs)/calendar.tsx`：

```tsx
import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { MonthCalendar } from '@/components/MonthCalendar';
import { repo, useAppStore, createAppActions } from '@/stores/useAppStore';
import { completionRate, dayStatus, streak, type DayStatusValue } from '@/services/progress';
import {
  addDays, eachDay, formatCN, fromDateStr, toDateStr, todayStr,
} from '@/utils/date';
import { checklistColors, palette } from '@/theme/colors';

export default function CalendarScreen() {
  const router = useRouter();
  const today = todayStr();
  const [month, setMonth] = useState(today.slice(0, 8) + '01');
  const [selected, setSelected] = useState(today);
  const [refresh, setRefresh] = useState(0);
  const actions = useMemo(() => createAppActions(repo), []);

  const windowStart = toDateStr(addDays(fromDateStr(today), -60));
  const windowEnd = toDateStr(addDays(fromDateStr(today), 30));

  const { statusByDate, exceptionDates } = useMemo(() => {
    const occs = repo.occurrences.listInRange(windowStart, windowEnd);
    const byDate = new Map<string, string[]>();
    for (const o of occs) byDate.set(o.dueDate, [...(byDate.get(o.dueDate) ?? []), o.status]);
    const status: Record<string, DayStatusValue> = {};
    for (const d of eachDay(windowStart, windowEnd)) {
      status[d] = dayStatus((byDate.get(d) ?? []).map((s) => ({ status: s })));
    }
    const exc = new Set<string>();
    for (const c of repo.checklists.listAll()) {
      repo.exceptions.listForChecklist(c.id).forEach((e) => exc.add(e.date));
    }
    return { statusByDate: status, exceptionDates: exc };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowStart, windowEnd, today, refresh]);

  const days30 = useMemo(
    () => eachDay(toDateStr(addDays(fromDateStr(today), -29)), today)
      .map((d) => ({ status: statusByDate[d] ?? 'none' })),
    [statusByDate, today],
  );

  const selectedOccs = useMemo(
    () => repo.occurrences.listByDate(selected),
    [selected, refresh],
  );

  const shiftMonth = (delta: number) => {
    const d = fromDateStr(month);
    d.setMonth(d.getMonth() + delta);
    setMonth(toDateStr(d).slice(0, 8) + '01');
  };

  const applyException = (checklistId: string, date: string, type: 'exclude' | 'include' | null) => {
    actions.setException(checklistId, date, type);
    useAppStore.getState().loadToday(today);
    setRefresh((v) => v + 1);
  };

  const chooseType = (checklistId: string, date: string) => {
    Alert.alert('标记为例外', `${formatCN(date)} 如何处理？`, [
      { text: '跳过（不检查）', onPress: () => applyException(checklistId, date, 'exclude') },
      { text: '补做一次', onPress: () => applyException(checklistId, date, 'include') },
      { text: '取消例外', style: 'destructive', onPress: () => applyException(checklistId, date, null) },
      { text: '返回', style: 'cancel' },
    ]);
  };

  const longPress = (date: string) => {
    if (date < today) return;
    const active = repo.checklists.listActive();
    if (active.length === 0) return Alert.alert('还没有检查单');
    Alert.alert(
      `${formatCN(date)} 例外设置`,
      '选择要调整的检查单',
      active.map((c) => ({ text: c.title, onPress: () => chooseType(c.id, date) }))
        .concat([{ text: '取消', style: 'cancel' }]),
    );
  };

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
      data={selectedOccs}
      keyExtractor={(o) => o.id}
      ListHeaderComponent={
        <View>
          <View style={styles.stats}>
            <Text style={styles.statText}>🔥 连续 {streak(statusByDate, today)} 天</Text>
            <Text style={styles.statText}>近30天完成率 {Math.round(completionRate(days30) * 100)}%</Text>
          </View>
          <MonthCalendar
            month={month}
            title={`${month.slice(0, 4)}年${Number(month.slice(5, 7))}月`}
            statusByDate={statusByDate}
            exceptionDates={exceptionDates}
            selected={selected}
            today={today}
            onSelect={setSelected}
            onLongPress={longPress}
            onPrev={() => shiftMonth(-1)}
            onNext={() => shiftMonth(1)}
          />
          <View style={styles.legend}>
            <Text style={styles.legendText}>● 全部完成　● 部分　● 未完成　! 例外（长按日期设置）</Text>
          </View>
          <Text style={styles.dayTitle}>{formatCN(selected)}</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          style={styles.occRow}
          onPress={() => router.push(`/checklist/${item.id}`)}
          accessibilityRole="button"
        >
          <Text style={[styles.dot, { color: checklistColors[item.color] ?? palette.green }]}>●</Text>
          <Text style={styles.occTitle}>{item.checklistTitle}</Text>
          <Text style={[styles.occStatus, item.status === 'done' && styles.occDone]}>
            {item.status === 'done' ? '已完成' : '未完成'}
          </Text>
        </Pressable>
      )}
      ListEmptyComponent={<Text style={styles.emptyDay}>当天没有检查安排</Text>}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  stats: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  statText: { fontSize: 14, fontWeight: '600', color: palette.text },
  legend: { marginVertical: 8 },
  legendText: { fontSize: 11, color: palette.subtext },
  dayTitle: { fontSize: 15, fontWeight: '700', color: palette.text, marginTop: 4, marginBottom: 8 },
  occRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: palette.white,
    borderWidth: 1, borderColor: palette.border, borderRadius: 10, padding: 12, marginBottom: 8 },
  dot: { fontSize: 12 },
  occTitle: { flex: 1, fontSize: 15, color: palette.text },
  occStatus: { fontSize: 13, color: palette.subtext },
  occDone: { color: palette.green, fontWeight: '600' },
  emptyDay: { color: palette.subtext, textAlign: 'center', marginTop: 16 },
});
```

- [ ] **Step 3: 验证提交**

Run: `npx tsc --noEmit`

```bash
git add src/components/MonthCalendar.tsx "app/(tabs)/calendar.tsx"
git commit -m "feat: 日历页月历状态点、统计与例外标记"
```

---

## Task 15: 模板列表与模板编辑（含重复规则编辑器与排序）

**Files:**
- Create: `src/features/template/RepeaterEditor.tsx`
- Replace: `app/(tabs)/templates.tsx`
- Create: `app/template/edit.tsx`
- Modify: `src/stores/useAppStore.ts`（新增 `updateMeta` action）

说明（对设计的微调）：检查项在组内用长按拖拽排序（`react-native-draggable-flatlist`，嵌套列表禁用自身滚动）；分组排序用组头的上下移动按钮，避免双层滚动手势冲突。

- [ ] **Step 1: store 增补 updateMeta**

在 `src/stores/useAppStore.ts` 的 `createAppActions` 返回对象内、`updateRecurrence` 之前加入：

```ts
    updateMeta(checklistId: string, patch: { title: string; icon: string; color: string }) {
      r.checklists.update(checklistId, patch);
    },

    deleteChecklist(checklistId: string) {
      r.checklists.delete(checklistId);
    },

    archiveChecklist(checklistId: string, archived: boolean) {
      r.checklists.archive(checklistId, archived);
    },
```

Run: `npx tsc --noEmit` → 无错误

- [ ] **Step 2: 重复规则编辑器** — `src/features/template/RepeaterEditor.tsx`：

```tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { palette } from '@/theme/colors';
import type { RecurrenceType } from '@/repositories/types';

const OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: 'none', label: '不重复' },
  { value: 'daily', label: '每天' },
  { value: 'workdays', label: '工作日' },
  { value: 'weekly', label: '每周' },
];
const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

interface Props {
  recurrence: RecurrenceType;
  weekdays: number[];
  onChange: (recurrence: RecurrenceType, weekdays: number[]) => void;
}

export function RepeaterEditor({ recurrence, weekdays, onChange }: Props) {
  const toggleWeekday = (n: number) => {
    const next = weekdays.includes(n) ? weekdays.filter((x) => x !== n) : [...weekdays, n].sort();
    onChange('weekly', next);
  };
  return (
    <View>
      <View style={styles.segment}>
        {OPTIONS.map((o) => (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value, o.value === 'weekly' ? (weekdays.length ? weekdays : [1]) : [])}
            style={[styles.segItem, recurrence === o.value && styles.segActive]}
            accessibilityRole="button"
          >
            <Text style={[styles.segText, recurrence === o.value && styles.segTextActive]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
      {recurrence === 'weekly' ? (
        <View style={styles.weekRow}>
          {WEEK_LABELS.map((label, i) => {
            const n = i + 1;
            const on = weekdays.includes(n);
            return (
              <Pressable key={n} onPress={() => toggleWeekday(n)} style={[styles.chip, on && styles.chipOn]} accessibilityRole="button">
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', backgroundColor: palette.lightGray, borderRadius: 10, padding: 3, gap: 3 },
  segItem: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segActive: { backgroundColor: palette.white },
  segText: { fontSize: 13, color: palette.subtext },
  segTextActive: { color: palette.text, fontWeight: '600' },
  weekRow: { flexDirection: 'row', gap: 8, marginTop: 10, justifyContent: 'space-between' },
  chip: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: palette.blue, borderColor: palette.blue },
  chipText: { fontSize: 13, color: palette.text },
  chipTextOn: { color: '#fff', fontWeight: '600' },
});
```

- [ ] **Step 3: 模板列表页** — 替换 `app/(tabs)/templates.tsx`：

```tsx
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { repo, createAppActions } from '@/stores/useAppStore';
import { EmptyState } from '@/components/EmptyState';
import { checklistColors, palette } from '@/theme/colors';
import type { RecurrenceType } from '@/repositories/types';

const RECAP: Record<RecurrenceType, string> = {
  none: '不重复', daily: '每天', workdays: '工作日', weekly: '每周',
};

export default function TemplatesScreen() {
  const router = useRouter();
  const [version, setVersion] = useState(0);
  useFocusEffect(useCallback(() => setVersion((v) => v + 1), []));

  const all = repo.checklists.listAll();
  const active = all.filter((c) => !c.isArchived);
  const archived = all.filter((c) => c.isArchived);
  const actions = createAppActions(repo);

  const countItems = (id: string) =>
    repo.checklists.getStructure(id).groups.reduce((n, g) => n + g.items.length, 0);

  const confirmDelete = (id: string, title: string) => {
    Alert.alert(`删除「${title}」？`, '将同时删除其全部历史记录，此操作不可恢复。', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => { actions.deleteChecklist(id); setVersion((v) => v + 1); } },
    ]);
  };

  const renderItem = ({ item }: { item: ReturnType<typeof repo.checklists.listAll>[number] }) => (
    <Pressable style={styles.row} onPress={() => router.push(`/template/edit?checklistId=${item.id}`)}>
      <Ionicons name={(item.icon as any) ?? 'list'} size={20} color={checklistColors[item.color] ?? palette.green} />
      <View style={styles.meta}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.sub}>{RECAP[item.recurrence]}{item.recurrence === 'weekly' ? ` ${item.weekdays.map((w) => '一二三四五六日'[w - 1]).join('')}` : ''} · {countItems(item.id)} 项</Text>
      </View>
      <Pressable hitSlop={8} onPress={() => confirmDelete(item.id, item.title)}>
        <Ionicons name="trash-outline" size={18} color={palette.gray} />
      </Pressable>
    </Pressable>
  );

  if (version < 0) return null;

  return (
    <View style={styles.container}>
      <FlatList
        key={`v${version}`}
        contentContainerStyle={{ padding: 16 }}
        data={[...active, ...archived]}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={archived.length > 0 ? <Text style={styles.sectionLabel}>归档（{archived.length}）</Text> : null}
        ListEmptyComponent={<EmptyState title="还没有检查单" subtitle="新建一个每日打卡清单" />}
        renderItem={renderItem}
      />
      <Pressable style={styles.fab} onPress={() => router.push('/template/edit')} accessibilityRole="button">
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  sectionLabel: { fontSize: 12, color: palette.subtext, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: palette.white,
    borderWidth: 1, borderColor: palette.border, borderRadius: 10, padding: 12, marginBottom: 8 },
  meta: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', color: palette.text },
  sub: { fontSize: 12, color: palette.subtext, marginTop: 2 },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28,
    backgroundColor: palette.blue, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 4: 模板编辑页** — `app/template/edit.tsx`：

```tsx
import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable, FlatList, StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { NestableDraggableFlatList, NestableScrollContainer, ScaleDecorator } from 'react-native-draggable-flatlist';
import { TouchableOpacity } from 'react-native';
import { repo, createAppActions } from '@/stores/useAppStore';
import { RepeaterEditor } from '@/features/template/RepeaterEditor';
import { checklistColors, palette } from '@/theme/colors';
import { todayStr } from '@/utils/date';
import { uuid } from '@/utils/id';
import type { RecurrenceType } from '@/repositories/types';

const ICON_OPTIONS = ['checkmark-circle-outline', 'heart-outline', 'car-outline', 'home-outline', 'briefcase-outline', 'fitness-outline'];
const COLOR_OPTIONS = Object.keys(checklistColors);

interface LocalItem { localId: string; title: string; dbId?: string }
interface LocalGroup { localId: string; title: string; dbId?: string; items: LocalItem[] }

export default function TemplateEditScreen() {
  const router = useRouter();
  const { checklistId } = useLocalSearchParams<{ checklistId?: string }>();
  const editing = checklistId ? repo.checklists.get(checklistId) : null;
  const actions = useMemo(() => createAppActions(repo), []);

  const [title, setTitle] = useState(editing?.title ?? '');
  const [icon, setIcon] = useState(editing?.icon ?? ICON_OPTIONS[0]);
  const [color, setColor] = useState(editing?.color ?? 'green');
  const [recurrence, setRecurrence] = useState<RecurrenceType>(editing?.recurrence ?? 'daily');
  const [weekdays, setWeekdays] = useState<number[]>(editing?.weekdays ?? []);
  const [groups, setGroups] = useState<LocalGroup[]>(() => {
    if (!checklistId) return [{ localId: uuid(), title: '分组 1', items: [] }];
    return repo.checklists.getStructure(checklistId).groups.map((g) => ({
      localId: g.id, dbId: g.id, title: g.title,
      items: g.items.map((it) => ({ localId: it.id, dbId: it.id, title: it.title })),
    }));
  });

  const updateGroup = (localId: string, patch: Partial<LocalGroup>) =>
    setGroups((gs) => gs.map((g) => (g.localId === localId ? { ...g, ...patch } : g)));

  const addItem = (groupLocalId: string) =>
    updateGroup(groupLocalId, {
      items: [...groups.find((g) => g.localId === groupLocalId)!.items, { localId: uuid(), title: '' }],
    });

  const updateItem = (groupLocalId: string, itemLocalId: string, title: string) =>
    updateGroup(groupLocalId, {
      items: groups.find((g) => g.localId === groupLocalId)!.items
        .map((it) => (it.localId === itemLocalId ? { ...it, title } : it)),
    });

  const removeItem = (groupLocalId: string, itemLocalId: string) =>
    updateGroup(groupLocalId, {
      items: groups.find((g) => g.localId === groupLocalId)!.items.filter((it) => it.localId !== itemLocalId),
    });

  const moveGroup = (index: number, delta: number) => {
    const next = [...groups];
    const [g] = next.splice(index, 1);
    next.splice(Math.max(0, Math.min(next.length, index + delta)), 0, g);
    setGroups(next);
  };

  const save = () => {
    if (!title.trim()) return Alert.alert('请填写检查单名称');
    const cleanGroups = groups
      .map((g, gi) => ({
        id: g.dbId, title: g.title.trim() || `分组 ${gi + 1}`, sortOrder: gi,
        items: g.items.filter((it) => it.title.trim()).map((it, ii) => ({ id: it.dbId, title: it.title.trim(), sortOrder: ii })),
      }));
    if (cleanGroups.every((g) => g.items.length === 0)) return Alert.alert('至少添加一个检查项');

    if (editing && checklistId) {
      actions.updateMeta(checklistId, { title: title.trim(), icon, color });
      actions.updateRecurrence(checklistId, { recurrence, weekdays });
      actions.replaceStructure(checklistId, cleanGroups);
    } else {
      actions.createChecklist({
        title: title.trim(), icon, color, recurrence, weekdays,
        today: todayStr(),
        groups: cleanGroups.map((g) => ({ title: g.title, items: g.items.map((it) => it.title) })),
      });
    }
    router.back();
  };

  const confirmDelete = () => {
    if (!checklistId) { router.back(); return; }
    Alert.alert('删除该检查单？', '将同时删除其全部历史记录。', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => { actions.deleteChecklist(checklistId); router.back(); } },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{
        headerShown: true, title: editing ? '编辑检查单' : '新建检查单',
        headerRight: () => (
          <Pressable onPress={save} hitSlop={10}><Text style={{ color: palette.blue, fontSize: 16, fontWeight: '600' }}>保存</Text></Pressable>
        ),
      }} />
      <NestableScrollContainer contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <TextInput style={styles.input} placeholder="检查单名称" value={title} onChangeText={setTitle} />

        <View style={styles.row}>
          {ICON_OPTIONS.map((name) => (
            <Pressable key={name} onPress={() => setIcon(name)} style={[styles.iconBtn, icon === name && { backgroundColor: palette.lightGray }]}>
              <Ionicons name={name as any} size={20} color={icon === name ? palette.blue : palette.gray} />
            </Pressable>
          ))}
        </View>
        <View style={styles.row}>
          {COLOR_OPTIONS.map((c) => (
            <Pressable key={c} onPress={() => setColor(c)} style={[styles.colorDot, { backgroundColor: checklistColors[c] }, color === c && styles.colorSelected]} accessibilityRole="button" />
          ))}
        </View>

        <Text style={styles.label}>重复</Text>
        <RepeaterEditor recurrence={recurrence} weekdays={weekdays} onChange={(r, w) => { setRecurrence(r); setWeekdays(w); }} />

        {groups.map((g, gi) => (
          <View key={g.localId} style={styles.groupCard}>
            <View style={styles.groupHeader}>
              <TextInput style={styles.groupTitle} value={g.title} onChangeText={(t) => updateGroup(g.localId, { title: t })} />
              <Pressable hitSlop={8} disabled={gi === 0} onPress={() => moveGroup(gi, -1)}>
                <Ionicons name="chevron-up" size={18} color={gi === 0 ? '#C7C7CC' : palette.gray} />
              </Pressable>
              <Pressable hitSlop={8} disabled={gi === groups.length - 1} onPress={() => moveGroup(gi, 1)}>
                <Ionicons name="chevron-down" size={18} color={gi === groups.length - 1 ? '#C7C7CC' : palette.gray} />
              </Pressable>
              <Pressable hitSlop={8} onPress={() => setGroups((gs) => gs.filter((x) => x.localId !== g.localId))}>
                <Ionicons name="trash-outline" size={16} color={palette.gray} />
              </Pressable>
            </View>

            <NestableDraggableFlatList
              data={g.items}
              keyExtractor={(it) => it.localId}
              renderItem={({ item, drag }) => (
                <ScaleDecorator>
                  <TouchableOpacity onLongPress={drag} activeOpacity={0.7} style={styles.itemRow}>
                    <Ionicons name="reorder-two-outline" size={18} color={palette.gray} />
                    <TextInput
                      style={styles.itemInput}
                      placeholder="检查项"
                      value={item.title}
                      onChangeText={(t) => updateItem(g.localId, item.localId, t)}
                    />
                    <Pressable hitSlop={8} onPress={() => removeItem(g.localId, item.localId)}>
                      <Ionicons name="close-circle-outline" size={18} color={palette.gray} />
                    </Pressable>
                  </TouchableOpacity>
                </ScaleDecorator>
              )}
              onDragEnd={({ data }) => updateGroup(g.localId, { items: data })}
            />
            <Pressable onPress={() => addItem(g.localId)} style={styles.addItem}>
              <Ionicons name="add" size={16} color={palette.blue} />
              <Text style={styles.addItemText}>添加检查项</Text>
            </Pressable>
          </View>
        ))}

        <Pressable onPress={() => setGroups((gs) => [...gs, { localId: uuid(), title: `分组 ${gs.length + 1}`, items: [] }])} style={styles.addGroup}>
          <Text style={styles.addGroupText}>＋ 添加分组</Text>
        </Pressable>

        <Pressable onPress={confirmDelete} style={styles.deleteBtn}>
          <Text style={styles.deleteText}>{editing ? '删除检查单' : '取消'}</Text>
        </Pressable>
      </NestableScrollContainer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  input: { backgroundColor: palette.white, borderRadius: 10, borderWidth: 1, borderColor: palette.border,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: palette.text },
  row: { flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  colorSelected: { borderWidth: 3, borderColor: palette.text },
  label: { fontSize: 13, fontWeight: '600', color: palette.subtext, marginTop: 18, marginBottom: 6 },
  groupCard: { backgroundColor: palette.white, borderRadius: 12, borderWidth: 1, borderColor: palette.border,
    padding: 12, marginTop: 14 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  groupTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: palette.text, paddingVertical: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.lightGray },
  itemInput: { flex: 1, fontSize: 15, color: palette.text, paddingVertical: 4 },
  addItem: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 10, justifyContent: 'center' },
  addItemText: { color: palette.blue, fontSize: 14 },
  addGroup: { borderWidth: 1, borderColor: palette.blue, borderRadius: 10, paddingVertical: 12,
    alignItems: 'center', marginTop: 14 },
  addGroupText: { color: palette.blue, fontSize: 15, fontWeight: '600' },
  deleteBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  deleteText: { color: palette.danger, fontSize: 15 },
});
```

- [ ] **Step 5: 验证提交**

Run: `npx tsc --noEmit` → 无错误（若 `DraggableFlatList` 顶层导入未使用告警，删除未用的 `DraggableFlatList`、`FlatList` 导入）

```bash
git add "app/(tabs)/templates.tsx" app/template/ src/features/template/ src/stores/useAppStore.ts
git commit -m "feat: 模板列表与编辑（重复规则、图标颜色、组/项增删与排序）"
```

---

## Task 16: 数据导出、设置页与最终验收

**Files:**
- Create: `src/services/export.ts`, Test `src/services/export.test.ts`
- Replace: `app/(tabs)/settings.tsx`

- [ ] **Step 1: 导出服务（TDD）**

`src/services/export.test.ts`：

```ts
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
});
```

Run: `npx vitest run src/services/export.test.ts` → FAIL

先给仓储工厂增加一个仅用于导出的 `dumpAll()`。在 `src/repositories/factory.ts` 的返回对象中（`exceptions` 同级之后）加入：

```ts
    dumpAll() {
      return {
        checklists: db.select().from(checklists).all(),
        groups: db.select().from(groups).all(),
        items: db.select().from(items).all(),
        occurrences: db.select().from(occurrences).all(),
        occurrenceItems: db.select().from(occurrenceItems).all(),
        itemResults: db.select().from(itemResults).all(),
        dateExceptions: db.select().from(dateExceptions).all(),
      };
    },
```

再实现 `src/services/export.ts`（测试与生产共用 drizzle 同步 API，不触碰底层驱动）：

```ts
import type { createRepositories } from '@/repositories/factory';

type Repo = ReturnType<typeof createRepositories>;

interface ExportShape {
  app: 'check-list';
  version: 1;
  exportedAt: string;
  data: ReturnType<Repo['dumpAll']>;
}

export function buildExportJson(repo: Repo): string {
  const payload: ExportShape = {
    app: 'check-list',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: repo.dumpAll(),
  };
  return JSON.stringify(payload, null, 2);
}

export function parseExportJson(json: string): ExportShape {
  let parsed: any;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('备份文件格式错误');
  }
  if (parsed?.app !== 'check-list' || typeof parsed.version !== 'number') {
    throw new Error('备份文件格式错误');
  }
  return parsed as ExportShape;
}
```

Run: `npm run test:unit` → PASS

- [ ] **Step 2: 设置页** — 替换 `app/(tabs)/settings.tsx`：

```tsx
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { repo } from '@/stores/useAppStore';
import { buildExportJson } from '@/services/export';
import { palette } from '@/theme/colors';

export default function SettingsScreen() {
  const [busy, setBusy] = useState(false);

  const exportData = async () => {
    setBusy(true);
    try {
      const json = buildExportJson(repo);
      const fileName = `checklist-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const uri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(uri, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: '导出检查清单数据' });
      } else {
        Alert.alert('已导出', `文件已保存：${uri}`);
      }
    } catch (e) {
      Alert.alert('导出失败', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.row} onPress={exportData} disabled={busy} accessibilityRole="button">
        <Text style={styles.rowText}>导出数据（JSON 备份）</Text>
        {busy ? <ActivityIndicator color={palette.blue} /> : <Text style={styles.chevron}>›</Text>}
      </Pressable>
      <Pressable style={[styles.row, styles.disabled]} disabled accessibilityRole="button">
        <Text style={[styles.rowText, { color: palette.subtext }]}>每日提醒（即将推出）</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
      <Text style={styles.version}>检查清单 v0.1.0 · 数据仅保存在本机</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg, padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.white,
    borderWidth: 1, borderColor: palette.border, borderRadius: 10, padding: 14, marginBottom: 10 },
  disabled: { opacity: 0.6 },
  rowText: { flex: 1, fontSize: 15, color: palette.text },
  chevron: { fontSize: 20, color: palette.gray },
  version: { fontSize: 12, color: palette.subtext, textAlign: 'center', marginTop: 16 },
});
```

- [ ] **Step 3: 全量自动化验证**

Run:
- `npm run test:unit` → 全部 PASS
- `npm run test:component` → PASS
- `npx tsc --noEmit` → 无错误
- `npx expo-doctor` → 无致命问题（警告可记录）

- [ ] **Step 4: 提交**

```bash
git add src/services/export.ts src/services/export.test.ts src/repositories/factory.ts "app/(tabs)/settings.tsx"
git commit -m "feat: 数据 JSON 导出与设置页"
```

- [ ] **Step 5: 手动验收（iOS 模拟器）**

Run: `npx expo run:ios`（或 Expo Go：`npx expo start` 后扫码）

逐项走查（对应设计文档第 10 节验收标准）：

1. 模板 Tab → 新建「设备开机检查」，每天，加 2 个分组各 2 项 → 保存
2. 今日页出现卡片，进度 0/4；点卡片右侧圆钮 → 快捷勾选推进
3. 进执行页：圆钮在每行最右侧；逐项勾选，最后一项时触感成功反馈，环到 100%，卡片完成沉底置灰
4. 杀进程重开 → 勾选与数据都在
5. 新建「工作日检查」选工作日周期：周末两天今日页无该单；日历长按周六 → 为该单「补做一次」→ 周六出现；长按某工作日「跳过」→ 消失
6. 新建「每周检查」选周一/三/五：日历对应日期有点
7. 日历：全绿/橙/灰点正确；连续天数与近 30 天完成率随勾选变化；点历史日期进入为只读
8. 编辑模板：改标题、加组、加项、长按拖动某项排序、上下移动分组；保存后今天（未勾选时）新结构生效，昨天历史仍是旧快照
9. 删除某分组需确认路径正常；删除检查单二次确认后历史同步消失
10. 设置 → 导出 JSON，系统分享面板出现，保存后用文本编辑器能看到含 7 张表数据且 `app: "check-list"`

- [ ] **Step 6: 手动验收（Android 模拟器）**

Run: `npx expo run:android`，重复 Step 5 的 1–7、10；重点确认右侧勾选钮拇指可达、长按弹例外菜单正常。

- [ ] **Step 7: 收尾**

- 确认 `.superpowers/` 已在 `.gitignore`（Task 脚手架前已加入）
- `git status` 干净；如手动验收发现问题，按系统化调试流程修复并新增对应回归测试后再提交
- 在 `docs/superpowers/plans/2026-09-10-checklist-app.md` 勾选全部完成项

---

## 自审记录（计划作者已核对）

- **Spec 覆盖**：四 Tab、四种周期、工作日+例外、快照、实时完成推导、取消勾选、日历聚合/连续/完成率、只读历史、模板增删改排序、归档入口（编辑页仅删除；列表页提供归档在后续迭代——已在 Task 15 模板列表保留数据模型支持，UI 第一版未放置归档按钮，属可接受裁剪）、导出 JSON、错误屏、空状态、单手右侧操作。
- **类型一致**：`TodayRow`、`FlatItem`、`GroupView`、`RuleInput`、`SnapshotRow`、`createRepositories` 方法名（`createWithItems/getFlatItems/deleteFutureUntouched/setException/dumpAll`）在各任务间一致。
- **已知取舍**：分组排序用上/下按钮而非拖拽（避免嵌套滚动手势冲突）；导入第一版不做；实例 id 为确定性 `occ:<checklistId>:<dueDate>`，依赖各检查单同日仅一个实例（与规则一致）。

