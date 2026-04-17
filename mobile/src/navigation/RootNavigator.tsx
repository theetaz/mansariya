import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createNativeBottomTabNavigator} from '@bottom-tabs/react-navigation';
import {useTranslation} from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';

import MapScreen from '../screens/MapScreen';
import SearchScreen from '../screens/SearchScreen';
import ContributeScreen from '../screens/ContributeScreen';
import SettingsScreen from '../screens/SettingsScreen';
import RouteDetailScreen from '../screens/RouteDetailScreen';
import JourneySearchScreen from '../screens/JourneySearchScreen';
import ContributorProfileScreen from '../screens/ContributorProfileScreen';
import ContributorClaimScreen from '../screens/ContributorClaimScreen';
import ContributorLoginScreen from '../screens/ContributorLoginScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import {palette} from '../constants/theme';
import {useTheme} from '../hooks/useTheme';

import type {RootStackParamList, TabParamList} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createNativeBottomTabNavigator<TabParamList>();

/**
 * Main tabs — uses `@bottom-tabs/react-navigation` so the iOS bar is a
 * real UITabBarController and the Android bar is a Material 3
 * BottomNavigationBar. This gets us the iOS 26 Liquid Glass tab bar
 * for free on iOS, with no custom BlurView/Pressable workarounds.
 *
 * Icons use SF Symbols on iOS (string sf names) and Android falls back
 * to vector icons from @expo/vector-icons.
 */
function MainTabs() {
  const {t} = useTranslation();

  return (
    <Tab.Navigator
      tabBarActiveTintColor={palette.emerald}
      tabBarInactiveTintColor="#8A9089">
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          tabBarLabel: t('tabs.map'),
          tabBarIcon: () => ({sfSymbol: 'map.fill'}),
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          tabBarLabel: t('tabs.search'),
          tabBarIcon: () => ({sfSymbol: 'magnifyingglass'}),
        }}
      />
      <Tab.Screen
        name="Contribute"
        component={ContributeScreen}
        options={{
          tabBarLabel: t('tabs.contribute'),
          tabBarIcon: () => ({sfSymbol: 'trophy.fill'}),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: t('tabs.settings'),
          tabBarIcon: () => ({sfSymbol: 'gearshape.fill'}),
        }}
      />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const {t} = useTranslation();
  const {colors: tc} = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: palette.green,
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
      <Stack.Screen
        name="ContributorProfile"
        component={ContributorProfileScreen}
        options={{title: t('contributor.profile_title')}}
      />
      <Stack.Screen
        name="ContributorClaim"
        component={ContributorClaimScreen}
        options={{title: t('contributor.claim_title')}}
      />
      <Stack.Screen
        name="ContributorLogin"
        component={ContributorLoginScreen}
        options={{title: t('contributor.login_title')}}
      />
      <Stack.Screen
        name="Leaderboard"
        component={LeaderboardScreen}
        options={{title: t('contributor.leaderboard_title')}}
      />
    </Stack.Navigator>
  );
}
