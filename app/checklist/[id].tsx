import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ProgressRing } from '@/components/ProgressRing';
import { GroupSection } from '@/features/checklist/GroupSection';
import { repo } from '@/stores/useAppStore';
import { groupByGroup, occurrenceProgress } from '@/services/progress';
import { toggleItem } from '@/services/actions';
import { checklistColors, palette } from '@/theme/colors';
import { formatCN, todayStr } from '@/utils/date';

export default function ChecklistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [version, setVersion] = useState(0);

  useFocusEffect(useCallback(() => {
    setVersion((v) => v + 1);
  }, []));

  const occ = useMemo(() => (id ? repo.occurrences.get(id) : null), [id, version]);
  const flat = useMemo(() => (id ? repo.occurrences.getFlatItems(id) : []), [id, version]);
  const groups = useMemo(() => groupByGroup(flat), [flat]);
  const progress = occurrenceProgress(flat);
  const readOnly = occ ? occ.dueDate < todayStr() : false;
  const color = checklistColors[occ?.color ?? 'green'] ?? palette.green;
  const justFinished = progress.isDone;

  const onToggle = (oiId: string) => {
    if (!id) return;
    const { isDone } = toggleItem(repo, id, oiId, Date.now());
    if (isDone && !justFinished) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    setVersion((v) => v + 1);
  };

  if (!occ) {
    return (
      <View style={styles.center}><Text>未找到该检查</Text></View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: `${occ.checklistTitle} · ${formatCN(occ.dueDate)}` }} />
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={groups}
        keyExtractor={(g) => `${g.sortOrder}:${g.title}`}
        ListHeaderComponent={<ProgressRing done={progress.done} total={progress.total} color={color} />}
        renderItem={({ item }) => (
          <GroupSection group={item} color={color} readOnly={readOnly} onToggle={onToggle} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
