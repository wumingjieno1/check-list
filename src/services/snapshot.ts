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
