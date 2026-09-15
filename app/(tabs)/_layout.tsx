import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '@/theme/colors';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: palette.blue,
      tabBarInactiveTintColor: palette.gray,
      headerStyle: { backgroundColor: palette.bg },
    }}>
      <Tabs.Screen name="index" options={{
        title: '今日',
        tabBarIcon: ({ color, size }) => <Ionicons name="today-outline" color={color} size={size} />,
      }} />
      <Tabs.Screen name="calendar" options={{
        title: '日历',
        tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" color={color} size={size} />,
      }} />
      <Tabs.Screen name="templates" options={{
        title: '检查单',
        tabBarIcon: ({ color, size }) => <Ionicons name="list-outline" color={color} size={size} />,
      }} />
      <Tabs.Screen name="settings" options={{
        title: '设置',
        tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} />,
      }} />
    </Tabs>
  );
}
