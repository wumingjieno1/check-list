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

describe('groupByGroup 乱序输入', () => {
  it('组按 groupSortOrder、组内按 sortOrder 排序', () => {
    const shuffled: FlatItem[] = [
      { occurrenceItemId: 'c', groupTitle: 'G2', groupSortOrder: 1, itemTitle: 'z', sortOrder: 0, done: 0 },
      { occurrenceItemId: 'b2', groupTitle: 'G1', groupSortOrder: 0, itemTitle: 'y2', sortOrder: 1, done: 0 },
      { occurrenceItemId: 'a1', groupTitle: 'G1', groupSortOrder: 0, itemTitle: 'x1', sortOrder: 0, done: 1 },
    ];
    const gs = groupByGroup(shuffled);
    expect(gs.map((g) => g.title)).toEqual(['G1', 'G2']);
    expect(gs[0].items.map((i) => i.occurrenceItemId)).toEqual(['a1', 'b2']);
    expect(gs[1].items.map((i) => i.occurrenceItemId)).toEqual(['c']);
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
