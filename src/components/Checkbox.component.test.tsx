import React from 'react';
import { describe, it, expect, jest } from '@jest/globals';
import { render, fireEvent } from '@testing-library/react-native';
import { Checkbox } from './Checkbox';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
}));

describe('Checkbox', () => {
  it('exposes checkbox role and unchecked state, and calls onChange on press', () => {
    const onChange = jest.fn();
    const { getByRole } = render(<Checkbox checked={false} onChange={onChange} />);

    const checkbox = getByRole('checkbox');
    expect(checkbox.props.accessibilityState.checked).toBe(false);

    fireEvent.press(checkbox);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('reflects checked state when checked prop is true', () => {
    const { getByRole } = render(<Checkbox checked onChange={jest.fn()} />);
    expect(getByRole('checkbox').props.accessibilityState.checked).toBe(true);
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
  });
});
