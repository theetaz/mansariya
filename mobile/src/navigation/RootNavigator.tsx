import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {useTranslation} from 'react-i18next';

import MapScreen from '../screens/MapScreen';
import SearchScreen from '../screens/SearchScreen';
import SavedScreen from '../screens/SavedScreen';
import SettingsScreen from '../screens/SettingsScreen';
import RouteDetailScreen from '../screens/RouteDetailScreen';
import JourneySearchScreen from '../screens/JourneySearchScreen';
import GlassTabBar from '../components/GlassTabBar';
import {colors} from '../constants/theme';
import {useTheme} from '../hooks/useTheme';

import type {RootStackParamList, TabParamList} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function MainTabs() {
  const {t} = useTranslation();

  const {colors: tc} = useTheme();

  return (
    <Tab.Navigator
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // Scenes fill full screen — tab bar overlays as absolute positioned glass
        sceneStyle: {backgroundColor: tc.background, paddingBottom: 0},
      }}>
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
  const {colors: tc} = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: colors.green,
        headerBackTitle: '',
        headerBackButtonDisplayMode: 'minimal',
        headerTitleStyle: {fontSize: 17, fontWeight: '600', color: tc.text},
        headerStyle: {backgroundColor: tc.headerBg},
        headerShadowVisible: false,
      }}>
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{headerShown: false, title: ''}}
      />
      <Stack.Screen
        name="RouteDetail"
        component={RouteDetailScreen}
        options={{title: 'Route'}}
      />
      <Stack.Screen
        name="JourneySearch"
        component={JourneySearchScreen}
        options={{title: 'Plan Journey'}}
      />
    </Stack.Navigator>
  );
}
