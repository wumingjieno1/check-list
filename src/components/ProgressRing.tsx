import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { palette } from '@/theme/colors';

export function ProgressRing({ done, total, size = 110, color = palette.green }: {
  done: number; total: number; size?: number; color?: string;
}) {
  const thickness = 10;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const pct = total === 0 ? 0 : done / total;
  return (
    <View style={{ width: size, height: size, alignSelf: 'center', marginVertical: 12 }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={palette.lightGray} strokeWidth={thickness} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={thickness} fill="none"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={styles.text}>{done}/{total}</Text>
        <Text style={styles.pct}>{Math.round(pct * 100)}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 20, fontWeight: '700', color: palette.text },
  pct: { fontSize: 12, color: palette.subtext },
});
