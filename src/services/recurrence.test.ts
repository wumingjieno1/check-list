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
    expect(isScheduled('2026-10-05', rule, '2026-09-07')).toBe(true);
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
