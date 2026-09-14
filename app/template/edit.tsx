import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Alert, Platform,
  ScrollView, Dimensions,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { repo, createAppActions } from '@/stores/useAppStore';
import { RepeaterEditor } from '@/features/template/RepeaterEditor';
import { checklistColors, palette } from '@/theme/colors';
import { todayStr } from '@/utils/date';
import { uuid } from '@/utils/id';
import type { RecurrenceType } from '@/repositories/types';

const ICON_OPTIONS = ['checkmark-circle-outline', 'heart-outline', 'car-outline', 'home-outline', 'briefcase-outline', 'fitness-outline'];
const COLOR_OPTIONS = Object.keys(checklistColors);
const ITEM_LIST_MAX = Dimensions.get('window').height * 0.45;

interface LocalItem { localId: string; title: string; dbId?: string }
interface LocalGroup { localId: string; title: string; dbId?: string; items: LocalItem[] }

export default function TemplateEditScreen() {
  const router = useRouter();
  const { checklistId } = useLocalSearchParams<{ checklistId?: string }>();
  const editing = checklistId ? repo.checklists.get(checklistId) : null;
  const actions = useMemo(() => createAppActions(repo), []);

  const scrollRef = useRef<any>(null);

  const [title, setTitle] = useState(editing?.title ?? '');
  const [icon, setIcon] = useState(editing?.icon ?? ICON_OPTIONS[0]);
  const [color, setColor] = useState(editing?.color ?? 'green');
  const [recurrence, setRecurrence] = useState<RecurrenceType>(editing?.recurrence ?? 'daily');
  const [weekdays, setWeekdays] = useState<number[]>(editing?.weekdays ?? []);
  const [groups, setGroups] = useState<LocalGroup[]>(() => {
    if (!checklistId) return [{ localId: uuid(), title: '分组 1', items: [] }];
    return repo.checklists.getStructure(checklistId).groups.map((g) => ({
      localId: g.id, dbId: g.id, title: g.title,
      items: g.items.map((it) => ({ localId: it.id, dbId: it.id, title: it.title })),
    }));
  });

  const updateGroup = useCallback((localId: string, patch: Partial<LocalGroup>) =>
    setGroups((gs) => gs.map((g) => (g.localId === localId ? { ...g, ...patch } : g))), []);

  const scrollToEndSoon = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 120);
    setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 320);
  }, []);

  const addItem = useCallback((groupLocalId: string) => {
    const newId = uuid();
    setGroups((gs) => gs.map((g) =>
      g.localId === groupLocalId
        ? { ...g, items: [...g.items, { localId: newId, title: '' }] }
        : g));
  }, []);

  const updateItem = useCallback((groupLocalId: string, itemLocalId: string, title: string) =>
    setGroups((gs) => gs.map((g) =>
      g.localId === groupLocalId
        ? { ...g, items: g.items.map((it) => (it.localId === itemLocalId ? { ...it, title } : it)) }
        : g)), []);

  const removeItem = useCallback((groupLocalId: string, itemLocalId: string) =>
    setGroups((gs) => gs.map((g) =>
      g.localId === groupLocalId
        ? { ...g, items: g.items.filter((it) => it.localId !== itemLocalId) }
        : g)), []);

  const moveItem = useCallback((groupLocalId: string, itemLocalId: string, delta: number) => {
    setGroups((gs) => gs.map((g) => {
      if (g.localId !== groupLocalId) return g;
      const idx = g.items.findIndex((it) => it.localId === itemLocalId);
      if (idx < 0) return g;
      const next = [...g.items];
      const [it] = next.splice(idx, 1);
      next.splice(Math.max(0, Math.min(next.length, idx + delta)), 0, it);
      return { ...g, items: next };
    }));
  }, []);

  const moveGroup = (index: number, delta: number) => {
    const next = [...groups];
    const [g] = next.splice(index, 1);
    next.splice(Math.max(0, Math.min(next.length, index + delta)), 0, g);
    setGroups(next);
  };

  const confirmDeleteGroup = (localId: string, title: string) => {
    Alert.alert('删除该分组？', `「${title}」及其检查项将被移除。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除', style: 'destructive',
        onPress: () => setGroups((gs) => (
          gs.length <= 1
            ? [{ localId: gs[0].localId, title: '分组 1', items: [] }]
            : gs.filter((x) => x.localId !== localId)
        )),
      },
    ]);
  };

  const save = () => {
    if (!title.trim()) return Alert.alert('请填写检查单名称');
    if (recurrence === 'weekly' && weekdays.length === 0) {
      return Alert.alert('请至少选择一个重复的星期');
    }
    const cleanGroups = groups
      .map((g, gi) => ({
        id: g.dbId, title: g.title.trim() || `分组 ${gi + 1}`, sortOrder: gi,
        items: g.items.filter((it) => it.title.trim()).map((it, ii) => ({ id: it.dbId, title: it.title.trim(), sortOrder: ii })),
      }));
    if (cleanGroups.every((g) => g.items.length === 0)) return Alert.alert('至少添加一个检查项');

    try {
      if (editing && checklistId) {
        actions.updateMeta(checklistId, { title: title.trim(), icon, color });
        actions.updateRecurrence(checklistId, { recurrence, weekdays });
        actions.replaceStructure(checklistId, cleanGroups);
      } else {
        actions.createChecklist({
          title: title.trim(), icon, color, recurrence, weekdays,
          today: todayStr(),
          groups: cleanGroups.map((g) => ({ title: g.title, items: g.items.map((it) => it.title) })),
        });
      }
      router.back();
    } catch {
      Alert.alert('保存失败，请重试');
    }
  };

  const confirmDelete = () => {
    if (!checklistId) { router.back(); return; }
    Alert.alert('删除该检查单？', '将同时删除其全部历史记录。', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => { actions.deleteChecklist(checklistId); router.back(); } },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Stack.Screen options={{
        headerShown: true, title: editing ? '编辑检查单' : '新建检查单',
        headerRight: () => (
          <Pressable onPress={save} hitSlop={10}><Text style={{ color: palette.blue, fontSize: 16, fontWeight: '600' }}>保存</Text></Pressable>
        ),
      }} />
      <KeyboardAwareScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.formContent}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput style={styles.input} placeholder="检查单名称" value={title} onChangeText={setTitle} />

        <View style={styles.row}>
          {ICON_OPTIONS.map((name) => (
            <Pressable key={name} onPress={() => setIcon(name)} style={[styles.iconBtn, icon === name && { backgroundColor: palette.lightGray }]}>
              <Ionicons name={name as any} size={20} color={icon === name ? palette.blue : palette.gray} />
            </Pressable>
          ))}
        </View>
        <View style={styles.row}>
          {COLOR_OPTIONS.map((c) => (
            <Pressable key={c} onPress={() => setColor(c)} style={[styles.colorDot, { backgroundColor: checklistColors[c] }, color === c && styles.colorSelected]} accessibilityRole="button" />
          ))}
        </View>

        <Text style={styles.label}>重复</Text>
        <RepeaterEditor recurrence={recurrence} weekdays={weekdays} onChange={(r, w) => { setRecurrence(r); setWeekdays(w); }} />

        {groups.map((g, gi) => (
          <View key={g.localId} style={styles.groupCard}>
            <View style={styles.groupHeader}>
              <TextInput style={styles.groupTitle} value={g.title} onChangeText={(t) => updateGroup(g.localId, { title: t })} />
              <Pressable hitSlop={8} disabled={gi === 0} onPress={() => moveGroup(gi, -1)}>
                <Ionicons name="chevron-up" size={18} color={gi === 0 ? '#C7C7CC' : palette.gray} />
              </Pressable>
              <Pressable hitSlop={8} disabled={gi === groups.length - 1} onPress={() => moveGroup(gi, 1)}>
                <Ionicons name="chevron-down" size={18} color={gi === groups.length - 1 ? '#C7C7CC' : palette.gray} />
              </Pressable>
              <Pressable hitSlop={8} onPress={() => confirmDeleteGroup(g.localId, g.title)}>
                <Ionicons name="trash-outline" size={16} color={palette.gray} />
              </Pressable>
            </View>

            <ScrollView
              style={{ maxHeight: ITEM_LIST_MAX }}
              contentContainerStyle={styles.itemList}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {g.items.map((it, ii) => (
                <View key={it.localId} style={styles.itemRow}>
                  <TextInput
                    style={styles.itemInput}
                    placeholder="检查项"
                    value={it.title}
                    onChangeText={(t) => updateItem(g.localId, it.localId, t)}
                  />
                  <Pressable hitSlop={8} disabled={ii === 0} onPress={() => moveItem(g.localId, it.localId, -1)}>
                    <Ionicons name="chevron-up" size={18} color={ii === 0 ? '#C7C7CC' : palette.gray} />
                  </Pressable>
                  <Pressable hitSlop={8} disabled={ii === g.items.length - 1} onPress={() => moveItem(g.localId, it.localId, 1)}>
                    <Ionicons name="chevron-down" size={18} color={ii === g.items.length - 1 ? '#C7C7CC' : palette.gray} />
                  </Pressable>
                  <Pressable hitSlop={8} onPress={() => removeItem(g.localId, it.localId)}>
                    <Ionicons name="close-circle-outline" size={18} color={palette.gray} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
            <Pressable onPress={() => addItem(g.localId)} style={styles.addItem}>
              <Ionicons name="add" size={16} color={palette.blue} />
              <Text style={styles.addItemText}>添加检查项</Text>
            </Pressable>
          </View>
        ))}

        <Pressable
          onPress={() => {
            setGroups((gs) => [...gs, { localId: uuid(), title: `分组 ${gs.length + 1}`, items: [] }]);
            scrollToEndSoon();
          }}
          style={styles.addGroup}
        >
          <Text style={styles.addGroupText}>＋ 添加分组</Text>
        </Pressable>

        <Pressable onPress={confirmDelete} style={styles.deleteBtn}>
          <Text style={styles.deleteText}>{editing ? '删除检查单' : '取消'}</Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  formContent: { padding: 16, paddingBottom: 64 },
  input: { backgroundColor: palette.white, borderRadius: 10, borderWidth: 1, borderColor: palette.border,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: palette.text },
  row: { flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  colorSelected: { borderWidth: 3, borderColor: palette.text },
  label: { fontSize: 13, fontWeight: '600', color: palette.subtext, marginTop: 18, marginBottom: 6 },
  groupCard: { backgroundColor: palette.white, borderRadius: 12, borderWidth: 1, borderColor: palette.border,
    padding: 12, marginTop: 14 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  groupTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: palette.text, paddingVertical: 4 },
  itemList: { paddingBottom: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.lightGray },
  itemInput: { flex: 1, fontSize: 15, color: palette.text, paddingVertical: 4 },
  addItem: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 10, justifyContent: 'center' },
  addItemText: { color: palette.blue, fontSize: 14 },
  addGroup: { borderWidth: 1, borderColor: palette.blue, borderRadius: 10, paddingVertical: 12,
    alignItems: 'center', marginTop: 14 },
  addGroupText: { color: palette.blue, fontSize: 15, fontWeight: '600' },
  deleteBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  deleteText: { color: palette.danger, fontSize: 15 },
});
