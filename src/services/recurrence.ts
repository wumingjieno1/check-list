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
  const exceptions = rule.exceptions;
  if (exceptions.some((e) => e.date === date && e.type === 'exclude')) return false;
  if (exceptions.some((e) => e.date === date && e.type === 'include') && rule.recurrence !== 'none') return true;

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
