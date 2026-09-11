import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { t } from '@/lib/i18n';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="period"
        options={{
          title: t('navigation.home'),
          tabBarButtonTestID: 'tab-period',
          tabBarLabel: t('navigation.home'),
          tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="incomes"
        options={{
          title: t('navigation.incomes'),
          tabBarButtonTestID: 'tab-incomes',
          tabBarLabel: t('navigation.incomes'),
          tabBarIcon: ({ color }) => <Ionicons name="cash" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: t('navigation.expenses'),
          tabBarButtonTestID: 'tab-expenses',
          tabBarLabel: t('navigation.expenses'),
          tabBarIcon: ({ color }) => <Ionicons name="cash-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="summary"
        options={{
          title: t('navigation.history'),
          tabBarButtonTestID: 'tab-history',
          tabBarLabel: t('navigation.history'),
          tabBarIcon: ({ color }) => <Ionicons name="bar-chart" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="user"
        options={{
          title: t('navigation.user'),
          tabBarButtonTestID: 'tab-user',
          tabBarLabel: t('navigation.user'),
          tabBarIcon: ({ color }) => <Ionicons name="person" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
