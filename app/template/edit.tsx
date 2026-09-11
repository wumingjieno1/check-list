import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Alert, Keyboard, KeyboardAvoidingView, Platform,
  TouchableOpacity, Dimensions,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { NestableDraggableFlatList, NestableScrollContainer, ScaleDecorator } from 'react-native-draggable-flatlist';
import { useSafeNestableScrollContainerContext } from 'react-native-draggable-flatlist/src/context/nestableScrollContainerContext';
import { repo, createAppActions } from '@/stores/useAppStore';
import { RepeaterEditor } from '@/features/template/RepeaterEditor';
import { checklistColors, palette } from '@/theme/colors';
import { todayStr } from '@/utils/date';
import { uuid } from '@/utils/id';
import type { RecurrenceType } from '@/repositories/types';

const ICON_OPTIONS = ['checkmark-circle-outline', 'heart-outline', 'car-outline', 'home-outline', 'briefcase-outline', 'fitness-outline'];
const COLOR_OPTIONS = Object.keys(checklistColors);

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

  const addItem = useCallback((groupLocalId: string) =>
    setGroups((gs) => gs.map((g) =>
      g.localId === groupLocalId
        ? { ...g, items: [...g.items, { localId: uuid(), title: '' }] }
        : g)), []);

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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{
        headerShown: true, title: editing ? '编辑检查单' : '新建检查单',
        headerRight: () => (
          <Pressable onPress={save} hitSlop={10}><Text style={{ color: palette.blue, fontSize: 16, fontWeight: '600' }}>保存</Text></Pressable>
        ),
      }} />
      <NestableScrollContainer ref={scrollRef} keyboardShouldPersistTaps="handled">
        <FormBody
          scrollRef={scrollRef}
          title={title} setTitle={setTitle}
          icon={icon} setIcon={setIcon}
          color={color} setColor={setColor}
          recurrence={recurrence}
          weekdays={weekdays}
          onRecurrenceChange={(r, w) => { setRecurrence(r); setWeekdays(w); }}
          groups={groups}
          updateGroup={updateGroup}
          updateItem={updateItem}
          removeItem={removeItem}
          addItem={addItem}
          moveGroup={moveGroup}
          confirmDeleteGroup={confirmDeleteGroup}
          addGroup={() => setGroups((gs) => [...gs, { localId: uuid(), title: `分组 ${gs.length + 1}`, items: [] }])}
          onDragEnd={(localId, data) => updateGroup(localId, { items: data })}
          confirmDelete={confirmDelete}
          editing={!!editing}
        />
      </NestableScrollContainer>
    </KeyboardAvoidingView>
  );
}

interface FormBodyProps {
  scrollRef: any;
  title: string; setTitle: (t: string) => void;
  icon: string; setIcon: (i: string) => void;
  color: string; setColor: (c: string) => void;
  recurrence: RecurrenceType;
  weekdays: number[];
  onRecurrenceChange: (r: RecurrenceType, w: number[]) => void;
  groups: LocalGroup[];
  updateGroup: (id: string, patch: Partial<LocalGroup>) => void;
  updateItem: (gid: string, iid: string, title: string) => void;
  removeItem: (gid: string, iid: string) => void;
  addItem: (gid: string) => void;
  moveGroup: (index: number, delta: number) => void;
  confirmDeleteGroup: (id: string, title: string) => void;
  addGroup: () => void;
  onDragEnd: (gid: string, data: LocalItem[]) => void;
  confirmDelete: () => void;
  editing: boolean;
}

function FormBody(p: FormBodyProps) {
  const { outerScrollOffset } = useSafeNestableScrollContainerContext();
  const focusedInput = useRef<any>(null);
  const keyboardH = useRef(0);

  const scrollFocusedIntoView = useCallback(() => {
    if (Platform.OS !== 'android') return;
    const input = focusedInput.current;
    const scroll = p.scrollRef.current;
    if (!input || !scroll || keyboardH.current === 0) return;

    input.measureInWindow((_x: number, y: number, _w: number, h: number) => {
      const gap = 16;
      const visibleBottom = Dimensions.get('window').height - keyboardH.current;
      const current = outerScrollOffset.value;
      let target: number | null = null;
      if (y + h > visibleBottom - gap) {
        target = current + (y + h - visibleBottom + gap);
      } else if (y < gap) {
        target = current - (gap - y);
      }
      if (target != null) scroll.scrollTo({ y: Math.max(0, target), animated: true });
    });
  }, [outerScrollOffset, p.scrollRef]);

  const onInputFocus = useCallback((e: any) => {
    focusedInput.current = e.currentTarget;
    if (Platform.OS !== 'android') return;
    setTimeout(scrollFocusedIntoView, 50);
    setTimeout(scrollFocusedIntoView, 150);
    setTimeout(scrollFocusedIntoView, 350);
  }, [scrollFocusedIntoView]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (ev) => {
      keyboardH.current = ev.endCoordinates.height;
      setTimeout(scrollFocusedIntoView, 0);
      setTimeout(scrollFocusedIntoView, 150);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardH.current = 0;
    });
    return () => { show.remove(); hide.remove(); };
  }, [scrollFocusedIntoView]);

  return (
    <View style={styles.formContent}>
      <TextInput
        style={styles.input}
        placeholder="检查单名称"
        value={p.title}
        onChangeText={p.setTitle}
        onFocus={onInputFocus}
      />

      <View style={styles.row}>
        {ICON_OPTIONS.map((name) => (
          <Pressable key={name} onPress={() => p.setIcon(name)} style={[styles.iconBtn, p.icon === name && { backgroundColor: palette.lightGray }]}>
            <Ionicons name={name as any} size={20} color={p.icon === name ? palette.blue : palette.gray} />
          </Pressable>
        ))}
      </View>
      <View style={styles.row}>
        {COLOR_OPTIONS.map((c) => (
          <Pressable key={c} onPress={() => p.setColor(c)} style={[styles.colorDot, { backgroundColor: checklistColors[c] }, p.color === c && styles.colorSelected]} accessibilityRole="button" />
        ))}
      </View>

      <Text style={styles.label}>重复</Text>
      <RepeaterEditor recurrence={p.recurrence} weekdays={p.weekdays} onChange={p.onRecurrenceChange} />

      {p.groups.map((g, gi) => (
        <View key={g.localId} style={styles.groupCard}>
          <View style={styles.groupHeader}>
            <TextInput
              style={styles.groupTitle}
              value={g.title}
              onChangeText={(t) => p.updateGroup(g.localId, { title: t })}
              onFocus={onInputFocus}
            />
            <Pressable hitSlop={8} disabled={gi === 0} onPress={() => p.moveGroup(gi, -1)}>
              <Ionicons name="chevron-up" size={18} color={gi === 0 ? '#C7C7CC' : palette.gray} />
            </Pressable>
            <Pressable hitSlop={8} disabled={gi === p.groups.length - 1} onPress={() => p.moveGroup(gi, 1)}>
              <Ionicons name="chevron-down" size={18} color={gi === p.groups.length - 1 ? '#C7C7CC' : palette.gray} />
            </Pressable>
            <Pressable hitSlop={8} onPress={() => p.confirmDeleteGroup(g.localId, g.title)}>
              <Ionicons name="trash-outline" size={16} color={palette.gray} />
            </Pressable>
          </View>

          <NestableDraggableFlatList
            data={g.items}
            keyExtractor={(it) => it.localId}
            renderItem={({ item, drag }) => (
              <ScaleDecorator>
                <TouchableOpacity onLongPress={drag} activeOpacity={0.7} style={styles.itemRow}>
                  <Ionicons name="reorder-three-outline" size={22} color={palette.gray} />
                  <TextInput
                    style={styles.itemInput}
                    placeholder="检查项"
                    value={item.title}
                    onChangeText={(t) => p.updateItem(g.localId, item.localId, t)}
                    onFocus={onInputFocus}
                  />
                  <Pressable hitSlop={8} onPress={() => p.removeItem(g.localId, item.localId)}>
                    <Ionicons name="close-circle-outline" size={18} color={palette.gray} />
                  </Pressable>
                </TouchableOpacity>
              </ScaleDecorator>
            )}
            onDragEnd={({ data }) => p.onDragEnd(g.localId, data)}
          />
          <Pressable onPress={() => p.addItem(g.localId)} style={styles.addItem}>
            <Ionicons name="add" size={16} color={palette.blue} />
            <Text style={styles.addItemText}>添加检查项</Text>
          </Pressable>
        </View>
      ))}

      <Pressable onPress={p.addGroup} style={styles.addGroup}>
        <Text style={styles.addGroupText}>＋ 添加分组</Text>
      </Pressable>

      <Pressable onPress={p.confirmDelete} style={styles.deleteBtn}>
        <Text style={styles.deleteText}>{p.editing ? '删除检查单' : '取消'}</Text>
      </Pressable>
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
