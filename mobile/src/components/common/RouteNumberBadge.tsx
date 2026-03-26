import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {colors, radii} from '../../constants/theme';

interface RouteNumberBadgeProps {
  routeNumber: string;
  serviceType?: 'Normal' | 'Semi Luxury' | 'AC Luxury';
  size?: 'small' | 'large';
}

const colorMap = {
  Normal: {bg: colors.greenLight, text: colors.greenDark},
  'Semi Luxury': {bg: colors.amberLight, text: colors.amberDark},
  'AC Luxury': {bg: colors.blueLight, text: colors.blueDark},
};

export default function RouteNumberBadge({
  routeNumber,
  serviceType = 'Normal',
  size = 'small',
}: RouteNumberBadgeProps) {
  const scheme = colorMap[serviceType] ?? colorMap.Normal;
  const isLarge = size === 'large';

  return (
    <View
      style={[
        styles.badge,
        {backgroundColor: scheme.bg},
        isLarge && styles.badgeLarge,
      ]}>
      <Text
        style={[
          styles.text,
          {color: scheme.text},
          isLarge && styles.textLarge,
        ]}
       >
        {routeNumber}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 40,
    height: 28,
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeLarge: {
    minWidth: 56,
    height: 40,
    borderRadius: radii.lg,
    paddingHorizontal: 12,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
  },
  textLarge: {
    fontSize: 24,
    fontWeight: '700',
  },
});
