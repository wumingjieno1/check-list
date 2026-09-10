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
