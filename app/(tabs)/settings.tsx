import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Provider as AntProvider, List, Button, ActivityIndicator } from '@ant-design/react-native';
import { IconOutline } from '@ant-design/icons-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { repo } from '@/stores/useAppStore';
import { buildExportJson } from '@/services/export';
import { palette } from '@/theme/colors';

function SettingsScreenInner() {
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
        try {
          await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: '导出检查清单数据' });
        } catch (e) {
          const code = (e as { code?: string })?.code ?? '';
          if (!code.includes('CANCEL')) throw e;
        }
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
      <List renderHeader="数据">
        <List.Item
          thumb={<IconOutline name="export" size={22} color={palette.blue} />}
          extra={busy ? <ActivityIndicator size="small" /> : <IconOutline name="right" size={18} color={palette.gray} />}
          onPress={busy ? undefined : exportData}
        >
          导出数据（JSON 备份）
        </List.Item>
      </List>

      <List renderHeader="提醒">
        <List.Item
          thumb={<IconOutline name="notification" size={22} color={palette.subtext} />}
          extra={<Text style={styles.soon}>即将推出</Text>}
        >
          <Text style={styles.disabledText}>每日提醒</Text>
        </List.Item>
      </List>

      <View style={styles.actions}>
        <Button type="primary" onPress={exportData} loading={busy}>
          导出 JSON 备份
        </Button>
      </View>

      <Text style={styles.version}>检查清单 v0.1.0 · 数据仅保存在本机</Text>
    </View>
  );
}

export default function SettingsScreen() {
  return (
    <AntProvider>
      <SettingsScreenInner />
    </AntProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  actions: { padding: 16 },
  soon: { fontSize: 12, color: palette.subtext },
  disabledText: { color: palette.subtext },
  version: { fontSize: 12, color: palette.subtext, textAlign: 'center', marginTop: 8 },
});
