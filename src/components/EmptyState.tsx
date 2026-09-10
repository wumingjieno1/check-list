import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { palette } from '@/theme/colors';

export function EmptyState({ title, subtitle, actionLabel, onAction }: {
  title: string; subtitle?: string; actionLabel?: string; onAction?: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      {actionLabel ? (
        <Pressable style={styles.btn} onPress={onAction} accessibilityRole="button">
          <Text style={styles.btnText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  title: { fontSize: 17, fontWeight: '600', color: palette.text, textAlign: 'center' },
  sub: { fontSize: 14, color: palette.subtext, textAlign: 'center' },
  btn: { marginTop: 12, backgroundColor: palette.blue, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
