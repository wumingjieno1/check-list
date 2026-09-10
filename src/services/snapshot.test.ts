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
  it('乱序模板按组/项 sortOrder 输出', () => {
    const shuffled = {
      groups: [
        { id: 'g2', title: '传动', sortOrder: 1, items: [
          { id: 'i3', title: '查传送带', sortOrder: 0 },
        ]},
        { id: 'g1', title: '电源', sortOrder: 0, items: [
          { id: 'i2', title: '量电压', sortOrder: 1 },
          { id: 'i1', title: '看指示灯', sortOrder: 0 },
        ]},
      ],
    };
    expect(buildSnapshots('occ1', shuffled).map((r) => r.sourceItemId)).toEqual(['i1', 'i2', 'i3']);
  });
  it('空分组不产生行', () => {
    expect(buildSnapshots('o', { groups: [{ id: 'g', title: '空', sortOrder: 0, items: [] }] })).toEqual([]);
  });
});
