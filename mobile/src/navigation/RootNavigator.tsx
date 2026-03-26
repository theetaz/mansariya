import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {useTranslation} from 'react-i18next';
import {Text} from 'react-native';

import MapScreen from '../screens/MapScreen';
import SearchScreen from '../screens/SearchScreen';
import SavedScreen from '../screens/SavedScreen';
import SettingsScreen from '../screens/SettingsScreen';
import RouteDetailScreen from '../screens/RouteDetailScreen';

import type {RootStackParamList, TabParamList} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function TabIcon({label, focused}: {label: string; focused: boolean}) {
  const icons: Record<string, string> = {
    Map: '🗺️',
    Search: '🔍',
    Saved: '⭐',
    Settings: '⚙️',
  };
  return (
    <Text style={{fontSize: 20, opacity: focused ? 1 : 0.5}}>
      {icons[label] || '•'}
    </Text>
  );
}

function MainTabs() {
  const {t} = useTranslation();

  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        tabBarIcon: ({focused}) => (
          <TabIcon label={route.name} focused={focused} />
        ),
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#999',
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
    <Stack.Navigator>
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
