import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { ThemedText } from '@/components/themed-text';
import { t } from '@/lib/i18n';
import { AccessibilityTokens, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLargeTextLayout } from '@/hooks/use-large-text-layout';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const colors = Colors[colorScheme ?? 'light'];
  const usesLargeText = useLargeTextLayout();
  const tabLabel = (label: string) => usesLargeText
    ? ({ color }: { color: string }) => (
        <ThemedText
          adjustsFontSizeToFit
          maxFontSizeMultiplier={AccessibilityTokens.compactTextMaxFontSizeMultiplier}
          minimumFontScale={0.75}
          numberOfLines={1}
          style={[styles.tabLabel, { color }]}>
          {label}
        </ThemedText>
      )
    : label;

  return (
    <Tabs
      initialRouteName="home"
      backBehavior="history"
      screenOptions={{
        tabBarActiveTintColor: colors.tabIconSelected,
        tabBarInactiveTintColor: colors.tabIconDefault,
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
        name="home"
        options={{
          title: t('navigation.home'),
          tabBarButtonTestID: 'tab-home',
          tabBarLabel: tabLabel(t('navigation.home')),
          tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="incomes"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="movements"
        options={{
          title: t('navigation.movements'),
          tabBarButtonTestID: 'tab-movements',
          tabBarLabel: tabLabel(t('navigation.movements')),
          tabBarIcon: ({ color }) => <Ionicons name="swap-horizontal" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: t('navigation.addMovement'),
          tabBarButtonTestID: 'tab-add-movement',
          tabBarLabel: tabLabel(t('navigation.add')),
          tabBarIcon: () => (
            <View style={[styles.addIcon, { backgroundColor: colors.action }]}>
              <Ionicons name="add" size={22} color={colors.onPrimary} />
            </View>
          ),
          tabBarButton: (props) => (
            <HapticTab
              {...props}
              onPress={() => router.push('/modal/quick-add')}
              accessibilityLabel={t('accessibility.addExpense')}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="summary"
        options={{
          title: t('navigation.history'),
          tabBarButtonTestID: 'tab-history',
          tabBarLabel: tabLabel(t('navigation.history')),
          tabBarIcon: ({ color }) => <Ionicons name="bar-chart" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="user"
        options={{
          title: t('navigation.settings'),
          tabBarButtonTestID: 'tab-user',
          tabBarLabel: tabLabel(t('navigation.settings')),
          tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabLabel: {
    width: '100%',
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
  addIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
