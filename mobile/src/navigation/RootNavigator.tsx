import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {useTranslation} from 'react-i18next';
import {Text, StyleSheet} from 'react-native';

import MapScreen from '../screens/MapScreen';
import SearchScreen from '../screens/SearchScreen';
import SavedScreen from '../screens/SavedScreen';
import SettingsScreen from '../screens/SettingsScreen';
import RouteDetailScreen from '../screens/RouteDetailScreen';
import {colors} from '../constants/theme';

import type {RootStackParamList, TabParamList} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TAB_ICONS: Record<string, {active: string; inactive: string}> = {
  Map: {active: '🗺️', inactive: '🗺️'},
  Search: {active: '🔍', inactive: '🔍'},
  Saved: {active: '⭐', inactive: '☆'},
  Settings: {active: '⚙️', inactive: '⚙️'},
};

function MainTabs() {
  const {t} = useTranslation();

  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        tabBarIcon: ({focused}) => (
          <Text style={[styles.tabIcon, {opacity: focused ? 1 : 0.5}]}>
            {focused
              ? TAB_ICONS[route.name]?.active
              : TAB_ICONS[route.name]?.inactive}
          </Text>
        ),
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.neutral500,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        headerShown: false,
      })}>
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{tabBarLabel: t('tabs.map')}}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{tabBarLabel: t('tabs.search')}}
      />
      <Tab.Screen
        name="Saved"
        component={SavedScreen}
        options={{tabBarLabel: t('tabs.saved')}}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{tabBarLabel: t('tabs.settings')}}
      />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: colors.green,
      }}>
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="RouteDetail"
        component={RouteDetailScreen}
        options={{title: 'Route'}}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.background,
    borderTopColor: colors.neutral200,
    height: 56,
    paddingBottom: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  tabIcon: {
    fontSize: 20,
  },
});
