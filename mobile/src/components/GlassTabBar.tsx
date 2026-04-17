import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {BlurView} from 'expo-blur';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';

import {useTheme} from '../hooks/useTheme';
import {palette, radii} from '../constants/theme';
import {useTrackingStore} from '../stores/useTrackingStore';

type IconPair = {focused: keyof typeof Ionicons.glyphMap; unfocused: keyof typeof Ionicons.glyphMap};

const TAB_ICONS: Record<string, IconPair> = {
  Map: {focused: 'map', unfocused: 'map-outline'},
  Search: {focused: 'search', unfocused: 'search-outline'},
  Contribute: {focused: 'trophy', unfocused: 'trophy-outline'},
  Settings: {focused: 'settings', unfocused: 'settings-outline'},
};

type TabItemProps = {
  route: string;
  label: string;
  isFocused: boolean;
  pendingDot?: boolean;
  onPress: () => void;
  onLongPress: () => void;
};

function TabItem({
  route,
  label,
  isFocused,
  pendingDot,
  onPress,
  onLongPress,
}: TabItemProps) {
  const {isDark, surface} = useTheme();
  const icons =
    TAB_ICONS[route] ?? {focused: 'ellipse', unfocused: 'ellipse-outline'};

  const activePillFill = isDark ? surface.cardAlt : surface.bgAlt;
  const activeIconColor = palette.emerald;
  const inactiveIconColor = surface.textDim;

  const pillStyle = useAnimatedStyle(() => ({
    backgroundColor: withTiming(
      isFocused ? activePillFill : 'transparent',
      {duration: 220},
    ),
    transform: [{scale: withTiming(isFocused ? 1 : 0.94, {duration: 180})}],
  }));

  const iconColor = isFocused ? activeIconColor : inactiveIconColor;
  const labelColor = isFocused ? palette.ink : surface.textDim;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={isFocused ? {selected: true} : {}}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({pressed}) => [styles.tabItem, pressed && {opacity: 0.75}]}>
      <Animated.View style={[styles.pill, pillStyle]}>
        <View style={styles.iconWrap}>
          <Ionicons
            name={isFocused ? icons.focused : icons.unfocused}
            size={22}
            color={iconColor}
          />
          {pendingDot ? <View style={styles.pendingDot} /> : null}
        </View>
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            {color: labelColor, fontWeight: isFocused ? '700' : '500'},
          ]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export default function GlassTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const {isDark, surface} = useTheme();
  const isTracking = useTrackingStore((s) => s.isTracking);

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom, 4),
          // Subtle fallback background so the home-indicator strip blends
          // with the tab bar instead of letting map content bleed through.
          backgroundColor: isDark
            ? 'rgba(7,17,13,0.5)'
            : 'rgba(243,242,238,0.5)',
        },
      ]}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 80 : 40}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      {/* Tinted glass overlay — matches <Glass> tokens. */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {backgroundColor: surface.glassBg},
        ]}
      />
      {/* Inner top edge — 0.5px hairline */}
      <View
        style={[
          styles.edge,
          {backgroundColor: surface.glassEdge},
        ]}
      />

      <View style={styles.tabRow}>
        {state.routes.map((route, index) => {
          const {options} = descriptors[route.key];
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : options.title !== undefined
                ? options.title
                : route.name;

          const isFocused = state.index === index;
          const pendingDot = route.name === 'Contribute' && isTracking;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <TabItem
              key={route.key}
              route={route.name}
              label={label as string}
              isFocused={isFocused}
              pendingDot={pendingDot}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  edge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
  },
  pill: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    minWidth: 64,
  },
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    height: 24,
  },
  pendingDot: {
    position: 'absolute',
    top: -2,
    right: -6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.amber,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  label: {
    fontSize: 10,
    marginTop: 2,
    letterSpacing: 0.2,
  },
});
