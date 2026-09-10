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
