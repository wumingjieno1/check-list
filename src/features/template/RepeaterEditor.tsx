import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { palette } from '@/theme/colors';
import type { RecurrenceType } from '@/repositories/types';

const OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: 'none', label: '不重复' },
  { value: 'daily', label: '每天' },
  { value: 'workdays', label: '工作日' },
  { value: 'weekly', label: '每周' },
];
const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

interface Props {
  recurrence: RecurrenceType;
  weekdays: number[];
  onChange: (recurrence: RecurrenceType, weekdays: number[]) => void;
}

export function RepeaterEditor({ recurrence, weekdays, onChange }: Props) {
  const toggleWeekday = (n: number) => {
    const next = weekdays.includes(n) ? weekdays.filter((x) => x !== n) : [...weekdays, n].sort();
    onChange('weekly', next);
  };
  return (
    <View>
      <View style={styles.segment}>
        {OPTIONS.map((o) => (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value, o.value === 'weekly' ? (weekdays.length ? weekdays : [1]) : [])}
            style={[styles.segItem, recurrence === o.value && styles.segActive]}
            accessibilityRole="button"
          >
            <Text style={[styles.segText, recurrence === o.value && styles.segTextActive]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
      {recurrence === 'weekly' ? (
        <View style={styles.weekRow}>
          {WEEK_LABELS.map((label, i) => {
            const n = i + 1;
            const on = weekdays.includes(n);
            return (
              <Pressable key={n} onPress={() => toggleWeekday(n)} style={[styles.chip, on && styles.chipOn]} accessibilityRole="button">
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', backgroundColor: palette.lightGray, borderRadius: 10, padding: 3, gap: 3 },
  segItem: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segActive: { backgroundColor: palette.white },
  segText: { fontSize: 13, color: palette.subtext },
  segTextActive: { color: palette.text, fontWeight: '600' },
  weekRow: { flexDirection: 'row', gap: 8, marginTop: 10, justifyContent: 'space-between' },
  chip: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: palette.blue, borderColor: palette.blue },
  chipText: { fontSize: 13, color: palette.text },
  chipTextOn: { color: '#fff', fontWeight: '600' },
});
