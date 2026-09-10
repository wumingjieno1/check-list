import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Checkbox } from '@/components/Checkbox';
import { ProgressBar } from '@/components/ProgressBar';
import { checklistColors, palette } from '@/theme/colors';
import type { TodayRow } from '@/stores/useAppStore';

interface Props {
  row: TodayRow;
  onOpen: () => void;
  onQuickToggle: () => void;
}

export function TodayCard({ row, onOpen, onQuickToggle }: Props) {
  const done = row.status === 'done';
  const color = checklistColors[row.color] ?? palette.green;
  return (
    <Pressable onPress={onOpen} style={[styles.card, done && styles.cardDone]} accessibilityRole="button">
      <View style={styles.top}>
        <Ionicons name={(row.icon as any) ?? 'checkmark-circle-outline'} size={20} color={color} />
        <Text style={[styles.title, done && styles.doneText]} numberOfLines={1}>{row.title}</Text>
        <Text style={styles.count}>{row.done}/{row.total}</Text>
        <Checkbox checked={done} onChange={onQuickToggle} color={color} disabled={done} />
      </View>
      <ProgressBar value={row.total === 0 ? 0 : row.done / row.total} color={color} />
      <Text style={styles.state}>
        {done ? '已完成' : row.done > 0 ? `进行中 ${row.done}/${row.total}` : '未开始'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.white, borderRadius: 12, borderWidth: 1, borderColor: palette.border, padding: 14, marginBottom: 10 },
  cardDone: { opacity: 0.55 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '600', color: palette.text, flexShrink: 1 },
  doneText: { textDecorationLine: 'line-through' },
  count: { fontSize: 12, color: palette.subtext, marginLeft: 'auto' },
  state: { fontSize: 12, color: palette.subtext, marginTop: 4 },
});
