import React, { useCallback, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAppStore, repo } from '@/stores/useAppStore';
import { TodayCard } from '@/features/today/TodayCard';
import { EmptyState } from '@/components/EmptyState';
import { palette } from '@/theme/colors';
import {
  addDays, formatCN, fromDateStr, toDateStr, todayStr, weekday,
} from '@/utils/date';
import { streak } from '@/services/progress';
import { buildDayStatusMap } from '@/services/history';

const WEEK_CN = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export default function TodayScreen() {
  const router = useRouter();
  const rows = useAppStore((s) => s.todayRows);
  const loadToday = useAppStore((s) => s.loadToday);
  const today = todayStr();

  useFocusEffect(useCallback(() => {
    loadToday(today);
  }, [loadToday, today]));

  const sorted = useMemo(
    () => [...rows].sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done')),
    [rows],
  );

  const streakCount = useMemo(() => {
    const start = toDateStr(addDays(fromDateStr(today), -29));
    return streak(buildDayStatusMap(repo, start, today, today), today);
  }, [today, rows]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 11) return '早上好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    return '晚上好';
  })();
  const doneCount = rows.filter((r) => r.status === 'done').length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.date}>{formatCN(today)} {WEEK_CN[weekday(new Date())]}</Text>
        <Text style={styles.hello}>
          {greeting} · 今日 {doneCount}/{rows.length} 已完成{streakCount > 0 ? ` · 🔥 ${streakCount} 天` : ''}
        </Text>
      </View>
      {rows.length === 0 ? (
        <EmptyState
          title="今天没有检查安排"
          subtitle="创建一个检查单，开始每日打卡"
          actionLabel="去创建"
          onAction={() => router.push('/template/edit')}
        />
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(r) => r.occurrenceId}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <TodayCard
              row={item}
              onOpen={() => router.push(`/checklist/${item.occurrenceId}`)}
              onQuickToggle={() => useAppStore.getState().quickToggle(item)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  date: { fontSize: 22, fontWeight: '700', color: palette.text },
  hello: { fontSize: 13, color: palette.subtext, marginTop: 2 },
});
