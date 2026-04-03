import React from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import {BlurView} from 'expo-blur';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {useTheme} from '../hooks/useTheme';
import {colors} from '../constants/theme';

const TAB_ICONS: Record<string, {focused: string; unfocused: string}> = {
  Map: {focused: 'map', unfocused: 'map-outline'},
  Search: {focused: 'search', unfocused: 'search-outline'},
  Saved: {focused: 'bookmark', unfocused: 'bookmark-outline'},
  Settings: {focused: 'settings', unfocused: 'settings-outline'},
};

const AnimatedView = Animated.createAnimatedComponent(View);

function TabItem({
  route,
  label,
  isFocused,
  onPress,
  onLongPress,
}: {
  route: string;
  label: string;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const {isDark} = useTheme();
  const icons = TAB_ICONS[route] || {focused: 'ellipse', unfocused: 'ellipse-outline'};

  const pillStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: withTiming(
        isFocused
          ? isDark
            ? 'rgba(29, 158, 117, 0.25)'
            : 'rgba(29, 158, 117, 0.12)'
          : 'transparent',
        {duration: 250},
      ),
      transform: [{scale: withTiming(isFocused ? 1 : 0.95, {duration: 200})}],
    };
  }, [isFocused, isDark]);

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={isFocused ? {selected: true} : {}}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tabItem}
      activeOpacity={0.7}>
      <AnimatedView style={[styles.pill, pillStyle]}>
        <Ionicons
          name={isFocused ? icons.focused as any : icons.unfocused as any}
          size={22}
          color={isFocused ? colors.green : isDark ? '#8E8E93' : '#8E8E93'}
        />
        <Text
          style={[
            styles.label,
            {
              color: isFocused ? colors.green : isDark ? '#8E8E93' : '#8E8E93',
              fontWeight: isFocused ? '600' : '400',
            },
          ]}
          numberOfLines={1}>
          {label}
        </Text>
      </AnimatedView>
    </TouchableOpacity>
  );
}

export default function GlassTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const {isDark} = useTheme();

  // Fallback background for areas where blur might not render (e.g. home indicator zone)
  const fallbackBg = isDark ? 'rgba(20,20,20,0.95)' : 'rgba(255,255,255,0.95)';

  return (
    <View style={[styles.container, {backgroundColor: fallbackBg}]}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 80 : 50}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      {/* Top border line */}
      <View
        style={[
          styles.border,
          {
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.08)'
              : 'rgba(0,0,0,0.06)',
          },
        ]}
      />
      <View style={[styles.tabRow, {paddingBottom: 6 + insets.bottom}]}>
        {state.routes.map((route, index) => {
          const {options} = descriptors[route.key];
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : options.title !== undefined
                ? options.title
                : route.name;

          const isFocused = state.index === index;

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
  border: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 6,
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
    paddingHorizontal: 16,
    borderRadius: 20,
    minWidth: 64,
  },
  label: {
    fontSize: 10,
    marginTop: 2,
    letterSpacing: 0.1,
  },
});
