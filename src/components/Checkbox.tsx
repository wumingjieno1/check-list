import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '@/theme/colors';

interface Props {
  checked: boolean;
  onChange: () => void;
  color?: string;
  disabled?: boolean;
  size?: number;
}

export function Checkbox({ checked, onChange, color = palette.green, disabled = false, size = 24 }: Props) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      hitSlop={10}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onChange();
      }}
      style={styles.hit}
    >
      <View style={[
        styles.box,
        { width: size, height: size, borderColor: checked ? color : palette.gray },
        checked && { backgroundColor: color },
        disabled && styles.disabled,
      ]}>
        {checked && <Ionicons name="checkmark" size={size - 9} color="#fff" />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  box: { borderWidth: 2, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
});
