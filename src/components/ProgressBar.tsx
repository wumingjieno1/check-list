import React from 'react';
import { View, StyleSheet } from 'react-native';
import { palette } from '@/theme/colors';

export function ProgressBar({ value, color = palette.green }: { value: number; color?: string }) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: 3, backgroundColor: palette.lightGray, overflow: 'hidden', marginTop: 6 },
  fill: { height: '100%', borderRadius: 3 },
});
