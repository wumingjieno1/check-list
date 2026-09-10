import React from 'react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, fireEvent } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { Checkbox } from './Checkbox';

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

describe('Checkbox', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exposes checkbox role and unchecked state, and calls onChange on press', () => {
    const onChange = jest.fn();
    const { getByRole, queryByTestId } = render(<Checkbox checked={false} onChange={onChange} />);

    const checkbox = getByRole('checkbox');
    expect(checkbox.props.accessibilityState.checked).toBe(false);
    expect(queryByTestId('checkmark')).toBeNull();

    fireEvent.press(checkbox);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
  });

  it('reflects checked state when checked prop is true', () => {
    const { getByRole, getByTestId } = render(<Checkbox checked onChange={jest.fn()} />);
    expect(getByRole('checkbox').props.accessibilityState.checked).toBe(true);
    expect(getByTestId('checkmark')).toBeTruthy();
  });

  it('is marked disabled and does not invoke onChange when pressed', () => {
    const onChange = jest.fn();
    const { getByRole } = render(
      <Checkbox checked={false} onChange={onChange} disabled />
    );

    const checkbox = getByRole('checkbox');
    expect(checkbox.props.accessibilityState.disabled).toBe(true);

    fireEvent.press(checkbox);
    expect(onChange).not.toHaveBeenCalled();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });
});
