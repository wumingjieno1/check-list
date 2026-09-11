import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { repo } from '@/stores/useAppStore';
import { buildExportJson } from '@/services/export';
import { palette } from '@/theme/colors';

export default function SettingsScreen() {
  const [busy, setBusy] = useState(false);

  const exportData = async () => {
    setBusy(true);
    try {
      const json = buildExportJson(repo);
      const fileName = `checklist-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const uri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(uri, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: '导出检查清单数据' });
      } else {
        Alert.alert('已导出', `文件已保存：${uri}`);
      }
    } catch (e) {
      Alert.alert('导出失败', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.row} onPress={exportData} disabled={busy} accessibilityRole="button">
        <Text style={styles.rowText}>导出数据（JSON 备份）</Text>
        {busy ? <ActivityIndicator color={palette.blue} /> : <Text style={styles.chevron}>›</Text>}
      </Pressable>
      <View style={[styles.row, styles.disabled]}>
        <Text style={[styles.rowText, { color: palette.subtext }]}>每日提醒（即将推出）</Text>
        <Text style={styles.chevron}>›</Text>
      </View>
      <Text style={styles.version}>检查清单 v0.1.0 · 数据仅保存在本机</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg, padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.white,
    borderWidth: 1, borderColor: palette.border, borderRadius: 10, padding: 14, marginBottom: 10 },
  disabled: { opacity: 0.6 },
  rowText: { flex: 1, fontSize: 15, color: palette.text },
  chevron: { fontSize: 20, color: palette.gray },
  version: { fontSize: 12, color: palette.subtext, textAlign: 'center', marginTop: 16 },
});
