import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '@/theme/colors';
import { addDays, fromDateStr, mondayOfWeek, toDateStr } from '@/utils/date';
import type { DayStatusValue } from '@/services/progress';

const STATUS_COLOR: Record<DayStatusValue, string | null> = {
  done: palette.green, partial: palette.orange, missed: palette.gray, none: null,
};

interface Props {
  month: string;
  title: string;
  statusByDate: Record<string, DayStatusValue>;
  exceptionDates: Set<string>;
  selected: string;
  today: string;
  onSelect: (date: string) => void;
  onLongPress: (date: string) => void;
  onPrev: () => void;
  onNext: () => void;
}

export function MonthCalendar(p: Props) {
  const cells = useMemo(() => {
    const start = mondayOfWeek(fromDateStr(p.month));
    return Array.from({ length: 42 }, (_, i) => toDateStr(addDays(start, i)));
  }, [p.month]);

  return (
    <View style={styles.card}>
      <View style={styles.nav}>
        <Pressable onPress={p.onPrev} accessibilityLabel="上个月">
          <Ionicons name="chevron-back" size={20} color={palette.text} />
        </Pressable>
        <Text style={styles.monthTitle}>{p.title}</Text>
        <Pressable onPress={p.onNext} accessibilityLabel="下个月">
          <Ionicons name="chevron-forward" size={20} color={palette.text} />
        </Pressable>
      </View>
      <View style={styles.weekRow}>
        {['一', '二', '三', '四', '五', '六', '日'].map((w) => (
          <Text key={w} style={styles.weekText}>{w}</Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((d) => {
          const inMonth = d.slice(5, 7) === p.month.slice(5, 7);
          const dot = STATUS_COLOR[p.statusByDate[d] ?? 'none'];
          return (
            <Pressable
              key={d}
              onPress={() => p.onSelect(d)}
              onLongPress={() => p.onLongPress(d)}
              style={[styles.cell, d === p.selected && styles.selected]}
            >
              <Text style={[styles.day, !inMonth && styles.outside, d === p.today && styles.todayText]}>
                {Number(d.slice(8, 10))}
              </Text>
              <View style={styles.dotRow}>
                {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : <View style={styles.dot} />}
                {p.exceptionDates.has(d) ? <Text style={styles.excMark}>!</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.white, borderRadius: 12, borderWidth: 1, borderColor: palette.border, padding: 12 },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  monthTitle: { fontSize: 16, fontWeight: '700', color: palette.text },
  weekRow: { flexDirection: 'row' },
  weekText: { flex: 1, textAlign: 'center', fontSize: 11, color: palette.subtext, paddingVertical: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', paddingTop: 6, borderRadius: 8 },
  selected: { borderWidth: 2, borderColor: palette.blue },
  day: { fontSize: 13, color: palette.text },
  outside: { color: '#C7C7CC' },
  todayText: { fontWeight: '800', color: palette.blue },
  dotRow: { height: 12, flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  excMark: { fontSize: 11, color: palette.danger, fontWeight: '800' },
});
