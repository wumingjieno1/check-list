import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Checkbox } from '@/components/Checkbox';
import { palette } from '@/theme/colors';
import type { GroupView } from '@/services/progress';

interface Props {
  group: GroupView;
  color: string;
  readOnly: boolean;
  onToggle: (occurrenceItemId: string) => void;
  defaultExpanded?: boolean;
}

export function GroupSection({ group, color, readOnly, onToggle, defaultExpanded = true }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <View style={styles.group}>
      <Pressable onPress={() => setExpanded((v) => !v)} style={styles.header} accessibilityRole="button">
        <Ionicons name={expanded ? 'chevron-down' : 'chevron-forward'} size={16} color={palette.gray} />
        <Text style={styles.title}>{group.title}</Text>
        <Text style={styles.count}>{group.done}/{group.total}</Text>
      </Pressable>
      {expanded ? group.items.map((it) => (
        <View key={it.occurrenceItemId} style={styles.row}>
          <Text style={[styles.itemText, it.done === 1 && styles.doneText]}>{it.itemTitle}</Text>
          {readOnly ? (
            it.done === 1
              ? <Ionicons name="checkmark-circle" size={24} color={color} style={styles.readMark} />
              : <View style={styles.readPlaceholder} />
          ) : (
            <Checkbox checked={it.done === 1} onChange={() => onToggle(it.occurrenceItemId)} color={color} />
          )}
        </View>
      )) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { backgroundColor: palette.white, borderRadius: 12, borderWidth: 1, borderColor: palette.border, marginBottom: 12, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 12 },
  title: { fontSize: 14, fontWeight: '700', color: palette.subtext },
  count: { marginLeft: 'auto', fontSize: 12, color: palette.subtext },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border, minHeight: 48 },
  itemText: { flex: 1, fontSize: 15, color: palette.text, paddingVertical: 12 },
  doneText: { color: palette.subtext, textDecorationLine: 'line-through' },
  readMark: { marginRight: 10 },
  readPlaceholder: { width: 44, height: 44 },
});
