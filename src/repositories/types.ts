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
  id: string; occurrenceItemId: string; occurrenceId: string; sourceItemId: string;
  groupTitle: string; groupSortOrder: number; itemTitle: string; sortOrder: number;
  done: number; toggledAt: number | null;
}
export interface ExceptionDTO {
  id: string; checklistId: string; date: string; type: 'exclude' | 'include';
}
