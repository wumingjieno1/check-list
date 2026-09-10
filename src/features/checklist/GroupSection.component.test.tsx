import React from 'react';
import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { GroupSection } from './GroupSection';
import type { GroupView } from '@/services/progress';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
}));

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Ionicons: (props: any) => require('react').createElement(View, { ...props, testID: props.name }),
  };
});

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
