import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { repo, createAppActions } from '@/stores/useAppStore';
import { EmptyState } from '@/components/EmptyState';
import { checklistColors, palette } from '@/theme/colors';
import type { RecurrenceType } from '@/repositories/types';

const RECAP: Record<RecurrenceType, string> = {
  none: '不重复', daily: '每天', workdays: '工作日', weekly: '每周',
};

export default function TemplatesScreen() {
  const router = useRouter();
  const [version, setVersion] = useState(0);
  useFocusEffect(useCallback(() => setVersion((v) => v + 1), []));

  const all = repo.checklists.listAll();
  const active = all.filter((c) => !c.isArchived);
  const archived = all.filter((c) => c.isArchived);
  const actions = createAppActions(repo);

  const countItems = (id: string) =>
    repo.checklists.getStructure(id).groups.reduce((n, g) => n + g.items.length, 0);

  const confirmDelete = (id: string, title: string) => {
    Alert.alert(`删除「${title}」？`, '将同时删除其全部历史记录，此操作不可恢复。', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => { actions.deleteChecklist(id); setVersion((v) => v + 1); } },
    ]);
  };

  const renderItem = ({ item }: { item: ReturnType<typeof repo.checklists.listAll>[number] }) => (
    <Pressable style={styles.row} onPress={() => router.push(`/template/edit?checklistId=${item.id}`)}>
      <Ionicons name={(item.icon as any) ?? 'list'} size={20} color={checklistColors[item.color] ?? palette.green} />
      <View style={styles.meta}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.sub}>{RECAP[item.recurrence]}{item.recurrence === 'weekly' ? ` ${item.weekdays.map((w) => '一二三四五六日'[w - 1]).join('')}` : ''} · {countItems(item.id)} 项</Text>
      </View>
      <Pressable hitSlop={8} onPress={() => confirmDelete(item.id, item.title)}>
        <Ionicons name="trash-outline" size={18} color={palette.gray} />
      </Pressable>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <FlatList
        key={`v${version}`}
        contentContainerStyle={{ padding: 16 }}
        data={[...active, ...archived]}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={archived.length > 0 ? <Text style={styles.sectionLabel}>归档（{archived.length}）</Text> : null}
        ListEmptyComponent={<EmptyState title="还没有检查单" subtitle="新建一个每日打卡清单" />}
        renderItem={renderItem}
      />
      <Pressable style={styles.fab} onPress={() => router.push('/template/edit')} accessibilityRole="button">
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  sectionLabel: { fontSize: 12, color: palette.subtext, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: palette.white,
    borderWidth: 1, borderColor: palette.border, borderRadius: 10, padding: 12, marginBottom: 8 },
  meta: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', color: palette.text },
  sub: { fontSize: 12, color: palette.subtext, marginTop: 2 },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28,
    backgroundColor: palette.blue, alignItems: 'center', justifyContent: 'center' },
});
