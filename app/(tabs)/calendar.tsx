import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert, type AlertButton } from 'react-native';
import { useRouter } from 'expo-router';
import { MonthCalendar } from '@/components/MonthCalendar';
import { repo, useAppStore, createAppActions } from '@/stores/useAppStore';
import { completionRate, dayStatus, streak, type DayStatusValue } from '@/services/progress';
import {
  addDays, eachDay, formatCN, fromDateStr, toDateStr, todayStr,
} from '@/utils/date';
import { checklistColors, palette } from '@/theme/colors';

export default function CalendarScreen() {
  const router = useRouter();
  const today = todayStr();
  const [month, setMonth] = useState(today.slice(0, 8) + '01');
  const [selected, setSelected] = useState(today);
  const [refresh, setRefresh] = useState(0);
  const actions = useMemo(() => createAppActions(repo), []);

  const windowStart = toDateStr(addDays(fromDateStr(today), -60));
  const windowEnd = toDateStr(addDays(fromDateStr(today), 30));

  const { statusByDate, exceptionDates } = useMemo(() => {
    const occs = repo.occurrences.listInRange(windowStart, windowEnd);
    const byDate = new Map<string, string[]>();
    for (const o of occs) byDate.set(o.dueDate, [...(byDate.get(o.dueDate) ?? []), o.status]);
    const status: Record<string, DayStatusValue> = {};
    for (const d of eachDay(windowStart, windowEnd)) {
      status[d] = dayStatus((byDate.get(d) ?? []).map((s) => ({ status: s })));
    }
    const exc = new Set<string>();
    for (const c of repo.checklists.listAll()) {
      repo.exceptions.listForChecklist(c.id).forEach((e) => exc.add(e.date));
    }
    return { statusByDate: status, exceptionDates: exc };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowStart, windowEnd, today, refresh]);

  const days30 = useMemo(
    () => eachDay(toDateStr(addDays(fromDateStr(today), -29)), today)
      .map((d) => ({ status: statusByDate[d] ?? 'none' })),
    [statusByDate, today],
  );

  const selectedOccs = useMemo(
    () => repo.occurrences.listByDate(selected),
    [selected, refresh],
  );

  const shiftMonth = (delta: number) => {
    const d = fromDateStr(month);
    d.setMonth(d.getMonth() + delta);
    setMonth(toDateStr(d).slice(0, 8) + '01');
  };

  const applyException = (checklistId: string, date: string, type: 'exclude' | 'include' | null) => {
    actions.setException(checklistId, date, type);
    useAppStore.getState().loadToday(today);
    setRefresh((v) => v + 1);
  };

  const chooseType = (checklistId: string, date: string) => {
    Alert.alert('标记为例外', `${formatCN(date)} 如何处理？`, [
      { text: '跳过（不检查）', onPress: () => applyException(checklistId, date, 'exclude') },
      { text: '补做一次', onPress: () => applyException(checklistId, date, 'include') },
      { text: '取消例外', style: 'destructive', onPress: () => applyException(checklistId, date, null) },
      { text: '返回', style: 'cancel' },
    ]);
  };

  const longPress = (date: string) => {
    if (date < today) return;
    const active = repo.checklists.listActive();
    if (active.length === 0) return Alert.alert('还没有检查单');
    Alert.alert(
      `${formatCN(date)} 例外设置`,
      '选择要调整的检查单',
      active.map<AlertButton>((c) => ({ text: c.title, onPress: () => chooseType(c.id, date) }))
        .concat([{ text: '取消', style: 'cancel' }]),
    );
  };

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
      data={selectedOccs}
      keyExtractor={(o) => o.id}
      ListHeaderComponent={
        <View>
          <View style={styles.stats}>
            <Text style={styles.statText}>🔥 连续 {streak(statusByDate, today)} 天</Text>
            <Text style={styles.statText}>近30天完成率 {Math.round(completionRate(days30) * 100)}%</Text>
          </View>
          <MonthCalendar
            month={month}
            title={`${month.slice(0, 4)}年${Number(month.slice(5, 7))}月`}
            statusByDate={statusByDate}
            exceptionDates={exceptionDates}
            selected={selected}
            today={today}
            onSelect={setSelected}
            onLongPress={longPress}
            onPrev={() => shiftMonth(-1)}
            onNext={() => shiftMonth(1)}
          />
          <View style={styles.legend}>
            <Text style={styles.legendText}>
              <Text style={{ color: palette.green }}>●</Text> 全部完成　
              <Text style={{ color: palette.orange }}>●</Text> 部分　
              <Text style={{ color: palette.gray }}>●</Text> 未完成　! 例外（长按日期设置）
            </Text>
          </View>
          <Text style={styles.dayTitle}>{formatCN(selected)}</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          style={styles.occRow}
          onPress={() => router.push(`/checklist/${item.id}`)}
          accessibilityRole="button"
        >
          <Text style={[styles.dot, { color: checklistColors[item.color] ?? palette.green }]}>●</Text>
          <Text style={styles.occTitle}>{item.checklistTitle}</Text>
          <Text style={[styles.occStatus, item.status === 'done' && styles.occDone]}>
            {item.status === 'done' ? '已完成' : '未完成'}
          </Text>
        </Pressable>
      )}
      ListEmptyComponent={<Text style={styles.emptyDay}>当天没有检查安排</Text>}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  stats: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  statText: { fontSize: 14, fontWeight: '600', color: palette.text },
  legend: { marginVertical: 8 },
  legendText: { fontSize: 11, color: palette.subtext },
  dayTitle: { fontSize: 15, fontWeight: '700', color: palette.text, marginTop: 4, marginBottom: 8 },
  occRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: palette.white,
    borderWidth: 1, borderColor: palette.border, borderRadius: 10, padding: 12, marginBottom: 8 },
  dot: { fontSize: 12 },
  occTitle: { flex: 1, fontSize: 15, color: palette.text },
  occStatus: { fontSize: 13, color: palette.subtext },
  occDone: { color: palette.green, fontWeight: '600' },
  emptyDay: { color: palette.subtext, textAlign: 'center', marginTop: 16 },
});
